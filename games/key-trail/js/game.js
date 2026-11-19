/**
 * Key Trail: screens, the on-screen keyboard, and keyboard input.
 * The rules live in engine.js; this file only draws them.
 */
import { StorageManager } from "../../shared/StorageManager.js"
import { keyIsNotForGame } from "../../shared/keyboardGuard.js"
import { FINGERS, FINGER_OF, LESSONS, ROWS, SENTENCES, keysUpTo } from "./lessons.js"
import { Run, practiceLine, stars, updateErrors, wpm } from "./engine.js"

const LINES_PER_LESSON = 2
const SPEED_MS = 60000

/** Who walks the trail, and where to. The player picks one on the menu. */
const WALKERS = [
  ["turtle", "\u{1F422}", "house", "\u{1F3E0}"],
  ["rabbit", "\u{1F407}", "carrot", "\u{1F955}"],
  ["bee", "\u{1F41D}", "flower", "\u{1F33C}"],
  ["dog", "\u{1F415}", "bone", "\u{1F9B4}"],
  ["mouse", "\u{1F401}", "cheese", "\u{1F9C0}"],
  ["monkey", "\u{1F412}", "banana", "\u{1F34C}"],
]

const storage = new StorageManager("key-trail", "1")

let doc, $
let save // { stars: {lessonIndex: 1-3}, errors: {key: count}, best: wpm, walker: index }
let mode // "lesson" or "speed"; null means not accepting typing (menu, done, or the pause after a finished line)
let lesson // index into LESSONS
let lines, lineIndex, run, firstKeyAt, timer, pending
const keyEls = {} // key -> its element on the on-screen keyboard
let totals // { chars, missed } over the finished lines

export function init(d = document) {
  doc = d
  $ = (id) => doc.getElementById(id)
  save = { stars: {}, errors: {}, best: 0, walker: 0, ...storage.loadGameState() }
  buildKeyboard()
  buildWalkers()
  $("speed-btn").addEventListener("click", startSpeed)
  $("again-btn").addEventListener("click", () => (lesson >= 0 ? startLesson(lesson) : startSpeed()))
  $("next-btn").addEventListener("click", () => startLesson(lesson + 1))
  $("menu-btn").addEventListener("click", showMenu)
  // Capture phase, so a typed letter reaches the game before shared/nav.js,
  // whose site shortcuts (t cycles the theme, ? opens help) would also fire.
  doc.removeEventListener("keydown", onKey, true) // init can run again on the same document
  doc.addEventListener("keydown", onKey, true)
  showMenu()
}

function show(screen) {
  for (const id of ["menu", "play", "done"]) $(id).classList.toggle("hidden", id !== screen)
  // A focused button would swallow Space, which is a key the player types.
  doc.activeElement?.blur?.()
}

function showMenu() {
  clearInterval(timer)
  clearTimeout(pending)
  mode = null
  const list = $("lesson-list")
  list.replaceChildren()
  LESSONS.forEach((keys, i) => {
    const button = doc.createElement("button")
    button.className = "lesson-btn"
    const earned = save.stars[i] || 0
    button.innerHTML = `<b>${[...keys].join(" ")}</b><span>${"★".repeat(earned)}${"☆".repeat(3 - earned)}</span>`
    button.setAttribute(
      "aria-label",
      `Lesson ${i + 1}: keys ${[...keys].join(" ")}, ${earned} stars`,
    )
    button.addEventListener("click", () => startLesson(i))
    const li = doc.createElement("li")
    li.append(button)
    list.append(li)
  })
  $("best").textContent = save.best ? `Best: ${save.best} words per minute` : ""
  show("menu")
}

function startLesson(i) {
  mode = "lesson"
  lesson = i
  lines = Array.from({ length: LINES_PER_LESSON }, () => practiceLine(i, save.errors))
  $("play-title").textContent = `Lesson ${i + 1}: ${[...LESSONS[i]].join(" ")}`
  begin(keysUpTo(i))
}

function startSpeed() {
  mode = "speed"
  lesson = -1
  lines = [...SENTENCES].sort(() => Math.random() - 0.5)
  $("play-title").textContent = "Speed run"
  $("play-progress").textContent = "1:00"
  begin(ROWS.join(""))
}

function begin(taught) {
  lineIndex = 0
  totals = { chars: 0, missed: 0 }
  firstKeyAt = null
  for (const [key, el] of Object.entries(keyEls)) {
    el.classList.toggle("locked", key !== " " && !taught.includes(key))
  }
  show("play")
  startLine()
}

function startLine() {
  run = new Run(lines[lineIndex % lines.length])
  const line = $("line")
  line.replaceChildren(
    ...[...run.text].map((ch) => {
      const span = doc.createElement("span")
      span.textContent = ch
      if (ch === " ") span.className = "space"
      return span
    }),
  )
  if (mode === "lesson") $("play-progress").textContent = `Line ${lineIndex + 1} of ${lines.length}`
  draw()
}

/** Move the walker, mark typed letters, and point at the next key. */
function draw() {
  const spans = $("line").children
  for (let i = 0; i < spans.length; i++) {
    spans[i].classList.toggle("typed", i < run.pos)
    spans[i].classList.toggle("missed", run.missed.has(i))
    spans[i].classList.toggle("current", i === run.pos)
  }
  const progress =
    mode === "lesson"
      ? (lines.slice(0, lineIndex).join("").length + run.pos) / lines.join("").length
      : run.pos / run.text.length
  $("walker").style.left = `${progress * 85}%` // stop just short of the house

  for (const el of Object.values(keyEls)) el.classList.remove("next")
  const next = run.target
  $("hint").textContent = ""
  if (next === undefined) return
  keyEls[next]?.classList.add("next")
  $("hint").textContent =
    next === " " ? "Space: either thumb" : `${next}: ${FINGERS[FINGER_OF[next]]} finger`
}

function onKey(event) {
  if (keyIsNotForGame(event)) return
  if (event.key === "Escape") return mode === "speed" && firstKeyAt ? endSpeed(true) : showMenu()
  if (mode === null) {
    if (event.key === "Enter" && !$("done").classList.contains("hidden")) {
      event.preventDefault()
      $(lesson >= 0 && lesson < LESSONS.length - 1 ? "next-btn" : "again-btn").click()
    }
    return
  }
  if (event.key === "Backspace") {
    event.preventDefault()
    $("hint").textContent = "No need to erase. Just type the right key."
    return
  }
  if (event.key.length !== 1) return
  // Space would scroll the page, and ' or / open quick find in Firefox.
  event.preventDefault()
  event.stopPropagation() // while playing, every key is typing, not a shortcut
  if (firstKeyAt === null) {
    firstKeyAt = Date.now()
    if (mode === "speed") timer = setInterval(tick, 250)
  }
  const key = event.key.toLowerCase() // Caps Lock should not block a beginner.
  const ok = run.press(key)
  flash(key, ok)
  if (!ok) {
    $("walker").classList.remove("shake")
    void $("walker").offsetWidth // restart the animation
    $("walker").classList.add("shake")
  }
  draw()
  if (run.done) finishLine()
}

function flash(key, ok) {
  const el = keyEls[key]
  if (!el) return
  el.classList.add(ok ? "hit" : "miss")
  setTimeout(() => el.classList.remove("hit", "miss"), 150)
}

function finishLine() {
  totals.chars += run.text.length
  totals.missed += run.missed.size
  save.errors = updateErrors(save.errors, run)
  lineIndex++
  if (mode === "lesson" && lineIndex >= lines.length) {
    mode = null
    pending = setTimeout(finishLesson, 500) // let the walker reach the house first
  } else {
    startLine()
  }
  storage.saveGameState(save)
}

function finishLesson() {
  const accuracy = (totals.chars - totals.missed) / totals.chars
  const earned = stars(accuracy)
  save.stars[lesson] = Math.max(save.stars[lesson] || 0, earned)
  storage.saveGameState(save)
  showDone(
    earned === 3 ? "Perfect walk!" : "You made it home!",
    "★".repeat(earned) + "☆".repeat(3 - earned),
    `${Math.round(accuracy * 100)}% right on the first try, ` +
      `${wpm(totals.chars, Date.now() - firstKeyAt)} words per minute`,
  )
  $("next-btn").classList.toggle("hidden", lesson >= LESSONS.length - 1)
}

/** Words per minute so far. Only characters typed right count, so mashing keys does not help. */
function speedScore(ms) {
  const right = totals.chars + run.pos - totals.missed - run.missed.size
  return wpm(Math.max(right, 0), ms)
}

function tick() {
  const elapsed = Date.now() - firstKeyAt
  if (elapsed < SPEED_MS) {
    const s = Math.ceil((SPEED_MS - elapsed) / 1000)
    // The first few seconds give wild numbers, so wait before showing a speed.
    const speed = elapsed >= 5000 ? `, ${speedScore(elapsed)} wpm` : ""
    $("play-progress").textContent = `0:${String(s).padStart(2, "0")}${speed}`
    return
  }
  endSpeed(false)
}

/** End the speed run. Stopping early shows the speed so far, but it cannot set a best. */
function endSpeed(early) {
  clearInterval(timer)
  mode = null
  const score = speedScore(early ? Date.now() - firstKeyAt : SPEED_MS)
  const record = !early && score > save.best
  if (record) save.best = score
  storage.saveGameState(save)
  const title = early ? "Stopped early" : record ? "New best!" : "Time!"
  const detail = early
    ? `Only a full minute can set a best. Best: ${save.best}`
    : `Best: ${save.best}`
  showDone(title, `${score} words per minute`, detail)
  $("next-btn").classList.add("hidden")
}

function showDone(title, big, detail) {
  $("done-title").textContent = title
  $("done-big").textContent = big
  $("done-detail").textContent = detail
  show("done")
}

function buildWalkers() {
  WALKERS.forEach(([name, walker, goalName], i) => {
    const button = doc.createElement("button")
    button.className = "walker-btn"
    button.textContent = walker
    button.setAttribute("aria-label", `${name} walks to the ${goalName}`)
    button.addEventListener("click", () => {
      save.walker = i
      storage.saveGameState(save)
      setWalker()
    })
    $("walkers").append(button)
  })
  setWalker()
}

function setWalker() {
  const [, walker, , goal] = WALKERS[save.walker] || WALKERS[0]
  $("walker").textContent = walker
  $("home").textContent = goal
  ;[...$("walkers").children].forEach((b, i) => b.setAttribute("aria-pressed", i === save.walker))
}

function buildKeyboard() {
  const board = $("keyboard")
  for (const row of ROWS) {
    const div = doc.createElement("div")
    div.className = "key-row"
    for (const key of row) {
      const span = doc.createElement("span")
      span.className = `key f${FINGER_OF[key]}`
      if (key === "f" || key === "j") span.classList.add("bump")
      keyEls[key] = span
      span.textContent = key
      div.append(span)
    }
    board.append(div)
  }
  const space = doc.createElement("span")
  space.className = "key space-key thumb"
  keyEls[" "] = space
  space.textContent = "space"
  const row = doc.createElement("div")
  row.className = "key-row"
  row.append(space)
  board.append(row)
}

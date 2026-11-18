import { TuringMachine } from "./TuringMachine.js"
import { levels, levelFromParam } from "./levels.js"
import { strings } from "./strings.js"

const STORAGE_KEY = "turingTape"
const PLAY_INTERVAL_MS = 400

let machine = null
let currentLevel = null
let playTimer = null
let completedLevels = new Set()
let playLabelText = "Play" // the page's own (translated) label

// --- DOM refs ---
// Filled in by init(), so a test can start the game on a document of its own.
let levelNav, levelTitle, levelDescription, targetTapeEl, activeTapeEl
let headIndicator, stepCountEl, currentStateEl, resultMsg, ruleBody
let stepBtn, playBtn, playLabel, playIcon, resetBtn, addRuleBtn
let S, localized

/**
 * Look up the page's elements, wire the controls and load the first level.
 * `main.js` calls this with the real document.
 * @param {Document} doc
 */
export function init(doc = document) {
  const $ = (id) => doc.getElementById(id)
  levelNav = $("level-nav")
  levelTitle = $("level-title")
  levelDescription = $("level-description")
  targetTapeEl = $("target-tape")
  activeTapeEl = $("active-tape")
  headIndicator = $("head-indicator")
  stepCountEl = $("step-count")
  currentStateEl = $("current-state")
  resultMsg = $("result-msg")
  ruleBody = $("rule-body")
  stepBtn = $("step-btn")
  playBtn = $("play-btn")
  playLabel = $("play-label")
  playIcon = $("play-icon")
  resetBtn = $("reset-btn")
  addRuleBtn = $("add-rule-btn")
  ;({ s: S, text: localized } = strings(doc))
  $("back-link").setAttribute("aria-label", S.back)
  playLabelText = playLabel.textContent

  stopPlay()
  completedLevels = loadProgress()
  try {
    buildLevelNav()
    const params = new URLSearchParams(window.location.search)
    loadLevel(levelFromParam(params.get("level")) || levels[0])
  } catch (error) {
    console.error("Failed to initialize Turing Tape:", error)
  }

  stepBtn.addEventListener("click", doStep)
  playBtn.addEventListener("click", togglePlay)
  resetBtn.addEventListener("click", doReset)
  addRuleBtn.addEventListener("click", () => addRuleRow())

  // The same function each time, so a second init() does not stack handlers.
  doc.addEventListener("keydown", onKeydown)
}

// --- Level navigation ---
function buildLevelNav() {
  levelNav.innerHTML = ""
  for (const level of levels) {
    const btn = document.createElement("button")
    btn.className = "level-btn"
    btn.textContent = localized(level).name
    btn.dataset.navId = level.id
    if (completedLevels.has(level.id)) {
      btn.classList.add("completed")
      // Colour is the only other cue, which says nothing to a screen reader.
      btn.append(
        Object.assign(document.createElement("span"), {
          className: "visually-hidden",
          textContent: S.solved,
        }),
      )
    }
    btn.addEventListener("click", () => loadLevel(level))
    levelNav.appendChild(btn)
  }
}

function updateNavHighlight(id) {
  for (const btn of levelNav.children) {
    btn.classList.toggle("active", btn.dataset.navId === String(id))
  }
}

function loadLevel(level) {
  stopPlay()
  currentLevel = level
  const rules = new Map()
  machine = new TuringMachine([...level.tape], rules, "A", level.headStart)

  const { name, description } = localized(level)
  levelTitle.textContent = name
  levelDescription.textContent = description
  updateNavHighlight(level.id)
  syncUrlToLevel(level)

  renderTargetTape()
  buildRuleTable()
  hideResult()
  updateDisplay()
}

// Keeps `?level=` in sync with the puzzle on screen, so it can be shared
// with a link.
function syncUrlToLevel(level) {
  const params = new URLSearchParams(window.location.search)
  params.set("level", String(levels.indexOf(level) + 1))
  const newUrl = `${window.location.pathname}?${params}${window.location.hash}`
  window.history.replaceState(null, "", newUrl)
}

// --- Tape rendering ---
function renderTargetTape() {
  targetTapeEl.innerHTML = ""
  for (const sym of currentLevel.target) {
    targetTapeEl.appendChild(makeCell(sym))
  }
}

function makeCell(symbol) {
  const div = document.createElement("div")
  div.className = "tape-cell"
  div.textContent = symbol
  return div
}

/**
 * Keep the head cell inside the tape's visible strip.
 *
 * The machine grows the tape as it runs, so on a long run -- or on any narrow
 * screen -- the head walks off the edge of `.tape-scroll` and the player is
 * watching an empty stretch of tape. Nudged rather than centred, so a head
 * moving back and forth in view does not make the whole tape jitter.
 *
 * `offsetLeft` is measured against `.tape-scroll` (the nearest positioned
 * ancestor) and does not move as that element scrolls, unlike a bounding rect.
 *
 * @param {HTMLElement} headCell - The cell currently under the head.
 */
function scrollHeadIntoView(headCell) {
  const scroller = activeTapeEl.parentElement
  if (!scroller) return

  const margin = 8
  const left = headCell.offsetLeft
  const right = left + headCell.offsetWidth

  if (left - margin < scroller.scrollLeft) {
    scroller.scrollLeft = Math.max(0, left - margin)
  } else if (right + margin > scroller.scrollLeft + scroller.clientWidth) {
    scroller.scrollLeft = right + margin - scroller.clientWidth
  }
}

function updateDisplay() {
  const { tape, head, state, stepCount, halted } = machine

  // Update tape cells
  activeTapeEl.innerHTML = ""
  for (let i = 0; i < tape.length; i++) {
    const cell = makeCell(tape[i])
    if (i === head) cell.classList.add("head")
    activeTapeEl.appendChild(cell)
  }

  // Position head indicator
  const headCell = activeTapeEl.children[head]
  if (headCell) {
    const tapeRect = activeTapeEl.getBoundingClientRect()
    const cellRect = headCell.getBoundingClientRect()
    headIndicator.style.left = `${cellRect.left - tapeRect.left + cellRect.width / 2 - 6}px`
    scrollHeadIntoView(headCell)
  }

  currentStateEl.textContent = state
  stepCountEl.textContent = stepCount

  // Disable step/play when halted
  stepBtn.disabled = halted
  playBtn.disabled = halted

  // On halt, show which cells match the goal.
  if (halted) highlightMatches()
}

function highlightMatches() {
  // matchMask aligns the tape with the goal exactly the way matchesTape does,
  // so the colours can't disagree with the win/lose message.
  const mask = machine.matchMask(currentLevel.target)
  const cells = activeTapeEl.children
  for (let i = 0; i < cells.length && i < mask.length; i++) {
    cells[i].classList.add(mask[i] ? "match" : "mismatch")
  }
}

// --- Rule table ---
function buildRuleTable() {
  ruleBody.innerHTML = ""
  addRuleRow()
}

function addRuleRow() {
  const tr = document.createElement("tr")

  const stateSelect = makeSelect(currentLevel.states)
  const readSelect = makeSelect(currentLevel.symbols)
  const writeSelect = makeSelect(currentLevel.symbols)
  const moveSelect = makeSelect(["L", "R", "S"])
  const nextStateSelect = makeSelect(currentLevel.states)

  const selects = [stateSelect, readSelect, writeSelect, moveSelect, nextStateSelect]

  for (let i = 0; i < selects.length; i++) {
    const sel = selects[i]
    sel.setAttribute("aria-label", S.fields[i])
    const td = document.createElement("td")
    td.appendChild(sel)
    tr.appendChild(td)
    sel.addEventListener("change", syncRules)
    blurAfterPointerPick(sel)
  }

  const deleteTd = document.createElement("td")
  const deleteBtn = document.createElement("button")
  deleteBtn.className = "delete-rule-btn"
  deleteBtn.textContent = "\u00d7"
  deleteBtn.title = S.removeRule
  deleteBtn.setAttribute("aria-label", S.removeRule)
  deleteBtn.addEventListener("click", () => {
    tr.remove()
    syncRules()
  })
  deleteTd.appendChild(deleteBtn)
  tr.appendChild(deleteTd)

  ruleBody.appendChild(tr)
  syncRules()
}

// A focused select keeps Space, Enter and R for itself (the Move select has an
// "R" option), so the page shortcuts stop working until focus leaves it. After
// a mouse or touch pick, give focus back to the page. A keyboard user arrowing
// through options keeps focus.
function blurAfterPointerPick(select) {
  let pickedWithPointer = false
  select.addEventListener("pointerdown", () => {
    pickedWithPointer = true
  })
  select.addEventListener("keydown", () => {
    pickedWithPointer = false
  })
  select.addEventListener("change", () => {
    if (pickedWithPointer) select.blur()
    pickedWithPointer = false
  })
}

// A new row starts blank, so the player picks every field rather than
// inheriting "A, 0, 0, L, A". readRulesFromDOM skips a row until it is full.
function makeSelect(options) {
  const select = document.createElement("select")
  const blank = document.createElement("option")
  blank.value = ""
  blank.textContent = "\u2013"
  select.appendChild(blank)
  for (const opt of options) {
    const option = document.createElement("option")
    option.value = opt
    option.textContent = opt
    select.appendChild(option)
  }
  return select
}

function syncRules() {
  const rules = readRulesFromDOM()
  machine.rules = rules
}

function readRulesFromDOM() {
  const rules = new Map()
  for (const row of ruleBody.children) {
    const selects = row.querySelectorAll("select")
    if (selects.length < 5) continue
    const state = selects[0].value
    const read = selects[1].value
    const write = selects[2].value
    const move = selects[3].value
    const nextState = selects[4].value
    if ([state, read, write, move, nextState].includes("")) continue
    rules.set(`${state},${read}`, { write, move, nextState })
  }
  return rules
}

function highlightActiveRule(state, symbol) {
  for (const row of ruleBody.children) {
    const selects = row.querySelectorAll("select")
    if (selects.length < 5) continue
    const isActive = selects[0].value === state && selects[1].value === symbol
    row.classList.toggle("active-rule", isActive)
  }
}

// --- Controls ---
function doStep() {
  if (machine.halted) return
  try {
    const prevState = machine.state
    const prevSymbol = machine.tape[machine.head]
    machine.step()
    highlightActiveRule(prevState, prevSymbol)
    updateDisplay()

    if (machine.halted) {
      stopPlay()
      checkWin()
    }
  } catch (error) {
    console.error("Step error:", error)
    stopPlay()
  }
}

function togglePlay() {
  if (playTimer) {
    stopPlay()
    return
  }
  // A halted machine can't step, so a timer here would tick uselessly forever
  // with the button stuck reading "Pause". Reachable via the Enter shortcut
  // even though the button itself is disabled.
  if (machine.halted) return
  playIcon.innerHTML = "&#x23f8;"
  playLabel.textContent = S.pause
  playTimer = setInterval(doStep, PLAY_INTERVAL_MS)
}

function stopPlay() {
  if (playTimer) {
    clearInterval(playTimer)
    playTimer = null
  }
  playIcon.innerHTML = "&#x25b6;"
  playLabel.textContent = playLabelText
}

function doReset() {
  stopPlay()
  machine.reset()
  syncRules()
  hideResult()
  for (const row of ruleBody.children) {
    row.classList.remove("active-rule")
  }
  updateDisplay()
}

function checkWin() {
  if (machine.matchesTape(currentLevel.target) && machine.haltReason === "halt-state") {
    showResult("success", S.solvedIn(machine.stepCount))
    const next = levels[levels.indexOf(currentLevel) + 1]
    if (next) {
      const nextBtn = document.createElement("button")
      nextBtn.className = "ctrl-btn"
      nextBtn.textContent = S.next
      nextBtn.addEventListener("click", () => loadLevel(next))
      resultMsg.append(" ", nextBtn)
    }
    completedLevels.add(currentLevel.id)
    saveProgress()
    buildLevelNav()
    updateNavHighlight(currentLevel.id)
  } else if (machine.haltReason === "max-steps") {
    showResult("error", S.noHalt(machine.stepCount))
  } else if (machine.haltReason === "no-rule") {
    showResult("error", S.noRule(machine.state, machine.tape[machine.head]))
  } else {
    showResult("error", S.mismatch)
  }
}

function showResult(type, msg) {
  resultMsg.textContent = msg
  resultMsg.className = `result-msg ${type}`
}

function hideResult() {
  resultMsg.className = "result-msg hidden"
}

// --- Persistence ---
function loadProgress() {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (data) return new Set(JSON.parse(data))
  } catch {
    // ignore
  }
  return new Set()
}

function saveProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...completedLevels]))
  } catch {
    // ignore
  }
}

// --- Keyboard ---
function onKeydown(e) {
  // Leave focused controls alone: Space and Enter activate a focused button,
  // and form controls handle these keys themselves. e.target can be the
  // document, which has no closest().
  const target = e.target
  if (typeof target?.closest === "function" && target.closest("button, select, input, textarea")) {
    return
  }
  // Leave browser and OS shortcuts alone. Without this, Cmd-R reset the machine
  // on its way to reloading the page and Cmd-Enter started it running.
  if (e.metaKey || e.ctrlKey || e.altKey) {
    return
  }

  if (e.key === " ") {
    e.preventDefault()
    doStep()
  } else if (e.key === "Enter") {
    e.preventDefault()
    togglePlay()
  } else if (e.key === "r" || e.key === "R") {
    doReset()
  }
}

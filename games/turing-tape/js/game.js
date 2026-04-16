import { TuringMachine } from "./TuringMachine.js"
import { levels, demos } from "./levels.js"

const STORAGE_KEY = "turingTape"
const PLAY_INTERVAL_MS = 400

let machine = null
let currentLevel = null
let isDemo = false
let playTimer = null
const completedLevels = loadProgress()

// --- DOM refs ---
const $ = (id) => document.getElementById(id)
const levelNav = $("level-nav")
const demoNav = $("demo-nav")
const levelTitle = $("level-title")
const levelDescription = $("level-description")
const targetSection = $("target-section")
const targetTapeEl = $("target-tape")
const activeTapeEl = $("active-tape")
const headIndicator = $("head-indicator")
const stepDisplay = $("step-display")
const currentStateEl = $("current-state")
const resultMsg = $("result-msg")
const ruleBody = $("rule-body")
const stepBtn = $("step-btn")
const playBtn = $("play-btn")
const resetBtn = $("reset-btn")
const addRuleBtn = $("add-rule-btn")

// --- Init ---
buildLevelNav()
buildDemoNav()
loadLevel(levels[0])

// --- Level navigation ---
function buildLevelNav() {
  levelNav.innerHTML = ""
  for (const level of levels) {
    const btn = document.createElement("button")
    btn.className = "level-btn"
    btn.textContent = level.name
    if (completedLevels.has(level.id)) btn.classList.add("completed")
    btn.addEventListener("click", () => loadLevel(level))
    levelNav.appendChild(btn)
  }
}

function buildDemoNav() {
  demoNav.innerHTML = ""
  for (const demo of demos) {
    const btn = document.createElement("button")
    btn.className = "level-btn"
    btn.textContent = demo.name
    btn.addEventListener("click", () => loadDemo(demo))
    demoNav.appendChild(btn)
  }
}

function updateNavHighlight(name) {
  for (const btn of levelNav.children) {
    btn.classList.toggle("active", btn.textContent === name)
  }
  for (const btn of demoNav.children) {
    btn.classList.toggle("active", btn.textContent === name)
  }
}

function loadLevel(level) {
  stopPlay()
  isDemo = false
  currentLevel = level
  const rules = new Map()
  machine = new TuringMachine([...level.tape], rules, "A", level.headStart)

  levelTitle.textContent = level.name
  levelDescription.textContent = level.description
  updateNavHighlight(level.name)

  // Show target tape for puzzles
  targetSection.classList.remove("hidden")
  renderTargetTape()

  // Editable rule table
  addRuleBtn.classList.remove("hidden")
  buildRuleTable(null)
  hideResult()
  updateDisplay()
}

function loadDemo(demo) {
  stopPlay()
  isDemo = true
  currentLevel = demo
  const rules = parseRules(demo.rules)
  machine = new TuringMachine([...demo.tape], rules, "A", demo.headStart)

  levelTitle.textContent = demo.name
  levelDescription.textContent = demo.description
  updateNavHighlight(demo.name)

  // Hide target tape for demos
  targetSection.classList.add("hidden")

  // Read-only rule table
  addRuleBtn.classList.add("hidden")
  buildRuleTable(demo.rules)
  hideResult()
  updateDisplay()
}

function parseRules(ruleArray) {
  const rules = new Map()
  for (const [state, read, write, move, nextState] of ruleArray) {
    rules.set(`${state},${read}`, { write, move, nextState })
  }
  return rules
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
  }

  currentStateEl.textContent = state
  stepDisplay.textContent = `Steps: ${stepCount}`

  // Disable step/play when halted
  stepBtn.disabled = halted
  playBtn.disabled = halted

  // If halted, show match/mismatch on tape cells (puzzles) or just a done message (demos)
  if (halted) {
    if (isDemo) {
      showResult("success", `Halted after ${stepCount} steps. State: ${state}`)
    } else {
      highlightMatches()
    }
  }
}

function highlightMatches() {
  const target = currentLevel.target
  const cells = activeTapeEl.children
  for (let i = 0; i < cells.length && i < target.length; i++) {
    if (machine.tape[i] === target[i]) {
      cells[i].classList.add("match")
    } else {
      cells[i].classList.add("mismatch")
    }
  }
}

// --- Rule table ---
function buildRuleTable(prefilled) {
  ruleBody.innerHTML = ""
  if (prefilled) {
    for (const [state, read, write, move, nextState] of prefilled) {
      addRuleRow(state, read, write, move, nextState, true)
    }
  } else {
    addRuleRow()
  }
}

function addRuleRow(
  stateVal = null,
  readVal = null,
  writeVal = null,
  moveVal = null,
  nextVal = null,
  readonly = false,
) {
  const tr = document.createElement("tr")

  const stateSelect = makeSelect(currentLevel.states, stateVal, readonly)
  const readSelect = makeSelect(currentLevel.symbols, readVal, readonly)
  const writeSelect = makeSelect(currentLevel.symbols, writeVal, readonly)
  const moveSelect = makeSelect(["L", "R", "S"], moveVal, readonly)
  const nextStateSelect = makeSelect(currentLevel.states, nextVal, readonly)

  for (const sel of [stateSelect, readSelect, writeSelect, moveSelect, nextStateSelect]) {
    const td = document.createElement("td")
    td.appendChild(sel)
    tr.appendChild(td)
    if (!readonly) sel.addEventListener("change", syncRules)
  }

  const deleteTd = document.createElement("td")
  if (!readonly) {
    const deleteBtn = document.createElement("button")
    deleteBtn.className = "delete-rule-btn"
    deleteBtn.textContent = "\u00d7"
    deleteBtn.title = "Remove rule"
    deleteBtn.addEventListener("click", () => {
      tr.remove()
      syncRules()
    })
    deleteTd.appendChild(deleteBtn)
  }
  tr.appendChild(deleteTd)

  ruleBody.appendChild(tr)
  if (!readonly) syncRules()
}

function makeSelect(options, selectedValue = null, readonly = false) {
  const select = document.createElement("select")
  if (readonly) select.disabled = true
  for (const opt of options) {
    const option = document.createElement("option")
    option.value = opt
    option.textContent = opt
    if (opt === selectedValue) option.selected = true
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
  const prevState = machine.state
  const prevSymbol = machine.tape[machine.head]
  machine.step()
  highlightActiveRule(prevState, prevSymbol)
  updateDisplay()

  if (machine.halted) {
    stopPlay()
    if (!isDemo) checkWin()
  }
}

function togglePlay() {
  if (playTimer) {
    stopPlay()
  } else {
    playBtn.innerHTML = '<span class="btn-icon">&#x23f8;</span> Pause <kbd>Enter</kbd>'
    playTimer = setInterval(doStep, PLAY_INTERVAL_MS)
  }
}

function stopPlay() {
  if (playTimer) {
    clearInterval(playTimer)
    playTimer = null
  }
  playBtn.innerHTML = '<span class="btn-icon">&#x25b6;</span> Play <kbd>Enter</kbd>'
}

function doReset() {
  stopPlay()
  machine.reset()
  if (!isDemo) syncRules()
  hideResult()
  for (const row of ruleBody.children) {
    row.classList.remove("active-rule")
  }
  updateDisplay()
}

function checkWin() {
  if (machine.matchesTape(currentLevel.target) && machine.haltReason === "halt-state") {
    showResult("success", `Solved in ${machine.stepCount} steps!`)
    completedLevels.add(currentLevel.id)
    saveProgress()
    buildLevelNav()
    updateNavHighlight(currentLevel.name)
  } else if (machine.haltReason === "max-steps") {
    showResult("error", `Ran for ${machine.stepCount} steps without halting. Try different rules.`)
  } else if (machine.haltReason === "no-rule") {
    showResult(
      "error",
      `No rule for state ${machine.state} reading "${machine.tape[machine.head]}". Add a rule or adjust your rules.`,
    )
  } else {
    showResult("error", "Tape doesn't match the goal. Reset and try again.")
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

// --- Event listeners ---
stepBtn.addEventListener("click", doStep)
playBtn.addEventListener("click", togglePlay)
resetBtn.addEventListener("click", doReset)
addRuleBtn.addEventListener("click", () => addRuleRow())

document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "SELECT" || e.target.tagName === "INPUT") return

  if (e.key === " ") {
    e.preventDefault()
    doStep()
  } else if (e.key === "Enter") {
    e.preventDefault()
    togglePlay()
  } else if (e.key === "r" || e.key === "R") {
    doReset()
  }
})

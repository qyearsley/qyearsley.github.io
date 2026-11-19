/**
 * Seasons entry point -- wires the rules, the storage, and the screens together.
 *
 * The orchestrator, and the only file allowed to be impure. It owns the live
 * state object, the save timing, and the keyboard. It holds no rules of its
 * own: every decision about what an answer is worth or whether a season is over
 * comes back from GameState, and every pixel comes from GameUI.
 *
 * The answer cycle is explicit, because it is the one place timing matters. A
 * wrong answer is the short path: stop the clock, strike the choice off, show
 * the line, and hand the same question straight back, with no flash, wait or
 * penalty (see `rejectAnswer`). A correct answer is the long one:
 *
 *   1. stop the countdown, so a timeout cannot fire during the flash
 *   2. note where the character stands and what it is facing, before the answer
 *      moves it
 *   3. ask GameState what the answer did
 *   4. save immediately, so progress survives a closed tab mid-flash
 *   5. flash the result on the buttons for `flashDuration`
 *   6. if the question had been missed, hold up the reinforcement card and wait
 *      for a tap, the one step with no timer
 *   7. animate the character across the obstacle it just got past, if it did
 *   8. draw whatever comes next: the following question, or the result screen
 *
 * The module-level `answering` flag guards the whole cycle, the crossing
 * included. Without it a double-tap, or a tap in the same frame as a timeout,
 * would score twice, and a tap mid-crossing would answer a question not yet on
 * screen. `aria-disabled` on the buttons only announces that; this enforces it.
 * A `pointerdown` anywhere cuts the crossing short rather than shortening the
 * guard. The flag comes off early on the wrong-answer path, where the buttons
 * stay live, which is why `renderQuestion` refuses a click on a struck-off
 * choice.
 *
 * This file exports nothing and calls `start()` at the bottom, so importing it
 * starts the game. That is why index.html needs no bootstrap call, and why the
 * game.*.test.js files drive it black-box through the real markup, re-importing
 * it with a fresh query string per case.
 *
 * Error Handling: a corrupt or absent save starts a fresh run rather than
 * failing; `StorageManager` has already coerced anything it returns. A save
 * that fails to write (private browsing, a full quota) is ignored on purpose --
 * the game stays playable and simply forgets when the tab closes.
 */

import { PHASE, SEASON_ORDER } from "./constants.js"
import { GameUI } from "./GameUI.js"
import {
  advance,
  answer as applyAnswer,
  chooseCharacter,
  createState,
  questionSeconds,
  rehydrate,
} from "./GameState.js"
import { isGlowingAt, kindAt } from "./Journey.js"
import {
  LeaderboardStorage,
  addEntry,
  cleanName,
  hasRun,
  normalizeBoard,
  qualifies,
  todayKey,
} from "./leaderboard.js"
import { CHARACTERS, getCharacter } from "./characters.js"
import { SEASON_LIST, getSeason } from "./seasons.js"
import { StorageManager, defaultSave, toSavedRun } from "./storage.js"
import { keyIsNotForGame, closeSettingsOnEscape } from "../../shared/keyboardGuard.js"

const ui = new GameUI()
// The seasons the finished potion is built from, assigned rather than
// imported by GameUI; see renderJourneySoFar.
ui.seasonOrder = SEASON_LIST
const storage = new StorageManager()
const boardStorage = new LeaderboardStorage()

/**
 * What the debug query string asked for.
 *
 * @typedef {Object} DebugRequest
 * @property {boolean} on            - Any debug switch is set, so saving is off
 * @property {string|null} seasonId  - Season to start in
 * @property {string|null} characterId - Animal to play as
 * @property {string|null} phase     - Screen to jump to, as a `PHASE` value
 */

/**
 * The short names `?phase=` accepts, alongside the raw `PHASE` values.
 *
 * Short because they are typed by hand into a URL bar. `end` is the one worth
 * having: the last screen is otherwise four seasons away.
 * @private
 */
const DEBUG_PHASES = {
  trail: PHASE.TRAIL,
  boss: PHASE.BOSS,
  won: PHASE.SEASON_WON,
  end: PHASE.RUN_COMPLETE,
}

/**
 * Debug entry points, read once from the query string.
 *
 * For looking at a season without playing three to get there. `?season=winter`
 * drops into winter, `&character=sloth` picks the animal, `?phase=end` jumps to
 * the last screen, and `?debug=1` alone opens every season on the character
 * screen.
 *
 * Nothing is written to storage while any of these are set. Checking the art
 * must not overwrite a child's half-finished run, so `_save` becomes a no-op
 * rather than relying on callers to remember. A debug session leaves no trace.
 *
 * @private
 * @returns {DebugRequest} What the query string asked for
 */
function _readDebug() {
  let params
  try {
    params = new URLSearchParams(window.location.search)
  } catch {
    // A document with no usable location, which is only ever a test harness.
    return { on: false, seasonId: null, characterId: null, phase: null }
  }
  const seasonId = getSeason(params.get("season")) ? params.get("season") : null
  const wanted = params.get("character")
  // `getCharacter` substitutes a default for an unknown id, so an id is
  // only honoured when it really is one.
  const characterId = CHARACTERS.some((one) => one.id === wanted) ? wanted : null
  const asked = params.get("phase")
  const phase = DEBUG_PHASES[asked] ?? (Object.values(PHASE).includes(asked) ? asked : null)
  return {
    on: params.has("debug") || seasonId !== null || characterId !== null || phase !== null,
    seasonId,
    characterId,
    phase,
  }
}

/**
 * A saved run matching what the query string asked for.
 *
 * Built as a save and handed to `rehydrate`, so it gets the same coercion and
 * promotion as a real reload, including "a trail phase on the last space is
 * really at the boss", which is how `?phase=boss` gets a boss question.
 *
 * @private
 * @returns {Object} A run, ready for `rehydrate`
 */
function _debugRun() {
  const characterId = debug.characterId ?? CHARACTERS[0].id
  if (debug.phase === PHASE.RUN_COMPLETE) {
    // Every season needs a haul or the end-of-run summary is blank, and
    // the season on screen must be the last, as after a real finish.
    const last = getSeason(SEASON_ORDER.at(-1))
    return {
      phase: PHASE.RUN_COMPLETE,
      characterId,
      seasonId: last.id,
      position: last.spaces,
      items: last.demand,
      collected: Object.fromEntries(SEASON_ORDER.map((id) => [id, getSeason(id).demand])),
      bestStreak: last.spaces + 1,
    }
  }
  const season = getSeason(debug.seasonId) ?? getSeason(SEASON_ORDER[0])
  const base = { characterId, seasonId: season.id }
  switch (debug.phase) {
    case PHASE.BOSS:
      // Exactly the rescue short, where a real walk arrives: her question fills the jar.
      return {
        ...base,
        phase: PHASE.TRAIL,
        position: season.spaces,
        items: season.demand - season.boss.rescue,
      }
    case PHASE.SEASON_WON:
      return { ...base, phase: PHASE.SEASON_WON, position: season.spaces, items: season.demand }
    default:
      return { ...base, phase: PHASE.TRAIL, position: 0, items: 0 }
  }
}

/** @type {DebugRequest} */
const debug = _readDebug()

/** @type {Object} The live game state. */
let state = createState(_freshSeed())

/** @type {Object} The persisted wrapper around it. */
let save = defaultSave()

/** @type {import("./leaderboard.js").Board} The top finished journeys. */
let board = normalizeBoard(null)

/** @type {boolean} True between an answer landing and the next question. */
let answering = false

/**
 * Handle for the flash timeout, so it can be cancelled. Its callback no-ops if
 * it fires after a restart, but a timeout outliving its screen is a trap.
 * @type {number|null}
 */
let flashTimer = null

/**
 * The pending flash's continuation, so a tap can run it early instead of
 * waiting out `flashDuration`.
 *
 * Only set after a correct answer. On a wrong answer the flash would carry the
 * feedback line, and skipping it would skip the one moment that teaches.
 * @type {null | function(): void}
 */
let flashSkip = null

/**
 * Bumped whenever the run is torn down mid-cycle. The crossing finishes
 * asynchronously, so its callback must be able to tell its season is gone, or a
 * restart mid-crossing would draw a question over the character screen.
 * @type {number}
 */
let cycle = 0

/** Cancel a pending flash and orphan any crossing. Safe to call at any time. */
function _cancelFlash() {
  if (flashTimer !== null) {
    clearTimeout(flashTimer)
    flashTimer = null
  }
  flashSkip = null
  cycle += 1
  ui.skipTraversal()
  // The reinforcement card waits for a tap, so a restart while it is up
  // would leave it covering the character screen.
  ui.hideReinforcement()
  answering = false
}

/**
 * A seed for a new run. `Date.now()` is fine here and only here: nothing else
 * in the game reads a clock, and every question derives from the seed, so a run
 * can be reproduced by hard-coding it.
 * @private
 * @returns {number} A run seed
 */
function _freshSeed() {
  return Date.now() % 2147483647
}

/**
 * Persist the current state. Called after every answer and every screen change.
 *
 * A no-op in debug mode, so that looking at winter cannot overwrite a real run.
 * @private
 */
function _save() {
  if (debug.on) return
  save = { ...save, run: toSavedRun(state) }
  storage.saveRun(save)
}

/**
 * Record a cleared season: unlock the one after it and bump the lifetime
 * counter. The unlocked list is shown by `renderJourneySoFar`.
 * @private
 * @param {string} seasonId - The season just cleared
 */
function _unlockAfter(seasonId) {
  const index = SEASON_ORDER.indexOf(seasonId)
  const next = SEASON_ORDER[index + 1]
  if (next && !save.unlocked.includes(next)) {
    save = { ...save, unlocked: [...save.unlocked, next] }
  }
  save = {
    ...save,
    totals: { ...save.totals, seasonsCleared: save.totals.seasonsCleared + 1 },
  }
}

/**
 * Draw whichever screen the current phase calls for. The single place that
 * decides what is visible, so no caller has to remember to switch screens.
 * @private
 */
function render() {
  const season = getSeason(state.seasonId)

  if (state.phase === PHASE.CHARACTER_SELECT) {
    ui.stopTimer()
    ui.renderCharacterCards(_onChooseCharacter)
    ui.renderJourneySoFar(save, SEASON_LIST)
    ui.showScreen("screen-character")
    ui.focusHeading("screen-character")
    return
  }

  if (state.phase === PHASE.TRAIL || state.phase === PHASE.BOSS) {
    ui.applyPalette(season)
    ui.renderHud(state, season)
    const wasElsewhere = !document.getElementById("screen-play")?.classList.contains("active")
    // Reveal before drawing. Nothing measures geometry (the art pack's
    // layout() is arithmetic), so the order is harmless.
    ui.showScreen("screen-play")
    ui.renderTrail(season, state.position, state.characterId)
    // Only on arrival, not between questions: moving focus every question would
    // interrupt a screen reader mid-sentence. Without it, choosing a character
    // hid the screen the focus was on and dropped it to <body>.
    if (wasElsewhere) ui.focusHeading("screen-play")
    _askQuestion()
    return
  }

  ui.stopTimer()
  ui.applyPalette(season)
  _renderResult(season)
  ui.showScreen("screen-result")
  ui.focusHeading("screen-result")
}

/**
 * Show the current question and start its clock.
 * @private
 * @param {boolean} [focusFirst] - Move focus onto the first choice once it is
 *   drawn. Set only by the reinforcement card's continuation, whose focused
 *   "Got it" button has just been hidden and has nowhere else to send a
 *   keyboard or screen-reader user. Left false on the ordinary
 *   question-to-question turnover, which deliberately leaves focus where it
 *   was -- see the comment in `render`.
 */
function _askQuestion(focusFirst = false) {
  const season = getSeason(state.seasonId)
  const isBoss = state.phase === PHASE.BOSS
  const glowing = !isBoss && isGlowingAt(season, state.position)
  ui.renderQuestion(
    state,
    { tag: _questionTag(season, isBoss, glowing), lit: isBoss || glowing },
    _onAnswer,
  )
  if (focusFirst) ui.focusFirstChoice()
  // The flash timeout can land while the tab is hidden, which would start a
  // clock on a question nobody is looking at. `visibilitychange` starts it when
  // the page comes back.
  if (!document.hidden) _startClock()
}

/**
 * Start the countdown for the question on screen, if there is to be one.
 *
 * Two things can silence the clock: the season may be untimed (spring), or the
 * player may have switched the countdown off. The second is checked here, not in
 * `questionSeconds`, because it is a pacing preference rather than a rule, the
 * same reason the clock lives in GameUI. Every caller goes through here, so the
 * preference applies in one place.
 *
 * This is also where a clock is refused behind the settings dialog: a flash
 * timeout can draw the next question underneath it, and it must not count down.
 * `_closeSettings` starts it instead.
 *
 * @private
 */
function _startClock() {
  if (ui.settingsOpen) return
  const seconds = save.settings?.timer === false ? null : questionSeconds(state)
  ui.startTimer(seconds, () => _onAnswer(null, null))
}

/**
 * The line above the question.
 *
 * The boss label says two things that matter most while she is short and deciding
 * how hard to think: that a miss earns another go, and that answering it makes up
 * for items missed earlier.
 *
 * @private
 * @param {import("./seasons.js").Season} season - The season being played
 * @param {boolean} isBoss - Whether this is the boss question
 * @param {boolean} glowing - Whether this is a glowing space
 * @returns {string} The label, or "" for an ordinary space
 */
function _questionTag(season, isBoss, glowing) {
  if (isBoss) {
    const worth = `worth ${season.boss.rescue} more ${season.itemPlural.toLowerCase()}`
    // Once she has already been answered right and is asking the extra
    // question, the rescue is still what clearing this space pays -- but "her
    // question" has already happened, so the label says which one this is.
    if (state.extrasDone > 0) return `One more for her — ${worth}`
    return `The snake woman's question — ${worth}`
  }
  if (glowing) return "Glowing challenge"
  return state.extrasDone > 0 ? "One more before you go on" : ""
}

/**
 * A one-line verdict for the player.
 *
 * Deliberately one clause, never several joined by a separator, so a child who
 * is still learning to read can take it in at a glance.
 *
 * A miss never states the answer. Under the retry rule she has to find it, and
 * the reinforcement card afterwards teaches the fact, so saying it here would
 * skip both.
 *
 * @param {Object} outcome - An Outcome
 * @param {import("./seasons.js").Season} season - The season being played
 * @param {boolean} timedOut - Whether the clock ran out rather than a tap
 * @returns {string} The line to show under the question
 */
function _feedbackFor(outcome, season, timedOut) {
  const item = season.itemName.toLowerCase()
  const items = season.itemPlural.toLowerCase()
  const name = (n) => (n === 1 ? item : items)

  if (outcome.correct) {
    if (outcome.extra) return "Right! Now you can go on."
    if (outcome.rescued > 0) return `Yes! That is ${outcome.rescued} more for the potion.`
    if (outcome.itemsGained === 0) return "Right!"
    if (outcome.glowing) {
      const rare = outcome.itemsGained === 1 ? season.rareItemName : season.rareItemPlural
      return `${outcome.itemsGained} ${rare.toLowerCase()}!`
    }
    return `+${outcome.itemsGained} ${name(outcome.itemsGained)}`
  }

  if (outcome.hinted) return `${getCharacter(state.characterId).perkName} — two of them are gone!`
  if (timedOut) return "Time ran out. Take as long as you like now."
  return "Not quite — have another look."
}

/**
 * Handle an answer, including a timeout (both arguments null).
 * @private
 * @param {number|null} value - The chosen value, null on timeout
 * @param {HTMLButtonElement|null} button - The button pressed, null on timeout
 */
function _onAnswer(value, button) {
  if (answering) return
  answering = true
  ui.stopTimer()

  const season = getSeason(state.seasonId)
  const correctValue = state.question?.answer
  // Captured before the answer is applied: the crossing is from where the character stood.
  const wasAt = state.position
  const facing = kindAt(season, wasAt)
  const result = applyAnswer(state, value)
  const outcome = result.outcome
  state = result.state
  save = {
    ...save,
    totals: {
      ...save.totals,
      questionsAnswered: save.totals.questionsAnswered + 1,
      questionsCorrect: save.totals.questionsCorrect + (outcome.correct ? 1 : 0),
    },
  }
  _save()
  ui.renderHud(state, getSeason(state.seasonId))

  // A wrong answer resolves nothing: the choice is struck off and the
  // player goes again, so there is no flash and the guard comes off here
  // rather than in `advance`.
  if (outcome.retry) {
    const message = _feedbackFor(outcome, season, value === null)
    // `rejectAnswer` strikes the pressed button first and only then
    // works out the hint, which stops it taking one wrong choice too
    // many.
    ui.rejectAnswer(button, message, outcome.hinted, correctValue)
    answering = false
    // The clock does not come back: `questionSeconds` returns null while
    // retrying, so the bar hides and the retry is not a race.
    _startClock()
    return
  }

  const crossed =
    outcome.correct && !outcome.wasBoss && !outcome.extra && facing
      ? { from: wasAt, kind: facing }
      : null

  ui.flashAnswer(outcome, button, correctValue, _feedbackFor(outcome, season, value === null))

  /**
   * What happens once any reinforcement card has been dismissed.
   * @param {boolean} [focusFirst] - Passed through to `_askQuestion`. True only
   *   when this run is resuming after the reinforcement card: its "Got it"
   *   button was focused and is now hidden, so the next question's first
   *   choice needs to pick focus up. False on the ordinary path, which leaves
   *   focus alone -- see `_askQuestion`.
   */
  const proceed = (focusFirst = false) => {
    if (state.phase === PHASE.SEASON_WON) {
      _unlockAfter(season.id)
      answering = false
      _save()
      render()
      return
    }
    // A correct answer got the character across the obstacle it was facing, so
    // play that before asking the next question. `answering` stays true for the
    // duration, which is what stops a fast tapper answering mid-leap.
    if (crossed === null) {
      ui.renderTrail(getSeason(state.seasonId), state.position, state.characterId)
      answering = false
      _askQuestion(focusFirst)
      return
    }
    const generation = cycle
    ui.crossObstacle(crossed.from, crossed.kind).then(() => {
      // Stale if the run was torn down while the character was still moving.
      if (generation !== cycle) return
      answering = false
      _askQuestion(focusFirst)
    })
  }

  const advance = () => {
    flashTimer = null
    flashSkip = null
    // The reinforcement card, if this answer earned one. It waits for a tap
    // rather than a timer, so everything after it is the continuation.
    if (outcome.reinforce) {
      ui.showReinforcement(outcome.reinforce, () => proceed(true))
      return
    }
    proceed()
  }

  flashTimer = setTimeout(advance, ui.flashDuration)
  // Armed only for a correct answer; see the `flashSkip` declaration.
  flashSkip = outcome.correct
    ? () => {
        clearTimeout(flashTimer)
        advance()
      }
    : null
}

/**
 * Draw the end-of-season or end-of-run screen with the right buttons.
 * @private
 * @param {import("./seasons.js").Season|null} season - The season just played
 */
function _renderResult(season) {
  if (state.phase === PHASE.RUN_COMPLETE) {
    // Pass per-season figures explicitly. Every per-season counter on `state`
    // belongs to the last season played, so the default summary would report
    // that one season as if it were the whole run.
    const rows = SEASON_ORDER.filter((id) => state.collected[id] !== undefined).map((id) => [
      `${getSeason(id).name} — ${getSeason(id).itemPlural.toLowerCase()}`,
      String(state.collected[id]),
    ])
    rows.push(["Best streak", String(state.bestStreak)])
    rows.push(["Slips", String(state.slips)])
    ui.renderResult(
      state,
      season,
      [{ label: "Play again", onClick: _confirmNewRun, primary: true }],
      "The potion is finished",
      "She stirs in the last icicle, and the whole jar turns the color of a morning you have not had yet. She says you passed.",
      rows,
      { finale: true },
    )
    _renderBoard()
    return
  }

  const next = SEASON_ORDER[SEASON_ORDER.indexOf(season.id) + 1]
  ui.renderResult(
    state,
    season,
    [
      {
        label: next ? `On to ${getSeason(next).name}` : "Finish the journey",
        onClick: _onAdvance,
        primary: true,
      },
    ],
    `${season.name} complete`,
    `She counts the ${season.itemPlural.toLowerCase()} into her jar, nods once, and writes something down. That is her being delighted.`,
  )
}

/**
 * Draw the leaderboard, asking for a name if this run makes it and is not on it
 * yet. The seed check is what stops a reload of the finished page asking again.
 * @private
 * @param {number} [highlight] - Index of the entry just added, or -1
 */
function _renderBoard(highlight = -1) {
  ui.renderLeaderboard(board.entries, {
    highlight,
    askName: !hasRun(board, state.seed) && qualifies(board, state.slips),
    defaultName: board.lastName,
    onSubmit: _onSubmitName,
  })
}

/**
 * Put the finished run on the board under the typed name. In debug mode the
 * board changes on screen but is not written, the same rule as the save.
 * @private
 * @param {string} typed - What was in the name field
 */
function _onSubmitName(typed) {
  const name = cleanName(typed)
  if (!name || state.phase !== PHASE.RUN_COMPLETE) return
  const result = addEntry(board, {
    name,
    slips: state.slips,
    characterId: state.characterId,
    date: todayKey(),
    seed: state.seed,
  })
  board = result.board
  if (!debug.on) boardStorage.save(board)
  _renderBoard(result.rank)
}

/**
 * Character chosen: start the run at the first season.
 * @private
 * @param {string} characterId - The chosen animal
 */
function _onChooseCharacter(characterId) {
  state = chooseCharacter(state, characterId)
  _save()
  render()
}

/**
 * Season cleared: move on.
 * @private
 */
function _onAdvance() {
  _cancelFlash()
  state = advance(state)
  if (state.phase === PHASE.RUN_COMPLETE) {
    save = { ...save, totals: { ...save.totals, runsCompleted: save.totals.runsCompleted + 1 } }
  }
  _save()
  render()
}

/**
 * Throw the run away, after asking. On a shared iPad the next child to pick it
 * up would otherwise erase a half-finished journey with one tap.
 * @private
 */
function _confirmNewRun() {
  if (window.confirm("Start a new journey? This clears the one you are on.")) {
    _startNewRun()
  }
}

/**
 * Throw the run away and go back to the character cards.
 * @private
 */
function _startNewRun() {
  _cancelFlash()
  state = createState(_freshSeed())
  _save()
  render()
}

/**
 * Whether a question is on screen. The two phases that take an answer, and so
 * the two that have a clock to run.
 * @private
 * @returns {boolean} True on the trail or at the boss
 */
function _onPlayScreen() {
  return state.phase === PHASE.TRAIL || state.phase === PHASE.BOSS
}

/**
 * Open the settings dialog, and stop the clock while it is open.
 *
 * Stopping it is the point of doing this here rather than in `BaseGameUI`: the
 * player most likely to open settings is the one the countdown bothers, and a
 * question that times out behind the dialog she opened to turn it off would be
 * the game at its worst.
 *
 * @private
 */
function _openSettings() {
  ui.renderSettings(save.settings)
  ui.stopTimer()
  ui.showSettings()
}

/**
 * Close the settings dialog and hand the question back.
 *
 * The clock restarts from the top rather than resuming, for the same reason
 * `visibilitychange` does: the time spent in a dialog is not thinking time.
 * @private
 */
function _closeSettings() {
  ui.hideSettings()
  if (!answering && _onPlayScreen()) _startClock()
}

/**
 * Apply a settings change and persist it.
 *
 * @private
 * @param {boolean} timerOn - Whether the countdown should run
 */
function _onTimerSetting(timerOn) {
  save = { ...save, settings: { ...save.settings, timer: timerOn } }
  _save()
  ui.renderSettings(save.settings)
}

/**
 * Code point of "a", the letter that presses the first answer button. GameUI's
 * uppercase twin puts A, B, C, D on the buttons; this reverses that arithmetic.
 * A code point rather than a list, so the two stay in step however many choices
 * a question offers.
 * @private
 */
const FIRST_CHOICE_KEY = "a".codePointAt(0)

/**
 * Answer with the letter keys, A to D. Touch is the primary input -- this is the
 * keyboard fallback, and it only fires while the play screen is showing and an
 * answer is not already being processed.
 *
 * Letters rather than digits, since every answer is a number and a numeric
 * shortcut is one more number to sort out. Case is ignored: caps lock is not a
 * reason to stop being able to play.
 *
 * @private
 * @param {KeyboardEvent} event - The keydown
 */
function _onKeyDown(event) {
  // Escape closes the dialog, but not while the help overlay is up: one
  // Escape would dismiss both and restart the countdown.
  if (closeSettingsOnEscape(event, { isOpen: () => ui.settingsOpen, close: _closeSettings })) return
  // Modifiers, the help overlay, and text fields keep their keys. A letter typed
  // into a field is a letter meant for that field.
  if (keyIsNotForGame(event)) return
  // The dialog covers the answer buttons, so a keypress must not reach them.
  // This catches the Done button and anything the dialog grows. The reinforcement
  // card is the other layer: A-D must not answer the next question from behind it.
  if (ui.settingsOpen || ui.reinforcementOpen) return
  if (answering) return
  if (!_onPlayScreen()) return
  // Single characters only, so "F5" and "ArrowLeft" never reach the arithmetic.
  if (event.key.length !== 1) return
  const index = event.key.toLowerCase().codePointAt(0) - FIRST_CHOICE_KEY
  if (index < 0) return
  // How many buttons there are is the upper bound: a letter past the last
  // choice finds nothing and falls through, the same as any other stray key.
  const buttons = document.getElementById("choices")?.querySelectorAll("button")
  const button = buttons?.[index]
  if (button instanceof HTMLButtonElement) {
    event.preventDefault()
    button.click()
  }
}

/**
 * Load any saved run and draw the first screen.
 * @private
 */
function start() {
  if (debug.on) {
    // Every season open on the character screen, so the journey panel is navigable.
    save = { ...defaultSave(), unlocked: [...SEASON_ORDER] }
    if (debug.seasonId || debug.phase) {
      state = rehydrate({ ...toSavedRun(createState(_freshSeed())), ..._debugRun() })
    } else if (debug.characterId) {
      state = chooseCharacter(createState(_freshSeed()), debug.characterId)
    }
    // Marks the page so the stylesheet can show that saving is off, or a
    // debug session looks like broken saving.
    document.body?.setAttribute("data-debug", debug.phase ?? debug.seasonId ?? "on")
  } else {
    board = boardStorage.load()
    const loaded = storage.loadRun()
    if (loaded) {
      save = loaded
      state = rehydrate(loaded.run)
    }
  }
  // Anyone who taps faster than the animation should not have to wait for it.
  // A pending flash goes first, then the crossing: two taps clear both, and the
  // tap that submitted the answer cannot cut its own flash short, because
  // pointerdown fires before the click that arms it.
  document.addEventListener("pointerdown", () => {
    // Two guards before running the continuation early. `flashTimer` says a flash
    // is pending. `isConnected` says this module instance still owns the screen:
    // the listener is on `document`, so a page that imports this module twice
    // (only tests do) leaves a stale listener that would advance a dead run.
    if (flashTimer !== null && flashSkip && ui.elements.choices?.isConnected) {
      flashSkip()
      return
    }
    ui.skipTraversal()
  })
  document.addEventListener("keydown", _onKeyDown)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      ui.stopTimer()
    } else if (!answering && _onPlayScreen()) {
      // Restart the clock rather than resuming: the alternative is a
      // question with two seconds left because the iPad was locked.
      _startClock()
    }
  })
  document.getElementById("restart")?.addEventListener("click", () => {
    if (window.confirm("Start over? This erases your journey.")) {
      // Everything except the preferences: quietly switching the
      // countdown back on would undo a setting a player turned off
      // because it upset her.
      save = { ...defaultSave(), settings: save.settings }
      _startNewRun()
    }
  })
  ui.elements["settings-button"]?.addEventListener("click", _openSettings)
  ui.elements["close-settings"]?.addEventListener("click", _closeSettings)
  ui.elements["setting-timer"]?.addEventListener("change", (event) => {
    _onTimerSetting(event.target.checked === true)
  })
  ui.renderSettings(save.settings)
  render()
}

start()

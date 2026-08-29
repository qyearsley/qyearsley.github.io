/**
 * Seasons entry point -- wires the rules, the storage, and the screens together.
 *
 * The orchestrator, and the only file allowed to be impure. It owns the live
 * state object, the save timing, and the keyboard. It holds no rules of its
 * own: every decision about what an answer is worth or whether a season is over
 * comes back from GameState, and every pixel comes from GameUI.
 *
 * The answer cycle is deliberately explicit, because it is the one place where
 * timing matters:
 *
 *   1. stop the countdown, so a timeout cannot fire during the flash
 *   2. ask GameState what the answer did
 *   3. save immediately -- progress survives a closed tab mid-flash
 *   4. flash the result on the buttons for `flashDuration`
 *   5. draw whatever comes next: the following question, or the result screen
 *
 * The module-level `answering` flag guards the whole cycle. Without it a fast
 * double-tap, or a tap landing in the same frame as a timeout, would score
 * twice. `aria-disabled` on the buttons only announces that; this is what
 * enforces it.
 *
 * This file exports nothing and calls `start()` at the bottom, so importing it
 * starts the game -- which is why index.html needs no bootstrap call, and why
 * game.test.js drives it black-box through the real markup, re-importing it
 * with a fresh query string per case to get a fresh instance.
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
  retry,
} from "./GameState.js"
import { isGlowingAt } from "./Journey.js"
import { getCharacter } from "./characters.js"
import { getSeason } from "./seasons.js"
import { StorageManager, defaultSave, toSavedRun } from "./storage.js"

const ui = new GameUI()
const storage = new StorageManager()

/** @type {Object} The live game state. */
let state = createState(_freshSeed())

/** @type {Object} The persisted wrapper around it. */
let save = defaultSave()

/** @type {boolean} True between an answer landing and the next question. */
let answering = false

/**
 * Handle for the flash timeout, so it can be cancelled. The callback is
 * defensive enough to no-op if it fires after a restart -- every draw it makes
 * bails on a null season -- but a pending timeout that outlives the screen it
 * belongs to is a trap for the next person to add a line to it.
 * @type {number|null}
 */
let flashTimer = null

/** Cancel a pending flash. Safe to call when none is scheduled. */
function _cancelFlash() {
  if (flashTimer !== null) {
    clearTimeout(flashTimer)
    flashTimer = null
  }
  answering = false
}

/**
 * A seed for a new run. `Date.now()` is fine here and only here: GameState
 * treats the seed as an opaque input, and nothing else in the game reads a
 * clock. Every question then derives from it deterministically, so a run can
 * still be reproduced by hard-coding this value.
 * @private
 * @returns {number} A run seed
 */
function _freshSeed() {
  return Date.now() % 2147483647
}

/**
 * Persist the current state. Called after every answer and every screen change.
 * @private
 */
function _save() {
  save = { ...save, run: toSavedRun(state) }
  storage.saveRun(save)
}

/**
 * Record a cleared season: unlock the one after it and bump the lifetime
 * counter. Nothing surfaces the unlocked list yet -- there is no season picker
 * -- but the ledger is written so one can be added without a save migration.
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
    ui.showScreen("screen-character")
    ui.focusHeading("screen-character")
    return
  }

  if (state.phase === PHASE.TRAIL || state.phase === PHASE.BOSS) {
    ui.applyPalette(season)
    ui.renderHud(state, season)
    const wasElsewhere = !document.getElementById("screen-play")?.classList.contains("active")
    // Reveal before drawing. The trail measures its own path with
    // getTotalLength() to place the markers, and that is not dependable inside
    // a `display: none` subtree -- a 0 there reads as "geometry unsupported"
    // and falls back to a straight line. Since the scene is now built once per
    // season and only updated afterwards, one bad measurement would persist for
    // the whole season instead of self-correcting on the next answer.
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
 */
function _askQuestion() {
  const season = getSeason(state.seasonId)
  const isBoss = state.phase === PHASE.BOSS
  const glowing = !isBoss && isGlowingAt(season, state.position)
  ui.renderQuestion(state, glowing, isBoss, _onAnswer)
  // The flash timeout can land while the tab is hidden, which would start a
  // clock on a question nobody is looking at. `visibilitychange` starts it when
  // the page comes back.
  if (!document.hidden) ui.startTimer(questionSeconds(state), () => _onAnswer(null, null))
}

/**
 * A one-line verdict for the player.
 *
 * Deliberately one clause, never several joined by a separator: the whole line
 * has to be readable inside the 900ms flash by a child who is still learning to
 * read. A miss always states the correct answer, because that is the only
 * teaching this screen does.
 *
 * @private
 * @param {Object} outcome - An Outcome, plus a `correctAnswer` the caller
 *   injects: the answer lives on the question, not the outcome, and a miss has
 *   to be able to state it
 * @param {import("./seasons.js").Season} season - The season being played
 * @param {boolean} timedOut - Whether the clock ran out rather than a tap
 * @returns {string} The line to show under the question
 */
function _feedbackFor(outcome, season, timedOut) {
  const item = season.itemName.toLowerCase()
  const items = season.itemPlural.toLowerCase()
  const name = (n) => (n === 1 ? item : items)

  if (outcome.correct) {
    if (outcome.rescued > 0) return `Yes! That is ${outcome.rescued} more for the potion.`
    if (outcome.itemsGained === 0) return "Right!"
    if (outcome.glowing) {
      // The rare item name needs pluralising like any other noun here.
      const rare = outcome.itemsGained === 1 ? season.rareItemName : `${season.rareItemName}s`
      return `${outcome.itemsGained} ${rare.toLowerCase()}!`
    }
    if (outcome.doubled) return `Double! +${outcome.itemsGained} ${name(outcome.itemsGained)}`
    if (outcome.revived > 0)
      return `+${outcome.itemsGained} ${name(outcome.itemsGained)}, and your ${item} is back`
    return `+${outcome.itemsGained} ${name(outcome.itemsGained)}`
  }

  // One clause, not several. A child has 900ms to read it.
  const answer = outcome.correctAnswer
  const right = answer === undefined ? "" : ` The answer was ${answer}.`
  if (timedOut) return `Time ran out!${right}`
  if (outcome.forgiven) return `${getCharacter(state.characterId).perkName} saved you!${right}`
  if (outcome.lostNow > 0) return `Lost ${outcome.lostNow} ${name(outcome.lostNow)}.${right}`
  if (outcome.wiltedNow > 0) {
    return `Your ${name(outcome.wiltedNow)} ${outcome.wiltedNow === 1 ? "is" : "are"} wilting.${right}`
  }
  if (outcome.steppedBack > 0) return `Back ${outcome.steppedBack}.${right}`
  return `Not quite.${right}`
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
  const result = applyAnswer(state, value)
  state = result.state
  save = {
    ...save,
    totals: {
      ...save.totals,
      questionsAnswered: save.totals.questionsAnswered + 1,
      questionsCorrect: save.totals.questionsCorrect + (result.outcome.correct ? 1 : 0),
    },
  }
  _save()

  ui.flashAnswer(
    result.outcome,
    button,
    correctValue,
    _feedbackFor({ ...result.outcome, correctAnswer: correctValue }, season, value === null),
  )
  ui.renderHud(state, getSeason(state.seasonId))

  flashTimer = setTimeout(() => {
    flashTimer = null
    answering = false
    if (state.phase === PHASE.SEASON_WON) _unlockAfter(season.id)
    if (state.phase === PHASE.SEASON_WON || state.phase === PHASE.SEASON_LOST) {
      _save()
      render()
      return
    }
    ui.renderTrail(getSeason(state.seasonId), state.position, state.characterId)
    _askQuestion()
  }, ui.flashDuration)
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
    ui.renderResult(
      state,
      season,
      [{ label: "Play again", onClick: _confirmNewRun, primary: true }],
      "The potion is finished",
      "She stirs in the last icicle, and the whole jar turns the colour of a morning you have not had yet. She says you passed.",
      rows,
    )
    return
  }

  if (state.phase === PHASE.SEASON_WON) {
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
    return
  }

  ui.renderResult(
    state,
    season,
    [
      {
        label: state.runOver ? "Start again" : `Try ${season.name} again`,
        onClick: _onRetry,
        primary: true,
      },
      { label: "Pick a new character", onClick: _confirmNewRun },
    ],
    state.runOver ? "Back to the beginning" : "Not quite enough",
    state.runOver
      ? "The potion will have to wait for another journey. She does not seem worried about it."
      : `She needed ${season.demand} and counted ${state.items}. "No matter," she says, already tidying the jar. "Again, from the top."`,
  )
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
 * Season failed: play it again, or start over if the rule ends the run.
 * @private
 */
function _onRetry() {
  _cancelFlash()
  state = retry(state)
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
 * Answer with the number keys. Touch is the primary input -- this is the
 * keyboard fallback, and it only fires while the play screen is showing and an
 * answer is not already being processed.
 * @private
 * @param {KeyboardEvent} event - The keydown
 */
function _onKeyDown(event) {
  if (event.metaKey || event.ctrlKey || event.altKey) return
  if (answering) return
  if (state.phase !== PHASE.TRAIL && state.phase !== PHASE.BOSS) return
  const index = Number(event.key) - 1
  if (!Number.isInteger(index) || index < 0) return
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
  const loaded = storage.loadRun()
  if (loaded) {
    save = loaded
    state = rehydrate(loaded.run)
  }
  document.addEventListener("keydown", _onKeyDown)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      ui.stopTimer()
    } else if (!answering && (state.phase === PHASE.TRAIL || state.phase === PHASE.BOSS)) {
      // Restart the clock rather than resuming it. The alternative is handing
      // back a question with two seconds left because the iPad was locked.
      ui.startTimer(questionSeconds(state), () => _onAnswer(null, null))
    }
  })
  document.getElementById("restart")?.addEventListener("click", () => {
    if (window.confirm("Start over? This erases your journey.")) {
      save = defaultSave()
      _startNewRun()
    }
  })
  render()
}

start()

/**
 * Seasons entry point -- wires the rules, the storage, and the screens together.
 *
 * Architecture: this is the orchestrator, and it is the only file that is
 * allowed to be impure. It owns the live state object, the save timing, and the
 * keyboard. It contains no rules of its own: every decision about what an
 * answer is worth or whether a season is over comes back from GameState, and
 * every pixel comes from GameUI.
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
 * `_answering` guards the whole cycle. Without it a fast double-tap, or a tap
 * landing in the same frame as a timeout, would score twice.
 *
 * This file exports nothing. It is driven black-box through the real markup by
 * `__tests__/game.test.js`, matching how Times Trail tests its orchestrator.
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
 * Record that a season has been cleared, so the picker can offer it again.
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
    ui.renderCharacterCards(state.characterId, _onChooseCharacter)
    ui.showScreen("screen-character")
    ui.focusHeading("screen-character")
    return
  }

  if (state.phase === PHASE.TRAIL || state.phase === PHASE.BOSS) {
    ui.applyPalette(season)
    ui.renderHud(state, season)
    ui.renderTrail(season, state.position, state.characterId)
    ui.showScreen("screen-play")
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
  ui.startTimer(questionSeconds(state), () => _onAnswer(null, null))
}

/**
 * A one-line verdict for the player, in the snake woman's register.
 * @private
 * @param {import("./GameState.js").Outcome} outcome - What just happened
 * @param {import("./seasons.js").Season} season - The season being played
 * @returns {string} The line to show under the question
 */
function _feedbackFor(outcome, season) {
  const item = season.itemName.toLowerCase()
  const items = season.itemPlural.toLowerCase()
  if (outcome.correct) {
    const parts = []
    if (outcome.itemsGained > 0) {
      parts.push(
        outcome.glowing
          ? `${outcome.itemsGained} ${season.rareItemName.toLowerCase()}!`
          : `+${outcome.itemsGained} ${outcome.itemsGained === 1 ? item : items}`,
      )
    }
    if (outcome.doubled) parts.push("doubled -- nice comeback")
    if (outcome.revived > 0) parts.push(`${outcome.revived} brought back`)
    if (outcome.rescued > 0) parts.push(`the boss gives you ${outcome.rescued} more`)
    return parts.join(" · ") || "Right!"
  }
  if (outcome.forgiven) return "Not this time -- your perk covers it."
  if (outcome.lostNow > 0) return `Lost ${outcome.lostNow} ${outcome.lostNow === 1 ? item : items}.`
  if (outcome.wiltedNow > 0) {
    return `${outcome.wiltedNow} ${outcome.wiltedNow === 1 ? item : items} wilting -- get the next one right.`
  }
  if (outcome.steppedBack > 0) return `Back ${outcome.steppedBack}.`
  return "Not quite. Try the next one."
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
  _save()

  ui.flashAnswer(result.outcome, button, correctValue, _feedbackFor(result.outcome, season))
  ui.renderHud(state, getSeason(state.seasonId))

  setTimeout(() => {
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
    ui.renderResult(
      state,
      season,
      [{ label: "Play again", onClick: _startNewRun, primary: true }],
      "Every season, delivered",
      "The snake woman counts it all twice, and finds nothing to complain about. You are not a frog.",
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
      `She takes the ${season.itemPlural.toLowerCase()} without a word of thanks. That is as close to pleased as she gets.`,
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
      { label: "Pick a new character", onClick: _startNewRun },
    ],
    state.runOver ? "Ribbit" : "Not enough",
    state.runOver
      ? "She keeps her promise. You are, briefly, a frog. It wears off by spring."
      : `She wanted ${season.demand} and counted ${state.items}. She is willing to let you try again. Once.`,
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
  state = retry(state)
  _save()
  render()
}

/**
 * Throw the run away and go back to the character cards.
 * @private
 */
function _startNewRun() {
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
  if (answering) return
  if (state.phase !== PHASE.TRAIL && state.phase !== PHASE.BOSS) return
  const index = Number(event.key) - 1
  if (!Number.isInteger(index) || index < 0) return
  const buttons = document.getElementById("choices")?.querySelectorAll("button")
  const button = buttons?.[index]
  if (button instanceof HTMLButtonElement && !button.disabled) {
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
  document.getElementById("restart")?.addEventListener("click", () => {
    if (window.confirm("Start over? This erases your journey.")) {
      storage.clearRun()
      save = defaultSave()
      _startNewRun()
    }
  })
  render()
}

start()

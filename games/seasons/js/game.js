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
 *   2. note where the character stands and what it is facing, before the answer
 *      moves it
 *   3. ask GameState what the answer did
 *   4. save immediately -- progress survives a closed tab mid-flash
 *   5. flash the result on the buttons for `flashDuration`
 *   6. animate the character across the obstacle it just got past, if it did
 *   7. draw whatever comes next: the following question, or the result screen
 *
 * The module-level `answering` flag guards the whole cycle, the crossing
 * included. Without it a fast double-tap, or a tap landing in the same frame as
 * a timeout, would score twice -- and a tap mid-crossing would answer a question
 * that is not on screen yet. `aria-disabled` on the buttons only announces that;
 * this is what enforces it. A `pointerdown` anywhere cuts the crossing short
 * rather than shortening the guard.
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
import { isGlowingAt, kindAt } from "./Journey.js"
import { CHARACTERS, getCharacter } from "./characters.js"
import { SEASON_LIST, getSeason } from "./seasons.js"
import { StorageManager, defaultSave, toSavedRun } from "./storage.js"

const ui = new GameUI()
// The seasons the finished potion is built from, on the end-of-run screen.
// Assigned rather than imported by GameUI so the view stays ignorant of which
// levels exist; see renderJourneySoFar.
ui.seasonOrder = SEASON_LIST
const storage = new StorageManager()

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
 * having: the last screen of the game is otherwise four seasons away, which
 * makes it the least-looked-at screen in the game and the most likely to be
 * disappointing when it finally arrives.
 * @private
 */
const DEBUG_PHASES = {
  trail: PHASE.TRAIL,
  boss: PHASE.BOSS,
  won: PHASE.SEASON_WON,
  lost: PHASE.SEASON_LOST,
  end: PHASE.RUN_COMPLETE,
}

/**
 * Debug entry points, read once from the query string.
 *
 * For looking at a season without playing three to get there. `?season=winter`
 * drops straight into winter, `&character=sloth` picks the animal, `?phase=end`
 * jumps to the last screen in the game, and `?debug=1` alone just opens every
 * season on the character screen.
 *
 * **Nothing is written to storage while any of these are set.** A grown-up
 * opening `?season=winter` to check the art must not overwrite a child's
 * half-finished run, and that is a silent, unrecoverable kind of damage -- so
 * `_save` becomes a no-op rather than the caller having to remember. It also
 * means a debug session leaves no trace: close the tab and the real save is
 * exactly as it was.
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
  // `getCharacter` substitutes a default for an unknown id rather than
  // returning null, so an id is only honoured when it really is one.
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
 * Built as a *save* and handed to `rehydrate` rather than assembled as live
 * state, so it goes through the same coercion and the same promotion a real
 * reload does -- including "a trail phase standing on the last space is really
 * at the boss", which is how `?phase=boss` gets a boss question without this
 * function knowing how questions are made.
 *
 * @private
 * @returns {Object} A run, ready for `rehydrate`
 */
function _debugRun() {
  const characterId = debug.characterId ?? CHARACTERS[0].id
  if (debug.phase === PHASE.RUN_COMPLETE) {
    // Every season needs a haul or the end-of-run summary is a blank table, and
    // the season on screen has to be the last one, as it would be after a real
    // finish.
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
      // Left three short, so the boss's rescue has something to rescue.
      return { ...base, phase: PHASE.TRAIL, position: season.spaces, items: season.demand - 3 }
    case PHASE.SEASON_WON:
      return { ...base, phase: PHASE.SEASON_WON, position: season.spaces, items: season.demand + 1 }
    case PHASE.SEASON_LOST:
      return {
        ...base,
        phase: PHASE.SEASON_LOST,
        position: season.spaces,
        items: Math.max(0, season.demand - 4),
      }
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

/**
 * The pending flash's continuation, so a tap can run it early instead of
 * waiting out `flashDuration`.
 *
 * Only set after a CORRECT answer. Skipping ahead is for the player who already
 * knows she got it right; on a wrong answer the flash is carrying the feedback
 * line that says what the answer actually was, and cutting that short would
 * skip the one moment in the question loop that teaches anything.
 * @type {null | function(): void}
 */
let flashSkip = null

/**
 * Bumped whenever the run is torn down mid-cycle. The crossing animation
 * finishes asynchronously, so its callback has to be able to tell that the
 * season it belonged to is gone -- otherwise a restart during a crossing draws
 * a question over the character screen.
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
    ui.renderJourneySoFar(save, SEASON_LIST)
    ui.showScreen("screen-character")
    ui.focusHeading("screen-character")
    return
  }

  if (state.phase === PHASE.TRAIL || state.phase === PHASE.BOSS) {
    ui.applyPalette(season)
    ui.renderHud(state, season)
    const wasElsewhere = !document.getElementById("screen-play")?.classList.contains("active")
    // Reveal before drawing. This used to be load-bearing: the trail measured
    // its own path with getTotalLength() to place markers, and that is not
    // dependable inside a `display: none` subtree. Nothing measures geometry
    // any more -- every coordinate comes from the art pack's layout(), which is
    // arithmetic -- so the order is no longer load-bearing, just harmless.
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
  ui.renderQuestion(
    state,
    { tag: _questionTag(season, isBoss, glowing), lit: isBoss || glowing },
    _onAnswer,
  )
  // The flash timeout can land while the tab is hidden, which would start a
  // clock on a question nobody is looking at. `visibilitychange` starts it when
  // the page comes back.
  if (!document.hidden) ui.startTimer(questionSeconds(state), () => _onAnswer(null, null))
}

/**
 * The line above the question.
 *
 * The boss label carries two things Ella designed and the screen never said:
 * that a miss earns another go ("if you miss the boss question you get a chance
 * to go back and try again"), and that answering it makes up for items missed
 * earlier. Both were only discoverable by getting it right, which is the wrong
 * order -- they matter most while she is short and deciding how hard to think.
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
    // Not "her last question" for the first attempt: that reads as "last try",
    // which is what the other branch says, so the two got confused.
    return state.bossTriesLeft > 1 ? `The snake woman's question — ${worth}` : `Last try — ${worth}`
  }
  return glowing ? "Glowing challenge" : ""
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
  // A missed boss question with a try in hand is the one miss that is not a
  // setback, so it gets its own line instead of the generic one.
  if (outcome.wasBoss && outcome.bossTriesLeft > 0) return `Not quite.${right} One more go!`
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
  // Captured before the answer is applied, because the crossing is *from* where
  // the character was standing, over the obstacle that was in the way.
  const wasAt = state.position
  const facing = kindAt(season, wasAt)
  const result = applyAnswer(state, value)
  const crossed =
    result.outcome.correct && !result.outcome.wasBoss && facing
      ? { from: wasAt, kind: facing }
      : null
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

  const advance = () => {
    flashTimer = null
    flashSkip = null
    if (state.phase === PHASE.SEASON_WON) _unlockAfter(season.id)
    if (state.phase === PHASE.SEASON_WON || state.phase === PHASE.SEASON_LOST) {
      answering = false
      _save()
      render()
      return
    }
    // A correct answer got the character across the obstacle it was facing, so
    // play that before asking the next question. `answering` stays true for the
    // duration, which is what stops a fast tapper answering mid-leap.
    if (crossed === null) {
      // Redraw before asking: a wrong answer can still move the character.
      // Under the step-back rule the save said one position while the drawn
      // token and the trail's label still showed the old one, because nothing
      // else runs between two questions.
      ui.renderTrail(getSeason(state.seasonId), state.position, state.characterId)
      answering = false
      _askQuestion()
      return
    }
    const generation = cycle
    ui.crossObstacle(crossed.from, crossed.kind).then(() => {
      // Stale if the run was torn down while the character was still moving.
      if (generation !== cycle) return
      answering = false
      _askQuestion()
    })
  }

  flashTimer = setTimeout(advance, ui.flashDuration)
  // Armed only for a correct answer; see the `flashSkip` declaration.
  flashSkip = result.outcome.correct
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
    ui.renderResult(
      state,
      season,
      [{ label: "Play again", onClick: _confirmNewRun, primary: true }],
      "The potion is finished",
      "She stirs in the last icicle, and the whole jar turns the colour of a morning you have not had yet. She says you passed.",
      rows,
      { finale: true },
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
 * Code point of "a", the letter that presses the first answer button. The
 * uppercase twin lives in GameUI, which is what puts A, B, C, D on the buttons;
 * this reverses that arithmetic. Kept as a code point rather than a list of
 * letters so the two stay in step however many choices a question offers.
 * @private
 */
const FIRST_CHOICE_KEY = "a".codePointAt(0)

/**
 * Tags whose own keyboard behavior must never be hijacked. The same set the
 * other games in this repo keep; see times-trail's EventManager.
 * @private
 */
const TEXT_ENTRY_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"])

/**
 * Answer with the letter keys, A to D. Touch is the primary input -- this is the
 * keyboard fallback, and it only fires while the play screen is showing and an
 * answer is not already being processed.
 *
 * Letters rather than digits because every answer in this game is a number, and
 * a shortcut that is also a number is one more number to sort out. Case is
 * ignored: caps lock is not a reason to stop being able to play.
 * @private
 * @param {KeyboardEvent} event - The keydown
 */
function _onKeyDown(event) {
  if (event.metaKey || event.ctrlKey || event.altKey) return
  // A letter typed into a field is a letter meant for that field. This did not
  // matter while the shortcut was a digit -- nothing on the play screen takes
  // typing -- but letters are what people put in text boxes, so the first one
  // added here would otherwise submit an answer behind the player's back while
  // she was still typing into it.
  const target = event.target
  if (target && TEXT_ENTRY_TAGS.has(target.tagName)) return
  if (answering) return
  if (state.phase !== PHASE.TRAIL && state.phase !== PHASE.BOSS) return
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
    // Every season open on the character screen, so the "Your journey" panel is
    // navigable rather than showing three locked rows.
    save = { ...defaultSave(), unlocked: [...SEASON_ORDER] }
    if (debug.seasonId || debug.phase) {
      state = rehydrate({ ...toSavedRun(createState(_freshSeed())), ..._debugRun() })
    } else if (debug.characterId) {
      state = chooseCharacter(createState(_freshSeed()), debug.characterId)
    }
    // Marks the page so the stylesheet can show that saving is off. Without it
    // the natural conclusion from a debug session is that saving is broken.
    document.body?.setAttribute("data-debug", debug.phase ?? debug.seasonId ?? "on")
  } else {
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
    // Two guards before running the continuation early. `flashTimer` says a
    // flash is actually pending. `isConnected` says this module instance still
    // owns the screen: the listener is on `document`, so a page that imports
    // this module twice leaves the first instance's listener attached with its
    // own `flashSkip` still armed, and running that would advance a run whose
    // markup is gone. Only the tests import twice today, but a stale listener
    // driving a dead run is the kind of thing that is much harder to diagnose
    // later than to rule out here.
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

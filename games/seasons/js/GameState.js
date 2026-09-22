/**
 * Seasons game state -- every rule in the game, as pure functions.
 *
 * The whole rulebook. It never touches the DOM, the clock, or `Math.random()`.
 * See ../README.md for what the rules mean to a player, and js/README.md for
 * how this module sits among the others.
 *
 * - Every exported function takes a state and returns a *new* state. Nothing
 *   here mutates its argument, so the UI can hold on to the previous state to
 *   animate the difference between the two.
 * - Randomness is derived, not stored: the question for a state comes from
 *   `createRng(seed:seasonId:attempt:questionsAsked)`. That keeps the state
 *   fully serializable -- there is no generator object to persist -- and makes
 *   a season reproducible from a single number, which is what lets the tests
 *   assert on real generated questions.
 * - Time is not modelled. `questionSeconds` reports how long a question should
 *   be allowed, and the UI owns the countdown. A timeout is delivered as
 *   `answer(state, null)`, which is simply a wrong answer -- there is no
 *   separate timeout path to keep in sync.
 *
 * **The retry rule**, which replaced every wrong-answer penalty on 2026-09-21
 * and is most of what this file now does. A wrong answer takes nothing away. It
 * keeps you on the same space, facing the same question, until you find the
 * answer yourself; then one more question at that space before the item is
 * paid. Three fields carry it, and all three reset when the character moves:
 *
 * - `retrying`   -- this question has already been missed. It is what makes the
 *                   next correct answer produce a reinforcement payload, and
 *                   what tells game.js not to run a clock (see below).
 * - `owed`       -- 0 or 1. An extra question is due before the item is paid.
 * - `extrasDone` -- 0 or 1. This space has already served its extra, so a second
 *                   mistake here retries and reinforces but adds no second one.
 *
 * `extrasDone` is the cap, and the reason it exists: without it every mistake
 * added a question, so a space a child kept missing grew without bound. Two
 * distinct questions per space is the ceiling.
 *
 * **Nothing here knows about the reinforcement card.** A correct answer to a
 * question that had been missed reports `reinforce` on the outcome, and game.js
 * decides to hold a card up. Making it a phase instead would have put a
 * UI pause into the save file.
 *
 * The boss runs the identical loop. It pays `season.boss.rescue` and resolves
 * the season when it finally clears, which it always does -- so a season that
 * has started always ends in SEASON_WON, and there is no lost phase.
 *
 * Error Handling: `answer` is a no-op returning the same state when called in a
 * phase that takes no answers, so a double-click cannot double-score. A state
 * naming a season that no longer exists resolves to CHARACTER_SELECT rather
 * than throwing.
 */

import { getCharacter, getEffects } from "./characters.js"
import { PHASE, PLAY, SEASON_ORDER } from "./constants.js"
import { bossPosition, isAtBoss, isGlowingAt, normalizePosition } from "./Journey.js"
import { getChallenge } from "./challenges/index.js"
import { createRng } from "./rng.js"
import { getSeason, nextSeason } from "./seasons.js"

/**
 * The whole live state of a run. Every field is a plain, serializable value;
 * storage.js persists this shape directly.
 *
 * @typedef {Object} GameState
 * @property {string} phase           - One of PHASE
 * @property {string} characterId     - The chosen animal
 * @property {string|null} seasonId   - The season in play, null before one starts
 * @property {number} seed            - Run seed; every question derives from it
 * @property {number} attempt         - Which run through this season this is
 * @property {number} position        - 0 .. season.spaces; the last value is the boss
 * @property {number} items           - Items banked this season
 * @property {boolean} retrying       - The question on screen has been missed
 * @property {number} owed            - Extra questions due at this space; 0 or 1
 * @property {number} extrasDone      - Extras already served here; 0 or 1
 * @property {number} hintsLeft       - Hints remaining this season
 * @property {number} streak          - Consecutive correct answers
 * @property {number} bestStreak      - Best streak this run
 * @property {number} questionsAsked  - Questions asked this season; also the rng cursor
 * @property {number} correctCount    - Correct answers this season
 * @property {Object|null} question   - The question on screen
 * @property {Object<string, number>} collected - Season id -> items delivered
 */

/**
 * What one answer did. The UI reads this to decide what to animate and say; it
 * is never persisted.
 *
 * @typedef {Object} Outcome
 * @property {boolean} correct      - Whether the answer was right
 * @property {boolean} retry        - Wrong, and the same question stays up
 * @property {boolean} hinted       - A hint fired on this answer
 * @property {Object|null} reinforce - An `explain` payload to show, or null
 * @property {boolean} extra        - Right, but it bought an extra question
 * @property {number} itemsGained   - Items collected, after every modifier
 * @property {boolean} glowing      - Whether it was a glowing space
 * @property {boolean} reachedBoss  - Whether this answer arrived at the boss
 * @property {boolean} wasBoss      - Whether this was the boss question
 * @property {number} rescued       - Items the boss question awarded
 * @property {string} phase         - The phase after this answer
 */

/**
 * An outcome where nothing happened, for calls made in a phase that takes no
 * answer. Every field is present so callers never have to test for undefined.
 * @private
 * @param {string} phase - The unchanged phase
 * @returns {Outcome} A zeroed outcome
 */
function _noOutcome(phase) {
  return {
    correct: false,
    retry: false,
    hinted: false,
    reinforce: null,
    extra: false,
    itemsGained: 0,
    glowing: false,
    reachedBoss: false,
    wasBoss: false,
    rescued: 0,
    phase,
  }
}

/**
 * The rng for the question a state should be showing.
 *
 * Keyed on *where the player is standing*, not on how many questions have been
 * asked. That is what makes a retry recoverable: a wrong answer keeps the
 * question and still counts against `questionsAsked`, so a key built from that
 * counter would hand a reloading page a different question from the one the
 * player is still working on.
 *
 * Every space in a season is visited once and asks at most two questions -- its
 * own, and the extra one a miss owes -- so `position` plus `extrasDone` names a
 * question uniquely. `attempt` keeps a replayed season from repeating itself.
 *
 * @private
 * @param {GameState} state - A state whose `position` and `phase` are already set
 * @returns {import("./rng.js").Rng} A generator for this question
 */
function _questionRng(state) {
  const where = `${state.position}:${state.extrasDone}`
  return createRng(`${state.seed}:${state.seasonId}:${state.attempt}:${where}`)
}

/**
 * Generate the question the given state should be showing.
 *
 * The forms depend on where the player is standing: a glowing space draws from
 * `glowingForms`, the boss from `boss.forms`, everywhere else from `forms`.
 *
 * @private
 * @param {GameState} state - A state whose `position` and `phase` are already set
 * @returns {Object|null} A question, or null if the season is unknown
 */
function _makeQuestion(state) {
  const season = getSeason(state.seasonId)
  if (!season) return null
  const challenge = getChallenge(season.challenge)
  const rng = _questionRng(state)
  if (state.phase === PHASE.BOSS) return challenge.generate(season.boss.forms, rng)
  if (isGlowingAt(season, state.position)) return challenge.generate(season.glowingForms, rng)
  return challenge.generate(season.forms, rng)
}

/**
 * Explain a question, for the reinforcement card. Falls back to null for a
 * challenge module that does not offer one, which is the documented optional
 * third export -- the card then simply does not appear.
 * @private
 * @param {import("./seasons.js").Season} season - The season being played
 * @param {Object|null} question - The question that was finally answered
 * @returns {Object|null} An explain payload, or null
 */
function _explain(season, question) {
  const challenge = getChallenge(season.challenge)
  if (typeof challenge.explain !== "function" || !question) return null
  return challenge.explain(question) ?? null
}

/**
 * The per-space fields, cleared. Called whenever the character moves, so a
 * retry or a debt cannot follow her onto the next obstacle.
 * @private
 * @returns {{retrying: boolean, owed: number, extrasDone: number}} Cleared fields
 */
function _freshSpace() {
  return { retrying: false, owed: 0, extrasDone: 0 }
}

/**
 * A fresh state before a character has been chosen.
 *
 * @param {number} [seed] - Run seed; pass a fixed value to reproduce a run
 * @returns {GameState} A state in CHARACTER_SELECT
 */
export function createState(seed = 1) {
  return {
    phase: PHASE.CHARACTER_SELECT,
    characterId: getCharacter(null).id,
    seasonId: null,
    seed: Number.isFinite(seed) ? Math.floor(seed) : 1,
    attempt: 0,
    position: 0,
    items: 0,
    ..._freshSpace(),
    hintsLeft: 0,
    streak: 0,
    bestStreak: 0,
    questionsAsked: 0,
    correctCount: 0,
    question: null,
    collected: {},
  }
}

/**
 * Begin a season, resetting everything that is per-season and keeping
 * everything that is per-run (`seed`, `bestStreak`, `collected`).
 *
 * @param {GameState} state - The current state
 * @param {string} seasonId - The season to start
 * @param {number} [attempt] - Which run through this season this is. Folded
 *   into the question seed, so replaying a season asks a different set of
 *   questions; without it a replay is worthless as practice, because it repeats
 *   the exact list the player just walked.
 * @returns {GameState} A new state in PHASE.TRAIL with its first question, or
 *   an unchanged state if the season id is unknown
 */
export function startSeason(state, seasonId, attempt = 0) {
  const season = getSeason(seasonId)
  if (!season) return state
  const effects = getEffects(state.characterId)
  const next = {
    ...state,
    phase: PHASE.TRAIL,
    seasonId,
    attempt: Math.max(0, Math.floor(attempt) || 0),
    position: 0,
    items: 0,
    ..._freshSpace(),
    hintsLeft: effects.hintsPerSeason,
    streak: 0,
    questionsAsked: 0,
    correctCount: 0,
    question: null,
  }
  return { ...next, question: _makeQuestion(next) }
}

/**
 * Choose a character and start the run at the first season.
 *
 * @param {GameState} state - A state in CHARACTER_SELECT
 * @param {string} characterId - The chosen animal
 * @returns {GameState} A new state in PHASE.TRAIL in the first season
 */
export function chooseCharacter(state, characterId) {
  const withCharacter = { ...state, characterId: getCharacter(characterId).id }
  return startSeason(withCharacter, SEASON_ORDER[0])
}

/**
 * How many seconds this question is allowed, including the character's bonus.
 *
 * Null in three cases, and the third is the one that matters: an untimed season,
 * a character who never runs a clock, and **a question that is being retried**.
 * A timeout is a wrong answer, and a wrong answer keeps the question -- so a
 * clock on the retry would time the same question out again, forever, for
 * exactly the child who could not answer it. The retry is for finding the
 * answer, not for racing. It is also the only thing in the design that
 * guarantees a season makes progress.
 *
 * @param {GameState} state - The current state
 * @returns {number|null} Seconds, or null when this question is untimed
 */
export function questionSeconds(state) {
  const season = getSeason(state?.seasonId)
  if (!season || season.timerSeconds === null) return null
  if (state.retrying) return null
  const effects = getEffects(state.characterId)
  if (effects.noTimer) return null
  return season.timerSeconds + effects.extraSeconds
}

/**
 * Resolve a season once the boss space is finally cleared.
 *
 * There is nothing to judge any more. A season's demand is exactly what its
 * trail pays plus its boss rescue, and the retry rule means every question is
 * eventually answered, so `items` is the demand by construction. The function
 * survives as the one place a season ends, not as a test.
 *
 * @private
 * @param {GameState} state - State after the boss answer's effects
 * @param {import("./seasons.js").Season} season - The season being resolved
 * @returns {GameState} The resolved state
 */
function _resolveSeason(state, season) {
  return {
    ...state,
    ..._freshSpace(),
    question: null,
    phase: PHASE.SEASON_WON,
    collected: { ...state.collected, [season.id]: state.items },
  }
}

/**
 * Answer the current question.
 *
 * A timeout is delivered here as `given = null`, which fails `check` and so
 * takes exactly the same path as a wrong tap.
 *
 * @param {GameState} state - The current state
 * @param {unknown} given - The player's answer, or null for a timeout
 * @returns {{state: GameState, outcome: Outcome}} The new state and what happened
 */
export function answer(state, given) {
  if (!state || (state.phase !== PHASE.TRAIL && state.phase !== PHASE.BOSS)) {
    return { state, outcome: _noOutcome(state?.phase ?? PHASE.CHARACTER_SELECT) }
  }
  const season = getSeason(state.seasonId)
  if (!season) {
    return {
      state: { ...state, phase: PHASE.CHARACTER_SELECT },
      outcome: _noOutcome(PHASE.CHARACTER_SELECT),
    }
  }

  const effects = getEffects(state.characterId)
  const correct = getChallenge(season.challenge).check(state.question, given)
  const wasBoss = state.phase === PHASE.BOSS
  const glowing = !wasBoss && isGlowingAt(season, state.position)
  const outcome = { ..._noOutcome(state.phase), correct, glowing, wasBoss }

  // Common bookkeeping, regardless of branch.
  let next = {
    ...state,
    questionsAsked: state.questionsAsked + 1,
    correctCount: state.correctCount + (correct ? 1 : 0),
    streak: correct ? state.streak + 1 : 0,
  }
  next.bestStreak = Math.max(state.bestStreak, next.streak)

  if (!correct) {
    // The question stays. Nothing is taken, nobody moves, and the same question
    // is asked again -- so `questionsAsked` advancing above does not redraw it,
    // because `next.question` is left exactly as it was.
    outcome.retry = true
    // An extra question is owed unless this space has already served one, or
    // the character skips them outright.
    const owes = state.owed === 0 && state.extrasDone === 0 && !effects.skipsExtra
    // The hint fires on the first miss of the season that has one in hand.
    const hinted = state.hintsLeft > 0
    outcome.hinted = hinted
    outcome.phase = state.phase
    return {
      state: {
        ...next,
        retrying: true,
        owed: owes ? 1 : state.owed,
        hintsLeft: hinted ? state.hintsLeft - 1 : state.hintsLeft,
      },
      outcome,
    }
  }

  // Right at last. If the question had been missed, this is the moment the
  // reinforcement card belongs to, whichever branch follows.
  if (state.retrying) outcome.reinforce = _explain(season, state.question)

  if (state.owed > 0) {
    // The debt, paid with a question rather than an item. Stay put, draw a new
    // one, and remember that this space has had its extra.
    outcome.extra = true
    outcome.phase = state.phase
    const again = { ...next, retrying: false, owed: 0, extrasDone: 1 }
    return { state: { ...again, question: _makeQuestion(again) }, outcome }
  }

  // Nothing owed: this space pays out.
  outcome.itemsGained = wasBoss ? 0 : glowing ? PLAY.ITEMS_PER_GLOWING_SPACE : PLAY.ITEMS_PER_SPACE
  outcome.rescued = wasBoss ? season.boss.rescue : 0
  next = {
    ...next,
    ..._freshSpace(),
    items: state.items + outcome.itemsGained + outcome.rescued,
    position: wasBoss ? state.position : state.position + 1,
  }

  if (wasBoss) {
    const resolved = _resolveSeason(next, season)
    outcome.phase = resolved.phase
    return { state: resolved, outcome }
  }

  // Arriving at the boss ends the trail; otherwise draw the next question.
  if (isAtBoss(season, next.position)) {
    outcome.reachedBoss = true
    next = { ...next, phase: PHASE.BOSS, position: bossPosition(season) }
  }
  next.question = _makeQuestion(next)
  outcome.phase = next.phase
  return { state: next, outcome }
}

/**
 * Move on after a won season: start the next one, or finish the run.
 *
 * @param {GameState} state - A state in SEASON_WON
 * @returns {GameState} The next season's opening state, or PHASE.RUN_COMPLETE
 */
export function advance(state) {
  if (!state || state.phase !== PHASE.SEASON_WON) return state
  // An unknown season id must not read as "finished". `nextSeason` returns null
  // both for "after winter" and for "no such season", so check the current one
  // exists before trusting that null to mean the run is over.
  if (!getSeason(state.seasonId)) {
    return { ...state, phase: PHASE.CHARACTER_SELECT, seasonId: null, question: null }
  }
  const following = nextSeason(state.seasonId)
  if (!following) return { ...state, phase: PHASE.RUN_COMPLETE, question: null }
  return startSeason(state, following.id)
}

/**
 * Turn a saved run back into a live state.
 *
 * Two things are restored rather than loaded, because both are derived values
 * that a save file could contradict:
 * - `position` goes through `Journey.normalizePosition`, the semantic authority
 *   on the bound. storage.js only guarantees a non-negative integer, and a save
 *   written before a season was shortened can point past the end of the trail.
 *   Journey also rejects non-finite and fractional values, which an inline
 *   clamp here would let through.
 * - `question` is regenerated from the seed. It is never persisted, so this is
 *   the only way a reloaded page shows the question it was showing before.
 *
 * A reload during a retry gives back a *different* question, because
 * `questionsAsked` has moved on since the one that was missed. `retrying` still
 * loads, so the extra question and the untimed retry both survive; what is lost
 * is the particular fact she was stuck on. Persisting the question to fix that
 * would mean trusting a save file to describe a question, which is the one
 * thing this design has always refused to do.
 *
 * @param {Object} savedRun - A run from storage.normalizeSave
 * @returns {GameState} A live state, ready to render
 */
export function rehydrate(savedRun) {
  const base = { ...createState(savedRun?.seed), ...savedRun }
  const season = getSeason(base.seasonId)
  if (!season) return { ...base, phase: PHASE.CHARACTER_SELECT, seasonId: null, question: null }

  const position = normalizePosition(season, base.position)
  const restored = { ...base, position }
  if (restored.phase !== PHASE.TRAIL && restored.phase !== PHASE.BOSS) {
    return { ...restored, question: null }
  }
  // A saved TRAIL phase that has actually reached the end is really at the boss.
  const phase = isAtBoss(season, position) ? PHASE.BOSS : PHASE.TRAIL
  const settled = { ...restored, phase }
  return { ...settled, question: _makeQuestion(settled) }
}

/**
 * Items that currently count toward the demand.
 *
 * @param {GameState} state - The current state
 * @returns {number} Items banked this season
 */
export function countingItems(state) {
  return Math.max(0, state?.items ?? 0)
}

/**
 * Items still owed to the snake woman.
 *
 * @param {GameState} state - The current state
 * @returns {number} Items short of the demand, or 0 when it is met
 */
export function remainingDemand(state) {
  const season = getSeason(state?.seasonId)
  if (!season) return 0
  return Math.max(0, season.demand - countingItems(state))
}

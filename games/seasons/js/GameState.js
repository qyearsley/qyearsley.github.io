/**
 * Seasons game state -- every rule in the game, as pure functions.
 *
 * Architecture: this module is the whole rulebook, and it never touches the DOM,
 * the clock, or `Math.random()`.
 * - Every exported function takes a state and returns a *new* state. Nothing
 *   here mutates its argument, so the UI can hold on to the previous state to
 *   animate the difference between the two.
 * - Randomness is derived, not stored. The state carries a `seed` and a
 *   `questionsAsked` counter, and the question for a given state is
 *   `createRng(seed:season:questionsAsked)`. That makes the state fully
 *   serializable -- there is no generator object to persist -- and it makes a
 *   whole season reproducible from a single number, which is what lets
 *   GameState.test.js assert on real generated questions.
 * - Time is not modelled. `questionSeconds` reports how long a question should
 *   be allowed, and the UI owns the countdown. A timeout is delivered as
 *   `answer(state, null)`, which is simply a wrong answer -- there is no
 *   separate timeout path to keep in sync with the wrong-answer rules.
 * - The two undecided design rules (constants.RULES) are implemented here in
 *   full, all three options each. `_applyPenalty` is the only place a wrong
 *   answer costs anything, and `_resolveSeason` the only place a season ends.
 *
 * The wilt rule, in detail, because it is the subtle one: a wrong answer moves
 * items from `items` into `wilting`, where they stop counting toward the demand.
 * The next correct answer moves them back. A *second* wrong answer first flushes
 * whatever is already wilting into `lost`, which is permanent. So one mistake
 * costs nothing if you recover immediately, and two in a row cost you an item
 * for good. That is the "challenging but not discouraging" line Ella asked for,
 * and it is why `wilting` and `lost` are separate fields.
 *
 * Error Handling: `answer` is a no-op returning the same state when called in a
 * phase that takes no answers, so a double-click cannot double-score. A state
 * naming a season that no longer exists resolves to CHARACTER_SELECT rather
 * than throwing.
 */

import { getCharacter, getEffects } from "./characters.js"
import { BOSS_FAILURE, PHASE, PLAY, RULES, SEASON_ORDER, WRONG_ANSWER } from "./constants.js"
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
 * @property {number} position        - 0 .. season.spaces; the last value is the boss
 * @property {number} items           - Items banked and safe this season
 * @property {number} wilting         - Items at risk; revived by the next correct answer
 * @property {number} lost            - Items lost for good this season
 * @property {number} forgivenessLeft - Free passes remaining this season
 * @property {boolean} lastWasWrong   - Whether the previous answer was wrong
 * @property {number} streak          - Consecutive correct answers
 * @property {number} bestStreak      - Best streak this run
 * @property {number} questionsAsked  - Questions asked this season; also the rng cursor
 * @property {number} correctCount    - Correct answers this season
 * @property {Object|null} question   - The question on screen
 * @property {Object<string, number>} collected - Season id -> items delivered
 * @property {boolean} runOver        - Set when a loss ends the whole run
 */

/**
 * What one answer did. The UI reads this to decide what to animate and say; it
 * is never persisted.
 *
 * @typedef {Object} Outcome
 * @property {boolean} correct      - Whether the answer was right
 * @property {boolean} forgiven     - A wrong answer a perk waved away
 * @property {number} itemsGained   - Items collected, after every modifier
 * @property {number} revived       - Wilted items brought back
 * @property {number} wiltedNow     - Items that just started wilting
 * @property {number} lostNow       - Items lost for good just now
 * @property {number} steppedBack   - Spaces moved backward
 * @property {boolean} doubled      - Whether the comeback bonus applied
 * @property {boolean} glowing      - Whether it was a glowing space
 * @property {boolean} reachedBoss  - Whether this answer arrived at the boss
 * @property {boolean} wasBoss      - Whether this was the boss question
 * @property {number} rescued       - Items the boss question awarded
 * @property {number} shortfall     - Items still owed at resolution, else 0
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
    forgiven: false,
    itemsGained: 0,
    revived: 0,
    wiltedNow: 0,
    lostNow: 0,
    steppedBack: 0,
    doubled: false,
    glowing: false,
    reachedBoss: false,
    wasBoss: false,
    rescued: 0,
    shortfall: 0,
    phase,
  }
}

/**
 * The rng for the next question. Derived from the run seed, the season, and how
 * many questions have been asked, so it is a pure function of the state.
 * @private
 * @param {GameState} state - The current state
 * @returns {import("./rng.js").Rng} A generator for this question
 */
function _questionRng(state) {
  return createRng(`${state.seed}:${state.seasonId}:${state.questionsAsked}`)
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
    position: 0,
    items: 0,
    wilting: 0,
    lost: 0,
    forgivenessLeft: 0,
    lastWasWrong: false,
    streak: 0,
    bestStreak: 0,
    questionsAsked: 0,
    correctCount: 0,
    question: null,
    collected: {},
    runOver: false,
  }
}

/**
 * Begin a season, resetting everything that is per-season and keeping
 * everything that is per-run (`seed`, `bestStreak`, `collected`).
 *
 * @param {GameState} state - The current state
 * @param {string} seasonId - The season to start
 * @returns {GameState} A new state in PHASE.TRAIL with its first question, or
 *   an unchanged state if the season id is unknown
 */
export function startSeason(state, seasonId) {
  const season = getSeason(seasonId)
  if (!season) return state
  const effects = getEffects(state.characterId)
  const next = {
    ...state,
    phase: PHASE.TRAIL,
    seasonId,
    position: 0,
    items: 0,
    wilting: 0,
    lost: 0,
    forgivenessLeft: effects.forgivenessPerSeason,
    lastWasWrong: false,
    streak: 0,
    questionsAsked: 0,
    correctCount: 0,
    question: null,
    runOver: false,
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
 * @param {GameState} state - The current state
 * @returns {number|null} Seconds, or null when the season is untimed
 */
export function questionSeconds(state) {
  const season = getSeason(state?.seasonId)
  if (!season || season.timerSeconds === null) return null
  return season.timerSeconds + getEffects(state.characterId).extraSeconds
}

/**
 * Apply the active wrong-answer rule. The only place in the game where a
 * mistake costs something.
 *
 * The character's `penaltyScale` multiplies the cost rather than naming it, so
 * every character stays meaningful under all three rules. A scale of 0 exits
 * early: the Banana Slug is immune to whichever rule is active.
 *
 * @private
 * @param {GameState} state - State before the penalty
 * @param {Object} effects - The character's merged effects
 * @returns {{changes: Object, wiltedNow: number, lostNow: number, steppedBack: number}}
 *   Fields to merge into the next state, plus what to report
 */
function _applyPenalty(state, effects) {
  const scale = Math.max(0, Math.floor(effects.penaltyScale))
  const nothing = { changes: {}, wiltedNow: 0, lostNow: 0, steppedBack: 0 }
  if (scale === 0 || RULES.WRONG_ANSWER === WRONG_ANSWER.GENTLE) return nothing

  if (RULES.WRONG_ANSWER === WRONG_ANSWER.WILT) {
    // Whatever was already at risk is now gone; a fresh batch starts wilting.
    const lostNow = state.wilting
    const wiltedNow = Math.min(state.items, scale)
    return {
      changes: {
        items: state.items - wiltedNow,
        wilting: wiltedNow,
        lost: state.lost + lostNow,
      },
      wiltedNow,
      lostNow,
      steppedBack: 0,
    }
  }

  if (RULES.WRONG_ANSWER === WRONG_ANSWER.STEP_BACK) {
    const steppedBack = Math.min(state.position, scale)
    const lostNow = Math.min(state.items, scale)
    return {
      changes: {
        position: state.position - steppedBack,
        items: state.items - lostNow,
        lost: state.lost + lostNow,
      },
      wiltedNow: 0,
      lostNow,
      steppedBack,
    }
  }

  return nothing
}

/**
 * Resolve a season once the boss question has been answered.
 *
 * `items` at this point already includes the boss rescue if it was earned.
 * Anything still wilting has failed to revive and is written off, so the demand
 * is judged against safe items only.
 *
 * @private
 * @param {GameState} state - State after the boss answer's effects
 * @param {import("./seasons.js").Season} season - The season being resolved
 * @returns {{state: GameState, shortfall: number}} The resolved state
 */
function _resolveSeason(state, season) {
  const writtenOff = state.wilting
  const items = state.items
  const shortfall = Math.max(0, season.demand - items)
  const met = shortfall === 0
  const settled = {
    ...state,
    items,
    wilting: 0,
    lost: state.lost + writtenOff,
    question: null,
  }

  if (met || RULES.BOSS_FAILURE === BOSS_FAILURE.ALWAYS_PASS) {
    return {
      state: {
        ...settled,
        phase: PHASE.SEASON_WON,
        collected: { ...settled.collected, [season.id]: items },
      },
      shortfall,
    }
  }

  return {
    state: {
      ...settled,
      phase: PHASE.SEASON_LOST,
      runOver: RULES.BOSS_FAILURE === BOSS_FAILURE.END_RUN,
    },
    shortfall,
  }
}

/**
 * Answer the current question.
 *
 * A timeout is delivered here as `given = null`, which fails `check` and so
 * takes exactly the same path as a wrong tap. There is deliberately no separate
 * timeout branch to keep in step with the penalty rules.
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
    lastWasWrong: !correct,
  }
  next.bestStreak = Math.max(state.bestStreak, next.streak)

  if (correct) {
    // A correct answer always revives whatever was wilting.
    outcome.revived = state.wilting
    const doubled = effects.comebackBonus && state.lastWasWrong
    const base = wasBoss ? 0 : glowing ? effects.glowingItems : PLAY.ITEMS_PER_SPACE
    outcome.itemsGained = base * (doubled ? 2 : 1)
    outcome.doubled = doubled && outcome.itemsGained > 0
    outcome.rescued = wasBoss ? season.boss.rescue : 0
    next = {
      ...next,
      items: state.items + outcome.revived + outcome.itemsGained + outcome.rescued,
      wilting: 0,
      position: wasBoss ? state.position : state.position + 1,
    }
  } else {
    // Work out the penalty before deciding whether to spend a free pass. A
    // perk that says "a wrong answer costs you nothing at all" should not burn
    // itself on an answer that was already going to cost nothing -- which is
    // every wrong answer under GENTLE, and any wrong answer with no items left
    // to wilt. Spending it there is indistinguishable from a bug to a player.
    const penalty = _applyPenalty(state, effects)
    const costsSomething = penalty.wiltedNow > 0 || penalty.lostNow > 0 || penalty.steppedBack > 0

    if (costsSomething && state.forgivenessLeft > 0) {
      outcome.forgiven = true
      next = { ...next, forgivenessLeft: state.forgivenessLeft - 1 }
    } else {
      outcome.wiltedNow = penalty.wiltedNow
      outcome.lostNow = penalty.lostNow
      outcome.steppedBack = penalty.steppedBack
      // At the boss there is no space to step back from -- the season is about
      // to resolve, and moving the token off the boss space would only make the
      // result screen draw it a space short.
      const changes = wasBoss ? { ...penalty.changes, position: state.position } : penalty.changes
      next = { ...next, ...changes }
      if (wasBoss) outcome.steppedBack = 0
    }
  }

  if (wasBoss) {
    const resolved = _resolveSeason(next, season)
    outcome.shortfall = resolved.shortfall
    outcome.phase = resolved.state.phase
    return { state: resolved.state, outcome }
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
 * Play the lost season again. Under BOSS_FAILURE.END_RUN the run is over, so
 * this restarts from the first season and clears what was collected.
 *
 * @param {GameState} state - A state in SEASON_LOST
 * @returns {GameState} A fresh season, in the same run or a new one
 */
export function retry(state) {
  if (!state || state.phase !== PHASE.SEASON_LOST) return state
  if (state.runOver) {
    return startSeason({ ...state, collected: {}, bestStreak: 0 }, SEASON_ORDER[0])
  }
  return startSeason(state, state.seasonId)
}

/**
 * Turn a saved run back into a live state.
 *
 * Two things are restored rather than loaded, because both are derived values
 * that a save file could contradict:
 * - `position` goes through `Journey.normalizePosition`, the semantic authority
 *   on the bound. storage.js only guarantees a non-negative integer, and a save
 *   written before a season was shortened can point past the end of the trail.
 *   Journey also rejects the non-finite and fractional values storage would
 *   have caught -- doing the clamp inline here missed those.
 * - `question` is regenerated from the seed. It is never persisted, so this is
 *   the only way a reloaded page shows the question it was showing before.
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
 * Items that currently count toward the demand. Wilting items deliberately do
 * not: not counting them is what makes a wilt visible in the number on screen.
 *
 * @param {GameState} state - The current state
 * @returns {number} Safe items this season
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

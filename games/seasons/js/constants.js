/**
 * Seasons constants -- every shared value in the game. This module imports
 * nothing, so it can be read by any other module without a cycle.
 *
 * Architecture: this is the tuning surface. Two groups of values matter most:
 *
 * - `RULES.WRONG_ANSWER` and `RULES.BOSS_FAILURE` are the two undecided design
 *   questions, exposed as switches rather than baked into GameState. Both are
 *   deliberately playtestable: change the constant, reload, play. GameState
 *   implements every option, and GameState.test.js covers every option, so
 *   flipping one is a one-line change and not a rewrite.
 * - Season difficulty lives in seasons.js, not here, because it is content
 *   rather than mechanism.
 *
 * Error Handling: none needed -- this module is data with no behaviour.
 */

/**
 * localStorage identity. Bumping VERSION clears every existing save, which the
 * shared StorageManager does on a version mismatch. Bump it whenever the save
 * shape changes incompatibly.
 */
export const STORAGE = {
  KEY: "seasonsProgress",
  VERSION: "1.0",
}

/**
 * The four seasons in play order. seasons.js defines each one; this array is
 * the authority on their sequence, and on which season follows which.
 * @type {string[]}
 */
export const SEASON_ORDER = ["spring", "summer", "autumn", "winter"]

/**
 * What a wrong answer costs. Ella has not settled this yet, so all three are
 * implemented and any of them can be the active rule.
 *
 * - GENTLE:    nothing happens. You stay on the space and the question changes.
 *              Nothing is ever taken away. Use this for a bad day, or for a
 *              younger player.
 * - WILT:      your most recent item wilts -- it stops counting toward the
 *              snake woman's demand, but the *next* correct answer revives it.
 *              Two wrong answers in a row and the first one is gone for good.
 *              Visible, recoverable, and it still stings.
 * - STEP_BACK: you move back a space and lose an item outright.
 *
 * @enum {string}
 */
export const WRONG_ANSWER = {
  GENTLE: "gentle",
  WILT: "wilt",
  STEP_BACK: "stepBack",
}

/**
 * What happens when the demand is missed and the boss question is missed too.
 * Also undecided, also implemented three ways.
 *
 * - RETRY_SEASON: the season restarts. The frog is a joke, not an ending.
 * - ALWAYS_PASS:  you continue with fewer items banked and an annoyed snake
 *                 woman. No frustration, and no tension either.
 * - END_RUN:      the whole run ends and you start from spring.
 *
 * @enum {string}
 */
export const BOSS_FAILURE = {
  RETRY_SEASON: "retrySeason",
  ALWAYS_PASS: "alwaysPass",
  END_RUN: "endRun",
}

/**
 * The active rules. These are the two switches described in the file header.
 *
 * WILT and RETRY_SEASON are the starting defaults because they are the middle
 * option of each set: they have real stakes without ending anything. Change
 * either one here and play; nothing else needs to move.
 */
export const RULES = {
  WRONG_ANSWER: WRONG_ANSWER.WILT,
  BOSS_FAILURE: BOSS_FAILURE.RETRY_SEASON,
}

/**
 * Values that apply to every season regardless of difficulty.
 *
 * CHOICE_COUNT is 4 because the answer buttons need to stay large enough to tap
 * on a shared iPad. Note the tradeoff this locks in: multiple choice means a
 * one-in-four guess is always available. Times Trail rejected multiple choice
 * for exactly that reason, but Times Trail is a fluency tracker whose data a
 * guess would corrupt. Seasons is an adventure with no per-fact model, so the
 * friendlier input wins. If Seasons ever grows a mastery model, revisit this.
 */
export const PLAY = {
  CHOICE_COUNT: 4,
  /** Items awarded by an ordinary space. */
  ITEMS_PER_SPACE: 1,
  /** Items awarded by a glowing space, before the character's own modifier. */
  ITEMS_PER_GLOWING_SPACE: 3,
}

/**
 * Defaults for a character that does not override them. characters.js merges
 * each character's `effects` over this object, so a character only states what
 * it changes.
 *
 * `penaltyScale` multiplies whatever the active WRONG_ANSWER rule costs: 0 is
 * immune, 1 is normal, 2 is double. Keeping the scale separate from the rule is
 * what lets a character stay meaningful whichever rule is active.
 */
export const DEFAULT_EFFECTS = {
  /** Multiplier on the wrong-answer penalty. 0 means immune. */
  penaltyScale: 1,
  /** Items from a glowing space, overriding PLAY.ITEMS_PER_GLOWING_SPACE. */
  glowingItems: PLAY.ITEMS_PER_GLOWING_SPACE,
  /** Seconds added to a timed question. Ignored when the season has no timer. */
  extraSeconds: 0,
  /** Wrong answers fully ignored per season, before any penalty applies. */
  forgivenessPerSeason: 0,
  /** Whether the first correct answer after a wrong one pays double. */
  comebackBonus: false,
}

/**
 * Which art pack draws the game. See art/index.js -- the pack is the only place
 * that knows what a banana slug looks like, so swapping hand-drawn vectors or a
 * sprite pack in later is this one string plus one new file.
 */
export const ART = {
  PACK: "placeholder",
}

/**
 * Phases of a run. GameState is a state machine over these.
 * @enum {string}
 */
export const PHASE = {
  /** Choosing a character; no season started. */
  CHARACTER_SELECT: "characterSelect",
  /** Walking the trail, answering ordinary questions. */
  TRAIL: "trail",
  /** At the end of the trail, facing the boss question. */
  BOSS: "boss",
  /** The season was cleared. */
  SEASON_WON: "seasonWon",
  /** The demand was missed and the boss did not save it. */
  SEASON_LOST: "seasonLost",
  /** Every season cleared. */
  RUN_COMPLETE: "runComplete",
}

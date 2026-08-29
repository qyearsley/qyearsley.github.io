/**
 * Seasons constants -- every shared value in the game. This module imports
 * nothing, so it can be read by any other module without a cycle.
 *
 * This is the tuning surface. `RULES.WRONG_ANSWER` and `RULES.BOSS_FAILURE` are
 * the undecided design questions, exposed as switches rather than baked into
 * GameState: change the constant, reload, play. GameState implements every
 * option and GameState.test.js covers every option, so flipping one is a
 * one-line change and not a rewrite. ../README.md is the canonical description
 * of what each option means to a player; the enums below carry a one-line
 * reminder each.
 *
 * Season difficulty lives in seasons.js, not here, because it is content rather
 * than mechanism.
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
 * the authority on their sequence.
 * @type {string[]}
 */
export const SEASON_ORDER = ["spring", "summer", "autumn", "winter"]

/**
 * What a wrong answer costs. Ella has not settled this yet, so every option is
 * implemented and any of them can be the active rule. ../README.md explains
 * each in full.
 *
 * - GENTLE:    nothing happens; you stay put and the question changes.
 * - WILT:      your most recent item stops counting, and the *next* correct
 *              answer revives it. Two wrong in a row and it is gone for good.
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
 * What happens when the demand is missed *and* every boss try (BOSS_TRIES) has
 * been used up. Also undecided, also implemented every way; ../README.md
 * explains each in full.
 *
 * - RETRY_SEASON: the season restarts, with fresh questions.
 * - ALWAYS_PASS:  you continue with fewer items banked.
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
 * The active rules -- the two switches described in the file header.
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
 * How many shots you get at the boss question.
 *
 * Ella's rule: "if you miss the boss question you get a chance to go back and
 * try again." So a miss is not the end of the season -- you face a fresh boss
 * question, and only running out of tries hands over to RULES.BOSS_FAILURE.
 * Set to 1 to make the boss single-shot again.
 */
export const BOSS_TRIES = 2

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

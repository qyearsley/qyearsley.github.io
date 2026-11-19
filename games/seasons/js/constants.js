/**
 * Seasons constants -- every shared value in the game. This module imports
 * nothing, so it can be read by any other module without a cycle.
 *
 * This is the tuning surface. A wrong answer costs no items: you keep the
 * question until you get it right, then answer one more before moving on.
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
 *
 * Clearing is deliberate: coercing an incompatible save would land a player
 * somewhere arbitrary, while clearing starts her at spring.
 */
export const STORAGE = {
  KEY: "seasonsProgress",
  VERSION: "2.0",
}

/**
 * The four seasons in play order. seasons.js defines each one; this array is
 * the authority on their sequence.
 * @type {string[]}
 */
export const SEASON_ORDER = ["spring", "summer", "autumn", "winter"]

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
  /**
   * Items awarded by a glowing space. The same for every character: a season's
   * demand is exactly what a finished trail pays plus the boss's rescue, and a
   * character who collected a different amount from a mountain could not hit
   * that number. See seasons.js.
   */
  ITEMS_PER_GLOWING_SPACE: 3,
}

/**
 * How many choices the Phoenix's hint leaves standing.
 *
 * Two, not one. "Two wrong choices vanish" is the promise on the card, and read
 * literally against four buttons it would leave the answer alone on screen --
 * the player has already struck one off by pressing it. Leaving two is the
 * fifty-fifty the perk sounds like, and it still asks her to choose.
 */
export const HINT_CHOICES_LEFT = 2

/**
 * Defaults for a character that does not override them. characters.js merges
 * each character's `effects` over this object, so a character only states what
 * it changes.
 *
 * Each animal owns exactly one field here, the four things a perk can touch.
 */
export const DEFAULT_EFFECTS = {
  /** Seconds added to a timed question. Ignored when the season has no timer. */
  extraSeconds: 0,
  /** Whether this character never runs a countdown, whatever the setting says. */
  noTimer: false,
  /** Hints per season: a miss that leaves HINT_CHOICES_LEFT choices standing. */
  hintsPerSeason: 0,
  /** Whether a mistake skips the extra question and goes straight on. */
  skipsExtra: false,
}

/**
 * Phases of a run. GameState is a state machine over these.
 *
 * There is no lost phase. A missed question is retried rather than charged for,
 * including the snake woman's, so a season that has started always ends in
 * SEASON_WON.
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
  /** Every season cleared. */
  RUN_COMPLETE: "runComplete",
}

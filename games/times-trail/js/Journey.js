/**
 * Journey for Times Trail
 * One themed trail: the fact set it is about, and the token that walks it.
 *
 * Architecture: two separate ideas, kept separate on purpose.
 *
 * 1. A trail owns a PATTERN, not a table. Doubles, Fives, Squares, Nines, and
 *    the Tough Ten -- see `TRAILS` in constants.js. A trail always uses all of
 *    its own facts. The sets overlap, and that is a feature: the mastery record
 *    is per canonical fact and shared, so getting 5x5 right advances both Fives
 *    and Squares.
 *
 * 2. Walking is not gated. Every trail is `TRAIL.SPACES` long and every correct
 *    answer moves the token one space; the last space finishes the trail.
 *    Strength decides which fact is asked next (FactSelector), and the hub shows
 *    it as "N strong", but it never decides whether the token moves: strength
 *    takes days of spaced repetition, so gating on it would strand a new player
 *    after a few answers. See `docs/times-trail-plan.md`.
 *
 * Purity: no DOM, no storage, no timers. The clock is the injected `now`. No
 * method mutates its arguments -- in particular `advance` returns a NEW trail
 * object and does not touch the one it was given, so THE CALLER MUST ASSIGN THE
 * RESULT (`progress.trails.spaces[id] = journey.advance(trail).trail.space`).
 * Dropping the return value is silent: every answer looks scored, the token
 * never moves, and the whole trail feature is dead with nothing in the logs.
 *
 * There are no laps. The last space is the end of a trail, and the next thing to
 * do is a different trail.
 */

import { DEFAULT_TRAIL_ID, STRENGTH, TRAIL, TRAILS } from "./constants.js"
import { factIdsForTrail, getTrail } from "./facts.js"
import { createRecord, decayedStrength } from "./MasteryModel.js"
import { isPlainObject } from "../../shared/validate.js"

/**
 * One trail. Shape mirrors the frozen entries of TRAILS, minus `match`, which
 * is the definition rather than something a consumer should call.
 * @typedef {Object} TrailDef
 * @property {string} id    - Kebab-case identifier, e.g. "squares"
 * @property {string} name  - Display name, e.g. "Squares"
 * @property {string} emoji - Glyph for the picker and the trail map
 * @property {string} blurb - One line saying what the pattern is
 */

/**
 * The token's position on one trail. Deliberately one field: there are no laps.
 * @typedef {Object} Trail
 * @property {number} space - 0-based space index, 0 .. TRAIL.SPACES - 1
 */

/**
 * A trail's status for the hub.
 * @typedef {Object} TrailProgress
 * @property {string} trailId     - The trail's id
 * @property {number} total       - Facts the trail owns
 * @property {number} strong      - Of those, how many are at STRENGTH.STRENGTHENING
 *                                  or better right now (decay applied)
 * @property {number} totalSpaces - TRAIL.SPACES
 * @property {number} space       - The token's space on this trail
 * @property {boolean} complete   - The token is on the last space
 */

/**
 * The outcome of one `advance` call. `trail` is a NEW object; assign it.
 * @typedef {Object} AdvanceResult
 * @property {Trail} trail        - The new position (never the input object)
 * @property {boolean} finished   - The token reached the last space on this call
 */

/**
 * Every trail id the game knows, in hub order.
 * @returns {string[]} A new array of ids
 */
export function trailIds() {
  return TRAILS.map((trail) => trail.id)
}

/**
 * Coerce an untrusted trail id to one the game knows.
 * @param {unknown} trailId - Candidate id, typically from a save file
 * @returns {string} The id when known, otherwise DEFAULT_TRAIL_ID
 */
export function normalizeTrailId(trailId) {
  return getTrail(trailId) === null ? DEFAULT_TRAIL_ID : /** @type {string} */ (trailId)
}

/**
 * Every trail's status at once, in hub order.
 * @param {Object} [options] - Options
 * @param {Object<string, import("./MasteryModel.js").MasteryRecord>} [options.records] -
 *   factId -> record
 * @param {Object<string, number>} [options.spaces] - trailId -> token space
 * @param {() => number} [options.now] - Injected clock
 * @returns {TrailProgress[]} One entry per trail, in `TRAILS` order
 */
export function allTrailProgress({ records, spaces, now } = {}) {
  const positions = isPlainObject(spaces) ? spaces : {}
  return trailIds().map((trailId) =>
    new Journey({ trailId, now }).progress(records, { space: positions[trailId] }),
  )
}

/**
 * One themed trail. The trail is a constructor argument rather than a setter:
 * changing it is a new `Journey`, and game.js rebuilds one on a trail change.
 */
export class Journey {
  /**
   * @param {Object} [options] - Construction options
   * @param {string} [options.trailId] - Which trail; unknown ids fall back to
   *   DEFAULT_TRAIL_ID rather than throwing, since this comes off a save file.
   * @param {() => number} [options.now] - Injected clock returning epoch ms;
   *   defaults to `() => Date.now()`. Used only for decay.
   */
  constructor(options = {}) {
    const opts = isPlainObject(options) ? options : {}

    /** @type {string} @private */
    this._trailId = normalizeTrailId(opts.trailId)

    /** @type {() => number} @private */
    this._now = typeof opts.now === "function" ? opts.now : () => Date.now()

    /** @type {string[]} Every fact the trail owns. @private */
    this._factIds = factIdsForTrail(this._trailId)
  }

  /**
   * A token at the start of a trail.
   * @returns {Trail} `{ space: 0 }`, a new object every call
   */
  static createTrail() {
    return { space: 0 }
  }

  /**
   * Coerce untrusted data into a valid position: an integer in
   * [0, TRAIL.SPACES - 1].
   * @param {unknown} raw - Anything at all, typically a parsed JSON value
   * @returns {Trail} A new, valid trail
   */
  static normalizeTrail(raw) {
    if (!isPlainObject(raw) || !Number.isFinite(raw.space)) return Journey.createTrail()
    return { space: Math.min(TRAIL.SPACES - 1, Math.max(0, Math.floor(raw.space))) }
  }

  /**
   * Which trail this journey walks.
   * @returns {TrailDef|null} The frozen trail entry
   */
  get trail() {
    return getTrail(this._trailId)
  }

  /**
   * Which trail this journey walks, by id.
   * @returns {string} A known trail id
   */
  get trailId() {
    return this._trailId
  }

  /**
   * The fact ids a round on this trail asks: all of the trail's own facts.
   * @returns {string[]} A copy
   */
  get factIds() {
    return [...this._factIds]
  }

  /**
   * This trail's status: how strong its facts are and where the token stands.
   * @param {Object<string, import("./MasteryModel.js").MasteryRecord>} [records] -
   *   factId -> record; missing entries are treated as never asked
   * @param {unknown} [trail] - The token's position; anything invalid is space 0
   * @returns {TrailProgress} The trail's status
   */
  progress(records, trail) {
    const now = this._now()
    const source = isPlainObject(records) ? records : {}
    let strong = 0
    for (const factId of this._factIds) {
      const record = source[factId] ?? createRecord()
      if (decayedStrength(record, now) >= STRENGTH.STRENGTHENING) strong += 1
    }
    const { space } = Journey.normalizeTrail(trail)
    return {
      trailId: this._trailId,
      total: this._factIds.length,
      strong,
      totalSpaces: TRAIL.SPACES,
      space,
      complete: space === TRAIL.SPACES - 1,
    }
  }

  /**
   * Move the token one space, stopping on the last space.
   *
   * Returns a NEW trail; the `trail` argument is never mutated, so THE CALLER
   * MUST ASSIGN `result.trail`. Dropping it fails silently: the game keeps
   * scoring, the token never moves, and nothing reports an error.
   * @param {Trail} trail - Current position; normalized, never mutated
   * @returns {AdvanceResult} The new position, and whether this call finished the trail
   */
  advance(trail) {
    const from = Journey.normalizeTrail(trail)
    const space = Math.min(TRAIL.SPACES - 1, from.space + 1)
    return { trail: { space }, finished: space !== from.space && space === TRAIL.SPACES - 1 }
  }
}

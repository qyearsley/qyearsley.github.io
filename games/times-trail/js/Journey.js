/**
 * Journey for Times Trail
 * One themed trail: the fact set it is about, the token that walks it, and the
 * one rule that decides how far the token may stand.
 *
 * Architecture: three separate ideas, kept separate on purpose.
 *
 * 1. A trail owns a PATTERN, not a table. Doubles, Fives, Squares, Nines, and
 *    the Tough Ten -- see `TRAILS` in constants.js. The sets overlap, and that
 *    is a feature: the mastery record is per canonical fact and shared, so
 *    getting 5x5 right advances both Fives and Squares.
 *
 *    This replaced one 40-space trail through eight table-named regions on
 *    2026-09-18. In that design a region owned every fact whose LARGER operand
 *    was its table, so Doubling Meadow owned exactly one fact and Dragon Peak
 *    owned eight -- and selection ignored the token's position entirely, so
 *    standing in Doubling Meadow you were asked 6x7. The names promised themed
 *    practice and the engine gave whole-pool practice. See
 *    `docs/times-trail-plan.md`.
 *
 * 2. Length and gating are scoped to the ACTIVE FACT POOL. A `Journey` is
 *    constructed with the pool the player is actually practising, and it is the
 *    intersection of the trail and that pool that matters: the trail is
 *    `SPACES_PER_FACT` spaces long per active fact, and only active facts count
 *    toward the cap. A player practising three of the eight squares walks a
 *    six-space Squares trail rather than a sixteen-space one she can never
 *    finish. A trail with no active fact at all is `unavailable` -- zero spaces
 *    -- and the hub greys it out rather than offering a trail with no content.
 *
 * 3. Gating is strength-driven, never answer-driven, and it is ONE formula:
 *
 *        cap = FREE_SPACES + SPACES_PER_STRONG_FACT * strongFacts
 *
 *    Strengthening opens ground; answering walks it. A strength gate matters
 *    because an answer-count gate can be walked by grinding 2x2 four hundred
 *    times, which teaches nothing and hands out the whole trail.
 *
 *    The arithmetic is the point. With every active fact strong, the cap is
 *    `FREE_SPACES + 2n` and the last space is `2n - 1`, so a trail can ALWAYS be
 *    finished. The eight per-region gates this replaced could not promise that:
 *    they were scoped to regions of one to eight facts, and a pool that missed a
 *    region's table froze the token behind it. That whole class of bug is gone
 *    structurally rather than by special-casing.
 *
 *    The bar is TRAIL.UNLOCK_MIN_STRENGTH (3, "strengthening"), NOT
 *    STRENGTH.MASTERED_MIN (4). Mastery means fluent recall and is the right bar
 *    for a foiled card; it is the wrong bar for movement, because a child who is
 *    reliably correct but still counting up would watch a frozen token for
 *    weeks. `TrailProgress` reports both counts: `strong` gates, `mastered` is
 *    what the collection and the `mastered-*` milestones read.
 *
 * Because gating reads decayed strength, the cap is recomputed from current
 * strength on every call and can legitimately SHRINK -- a player away for a
 * month comes back to weaker facts. `advance` therefore clamps with
 * `Math.max(currentSpace, ...)`: the token never moves backwards. Losing visible
 * progress is where children quit, so the token holds still and the `blocked`
 * flag explains why instead.
 *
 * Purity: no DOM, no storage, no timers. The clock is the injected `now`. No
 * method mutates its arguments -- in particular `advance` returns a NEW trail
 * object and does not touch the one it was given, so THE CALLER MUST ASSIGN THE
 * RESULT (`progress.trails[id] = journey.advance(trail, 1, records).trail`).
 * Dropping the return value is silent: every answer looks scored, the token
 * never moves, and the whole trail feature is dead with nothing in the logs.
 * That is exactly the class of bug this module was reviewed for.
 *
 * There are no laps. The last space is the end of a trail, and the next thing to
 * do is a different trail.
 */

import { DEFAULT_TRAIL_ID, TRAIL, TRAILS } from "./constants.js"
import { FACT_IDS, factIdsForTrail, getTrail, parseFactId } from "./facts.js"
import { createRecord, decayedStrength, isMastered } from "./MasteryModel.js"

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
 * @property {number} space - 0-based space index, 0 .. totalSpaces - 1
 */

/**
 * A trail's status, scoped to the active fact pool.
 *
 * `strong` is the cap's currency and `mastered` is the collection's; they are
 * reported separately rather than collapsed, because a UI that says "master 2
 * more facts" while the cap actually counts strengthening facts is telling the
 * player to do the wrong thing.
 * @typedef {Object} TrailProgress
 * @property {string} trailId      - The trail's id
 * @property {number} total        - Facts owned by the trail AND in the active pool
 * @property {number} strong       - Of those, how many are at TRAIL.UNLOCK_MIN_STRENGTH
 *                                   or better: the count the cap is computed from
 * @property {number} mastered     - Of those, how many are at STRENGTH.MASTERED_MIN or
 *                                   better. Always <= `strong`. What the card
 *                                   collection and the `mastered-*` milestones read.
 * @property {number} totalSpaces  - SPACES_PER_FACT * total
 * @property {number} cap          - Furthest space the token may occupy, clamped to
 *                                   the trail; 0 for an unavailable trail
 * @property {number} fraction     - strong / total in 0..1; 0 when total is 0
 * @property {boolean} complete    - Every active fact of the trail is strong
 * @property {boolean} unavailable - total === 0: no fact of this trail is in the pool
 */

/**
 * The outcome of one `advance` call. `trail` is a NEW object; assign it.
 * @typedef {Object} AdvanceResult
 * @property {Trail} trail        - The new position (never the input object)
 * @property {boolean} blocked    - Movement was capped by the strength gate
 * @property {boolean} finished   - The token reached the last space on this call
 * @property {number} spacesMoved - space after minus space before, always >= 0
 */

/**
 * Whether a value can be read as a keyed object (arrays and null rejected).
 * @private
 * @param {unknown} value - Value to test
 * @returns {boolean} True for a non-null, non-array object
 */
function _isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

/**
 * Normalize an untrusted active pool: keep only canonical fact ids, drop
 * duplicates, preserve the caller's order.
 *
 * Falls back to all 36 ids when nothing usable survives. An empty pool would
 * leave every trail unavailable, and `Settings.factPool` already guarantees a
 * non-empty pool, so an empty one here means bad input rather than intent.
 * @private
 * @param {unknown} pool - Candidate array of canonical fact ids
 * @returns {string[]} A new array of canonical ids, never empty
 */
function _normalizePool(pool) {
  if (!Array.isArray(pool)) return [...FACT_IDS]
  const seen = new Set()
  const ids = []
  for (const candidate of pool) {
    if (typeof candidate !== "string") continue
    if (parseFactId(candidate) === null) continue
    if (seen.has(candidate)) continue
    seen.add(candidate)
    ids.push(candidate)
  }
  return ids.length > 0 ? ids : [...FACT_IDS]
}

/**
 * Every trail id the game knows, in hub order. Pool-independent.
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
 *
 * Builds one `Journey` per trail, which is cheap -- a journey holds two arrays
 * and a set -- and keeps the length and cap arithmetic in exactly one place
 * rather than giving the hub its own copy of it.
 * @param {Object} [options] - Options
 * @param {string[]} [options.activePool] - Canonical fact ids being practised
 * @param {Object<string, import("./MasteryModel.js").MasteryRecord>} [options.records] -
 *   factId -> record
 * @param {() => number} [options.now] - Injected clock
 * @returns {TrailProgress[]} One entry per trail, in `TRAILS` order
 */
export function allTrailProgress({ activePool, records, now } = {}) {
  return trailIds().map((trailId) => new Journey({ trailId, activePool, now }).progress(records))
}

/**
 * One themed trail, bound to one active fact pool.
 *
 * Both bindings are constructor arguments rather than setters. The trail is
 * what the token is walking and the pool is what gating means, so changing
 * either is a new `Journey` -- game.js rebuilds on a settings change and on a
 * trail change, and that is the only correct thing to do.
 */
export class Journey {
  /**
   * @param {Object} [options] - Construction options
   * @param {string} [options.trailId] - Which trail; unknown ids fall back to
   *   DEFAULT_TRAIL_ID rather than throwing, since this comes off a save file.
   * @param {() => number} [options.now] - Injected clock returning epoch ms;
   *   defaults to `() => Date.now()`. Used only for decay.
   * @param {string[]} [options.activePool] - Canonical fact ids currently being
   *   practised; defaults to all 36. Normalized by `_normalizePool`.
   */
  constructor(options = {}) {
    const opts = _isPlainObject(options) ? options : {}

    /** @type {string} @private */
    this._trailId = normalizeTrailId(opts.trailId)

    /** @type {() => number} @private */
    this._now = typeof opts.now === "function" ? opts.now : () => Date.now()

    /** @type {string[]} The active fact pool, normalized. @private */
    this._activePool = _normalizePool(opts.activePool)

    /** @type {Set<string>} Membership test for the active pool. @private */
    this._activeSet = new Set(this._activePool)

    /** @type {string[]} Every fact the trail owns, pool or no pool. @private */
    this._trailFactIds = factIdsForTrail(this._trailId)

    /** @type {string[]} The trail's facts that are also in the pool. @private */
    this._activeFactIds = this._trailFactIds.filter((id) => this._activeSet.has(id))

    /** @type {number} @private */
    this._totalSpaces = TRAIL.SPACES_PER_FACT * this._activeFactIds.length
  }

  /**
   * A token at the start of a trail.
   * @returns {Trail} `{ space: 0 }`, a new object every call
   */
  static createTrail() {
    return { space: 0 }
  }

  /**
   * Coerce untrusted persisted data into a valid position, with no knowledge of
   * how long any particular trail is.
   *
   * Static, so storage.js can sanitise a save without building a `Journey` per
   * trail. It clamps only the lower bound and a hard ceiling; the real upper
   * bound depends on the pool, so `clampToTrail` is the instance method that
   * knows it. A save holding a space past the end of a now-shorter trail is not
   * corruption -- it is a player who narrowed her tables.
   * @param {unknown} raw - Anything at all, typically a parsed JSON value
   * @returns {Trail} A new, valid trail with a non-negative integer `space`
   */
  static normalizeTrail(raw) {
    if (!_isPlainObject(raw)) return Journey.createTrail()
    if (!Number.isFinite(raw.space)) return Journey.createTrail()
    return { space: Math.min(Journey.MAX_SPACE, Math.max(0, Math.floor(raw.space))) }
  }

  /**
   * The longest any trail can be: every fact of the largest trail, in the
   * widest pool. A ceiling for `normalizeTrail`, which cannot know the pool.
   * @type {number}
   */
  static MAX_SPACE = TRAIL.SPACES_PER_FACT * FACT_IDS.length

  /**
   * Bring a position inside THIS trail. Separate from `normalizeTrail` because
   * only an instance knows how long the trail is.
   * @param {unknown} raw - A persisted or in-memory position
   * @returns {Trail} A new position within [0, totalSpaces - 1], or `{space: 0}`
   *   for an unavailable trail
   */
  clampToTrail(raw) {
    const { space } = Journey.normalizeTrail(raw)
    if (this._totalSpaces === 0) return { space: 0 }
    return { space: Math.min(space, this._totalSpaces - 1) }
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
   * How many spaces this trail has: SPACES_PER_FACT per ACTIVE fact, so it
   * shortens with a narrower pool. 0 when the pool contains none of its facts.
   * @returns {number} The trail's length in spaces
   */
  get totalSpaces() {
    return this._totalSpaces
  }

  /**
   * The fact ids this journey gates on: the trail's facts that are in the pool.
   * @returns {string[]} A copy, so mutating it cannot change the gating
   */
  get activeFactIds() {
    return [...this._activeFactIds]
  }

  /**
   * Every fact the trail owns, pool or no pool. This is what the mastery map
   * and the card collection show for a trail.
   * @returns {string[]} A copy
   */
  get factIds() {
    return [...this._trailFactIds]
  }

  /**
   * The fact ids in the whole active pool, not just this trail's.
   * @returns {string[]} A copy
   */
  get activePool() {
    return [...this._activePool]
  }

  /**
   * This trail's status: how much of it is strong, how long it is, and how far
   * the token may stand.
   * @param {Object<string, import("./MasteryModel.js").MasteryRecord>} [records] -
   *   factId -> record; missing entries are treated as never asked
   * @returns {TrailProgress} The trail's status
   */
  progress(records) {
    const now = this._now()
    const source = _isPlainObject(records) ? records : {}
    let strong = 0
    let mastered = 0
    for (const factId of this._activeFactIds) {
      const record = source[factId] ?? createRecord()
      // The cap reads UNLOCK_MIN_STRENGTH; `mastered` is carried alongside for
      // the collection and the milestones, and is always a subset of `strong`.
      if (decayedStrength(record, now) >= TRAIL.UNLOCK_MIN_STRENGTH) strong += 1
      if (isMastered(record, now)) mastered += 1
    }
    const total = this._activeFactIds.length
    return {
      trailId: this._trailId,
      total,
      strong,
      mastered,
      totalSpaces: this._totalSpaces,
      cap: this._capFrom(strong),
      fraction: total === 0 ? 0 : strong / total,
      complete: total > 0 && strong === total,
      unavailable: total === 0,
    }
  }

  /**
   * The furthest space the token may currently occupy.
   *
   * FREE_SPACES with nothing practised, so a brand-new player's token moves in
   * the first minute, and the whole trail once every active fact is strong --
   * see the arithmetic in the module header for why that is guaranteed.
   *
   * Recomputed from current strength on every call, so it can shrink as strength
   * decays. `advance` is what stops that shrinking from dragging the token
   * backwards.
   * @param {Object<string, import("./MasteryModel.js").MasteryRecord>} [records] -
   *   factId -> record
   * @returns {number} A space index in [0, totalSpaces - 1], or 0 when unavailable
   */
  lastUnlockedSpace(records) {
    return this.progress(records).cap
  }

  /**
   * Move the token forward, capped by the strength gate.
   *
   * Returns a NEW trail; the `trail` argument is never mutated, so THE CALLER
   * MUST ASSIGN `result.trail`. Dropping it fails silently: the game keeps
   * scoring, the token never moves, and nothing reports an error.
   *
   * The token never moves backwards. `cap` is derived from current strength and
   * can fall below the token's current space after a long absence; clamping with
   * `Math.max(from.space, ...)` means the token holds still and `blocked`
   * explains why, instead of the next correct answer visibly demoting the player.
   * @param {Trail} trail - Current position; normalized, never mutated
   * @param {number} spaces - How far to move; floored to a non-negative integer
   * @param {Object<string, import("./MasteryModel.js").MasteryRecord>} [records] -
   *   factId -> record, for the cap calculation
   * @returns {AdvanceResult} The new position plus why it stopped where it did
   */
  advance(trail, spaces, records) {
    const from = this.clampToTrail(trail)
    const steps = Number.isFinite(spaces) ? Math.max(0, Math.floor(spaces)) : 0
    const cap = this.lastUnlockedSpace(records)
    const last = Math.max(0, this._totalSpaces - 1)

    if (steps === 0 || this._totalSpaces === 0) {
      return { trail: from, blocked: false, finished: false, spacesMoved: 0 }
    }

    const target = from.space + steps
    const space = Math.max(from.space, Math.min(target, cap))
    return {
      trail: { space },
      blocked: target > cap,
      finished: space === last && from.space !== last,
      spacesMoved: space - from.space,
    }
  }

  /**
   * Whether this trail is finished: the token is on the last space and every
   * active fact is strong. An unavailable trail is never complete -- there is
   * nothing in it to complete.
   * @param {Trail} trail - Current position
   * @param {Object<string, import("./MasteryModel.js").MasteryRecord>} [records] -
   *   factId -> record
   * @returns {boolean} True when the trail is done
   */
  isTrailComplete(trail, records) {
    if (this._totalSpaces === 0) return false
    if (this.clampToTrail(trail).space !== this._totalSpaces - 1) return false
    return this.progress(records).complete
  }

  /**
   * The cap for a given count of strong facts, clamped to the trail.
   * @private
   * @param {number} strong - How many active facts are at UNLOCK_MIN_STRENGTH
   * @returns {number} A space index in [0, totalSpaces - 1]
   */
  _capFrom(strong) {
    if (this._totalSpaces === 0) return 0
    const opened = TRAIL.FREE_SPACES + TRAIL.SPACES_PER_STRONG_FACT * strong
    return Math.min(this._totalSpaces - 1, opened)
  }
}

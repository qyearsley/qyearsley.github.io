/**
 * Journey for Times Trail
 * The visible progression: a 40-space trail divided into 8 regions of 5 spaces
 * each, the token that walks it, and the gates between regions.
 *
 * Architecture: three separate ideas, kept separate on purpose.
 *
 * 1. Region ownership is structural. A region owns every canonical fact whose
 *    LARGER operand equals its table, so each of the 36 facts belongs to exactly
 *    one region and region sizes run 1, 2, 3, 4, 5, 6, 7, 8 -- the trail ends in
 *    the hard neighbourhood. This partition never depends on settings, and it is
 *    what the mastery map and the collection read.
 * 2. Gating is scoped to the ACTIVE FACT POOL. A `Journey` is constructed with
 *    the pool the player is actually practising, and a region's unlock
 *    requirement counts only the facts in *both* the region and that pool. A
 *    region whose intersection with the pool is empty is SKIPPED: it counts as
 *    complete and never blocks the regions behind it. Without this the trail is
 *    dead in normal play -- Spider Woods would need 5 of its 7 table-8 facts
 *    strong while a pool of tables 2-7 never asks a single one, so the cap froze
 *    at space 34, and a pool of tables [6, 7] froze at space 4 because Doubling
 *    Meadow's only fact, 2x2, is outside it. Every table selection must be able
 *    to reach space 39; the test suite asserts that per pool.
 * 3. Gating is strength-driven, never answer-driven. A region opens when enough
 *    of its active facts have reached TRAIL.UNLOCK_MIN_STRENGTH, not when enough
 *    questions have been answered. That is deliberate: an answer-count gate can
 *    be walked by grinding 2x2 four hundred times, which teaches nothing and
 *    hands out the whole trail. With a strength gate, grinding one fact unlocks
 *    exactly the region that owns it and the next one, and then stops.
 *
 *    The bar is TRAIL.UNLOCK_MIN_STRENGTH (3, "strengthening"), NOT
 *    STRENGTH.MASTERED_MIN (4). Mastery means fluent recall and is the right bar
 *    for a foiled card; it is the wrong bar for movement, because a child who is
 *    reliably correct but still counting up would watch a frozen token for
 *    weeks. `RegionProgress` reports both counts: `strong` gates, `mastered` is
 *    what the collection and the `mastered-*` milestones read.
 *
 * The first region on the trail carries no gate at all -- see `_isStartRegion`.
 *
 * Because gating reads decayed strength, the unlock cap is recomputed from
 * current strength on every call and can legitimately SHRINK -- a player away for
 * a month comes back to weaker facts and fewer complete regions. `advance`
 * therefore clamps with `Math.max(currentSpace, ...)`: the token never moves
 * backwards. Losing visible progress is where children quit, so the token holds
 * still and the `blocked` flag explains why instead.
 *
 * Purity: no DOM, no storage, no timers. The clock is the injected `now`. No
 * method mutates its arguments -- in particular `advance` returns a NEW trail
 * object and does not touch the one it was given, so THE CALLER MUST ASSIGN THE
 * RESULT (`progress.trail = journey.advance(progress.trail, 1, records).trail`).
 * Dropping the return value is silent: every answer looks scored, the token
 * never moves, and the whole trail feature is dead with nothing in the logs.
 * That is exactly the class of bug this module was reviewed for.
 *
 * There are no laps. Space 39 is the end of the trail; there is no wraparound,
 * no `lapsCompleted` field, and no `lapCompleted` flag. Walking the trail again
 * is a Phase 2 concern (new regions, not a modulo).
 */

import { REGIONS, TRAIL } from "./constants.js"
import { FACT_IDS, factsForRegionTable, getFact, parseFactId } from "./facts.js"
import { createRecord, decayedStrength, isMastered } from "./MasteryModel.js"

/**
 * One region of the trail. Shape mirrors the frozen entries of REGIONS.
 * @typedef {Object} Region
 * @property {string} id     - Kebab-case identifier, e.g. "beehive-hollow"
 * @property {string} name   - Display name, e.g. "Beehive Hollow"
 * @property {number} table  - The times table the region owns (2-9)
 * @property {string} emoji  - Region glyph for the trail map
 * @property {number} spaces - How many trail spaces the region occupies
 */

/**
 * The token's position on the trail. Deliberately one field: there is no
 * `lapsCompleted`, because space 39 is the end of the trail.
 * @typedef {Object} Trail
 * @property {number} space - 0-based space index, 0 .. TRAIL.TOTAL_SPACES - 1
 */

/**
 * A region's gate status, scoped to the active fact pool.
 *
 * `strong` is the gate's currency and `mastered` is the collection's; they are
 * reported separately rather than collapsed, because a UI that says "master 2
 * more facts" while the gate actually counts strengthening facts is telling the
 * player to do the wrong thing.
 * @typedef {Object} RegionProgress
 * @property {string} regionId  - The region's id
 * @property {number} total     - Facts owned by the region AND in the active pool
 * @property {number} strong    - Of those, how many are at TRAIL.UNLOCK_MIN_STRENGTH
 *                                or better: the count the gate compares to `required`
 * @property {number} mastered  - Of those, how many are at STRENGTH.MASTERED_MIN or
 *                                better. Informational here; it is what the card
 *                                collection and the `mastered-*` milestones read.
 *                                Always <= `strong`.
 * @property {number} required  - ceil(TRAIL.UNLOCK_FRACTION * total); 0 when total is
 *                                0 and 0 for the start region, which has no gate
 * @property {number} fraction  - strong / total in 0..1; 1 when total is 0
 * @property {boolean} complete - strong >= required (so always true when required is 0)
 * @property {boolean} skipped  - total === 0: no fact of this region is in the active pool
 * @property {boolean} unlocked - Whether the region itself is reachable
 */

/**
 * The outcome of one `advance` call. `trail` is a NEW object; assign it.
 *
 * There is deliberately no `blockedRegionId`. It used to report the locked region
 * *ahead* of the gate, which is the one region whose facts do nothing to open it:
 * fed to a gate message it produced "Master 2 more facts in Triple Bridge" when
 * the truth was "1 more fact in Doubling Meadow". `gatingRegionId` is the field a
 * gate message wants.
 * @typedef {Object} AdvanceResult
 * @property {Trail} trail                  - The new position (never the input object)
 * @property {boolean} blocked              - Movement was capped by a locked region
 * @property {string|null} gatingRegionId   - The first INCOMPLETE region: the one the
 *                                            token is standing in (or held at the edge
 *                                            of) and whose facts actually open the next
 *                                            gate. null when every region is complete,
 *                                            which is the only way the trail can end.
 *                                            Reported whether or not `blocked` is set.
 * @property {string|null} enteredRegionId  - Region newly entered by this advance, or null
 * @property {number} spacesMoved           - space after minus space before, always >= 0
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
 * technically be consistent -- every region skipped, so the whole trail opens at
 * once -- but it is useless, and Settings.factPool already guarantees a
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
 * The trail, its regions, and the strength gates between them.
 *
 * Every instance is bound to one active fact pool. When the player changes
 * the tables in play, game.js builds a new `Journey` rather than
 * mutating this one -- the pool is what gating means, so it is not a setter.
 */
export class Journey {
  /**
   * @param {Object} [options] - Construction options
   * @param {Region[]} [options.regions] - Region table; defaults to REGIONS. A
   *   non-array or empty value falls back to REGIONS.
   * @param {() => number} [options.now] - Injected clock returning epoch ms;
   *   defaults to `() => Date.now()`. Used only for decay inside `isMastered`.
   * @param {string[]} [options.activePool] - Canonical fact ids currently being
   *   practised; defaults to all 36. Normalized by `_normalizePool`.
   */
  constructor(options = {}) {
    const opts = _isPlainObject(options) ? options : {}
    const regions = Array.isArray(opts.regions) && opts.regions.length > 0 ? opts.regions : REGIONS

    /** @type {Region[]} A shallow copy, so a caller cannot reshape the trail later. */
    this._regions = [...regions]

    /** @type {() => number} @private */
    this._now = typeof opts.now === "function" ? opts.now : () => Date.now()

    /** @type {string[]} The active fact pool, normalized. @private */
    this._activePool = _normalizePool(opts.activePool)

    /** @type {Set<string>} Membership test for the active pool. @private */
    this._activeSet = new Set(this._activePool)

    /** @type {Map<string, number>} regionId -> index in `_regions`. @private */
    this._indexById = new Map(this._regions.map((region, index) => [region.id, index]))

    /** @type {Map<string, string[]>} regionId -> the fact ids it structurally owns. @private */
    this._factIdsByRegion = new Map(
      this._regions.map((region) => [
        region.id,
        factsForRegionTable(region.table).map((fact) => fact.id),
      ]),
    )

    /** @type {number[]} Index k holds the first space of region k. @private */
    this._startSpaces = []
    let cursor = 0
    for (const region of this._regions) {
      this._startSpaces.push(cursor)
      cursor += region.spaces
    }

    /** @type {number} Sum of every region's `spaces`. @private */
    this._totalSpaces = cursor
  }

  /**
   * A token at the start of the trail. Exactly one field -- no `lapsCompleted`.
   * @returns {Trail} `{ space: 0 }`, a new object every call
   */
  static createTrail() {
    return { space: 0 }
  }

  /**
   * Coerce untrusted persisted data into a valid trail. Never throws. A
   * `lapsCompleted` key from a save written before laps were cut is ignored and
   * not copied through.
   * @param {unknown} raw - Anything at all, typically a parsed JSON value
   * @returns {Trail} A new, valid trail with `space` in [0, TRAIL.TOTAL_SPACES - 1]
   */
  static normalizeTrail(raw) {
    if (!_isPlainObject(raw)) return Journey.createTrail()
    if (!Number.isFinite(raw.space)) return Journey.createTrail()
    const space = Math.floor(raw.space)
    return { space: Math.min(TRAIL.TOTAL_SPACES - 1, Math.max(0, space)) }
  }

  /**
   * How many spaces the trail has, summed from the region table.
   * @returns {number} 40 for the shipped REGIONS
   */
  get totalSpaces() {
    return this._totalSpaces
  }

  /**
   * The fact ids this journey gates on.
   * @returns {string[]} A copy, so mutating it cannot change the gating
   */
  get activePool() {
    return [...this._activePool]
  }

  /**
   * Every region, in walking order.
   * @returns {Region[]} A copy of the region list
   */
  getRegions() {
    return [...this._regions]
  }

  /**
   * Look up a region by id.
   * @param {string} regionId - Region id, e.g. "rainbow-ridge"
   * @returns {Region|null} The region, or null when unknown
   */
  getRegion(regionId) {
    const index = this._indexById.get(regionId)
    return index === undefined ? null : this._regions[index]
  }

  /**
   * Which region owns a fact. Structural: the region whose table equals the
   * fact's LARGER operand, regardless of the active pool.
   * @param {string} factId - Canonical fact id, e.g. "6x7"
   * @returns {Region|null} The owning region, or null for an unknown or
   *   non-canonical id ("8x7")
   */
  regionForFactId(factId) {
    const fact = getFact(factId)
    if (fact === null) return null
    return this._regions.find((region) => region.table === fact.b) ?? null
  }

  /**
   * Every fact the region structurally owns, in FACTS order. Pool-independent:
   * this is what the mastery map and the collection show.
   * @param {string} regionId - Region id
   * @returns {string[]} A new array of canonical ids; [] for an unknown region
   */
  factIdsForRegion(regionId) {
    const ids = this._factIdsByRegion.get(regionId)
    return ids === undefined ? [] : [...ids]
  }

  /**
   * The region's facts that are also in the active pool, in FACTS order. This
   * is what GATING uses, everywhere, without exception.
   * @param {string} regionId - Region id
   * @returns {string[]} A new array of canonical ids; [] for an unknown region
   *   or an empty intersection (a skipped region)
   */
  activeFactIdsForRegion(regionId) {
    const ids = this._factIdsByRegion.get(regionId)
    if (ids === undefined) return []
    return ids.filter((factId) => this._activeSet.has(factId))
  }

  /**
   * The first trail space belonging to a region: 0, 5, 10, ... 35.
   * @param {string} regionId - Region id
   * @returns {number} The starting space, or -1 for an unknown region
   */
  regionStartSpace(regionId) {
    const index = this._indexById.get(regionId)
    return index === undefined ? -1 : this._startSpaces[index]
  }

  /**
   * Which region a trail space belongs to.
   * @param {number} spaceIndex - 0-based space index
   * @returns {Region|null} The region, or null outside [0, totalSpaces)
   */
  regionForSpace(spaceIndex) {
    if (!Number.isInteger(spaceIndex)) return null
    if (spaceIndex < 0 || spaceIndex >= this._totalSpaces) return null
    for (let index = 0; index < this._regions.length; index += 1) {
      if (spaceIndex < this._startSpaces[index] + this._regions[index].spaces) {
        return this._regions[index]
      }
    }
    return null
  }

  /**
   * A region's gate status, scoped to the active pool.
   *
   * A region with no active facts reports `skipped: true`, `complete: true` and
   * `fraction: 1` -- not applicable, rather than 0% done. A progress ring
   * showing 0% on a region the player can never fill would be a lie.
   * @param {string} regionId - Region id
   * @param {Object<string, import("./MasteryModel.js").MasteryRecord>} [records] -
   *   factId -> record; missing entries are treated as never asked
   * @returns {RegionProgress} The region's status; an all-zero object with
   *   `complete: false` and `skipped: false` for an unknown region, because an
   *   unknown region is an error rather than a skip
   */
  regionProgress(regionId, records) {
    const index = this._indexById.get(regionId)
    if (index === undefined) {
      return {
        regionId,
        total: 0,
        strong: 0,
        mastered: 0,
        required: 0,
        fraction: 0,
        complete: false,
        skipped: false,
        unlocked: false,
      }
    }
    return {
      ...this._progressAt(index, records),
      unlocked: this.isRegionUnlocked(regionId, records),
    }
  }

  /**
   * Every region's gate status, in walking order.
   * @param {Object<string, import("./MasteryModel.js").MasteryRecord>} [records] -
   *   factId -> record
   * @returns {RegionProgress[]} One entry per region
   */
  allRegionProgress(records) {
    const lastUnlocked = this._lastUnlockedIndex(records)
    return this._regions.map((region, index) => ({
      ...this._progressAt(index, records),
      unlocked: index <= lastUnlocked,
    }))
  }

  /**
   * Whether a region is reachable. Region 0 always is; region k is reachable
   * only when EVERY region before it is complete. Because a pool-empty region
   * is complete, skipped regions never block what follows them.
   * @param {string} regionId - Region id
   * @param {Object<string, import("./MasteryModel.js").MasteryRecord>} [records] -
   *   factId -> record
   * @returns {boolean} True when reachable; false for an unknown region
   */
  isRegionUnlocked(regionId, records) {
    const index = this._indexById.get(regionId)
    if (index === undefined) return false
    return index <= this._lastUnlockedIndex(records)
  }

  /**
   * The unlocked prefix of the trail, in walking order. Includes skipped
   * regions, because they really are reachable -- the token walks straight
   * through them. Anything counting *achievement* wants `earnedRegionIds`.
   * @param {Object<string, import("./MasteryModel.js").MasteryRecord>} [records] -
   *   factId -> record
   * @returns {string[]} Ids of the reachable regions; never empty
   */
  unlockedRegionIds(records) {
    const lastUnlocked = this._lastUnlockedIndex(records)
    return this._regions.slice(0, lastUnlocked + 1).map((region) => region.id)
  }

  /**
   * The unlocked regions the player actually earned: reachable AND holding at
   * least one active fact. This is the count a milestone or a progress readout
   * wants, and `unlockedRegionIds().length` is not.
   *
   * Why: a skipped region (no fact of its table is in the active pool) counts as
   * complete, which is both correct and necessary -- otherwise a narrow custom
   * pool walls the token off. But it means the default custom tables [6, 7] make
   * five regions "unlocked" before the player has answered a single question,
   * which handed out the `regions-4` gem ("Halfway along the trail") on the very
   * first answer.
   *
   * Consequence worth knowing: on a pool narrow enough to leave fewer than four
   * regions with facts in it -- a single custom table, say -- a four-region
   * milestone becomes unreachable. That is the honest answer; the player has not
   * walked half a trail of content that is not in her pool.
   * @param {Object<string, import("./MasteryModel.js").MasteryRecord>} [records] -
   *   factId -> record
   * @returns {string[]} Ids of the reachable, non-skipped regions, in walking
   *   order; may be empty
   */
  earnedRegionIds(records) {
    const lastUnlocked = this._lastUnlockedIndex(records)
    return this._regions
      .slice(0, lastUnlocked + 1)
      .filter((_region, index) => !this._progressAt(index, records).skipped)
      .map((region) => region.id)
  }

  /**
   * The furthest space the token may currently occupy: the last space of the
   * last unlocked region. 9 with nothing practised -- the start region carries no
   * gate, so the first two regions are open from the beginning -- and
   * totalSpaces - 1 (39) once every non-skipped region is complete.
   *
   * Recomputed from current strength on every call, so it can shrink as strength
   * decays. `advance` is what stops that shrinking from dragging the token
   * backwards.
   * @param {Object<string, import("./MasteryModel.js").MasteryRecord>} [records] -
   *   factId -> record
   * @returns {number} A space index in [0, totalSpaces - 1]
   */
  lastUnlockedSpace(records) {
    const index = this._lastUnlockedIndex(records)
    return this._startSpaces[index] + this._regions[index].spaces - 1
  }

  /**
   * Move the token forward, capped by the unlock gate.
   *
   * Returns a NEW trail; the `trail` argument is never mutated, so THE CALLER
   * MUST ASSIGN `result.trail`. Dropping it fails silently: the game keeps
   * scoring, the token never moves, and nothing reports an error.
   *
   * The token never moves backwards. `cap` is derived from current strength and
   * can fall below the token's current space after a long absence; clamping with
   * `Math.max(t.space, ...)` means the token holds still and `blocked` explains
   * why, instead of the next correct answer visibly demoting the player.
   *
   * `result.gatingRegionId` is what a "held at the gate" message should name: the
   * first incomplete region, whose facts are the ones that open the way. It is
   * NOT the locked region ahead -- naming that one tells the player to practise
   * facts she has not been offered yet.
   * @param {Trail} trail - Current position; normalized, never mutated
   * @param {number} spaces - How far to move; floored to a non-negative integer
   * @param {Object<string, import("./MasteryModel.js").MasteryRecord>} [records] -
   *   factId -> record, for the gate calculation
   * @returns {AdvanceResult} The new position plus why it stopped where it did
   */
  advance(trail, spaces, records) {
    const from = Journey.normalizeTrail(trail)
    const steps = Number.isFinite(spaces) ? Math.max(0, Math.floor(spaces)) : 0
    const firstIncomplete = this._firstIncompleteIndex(records)
    const gatingRegionId = firstIncomplete === -1 ? null : this._regions[firstIncomplete].id
    if (steps === 0) {
      return {
        trail: from,
        blocked: false,
        gatingRegionId,
        enteredRegionId: null,
        spacesMoved: 0,
      }
    }

    const fromRegionId = this.regionForSpace(from.space)?.id ?? null
    const target = from.space + steps
    const lastUnlocked = firstIncomplete === -1 ? this._regions.length - 1 : firstIncomplete
    const cap = this._startSpaces[lastUnlocked] + this._regions[lastUnlocked].spaces - 1
    const space = Math.max(from.space, Math.min(target, cap))
    const toRegionId = this.regionForSpace(space)?.id ?? null

    return {
      trail: { space },
      blocked: target > cap,
      gatingRegionId,
      enteredRegionId: toRegionId !== fromRegionId ? toRegionId : null,
      spacesMoved: space - from.space,
    }
  }

  /**
   * Whether the trail is finished: every region complete and the token standing
   * on the last space. Skipped regions and the gate-free start region count as
   * complete. No lap clause.
   * @param {Trail} trail - Current position
   * @param {Object<string, import("./MasteryModel.js").MasteryRecord>} [records] -
   *   factId -> record
   * @returns {boolean} True when the trail is done
   */
  isTrailComplete(trail, records) {
    if (Journey.normalizeTrail(trail).space !== this._totalSpaces - 1) return false
    return this._firstIncompleteIndex(records) === -1
  }

  /**
   * A region's pool-scoped progress, without the `unlocked` field. Split out so
   * `isRegionUnlocked` can ask about completeness without recursing back through
   * `regionProgress`.
   * @private
   * @param {number} index - Region index in `_regions`
   * @param {Object<string, import("./MasteryModel.js").MasteryRecord>} [records] -
   *   factId -> record
   * @returns {Omit<RegionProgress, "unlocked">} The region's pool-scoped progress
   */
  _progressAt(index, records) {
    const region = this._regions[index]
    const ids = this.activeFactIdsForRegion(region.id)
    const total = ids.length
    const now = this._now()
    const source = _isPlainObject(records) ? records : {}
    let strong = 0
    let mastered = 0
    for (const factId of ids) {
      const record = source[factId] ?? createRecord()
      // The gate reads UNLOCK_MIN_STRENGTH; `mastered` is carried alongside for
      // the collection and the milestones, and is always a subset of `strong`.
      if (decayedStrength(record, now) >= TRAIL.UNLOCK_MIN_STRENGTH) strong += 1
      if (isMastered(record, now)) mastered += 1
    }
    const required = this._isStartRegion(index) ? 0 : Math.ceil(TRAIL.UNLOCK_FRACTION * total)
    return {
      regionId: region.id,
      total,
      strong,
      mastered,
      required,
      fraction: total === 0 ? 1 : strong / total,
      complete: strong >= required,
      skipped: total === 0,
    }
  }

  /**
   * Whether this is the region the token starts in, which carries no gate.
   *
   * Stated as "the region that owns space 0" rather than "index 0" so it stays
   * true if the region table is ever reordered or extended: the rule is about
   * the shape of the trail, not about a hardcoded region id.
   *
   * Why it is free: every other gate stands between the player and ground she
   * has not walked, and she opens it with the facts of the region she is already
   * standing in. The start region's gate is the only one she meets having
   * practised nothing at all, so requiring strength there means a token that
   * cannot move on her first session. It is also the smallest region -- Doubling
   * Meadow owns exactly one fact, 2x2, because 2 is the larger operand of no
   * other canonical fact -- and a 21-fact pool serves that one fact about once
   * every twenty questions, so the token sat on space 4 for six to eight
   * sessions of daily play. A brand-new player now walks the first nine spaces
   * immediately and meets her first real gate at the edge of Triple Bridge.
   * @private
   * @param {number} index - Region index in `_regions`
   * @returns {boolean} True for the region containing the trail's first space
   */
  _isStartRegion(index) {
    return this._startSpaces[index] === 0
  }

  /**
   * Index of the first incomplete region, or -1 when every region is complete.
   * This is the region whose facts open the next gate.
   * @private
   * @param {Object<string, import("./MasteryModel.js").MasteryRecord>} [records] -
   *   factId -> record
   * @returns {number} An index into `_regions`, or -1
   */
  _firstIncompleteIndex(records) {
    for (let index = 0; index < this._regions.length; index += 1) {
      if (!this._progressAt(index, records).complete) return index
    }
    return -1
  }

  /**
   * Index of the last reachable region: the first incomplete region, or the last
   * region when every one of them is complete. The unlocked set is always a
   * prefix, which is why one index describes it.
   *
   * The first incomplete region is itself unlocked -- the player has to be able
   * to stand in a region to practise its facts.
   * @private
   * @param {Object<string, import("./MasteryModel.js").MasteryRecord>} [records] -
   *   factId -> record
   * @returns {number} An index into `_regions`
   */
  _lastUnlockedIndex(records) {
    const firstIncomplete = this._firstIncompleteIndex(records)
    return firstIncomplete === -1 ? this._regions.length - 1 : firstIncomplete
  }
}

/**
 * FactSelector for Times Trail
 * Decides which fact is asked next: the 70/30 weak-vs-strong bucket draw, the
 * no-immediate-repeat rule, and the re-ask queue for facts just missed. This is
 * the module where the game's spaced repetition actually happens -- MasteryModel
 * supplies the per-fact numbers, and this turns them into an order.
 *
 * Architecture: one selection is three decisions, taken in this order.
 *
 *   1. Retry queue. A fact she just got wrong comes back a few questions later,
 *      while the correction is still fresh. A queue hit short-circuits
 *      everything below it and consumes no randomness at all.
 *   2. Bucket. Split the pool into "weak or due" and "strong", then choose a
 *      bucket with one rng call: SELECTION.WEAK_RATIO (0.7) of draws take the
 *      weak bucket. An empty bucket falls back to the other one.
 *   3. Position. Inside the chosen bucket, draw weighted by
 *      MasteryModel.selectionWeight with one more rng call, so the weakest and
 *      most overdue facts come up most often.
 *
 * Why 30% of draws are facts she already knows. This is not an efficiency
 * choice -- a purely information-greedy selector would ask nothing but weak
 * facts, and would move strengths faster. It is a choice about what practice
 * feels like from the inside. A session made only of the facts she cannot do is
 * a session of being wrong, and that is where an eight-year-old quits. Facts she
 * owns give the run a rhythm of success between the hard ones, let a streak
 * actually build, and turn "I am bad at this" into "I know most of these and I
 * am working on a few". The 30% earns its keep twice over: it is also the only
 * way a mastered fact is ever checked again, so retention is observed instead of
 * assumed and the long tail of STRENGTH_INTERVALS_MS stays honest.
 *
 * Determinism: every random choice comes from the injected `rng` and every
 * timestamp from the injected `now`. The RNG contract, which the tests depend on:
 *
 *   - a retry-queue hit consumes ZERO rng calls
 *   - a normal selection consumes EXACTLY TWO, in order: bucket, then position
 *   - `recordMiss` consumes EXACTLY ONE
 *   - a rejected `pool` (not a non-empty array) consumes ZERO
 *
 * The bucket call is made before any emptiness check, so a fallback draw costs
 * the same two calls as an ordinary one and a test never has to know which
 * branch it took.
 *
 * Purity: this class holds session state (last fact, question counter, retry
 * queue) and nothing else. It never touches the DOM, storage, or setTimeout.
 */

import { SELECTION, STRENGTH } from "./constants.js"
import { createRecord, decayedStrength, isDue, selectionWeight } from "./MasteryModel.js"

/**
 * One fact waiting to be re-asked after a miss.
 *
 * @typedef {Object} RetryEntry
 * @property {string} factId    - Canonical fact id, e.g. "6x7"
 * @property {number} dueIndex  - Question index at or after which the fact is re-asked
 */

/**
 * Whether a value can be read as a record map or an options bag.
 * @private
 * @param {unknown} value - Value to test
 * @returns {boolean} True for a non-null, non-array object
 */
function _isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

/**
 * The record for a fact, or a fresh one when the map has no entry. A fact with
 * no record has never been asked, which is exactly what `createRecord()` means,
 * so first-run selection needs no special case. Own-property lookup only, so an
 * inherited key can never masquerade as a saved record.
 * @private
 * @param {unknown} records - factId -> MasteryRecord map, or anything at all
 * @param {string} factId - Canonical fact id
 * @returns {import("./MasteryModel.js").MasteryRecord} The stored record, or a fresh one
 */
function _recordFor(records, factId) {
  if (_isPlainObject(records) && Object.prototype.hasOwnProperty.call(records, factId)) {
    const record = records[factId]
    if (_isPlainObject(record)) return record
  }
  return createRecord()
}

export class FactSelector {
  /**
   * @param {Object} [options] - Injection points; both default to production behavior
   * @param {() => number} [options.rng] - Returns a number in [0, 1); defaults to Math.random
   * @param {() => number} [options.now] - Returns epoch ms; defaults to () => Date.now()
   */
  constructor(options = {}) {
    const { rng, now } = _isPlainObject(options) ? options : {}
    /** @type {() => number} @private */
    this._rng = typeof rng === "function" ? rng : Math.random
    /** @type {() => number} @private */
    this._now = typeof now === "function" ? now : () => Date.now()
    /** @type {string|null} Most recently served fact id, for the no-repeat rule. @private */
    this._lastFactId = null
    /** @type {RetryEntry[]} Ascending by dueIndex; stable for ties. @private */
    this._retryQueue = []
    /** @type {number} Facts served since the last reset(). @private */
    this._questionIndex = 0
  }

  /**
   * How many facts have been served since the last `reset()`. Also the index
   * `recordMiss` measures its delay from.
   * @returns {number} A non-negative integer
   */
  get questionIndex() {
    return this._questionIndex
  }

  /**
   * The most recently served fact id, or null before the first selection of the
   * session.
   * @returns {string|null} The fact id
   */
  get lastFactId() {
    return this._lastFactId
  }

  /**
   * Choose the next fact to ask.
   *
   * Order of business: a due retry-queue entry wins outright (zero rng calls);
   * otherwise the pool is split into a weak/due bucket and a strong bucket, one
   * bucket is drawn with probability SELECTION.WEAK_RATIO, and one fact is drawn
   * from it weighted by `selectionWeight` (two rng calls, bucket then position).
   *
   * No fact is ever served twice in a row -- the previous fact is removed from
   * the candidate list before the buckets are built. The one exception is a pool
   * of a single fact, where an immediate repeat is unavoidable: rather than
   * return null and stall the session, the selector serves that fact again,
   * every time, and `lastFactId` simply stays put. Facts in `records` that are
   * not in `pool` are ignored entirely; facts in `pool` with no record are
   * treated as brand new, which lands them in the weak bucket.
   *
   * @param {string[]} pool - Canonical fact ids currently being practiced
   * @param {Object<string, import("./MasteryModel.js").MasteryRecord>} [records] - factId -> record
   * @returns {string|null} A fact id from `pool`, or null when `pool` is not a non-empty array
   */
  selectNext(pool, records) {
    if (!Array.isArray(pool) || pool.length === 0) return null
    const now = this._now()

    const queued = this._takeDueRetry(pool)
    if (queued !== null) return this._serve(queued)

    // No immediate repeat. Falling back to the whole pool can only happen when
    // the pool holds nothing but the last fact, i.e. a single-fact pool.
    const withoutLast = pool.filter((factId) => factId !== this._lastFactId)
    const candidates = withoutLast.length > 0 ? withoutLast : pool

    const { weak, strong } = this._partition(candidates, records, now)

    // One rng call, always, before any emptiness check -- so the call count does
    // not leak which bucket happened to be empty.
    const preferWeak = this._rng() < SELECTION.WEAK_RATIO
    let bucket = preferWeak ? weak : strong
    if (bucket.length === 0) bucket = preferWeak ? strong : weak

    return this._serve(this._weightedPick(bucket, records, now))
  }

  /**
   * Queue a fact for re-asking after a miss. Called AFTER the missed question
   * has been served and counted, so `questionIndex` already includes it and the
   * chosen delay reads as "the number of other questions asked in between":
   * a fact missed as question 1 with delay 3 returns as question 5.
   *
   * Consumes exactly one rng call. A second miss on the same fact updates the
   * existing entry rather than adding a duplicate, so a fact can never be queued
   * twice.
   *
   * @param {string} factId - Canonical fact id that was just missed
   * @returns {number} The chosen delay, SELECTION.RETRY_DELAY_MIN..MAX (3 or 4)
   */
  recordMiss(factId) {
    const span = SELECTION.RETRY_DELAY_MAX - SELECTION.RETRY_DELAY_MIN + 1
    const rolled = SELECTION.RETRY_DELAY_MIN + Math.floor(this._rng() * span)
    // Clamped in case an rng returns exactly 1, which is outside the contract
    // but cheap to survive.
    const delay = Math.min(SELECTION.RETRY_DELAY_MAX, Math.max(SELECTION.RETRY_DELAY_MIN, rolled))
    const dueIndex = this._questionIndex + delay

    const existing = this._retryQueue.find((entry) => entry.factId === factId)
    if (existing) {
      existing.dueIndex = dueIndex
    } else {
      this._retryQueue.push({ factId, dueIndex })
    }
    // Array.prototype.sort is stable, so ties keep insertion order.
    this._retryQueue.sort((a, b) => a.dueIndex - b.dueIndex)
    return delay
  }

  /**
   * The pending re-ask queue, for the UI and for tests.
   * @returns {RetryEntry[]} A copy, ascending by dueIndex; mutating it is harmless
   */
  peekRetryQueue() {
    return this._retryQueue.map((entry) => ({ factId: entry.factId, dueIndex: entry.dueIndex }))
  }

  /**
   * Clear all session state: the last-fact memory, the question counter, and any
   * retry entries left over from a previous session. `game.js` calls this when a
   * session starts, before the first `selectNext`. Without it a fact missed at
   * the end of one session fires immediately at the start of the next and every
   * `dueIndex` is measured from the wrong origin.
   * @returns {void}
   */
  reset() {
    this._lastFactId = null
    this._retryQueue = []
    this._questionIndex = 0
  }

  /**
   * Take the first serveable retry entry, if any. Scans ascending by dueIndex
   * and stops at the first entry that is not due yet (the queue is sorted, so
   * nothing after it can be due either).
   *
   * Two entries are skipped rather than served: one whose fact is `lastFactId`,
   * which stays queued so it fires next question instead of repeating
   * immediately, and one whose fact has left the pool because settings changed
   * mid-session, which is dropped silently.
   *
   * @private
   * @param {string[]} pool - Canonical fact ids currently being practiced
   * @returns {string|null} The fact id to serve, or null for no queue hit
   */
  _takeDueRetry(pool) {
    /** @type {RetryEntry[]} */
    const kept = []
    let chosen = null
    for (const entry of this._retryQueue) {
      const considered = chosen === null && entry.dueIndex <= this._questionIndex
      if (!considered) {
        kept.push(entry)
        continue
      }
      // Its fact is no longer in the pool, so drop the entry by keeping nothing.
      if (!pool.includes(entry.factId)) continue
      if (entry.factId === this._lastFactId) {
        kept.push(entry)
        continue
      }
      chosen = entry.factId
    }
    this._retryQueue = kept
    return chosen
  }

  /**
   * Split candidates into the weak/due bucket and the strong bucket. Every
   * candidate lands in exactly one, so the two can never both be empty when
   * `candidates` is non-empty.
   * @private
   * @param {string[]} candidates - Fact ids eligible this turn
   * @param {unknown} records - factId -> MasteryRecord map
   * @param {number} now - Epoch ms
   * @returns {{weak: string[], strong: string[]}} The two buckets, in candidate order
   */
  _partition(candidates, records, now) {
    /** @type {string[]} */
    const weak = []
    /** @type {string[]} */
    const strong = []
    for (const factId of candidates) {
      const record = _recordFor(records, factId)
      const isWeak = isDue(record, now) || decayedStrength(record, now) <= STRENGTH.WEAK_MAX
      if (isWeak) {
        weak.push(factId)
      } else {
        strong.push(factId)
      }
    }
    return { weak, strong }
  }

  /**
   * Draw one fact from a bucket, weighted by `selectionWeight`. Consumes exactly
   * one rng call. Weights are always >= 1, so the total is positive and every
   * member is reachable; the trailing return is the floating-point guard for a
   * `target` that rounds up to the total.
   * @private
   * @param {string[]} bucket - Non-empty list of fact ids
   * @param {unknown} records - factId -> MasteryRecord map
   * @param {number} now - Epoch ms
   * @returns {string} The chosen fact id
   */
  _weightedPick(bucket, records, now) {
    const weights = bucket.map((factId) => selectionWeight(_recordFor(records, factId), now))
    const total = weights.reduce((sum, weight) => sum + weight, 0)
    const target = this._rng() * total
    let accumulated = 0
    for (let index = 0; index < bucket.length; index += 1) {
      accumulated += weights[index]
      if (target < accumulated) return bucket[index]
    }
    return bucket[bucket.length - 1]
  }

  /**
   * Record a fact as served: remember it for the no-repeat rule and count it.
   * @private
   * @param {string} factId - The fact id being returned to the caller
   * @returns {string} The same fact id, for a one-line `return this._serve(...)`
   */
  _serve(factId) {
    this._lastFactId = factId
    this._questionIndex += 1
    return factId
  }
}

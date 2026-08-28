/**
 * MasteryModel for Times Trail
 * All per-fact record math: strength promotion and demotion, spaced-repetition
 * due dates, decay, mastery tiers, card art tiers, and selection weight. Never
 * touches the DOM, storage, or the wall clock.
 *
 * Architecture: a fact's memory is modelled as a Leitner box -- an integer
 * strength 0-5. A correct answer promotes the fact one box, a miss demotes it
 * (two boxes once it was already mastered, because losing a fact she had is
 * stronger evidence than never having had it), and the box index selects the
 * interval before the fact is due again (STRENGTH_INTERVALS_MS: immediate,
 * 10 minutes, 1 day, 3 days, 7 days, 21 days). Everything else in the game --
 * which entry mode a question gets, whether a region unlocks, what a card
 * looks like -- is read off that one number.
 *
 * Two properties of the model are worth stating explicitly:
 *
 * 1. Response time caps strength, it does not add to it. `responseMs` is
 *    *thinking* time: the milliseconds from the question becoming interactive
 *    to the FIRST interaction (first tile tap or first keypad keypress), never
 *    to submit, so the number of digits typed cannot change the band. A correct
 *    answer ALWAYS promotes by one box; what the band decides is the ceiling it
 *    may promote to. A "fluent" answer may climb all the way to STRENGTH.MAX,
 *    while "slow" and "counting" answers stop at STRENGTH.SLOW_CAP -- so
 *    counting up to the answer still earns progress but does not read as
 *    fluent recall. A correct answer never demotes, with one exception: a
 *    "slow" answer to a fact already above SLOW_CAP steps it down by exactly
 *    one, settling a fact that used to be fluent at 4 rather than collapsing
 *    it. Note that this leaves it AT STRENGTH.MASTERED_MIN, so a mastered fact
 *    answered slowly stays mastered; SLOW_CAP bounds where a slow answer can
 *    lift a fact TO, not where a mastered fact can be held.
 * 2. Decay is computed on read and never written back, so there is no
 *    background job and no migration. `decayedStrength` subtracts one point per
 *    full DECAY.PERIOD_MS the fact is overdue, floored at DECAY.FLOOR_SEEN for
 *    a fact ever answered correctly. Every consumer that shows or gates on
 *    strength reads the decayed value, so the mastery map, the card art, and
 *    the region gates can never disagree.
 *
 * Purity: every module-level function returns a new record and never mutates
 * its arguments. `MasteryStore` is the one deliberate exception (see its
 * docblock) because game.js must hold exactly one fact-record map.
 */

import {
  CARD_TIERS,
  DECAY,
  RESPONSE_TIME,
  SELECTION,
  STRENGTH,
  STRENGTH_INTERVALS_MS,
} from "./constants.js"

/**
 * One fact's saved memory state. Exactly six fields; there is deliberately no
 * `avgMs` (nothing read it, and a smoothed average is the wrong input for a
 * per-answer band decision) and no `streak` (the streak that pays star
 * multipliers is the session streak, owned by game.js).
 *
 * @typedef {Object} MasteryRecord
 * @property {number} strength      - Leitner box, integer 0-5
 * @property {number} totalSeen     - Times asked, >= 0
 * @property {number} totalCorrect  - Times correct, 0 <= totalCorrect <= totalSeen
 * @property {number|null} lastSeen - Epoch ms of the last answer, null if never asked
 * @property {number|null} lastMs   - Thinking time of the last CORRECT answer, null if none
 * @property {number|null} dueAt    - Epoch ms when the fact next becomes due, null if never asked
 */

/**
 * How fast the answer came, by thinking time.
 * @typedef {"fluent"|"slow"|"counting"|"unknown"} SpeedBand
 */

/**
 * Coarse mastery bucket, used for star bonuses and map labels.
 * @typedef {"new"|"weak"|"strengthening"|"mastered"} MasteryTier
 */

/**
 * Card art tier id, one of CARD_TIERS' ids.
 * @typedef {"grey"|"colored"|"foiled"} CardTierId
 */

/**
 * @typedef {Object} RecordAnswerOptions
 * @property {boolean} correct           - Whether the answer was right
 * @property {number} now                - Epoch ms; required, must be finite
 * @property {number|null} [responseMs]  - Thinking time (render -> first interaction);
 *                                         null or omitted means unmeasured
 */

/**
 * Clamp a number into an inclusive range.
 * @private
 * @param {number} value - Value to clamp
 * @param {number} min - Lower bound
 * @param {number} max - Upper bound
 * @returns {number} The clamped value
 */
function _clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

/**
 * Whether a value can be read as a record-shaped object. Arrays are rejected:
 * a persisted array where a map was expected is corruption, not data.
 * @private
 * @param {unknown} value - Value to test
 * @returns {boolean} True for a non-null, non-array object
 */
function _isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

/**
 * Read an untrusted count as a non-negative integer, defaulting to 0.
 * @private
 * @param {unknown} value - Value from a persisted record
 * @returns {number} A non-negative integer
 */
function _count(value) {
  if (!Number.isFinite(value) || value < 0) return 0
  return Math.floor(value)
}

/**
 * Read an untrusted timestamp: any finite number survives, anything else
 * becomes null (the documented "never asked" marker).
 * @private
 * @param {unknown} value - Value from a persisted record
 * @returns {number|null} The finite number, or null
 */
function _timestamp(value) {
  return Number.isFinite(value) ? value : null
}

/**
 * Read an untrusted response time: positive and finite, clamped to
 * RESPONSE_TIME.MAX_RECORDED_MS; anything else becomes null.
 * @private
 * @param {unknown} value - Value from a persisted record or an answer
 * @returns {number|null} Clamped milliseconds, or null
 */
function _responseMs(value) {
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.min(value, RESPONSE_TIME.MAX_RECORDED_MS)
}

/**
 * Read a record's persisted strength as a valid Leitner box index.
 * @private
 * @param {Object} record - A record-shaped object
 * @returns {number} Integer strength in [STRENGTH.MIN, STRENGTH.MAX]
 */
function _storedStrength(record) {
  if (!Number.isFinite(record.strength)) return STRENGTH.MIN
  return _clamp(Math.round(record.strength), STRENGTH.MIN, STRENGTH.MAX)
}

/**
 * Build a fresh record for a fact that has never been asked.
 * @returns {MasteryRecord} A new record at documented defaults
 */
export function createRecord() {
  return {
    strength: STRENGTH.MIN,
    totalSeen: 0,
    totalCorrect: 0,
    lastSeen: null,
    lastMs: null,
    dueAt: null,
  }
}

/**
 * Coerce untrusted persisted data into a valid record. Never throws. Unknown
 * keys are dropped rather than copied through, so a save written by an earlier
 * build (with `streak` or `avgMs`) loads clean.
 * @param {unknown} raw - Anything at all, typically a parsed JSON value
 * @returns {MasteryRecord} A new, valid record
 */
export function normalizeRecord(raw) {
  if (!_isPlainObject(raw)) return createRecord()
  const totalSeen = _count(raw.totalSeen)
  return {
    strength: _storedStrength(raw),
    totalSeen,
    totalCorrect: Math.min(_count(raw.totalCorrect), totalSeen),
    lastSeen: _timestamp(raw.lastSeen),
    lastMs: _responseMs(raw.lastMs),
    dueAt: _timestamp(raw.dueAt),
  }
}

/**
 * Classify thinking time into a speed band. `responseMs` is measured from the
 * question becoming interactive to the first interaction, never to submit, so
 * the band means the same thing on every entry path.
 * @param {number|null|undefined} responseMs - Thinking time in milliseconds
 * @returns {SpeedBand} The band; "unknown" when the answer was not measured
 */
export function classifySpeed(responseMs) {
  if (!Number.isFinite(responseMs) || responseMs <= 0) return "unknown"
  if (responseMs <= RESPONSE_TIME.FLUENT_MS) return "fluent"
  if (responseMs <= RESPONSE_TIME.SLOW_MS) return "slow"
  return "counting"
}

/**
 * The spaced-repetition interval for a strength.
 * @param {number} strength - Leitner box; out-of-range values are clamped
 * @returns {number} Milliseconds until the fact is due again
 */
export function intervalMsFor(strength) {
  const index = Number.isFinite(strength)
    ? _clamp(Math.round(strength), STRENGTH.MIN, STRENGTH.MAX)
    : STRENGTH.MIN
  return STRENGTH_INTERVALS_MS[index]
}

/**
 * The epoch-ms instant at which a fact of the given strength becomes due.
 * @param {number} strength - Leitner box; out-of-range values are clamped
 * @param {number} now - Epoch ms of the answer being recorded
 * @returns {number} Epoch ms of the next due date
 */
export function dueAtFor(strength, now) {
  return now + intervalMsFor(strength)
}

/**
 * Whether a fact is due for practice. A fact that has never been asked (or
 * whose `dueAt` is unreadable) is always due.
 * @param {MasteryRecord} record - The fact's record
 * @param {number} now - Epoch ms
 * @returns {boolean} True when the fact is due
 */
export function isDue(record, now) {
  if (!_isPlainObject(record)) return true
  if (!Number.isFinite(record.dueAt)) return true
  return now >= record.dueAt
}

/**
 * Strength after decay, computed on read and never written back: one point per
 * full DECAY.PERIOD_MS the fact is overdue, floored at DECAY.FLOOR_SEEN once
 * the fact has ever been answered correctly. Never returns more than the
 * stored strength and never less than the floor.
 * @param {MasteryRecord} record - The fact's record
 * @param {number} now - Epoch ms
 * @returns {number} Integer strength in [STRENGTH.MIN, STRENGTH.MAX]
 */
export function decayedStrength(record, now) {
  if (!_isPlainObject(record)) return STRENGTH.MIN
  const strength = _storedStrength(record)
  if (!Number.isFinite(record.dueAt)) return strength
  const overdueMs = now - record.dueAt
  if (!(overdueMs > 0)) return strength
  const periods = Math.floor(overdueMs / DECAY.PERIOD_MS)
  if (periods === 0) return strength
  const floor = _count(record.totalCorrect) > 0 ? DECAY.FLOOR_SEEN : DECAY.FLOOR_UNSEEN
  // The outer Math.min keeps the documented invariant "never above strength"
  // true even for a corrupt save whose strength sits below its own floor.
  return Math.min(strength, Math.max(floor, strength - periods))
}

/**
 * Strength after a correct answer, by speed band.
 *
 * Every band promotes; the band only sets the ceiling. Holding strength still
 * for a slow-but-correct answer was the old behaviour and it was wrong: a child
 * who reliably gets 7x8 right by counting up in ten seconds had that fact
 * pinned forever, and since every gate in the game reads strength, she could
 * never unlock anything at all.
 * @private
 * @param {number} base - Decayed strength before the answer
 * @param {SpeedBand} band - Band of this answer
 * @returns {number} The new strength, before the final clamp
 */
function _promote(base, band) {
  if (band === "slow") {
    // Correct but hesitant: promote, capped at SLOW_CAP, and never drop more
    // than one box -- so a fact already above the cap settles one step down
    // (5 becomes 4) rather than collapsing to the cap.
    return Math.max(base - 1, Math.min(STRENGTH.SLOW_CAP, base + 1))
  }
  if (band === "counting") {
    // Correct the slow way: promote, capped at SLOW_CAP, and never demote. The
    // Math.max floor at `base` is what separates this band from "slow": having
    // to count is not evidence AGAINST a fact she has, so it costs her nothing.
    return Math.max(base, Math.min(STRENGTH.SLOW_CAP, base + 1))
  }
  // "fluent" and "unmeasured" both count as recall.
  return Math.min(STRENGTH.MAX, base + 1)
}

/**
 * Record one answer against a fact. Returns a NEW record; `record` is never
 * mutated, so the caller must assign the result (MasteryStore does this).
 *
 * Promotion and demotion start from the *decayed* strength, so a fact left for
 * a month is re-earned rather than resumed.
 *
 * @param {MasteryRecord} record - The fact's record before this answer
 * @param {RecordAnswerOptions} options - The answer
 * @returns {MasteryRecord} A new record
 * @throws {TypeError} When `options.now` is not a finite number
 */
export function recordAnswer(record, options = {}) {
  const { correct, now, responseMs } = _isPlainObject(options) ? options : {}
  if (!Number.isFinite(now)) {
    throw new TypeError("recordAnswer requires a finite now timestamp")
  }
  const source = _isPlainObject(record) ? record : createRecord()
  const base = decayedStrength(source, now)
  const band = classifySpeed(responseMs)
  const totalSeen = _count(source.totalSeen)
  const totalCorrect = Math.min(_count(source.totalCorrect), totalSeen)
  const carriedMs = _responseMs(source.lastMs)

  let strength
  let nextCorrect = totalCorrect
  let lastMs = carriedMs
  if (correct) {
    nextCorrect = totalCorrect + 1
    if (band !== "unknown") lastMs = _responseMs(responseMs)
    strength = _promote(base, band)
  } else {
    // Two boxes once the fact was already mastered, one otherwise. Written
    // inline because nothing else needs the step sizes.
    const step = base >= STRENGTH.MASTERED_MIN ? 2 : 1
    strength = base - step
    // A wrong answer's timing says nothing about recall speed, so lastMs
    // carries over unchanged.
  }
  strength = _clamp(strength, STRENGTH.MIN, STRENGTH.MAX)

  return {
    strength,
    totalSeen: totalSeen + 1,
    totalCorrect: nextCorrect,
    lastSeen: now,
    lastMs,
    dueAt: dueAtFor(strength, now),
  }
}

/**
 * The fact's coarse mastery bucket, on decayed strength.
 * @param {MasteryRecord} record - The fact's record
 * @param {number} now - Epoch ms
 * @returns {MasteryTier} "new" until the fact has been asked at least once
 */
export function masteryTier(record, now) {
  if (!_isPlainObject(record) || _count(record.totalSeen) === 0) return "new"
  const strength = decayedStrength(record, now)
  if (strength <= STRENGTH.WEAK_MAX) return "weak"
  if (strength === STRENGTH.STRENGTHENING) return "strengthening"
  return "mastered"
}

/**
 * Whether the fact currently counts as mastered: fluent recall, which is what
 * the foiled card, `masteredCount`, and the `mastered-*` gem milestones read.
 * Region gates deliberately do NOT read this -- they use the lower
 * `TRAIL.UNLOCK_MIN_STRENGTH` bar, so the token keeps moving while a fact is
 * still slow. See the TRAIL docblock in constants.js.
 * @param {MasteryRecord} record - The fact's record
 * @param {number} now - Epoch ms
 * @returns {boolean} True when decayed strength is at least STRENGTH.MASTERED_MIN
 */
export function isMastered(record, now) {
  return decayedStrength(record, now) >= STRENGTH.MASTERED_MIN
}

/**
 * Card art tier for the fact's collection card. Reads decayed strength -- the
 * same number the mastery map and masteryTier read -- so a faded fact can never
 * still show a foiled card.
 * @param {MasteryRecord} record - The fact's record
 * @param {number} now - Epoch ms
 * @returns {CardTierId} The highest tier whose minStrength is reached
 */
export function cardTier(record, now) {
  const strength = decayedStrength(record, now)
  let tier = CARD_TIERS[0]
  for (const candidate of CARD_TIERS) {
    if (candidate.minStrength <= strength) tier = candidate
  }
  return tier.id
}

/**
 * Lifetime accuracy on the fact.
 * @param {MasteryRecord} record - The fact's record
 * @returns {number} totalCorrect / totalSeen, or 0 when never asked
 */
export function accuracy(record) {
  if (!_isPlainObject(record)) return 0
  const totalSeen = _count(record.totalSeen)
  if (totalSeen === 0) return 0
  return Math.min(_count(record.totalCorrect), totalSeen) / totalSeen
}

/**
 * How heavily FactSelector should favour this fact. Weakest facts weigh most,
 * due facts weigh double, and the result is always >= 1 so no fact is ever
 * unreachable.
 * @param {MasteryRecord} record - The fact's record
 * @param {number} now - Epoch ms
 * @returns {number} A positive weight
 */
export function selectionWeight(record, now) {
  const weight = STRENGTH.MAX + 1 - decayedStrength(record, now)
  return isDue(record, now) ? weight * SELECTION.DUE_WEIGHT_BONUS : weight
}

/**
 * Count the mastered facts in a record map.
 * @param {Object<string, MasteryRecord>} records - factId -> record
 * @param {number} now - Epoch ms
 * @returns {number} How many records are currently mastered; 0 for junk input
 */
export function countMastered(records, now) {
  if (!_isPlainObject(records)) return 0
  let count = 0
  for (const record of Object.values(records)) {
    if (isMastered(record, now)) count += 1
  }
  return count
}

/**
 * A thin, tested wrapper over a fact-record map so game.js never hand-rolls
 * record lookup.
 *
 * One map, one owner -- this is a contract, not an implementation detail. The
 * constructor does NOT copy `records`: it normalizes the values **in place**
 * and keeps the caller's object, so after
 * `const store = new MasteryStore(progress.facts, now)`,
 * `store.records === progress.facts` is true and every `set` / `apply` is
 * immediately visible through `progress.facts`. This is the single documented
 * exception to the module's no-mutation rule, and it exists because the
 * alternative -- copying on construction -- produces a store whose writes are
 * invisible to the object that gets saved: every answer scores correctly on
 * screen and persists nothing.
 *
 * `toJSON()` is the one method that does copy, precisely so a caller can
 * snapshot without handing out the live map.
 *
 * If `records` is not a usable object (null, an array, a string) there is
 * nothing to alias, so the store substitutes a fresh `{}`.
 */
export class MasteryStore {
  /**
   * @param {Object<string, MasteryRecord>} [records] - The caller's live map; ALIASED,
   *   and its values are normalized in place
   * @param {() => number} [now] - Injected clock returning epoch ms
   */
  constructor(records = {}, now = () => Date.now()) {
    const source = _isPlainObject(records) ? records : {}
    for (const key of Object.keys(source)) {
      source[key] = normalizeRecord(source[key])
    }
    /** @type {Object<string, MasteryRecord>} The caller's map, aliased -- never a copy. */
    this.records = source
    /** @type {() => number} @private */
    this._now = typeof now === "function" ? now : () => Date.now()
  }

  /**
   * The record for a fact, or a fresh one when absent. A miss is NOT inserted,
   * so reading never grows the saved map.
   * @param {string} factId - Canonical fact id, e.g. "6x7"
   * @returns {MasteryRecord} The stored record, or a fresh one
   */
  get(factId) {
    return this.has(factId) ? this.records[factId] : createRecord()
  }

  /**
   * Whether a record is stored for the fact.
   * @param {string} factId - Canonical fact id
   * @returns {boolean} True when present
   */
  has(factId) {
    return Object.prototype.hasOwnProperty.call(this.records, factId)
  }

  /**
   * Replace the record for a fact. Normalizes, so the live map stays valid
   * even if a caller hands over a partial object.
   * @param {string} factId - Canonical fact id
   * @param {MasteryRecord} record - The record to store
   * @returns {void}
   */
  set(factId, record) {
    this.records[factId] = normalizeRecord(record)
  }

  /**
   * Record an answer against a fact, using the injected clock. Writes through
   * to the aliased map, so the caller needs no assignment.
   * @param {string} factId - Canonical fact id
   * @param {{correct: boolean, responseMs?: number|null}} [answer] - The answer
   * @returns {MasteryRecord} The new record, also now stored
   */
  apply(factId, answer = {}) {
    const { correct, responseMs = null } = _isPlainObject(answer) ? answer : {}
    const next = recordAnswer(this.get(factId), { correct, responseMs, now: this._now() })
    this.records[factId] = next
    return next
  }

  /**
   * The fact's decayed strength.
   * @param {string} factId - Canonical fact id
   * @returns {number} Integer strength in [STRENGTH.MIN, STRENGTH.MAX]
   */
  strengthOf(factId) {
    return decayedStrength(this.get(factId), this._now())
  }

  /**
   * The fact's mastery tier.
   * @param {string} factId - Canonical fact id
   * @returns {MasteryTier} The tier
   */
  tierOf(factId) {
    return masteryTier(this.get(factId), this._now())
  }

  /**
   * The fact's card art tier.
   * @param {string} factId - Canonical fact id
   * @returns {CardTierId} The tier id
   */
  cardTierOf(factId) {
    return cardTier(this.get(factId), this._now())
  }

  /**
   * A shallow copy of the record map, for callers that need a snapshot rather
   * than the live aliased map.
   * @returns {Object<string, MasteryRecord>} A new object with the same records
   */
  toJSON() {
    return { ...this.records }
  }

  /**
   * How many stored facts are currently mastered.
   * @returns {number} The count
   */
  masteredCount() {
    return countMastered(this.records, this._now())
  }

  /**
   * Filter fact ids down to the ones due for practice, preserving input order.
   * @param {string[]} factIds - Candidate fact ids
   * @returns {string[]} The due subset; [] for non-array input
   */
  dueIds(factIds) {
    if (!Array.isArray(factIds)) return []
    const now = this._now()
    return factIds.filter((factId) => isDue(this.get(factId), now))
  }
}

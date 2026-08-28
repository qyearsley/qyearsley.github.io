/**
 * Scoring for Times Trail -- stars, gems, the daily goal, and the streak calendar.
 *
 * Philosophy (why the numbers are shaped the way they are):
 *
 * 1. **Stars are weighted toward weak facts.** A correct answer pays
 *    `STARS.BASE` plus a tier bonus that is largest for the facts she knows
 *    least: 20 for a weak fact, 15 for a strengthening one, 10 for a mastered
 *    one. Point-farming `2x2` therefore pays half as much per answer as
 *    working on `7x8`, so the cheapest way to a big number is to practise the
 *    thing that needs practising. The keypad bonus follows the same logic --
 *    typing an answer is strictly harder than recognising one among four
 *    tiles, so it is worth 5 more before the streak multiplier applies.
 *
 * 2. **Nothing is ever subtracted.** `starsForWrong()` returns `0`, not a
 *    penalty, and gems are milestone trophies that are only ever added (§ 0,
 *    decision 5 -- they are never spent). Losing visible progress is where
 *    kids quit, so no path through this module can lower a total. The streak
 *    multiplier is the only thing a miss costs, and that lives in the caller's
 *    session streak, not in a stored balance.
 *
 * 3. **The daily goal counts facts, not minutes.** `factsToday >= 20` and
 *    nothing else. A time-based goal is satisfiable by leaving a tab open,
 *    which rewards the opposite of practice, so there is no seconds arm
 *    anywhere in this file (§ 3.15).
 *
 * 4. **The streak calendar is lenient but not free.** Exactly one missed day
 *    is forgiven: the streak survives and the flame shows one stage dimmer.
 *    Two or more missed days reset the streak to 0. `bestStreakDays` is never
 *    reduced by anything.
 *
 * Architecture: pure over its inputs. No `document`, `window`, `localStorage`,
 * or `setTimeout`, and no `Date.now()` except as the default value of the
 * injected clock -- every method that needs the time reads `this._now()`, so
 * tests pass a fixed timestamp instead of faking timers. No method mutates its
 * argument; every one returns a fresh object.
 */

import {
  DAILY_GOAL,
  DAY_MS,
  FLAME_STAGES,
  GEM_MILESTONES,
  INPUT_MODE,
  STARS,
  STRENGTH,
} from "./constants.js"

/**
 * @typedef {Object} Daily
 * @property {string|null} todayDate     - Local date key "YYYY-MM-DD" for the counters below
 * @property {number} factsToday         - Facts answered today, >= 0
 * @property {boolean} goalMetToday      - The daily goal already fired today
 * @property {string|null} lastGoalDate  - Local date key on which the goal was last met
 * @property {number} streakDays         - Consecutive goal-met days, grace days included
 * @property {number} bestStreakDays     - High-water mark of streakDays; never reduced
 * @property {boolean} flameDimmed       - A grace day was used; the flame shows one stage down
 */

/**
 * @typedef {Object} MilestoneMetrics
 * @property {number} sessionsCompleted   - Sessions finished all-time (no Phase 1 milestone uses it)
 * @property {number} factsCorrect        - Correct answers all-time
 * @property {number} starsTotal          - Stars earned all-time
 * @property {number} masteredCount       - Facts currently mastered
 * @property {number} unlockedRegionCount - Trail regions currently unlocked
 * @property {number} streakDays          - Current daily-goal streak
 */

/**
 * @typedef {Object} Milestone
 * @property {string} id        - Stable id, recorded in the save so it is awarded once
 * @property {string} metric    - Name of the MilestoneMetrics field it reads
 * @property {number} threshold - Metric value at or above which it fires
 * @property {number} gems      - Gems awarded, always positive
 * @property {string} label     - Human-readable description
 */

/**
 * @typedef {Object} StarsInput
 * @property {number} strength   - The fact's strength BEFORE this answer was recorded
 * @property {number} streak     - Session streak INCLUDING this answer (1 for the first correct)
 * @property {string} inputMode  - INPUT_MODE value; "keypad" earns the honesty bonus
 */

/**
 * @typedef {Object} FlameStage
 * @property {number} index    - FLAME_STAGES array position of the stage to show
 * @property {string} id       - Stage id, e.g. "spark"
 * @property {string} emoji    - Stage emoji
 * @property {boolean} dimmed  - The stage was lowered because a grace day was used
 */

/**
 * @typedef {Object} ApplyAnswerResult
 * @property {Daily} daily          - A fresh Daily with today's counters advanced
 * @property {boolean} goalJustMet  - This answer is the one that met the goal
 */

/**
 * @typedef {Object} MilestoneCheck
 * @property {Milestone[]} newlyAwarded - Milestones crossed now, in GEM_MILESTONES order
 * @property {number} gems             - Sum of their gems, always >= 0
 */

/** Local date keys, "YYYY-MM-DD". Used for both validation and parsing. */
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Zero-pads a month or day to two digits.
 * @private
 * @param {number} value - 1-31
 * @returns {string} Two-character string, e.g. "05"
 */
function pad2(value) {
  return String(value).padStart(2, "0")
}

/**
 * @private
 * @param {unknown} value - Candidate date key
 * @returns {boolean} True when value is a "YYYY-MM-DD" string
 */
function isDateKey(value) {
  return typeof value === "string" && DATE_KEY_PATTERN.test(value)
}

/**
 * Parses a local date key as UTC midnight, so day arithmetic is DST-safe:
 * both sides of a subtraction are the same distance from a fixed origin.
 * @private
 * @param {unknown} key - A "YYYY-MM-DD" date key
 * @returns {number|null} Epoch ms of UTC midnight, or null when key is malformed
 */
function utcMidnight(key) {
  const match = isDateKey(key) ? DATE_KEY_PATTERN.exec(/** @type {string} */ (key)) : null
  if (!match) return null
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

/**
 * Coerces an untrusted counter to a non-negative integer.
 * @private
 * @param {unknown} value - Persisted counter of unknown provenance
 * @returns {number} Floor of value clamped at 0; 0 for anything non-finite
 */
function nonNegativeInt(value) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(/** @type {number} */ (value))) : 0
}

/**
 * Clamps a strength to the documented Leitner range before it is classified.
 * @private
 * @param {unknown} value - Candidate strength
 * @returns {number} Integer in [STRENGTH.MIN, STRENGTH.MAX]; STRENGTH.MIN if non-finite
 */
function clampStrength(value) {
  if (!Number.isFinite(value)) return STRENGTH.MIN
  const rounded = Math.round(/** @type {number} */ (value))
  return Math.min(STRENGTH.MAX, Math.max(STRENGTH.MIN, rounded))
}

/**
 * Stars, gems, the daily goal, and the streak calendar.
 *
 * Every instance method is pure with respect to its arguments; the only
 * instance state is the injected clock.
 */
export class Scoring {
  /**
   * @param {Object} [options] - Construction options
   * @param {() => number} [options.now] - Clock returning epoch ms; defaults to Date.now
   */
  constructor(options = {}) {
    /** @type {() => number} The injected clock -- the only source of "now" in this module. */
    this._now = typeof options?.now === "function" ? options.now : () => Date.now()
  }

  /**
   * A brand-new daily record. Seven keys, no more; `storage.js`'s
   * `defaultProgress()` quotes this object verbatim because it cannot import
   * this module, and `storage.test.js` deep-equals the two so the duplication
   * cannot silently drift.
   * @returns {Daily} A fresh object every call
   */
  static createDaily() {
    return {
      todayDate: null,
      factsToday: 0,
      goalMetToday: false,
      lastGoalDate: null,
      streakDays: 0,
      bestStreakDays: 0,
      flameDimmed: false,
    }
  }

  /**
   * Coerces untrusted persisted data into a valid `Daily`. Never throws.
   * Unknown keys are dropped rather than copied through, which is how a
   * legacy `secondsToday` from a build with the deleted time-based goal
   * disappears on load.
   * @param {unknown} raw - Persisted value of unknown shape
   * @returns {Daily} A fresh object with exactly the seven documented keys
   */
  static normalizeDaily(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return Scoring.createDaily()
    const source = /** @type {Record<string, unknown>} */ (raw)
    const streakDays = nonNegativeInt(source.streakDays)
    return {
      todayDate: isDateKey(source.todayDate) ? /** @type {string} */ (source.todayDate) : null,
      factsToday: nonNegativeInt(source.factsToday),
      goalMetToday: source.goalMetToday === true,
      lastGoalDate: isDateKey(source.lastGoalDate)
        ? /** @type {string} */ (source.lastGoalDate)
        : null,
      streakDays,
      // A high-water mark can never sit below the value it is tracking.
      bestStreakDays: Math.max(nonNegativeInt(source.bestStreakDays), streakDays),
      flameDimmed: source.flameDimmed === true,
    }
  }

  /**
   * The star multiplier for a session streak: the highest
   * `STARS.STREAK_MULTIPLIERS` entry whose `minStreak` the streak reaches.
   * @param {number} streak - Session streak, 0 or more
   * @returns {number} 1, 1.5, 2, or 3; 1 for a negative or non-finite streak
   */
  streakMultiplier(streak) {
    const value = Number.isFinite(streak) ? streak : 0
    let multiplier = STARS.STREAK_MULTIPLIERS[0].multiplier
    for (const entry of STARS.STREAK_MULTIPLIERS) {
      if (value >= entry.minStreak) multiplier = entry.multiplier
    }
    return multiplier
  }

  /**
   * Maps a fact strength to the tier that sets its star bonus. Mirrors
   * `MasteryModel.masteryTier` minus the "new" case: scoring cares only about
   * how well the fact is known, not whether it has been seen before.
   * @param {number} strength - Leitner strength; clamped to [0, 5] first
   * @returns {"weak"|"strengthening"|"mastered"} The bonus tier
   */
  tierForStrength(strength) {
    const value = clampStrength(strength)
    if (value <= STRENGTH.WEAK_MAX) return "weak"
    if (value < STRENGTH.MASTERED_MIN) return "strengthening"
    return "mastered"
  }

  /**
   * Stars for one correct answer. Weak facts pay the most, the keypad adds a
   * flat bonus before the multiplier, and the session streak scales the whole
   * thing. The result is rounded, never truncated, so a 1.5x multiplier on an
   * odd base rounds up rather than quietly losing half a star.
   * @param {StarsInput} [input] - The answer's tier inputs
   * @returns {number} A non-negative integer
   */
  starsForCorrect(input) {
    const { strength, streak, inputMode } = input ?? {}
    const tier = this.tierForStrength(strength)
    let base = STARS.BASE + STARS.TIER_BONUS[tier]
    if (inputMode === INPUT_MODE.KEYPAD) base += STARS.KEYPAD_BONUS
    return Math.max(0, Math.round(base * this.streakMultiplier(streak)))
  }

  /**
   * Stars for a wrong answer. Always `0` -- no currency is ever subtracted in
   * this game, so a miss costs the streak multiplier and nothing else.
   * @returns {number} 0
   */
  starsForWrong() {
    return 0
  }

  /**
   * The local calendar date of a timestamp. Local, not UTC, because "today"
   * means the player's today. Built from date components rather than `Intl` or
   * `toLocaleDateString`, so the format cannot shift with the locale.
   * @param {number} timestampMs - Epoch ms
   * @returns {string} "YYYY-MM-DD"
   */
  dateKey(timestampMs) {
    const date = new Date(timestampMs)
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
  }

  /**
   * Whole days from `fromKey` to `toKey`. Both keys are parsed as UTC midnight,
   * so a DST transition inside the span cannot make a two-day gap measure 1.9
   * days and round to 2 by luck.
   * @param {string|null} fromKey - Earlier date key
   * @param {string|null} toKey   - Later date key
   * @returns {number} `toKey - fromKey` in days; negative if reversed, and
   *   `Number.POSITIVE_INFINITY` when either key is null or malformed, so
   *   callers read "never happened" as "very long ago"
   */
  daysBetween(fromKey, toKey) {
    const from = utcMidnight(fromKey)
    const to = utcMidnight(toKey)
    if (from === null || to === null) return Number.POSITIVE_INFINITY
    return Math.round((to - from) / DAY_MS)
  }

  /**
   * Rolls a `Daily` forward to the current local day. Call on load and before
   * every answer.
   *
   * **Always returns a fresh object**, on both branches. Returning the
   * argument on the same-day branch would make the no-mutation guarantee
   * depend on which branch ran, since `applyAnswer` builds on this return
   * value -- one branch, one kind of return value.
   *
   * The streak calendar: the goal met today or yesterday keeps the streak
   * bright; a gap of exactly `DAILY_GOAL.GRACE_GAP_DAYS` (one missed day)
   * keeps the streak but dims the flame; anything longer, or a goal never met,
   * resets the streak. `bestStreakDays` is never reduced.
   * @param {Daily|unknown} daily - Current daily record, possibly untrusted
   * @returns {Daily} A fresh Daily whose `todayDate` is the current local day
   */
  rollDaily(daily) {
    const rolled = Scoring.normalizeDaily(daily)
    const today = this.dateKey(this._now())
    if (rolled.todayDate === today) return rolled

    rolled.todayDate = today
    rolled.factsToday = 0
    rolled.goalMetToday = false

    const gap = this.daysBetween(rolled.lastGoalDate, today)
    if (gap <= 1) {
      // Met today or yesterday: the streak is live and the flame is full.
      rolled.flameDimmed = false
    } else if (gap === DAILY_GOAL.GRACE_GAP_DAYS) {
      // Exactly one missed day is forgiven; the flame shrinks, nothing resets.
      rolled.flameDimmed = true
    } else {
      // Two or more missed days, or never met at all.
      rolled.streakDays = 0
      rolled.flameDimmed = false
    }
    return rolled
  }

  /**
   * Counts one answer against today's goal.
   *
   * The goal is evaluated against the **post-increment** value, so the answer
   * that meets the goal is the one that reports it. Testing the pre-increment
   * value made the 21st answer fire, which means a 20-answer session -- the
   * intended daily usage -- never celebrated at all.
   * @param {Daily|unknown} daily - Current daily record; never mutated
   * @returns {ApplyAnswerResult} The advanced record plus the one-shot flag
   */
  applyAnswer(daily) {
    const rolled = this.rollDaily(daily)
    const next = { ...rolled, factsToday: rolled.factsToday + 1 }
    const met = this.isDailyGoalMet(next)
    const goalJustMet = met && !rolled.goalMetToday
    if (goalJustMet) {
      next.goalMetToday = true
      next.streakDays = rolled.streakDays + 1
      next.bestStreakDays = Math.max(rolled.bestStreakDays, next.streakDays)
      next.lastGoalDate = next.todayDate
      next.flameDimmed = false
    }
    return { daily: next, goalJustMet }
  }

  /**
   * Whether today's goal is met. Facts only -- one clause, no time arm.
   * @param {Daily|unknown} daily - A daily record
   * @returns {boolean} True when `factsToday >= DAILY_GOAL.FACTS`
   */
  isDailyGoalMet(daily) {
    const facts = /** @type {Daily} */ (daily)?.factsToday
    return Number.isFinite(facts) && facts >= DAILY_GOAL.FACTS
  }

  /**
   * The flame to show for the current streak: the highest `FLAME_STAGES` entry
   * the streak reaches, lowered by one when a grace day was used. A dimmed
   * flame never drops below index 1 while the streak is alive -- going dark
   * would read as "streak lost", which is exactly what the grace day prevents.
   * @param {Daily|unknown} daily - A daily record
   * @returns {FlameStage} The stage to render
   */
  flameStage(daily) {
    const record = /** @type {Daily} */ (daily)
    const streakDays = Number.isFinite(record?.streakDays) ? record.streakDays : 0
    const dimmed = record?.flameDimmed === true

    let reached = FLAME_STAGES[0]
    for (const stage of FLAME_STAGES) {
      if (streakDays >= stage.minStreak) reached = stage
    }
    const stage = dimmed && reached.index > 1 ? FLAME_STAGES[reached.index - 1] : reached
    return { index: stage.index, id: stage.id, emoji: stage.emoji, dimmed }
  }

  /**
   * Finds every gem milestone the metrics have newly crossed.
   *
   * Pure and idempotent: `awardedIds` is read, never appended to, so the
   * caller decides when to record the award. Feeding the returned ids back in
   * yields an empty result. Gems are only ever added, so the total can never
   * be negative.
   * @param {MilestoneMetrics|unknown} metrics - Current metric values; a
   *   missing key counts as 0
   * @param {string[]} [awardedIds] - Milestone ids already awarded
   * @returns {MilestoneCheck} Newly crossed milestones in GEM_MILESTONES order
   */
  checkMilestones(metrics, awardedIds) {
    const awarded = new Set(Array.isArray(awardedIds) ? awardedIds : [])
    const source = /** @type {Record<string, unknown>} */ (metrics ?? {})
    const newlyAwarded = GEM_MILESTONES.filter(
      (milestone) =>
        !awarded.has(milestone.id) && Number(source[milestone.metric] ?? 0) >= milestone.threshold,
    )
    const gems = newlyAwarded.reduce((total, milestone) => total + milestone.gems, 0)
    return { newlyAwarded, gems }
  }
}

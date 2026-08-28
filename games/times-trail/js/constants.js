/**
 * Constants for Times Trail
 * Single shared contract for every other module in this game.
 * Grouped by concern; every table is frozen so a mode or UI module cannot
 * mutate the shared configuration by accident.
 *
 * Architecture: this module imports nothing. It is the root of the dependency
 * graph, so any value more than one module needs belongs here and nowhere else.
 * Values are plain numbers, strings, and frozen literals -- no functions and no
 * derived state. The one cross-reference (TRAIL.UNLOCK_MIN_STRENGTH reads
 * STRENGTH.STRENGTHENING, declared above it) stays inside this file, so it
 * cannot make importing this module order-dependent.
 */

/**
 * Bounds of the fact set: the multiplication table from 2x2 up to 9x9.
 * 1s and 10s are excluded deliberately -- they are pattern rules, not recall.
 * Facts are canonical (smaller operand first), so the set is the upper
 * triangle of the 8x8 grid: 8 * 9 / 2 = 36 facts.
 */
export const OPERAND_MIN = 2
export const OPERAND_MAX = 9
export const TOTAL_FACTS = 36

/**
 * Leitner box boundaries. A fact's strength is an integer 0-5 and drives
 * everything: which entry mode it gets, when it comes due, what its card art
 * looks like, and whether its region counts it as mastered.
 *
 * The tier names are the whole vocabulary; the entry mode a tier gets is NOT
 * fixed here, because it is a per-preset question. Each preset's
 * `keypadMinStrength` decides where the keypad starts, so a tier's entry mode
 * is a question for DIFFICULTY_PRESETS rather than for this table.
 */
export const STRENGTH = Object.freeze({
  MIN: 0,
  MAX: 5,
  WEAK_MAX: 2, // 0-2 => weak
  STRENGTHENING: 3, // 3   => strengthening
  MASTERED_MIN: 4, // 4-5 => mastered
  SLOW_CAP: 3, // ceiling a correct-but-slow answer can promote TO
})

/**
 * Response-time bands, in milliseconds.
 *
 * What is being measured: these thresholds bound *thinking* time, not
 * thinking-plus-typing time. The clock starts when the question becomes
 * interactive and stops at the first interaction (first tile tap or first
 * keypad keypress), never at submit -- so a two-digit keypad answer costs the
 * same measured time as a one-tap tile answer, and the keypad's extra motor
 * work can never demote a fact the player actually knows.
 *
 * SLOW_MS is generous on purpose. Counting up to 42 by sevens legitimately
 * takes about ten seconds, and a child who gets there is not guessing -- she is
 * using the strategy she has. Setting the boundary below that filed reliable
 * correct answers under "counting", where they made the least progress, which
 * is exactly backwards.
 */
export const RESPONSE_TIME = Object.freeze({
  FLUENT_MS: 5000, // <= this is recall
  SLOW_MS: 12000, // <= this is hesitation; above is counting
  MAX_RECORDED_MS: 60000, // clamp; longer means she walked away
})

/** One minute in milliseconds. Exported because tests and Scoring use it. */
export const MINUTE_MS = 60 * 1000

/** One day in milliseconds. Exported because tests and Scoring use it. */
export const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Spaced-repetition schedule: strength (Leitner box) -> how long until the
 * fact is due again. Indexed by strength, so the array length is
 * STRENGTH.MAX + 1 and it must increase with strength.
 */
export const STRENGTH_INTERVALS_MS = Object.freeze([
  0, //  strength 0: due immediately
  10 * MINUTE_MS, //  strength 1
  1 * DAY_MS, //  strength 2
  3 * DAY_MS, //  strength 3
  7 * DAY_MS, //  strength 4
  21 * DAY_MS, //  strength 5
])

/**
 * Strength decay for facts left unpractised. Computed on read, never written
 * back, so there is no background job -- see MasteryModel's decayedStrength.
 */
export const DECAY = Object.freeze({
  PERIOD_MS: 14 * DAY_MS, // one strength point lost per full period overdue
  FLOOR_SEEN: 1, // a fact answered correctly at least once never decays below 1
  FLOOR_UNSEEN: 0,
})

/**
 * How FactSelector picks the next fact: a weighted draw from a weak/due
 * bucket most of the time, plus the delay before a missed fact is re-asked.
 */
export const SELECTION = Object.freeze({
  WEAK_RATIO: 0.7, // P(draw from the weak/due bucket)
  RETRY_DELAY_MIN: 3, // a missed fact returns after 3..4 OTHER questions
  RETRY_DELAY_MAX: 4,
  DUE_WEIGHT_BONUS: 2, // multiplier applied to a due fact's weight
})

/**
 * Multiple-choice tile generation. Every one of the 36 facts yields at least 6
 * near-miss candidates, so OPTION_COUNT - 1 distinct distractors are always
 * available from real near-misses and there is no padding path.
 */
export const DISTRACTORS = Object.freeze({
  OPTION_COUNT: 4, // total tiles, including the answer
  PRIORITY_WINDOW: 6, // shuffle only the top N near-misses
})

/** Difficulty identifiers. Also the keys of DIFFICULTY_PRESETS. */
export const DIFFICULTY = Object.freeze({
  EXPLORER: "explorer",
  ADVENTURER: "adventurer",
  MASTER: "master",
  CUSTOM: "custom",
})

/**
 * The difficulty presets.
 *
 * tableMode semantics:
 *   "both"   - a fact is in the pool only if BOTH operands are enabled.
 *              Preset ceilings ("2s through 5s" means nothing above 5).
 *   "either" - a fact is in the pool if EITHER operand is enabled.
 *              Custom table-family semantics (checking 7 means the 7 times table).
 * keypadMinStrength: the strength at which a fact switches to keypad entry.
 *   null means never use the keypad. TRIAL (2026-08-27): every preset is 0, so
 *   the keypad is the only entry path and the multiple-choice tiles never
 *   appear. Typing is the only honest signal of recall -- tiles carry a 25%
 *   guessing floor that muddies the mastery data. Restore 3 / 2 / 3 (and null
 *   on Explorer) to get the adaptive tiles-then-keypad behaviour back; nothing
 *   else needs changing. See "Possible changes after first play" in
 *   docs/times-trail-plan.md.
 * poolSize: the expected pool size, present so constants.test.js and
 *   facts.test.js can cross-check facts.js against it. null where the pool
 *   depends on player-chosen tables.
 */
export const DIFFICULTY_PRESETS = Object.freeze({
  explorer: Object.freeze({
    id: "explorer",
    label: "Explorer",
    tables: Object.freeze([2, 3, 4, 5]),
    tableMode: "both",
    keypadMinStrength: 0,
    poolSize: 10,
  }),
  adventurer: Object.freeze({
    id: "adventurer",
    label: "Adventurer",
    tables: Object.freeze([2, 3, 4, 5, 6, 7]),
    tableMode: "both",
    keypadMinStrength: 0,
    poolSize: 21,
  }),
  master: Object.freeze({
    id: "master",
    label: "Master",
    tables: Object.freeze([2, 3, 4, 5, 6, 7, 8, 9]),
    tableMode: "both",
    keypadMinStrength: 0,
    poolSize: 36,
  }),
  custom: Object.freeze({
    id: "custom",
    label: "Custom",
    tables: null,
    tableMode: "either",
    keypadMinStrength: 0,
    poolSize: null,
  }),
})

/** The preset a brand-new player starts on. */
export const DEFAULT_DIFFICULTY = "adventurer"

/** Tables pre-checked when the player first opens the custom picker. */
export const DEFAULT_CUSTOM_TABLES = Object.freeze([6, 7])

/** Every table the game covers, ascending. */
export const ALL_TABLES = Object.freeze([2, 3, 4, 5, 6, 7, 8, 9])

/**
 * How the player enters an answer. Derived from the fact's strength, never
 * chosen by the player, so there is no matching setting. TILES is retained only
 * so a revert of the keypad-only trial does not have to reintroduce it; nothing
 * currently produces it.
 */
export const INPUT_MODE = Object.freeze({ TILES: "tiles", KEYPAD: "keypad" })

/** Practice mode identifiers. */
export const MODE_IDS = Object.freeze({
  QUICK_RECALL: "quick-recall",
})

/** Human-readable mode names. One entry per MODE_IDS value. */
export const MODE_LABELS = Object.freeze({
  [MODE_IDS.QUICK_RECALL]: "Quick Recall",
})

/** Session shape. FACTS_PER_SESSION is also #progress-bar's aria-valuemax. */
export const SESSION = Object.freeze({
  FACTS_PER_SESSION: 20,
})

/**
 * The trail the token walks. TOTAL_SPACES is SPACES_PER_REGION * REGIONS.length;
 * constants.test.js asserts the two agree rather than deriving one from the
 * other, so a mismatch fails loudly instead of silently reshaping the board.
 *
 * UNLOCK_MIN_STRENGTH is deliberately NOT STRENGTH.MASTERED_MIN. "Mastered"
 * means fluent recall, which is the right bar for a foiled card, the mastery
 * map, and the `mastered-*` gem milestones -- but it is the wrong bar for
 * MOVEMENT. A child who is reliably correct on a fact, even while she still
 * counts up to it, should see her token move; pinning the trail to fluency means
 * the game's central reward stays frozen through the weeks when she needs it
 * most. So region gates count facts at STRENGTH.STRENGTHENING or better, and
 * fluency is what the collection rewards.
 */
export const TRAIL = Object.freeze({
  SPACES_PER_REGION: 5,
  TOTAL_SPACES: 40, // SPACES_PER_REGION * REGIONS.length
  UNLOCK_FRACTION: 0.6, // ceil(fraction * regionFactCount) must reach UNLOCK_MIN_STRENGTH
  UNLOCK_MIN_STRENGTH: STRENGTH.STRENGTHENING, // strength a fact needs to count toward a gate
  SPACES_PER_CORRECT: 1,
})

/** The trail token. One emoji, no cosmetics to unlock. */
export const TOKEN_EMOJI = "🥾"

/**
 * The eight regions of the trail, in walking order.
 *
 * A region owns every canonical fact whose LARGER operand equals its table,
 * so each of the 36 facts belongs to exactly one region and region sizes run
 * 1, 2, 3, 4, 5, 6, 7, 8 -- the trail therefore ends in the hard neighbourhood.
 * Each region object is frozen as well as the array.
 */
export const REGIONS = Object.freeze([
  Object.freeze({
    id: "doubling-meadow",
    name: "Doubling Meadow",
    table: 2,
    emoji: "🌾",
    spaces: 5,
  }),
  Object.freeze({ id: "triple-bridge", name: "Triple Bridge", table: 3, emoji: "🌉", spaces: 5 }),
  Object.freeze({
    id: "fourfold-orchard",
    name: "Fourfold Orchard",
    table: 4,
    emoji: "🍎",
    spaces: 5,
  }),
  Object.freeze({
    id: "high-five-hills",
    name: "High-Five Hills",
    table: 5,
    emoji: "🖐️",
    spaces: 5,
  }),
  Object.freeze({ id: "beehive-hollow", name: "Beehive Hollow", table: 6, emoji: "🐝", spaces: 5 }),
  Object.freeze({ id: "rainbow-ridge", name: "Rainbow Ridge", table: 7, emoji: "🌈", spaces: 5 }),
  Object.freeze({ id: "spider-woods", name: "Spider Woods", table: 8, emoji: "🕸️", spaces: 5 }),
  Object.freeze({ id: "dragon-peak", name: "Dragon Peak", table: 9, emoji: "🐉", spaces: 5 }),
])

/**
 * The pattern-free facts: what is left after the doubling (x2), x5, x9-trick and
 * square shortcuts are taken away, so they have to be recalled rather than
 * derived. Ten of them, not twelve -- the name says what the list is, not how
 * long it happens to be. Boss stops (Phase 2) draw only from this pool.
 */
export const PATTERN_FREE_IDS = Object.freeze([
  "3x7",
  "3x8",
  "4x6",
  "4x7",
  "4x8",
  "6x6",
  "6x7",
  "6x8",
  "7x7",
  "7x8",
])

/**
 * Star scoring. A correct answer earns BASE, plus a tier bonus that pays most
 * for the facts she knows least, plus KEYPAD_BONUS when she typed the answer
 * instead of picking a tile, all multiplied by the session-streak multiplier.
 */
export const STARS = Object.freeze({
  BASE: 10,
  /** Weakest facts pay the most, so practice goes where it is needed. */
  TIER_BONUS: Object.freeze({ weak: 10, strengthening: 5, mastered: 0 }),
  KEYPAD_BONUS: 5, // typing the answer is harder than recognising it
  /** Ascending by threshold. Largest threshold <= streak wins. */
  STREAK_MULTIPLIERS: Object.freeze([
    Object.freeze({ minStreak: 0, multiplier: 1 }),
    Object.freeze({ minStreak: 3, multiplier: 1.5 }),
    Object.freeze({ minStreak: 6, multiplier: 2 }),
    Object.freeze({ minStreak: 10, multiplier: 3 }),
  ]),
  MAX_MULTIPLIER: 3,
})

/**
 * Gem milestones, in award order. `metric` names a field of the
 * MilestoneMetrics object built by Scoring. Gems are only ever added and never
 * spent -- they are trophies shown in the hub and the summary.
 *
 * Grouped by metric, thresholds ascending within each metric, so a single pass
 * can award every newly crossed milestone. The smallest factsCorrect threshold
 * is deliberately below SESSION.FACTS_PER_SESSION so a first session earns a
 * gem mid-play rather than promising one weeks away.
 */
export const GEM_MILESTONES = Object.freeze([
  Object.freeze({
    id: "facts-10",
    metric: "factsCorrect",
    threshold: 10,
    gems: 1,
    label: "10 facts right",
  }),
  Object.freeze({
    id: "facts-25",
    metric: "factsCorrect",
    threshold: 25,
    gems: 1,
    label: "25 facts right",
  }),
  Object.freeze({
    id: "facts-100",
    metric: "factsCorrect",
    threshold: 100,
    gems: 2,
    label: "100 facts right",
  }),
  Object.freeze({
    id: "mastered-5",
    metric: "masteredCount",
    threshold: 5,
    gems: 2,
    label: "5 facts mastered",
  }),
  Object.freeze({
    id: "mastered-15",
    metric: "masteredCount",
    threshold: 15,
    gems: 3,
    label: "15 facts mastered",
  }),
  Object.freeze({
    id: "regions-4",
    metric: "unlockedRegionCount",
    threshold: 4,
    gems: 3,
    label: "Halfway along the trail",
  }),
  Object.freeze({
    id: "streak-3",
    metric: "streakDays",
    threshold: 3,
    gems: 1,
    label: "3 days running",
  }),
  Object.freeze({
    id: "stars-1000",
    metric: "starsTotal",
    threshold: 1000,
    gems: 2,
    label: "1000 stars",
  }),
])

/**
 * The daily goal. Facts only: factsToday >= DAILY_GOAL.FACTS. There is
 * deliberately no seconds arm -- a time-based goal rewards leaving the page
 * open, which is the opposite of practice.
 */
export const DAILY_GOAL = Object.freeze({
  FACTS: 20,
  GRACE_GAP_DAYS: 2, // gap of exactly 2 days (one missed day) is forgiven
})

/** Streak flame stages. Ascending by minStreak; `index` is the array position. */
export const FLAME_STAGES = Object.freeze([
  Object.freeze({ index: 0, id: "out", minStreak: 0, emoji: "·" }),
  Object.freeze({ index: 1, id: "spark", minStreak: 1, emoji: "✨" }),
  Object.freeze({ index: 2, id: "flame", minStreak: 3, emoji: "🔥" }),
  Object.freeze({ index: 3, id: "blaze", minStreak: 7, emoji: "🔥🔥" }),
  Object.freeze({ index: 4, id: "inferno", minStreak: 14, emoji: "🔥🔥🔥" }),
])

/**
 * Card art strengthens with the fact. Ascending by minStrength; the highest
 * entry whose minStrength <= decayed strength wins. The top tier's minStrength
 * is STRENGTH.MASTERED_MIN, so a foiled card and a mastered fact are the same
 * thing and the collection can never disagree with the mastery map.
 */
export const CARD_TIERS = Object.freeze([
  Object.freeze({ id: "grey", minStrength: 0 }),
  Object.freeze({ id: "colored", minStrength: 2 }),
  Object.freeze({ id: "foiled", minStrength: 4 }),
])

/**
 * Animation and pacing durations in milliseconds, used only by game.js and
 * GameUI.js. There is no SCAFFOLD_DISPLAY_MS: a scaffold has to outlast its
 * own skip-count animation, so its duration is computed as
 * rows * SKIP_COUNT_TICK_MS + SCAFFOLD_DWELL_MS.
 *
 * CORRECT_FEEDBACK_MS has to be at least STAR_FLY_MS, or the reward animation is
 * still running when the next question renders over it.
 *
 * WRONG_FEEDBACK_MS is the mirror of CORRECT_FEEDBACK_MS and exists for the same
 * reason: a miss marks the entry `.incorrect` and shakes it, and that is not
 * worth marking if the scaffold replaces the play area in the same synchronous
 * turn. It is longer than CORRECT_FEEDBACK_MS because a wrong answer is the one
 * moment the player needs time to look before being taught.
 */
export const TIMING = Object.freeze({
  CORRECT_FEEDBACK_MS: 700, // hold after a correct answer before the next question
  WRONG_FEEDBACK_MS: 900, // hold after a miss so the marked answer can be seen
  SKIP_COUNT_TICK_MS: 450, // one skip-count number lights per tick
  SCAFFOLD_DWELL_MS: 1400, // quiet time after the last skip-count number
  STAR_FLY_MS: 600, // "+40 star" travel time into the counter
  SUMMARY_DELAY_MS: 1200,
})

/** localStorage key and save-schema version. */
export const STORAGE = Object.freeze({ KEY: "timesTrailProgress", VERSION: "1.0" })

/**
 * The numeric keypad. KEYS is in visual layout order, three per row, so the
 * UI can render it by iterating without a second layout table.
 *
 * BACKSPACE_KEY, not CLEAR_KEY: the key's face is `⌫`, which universally means
 * "delete one character", so it deletes one digit. A child who mistypes the
 * second digit of 42 keeps the 4. The whole entry can still be dropped from a
 * physical keyboard with Escape; there is no clear-all key on the pad, because a
 * two-digit entry is one backspace away from empty anyway.
 */
export const KEYPAD = Object.freeze({
  MAX_DIGITS: 2, // largest product is 81
  KEYS: Object.freeze(["1", "2", "3", "4", "5", "6", "7", "8", "9", "backspace", "0", "enter"]),
  BACKSPACE_KEY: "backspace",
  ENTER_KEY: "enter",
  EMPTY_DISPLAY: "?",
})

/** Small arithmetic helpers that would otherwise be bare magic numbers. */
export const MATH = Object.freeze({ PERCENT_MULTIPLIER: 100 })

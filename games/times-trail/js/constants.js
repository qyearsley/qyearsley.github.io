/**
 * Constants for Times Trail
 * Single shared contract for every other module in this game.
 * Grouped by concern; every table is frozen so a mode or UI module cannot
 * mutate the shared configuration by accident.
 *
 * Architecture: this module imports nothing. It is the root of the dependency
 * graph, so any value more than one module needs belongs here and nowhere else.
 * Values are plain numbers, strings, and frozen literals -- no functions and no
 * derived state.
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
 * everything: when it comes due, what its card art looks like, and whether it
 * counts as mastered.
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
 * interactive and stops at the first keypad keypress, never at submit -- so a
 * two-digit answer costs the same measured time as a one-digit answer, and the
 * keypad's extra motor work can never demote a fact the player actually knows.
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
 * Session shape. The length is a setting; DEFAULT_LENGTH is what a new player
 * gets. It is the shortest option: a round is one trail's facts, so ten
 * questions is a short, finishable round.
 *
 * LENGTH_OPTIONS is short on purpose: a free-entry number is a knob a child can
 * set to 200. Three lengths cover the default, "a bit more", and "let me keep
 * going".
 *
 * DAILY_GOAL.FACTS is deliberately NOT derived from this. The goal is a day's
 * worth of practice; if it tracked the session length, the default session
 * alone would always meet it, which is the opposite of what a goal is for.
 */
export const SESSION = Object.freeze({
  LENGTH_OPTIONS: Object.freeze([10, 20, 30]),
  DEFAULT_LENGTH: 10,
})

/**
 * The trail the token walks.
 *
 * Every trail is the same length, and every correct answer moves the token one
 * space. Nothing gates it: the fact strength a player has built decides which
 * fact is asked next (see FactSelector), not whether the token may move.
 *
 * SPACES is 20, so a trail takes 19 correct answers: two rounds of 10 if every
 * answer is right, and a few if some are not. It is fixed rather than
 * proportional to the fact count, so a trail of 8 facts and one of 10 take about
 * the same time, and 20 is the longest the play-screen strip has always fitted.
 */
export const TRAIL = Object.freeze({
  SPACES: 20,
})

/** The trail token. One emoji, no cosmetics to unlock. */
export const TOKEN_EMOJI = "🥾"

/**
 * The five trails, in the order the hub lists them.
 *
 * Each is themed on a PATTERN rather than on a times table, and a trail always
 * practices all of its own facts.
 *
 * `match` is the definition; `FACT_IDS_BY_TRAIL` in facts.js derives the fact
 * list from it, and `constants.test.js` checks the five sets cover all 36 facts
 * with no gaps. The sets deliberately OVERLAP -- 2x5 is a double and a five,
 * 9x9 is a nine and a square -- because the mastery record is per canonical
 * fact and shared, so getting 5x5 right advances Fives and Squares at once.
 * `new` in the table below is how many facts each trail adds that no earlier
 * trail already covers:
 *
 * | Trail   | Facts | New |
 * | ------- | ----- | --- |
 * | Doubles | 8     | 8   |
 * | Fives   | 8     | 7   |
 * | Squares | 8     | 6   |
 * | Nines   | 8     | 5   |
 * | Tough   | 10    | 10  |
 *
 * Tough is the ten facts left once the four patterns are taken away, and it is
 * `PATTERN_FREE_IDS` below under another name -- the two are checked against
 * each other rather than written out twice.
 */
export const TRAILS = Object.freeze([
  Object.freeze({
    id: "doubles",
    name: "Doubles",
    emoji: "\u{1f43e}",
    blurb: "Everything times two. Double it and you are done.",
    match: (fact) => fact.a === 2 || fact.b === 2,
  }),
  Object.freeze({
    id: "fives",
    name: "Fives",
    emoji: "\u{1f590}️",
    blurb: "Everything times five. They all end in 5 or 0.",
    match: (fact) => fact.a === 5 || fact.b === 5,
  }),
  Object.freeze({
    id: "squares",
    name: "Squares",
    emoji: "\u{1f532}",
    blurb: "A number times itself.",
    match: (fact) => fact.isSquare,
  }),
  Object.freeze({
    id: "nines",
    name: "Nines",
    emoji: "\u{1f308}",
    blurb: "Everything times nine. The digits always add up to 9.",
    match: (fact) => fact.a === 9 || fact.b === 9,
  }),
  Object.freeze({
    id: "tough",
    name: "The Tough Ten",
    emoji: "\u{1f409}",
    blurb: "The ones with no trick. You just have to know them.",
    match: (fact) => fact.isTough,
  }),
])

/** The trail a new save starts on: the cheapest pattern to learn. */
export const DEFAULT_TRAIL_ID = TRAILS[0].id

/**
 * The pattern-free facts: what is left after the doubling (x2), x5, x9-trick and
 * square shortcuts are taken away, so they have to be recalled rather than
 * derived. Ten of them, not twelve -- the name says what the list is, not how
 * long it happens to be.
 *
 * That definition derives the list exactly -- drop every canonical fact
 * containing a 2, 5 or 9, then drop the squares, and these ten remain.
 * `constants.test.js` re-derives it rather than restating it, so the list and
 * this comment cannot drift apart again.
 */
export const PATTERN_FREE_IDS = Object.freeze([
  "3x4",
  "3x6",
  "3x7",
  "3x8",
  "4x6",
  "4x7",
  "4x8",
  "6x7",
  "6x8",
  "7x8",
])

/**
 * Star scoring. A correct answer earns BASE, plus a tier bonus that pays most
 * for the facts she knows least, plus KEYPAD_BONUS for typing the answer, all
 * multiplied by the session-streak multiplier.
 */
export const STARS = Object.freeze({
  BASE: 10,
  /** Weakest facts pay the most, so practice goes where it is needed. */
  TIER_BONUS: Object.freeze({ weak: 10, strengthening: 5, mastered: 0 }),
  KEYPAD_BONUS: 5, // typing the answer is harder than recognizing it
  /** Ascending by threshold. Largest threshold <= streak wins. */
  STREAK_MULTIPLIERS: Object.freeze([
    Object.freeze({ minStreak: 0, multiplier: 1 }),
    Object.freeze({ minStreak: 3, multiplier: 1.5 }),
    Object.freeze({ minStreak: 6, multiplier: 2 }),
    Object.freeze({ minStreak: 10, multiplier: 3 }),
  ]),
})

/**
 * Gem milestones, in award order. `metric` names a field of the
 * MilestoneMetrics object built by Scoring. Gems are only ever added and never
 * spent -- they are trophies shown in the hub and the summary.
 *
 * Grouped by metric, thresholds ascending within each metric, so a single pass
 * can award every newly crossed milestone. The smallest factsCorrect threshold
 * is deliberately below the shortest SESSION.LENGTH_OPTIONS entry so even a
 * 10-question first session earns a gem mid-play rather than promising one
 * weeks away.
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
    id: "trails-1",
    metric: "completedTrailCount",
    threshold: 1,
    gems: 3,
    label: "A whole trail finished",
  }),
  Object.freeze({
    id: "trails-3",
    metric: "completedTrailCount",
    threshold: 3,
    gems: 4,
    label: "Three trails finished",
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
 * reason: a miss reveals the answer, and that is not worth showing if the scaffold replaces the play area in the same synchronous
 * turn. It is longer than CORRECT_FEEDBACK_MS because a wrong answer is the one
 * moment the player needs time to look before being taught.
 *
 * SCAFFOLD_DWELL_MS is the quiet time AFTER the last skip-count number lights,
 * so it is thinking time, not animation time -- the array and the whole
 * skip-count row are already on screen and still. 1400ms was not enough to read
 * "6, 12, 18, 24, 30, 36, 42" and connect it to the 7x6 array above it, and the
 * auto-advance took the answer away mid-thought. "Got it" is always there for a
 * player who is done sooner, so the cost of being generous here is nil.
 */
export const TIMING = Object.freeze({
  CORRECT_FEEDBACK_MS: 700, // hold after a correct answer before the next question
  WRONG_FEEDBACK_MS: 900, // hold after a miss so the marked answer can be seen
  SKIP_COUNT_TICK_MS: 450, // one skip-count number lights per tick
  SCAFFOLD_DWELL_MS: 3500, // quiet time after the last skip-count number
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

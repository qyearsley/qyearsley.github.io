import { describe, test, expect } from "@jest/globals"
import * as constants from "../js/constants.js"
import {
  ALL_TABLES,
  ANSWER_KEYS,
  CARD_TIERS,
  DAILY_GOAL,
  DAY_MS,
  DECAY,
  DEFAULT_TABLES,
  DISTRACTORS,
  FLAME_STAGES,
  GEM_MILESTONES,
  INPUT_MODE,
  KEYPAD,
  KEYPAD_MIN_STRENGTH,
  MATH,
  MINUTE_MS,
  MODE_IDS,
  MODE_LABELS,
  OPERAND_MAX,
  OPERAND_MIN,
  REGIONS,
  RESPONSE_TIME,
  SELECTION,
  SESSION,
  STARS,
  STORAGE,
  STRENGTH,
  STRENGTH_INTERVALS_MS,
  TIMING,
  TOKEN_EMOJI,
  TOTAL_FACTS,
  PATTERN_FREE_IDS,
  TRAIL,
} from "../js/constants.js"

/** Ids other modules parse: lowercase kebab-case, digits allowed in a segment. */
const KEBAB_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** Canonical fact id, the shape facts.js and storage.js validate against. */
const FACT_ID = /^([2-9])x([2-9])$/

/** The six fields of the MilestoneMetrics object Scoring builds (spec 9). */
const MILESTONE_METRIC_NAMES = [
  "sessionsCompleted",
  "factsCorrect",
  "starsTotal",
  "masteredCount",
  "unlockedRegionCount",
  "streakDays",
]

/** True when every value is strictly greater than the one before it. */
function isStrictlyIncreasing(values) {
  return values.every((value, index) => index === 0 || value > values[index - 1])
}

/** True when no value is smaller than the one before it. */
function isNonDecreasing(values) {
  return values.every((value, index) => index === 0 || value >= values[index - 1])
}

/** Number of contiguous runs of equal values, e.g. [a, a, b, a] => 3. */
function runCount(values) {
  return values.filter((value, index) => index === 0 || value !== values[index - 1]).length
}

describe("fact set bounds", () => {
  describe("operand range", () => {
    test("both bounds are integers with MIN below MAX", () => {
      expect(Number.isInteger(OPERAND_MIN)).toBe(true)
      expect(Number.isInteger(OPERAND_MAX)).toBe(true)
      expect(OPERAND_MIN).toBeLessThan(OPERAND_MAX)
    })

    test("the range is the one baked into the fact id regex", () => {
      expect(OPERAND_MIN).toBe(2)
      expect(OPERAND_MAX).toBe(9)
    })
  })

  describe("TOTAL_FACTS", () => {
    test("is 36", () => {
      expect(TOTAL_FACTS).toBe(36)
    })

    test("equals the upper triangle of the operand range", () => {
      const span = OPERAND_MAX - OPERAND_MIN + 1
      expect(TOTAL_FACTS).toBe((span * (span + 1)) / 2)
    })
  })
})

describe("STRENGTH", () => {
  describe("tier boundaries", () => {
    test("the weak, strengthening, and mastered bands are contiguous", () => {
      expect(STRENGTH.WEAK_MAX + 1).toBe(STRENGTH.STRENGTHENING)
      expect(STRENGTH.STRENGTHENING + 1).toBe(STRENGTH.MASTERED_MIN)
    })

    test("every boundary sits inside MIN..MAX", () => {
      for (const key of ["WEAK_MAX", "STRENGTHENING", "MASTERED_MIN", "SLOW_CAP"]) {
        expect(Number.isInteger(STRENGTH[key])).toBe(true)
        expect(STRENGTH[key]).toBeGreaterThanOrEqual(STRENGTH.MIN)
        expect(STRENGTH[key]).toBeLessThanOrEqual(STRENGTH.MAX)
      }
    })

    test("MIN is below MAX", () => {
      expect(STRENGTH.MIN).toBeLessThan(STRENGTH.MAX)
    })
  })

  describe("SLOW_CAP", () => {
    test("is the top of the strengthening band, not of the mastered band", () => {
      // SLOW_CAP bounds where a slow answer can lift a fact TO. It is not a pin
      // below MASTERED_MIN: a strength-5 fact answered slowly steps down to 4,
      // which is still mastered. See MasteryModel's _promote.
      expect(STRENGTH.SLOW_CAP).toBe(STRENGTH.STRENGTHENING)
      expect(STRENGTH.SLOW_CAP).toBeLessThan(STRENGTH.MASTERED_MIN)
    })

    test("is high enough to open a trail gate, so slow practice still moves", () => {
      expect(STRENGTH.SLOW_CAP).toBeGreaterThanOrEqual(TRAIL.UNLOCK_MIN_STRENGTH)
    })
  })
})

describe("RESPONSE_TIME", () => {
  describe("band ordering", () => {
    test("fluent is below slow, which is below the recording clamp", () => {
      expect(RESPONSE_TIME.FLUENT_MS).toBeLessThan(RESPONSE_TIME.SLOW_MS)
      expect(RESPONSE_TIME.SLOW_MS).toBeLessThan(RESPONSE_TIME.MAX_RECORDED_MS)
    })
  })

  describe("threshold values", () => {
    test("are the thresholds MasteryModel classifies against", () => {
      expect(RESPONSE_TIME.FLUENT_MS).toBe(5000)
      expect(RESPONSE_TIME.SLOW_MS).toBe(12000)
    })

    test("SLOW_MS leaves room for counting up to a fact", () => {
      // Counting to 42 by sevens takes roughly ten seconds. A boundary below
      // that filed reliable correct answers under "counting", where they made
      // the least progress -- the opposite of what the band is for.
      expect(RESPONSE_TIME.SLOW_MS).toBeGreaterThanOrEqual(10000)
    })

    test("the clamp is a whole minute", () => {
      expect(RESPONSE_TIME.MAX_RECORDED_MS).toBe(MINUTE_MS)
    })
  })
})

describe("time units", () => {
  describe("MINUTE_MS and DAY_MS", () => {
    test("hold the values other modules compute intervals from", () => {
      expect(MINUTE_MS).toBe(60 * 1000)
      expect(DAY_MS).toBe(24 * 60 * 60 * 1000)
    })

    test("agree with each other", () => {
      expect(DAY_MS).toBe(24 * 60 * MINUTE_MS)
    })
  })
})

describe("STRENGTH_INTERVALS_MS", () => {
  describe("shape", () => {
    test("has one entry per Leitner box", () => {
      expect(STRENGTH_INTERVALS_MS).toHaveLength(STRENGTH.MAX + 1)
    })

    test("strength 0 is due immediately", () => {
      expect(STRENGTH_INTERVALS_MS[STRENGTH.MIN]).toBe(0)
    })
  })

  describe("monotonicity", () => {
    test("intervals strictly increase with strength", () => {
      expect(isStrictlyIncreasing([...STRENGTH_INTERVALS_MS])).toBe(true)
    })

    test("every interval above 0 is a positive whole number of milliseconds", () => {
      for (const interval of STRENGTH_INTERVALS_MS.slice(1)) {
        expect(Number.isInteger(interval)).toBe(true)
        expect(interval).toBeGreaterThan(0)
      }
    })
  })
})

describe("DECAY", () => {
  describe("floors", () => {
    test("a seen fact floors above an unseen one", () => {
      expect(DECAY.FLOOR_UNSEEN).toBeLessThan(DECAY.FLOOR_SEEN)
    })

    test("both floors are valid strengths", () => {
      for (const floor of [DECAY.FLOOR_SEEN, DECAY.FLOOR_UNSEEN]) {
        expect(floor).toBeGreaterThanOrEqual(STRENGTH.MIN)
        expect(floor).toBeLessThanOrEqual(STRENGTH.MAX)
      }
    })
  })

  describe("PERIOD_MS", () => {
    test("is a whole number of days", () => {
      expect(DECAY.PERIOD_MS % DAY_MS).toBe(0)
      expect(DECAY.PERIOD_MS / DAY_MS).toBe(14)
    })

    test("outlasts the longest review interval, so a due fact does not decay at once", () => {
      expect(DECAY.PERIOD_MS).toBeGreaterThan(0)
      expect(DECAY.PERIOD_MS).toBeLessThan(STRENGTH_INTERVALS_MS[STRENGTH.MAX])
    })
  })
})

describe("SELECTION", () => {
  describe("WEAK_RATIO", () => {
    test("is a probability that favors the weak bucket", () => {
      expect(SELECTION.WEAK_RATIO).toBeGreaterThan(0.5)
      expect(SELECTION.WEAK_RATIO).toBeLessThan(1)
    })
  })

  describe("retry delay", () => {
    test("MIN is at or below MAX and both are positive integers", () => {
      expect(Number.isInteger(SELECTION.RETRY_DELAY_MIN)).toBe(true)
      expect(Number.isInteger(SELECTION.RETRY_DELAY_MAX)).toBe(true)
      expect(SELECTION.RETRY_DELAY_MIN).toBeGreaterThan(0)
      expect(SELECTION.RETRY_DELAY_MIN).toBeLessThanOrEqual(SELECTION.RETRY_DELAY_MAX)
    })

    test("the delay span fits inside a session", () => {
      expect(SELECTION.RETRY_DELAY_MAX).toBeLessThan(Math.min(...SESSION.LENGTH_OPTIONS))
    })
  })

  describe("DUE_WEIGHT_BONUS", () => {
    test("is a multiplier above 1, so a due fact really is favored", () => {
      expect(SELECTION.DUE_WEIGHT_BONUS).toBeGreaterThan(1)
    })
  })
})

describe("DISTRACTORS", () => {
  describe("option supply", () => {
    test("at least two tiles are shown", () => {
      expect(DISTRACTORS.OPTION_COUNT).toBeGreaterThanOrEqual(2)
    })

    test("the priority window covers the distractors needed, so no padding path exists", () => {
      expect(DISTRACTORS.PRIORITY_WINDOW).toBeGreaterThanOrEqual(DISTRACTORS.OPTION_COUNT - 1)
    })
  })
})

describe("ANSWER_KEYS", () => {
  describe("shape", () => {
    test("is a-d, in tile order", () => {
      expect(ANSWER_KEYS).toEqual(["a", "b", "c", "d"])
    })

    test("is lowercase single letters, never digits", () => {
      for (const key of ANSWER_KEYS) {
        expect(key).toMatch(/^[a-z]$/)
      }
    })

    test("has no duplicates, so no two tiles share a key", () => {
      expect(new Set(ANSWER_KEYS).size).toBe(ANSWER_KEYS.length)
    })
  })

  describe("coverage of the tiles", () => {
    test("there is a key for every tile a normal question shows", () => {
      expect(ANSWER_KEYS.length).toBeGreaterThanOrEqual(DISTRACTORS.OPTION_COUNT)
    })
  })
})

describe("table settings", () => {
  // Pinned by name, not just by shape: GRID was removed with the array builder
  // and four JSDoc `entry` unions went on advertising it, because nothing failed.
  describe("INPUT_MODE membership", () => {
    test("is exactly TILES and KEYPAD", () => {
      expect(Object.keys(INPUT_MODE).sort()).toEqual(["KEYPAD", "TILES"])
    })
  })

  describe("KEYPAD_MIN_STRENGTH", () => {
    test("starts every fact on the keypad (keypad-only trial)", () => {
      expect(KEYPAD_MIN_STRENGTH).toBe(STRENGTH.MIN)
    })

    test("is null or a valid strength", () => {
      if (KEYPAD_MIN_STRENGTH === null) return
      expect(Number.isInteger(KEYPAD_MIN_STRENGTH)).toBe(true)
      expect(KEYPAD_MIN_STRENGTH).toBeGreaterThanOrEqual(STRENGTH.MIN)
      expect(KEYPAD_MIN_STRENGTH).toBeLessThanOrEqual(STRENGTH.MAX)
    })
  })

  describe("DEFAULT_TABLES", () => {
    test("is a non-empty subset of ALL_TABLES, ascending and unique", () => {
      expect(DEFAULT_TABLES.length).toBeGreaterThan(0)
      expect(new Set(DEFAULT_TABLES).size).toBe(DEFAULT_TABLES.length)
      expect(isStrictlyIncreasing([...DEFAULT_TABLES])).toBe(true)
      for (const table of DEFAULT_TABLES) {
        expect(ALL_TABLES).toContain(table)
      }
    })

    // The whole point of dropping the difficulty presets: a new player gets the
    // entire fact set and the toggles are for narrowing it, not for opting in.
    test("turns every table on", () => {
      expect([...DEFAULT_TABLES]).toEqual([...ALL_TABLES])
    })
  })
})

describe("ALL_TABLES", () => {
  describe("coverage", () => {
    test("is exactly the operand range, ascending", () => {
      const expected = []
      for (let table = OPERAND_MIN; table <= OPERAND_MAX; table += 1) expected.push(table)
      expect([...ALL_TABLES]).toEqual(expected)
    })
  })
})

describe("INPUT_MODE", () => {
  describe("values", () => {
    test("are distinct kebab-case ids", () => {
      const values = Object.values(INPUT_MODE)
      expect(new Set(values).size).toBe(values.length)
      for (const value of values) {
        expect(value).toMatch(KEBAB_ID)
      }
    })
  })
})

describe("MODE_LABELS", () => {
  describe("coverage of MODE_IDS", () => {
    test("has one entry per mode id and no extras", () => {
      expect(Object.keys(MODE_LABELS).sort()).toEqual(Object.values(MODE_IDS).sort())
    })

    test("every label is a non-empty string", () => {
      for (const label of Object.values(MODE_LABELS)) {
        expect(typeof label).toBe("string")
        expect(label.length).toBeGreaterThan(0)
      }
    })
  })

  describe("MODE_IDS", () => {
    test("values are distinct kebab-case ids", () => {
      const ids = Object.values(MODE_IDS)
      expect(new Set(ids).size).toBe(ids.length)
      for (const id of ids) {
        expect(id).toMatch(KEBAB_ID)
      }
    })
  })
})

describe("SESSION", () => {
  describe("LENGTH_OPTIONS", () => {
    test("every option is a positive integer, ascending and unique", () => {
      expect(SESSION.LENGTH_OPTIONS.length).toBeGreaterThan(0)
      expect(new Set(SESSION.LENGTH_OPTIONS).size).toBe(SESSION.LENGTH_OPTIONS.length)
      expect(isStrictlyIncreasing([...SESSION.LENGTH_OPTIONS])).toBe(true)
      for (const length of SESSION.LENGTH_OPTIONS) {
        expect(Number.isInteger(length)).toBe(true)
        expect(length).toBeGreaterThan(0)
      }
    })

    test("DEFAULT_LENGTH is one of the offered options", () => {
      expect(SESSION.LENGTH_OPTIONS).toContain(SESSION.DEFAULT_LENGTH)
    })

    // Not every option: the point of the 10-question session is that it is
    // shorter than a day's practice, so the goal takes two of them.
    test("the default session is enough to meet the daily goal", () => {
      expect(SESSION.DEFAULT_LENGTH).toBeGreaterThanOrEqual(DAILY_GOAL.FACTS)
    })
  })
})

describe("TRAIL", () => {
  describe("space arithmetic", () => {
    test("TOTAL_SPACES is SPACES_PER_REGION times the region count", () => {
      expect(TRAIL.TOTAL_SPACES).toBe(TRAIL.SPACES_PER_REGION * REGIONS.length)
    })

    test("TOTAL_SPACES equals the sum of the regions' own spans", () => {
      const sum = REGIONS.reduce((total, region) => total + region.spaces, 0)
      expect(sum).toBe(TRAIL.TOTAL_SPACES)
    })

    test("every region spans SPACES_PER_REGION spaces", () => {
      for (const region of REGIONS) {
        expect(region.spaces).toBe(TRAIL.SPACES_PER_REGION)
      }
    })
  })

  describe("UNLOCK_FRACTION", () => {
    test("is a fraction above 0 and at most 1", () => {
      expect(TRAIL.UNLOCK_FRACTION).toBeGreaterThan(0)
      expect(TRAIL.UNLOCK_FRACTION).toBeLessThanOrEqual(1)
    })
  })

  describe("UNLOCK_MIN_STRENGTH", () => {
    test("is the strengthening bar, deliberately below MASTERED_MIN", () => {
      // Movement and fluency are separate bars: a child who is reliably correct
      // should see her token move while she is still slow, and "mastered" is
      // reserved for the foiled card and the mastered-* milestones.
      expect(TRAIL.UNLOCK_MIN_STRENGTH).toBe(STRENGTH.STRENGTHENING)
      expect(TRAIL.UNLOCK_MIN_STRENGTH).toBeLessThan(STRENGTH.MASTERED_MIN)
    })

    test("is a reachable strength", () => {
      expect(Number.isInteger(TRAIL.UNLOCK_MIN_STRENGTH)).toBe(true)
      expect(TRAIL.UNLOCK_MIN_STRENGTH).toBeGreaterThan(STRENGTH.MIN)
      expect(TRAIL.UNLOCK_MIN_STRENGTH).toBeLessThanOrEqual(STRENGTH.MAX)
    })
  })

  describe("SPACES_PER_CORRECT", () => {
    test("moves the token at least one space per correct answer", () => {
      expect(TRAIL.SPACES_PER_CORRECT).toBeGreaterThanOrEqual(1)
    })

    test("a full session can walk the whole trail at most once", () => {
      expect(Math.max(...SESSION.LENGTH_OPTIONS) * TRAIL.SPACES_PER_CORRECT).toBeLessThanOrEqual(
        TRAIL.TOTAL_SPACES,
      )
    })
  })
})

describe("TOKEN_EMOJI", () => {
  describe("value", () => {
    test("is a non-empty string", () => {
      expect(typeof TOKEN_EMOJI).toBe("string")
      expect(TOKEN_EMOJI.length).toBeGreaterThan(0)
    })
  })
})

describe("REGIONS", () => {
  describe("shape", () => {
    test("there are eight regions", () => {
      expect(REGIONS).toHaveLength(8)
    })

    test("ids are unique and kebab-case", () => {
      const ids = REGIONS.map((region) => region.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const id of ids) {
        expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/)
      }
    })

    test("every region has a name and an emoji", () => {
      for (const region of REGIONS) {
        expect(typeof region.name).toBe("string")
        expect(region.name.length).toBeGreaterThan(0)
        expect(typeof region.emoji).toBe("string")
        expect(region.emoji.length).toBeGreaterThan(0)
      }
    })
  })

  describe("table coverage", () => {
    test("the region tables are exactly ALL_TABLES, in walking order", () => {
      expect(REGIONS.map((region) => region.table)).toEqual([...ALL_TABLES])
    })

    test("no table is owned by two regions", () => {
      const tables = REGIONS.map((region) => region.table)
      expect(new Set(tables).size).toBe(tables.length)
    })

    test("the regions partition all 36 facts by larger operand", () => {
      const owned = REGIONS.reduce((total, region) => total + (region.table - OPERAND_MIN + 1), 0)
      expect(owned).toBe(TOTAL_FACTS)
    })
  })
})

describe("PATTERN_FREE_IDS", () => {
  describe("shape", () => {
    test("has ten unique entries: the name says what they are, not how many", () => {
      expect(PATTERN_FREE_IDS).toHaveLength(10)
      expect(new Set(PATTERN_FREE_IDS).size).toBe(PATTERN_FREE_IDS.length)
    })
  })

  describe("fact id format", () => {
    test("every entry is a canonical fact id inside the operand range", () => {
      for (const id of PATTERN_FREE_IDS) {
        const match = FACT_ID.exec(id)
        expect(match).not.toBeNull()
        const a = Number(match[1])
        const b = Number(match[2])
        expect(a).toBeLessThanOrEqual(b)
        expect(a).toBeGreaterThanOrEqual(OPERAND_MIN)
        expect(b).toBeLessThanOrEqual(OPERAND_MAX)
      }
    })
  })

  describe("matches its own definition", () => {
    // The doc comment defines the list as a derivation, not as a list. Deriving
    // it here rather than restating the ten ids is what stops the two drifting:
    // the previous list said it excluded squares and then included 6x6 and 7x7.
    test("is exactly the canonical facts left after doubles, fives, nines and squares", () => {
      const SHORTCUT_OPERANDS = new Set([2, 5, 9])
      const derived = []
      for (let a = OPERAND_MIN; a <= OPERAND_MAX; a++) {
        for (let b = a; b <= OPERAND_MAX; b++) {
          if (a === b) continue // squares
          if (SHORTCUT_OPERANDS.has(a) || SHORTCUT_OPERANDS.has(b)) continue
          derived.push(`${a}x${b}`)
        }
      }
      expect([...PATTERN_FREE_IDS].sort()).toEqual(derived.sort())
    })
  })
})

describe("STARS", () => {
  describe("TIER_BONUS", () => {
    test("pays most for the weakest facts and nothing for mastered ones", () => {
      expect(STARS.TIER_BONUS.weak).toBeGreaterThan(STARS.TIER_BONUS.strengthening)
      expect(STARS.TIER_BONUS.strengthening).toBeGreaterThan(STARS.TIER_BONUS.mastered)
      expect(STARS.TIER_BONUS.mastered).toBe(0)
    })

    test("covers exactly the three scored mastery tiers", () => {
      expect(Object.keys(STARS.TIER_BONUS).sort()).toEqual(["mastered", "strengthening", "weak"])
    })
  })

  describe("bonuses", () => {
    test("BASE and KEYPAD_BONUS are positive", () => {
      expect(STARS.BASE).toBeGreaterThan(0)
      expect(STARS.KEYPAD_BONUS).toBeGreaterThan(0)
    })
  })

  describe("STREAK_MULTIPLIERS", () => {
    test("thresholds start at 0 and strictly increase", () => {
      const thresholds = STARS.STREAK_MULTIPLIERS.map((tier) => tier.minStreak)
      expect(thresholds[0]).toBe(0)
      expect(isStrictlyIncreasing(thresholds)).toBe(true)
    })

    test("multipliers never decrease and start at 1", () => {
      const multipliers = STARS.STREAK_MULTIPLIERS.map((tier) => tier.multiplier)
      expect(multipliers[0]).toBe(1)
      expect(isNonDecreasing(multipliers)).toBe(true)
    })

    test("the last multiplier is MAX_MULTIPLIER", () => {
      const last = STARS.STREAK_MULTIPLIERS[STARS.STREAK_MULTIPLIERS.length - 1]
      expect(last.multiplier).toBe(STARS.MAX_MULTIPLIER)
    })

    test("no tier exceeds MAX_MULTIPLIER", () => {
      for (const tier of STARS.STREAK_MULTIPLIERS) {
        expect(tier.multiplier).toBeLessThanOrEqual(STARS.MAX_MULTIPLIER)
      }
    })

    test("the top tier is reachable inside a single session", () => {
      const last = STARS.STREAK_MULTIPLIERS[STARS.STREAK_MULTIPLIERS.length - 1]
      expect(last.minStreak).toBeLessThanOrEqual(Math.min(...SESSION.LENGTH_OPTIONS))
    })
  })
})

describe("GEM_MILESTONES", () => {
  describe("shape", () => {
    test("has exactly eight entries", () => {
      expect(GEM_MILESTONES).toHaveLength(8)
    })

    test("ids are unique and kebab-case", () => {
      const ids = GEM_MILESTONES.map((milestone) => milestone.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const id of ids) {
        expect(id).toMatch(KEBAB_ID)
      }
    })

    test("every entry awards gems for a positive threshold and has a label", () => {
      for (const milestone of GEM_MILESTONES) {
        expect(milestone.gems).toBeGreaterThan(0)
        expect(Number.isInteger(milestone.gems)).toBe(true)
        expect(milestone.threshold).toBeGreaterThan(0)
        expect(typeof milestone.label).toBe("string")
        expect(milestone.label.length).toBeGreaterThan(0)
      }
    })

    test("every entry has exactly the five documented keys", () => {
      for (const milestone of GEM_MILESTONES) {
        expect(Object.keys(milestone).sort()).toEqual([
          "gems",
          "id",
          "label",
          "metric",
          "threshold",
        ])
      }
    })
  })

  describe("metrics", () => {
    test("every metric names a MilestoneMetrics field", () => {
      for (const milestone of GEM_MILESTONES) {
        expect(MILESTONE_METRIC_NAMES).toContain(milestone.metric)
      }
    })
  })

  describe("ordering", () => {
    test("entries are grouped by metric, so one pass can award them all", () => {
      const metrics = GEM_MILESTONES.map((milestone) => milestone.metric)
      expect(runCount(metrics)).toBe(new Set(metrics).size)
    })

    test("thresholds strictly increase within each metric", () => {
      for (const metric of new Set(GEM_MILESTONES.map((m) => m.metric))) {
        const thresholds = GEM_MILESTONES.filter((m) => m.metric === metric).map((m) => m.threshold)
        expect(isStrictlyIncreasing(thresholds)).toBe(true)
      }
    })
  })

  describe("first-session reachability", () => {
    test("the smallest factsCorrect threshold fits inside one session", () => {
      const thresholds = GEM_MILESTONES.filter((m) => m.metric === "factsCorrect").map(
        (m) => m.threshold,
      )
      expect(thresholds.length).toBeGreaterThan(0)
      expect(Math.min(...thresholds)).toBeLessThanOrEqual(Math.min(...SESSION.LENGTH_OPTIONS))
    })

    test("the region milestone is reachable on the trail as laid out", () => {
      const regionMilestones = GEM_MILESTONES.filter((m) => m.metric === "unlockedRegionCount")
      for (const milestone of regionMilestones) {
        expect(milestone.threshold).toBeLessThanOrEqual(REGIONS.length)
      }
    })
  })
})

describe("DAILY_GOAL", () => {
  describe("FACTS", () => {
    test("is a positive integer", () => {
      expect(Number.isInteger(DAILY_GOAL.FACTS)).toBe(true)
      expect(DAILY_GOAL.FACTS).toBeGreaterThan(0)
    })
  })

  describe("GRACE_GAP_DAYS", () => {
    test("forgives at least one missed day", () => {
      expect(DAILY_GOAL.GRACE_GAP_DAYS).toBeGreaterThanOrEqual(2)
    })
  })

  describe("deleted seconds arm", () => {
    test("there is no SECONDS key", () => {
      expect("SECONDS" in DAILY_GOAL).toBe(false)
    })
  })
})

describe("FLAME_STAGES", () => {
  describe("indices", () => {
    test("each stage's index is its array position", () => {
      FLAME_STAGES.forEach((stage, position) => {
        expect(stage.index).toBe(position)
      })
    })

    test("there are five stages, 0 through 4", () => {
      expect(FLAME_STAGES).toHaveLength(5)
      expect(FLAME_STAGES[FLAME_STAGES.length - 1].index).toBe(4)
    })
  })

  describe("thresholds", () => {
    test("minStreak starts at 0 and strictly increases", () => {
      const thresholds = FLAME_STAGES.map((stage) => stage.minStreak)
      expect(thresholds[0]).toBe(0)
      expect(isStrictlyIncreasing(thresholds)).toBe(true)
    })
  })

  describe("presentation", () => {
    test("ids are unique kebab-case and every stage has an emoji", () => {
      const ids = FLAME_STAGES.map((stage) => stage.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const stage of FLAME_STAGES) {
        expect(stage.id).toMatch(KEBAB_ID)
        expect(stage.emoji.length).toBeGreaterThan(0)
      }
    })
  })
})

describe("CARD_TIERS", () => {
  describe("thresholds", () => {
    test("minStrength starts at STRENGTH.MIN and strictly increases", () => {
      const thresholds = CARD_TIERS.map((tier) => tier.minStrength)
      expect(thresholds[0]).toBe(STRENGTH.MIN)
      expect(isStrictlyIncreasing(thresholds)).toBe(true)
    })

    test("the top tier starts exactly at MASTERED_MIN, so foiled means mastered", () => {
      const top = CARD_TIERS[CARD_TIERS.length - 1]
      expect(top.minStrength).toBe(STRENGTH.MASTERED_MIN)
      expect(top.minStrength).toBeLessThanOrEqual(STRENGTH.MAX)
    })
  })

  describe("ids", () => {
    test("are unique kebab-case ids", () => {
      const ids = CARD_TIERS.map((tier) => tier.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const id of ids) {
        expect(id).toMatch(KEBAB_ID)
      }
    })
  })
})

describe("TIMING", () => {
  describe("values", () => {
    test("every duration is a positive integer number of milliseconds", () => {
      for (const value of Object.values(TIMING)) {
        expect(Number.isInteger(value)).toBe(true)
        expect(value).toBeGreaterThan(0)
      }
    })

    test("CORRECT_FEEDBACK_MS outlasts the star animation it is meant to show", () => {
      expect(TIMING.CORRECT_FEEDBACK_MS).toBe(700)
      expect(TIMING.CORRECT_FEEDBACK_MS).toBeGreaterThanOrEqual(TIMING.STAR_FLY_MS)
    })

    test("WRONG_FEEDBACK_MS gives a miss longer than a correct answer gets", () => {
      expect(TIMING.WRONG_FEEDBACK_MS).toBe(900)
      expect(TIMING.WRONG_FEEDBACK_MS).toBeGreaterThan(TIMING.CORRECT_FEEDBACK_MS)
    })
  })

  describe("computed scaffold duration", () => {
    test("there is no SCAFFOLD_DISPLAY_MS key", () => {
      expect("SCAFFOLD_DISPLAY_MS" in TIMING).toBe(false)
    })

    test("the two inputs to the computed duration are both positive", () => {
      expect(TIMING.SKIP_COUNT_TICK_MS).toBeGreaterThan(0)
      expect(TIMING.SCAFFOLD_DWELL_MS).toBeGreaterThan(0)
    })

    test("the computed duration outlasts its own skip count at both extremes", () => {
      const durationFor = (rows) => rows * TIMING.SKIP_COUNT_TICK_MS + TIMING.SCAFFOLD_DWELL_MS
      expect(durationFor(OPERAND_MAX)).toBe(7550)
      expect(durationFor(OPERAND_MIN)).toBe(4400)
      expect(durationFor(OPERAND_MAX)).toBeGreaterThan(OPERAND_MAX * TIMING.SKIP_COUNT_TICK_MS)
    })

    // The dwell is thinking time after the animation stops, so it is the part
    // that has to be generous: a 2x2 array with two skip-count numbers finishes
    // animating in under a second and the player still has to read it.
    test("the quiet dwell is the majority of the shortest scaffold", () => {
      const shortest = OPERAND_MIN * TIMING.SKIP_COUNT_TICK_MS + TIMING.SCAFFOLD_DWELL_MS
      expect(TIMING.SCAFFOLD_DWELL_MS).toBeGreaterThan(shortest / 2)
    })
  })
})

describe("STORAGE", () => {
  describe("cross-module contract", () => {
    test("the localStorage key is timesTrailProgress", () => {
      expect(STORAGE.KEY).toBe("timesTrailProgress")
    })

    test("the save-schema version is 1.0", () => {
      expect(STORAGE.VERSION).toBe("1.0")
      expect(STORAGE.VERSION).toMatch(/^\d+\.\d+$/)
    })
  })
})

describe("KEYPAD", () => {
  describe("KEYS", () => {
    test("has twelve keys with no duplicates", () => {
      expect(KEYPAD.KEYS).toHaveLength(12)
      expect(new Set(KEYPAD.KEYS).size).toBe(KEYPAD.KEYS.length)
    })

    test("contains every digit 0 through 9", () => {
      for (let digit = 0; digit <= 9; digit += 1) {
        expect(KEYPAD.KEYS).toContain(String(digit))
      }
    })

    test("contains the backspace and enter keys", () => {
      expect(KEYPAD.KEYS).toContain(KEYPAD.BACKSPACE_KEY)
      expect(KEYPAD.KEYS).toContain(KEYPAD.ENTER_KEY)
    })

    test("has no clear-all key: the ⌫ face promises a single-digit delete", () => {
      expect("CLEAR_KEY" in KEYPAD).toBe(false)
      expect(KEYPAD.KEYS).not.toContain("clear")
    })

    test("is ten digits plus the two action keys, nothing else", () => {
      const digits = KEYPAD.KEYS.filter((key) => /^[0-9]$/.test(key))
      expect(digits).toHaveLength(10)
      expect(KEYPAD.KEYS).toHaveLength(digits.length + 2)
    })
  })

  describe("MAX_DIGITS", () => {
    test("fits the largest product in the fact set", () => {
      expect(KEYPAD.MAX_DIGITS).toBe(String(OPERAND_MAX * OPERAND_MAX).length)
    })
  })

  describe("EMPTY_DISPLAY", () => {
    test("is a non-empty placeholder that cannot be mistaken for a digit", () => {
      expect(KEYPAD.EMPTY_DISPLAY.length).toBeGreaterThan(0)
      expect(KEYPAD.EMPTY_DISPLAY).not.toMatch(/[0-9]/)
    })
  })
})

describe("MATH", () => {
  describe("PERCENT_MULTIPLIER", () => {
    test("is 100", () => {
      expect(MATH.PERCENT_MULTIPLIER).toBe(100)
    })
  })
})

describe("module surface", () => {
  describe("deleted knobs", () => {
    test.each([
      "COSMETICS",
      "DEFAULT_COSMETICS",
      "INPUT_MODE_SETTING",
      "FACT_ID_SEPARATOR",
      "PAD_MAX_OFFSET",
      // Renamed to PATTERN_FREE_IDS: it never held twelve ids.
      "TOUGH_DOZEN_IDS",
    ])("does not export %s", (name) => {
      expect(name in constants).toBe(false)
    })
  })

  describe("Object.freeze", () => {
    test.each([
      ["REGIONS", REGIONS],
      ["GEM_MILESTONES", GEM_MILESTONES],
      ["STRENGTH_INTERVALS_MS", STRENGTH_INTERVALS_MS],
      ["PATTERN_FREE_IDS", PATTERN_FREE_IDS],
      ["REGIONS[0]", REGIONS[0]],
      ["STRENGTH", STRENGTH],
      ["RESPONSE_TIME", RESPONSE_TIME],
      ["STARS.STREAK_MULTIPLIERS", STARS.STREAK_MULTIPLIERS],
      ["FLAME_STAGES", FLAME_STAGES],
      ["CARD_TIERS", CARD_TIERS],
      ["KEYPAD.KEYS", KEYPAD.KEYS],
      ["ALL_TABLES", ALL_TABLES],
      ["ANSWER_KEYS", ANSWER_KEYS],
    ])("%s is frozen", (_name, table) => {
      expect(Object.isFrozen(table)).toBe(true)
    })

    test("assigning to a frozen table's property does not change the value", () => {
      const before = STRENGTH.MASTERED_MIN
      expect(() => {
        STRENGTH.MASTERED_MIN = 99
      }).toThrow(TypeError)
      expect(STRENGTH.MASTERED_MIN).toBe(before)
    })

    test("pushing onto a frozen array does not change its length", () => {
      const before = REGIONS.length
      expect(() => REGIONS.push({ id: "nowhere" })).toThrow(TypeError)
      expect(REGIONS).toHaveLength(before)
    })

    test("mutating a nested frozen entry does not change it", () => {
      const before = REGIONS[0].name
      expect(() => {
        REGIONS[0].name = "Somewhere Else"
      }).toThrow(TypeError)
      expect(REGIONS[0].name).toBe(before)
    })

    test("mutating a nested frozen entry does not change it", () => {
      const before = REGIONS[0].spaces
      expect(() => {
        REGIONS[0].spaces = 999
      }).toThrow(TypeError)
      expect(REGIONS[0].spaces).toBe(before)
    })
  })
})

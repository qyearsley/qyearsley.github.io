/**
 * Tests for the Seasons content file.
 *
 * seasons.js is meant to be retuned often, so the valuable tests here are the
 * ones that guard against a retune quietly breaking the game rather than the
 * ones that restate the numbers:
 *
 * - Reachability: for every season and every character, a perfect run has to
 *   collect at least the demand, with room to spare. The Banana Slug is the
 *   binding case, because its glowing spaces pay 2 instead of 3.
 * - Escalation: spring through winter must get longer, hungrier, glowier, and
 *   faster, never the reverse.
 * - Structure: glowing indices on the trail, positive boss rescues, non-empty
 *   copy.
 *
 * `getSeason` returning null for an unknown id is deliberate and the opposite
 * of `getCharacter`, so that difference is asserted rather than assumed.
 */

import { describe, expect, it } from "@jest/globals"
import { generate } from "../js/challenges/arithmetic.js"
import { CHARACTERS } from "../js/characters.js"
import { SEASON_ORDER } from "../js/constants.js"
import { createRng } from "../js/rng.js"
import { getSeason, maxItems, nextSeason, SEASON_LIST } from "../js/seasons.js"

/**
 * How much slack a demand must leave: a season should be winnable without a
 * perfect run, so the demand is capped at this share of a perfect run's haul.
 *
 * 0.75 rather than 0.8 because the binding case is the Banana Slug, whose
 * glowing spaces pay 2 instead of 3. Her shortfall grows with the number of
 * glowing spaces, and that number grows every season, so a ceiling loose enough
 * for the default characters is far too tight for her by winter.
 */
const MAX_DEMAND_SHARE = 0.75

/** Every (season, character) pair, as `it.each` rows. */
const PAIRS = SEASON_LIST.flatMap((season) =>
  CHARACTERS.map((character) => [season.id, character.id, season, character]),
)

/**
 * Timer length as a comparable number, with "no timer" as the loosest value.
 * @param {Object} season - The season to read
 * @returns {number} Seconds per question, or Infinity when untimed
 */
function timerBound(season) {
  return season.timerSeconds === null ? Infinity : season.timerSeconds
}

/**
 * The kinds a hard space is allowed to ask.
 *
 * A **content** rule, not a difficulty one, and the distinction matters: this is
 * Ella's "division is the hardest thing in a level" surviving as "a lit mountain
 * asks division or a two-step", so a glowing space never asks a bare fact or a
 * two-digit sum however hard the numbers are. It can therefore disagree with
 * `formScore` -- `{mul, tables: TENS}` scores 3, above spring's `div [2,5,10]` at
 * 2, and is still rejected here. If that ever becomes the wrong trade, this list
 * is the thing to widen.
 */
const HARD_KINDS = ["div", "twoStep"]

/** The facts a third grader actually has to work at, rather than recite. */
const HARD_FACTS = new Set([6, 7, 8, 9])

/**
 * A coarse difficulty score for one form, counting **mental steps** rather than
 * digits.
 *
 * Deliberately crude: it exists to catch an inversion, not to freeze the tuning.
 * It has to be structural rather than measured from generated answers, because
 * answer size and difficulty point in opposite directions at the top of the
 * ladder -- `9 × 80 = 720` is one fact and a zero, while `8 × 7 + 9 = 65` is two
 * chained operations. Scoring by magnitude would rank winter's hardest question
 * below its easiest.
 *
 * @param {Object} form - An arithmetic form
 * @returns {number} Roughly, how many mental steps it takes
 */
function formScore(form) {
  const hardShare = (tables) => tables.filter((t) => HARD_FACTS.has(t)).length / tables.length
  switch (form.kind) {
    case "add":
    case "sub":
      // One column operation, plus one more step if it regroups.
      return form.borrow ? 2 : 1
    case "mul": {
      // A multiple of ten is a fact plus place value; otherwise a bare fact,
      // weighted by how many of its tables are ones that need working out. The
      // tens case also reads how far the range runs, so that widening 10-50 to
      // 10-90 registers as the step up the README describes it as.
      if (form.tables.every((table) => table % 10 === 0)) {
        return 3 + (Math.max(...form.tables) - 10) / 100
      }
      return 1 + hardShare(form.tables)
    }
    case "div":
      // Harder to recall than the matching multiplication fact.
      return 2 + hardShare(form.tables)
    case "twoStep":
      // Two chained operations: the ceiling of what grade 3 can do mentally. Still
      // weighted by the tables, so dropping the boss to `2 × 3 + 4` scores lower
      // rather than scoring the same as `8 × 7 + 9`.
      return 3 + hardShare(form.tables)
    default:
      return 1
  }
}

/**
 * The mean score of a form list, which is what a player actually meets, since
 * `generate` picks one form per question at random.
 * @param {Array<Object>} forms - A season's `forms`, `glowingForms` or boss forms
 * @returns {number} Mean difficulty
 */
function listScore(forms) {
  return forms.reduce((sum, form) => sum + formScore(form), 0) / forms.length
}

describe("SEASON_LIST", () => {
  // The one deliberately hard-coded list in this file, and the only line to
  // touch when Ella adds a season. Everything below sweeps SEASON_LIST, so a
  // fifth season costs exactly this edit.
  it("is the published set of seasons, in play order", () => {
    expect(SEASON_LIST.map((season) => season.id)).toEqual(SEASON_ORDER)
    expect(SEASON_ORDER).toEqual(["spring", "summer", "autumn", "winter"])
  })

  it("has unique ids", () => {
    const ids = SEASON_LIST.map((season) => season.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("has no holes -- every id in SEASON_ORDER resolves", () => {
    for (const id of SEASON_ORDER) {
      expect(getSeason(id)).not.toBeNull()
      expect(getSeason(id).id).toBe(id)
    }
  })
})

describe.each(SEASON_LIST.map((season) => [season.id, season]))("%s", (_id, season) => {
  it("has non-empty copy in every text field", () => {
    for (const field of ["id", "name", "itemName", "itemPlural", "rareItemName", "demandText"]) {
      expect(typeof season[field]).toBe("string")
      expect(season[field].trim().length).toBeGreaterThan(0)
    }
    expect(season.challenge).toBe("arithmetic")
  })

  it("has positive whole numbers for spaces and demand", () => {
    expect(Number.isInteger(season.spaces)).toBe(true)
    expect(season.spaces).toBeGreaterThan(0)
    expect(Number.isInteger(season.demand)).toBe(true)
    expect(season.demand).toBeGreaterThan(0)
  })

  it("has either no timer or a positive one", () => {
    if (season.timerSeconds === null) {
      // The `else` matters: without it the untimed season runs zero assertions
      // and passes vacuously, so name which season is allowed to be untimed.
      expect(season.id).toBe("spring")
    } else {
      expect(typeof season.timerSeconds).toBe("number")
      expect(season.timerSeconds).toBeGreaterThan(0)
    }
  })

  it("has non-empty question forms for ordinary and glowing spaces", () => {
    expect(Array.isArray(season.forms)).toBe(true)
    expect(season.forms.length).toBeGreaterThan(0)
    expect(Array.isArray(season.glowingForms)).toBe(true)
    expect(season.glowingForms.length).toBeGreaterThan(0)
  })

  it("keeps division off the ordinary spaces, per Ella's rule", () => {
    // "Addition, subtraction, multiplication, maybe with division as the
    // hardest one in a level." The constraint that actually matters is
    // one-directional: division must never turn up on an ordinary space, so
    // meeting one always means the player reached a hard space. The converse is
    // not required -- a hard slot may ask something else, and winter's asks a
    // two-step, because by then plain division within 100 has run out of room.
    // Encoded here because the rule lives in a file comment otherwise, and a
    // retune that drops a `div` into `forms` would break nothing else.
    expect(season.forms.map((form) => form.kind)).not.toContain("div")
  })

  it("asks nothing but a hard kind at a hard space", () => {
    // The other half of the rule above: a lit mountain and a boss must never
    // ask a bare fact or a two-digit sum, which is what makes reaching one
    // mean something.
    for (const form of [...season.glowingForms, ...season.boss.forms]) {
      expect(HARD_KINDS).toContain(form.kind)
    }
  })

  it("keeps every individual fact inside 100", () => {
    // The single ceiling that replaced two untested conventions: no column
    // operation past two digits, and no fact outside the grade-3 tables. A
    // quotient of 12 on the 9 table is `108 ÷ 9`, which is neither.
    for (const form of [...season.forms, ...season.glowingForms, ...season.boss.forms]) {
      if (form.kind === "add" || form.kind === "sub") {
        expect(form.max).toBeLessThanOrEqual(100)
      }
      if (form.kind === "div" || form.kind === "twoStep") {
        expect(form.upTo).toBeLessThanOrEqual(10)
        expect(Math.max(...form.tables)).toBeLessThanOrEqual(10)
      }
      if (form.kind === "mul") {
        // Either plain facts, or one digit by a multiple of ten (3.NBT.A.3).
        // Both keep the fact being recalled inside the tables.
        const tens = form.tables.every((table) => table % 10 === 0 && table >= 10)
        expect(form.twoDigit).toBeFalsy()
        expect(tens ? form.upTo : Math.max(...form.tables, form.upTo)).toBeLessThanOrEqual(10)
      }
    }
  })

  it("has a boss with a positive rescue and at least one form", () => {
    expect(season.boss).toBeTruthy()
    expect(Number.isInteger(season.boss.rescue)).toBe(true)
    expect(season.boss.rescue).toBeGreaterThan(0)
    expect(Array.isArray(season.boss.forms)).toBe(true)
    expect(season.boss.forms.length).toBeGreaterThan(0)
  })

  it("puts every glowing index on the trail", () => {
    expect(Array.isArray(season.glowingAt)).toBe(true)
    expect(season.glowingAt.length).toBeGreaterThan(0)
    for (const index of season.glowingAt) {
      expect(Number.isInteger(index)).toBe(true)
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(season.spaces)
    }
  })

  it("lists no glowing index twice", () => {
    expect(new Set(season.glowingAt).size).toBe(season.glowingAt.length)
  })

  it("leaves more ordinary spaces than glowing ones", () => {
    expect(season.glowingAt.length).toBeLessThan(season.spaces - season.glowingAt.length)
  })
})

describe("reachability", () => {
  it.each(PAIRS)("%s is winnable by the %s", (_seasonId, _characterId, season, character) => {
    expect(maxItems(season, character.effects.glowingItems)).toBeGreaterThanOrEqual(season.demand)
  })

  it("is not winnable by the boss rescue alone", () => {
    // The rescue is a consolation, not a route -- otherwise the trail is
    // decoration.
    for (const season of SEASON_LIST) {
      expect(season.boss.rescue).toBeLessThan(season.demand)
    }
  })

  it.each(PAIRS)(
    "%s leaves the %s at least 25% headroom above the demand",
    (_seasonId, _characterId, season, character) => {
      // Tuned against the Banana Slug, who collects 2 from a glowing space
      // rather than 3. Her handicap scales with the number of glowing spaces,
      // which grows every season, so she is the binding constraint -- an
      // earlier set of demands left her four missable questions in the whole of
      // winter. Everyone else sits comfortably below this ceiling.
      const ceiling = maxItems(season, character.effects.glowingItems) * MAX_DEMAND_SHARE
      expect(season.demand).toBeLessThanOrEqual(ceiling)
    },
  )

  it("does not make a season so slack that the trail stops mattering", () => {
    // The other side of the headroom check: a demand far below what a perfect
    // run collects means the questions are decoration. Half is the floor.
    for (const season of SEASON_LIST) {
      for (const character of CHARACTERS) {
        const perfect = maxItems(season, character.effects.glowingItems)
        expect(season.demand).toBeGreaterThan(perfect * 0.5)
      }
    }
  })
})

describe("difficulty escalation", () => {
  const steps = SEASON_LIST.slice(1).map((season, index) => [
    `${SEASON_LIST[index].id} -> ${season.id}`,
    SEASON_LIST[index],
    season,
  ])

  it.each(steps)("%s does not get shorter", (_label, before, after) => {
    expect(after.spaces).toBeGreaterThanOrEqual(before.spaces)
  })

  it.each(steps)("%s asks for strictly more", (_label, before, after) => {
    expect(after.demand).toBeGreaterThan(before.demand)
  })

  it.each(steps)("%s does not lose glowing spaces", (_label, before, after) => {
    expect(after.glowingAt.length).toBeGreaterThanOrEqual(before.glowingAt.length)
  })

  it.each(steps)("%s does not loosen the timer", (_label, before, after) => {
    expect(timerBound(after)).toBeLessThanOrEqual(timerBound(before))
  })

  it.each(steps)("%s does not make the boss easier to survive", (_label, before, after) => {
    expect(after.boss.rescue).toBeGreaterThanOrEqual(before.boss.rescue)
  })

  it("starts untimed and ends timed", () => {
    expect(SEASON_LIST[0].timerSeconds).toBeNull()
    expect(SEASON_LIST[SEASON_LIST.length - 1].timerSeconds).toBeGreaterThan(0)
  })

  // The maths itself, which nothing checked before. What these catch is a
  // *structural* inversion: a season losing a mental step, or a hard slot dropping
  // to something with fewer steps than the trail leading to it.
  //
  // What they deliberately do not catch is a magnitude inversion. The score
  // ignores `max` and answer size on purpose, so it would not have flagged the
  // original fault where autumn asked `311 - 195` and winter's ordinary answers
  // sat at a median of 57 — by step count, old winter did out-score old autumn.
  // That class of problem is prevented by the `max: 100` cap instead, held by
  // `keeps every individual fact inside 100`.
  it.each(steps)("%s does not get arithmetically easier", (_label, before, after) => {
    expect(listScore(after.forms)).toBeGreaterThan(listScore(before.forms))
  })

  it.each(steps)("%s does not make the hard spaces easier", (_label, before, after) => {
    expect(listScore(after.glowingForms)).toBeGreaterThanOrEqual(listScore(before.glowingForms))
    expect(listScore(after.boss.forms)).toBeGreaterThanOrEqual(listScore(before.boss.forms))
  })

  it.each(SEASON_LIST.map((season) => [season.id, season]))(
    "%s asks something harder at a glowing space than on the trail",
    (_id, season) => {
      // The promise the lit mountain makes, and the one thing here that is a
      // strict inequality in both directions -- a hard slot that merely ties with
      // the trail is not a challenge.
      expect(listScore(season.glowingForms)).toBeGreaterThan(listScore(season.forms))
    },
  )

  it.each(SEASON_LIST.map((season) => [season.id, season]))(
    "%s does not make its boss easier than its glowing spaces",
    (_id, season) => {
      expect(listScore(season.boss.forms)).toBeGreaterThanOrEqual(listScore(season.glowingForms))
    },
  )

  // The scores above read the form *declarations*, which is what makes them cheap
  // -- and is also their blind spot. `{div, tables: [6,7,8,9], upTo: 10}` scores
  // the same whether its quotients run 2-10 or 7-10, so narrowing a season's
  // tables looked like a difficulty rise while the generator kept drawing from 2
  // upward. Autumn's boss, the climax of the third season, asked `12 ÷ 6 = 2`.
  // These two sample what the generator actually emits.
  const HARD_SLOTS = SEASON_LIST.flatMap((season) => [
    [`${season.id} glowing`, season.glowingForms],
    [`${season.id} boss`, season.boss.forms],
  ])

  /** Smallest answer a hard slot may offer. Below this it is not a challenge. */
  const HARD_SLOT_FLOOR = 4

  it.each(HARD_SLOTS)("%s never asks a question a younger child could do", (_label, forms) => {
    let smallest = Infinity
    for (let seed = 0; seed < 1500; seed += 1) {
      smallest = Math.min(smallest, generate(forms, createRng(`floor-${seed}`)).answer)
    }
    expect(smallest).toBeGreaterThanOrEqual(HARD_SLOT_FLOOR)
  })

  it.each(HARD_SLOTS)("%s draws from a pool worth replaying", (_label, forms) => {
    // A season can be replayed -- `RETRY_SEASON` is the default -- so a slot with
    // only a handful of possible questions becomes recall of the choice list
    // rather than of the fact. Division within 100 has a hard ceiling here: once
    // the quotient floor is raised, there are only so many facts left, and the
    // narrowest slot in the game sits at 16.
    const prompts = new Set()
    for (let seed = 0; seed < 1500; seed += 1) {
      prompts.add(generate(forms, createRng(`pool-${seed}`)).prompt)
    }
    expect(prompts.size).toBeGreaterThanOrEqual(15)
  })
})

describe("getSeason", () => {
  it.each(SEASON_ORDER)("returns %s for its own id", (id) => {
    expect(getSeason(id).id).toBe(id)
    expect(getSeason(id)).toBe(SEASON_LIST[SEASON_ORDER.indexOf(id)])
  })

  it.each([
    ["an unknown id", "monsoon"],
    ["null", null],
    ["undefined", undefined],
    ["a number", 3],
    ["zero", 0],
    ["an empty string", ""],
    ["an object", {}],
    ["an array", []],
    ["true", true],
    ["a near-miss id", "Spring"],
    ["an inherited property name", "toString"],
    ["constructor", "constructor"],
  ])("returns null, not a default, for %s", (_label, id) => {
    // Deliberately unlike getCharacter: silently substituting spring for a save
    // that says winter would erase three seasons of progress.
    expect(getSeason(id)).toBeNull()
  })
})

describe("nextSeason", () => {
  it("agrees with SEASON_ORDER for every step", () => {
    for (let i = 0; i < SEASON_ORDER.length - 1; i += 1) {
      expect(nextSeason(SEASON_ORDER[i]).id).toBe(SEASON_ORDER[i + 1])
    }
  })

  it("returns null after the last season", () => {
    expect(nextSeason(SEASON_ORDER.at(-1))).toBeNull()
  })

  it.each([
    ["an unknown id", "monsoon"],
    ["null", null],
    ["undefined", undefined],
    ["a number", 0],
    ["an empty string", ""],
    ["an object", {}],
  ])("returns null for %s", (_label, id) => {
    expect(nextSeason(id)).toBeNull()
  })

  it("reaches every season by walking from the first", () => {
    const walked = [SEASON_ORDER[0]]
    let current = getSeason(SEASON_ORDER[0])
    while (nextSeason(current.id)) {
      current = nextSeason(current.id)
      walked.push(current.id)
    }
    expect(walked).toEqual(SEASON_ORDER)
  })
})

describe("maxItems", () => {
  it("adds one per ordinary space and the character's value per glowing one", () => {
    // Spring: 14 spaces, 2 of them glowing, so 12 ordinary.
    const spring = getSeason("spring")
    expect(maxItems(spring, 3)).toBe(12 + 2 * 3)
    expect(maxItems(spring, 2)).toBe(12 + 2 * 2)
    expect(maxItems(spring, 0)).toBe(12)
  })

  // Deliberate literals. Retuning a season is *meant* to fail these -- they are
  // the one place a hand-computed number checks maxItems, and every reachability
  // test above is built on maxItems. Recompute them from seasons.js by hand;
  // do not derive them from the formula.
  //
  // Hand-computed from the trail lengths and glowing counts in seasons.js:
  // spring 12 ordinary + 2 glowing, summer 13 + 3, autumn 14 + 4, winter 15 + 5.
  //
  // Literals rather than the formula. The two tests these replaced compared
  // maxItems either to its own body (`spaces - glowing + glowing * 2`) or to
  // itself (`maxItems(season)` vs `maxItems(season, 3)`), so both passed for any
  // implementation at all -- including one that returned 0 for everything.
  // Retuning a season is meant to fail these; that is what makes them worth
  // having, because the reachability tests above are all built on maxItems.
  it.each([
    ["spring", 18, 16],
    ["summer", 22, 19],
    ["autumn", 26, 22],
    ["winter", 30, 25],
  ])("counts %s at %i items by default, %i for the Banana Slug", (id, byDefault, forSlug) => {
    const season = getSeason(id)
    expect(maxItems(season)).toBe(byDefault)
    expect(maxItems(season, 3)).toBe(byDefault)
    expect(maxItems(season, 2)).toBe(forSlug)
  })

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["zero", 0],
    ["an empty string", ""],
  ])("returns 0 for %s", (_label, season) => {
    expect(maxItems(season)).toBe(0)
  })

  it.each(SEASON_LIST.map((season) => [season.id, season]))(
    "%s rises with the character's glowing value",
    (_id, season) => {
      expect(maxItems(season, 2)).toBeLessThan(maxItems(season, 3))
    },
  )
})

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
import { CHARACTERS } from "../js/characters.js"
import { SEASON_ORDER } from "../js/constants.js"
import { getSeason, isGlowing, maxItems, nextSeason, SEASON_LIST } from "../js/seasons.js"

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

describe("SEASON_LIST", () => {
  it("has four seasons in SEASON_ORDER order", () => {
    expect(SEASON_LIST).toHaveLength(4)
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
    if (season.timerSeconds !== null) {
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
  it("walks the order", () => {
    expect(nextSeason("spring").id).toBe("summer")
    expect(nextSeason("summer").id).toBe("autumn")
    expect(nextSeason("autumn").id).toBe("winter")
  })

  it("agrees with SEASON_ORDER for every step", () => {
    for (let i = 0; i < SEASON_ORDER.length - 1; i += 1) {
      expect(nextSeason(SEASON_ORDER[i]).id).toBe(SEASON_ORDER[i + 1])
    }
  })

  it("returns null after the last season", () => {
    expect(nextSeason("winter")).toBeNull()
    expect(nextSeason(SEASON_ORDER[SEASON_ORDER.length - 1])).toBeNull()
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
    const walked = ["spring"]
    let current = getSeason("spring")
    while (nextSeason(current.id)) {
      current = nextSeason(current.id)
      walked.push(current.id)
    }
    expect(walked).toEqual(SEASON_ORDER)
  })
})

describe("isGlowing", () => {
  it.each(SEASON_ORDER)("agrees with %s's glowingAt for every space", (id) => {
    const season = getSeason(id)
    for (let index = 0; index < season.spaces; index += 1) {
      expect(isGlowing(season, index)).toBe(season.glowingAt.includes(index))
    }
  })

  it("is false off the ends of the trail", () => {
    const spring = getSeason("spring")
    expect(isGlowing(spring, -1)).toBe(false)
    expect(isGlowing(spring, spring.spaces)).toBe(false)
    expect(isGlowing(spring, 999)).toBe(false)
  })

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a number", 0],
  ])("is false for %s rather than throwing", (_label, season) => {
    expect(() => isGlowing(season, 4)).not.toThrow()
    expect(isGlowing(season, 4)).toBe(false)
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

  it("defaults to three items per glowing space", () => {
    for (const season of SEASON_LIST) {
      expect(maxItems(season)).toBe(maxItems(season, 3))
    }
  })

  it("matches the general formula for every season", () => {
    for (const season of SEASON_LIST) {
      const glowing = season.glowingAt.length
      expect(maxItems(season, 2)).toBe(season.spaces - glowing + glowing * 2)
    }
  })

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["zero", 0],
    ["an empty string", ""],
  ])("returns 0 for %s", (_label, season) => {
    expect(maxItems(season)).toBe(0)
  })

  it("rises with the character's glowing value", () => {
    const winter = getSeason("winter")
    expect(maxItems(winter, 2)).toBeLessThan(maxItems(winter, 3))
  })
})

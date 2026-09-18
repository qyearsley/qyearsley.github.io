/**
 * Journey: one themed trail, its length, and the one rule that caps the token.
 *
 * What these tests are mostly for is the property the 2026-09-18 redesign was
 * done to get: **every trail can be finished, whatever the active pool.** The
 * eight per-region gates it replaced could not promise that -- a region of one
 * to eight facts, gated at 60%, froze the token whenever the pool missed its
 * table. That is now an arithmetic consequence of one formula rather than a
 * case to handle, and "a fully strong trail always reaches its last space" is
 * swept across every trail and every table selection below.
 */

import { describe, test, expect } from "@jest/globals"
import { allTrailProgress, Journey, normalizeTrailId, trailIds } from "../js/Journey.js"
import { FACT_IDS, factIdsForTables, factIdsForTrail } from "../js/facts.js"
import { ALL_TABLES, DAY_MS, DEFAULT_TRAIL_ID, TRAIL, TRAILS } from "../js/constants.js"

/** A fixed instant, so nothing in these tests depends on the wall clock. */
const NOW = Date.UTC(2026, 5, 1)

/** The injected clock every Journey in this file uses. */
const fixedNow = () => NOW

/** Trail ids in hub order, for readable expectations. */
const TRAIL_IDS = TRAILS.map((trail) => trail.id)

/**
 * Table selections the settings modal can actually produce, derived from
 * facts.js rather than hand-copied so a change to the fact set cannot leave
 * these fixtures quietly stale.
 *
 * Chosen to span the shapes rather than to be representative: `all` leaves
 * every trail full, `sixSeven` is the shipped custom default, `sevens` narrows
 * hard, and `twos` is the case that empties trails outright -- the 7s and 9s
 * trails keep facts under it, but Squares drops to one and the pool cannot fill
 * the rest.
 */
const POOLS = {
  all: factIdsForTables([...ALL_TABLES]),
  sixSeven: factIdsForTables([6, 7]),
  sevens: factIdsForTables([7]),
  twos: factIdsForTables([2]),
}

/**
 * Records at exactly TRAIL.UNLOCK_MIN_STRENGTH: strong enough to open ground but
 * NOT mastered. This is what a reliably-correct-but-slow player's facts look
 * like, and the trail has to work for her.
 * @param {string[]} factIds - Facts to make strong
 * @returns {Object} A records map
 */
function strongRecords(factIds) {
  const records = {}
  for (const id of factIds) {
    records[id] = {
      strength: TRAIL.UNLOCK_MIN_STRENGTH,
      totalSeen: 4,
      totalCorrect: 4,
      lastSeen: NOW - DAY_MS,
      lastMs: 10000,
      dueAt: NOW + 365 * DAY_MS,
    }
  }
  return records
}

/**
 * Records for facts that are solidly mastered and will not decay.
 * @param {string[]} factIds - Facts to master
 * @returns {Object} A records map
 */
function masteredRecords(factIds) {
  const records = {}
  for (const id of factIds) {
    records[id] = {
      strength: 5,
      totalSeen: 3,
      totalCorrect: 3,
      lastSeen: NOW - DAY_MS,
      lastMs: 1200,
      dueAt: NOW + 365 * DAY_MS,
    }
  }
  return records
}

/**
 * Records stored at strength 5 but overdue by `days`, so decay has eaten into
 * them: one point per full 14-day period, floored at 1.
 * @param {string[]} factIds - Facts to decay
 * @param {number} days - How overdue they are
 * @returns {Object} A records map
 */
function decayedRecords(factIds, days) {
  const records = {}
  for (const id of factIds) {
    records[id] = {
      strength: 5,
      totalSeen: 3,
      totalCorrect: 3,
      lastSeen: NOW - (days + 1) * DAY_MS,
      lastMs: 1200,
      dueAt: NOW - days * DAY_MS,
    }
  }
  return records
}

/** A journey over one trail and the whole 36-fact set. */
function journeyFor(trailId) {
  return new Journey({ trailId, now: fixedNow })
}

/** A journey over one trail and one named table selection. */
function pooledJourney(trailId, poolName) {
  return new Journey({ trailId, now: fixedNow, activePool: POOLS[poolName] })
}

describe("trailIds", () => {
  test("lists every trail in hub order", () => {
    expect(trailIds()).toEqual(TRAIL_IDS)
  })

  test("returns a new array each call", () => {
    expect(trailIds()).not.toBe(trailIds())
  })
})

describe("normalizeTrailId", () => {
  test("keeps a known id", () => {
    for (const id of TRAIL_IDS) expect(normalizeTrailId(id)).toBe(id)
  })

  test.each([
    ["an old region id", "dragon-peak"],
    ["an empty string", ""],
    ["a number", 3],
    ["null", null],
    ["undefined", undefined],
    ["an object", {}],
  ])("falls back to the default for %s", (_label, input) => {
    expect(normalizeTrailId(input)).toBe(DEFAULT_TRAIL_ID)
  })
})

describe("construction", () => {
  test("defaults to the default trail and the whole fact set", () => {
    const journey = new Journey({ now: fixedNow })
    expect(journey.trailId).toBe(DEFAULT_TRAIL_ID)
    expect(journey.activePool).toEqual([...FACT_IDS])
  })

  test.each([
    ["no options", undefined],
    ["a non-object", 7],
    ["null", null],
  ])("survives %s", (_label, options) => {
    expect(() => new Journey(options)).not.toThrow()
  })

  test("an unknown trail id falls back rather than throwing", () => {
    expect(new Journey({ trailId: "dragon-peak" }).trailId).toBe(DEFAULT_TRAIL_ID)
  })

  test.each([
    ["a non-array", "2x2"],
    ["an empty array", []],
    ["an array of junk", [null, 7, "8x7", "1x5"]],
  ])("an unusable pool (%s) falls back to all 36 facts", (_label, pool) => {
    expect(new Journey({ activePool: pool }).activePool).toEqual([...FACT_IDS])
  })

  test("a pool is deduplicated, filtered, and kept in the caller's order", () => {
    const journey = new Journey({ activePool: ["6x7", "2x2", "6x7", "8x7", "bogus", "3x4"] })
    expect(journey.activePool).toEqual(["6x7", "2x2", "3x4"])
  })

  test("the pool getter hands back a copy", () => {
    const journey = journeyFor("squares")
    const pool = journey.activePool
    pool.push("nonsense")
    expect(journey.activePool).not.toContain("nonsense")
  })
})

describe("the trail's own facts", () => {
  test("`factIds` is the trail's whole set, pool or no pool", () => {
    for (const id of TRAIL_IDS) {
      expect(pooledJourney(id, "sevens").factIds).toEqual(factIdsForTrail(id))
    }
  })

  test("`activeFactIds` is the intersection with the pool", () => {
    const journey = pooledJourney("squares", "sevens")
    // Table 7 as a FAMILY is 2x7..7x9, so the only square in it is 7x7.
    expect(journey.activeFactIds).toEqual(["7x7"])
  })

  test("with the whole fact set the two agree", () => {
    for (const id of TRAIL_IDS) {
      const journey = journeyFor(id)
      expect(journey.activeFactIds).toEqual(journey.factIds)
    }
  })

  test("both getters hand back copies", () => {
    const journey = journeyFor("nines")
    journey.factIds.push("nonsense")
    journey.activeFactIds.push("nonsense")
    expect(journey.factIds).not.toContain("nonsense")
    expect(journey.activeFactIds).not.toContain("nonsense")
  })
})

describe("totalSpaces", () => {
  test("is SPACES_PER_FACT per active fact", () => {
    for (const id of TRAIL_IDS) {
      const journey = journeyFor(id)
      expect(journey.totalSpaces).toBe(TRAIL.SPACES_PER_FACT * factIdsForTrail(id).length)
    }
  })

  // The trail is a statement about the work, so narrowing the tables shortens
  // it rather than leaving ground the pool can never open.
  test("shortens with a narrower pool", () => {
    expect(pooledJourney("squares", "sevens").totalSpaces).toBe(TRAIL.SPACES_PER_FACT)
    expect(pooledJourney("squares", "all").totalSpaces).toBe(TRAIL.SPACES_PER_FACT * 8)
  })

  test("is 0 when no fact of the trail is in the pool", () => {
    // Table 2 as a family is 2x2..2x9, which holds exactly one square (2x2) and
    // no tough fact at all.
    expect(pooledJourney("tough", "twos").totalSpaces).toBe(0)
  })
})

describe("progress", () => {
  test("counts nothing before anything is practised", () => {
    const status = journeyFor("doubles").progress({})
    expect(status).toMatchObject({
      trailId: "doubles",
      total: 8,
      strong: 0,
      mastered: 0,
      fraction: 0,
      complete: false,
      unavailable: false,
    })
  })

  test("`strong` counts the strengthening bar and `mastered` the fluency one", () => {
    const ids = factIdsForTrail("squares")
    const records = { ...strongRecords(ids.slice(0, 5)), ...masteredRecords(ids.slice(5)) }
    const status = journeyFor("squares").progress(records)
    expect(status.strong).toBe(8)
    expect(status.mastered).toBe(3)
  })

  test("mastered is always a subset of strong", () => {
    const ids = factIdsForTrail("nines")
    const status = journeyFor("nines").progress(masteredRecords(ids))
    expect(status.mastered).toBeLessThanOrEqual(status.strong)
  })

  test("counts only facts inside the pool", () => {
    const journey = pooledJourney("squares", "sevens")
    const status = journey.progress(masteredRecords(factIdsForTrail("squares")))
    expect(status.total).toBe(1)
    expect(status.strong).toBe(1)
  })

  test("an unavailable trail reports zeroes rather than 100%", () => {
    const status = pooledJourney("tough", "twos").progress({})
    expect(status).toMatchObject({
      total: 0,
      strong: 0,
      totalSpaces: 0,
      cap: 0,
      fraction: 0,
      complete: false,
      unavailable: true,
    })
  })

  test("`complete` needs every active fact, not most of them", () => {
    const ids = factIdsForTrail("fives")
    const journey = journeyFor("fives")
    expect(journey.progress(strongRecords(ids.slice(0, 7))).complete).toBe(false)
    expect(journey.progress(strongRecords(ids)).complete).toBe(true)
  })

  test("never throws for a junk records argument", () => {
    for (const records of [null, undefined, "records", 7, []]) {
      expect(() => journeyFor("doubles").progress(records)).not.toThrow()
    }
  })

  test("decay can take a fact back below the bar", () => {
    const ids = factIdsForTrail("doubles")
    const journey = journeyFor("doubles")
    expect(journey.progress(masteredRecords(ids)).strong).toBe(8)
    // 5 - floor(60/14) = 1, which is under UNLOCK_MIN_STRENGTH.
    expect(journey.progress(decayedRecords(ids, 60)).strong).toBe(0)
  })
})

describe("the cap", () => {
  test("is FREE_SPACES before anything is strong", () => {
    expect(journeyFor("tough").lastUnlockedSpace({})).toBe(TRAIL.FREE_SPACES)
  })

  test("opens SPACES_PER_STRONG_FACT of ground per strengthened fact", () => {
    const ids = factIdsForTrail("tough")
    const journey = journeyFor("tough")
    expect(journey.lastUnlockedSpace(strongRecords(ids.slice(0, 2)))).toBe(
      TRAIL.FREE_SPACES + 2 * TRAIL.SPACES_PER_STRONG_FACT,
    )
  })

  test("never exceeds the last space", () => {
    const journey = journeyFor("doubles")
    const cap = journey.lastUnlockedSpace(masteredRecords(factIdsForTrail("doubles")))
    expect(cap).toBe(journey.totalSpaces - 1)
  })

  // The property the whole redesign exists for. Swept across every trail and
  // every table selection, because the bug it replaces was exactly a
  // (trail, pool) pair whose gate could not be opened.
  test.each(
    TRAIL_IDS.flatMap((trailId) =>
      Object.keys(POOLS).map((poolName) => [`${trailId} on ${poolName}`, trailId, poolName]),
    ),
  )("%s: a fully strong trail reaches its last space", (_label, trailId, poolName) => {
    const journey = pooledJourney(trailId, poolName)
    if (journey.totalSpaces === 0) {
      expect(journey.lastUnlockedSpace({})).toBe(0)
      return
    }
    const records = strongRecords(journey.activeFactIds)
    expect(journey.lastUnlockedSpace(records)).toBe(journey.totalSpaces - 1)
    expect(journey.progress(records).complete).toBe(true)
  })

  test("is 0 for an unavailable trail", () => {
    expect(pooledJourney("tough", "twos").lastUnlockedSpace({})).toBe(0)
  })
})

describe("createTrail and normalizeTrail", () => {
  test("a fresh trail starts at space 0 and is a new object", () => {
    expect(Journey.createTrail()).toEqual({ space: 0 })
    expect(Journey.createTrail()).not.toBe(Journey.createTrail())
  })

  test.each([
    ["null", null],
    ["undefined", undefined],
    ["a number", 7],
    ["a string", "space"],
    ["an array", []],
    ["a missing space", {}],
    ["a NaN space", { space: NaN }],
    ["an Infinite space", { space: Infinity }],
  ])("reads %s as the start of the trail", (_label, raw) => {
    expect(Journey.normalizeTrail(raw)).toEqual({ space: 0 })
  })

  test("floors and clamps the lower bound", () => {
    expect(Journey.normalizeTrail({ space: 3.9 })).toEqual({ space: 3 })
    expect(Journey.normalizeTrail({ space: -4 })).toEqual({ space: 0 })
  })

  // Only a hard ceiling here; the real one depends on the pool, so it belongs
  // to `clampToTrail`.
  test("caps at the longest any trail could be", () => {
    expect(Journey.normalizeTrail({ space: 1e9 })).toEqual({ space: Journey.MAX_SPACE })
  })

  test("drops the legacy lapsCompleted key rather than carrying it", () => {
    expect(Journey.normalizeTrail({ space: 4, lapsCompleted: 2 })).toEqual({ space: 4 })
  })
})

describe("clampToTrail", () => {
  test("brings a position inside this trail", () => {
    const journey = pooledJourney("squares", "sevens")
    expect(journey.totalSpaces).toBe(2)
    expect(journey.clampToTrail({ space: 19 })).toEqual({ space: 1 })
  })

  test("leaves a position that is already inside alone", () => {
    expect(journeyFor("doubles").clampToTrail({ space: 5 })).toEqual({ space: 5 })
  })

  test("an unavailable trail has only space 0", () => {
    expect(pooledJourney("tough", "twos").clampToTrail({ space: 9 })).toEqual({ space: 0 })
  })

  test("never mutates its argument", () => {
    const input = { space: 999 }
    journeyFor("doubles").clampToTrail(input)
    expect(input).toEqual({ space: 999 })
  })
})

describe("advance", () => {
  test("moves the token and reports how far", () => {
    const journey = journeyFor("doubles")
    const result = journey.advance({ space: 0 }, 2, {})
    expect(result.trail).toEqual({ space: 2 })
    expect(result.spacesMoved).toBe(2)
    expect(result.blocked).toBe(false)
  })

  test("returns a NEW trail and never touches the one it was given", () => {
    const input = { space: 1 }
    const result = journeyFor("doubles").advance(input, 1, {})
    expect(result.trail).not.toBe(input)
    expect(input).toEqual({ space: 1 })
  })

  test("stops at the cap and says it was blocked", () => {
    const journey = journeyFor("doubles")
    const result = journey.advance({ space: 0 }, 99, {})
    expect(result.trail).toEqual({ space: TRAIL.FREE_SPACES })
    expect(result.blocked).toBe(true)
  })

  test("a zero-space advance reports the position without moving it", () => {
    const result = journeyFor("doubles").advance({ space: 2 }, 0, {})
    expect(result).toEqual({
      trail: { space: 2 },
      blocked: false,
      finished: false,
      spacesMoved: 0,
    })
  })

  test.each([
    ["a negative distance", -3],
    ["NaN", NaN],
    ["a string", "2"],
    ["undefined", undefined],
  ])("%s moves nothing", (_label, spaces) => {
    const result = journeyFor("doubles").advance({ space: 2 }, spaces, {})
    expect(result.trail).toEqual({ space: 2 })
    expect(result.spacesMoved).toBe(0)
  })

  test("a fractional distance is floored", () => {
    expect(journeyFor("doubles").advance({ space: 0 }, 2.9, {}).trail).toEqual({ space: 2 })
  })

  // Losing visible progress is where children quit. A cap that has shrunk under
  // decay holds the token still; it never drags it back.
  test("the token never moves backwards when decay shrinks the cap", () => {
    const ids = factIdsForTrail("doubles")
    const journey = journeyFor("doubles")
    const walked = journey.advance({ space: 0 }, 99, masteredRecords(ids))
    expect(walked.trail.space).toBe(journey.totalSpaces - 1)

    const decayed = journey.advance(walked.trail, 1, decayedRecords(ids, 60))
    expect(decayed.trail.space).toBe(walked.trail.space)
    expect(decayed.spacesMoved).toBe(0)
    expect(decayed.blocked).toBe(true)
  })

  test("reports finishing, exactly once", () => {
    const journey = journeyFor("doubles")
    const records = masteredRecords(factIdsForTrail("doubles"))
    const last = journey.totalSpaces - 1
    const arriving = journey.advance({ space: last - 1 }, 1, records)
    expect(arriving.finished).toBe(true)
    // Standing on the last space and answering again is not finishing again.
    expect(journey.advance(arriving.trail, 1, records).finished).toBe(false)
  })

  test("an unavailable trail cannot be walked", () => {
    const result = pooledJourney("tough", "twos").advance({ space: 0 }, 5, {})
    expect(result).toEqual({
      trail: { space: 0 },
      blocked: false,
      finished: false,
      spacesMoved: 0,
    })
  })

  test("never throws for a junk trail argument", () => {
    for (const trail of [null, undefined, "far", 7, [], { space: NaN }]) {
      expect(() => journeyFor("doubles").advance(trail, 1, {})).not.toThrow()
    }
  })
})

describe("isTrailComplete", () => {
  test("needs the last space AND every active fact strong", () => {
    const journey = journeyFor("fives")
    const ids = factIdsForTrail("fives")
    const last = journey.totalSpaces - 1

    expect(journey.isTrailComplete({ space: last }, {})).toBe(false)
    expect(journey.isTrailComplete({ space: last - 1 }, strongRecords(ids))).toBe(false)
    expect(journey.isTrailComplete({ space: last }, strongRecords(ids))).toBe(true)
  })

  test("an unavailable trail is never complete", () => {
    expect(pooledJourney("tough", "twos").isTrailComplete({ space: 0 }, {})).toBe(false)
  })
})

describe("allTrailProgress", () => {
  test("reports every trail, in hub order", () => {
    const statuses = allTrailProgress({ now: fixedNow })
    expect(statuses.map((status) => status.trailId)).toEqual(TRAIL_IDS)
  })

  test("agrees with a Journey built for the same trail", () => {
    const records = masteredRecords(["2x2", "2x3", "5x5"])
    const statuses = allTrailProgress({ now: fixedNow, records })
    for (const status of statuses) {
      expect(status).toEqual(journeyFor(status.trailId).progress(records))
    }
  })

  test("honours the active pool", () => {
    const statuses = allTrailProgress({ now: fixedNow, activePool: POOLS.twos })
    const tough = statuses.find((status) => status.trailId === "tough")
    expect(tough.unavailable).toBe(true)
  })

  test("survives being called with nothing at all", () => {
    expect(() => allTrailProgress()).not.toThrow()
    expect(allTrailProgress()).toHaveLength(TRAILS.length)
  })
})

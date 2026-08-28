import { describe, test, expect } from "@jest/globals"
import { Journey } from "../js/Journey.js"
import { FACT_IDS, factIdsForTables, factsForRegionTable } from "../js/facts.js"
import {
  ALL_TABLES,
  DAY_MS,
  DIFFICULTY_PRESETS,
  PATTERN_FREE_IDS,
  REGIONS,
  TRAIL,
} from "../js/constants.js"

/** A fixed instant, so nothing in these tests depends on the wall clock. */
const NOW = Date.UTC(2026, 5, 1)

/** The injected clock every Journey in this file uses. */
const fixedNow = () => NOW

/** Region ids in walking order, for readable expectations. */
const REGION_IDS = REGIONS.map((region) => region.id)

/**
 * The four difficulty pools, derived from facts.js rather than hand-copied so a
 * change to the fact set cannot leave these fixtures quietly stale.
 */
const POOLS = {
  explorer: factIdsForTables(DIFFICULTY_PRESETS.explorer.tables, "both"),
  adventurer: factIdsForTables(DIFFICULTY_PRESETS.adventurer.tables, "both"),
  master: factIdsForTables(ALL_TABLES, "both"),
  custom: factIdsForTables([6, 7], "either"),
}

/**
 * Records for facts that are solidly mastered and will not decay: strength 5
 * with a due date far in the future, so `decayedStrength` returns 5 at NOW.
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
 * Records at exactly TRAIL.UNLOCK_MIN_STRENGTH: strong enough to open a gate but
 * NOT mastered. This is what a reliably-correct-but-slow player's facts look
 * like, and the trail has to work for her.
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
 * Records for facts stored at strength 5 but overdue by `days`, so decay has
 * eaten into them: one point per full 14-day period, floored at 1.
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

/** Structural fact ids a region owns, straight from facts.js. */
function structuralIds(table) {
  return factsForRegionTable(table).map((fact) => fact.id)
}

/** A journey over the whole 36-fact set. */
function fullJourney() {
  return new Journey({ now: fixedNow })
}

/** A journey over one named difficulty pool. */
function pooledJourney(poolName) {
  return new Journey({ now: fixedNow, activePool: POOLS[poolName] })
}

describe("Journey", () => {
  describe("pool fixtures", () => {
    test("the four difficulty pools have the sizes the presets promise", () => {
      expect(POOLS.explorer.length).toBe(10)
      expect(POOLS.adventurer.length).toBe(21)
      expect(POOLS.master.length).toBe(36)
      expect(POOLS.custom.length).toBe(15)
      expect(POOLS.explorer.length).toBe(DIFFICULTY_PRESETS.explorer.poolSize)
      expect(POOLS.adventurer.length).toBe(DIFFICULTY_PRESETS.adventurer.poolSize)
      expect(POOLS.master.length).toBe(DIFFICULTY_PRESETS.master.poolSize)
    })
  })

  describe("structure", () => {
    test("has 40 spaces across 8 regions", () => {
      const journey = fullJourney()
      expect(journey.totalSpaces).toBe(40)
      expect(journey.totalSpaces).toBe(TRAIL.TOTAL_SPACES)
      expect(journey.getRegions().length).toBe(8)
    })

    test("getRegions returns a copy", () => {
      const journey = fullJourney()
      const regions = journey.getRegions()
      regions.pop()
      expect(journey.getRegions().length).toBe(8)
    })

    test("getRegion looks up by id and returns null for an unknown id", () => {
      const journey = fullJourney()
      expect(journey.getRegion("beehive-hollow").table).toBe(6)
      expect(journey.getRegion("nowhere-at-all")).toBeNull()
    })

    test("structural region sizes are 1 through 8, independent of the pool", () => {
      const sizes = (journey) => REGION_IDS.map((id) => journey.factIdsForRegion(id).length)
      expect(sizes(fullJourney())).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
      expect(sizes(pooledJourney("explorer"))).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
      expect(sizes(pooledJourney("custom"))).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    })

    test("the regions partition all 36 facts with no overlap", () => {
      const journey = fullJourney()
      const all = REGION_IDS.flatMap((id) => journey.factIdsForRegion(id))
      expect(all.length).toBe(36)
      expect(new Set(all).size).toBe(36)
      expect([...all].sort()).toEqual([...FACT_IDS].sort())
    })

    test("factIdsForRegion returns a copy and [] for an unknown region", () => {
      const journey = fullJourney()
      const ids = journey.factIdsForRegion("dragon-peak")
      ids.length = 0
      expect(journey.factIdsForRegion("dragon-peak").length).toBe(8)
      expect(journey.factIdsForRegion("nowhere-at-all")).toEqual([])
    })

    test("regionStartSpace steps by five and is -1 for an unknown region", () => {
      const journey = fullJourney()
      expect(REGION_IDS.map((id) => journey.regionStartSpace(id))).toEqual([
        0, 5, 10, 15, 20, 25, 30, 35,
      ])
      expect(journey.regionStartSpace("nowhere-at-all")).toBe(-1)
    })

    test("regionForSpace maps the ends of each region and rejects out-of-range", () => {
      const journey = fullJourney()
      expect(journey.regionForSpace(0).id).toBe("doubling-meadow")
      expect(journey.regionForSpace(4).id).toBe("doubling-meadow")
      expect(journey.regionForSpace(5).id).toBe("triple-bridge")
      expect(journey.regionForSpace(39).id).toBe("dragon-peak")
      expect(journey.regionForSpace(-1)).toBeNull()
      expect(journey.regionForSpace(40)).toBeNull()
      expect(journey.regionForSpace(2.5)).toBeNull()
    })

    test("the region-to-space mapping is exhaustive with no gaps or overlaps", () => {
      const journey = fullJourney()
      const owners = []
      for (let space = 0; space < journey.totalSpaces; space += 1) {
        const region = journey.regionForSpace(space)
        expect(region).not.toBeNull()
        owners.push(region.id)
      }
      // Every space is owned exactly once, so 40 entries covering 8 ids.
      expect(owners.length).toBe(40)
      for (const region of journey.getRegions()) {
        const spaces = owners.filter((id) => id === region.id)
        expect(spaces.length).toBe(region.spaces)
        // Contiguous: the run starts at regionStartSpace and has no holes.
        const start = journey.regionStartSpace(region.id)
        for (let offset = 0; offset < region.spaces; offset += 1) {
          expect(owners[start + offset]).toBe(region.id)
        }
      }
    })

    test("regionForFactId uses the larger operand", () => {
      const journey = fullJourney()
      expect(journey.regionForFactId("2x2").id).toBe("doubling-meadow")
      expect(journey.regionForFactId("7x8").id).toBe("spider-woods")
      expect(journey.regionForFactId("6x7").id).toBe("rainbow-ridge")
      expect(journey.regionForFactId("9x9").id).toBe("dragon-peak")
      expect(journey.regionForFactId("8x7")).toBeNull()
      expect(journey.regionForFactId("nope")).toBeNull()
    })

    test("every tough-dozen fact lives in a region of table 6 or higher", () => {
      const journey = fullJourney()
      for (const id of PATTERN_FREE_IDS) {
        expect(journey.regionForFactId(id).table).toBeGreaterThanOrEqual(6)
      }
    })

    test("createTrail is space 0 with no lap fields", () => {
      const trail = Journey.createTrail()
      expect(trail).toEqual({ space: 0 })
      expect("lapsCompleted" in trail).toBe(false)
      expect(Journey.createTrail()).not.toBe(trail)
    })
  })

  describe("activePool / activeFactIdsForRegion", () => {
    test("defaults to all 36 facts, so active membership equals structural", () => {
      const journey = fullJourney()
      expect(journey.activePool.length).toBe(36)
      expect([...journey.activePool].sort()).toEqual([...FACT_IDS].sort())
      for (const id of REGION_IDS) {
        expect(journey.activeFactIdsForRegion(id)).toEqual(journey.factIdsForRegion(id))
      }
    })

    test("the activePool getter returns a copy", () => {
      const journey = fullJourney()
      const pool = journey.activePool
      pool.length = 0
      expect(journey.activePool.length).toBe(36)
    })

    test("adventurer pool empties Spider Woods and Dragon Peak", () => {
      const journey = pooledJourney("adventurer")
      const sizes = REGION_IDS.map((id) => journey.activeFactIdsForRegion(id).length)
      expect(sizes).toEqual([1, 2, 3, 4, 5, 6, 0, 0])
      expect(sizes.reduce((sum, n) => sum + n, 0)).toBe(21)
    })

    test("explorer pool fills only the first four regions", () => {
      const journey = pooledJourney("explorer")
      const sizes = REGION_IDS.map((id) => journey.activeFactIdsForRegion(id).length)
      expect(sizes).toEqual([1, 2, 3, 4, 0, 0, 0, 0])
      expect(sizes.reduce((sum, n) => sum + n, 0)).toBe(10)
    })

    test("custom [6, 7] pool skips the first four regions and reaches the last two", () => {
      const journey = pooledJourney("custom")
      const sizes = REGION_IDS.map((id) => journey.activeFactIdsForRegion(id).length)
      expect(sizes).toEqual([0, 0, 0, 0, 5, 6, 2, 2])
      expect(sizes.reduce((sum, n) => sum + n, 0)).toBe(15)
      expect(journey.activeFactIdsForRegion("spider-woods")).toEqual(["6x8", "7x8"])
      expect(journey.activeFactIdsForRegion("dragon-peak")).toEqual(["6x9", "7x9"])
    })

    test("active ids stay in FACTS order and are a subset of the structural ids", () => {
      const journey = pooledJourney("custom")
      const active = journey.activeFactIdsForRegion("rainbow-ridge")
      expect(active).toEqual(structuralIds(7))
      expect(active).toEqual(["2x7", "3x7", "4x7", "5x7", "6x7", "7x7"])
    })

    test("a junk activePool falls back to all 36 facts", () => {
      for (const junk of [null, [], "6x7", 42, ["nope", 7, "8x7", "7X8", ""]]) {
        const journey = new Journey({ now: fixedNow, activePool: junk })
        expect(journey.activePool.length).toBe(36)
      }
    })

    test("duplicate ids in the pool are collapsed", () => {
      const journey = new Journey({ now: fixedNow, activePool: ["6x7", "6x7", "2x2"] })
      expect(journey.activePool).toEqual(["6x7", "2x2"])
    })

    test("activeFactIdsForRegion is [] for an unknown region", () => {
      expect(fullJourney().activeFactIdsForRegion("nowhere-at-all")).toEqual([])
    })
  })

  describe("regionProgress", () => {
    test("full pool with an empty records map: nothing strong, nothing skipped", () => {
      const journey = fullJourney()
      const progress = journey.allRegionProgress({})
      // Doubling Meadow requires 0: the region the token starts in has no gate.
      expect(progress.map((entry) => entry.required)).toEqual([0, 2, 2, 3, 3, 4, 5, 5])
      expect(progress.map((entry) => entry.total)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
      for (const entry of progress) {
        expect(entry.strong).toBe(0)
        expect(entry.mastered).toBe(0)
        expect(entry.skipped).toBe(false)
        expect(entry.fraction).toBe(0)
      }
      // Only the gate-free start region is complete.
      expect(progress.map((entry) => entry.complete)).toEqual([
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
      ])
    })

    test("first run with no records at all behaves like an empty map", () => {
      const journey = fullJourney()
      expect(journey.regionProgress("doubling-meadow", undefined)).toEqual(
        journey.regionProgress("doubling-meadow", {}),
      )
      expect(journey.lastUnlockedSpace({})).toBe(9)
      expect(journey.lastUnlockedSpace(undefined)).toBe(9)
    })

    test("the start region requires nothing, so a new player can walk at once", () => {
      const journey = fullJourney()
      expect(journey.regionProgress("doubling-meadow", {})).toEqual({
        regionId: "doubling-meadow",
        total: 1,
        strong: 0,
        mastered: 0,
        required: 0,
        fraction: 0,
        complete: true,
        skipped: false,
        unlocked: true,
      })
      // It is not skipped -- 2x2 is in the pool and still shows on the map.
      expect(journey.regionProgress("doubling-meadow", masteredRecords(["2x2"]))).toEqual({
        regionId: "doubling-meadow",
        total: 1,
        strong: 1,
        mastered: 1,
        required: 0,
        fraction: 1,
        complete: true,
        skipped: false,
        unlocked: true,
      })
    })

    test("a gate counts facts at UNLOCK_MIN_STRENGTH, not only mastered ones", () => {
      const journey = fullJourney()
      const progress = journey.regionProgress("triple-bridge", strongRecords(["2x3", "3x3"]))
      expect(progress.strong).toBe(2)
      expect(progress.mastered).toBe(0)
      expect(progress.required).toBe(2)
      expect(progress.complete).toBe(true)
      expect(progress.fraction).toBe(1)
    })

    test("region 8 needs exactly 5 of its 8 facts", () => {
      const journey = fullJourney()
      const dragonIds = structuralIds(9)
      const four = journey.regionProgress("dragon-peak", masteredRecords(dragonIds.slice(0, 4)))
      expect(four.strong).toBe(4)
      expect(four.mastered).toBe(4)
      expect(four.required).toBe(5)
      expect(four.complete).toBe(false)
      const five = journey.regionProgress("dragon-peak", masteredRecords(dragonIds.slice(0, 5)))
      expect(five.strong).toBe(5)
      expect(five.complete).toBe(true)
    })

    test("decay drops a fact out of mastered before it drops out of the gate", () => {
      const journey = fullJourney()
      // 30 days overdue is two full decay periods, so strength 5 reads as 3:
      // no longer mastered, but still at the unlock bar.
      const progress = journey.regionProgress("triple-bridge", decayedRecords(["2x3", "3x3"], 30))
      expect(progress.mastered).toBe(0)
      expect(progress.strong).toBe(2)
      expect(progress.complete).toBe(true)
    })

    test("a fact decayed below the unlock bar stops counting toward the gate", () => {
      const journey = fullJourney()
      // 45 days is three periods, so strength 5 reads as 2 -- under the bar.
      const progress = journey.regionProgress("triple-bridge", decayedRecords(["2x3", "3x3"], 45))
      expect(progress.strong).toBe(0)
      expect(progress.mastered).toBe(0)
      expect(progress.complete).toBe(false)
    })

    test("required is scoped to the pool, not to the region's full size", () => {
      const custom = pooledJourney("custom")
      const spiderWoods = custom.regionProgress("spider-woods", {})
      expect(spiderWoods.total).toBe(2)
      expect(spiderWoods.required).toBe(2)
      expect(spiderWoods.skipped).toBe(false)

      const adventurer = pooledJourney("adventurer")
      const empty = adventurer.regionProgress("spider-woods", {})
      expect(empty.total).toBe(0)
      expect(empty.required).toBe(0)
    })

    test("an empty intersection is a skip, complete and 100%, not a hole at 0%", () => {
      const journey = pooledJourney("adventurer")
      const progress = journey.regionProgress("spider-woods", {})
      expect(progress.total).toBe(0)
      expect(progress.strong).toBe(0)
      expect(progress.mastered).toBe(0)
      expect(progress.required).toBe(0)
      expect(progress.fraction).toBe(1)
      expect(progress.complete).toBe(true)
      expect(progress.skipped).toBe(true)
    })

    test("an unknown region is an error, not a skip", () => {
      expect(fullJourney().regionProgress("nowhere-at-all", {})).toEqual({
        regionId: "nowhere-at-all",
        total: 0,
        strong: 0,
        mastered: 0,
        required: 0,
        fraction: 0,
        complete: false,
        skipped: false,
        unlocked: false,
      })
    })

    test("mastered is never above strong, whatever the records look like", () => {
      const journey = fullJourney()
      const recordSets = [
        {},
        strongRecords(FACT_IDS),
        masteredRecords(FACT_IDS),
        decayedRecords(FACT_IDS, 30),
        decayedRecords(FACT_IDS, 45),
        { ...strongRecords(FACT_IDS), ...masteredRecords(["2x2", "6x7", "9x9"]) },
      ]
      for (const records of recordSets) {
        for (const entry of journey.allRegionProgress(records)) {
          expect(entry.mastered).toBeLessThanOrEqual(entry.strong)
          expect(entry.strong).toBeLessThanOrEqual(entry.total)
        }
      }
    })

    test("allRegionProgress is in walking order and carries the unlocked flag", () => {
      const journey = fullJourney()
      const progress = journey.allRegionProgress(masteredRecords(["2x2"]))
      expect(progress.map((entry) => entry.regionId)).toEqual(REGION_IDS)
      expect(progress.map((entry) => entry.unlocked)).toEqual([
        true,
        true,
        false,
        false,
        false,
        false,
        false,
        false,
      ])
    })
  })

  describe("isRegionUnlocked / unlockedRegionIds", () => {
    test("full pool with empty records unlocks the first two regions", () => {
      const journey = fullJourney()
      // The start region carries no gate, so Triple Bridge is open immediately.
      expect(journey.unlockedRegionIds({})).toEqual(["doubling-meadow", "triple-bridge"])
      expect(journey.isRegionUnlocked("doubling-meadow", {})).toBe(true)
      expect(journey.isRegionUnlocked("triple-bridge", {})).toBe(true)
      expect(journey.isRegionUnlocked("fourfold-orchard", {})).toBe(false)
    })

    test("completing region 2 unlocks region 3 but not region 4", () => {
      const journey = fullJourney()
      const records = masteredRecords(["2x3", "3x3"])
      expect(journey.unlockedRegionIds(records)).toEqual([
        "doubling-meadow",
        "triple-bridge",
        "fourfold-orchard",
      ])
      expect(journey.isRegionUnlocked("high-five-hills", records)).toBe(false)
    })

    test("every prior region must be complete, not just the previous one", () => {
      const journey = fullJourney()
      // Region 3 fully mastered, region 2 untouched.
      const records = masteredRecords(structuralIds(4))
      expect(journey.regionProgress("fourfold-orchard", records).complete).toBe(true)
      expect(journey.isRegionUnlocked("high-five-hills", records)).toBe(false)
      expect(journey.unlockedRegionIds(records)).toEqual(["doubling-meadow", "triple-bridge"])
    })

    test("mastering all 36 facts unlocks all 8 regions", () => {
      const journey = fullJourney()
      const records = masteredRecords(FACT_IDS)
      expect(journey.unlockedRegionIds(records)).toEqual(REGION_IDS)
    })

    test("facts held at UNLOCK_MIN_STRENGTH open the whole trail", () => {
      // The point of gating on strength rather than mastery: a player who is
      // reliably correct but never fluent still walks to the last space.
      const journey = fullJourney()
      const records = strongRecords(FACT_IDS)
      expect(journey.unlockedRegionIds(records)).toEqual(REGION_IDS)
      expect(journey.lastUnlockedSpace(records)).toBe(39)
      expect(journey.regionProgress("dragon-peak", records).mastered).toBe(0)
    })

    test("grinding 2x2 forever unlocks exactly two regions and no more", () => {
      const journey = fullJourney()
      const records = masteredRecords(["2x2"])
      // Every other fact answered many times but still at strength 0.
      for (const id of FACT_IDS) {
        if (id === "2x2") continue
        records[id] = {
          strength: 0,
          totalSeen: 400,
          totalCorrect: 400,
          lastSeen: NOW,
          lastMs: 1200,
          dueAt: NOW + DAY_MS,
        }
      }
      // Two regions is what the free start region alone buys: grinding one fact
      // adds nothing, which is the whole point of a strength gate.
      expect(journey.unlockedRegionIds(records).length).toBe(2)
      expect(journey.lastUnlockedSpace(records)).toBe(9)
    })

    test("unknown region ids are never unlocked", () => {
      expect(fullJourney().isRegionUnlocked("nowhere-at-all", masteredRecords(FACT_IDS))).toBe(
        false,
      )
    })

    test("a skipped region does not block what follows it", () => {
      const journey = pooledJourney("custom")
      // Regions 1-4 hold no pool facts, so they are complete and Beehive Hollow
      // -- the first region she can actually practise -- is reachable at once.
      expect(journey.unlockedRegionIds({})).toEqual(REGION_IDS.slice(0, 5))
      expect(journey.isRegionUnlocked("beehive-hollow", {})).toBe(true)
      expect(journey.isRegionUnlocked("rainbow-ridge", {})).toBe(false)
    })
  })

  describe("earnedRegionIds", () => {
    test("excludes skipped regions, so a narrow pool earns nothing for free", () => {
      const journey = pooledJourney("custom")
      // Five regions are reachable with zero practice, four of them only because
      // tables [6, 7] leave them empty. Counting those as earned handed out the
      // regions-4 gem on the very first answer.
      expect(journey.unlockedRegionIds({}).length).toBe(5)
      expect(journey.earnedRegionIds({})).toEqual(["beehive-hollow"])
    })

    test("counts the reachable regions that hold facts, in walking order", () => {
      const journey = fullJourney()
      expect(journey.earnedRegionIds({})).toEqual(["doubling-meadow", "triple-bridge"])
      expect(journey.earnedRegionIds(masteredRecords(FACT_IDS))).toEqual(REGION_IDS)
    })

    test("a full run of every pool earns at least the regions-4 milestone", () => {
      for (const poolName of Object.keys(POOLS)) {
        const journey = pooledJourney(poolName)
        const earned = journey.earnedRegionIds(masteredRecords(POOLS[poolName]))
        expect(earned.length).toBeGreaterThanOrEqual(4)
      }
    })

    test("tolerates missing records", () => {
      expect(fullJourney().earnedRegionIds(undefined)).toEqual(fullJourney().earnedRegionIds({}))
    })
  })

  describe("lastUnlockedSpace", () => {
    test("full pool, all 36 mastered, reaches the end of the trail", () => {
      const journey = fullJourney()
      expect(journey.lastUnlockedSpace(masteredRecords(FACT_IDS))).toBe(39)
    })

    test("adventurer pool reaches 39, not the 34 the unscoped gate produced", () => {
      const journey = pooledJourney("adventurer")
      const records = masteredRecords(POOLS.adventurer)
      expect(journey.lastUnlockedSpace(records)).toBe(39)
      expect(journey.lastUnlockedSpace(records)).not.toBe(34)
      expect(journey.isTrailComplete({ space: 39 }, records)).toBe(true)
    })

    test("explorer pool reaches 39", () => {
      const journey = pooledJourney("explorer")
      expect(journey.lastUnlockedSpace(masteredRecords(POOLS.explorer))).toBe(39)
    })

    test("master pool reaches 39", () => {
      const journey = pooledJourney("master")
      expect(journey.lastUnlockedSpace(masteredRecords(POOLS.master))).toBe(39)
    })

    test("custom [6, 7] pool reaches 39, not the 4 the unscoped gate produced", () => {
      const journey = pooledJourney("custom")
      const records = masteredRecords(POOLS.custom)
      expect(journey.lastUnlockedSpace(records)).toBe(39)
      expect(journey.lastUnlockedSpace(records)).not.toBe(4)
    })

    test.each(Object.keys(POOLS))(
      "%s: mastering exactly the pool's own facts reaches the last space",
      (poolName) => {
        const journey = pooledJourney(poolName)
        const records = masteredRecords(POOLS[poolName])
        expect(journey.lastUnlockedSpace(records)).toBe(journey.totalSpaces - 1)
      },
    )

    test("every pool starts capped at the second region's last space", () => {
      // The start region has no gate, so the first two regions are open before
      // any practice at all. Except custom [6, 7], whose first four regions are
      // skipped outright.
      expect(pooledJourney("explorer").lastUnlockedSpace({})).toBe(9)
      expect(pooledJourney("adventurer").lastUnlockedSpace({})).toBe(9)
      expect(pooledJourney("master").lastUnlockedSpace({})).toBe(9)
      expect(pooledJourney("custom").lastUnlockedSpace({})).toBe(24)
    })

    test("the cap moves correctly under a small pool", () => {
      const journey = pooledJourney("adventurer")
      // Triple Bridge, not Doubling Meadow, is the first real gate.
      expect(journey.lastUnlockedSpace(masteredRecords(["2x3", "3x3"]))).toBe(14)
    })
  })

  describe("advance", () => {
    test("zero spaces changes nothing", () => {
      const journey = fullJourney()
      const result = journey.advance({ space: 3 }, 0, masteredRecords(FACT_IDS))
      expect(result).toEqual({
        trail: { space: 3 },
        blocked: false,
        gatingRegionId: null,
        enteredRegionId: null,
        spacesMoved: 0,
      })
    })

    test("negative, fractional and non-numeric spaces are floored to a safe integer", () => {
      const journey = fullJourney()
      const records = masteredRecords(FACT_IDS)
      expect(journey.advance({ space: 3 }, -5, records).trail.space).toBe(3)
      expect(journey.advance({ space: 3 }, 2.9, records).trail.space).toBe(5)
      expect(journey.advance({ space: 3 }, NaN, records).trail.space).toBe(3)
      expect(journey.advance({ space: 3 }, undefined, records).spacesMoved).toBe(0)
    })

    test("moves within the unlocked region without blocking", () => {
      const journey = fullJourney()
      expect(journey.advance({ space: 0 }, 3, {})).toEqual({
        trail: { space: 3 },
        blocked: false,
        // Reported even when nothing is blocked: this is the region whose facts
        // open the next gate.
        gatingRegionId: "triple-bridge",
        enteredRegionId: null,
        spacesMoved: 3,
      })
    })

    test("is held at the gate after walking the two free regions", () => {
      const journey = fullJourney()
      const result = journey.advance({ space: 0 }, 20, {})
      expect(result.trail.space).toBe(9)
      expect(result.blocked).toBe(true)
      expect(result.gatingRegionId).toBe("triple-bridge")
      expect(result.spacesMoved).toBe(9)
      expect(result.enteredRegionId).toBe("triple-bridge")
    })

    test("gatingRegionId names the region whose facts actually open the gate", () => {
      const journey = fullJourney()
      const records = {}
      const result = journey.advance({ space: 9 }, 1, records)
      expect(result.blocked).toBe(true)

      // The region the token is standing in, and the one to practise.
      expect(result.gatingRegionId).toBe("triple-bridge")
      const gate = journey.regionProgress(result.gatingRegionId, records)
      expect(gate.unlocked).toBe(true)
      expect(gate.strong).toBe(0)
      expect(gate.required).toBe(2)
      expect(gate.complete).toBe(false)

      // NOT the locked region ahead: Fourfold Orchard is unreachable, and none of
      // its facts move this gate. Reporting it produced a message telling the
      // player to practise facts she has not been offered.
      expect(result.gatingRegionId).not.toBe("fourfold-orchard")
      expect(journey.isRegionUnlocked("fourfold-orchard", records)).toBe(false)
      expect("blockedRegionId" in result).toBe(false)
    })

    test("crossing a region boundary reports the region entered", () => {
      const journey = fullJourney()
      const result = journey.advance({ space: 4 }, 1, masteredRecords(["2x2"]))
      expect(result.trail.space).toBe(5)
      expect(result.blocked).toBe(false)
      expect(result.enteredRegionId).toBe("triple-bridge")
      expect(result.gatingRegionId).toBe("triple-bridge")
      expect(result.spacesMoved).toBe(1)
    })

    test("space 39 is the end of the trail: no wraparound, no lap", () => {
      const journey = fullJourney()
      const result = journey.advance({ space: 39 }, 1, masteredRecords(FACT_IDS))
      expect(result.trail.space).toBe(39)
      expect(result.blocked).toBe(true)
      expect(result.gatingRegionId).toBeNull()
      expect(result.spacesMoved).toBe(0)
      expect(result.enteredRegionId).toBeNull()
    })

    test("the token never moves backwards when the cap shrinks", () => {
      const journey = fullJourney()
      // Fresh: everything mastered, so the whole trail is open.
      const fresh = masteredRecords(FACT_IDS)
      expect(journey.lastUnlockedSpace(fresh)).toBe(39)

      // Six weeks later: Triple Bridge's two facts have decayed three periods,
      // from strength 5 to 2, which is under the unlock bar, so the cap collapses
      // to space 9.
      const stale = decayedRecords(["2x2", "2x3", "3x3"], 45)
      expect(journey.lastUnlockedSpace(stale)).toBe(9)

      const result = journey.advance({ space: 30 }, 1, stale)
      expect(result.trail.space).toBe(30)
      expect(result.trail.space).not.toBe(9)
      expect(result.trail.space).toBeGreaterThanOrEqual(30)
      expect(result.blocked).toBe(true)
      expect(result.spacesMoved).toBe(0)
      expect(result.gatingRegionId).toBe("triple-bridge")
    })

    test("advance is monotonic across every starting space and cap", () => {
      const journey = fullJourney()
      const recordSets = [
        {},
        masteredRecords(["2x2"]),
        strongRecords(FACT_IDS),
        masteredRecords(["2x2", "2x3", "3x3"]),
        masteredRecords(FACT_IDS),
        decayedRecords(FACT_IDS, 30),
        decayedRecords(FACT_IDS, 200),
        { ...masteredRecords(["2x2"]), ...decayedRecords(["2x3", "3x3"], 45) },
      ]
      for (const records of recordSets) {
        for (const space of [0, 1, 4, 5, 9, 20, 30, 38, 39]) {
          for (const steps of [0, 1, 3, 40]) {
            const result = journey.advance({ space }, steps, records)
            expect(result.trail.space).toBeGreaterThanOrEqual(space)
            expect(result.spacesMoved).toBeGreaterThanOrEqual(0)
            expect(result.trail.space).toBeLessThanOrEqual(journey.totalSpaces - 1)
          }
        }
      }
    })

    test("adventurer walks straight through the skipped regions to space 39", () => {
      const journey = pooledJourney("adventurer")
      const records = masteredRecords(POOLS.adventurer)
      const result = journey.advance({ space: 25 }, 14, records)
      expect(result.trail.space).toBe(39)
      expect(result.blocked).toBe(false)
      expect(result.gatingRegionId).toBeNull()
      expect(result.spacesMoved).toBe(14)
      expect(result.enteredRegionId).toBe("dragon-peak")
    })

    test("never mutates the trail it was given", () => {
      const journey = fullJourney()
      const trail = { space: 2 }
      const result = journey.advance(trail, 5, masteredRecords(FACT_IDS))
      expect(trail).toEqual({ space: 2 })
      expect(result.trail).not.toBe(trail)
    })

    test("carries no lap residue", () => {
      const journey = fullJourney()
      const result = journey.advance({ space: 39 }, 5, masteredRecords(FACT_IDS))
      expect("lapCompleted" in result).toBe(false)
      expect("lapsCompleted" in result.trail).toBe(false)
      expect(Object.keys(result.trail)).toEqual(["space"])
    })

    test("a new player walks off space 4 on her fifth correct answer", () => {
      // The regression this whole gate change exists for: with Doubling Meadow
      // gated on its single fact, the token sat on space 4 for well over a
      // hundred answers. One space per correct answer, so space 4 is left on the
      // fifth.
      let trail = Journey.createTrail()
      const journey = pooledJourney("adventurer")
      const spacesAfter = []
      for (let answer = 1; answer <= 6; answer += 1) {
        trail = journey.advance(trail, TRAIL.SPACES_PER_CORRECT, {}).trail
        spacesAfter.push(trail.space)
      }
      expect(spacesAfter).toEqual([1, 2, 3, 4, 5, 6])
    })
  })

  describe("normalizeTrail", () => {
    test("junk becomes space 0", () => {
      for (const junk of [null, undefined, "x", 42, [], { space: "5" }, { space: NaN }]) {
        expect(Journey.normalizeTrail(junk)).toEqual({ space: 0 })
      }
    })

    test("out-of-range and fractional spaces are clamped and floored", () => {
      expect(Journey.normalizeTrail({ space: 99 })).toEqual({ space: 39 })
      expect(Journey.normalizeTrail({ space: -5 })).toEqual({ space: 0 })
      expect(Journey.normalizeTrail({ space: 3.7 })).toEqual({ space: 3 })
      expect(Journey.normalizeTrail({ space: 39 })).toEqual({ space: 39 })
    })

    test("a legacy lapsCompleted key is dropped", () => {
      const trail = Journey.normalizeTrail({ space: 7, lapsCompleted: 3 })
      expect(trail).toEqual({ space: 7 })
      expect("lapsCompleted" in trail).toBe(false)
      expect(Object.keys(trail)).toEqual(["space"])
    })
  })

  describe("isTrailComplete", () => {
    test("not complete when the token is short of the last space", () => {
      const journey = fullJourney()
      expect(journey.isTrailComplete({ space: 10 }, masteredRecords(FACT_IDS))).toBe(false)
    })

    test("complete with everything mastered and the token on space 39", () => {
      const journey = fullJourney()
      expect(journey.isTrailComplete({ space: 39 }, masteredRecords(FACT_IDS))).toBe(true)
    })

    test("not complete when the last region is unfinished", () => {
      const journey = fullJourney()
      // Dragon Peak needs 5 of its 8 facts, so leave only 4 of them mastered.
      const unmastered = new Set(["6x9", "7x9", "8x9", "9x9"])
      const records = masteredRecords(FACT_IDS.filter((id) => !unmastered.has(id)))
      expect(journey.regionProgress("dragon-peak", records).strong).toBe(4)
      expect(journey.regionProgress("dragon-peak", records).complete).toBe(false)
      expect(journey.isTrailComplete({ space: 39 }, records)).toBe(false)
    })

    test("skipped regions count as complete", () => {
      const journey = pooledJourney("adventurer")
      expect(journey.isTrailComplete({ space: 39 }, masteredRecords(POOLS.adventurer))).toBe(true)
    })

    test("empty records at space 39 is not complete", () => {
      expect(fullJourney().isTrailComplete({ space: 39 }, {})).toBe(false)
    })
  })
})

import { describe, test, expect, beforeEach } from "@jest/globals"
import { SPECIES, GOAL_TYPE } from "../js/constants.js"
import { SpeciesRegistry } from "../js/Species.js"
import { Grid } from "../js/Grid.js"
import { GoalChecker } from "../js/GoalChecker.js"

function makeGrid(width, height) {
  return new Grid(width, height, new SpeciesRegistry())
}

describe("GoalChecker", () => {
  let checker

  beforeEach(() => {
    checker = new GoalChecker()
  })

  describe("survive", () => {
    test("not met before target generation", () => {
      const grid = makeGrid(4, 4)
      grid.setCell(1, 1, SPECIES.GRASS)
      const goals = [{ type: GOAL_TYPE.SURVIVE, generations: 10 }]
      const result = checker.check(goals, grid, 5)
      expect(result.goalStatuses[0].met).toBe(false)
    })

    test("met at target generation with living cells", () => {
      const grid = makeGrid(4, 4)
      grid.setCell(1, 1, SPECIES.GRASS)
      const goals = [{ type: GOAL_TYPE.SURVIVE, generations: 10 }]
      const result = checker.check(goals, grid, 10)
      expect(result.goalStatuses[0].met).toBe(true)
    })

    test("not met at target generation with no living cells", () => {
      const grid = makeGrid(4, 4)
      const goals = [{ type: GOAL_TYPE.SURVIVE, generations: 10 }]
      const result = checker.check(goals, grid, 10)
      expect(result.goalStatuses[0].met).toBe(false)
    })
  })

  describe("sustain", () => {
    test("tracks consecutive generations", () => {
      const goals = [
        {
          type: GOAL_TYPE.SUSTAIN,
          species: SPECIES.GRASS,
          speciesName: "grass",
          count: 3,
          generations: 3,
        },
      ]

      const grid = makeGrid(4, 4)
      grid.setCell(0, 0, SPECIES.GRASS)
      grid.setCell(1, 0, SPECIES.GRASS)
      grid.setCell(2, 0, SPECIES.GRASS)

      // Generation 1: 3 grass -> counter = 1
      let result = checker.check(goals, grid, 1)
      expect(result.goalStatuses[0].met).toBe(false)

      // Generation 2: still 3 -> counter = 2
      result = checker.check(goals, grid, 2)
      expect(result.goalStatuses[0].met).toBe(false)

      // Generation 3: still 3 -> counter = 3, met!
      result = checker.check(goals, grid, 3)
      expect(result.goalStatuses[0].met).toBe(true)
    })

    test("resets counter when count drops below threshold", () => {
      const goals = [
        {
          type: GOAL_TYPE.SUSTAIN,
          species: SPECIES.GRASS,
          speciesName: "grass",
          count: 3,
          generations: 3,
        },
      ]

      const gridWith3 = makeGrid(4, 4)
      gridWith3.setCell(0, 0, SPECIES.GRASS)
      gridWith3.setCell(1, 0, SPECIES.GRASS)
      gridWith3.setCell(2, 0, SPECIES.GRASS)

      const gridWith2 = makeGrid(4, 4)
      gridWith2.setCell(0, 0, SPECIES.GRASS)
      gridWith2.setCell(1, 0, SPECIES.GRASS)

      // 2 consecutive, then drop
      checker.check(goals, gridWith3, 1)
      checker.check(goals, gridWith3, 2)
      checker.check(goals, gridWith2, 3) // drops below -> reset

      // Need 3 more consecutive
      checker.check(goals, gridWith3, 4)
      checker.check(goals, gridWith3, 5)
      const result = checker.check(goals, gridWith3, 6)
      expect(result.goalStatuses[0].met).toBe(true)
    })
  })

  describe("fill-zone", () => {
    test("checks percentage of species in zone", () => {
      const grid = makeGrid(6, 6)
      // 4x4 zone = 16 cells, need 75% = 12 flowers
      const goals = [
        {
          type: GOAL_TYPE.FILL_ZONE,
          species: SPECIES.FLOWER,
          speciesName: "flowers",
          zone: { x: 1, y: 1, w: 4, h: 4 },
          percent: 75,
        },
      ]

      // Place 12 flowers in the zone
      let placed = 0
      for (let y = 1; y < 5 && placed < 12; y++) {
        for (let x = 1; x < 5 && placed < 12; x++) {
          grid.setCell(x, y, SPECIES.FLOWER)
          placed++
        }
      }

      const result = checker.check(goals, grid, 10)
      expect(result.goalStatuses[0].met).toBe(true)
    })

    test("fails when below threshold", () => {
      const grid = makeGrid(6, 6)
      const goals = [
        {
          type: GOAL_TYPE.FILL_ZONE,
          species: SPECIES.FLOWER,
          speciesName: "flowers",
          zone: { x: 0, y: 0, w: 4, h: 4 },
          percent: 75,
        },
      ]
      grid.setCell(0, 0, SPECIES.FLOWER)
      const result = checker.check(goals, grid, 10)
      expect(result.goalStatuses[0].met).toBe(false)
    })
  })

  describe("reach", () => {
    test("met when count is reached at any point", () => {
      const goals = [
        {
          type: GOAL_TYPE.REACH,
          species: SPECIES.GRASS,
          speciesName: "grass",
          count: 5,
        },
      ]

      const grid = makeGrid(6, 6)
      for (let i = 0; i < 5; i++) grid.setCell(i, 0, SPECIES.GRASS)

      const result = checker.check(goals, grid, 3)
      expect(result.goalStatuses[0].met).toBe(true)
    })

    test("stays met even if count drops later", () => {
      const goals = [
        {
          type: GOAL_TYPE.REACH,
          species: SPECIES.GRASS,
          speciesName: "grass",
          count: 5,
        },
      ]

      const gridWith5 = makeGrid(6, 6)
      for (let i = 0; i < 5; i++) gridWith5.setCell(i, 0, SPECIES.GRASS)

      const gridWith2 = makeGrid(6, 6)
      gridWith2.setCell(0, 0, SPECIES.GRASS)
      gridWith2.setCell(1, 0, SPECIES.GRASS)

      checker.check(goals, gridWith5, 1) // reach 5 -> met
      const result = checker.check(goals, gridWith2, 2) // dropped to 2 -> still met
      expect(result.goalStatuses[0].met).toBe(true)
    })

    test("not met before reaching threshold", () => {
      const goals = [
        {
          type: GOAL_TYPE.REACH,
          species: SPECIES.GRASS,
          speciesName: "grass",
          count: 5,
        },
      ]

      const grid = makeGrid(6, 6)
      grid.setCell(0, 0, SPECIES.GRASS)
      grid.setCell(1, 0, SPECIES.GRASS)

      const result = checker.check(goals, grid, 3)
      expect(result.goalStatuses[0].met).toBe(false)
    })
  })

  describe("allMet", () => {
    test("requires all goals to be met", () => {
      const grid = makeGrid(6, 6)
      grid.setCell(0, 0, SPECIES.GRASS)

      const goals = [
        { type: GOAL_TYPE.SURVIVE, generations: 5 },
        {
          type: GOAL_TYPE.REACH,
          species: SPECIES.GRASS,
          speciesName: "grass",
          count: 10,
        },
      ]

      const result = checker.check(goals, grid, 10)
      // survive met (gen 10 >= 5, 1 living), but reach not met (1 < 10)
      expect(result.goalStatuses[0].met).toBe(true)
      expect(result.goalStatuses[1].met).toBe(false)
      expect(result.allMet).toBe(false)
    })
  })

  describe("reset", () => {
    test("clears all tracked state", () => {
      const goals = [
        {
          type: GOAL_TYPE.SUSTAIN,
          species: SPECIES.GRASS,
          speciesName: "grass",
          count: 2,
          generations: 2,
        },
      ]

      const grid = makeGrid(4, 4)
      grid.setCell(0, 0, SPECIES.GRASS)
      grid.setCell(1, 0, SPECIES.GRASS)

      checker.check(goals, grid, 1) // counter = 1
      checker.reset()
      const result = checker.check(goals, grid, 2) // counter = 1 (reset)
      expect(result.goalStatuses[0].met).toBe(false)
    })
  })
})

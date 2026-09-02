import { describe, test, expect } from "@jest/globals"
import { SPECIES } from "../js/constants.js"
import { SPECIES_DEFS, SpeciesRegistry } from "../js/Species.js"
import { Grid } from "../js/Grid.js"

const BLOOM_AGE = SPECIES_DEFS[SPECIES.GRASS].bloomAge

// Full registry with all species
function makeGrid(width, height) {
  return new Grid(width, height, new SpeciesRegistry())
}

// Registry with only the plants -- for testing classic Conway-like patterns
// without interference from animal birth rules
function makePlantGrid(width, height) {
  const plantDefs = {}
  for (const [k, v] of Object.entries(SPECIES_DEFS)) {
    if (v.id === SPECIES.GRASS || v.id === SPECIES.FLOWERING_GRASS) plantDefs[k] = v
  }
  return new Grid(width, height, new SpeciesRegistry(plantDefs))
}

/** A 2x2 block, the smallest still life -- each cell has exactly 3 neighbours. */
function block(grid, x, y, species) {
  for (const [dx, dy] of [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ]) {
    grid.setCell(x + dx, y + dy, species)
  }
}

describe("Grid", () => {
  describe("basics", () => {
    test("initializes empty", () => {
      expect(makeGrid(4, 4).countLiving()).toBe(0)
    })

    test("setCell and getCell", () => {
      const grid = makeGrid(4, 4)
      grid.setCell(1, 2, SPECIES.GRASS)
      expect(grid.getCell(1, 2).species).toBe(SPECIES.GRASS)
    })

    test("getCell returns null for out of bounds", () => {
      const grid = makeGrid(4, 4)
      expect(grid.getCell(-1, 0)).toBeNull()
      expect(grid.getCell(4, 0)).toBeNull()
      expect(grid.getCell(0, -1)).toBeNull()
      expect(grid.getCell(0, 4)).toBeNull()
    })

    test("setCell ignores out of bounds", () => {
      const grid = makeGrid(4, 4)
      grid.setCell(-1, 0, SPECIES.GRASS)
      expect(grid.countLiving()).toBe(0)
    })
  })

  describe("countNeighbors", () => {
    test("counts adjacent cells of given species", () => {
      const grid = makeGrid(4, 4)
      grid.setCell(0, 0, SPECIES.GRASS)
      grid.setCell(2, 0, SPECIES.GRASS)
      grid.setCell(1, 1, SPECIES.FLOWERING_GRASS)
      expect(grid.countNeighbors(1, 0, [SPECIES.GRASS])).toBe(2)
      expect(grid.countNeighbors(1, 0, [SPECIES.GRASS, SPECIES.FLOWERING_GRASS])).toBe(3)
    })

    test("edge cells have fewer neighbors", () => {
      const grid = makeGrid(3, 3)
      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) grid.setCell(x, y, SPECIES.GRASS)
      }
      expect(grid.countNeighbors(0, 0, [SPECIES.GRASS])).toBe(3)
      expect(grid.countNeighbors(1, 1, [SPECIES.GRASS])).toBe(8)
      expect(grid.countNeighbors(1, 0, [SPECIES.GRASS])).toBe(5)
    })
  })

  describe("countSpecies", () => {
    test("counts total cells of a species", () => {
      const grid = makeGrid(4, 4)
      grid.setCell(0, 0, SPECIES.GRASS)
      grid.setCell(1, 0, SPECIES.GRASS)
      grid.setCell(2, 0, SPECIES.RABBIT)
      expect(grid.countSpecies(SPECIES.GRASS)).toBe(2)
      expect(grid.countSpecies(SPECIES.RABBIT)).toBe(1)
    })
  })

  describe("countSpeciesInZone", () => {
    test("counts within rectangle", () => {
      const grid = makeGrid(6, 6)
      grid.setCell(1, 1, SPECIES.GRASS)
      grid.setCell(2, 2, SPECIES.GRASS)
      grid.setCell(5, 5, SPECIES.GRASS)
      expect(grid.countSpeciesInZone(SPECIES.GRASS, { x: 0, y: 0, w: 4, h: 4 })).toBe(2)
    })

    test("clamps to grid bounds", () => {
      const grid = makeGrid(4, 4)
      grid.setCell(3, 3, SPECIES.GRASS)
      expect(grid.countSpeciesInZone(SPECIES.GRASS, { x: 2, y: 2, w: 10, h: 10 })).toBe(1)
    })
  })

  describe("step - survival", () => {
    test("block of 4 grass is stable", () => {
      const grid = makePlantGrid(6, 6)
      block(grid, 2, 2, SPECIES.GRASS)

      const next = grid.step()
      expect(next.countSpecies(SPECIES.GRASS)).toBe(4)
    })

    test("isolated cell dies", () => {
      const grid = makePlantGrid(6, 6)
      grid.setCell(3, 3, SPECIES.GRASS)
      expect(grid.step().getCell(3, 3).species).toBe(SPECIES.EMPTY)
    })

    test("blinker oscillates", () => {
      const grid = makePlantGrid(6, 6)
      grid.setCell(2, 3, SPECIES.GRASS)
      grid.setCell(3, 3, SPECIES.GRASS)
      grid.setCell(4, 3, SPECIES.GRASS)

      const step1 = grid.step()
      expect(step1.getCell(3, 2).species).toBe(SPECIES.GRASS)
      expect(step1.getCell(3, 3).species).toBe(SPECIES.GRASS)
      expect(step1.getCell(3, 4).species).toBe(SPECIES.GRASS)
      expect(step1.getCell(2, 3).species).toBe(SPECIES.EMPTY)
      expect(step1.getCell(4, 3).species).toBe(SPECIES.EMPTY)

      const step2 = step1.step()
      expect(step2.getCell(2, 3).species).toBe(SPECIES.GRASS)
      expect(step2.getCell(3, 3).species).toBe(SPECIES.GRASS)
      expect(step2.getCell(4, 3).species).toBe(SPECIES.GRASS)
    })
  })

  describe("step - blooming", () => {
    test("grass turns into flowering grass at the bloom age", () => {
      const grid = makePlantGrid(6, 6)
      block(grid, 2, 2, SPECIES.GRASS)

      let next = grid
      for (let i = 0; i < BLOOM_AGE - 1; i++) next = next.step()
      expect(next.getCell(2, 2).species).toBe(SPECIES.GRASS)
      expect(next.getCell(2, 2).age).toBe(BLOOM_AGE - 1)

      next = next.step()
      expect(next.getCell(2, 2).species).toBe(SPECIES.FLOWERING_GRASS)
      expect(next.getCell(2, 2).age).toBe(BLOOM_AGE)
    })

    test("a bloomed block stays put and stays bloomed", () => {
      const grid = makePlantGrid(6, 6)
      block(grid, 2, 2, SPECIES.GRASS)
      let next = grid
      for (let i = 0; i < BLOOM_AGE + 10; i++) next = next.step()
      expect(next.countSpecies(SPECIES.FLOWERING_GRASS)).toBe(4)
      expect(next.countSpecies(SPECIES.GRASS)).toBe(0)
    })

    test("the bloom keeps feeding grass's neighbour count", () => {
      // Three bloomed cells around an empty one still birth grass there,
      // exactly as three plain grass cells would.
      const grid = makePlantGrid(6, 6)
      for (const [x, y] of [
        [2, 2],
        [3, 2],
        [4, 2],
      ]) {
        grid.setCell(x, y, SPECIES.FLOWERING_GRASS)
      }
      expect(grid.step().getCell(3, 3).species).toBe(SPECIES.GRASS)
    })

    test("short-lived patterns never reach the bloom age", () => {
      // The glider's cells are recreated every cycle, so they stay young and
      // the classic pattern is unaffected by blooming.
      const grid = makePlantGrid(12, 12)
      for (const [x, y] of [
        [3, 2],
        [4, 3],
        [2, 4],
        [3, 4],
        [4, 4],
      ]) {
        grid.setCell(x, y, SPECIES.GRASS)
      }
      let next = grid
      for (let i = 0; i < 20; i++) {
        next = next.step()
        expect(next.countSpecies(SPECIES.FLOWERING_GRASS)).toBe(0)
      }
      // And it has travelled: 20 generations is 5 glider cycles, so (5, 5)
      expect(next.getCell(8, 7).species).toBe(SPECIES.GRASS)
      expect(next.countSpecies(SPECIES.GRASS)).toBe(5)
    })

    test("flowering grass is never born on its own", () => {
      const grid = makePlantGrid(6, 6)
      for (const [x, y] of [
        [2, 2],
        [3, 2],
        [4, 2],
      ]) {
        grid.setCell(x, y, SPECIES.FLOWERING_GRASS)
      }
      const next = grid.step()
      // The newly born cell is young grass, not an instant bloom
      expect(next.getCell(3, 3).species).not.toBe(SPECIES.FLOWERING_GRASS)
    })
  })

  describe("step - birth priority", () => {
    test("the higher-priority species takes a contested cell", () => {
      // Three grass cells around (3,3) satisfy both grass's birth rule and the
      // rabbit's, and the rabbit at (2,4) satisfies birthRequiresOwn. Rabbit
      // priority is higher, so it gets the cell.
      const grid = makeGrid(6, 6)
      for (const [x, y] of [
        [2, 2],
        [3, 2],
        [4, 2],
      ]) {
        grid.setCell(x, y, SPECIES.GRASS)
      }
      grid.setCell(2, 4, SPECIES.RABBIT)
      expect(grid.step().getCell(3, 3).species).toBe(SPECIES.RABBIT)
    })
  })

  describe("step - a consumer counts food, not company", () => {
    test("a rabbit surrounded by grass lives", () => {
      // The old rule counted grass against a survive of [2,3], so this rabbit
      // died of five blades of food. Nothing else could get a prey boom going.
      const grid = makeGrid(6, 6)
      grid.setCell(3, 3, SPECIES.RABBIT)
      for (const [x, y] of [
        [2, 2],
        [3, 2],
        [4, 2],
        [2, 3],
        [4, 3],
      ]) {
        grid.setCell(x, y, SPECIES.GRASS)
      }
      expect(grid.step().getCell(3, 3).species).toBe(SPECIES.RABBIT)
    })

    test("a rabbit with nothing to eat lives out its life anyway", () => {
      // survive: null -- only maxAge and a fox can end it.
      const grid = makeGrid(6, 6)
      grid.setCell(3, 3, SPECIES.RABBIT)
      expect(grid.step().getCell(3, 3).species).toBe(SPECIES.RABBIT)
    })

    test("a rabbit is born on 2 or 3 grass next to another rabbit", () => {
      const grid = makeGrid(6, 6)
      grid.setCell(2, 2, SPECIES.GRASS)
      grid.setCell(4, 2, SPECIES.GRASS)
      grid.setCell(2, 4, SPECIES.RABBIT)
      expect(grid.step().getCell(3, 3).species).toBe(SPECIES.RABBIT)
    })

    test("rabbits do not appear out of bare grass", () => {
      const grid = makeGrid(6, 6)
      grid.setCell(2, 2, SPECIES.GRASS)
      grid.setCell(4, 2, SPECIES.GRASS)
      expect(grid.step().getCell(3, 3).species).not.toBe(SPECIES.RABBIT)
    })
  })

  describe("step - maxAge", () => {
    test("a rabbit dies when it reaches maxAge", () => {
      const grid = makeGrid(6, 6)
      block(grid, 2, 2, SPECIES.RABBIT)
      for (const [x, y] of [
        [2, 2],
        [3, 2],
        [2, 3],
        [3, 3],
      ]) {
        grid.cells[y][x].age = 25
      }
      expect(grid.step().getCell(2, 2).species).toBe(SPECIES.EMPTY)
    })

    test("a rabbit survives just before maxAge", () => {
      const grid = makeGrid(6, 6)
      block(grid, 2, 2, SPECIES.RABBIT)
      grid.cells[2][2].age = 23

      const next = grid.step()
      expect(next.getCell(2, 2).species).toBe(SPECIES.RABBIT)
      expect(next.getCell(2, 2).age).toBe(24)
    })
  })

  describe("step - rabbits eat grass", () => {
    test("grass adjacent to 2+ rabbits dies", () => {
      const grid = makeGrid(6, 6)
      grid.setCell(2, 2, SPECIES.GRASS)
      grid.setCell(1, 2, SPECIES.RABBIT)
      grid.setCell(3, 2, SPECIES.RABBIT)
      expect(grid.step().getCell(2, 2).species).toBe(SPECIES.EMPTY)
    })

    test("flowering grass is eaten too", () => {
      const grid = makeGrid(6, 6)
      grid.setCell(2, 2, SPECIES.FLOWERING_GRASS)
      grid.setCell(1, 2, SPECIES.RABBIT)
      grid.setCell(3, 2, SPECIES.RABBIT)
      expect(grid.step().getCell(2, 2).species).toBe(SPECIES.EMPTY)
    })

    test("grass adjacent to 1 rabbit survives normally", () => {
      const grid = makeGrid(6, 6)
      block(grid, 2, 2, SPECIES.GRASS)
      grid.setCell(1, 1, SPECIES.RABBIT)
      expect(grid.step().getCell(2, 2).species).toBe(SPECIES.GRASS)
    })
  })

  describe("step - foxes eat rabbits", () => {
    test("a rabbit adjacent to a fox dies", () => {
      const grid = makeGrid(6, 6)
      grid.setCell(2, 2, SPECIES.RABBIT)
      grid.setCell(1, 2, SPECIES.FOX)
      expect(grid.step().getCell(2, 2).species).toBe(SPECIES.EMPTY)
    })

    test("a rabbit out of reach of every fox lives", () => {
      const grid = makeGrid(6, 6)
      grid.setCell(2, 2, SPECIES.RABBIT)
      grid.setCell(4, 4, SPECIES.FOX)
      expect(grid.step().getCell(2, 2).species).toBe(SPECIES.RABBIT)
    })

    test("eating beats survival, so nothing saves a cornered rabbit", () => {
      const grid = makeGrid(6, 6)
      // A rabbit with food and company, which would otherwise survive
      block(grid, 2, 2, SPECIES.RABBIT)
      grid.setCell(1, 1, SPECIES.FOX)
      expect(grid.step().getCell(2, 2).species).toBe(SPECIES.EMPTY)
    })

    test("a fox with no prey lives out its life anyway", () => {
      // survive: null for the fox too. It dies of maxAge, not of loneliness --
      // counting only prey for survival killed every fox within a few
      // generations, because prey adjacency never lasts.
      const grid = makeGrid(6, 6)
      grid.setCell(2, 2, SPECIES.FOX)
      expect(grid.step().getCell(2, 2).species).toBe(SPECIES.FOX)
    })

    test("foxes need a fox nearby to be born", () => {
      // Three rabbits around (2,2) satisfy the fox's birth count, but with no
      // fox adjacent birthRequiresOwn blocks it.
      const grid = makeGrid(6, 6)
      for (const [x, y] of [
        [1, 1],
        [3, 1],
        [1, 3],
      ]) {
        grid.setCell(x, y, SPECIES.RABBIT)
      }
      expect(grid.step().getCell(2, 2).species).not.toBe(SPECIES.FOX)
    })

    test("a fox is born on 3 rabbits when a fox is adjacent", () => {
      // The neighbouring fox is not part of the count -- a fox counts prey
      // only -- so three rabbits are still needed.
      const grid = makeGrid(6, 6)
      for (const [x, y] of [
        [1, 1],
        [3, 1],
        [1, 3],
      ]) {
        grid.setCell(x, y, SPECIES.RABBIT)
      }
      grid.setCell(3, 3, SPECIES.FOX)
      expect(grid.step().getCell(2, 2).species).toBe(SPECIES.FOX)
    })

    test("two rabbits are not enough for a new fox", () => {
      const grid = makeGrid(6, 6)
      grid.setCell(1, 1, SPECIES.RABBIT)
      grid.setCell(3, 1, SPECIES.RABBIT)
      grid.setCell(3, 3, SPECIES.FOX)
      expect(grid.step().getCell(2, 2).species).not.toBe(SPECIES.FOX)
    })
  })

  describe("step - bee pollination", () => {
    test("grass near a bee spreads on 2 neighbours instead of 3", () => {
      const grid = makeGrid(8, 8)
      grid.setCell(3, 4, SPECIES.GRASS)
      grid.setCell(5, 4, SPECIES.GRASS)
      grid.setCell(4, 3, SPECIES.BEE)
      expect(grid.step().getCell(4, 4).species).toBe(SPECIES.GRASS)
    })

    test("without a bee, 2 neighbours are not enough", () => {
      const grid = makeGrid(8, 8)
      grid.setCell(3, 4, SPECIES.GRASS)
      grid.setCell(5, 4, SPECIES.GRASS)
      expect(grid.step().getCell(4, 4).species).toBe(SPECIES.EMPTY)
    })
  })

  describe("step - immutability", () => {
    test("step returns a new grid, original unchanged", () => {
      const grid = makePlantGrid(6, 6)
      grid.setCell(2, 3, SPECIES.GRASS)
      grid.setCell(3, 3, SPECIES.GRASS)
      grid.setCell(4, 3, SPECIES.GRASS)

      const next = grid.step()
      expect(grid.getCell(2, 3).species).toBe(SPECIES.GRASS)
      expect(grid.getCell(4, 3).species).toBe(SPECIES.GRASS)
      expect(next.getCell(2, 3).species).toBe(SPECIES.EMPTY)
    })
  })

  describe("clone", () => {
    test("creates independent copy", () => {
      const grid = makeGrid(4, 4)
      grid.setCell(1, 1, SPECIES.GRASS)
      const copy = grid.clone()
      copy.setCell(1, 1, SPECIES.RABBIT)
      expect(grid.getCell(1, 1).species).toBe(SPECIES.GRASS)
      expect(copy.getCell(1, 1).species).toBe(SPECIES.RABBIT)
    })
  })
})

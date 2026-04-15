import { describe, test, expect } from "@jest/globals"
import { SPECIES } from "../js/constants.js"
import { SPECIES_DEFS, SpeciesRegistry } from "../js/Species.js"
import { Grid } from "../js/Grid.js"

// Full registry with all species
function makeGrid(width, height) {
  return new Grid(width, height, new SpeciesRegistry())
}

// Registry with only grass and flowers -- for testing classic Conway-like patterns
// without interference from rabbit/bee birth rules
function makePlantGrid(width, height) {
  const plantDefs = {}
  for (const [k, v] of Object.entries(SPECIES_DEFS)) {
    if (v.id === SPECIES.GRASS || v.id === SPECIES.FLOWER) plantDefs[k] = v
  }
  return new Grid(width, height, new SpeciesRegistry(plantDefs))
}

describe("Grid", () => {
  describe("basics", () => {
    test("initializes empty", () => {
      const grid = makeGrid(4, 4)
      expect(grid.countLiving()).toBe(0)
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
      grid.setCell(1, 1, SPECIES.FLOWER)
      // (1,0) has neighbors at (0,0)=grass, (2,0)=grass, (1,1)=flower
      expect(grid.countNeighbors(1, 0, [SPECIES.GRASS])).toBe(2)
      expect(grid.countNeighbors(1, 0, [SPECIES.GRASS, SPECIES.FLOWER])).toBe(3)
    })

    test("edge cells have fewer neighbors", () => {
      const grid = makeGrid(3, 3)
      // Fill entire grid with grass
      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
          grid.setCell(x, y, SPECIES.GRASS)
        }
      }
      // Corner (0,0) has 3 neighbors
      expect(grid.countNeighbors(0, 0, [SPECIES.GRASS])).toBe(3)
      // Center (1,1) has 8 neighbors
      expect(grid.countNeighbors(1, 1, [SPECIES.GRASS])).toBe(8)
      // Edge (1,0) has 5 neighbors
      expect(grid.countNeighbors(1, 0, [SPECIES.GRASS])).toBe(5)
    })
  })

  describe("countSpecies", () => {
    test("counts total cells of a species", () => {
      const grid = makeGrid(4, 4)
      grid.setCell(0, 0, SPECIES.GRASS)
      grid.setCell(1, 0, SPECIES.GRASS)
      grid.setCell(2, 0, SPECIES.FLOWER)
      expect(grid.countSpecies(SPECIES.GRASS)).toBe(2)
      expect(grid.countSpecies(SPECIES.FLOWER)).toBe(1)
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
      // 2x2 block: each cell has 3 neighbors, survive includes 3
      const grid = makePlantGrid(6, 6)
      grid.setCell(2, 2, SPECIES.GRASS)
      grid.setCell(3, 2, SPECIES.GRASS)
      grid.setCell(2, 3, SPECIES.GRASS)
      grid.setCell(3, 3, SPECIES.GRASS)

      const next = grid.step()
      expect(next.getCell(2, 2).species).toBe(SPECIES.GRASS)
      expect(next.getCell(3, 2).species).toBe(SPECIES.GRASS)
      expect(next.getCell(2, 3).species).toBe(SPECIES.GRASS)
      expect(next.getCell(3, 3).species).toBe(SPECIES.GRASS)
      expect(next.countSpecies(SPECIES.GRASS)).toBe(4)
    })

    test("isolated cell dies", () => {
      const grid = makePlantGrid(6, 6)
      grid.setCell(3, 3, SPECIES.GRASS)
      const next = grid.step()
      expect(next.getCell(3, 3).species).toBe(SPECIES.EMPTY)
    })

    test("blinker oscillates", () => {
      // Horizontal line of 3 toggles to vertical
      const grid = makePlantGrid(6, 6)
      grid.setCell(2, 3, SPECIES.GRASS)
      grid.setCell(3, 3, SPECIES.GRASS)
      grid.setCell(4, 3, SPECIES.GRASS)

      const step1 = grid.step()
      // Should become vertical
      expect(step1.getCell(3, 2).species).toBe(SPECIES.GRASS)
      expect(step1.getCell(3, 3).species).toBe(SPECIES.GRASS)
      expect(step1.getCell(3, 4).species).toBe(SPECIES.GRASS)
      expect(step1.getCell(2, 3).species).toBe(SPECIES.EMPTY)
      expect(step1.getCell(4, 3).species).toBe(SPECIES.EMPTY)

      // And back to horizontal
      const step2 = step1.step()
      expect(step2.getCell(2, 3).species).toBe(SPECIES.GRASS)
      expect(step2.getCell(3, 3).species).toBe(SPECIES.GRASS)
      expect(step2.getCell(4, 3).species).toBe(SPECIES.GRASS)
    })
  })

  describe("step - birth priority", () => {
    test("flower wins over grass when both want to birth", () => {
      // Set up so both species want to birth in the same empty cell.
      // We need 3 grass neighbors AND 3 flower neighbors for the target cell.
      // Grass counts both grass+flower as neighbors, so 3 of either works.
      // Flower counts only flowers, so we need exactly 3 flowers adjacent.
      const grid = makePlantGrid(6, 6)

      // Place 3 flowers around (3,3)
      grid.setCell(2, 2, SPECIES.FLOWER)
      grid.setCell(3, 2, SPECIES.FLOWER)
      grid.setCell(4, 2, SPECIES.FLOWER)

      // (3,3) is empty. Flower sees 3 flower neighbors -> birth.
      // Grass sees 3 neighbors (all flowers count for grass) -> birth.
      // Flower has higher priority -> flower wins.
      const next = grid.step()
      expect(next.getCell(3, 3).species).toBe(SPECIES.FLOWER)
    })
  })

  describe("step - maxAge", () => {
    test("flower dies when reaching maxAge", () => {
      const grid = makePlantGrid(6, 6)
      // Place a stable flower block (4 cells, each has 3 flower neighbors)
      grid.setCell(2, 2, SPECIES.FLOWER)
      grid.setCell(3, 2, SPECIES.FLOWER)
      grid.setCell(2, 3, SPECIES.FLOWER)
      grid.setCell(3, 3, SPECIES.FLOWER)

      // Manually set age to maxAge (flower maxAge is 30)
      grid.cells[2][2].age = 30
      grid.cells[2][3].age = 30
      grid.cells[3][2].age = 30
      grid.cells[3][3].age = 30

      // Next step: age >= maxAge -> should die
      const next = grid.step()
      expect(next.getCell(2, 2).species).toBe(SPECIES.EMPTY)
    })

    test("flower survives just before maxAge", () => {
      const grid = makePlantGrid(6, 6)
      grid.setCell(2, 2, SPECIES.FLOWER)
      grid.setCell(3, 2, SPECIES.FLOWER)
      grid.setCell(2, 3, SPECIES.FLOWER)
      grid.setCell(3, 3, SPECIES.FLOWER)
      grid.cells[2][2].age = 28

      const next = grid.step()
      expect(next.getCell(2, 2).species).toBe(SPECIES.FLOWER)
      expect(next.getCell(2, 2).age).toBe(29)
    })
  })

  describe("step - rabbit kills grass", () => {
    test("grass adjacent to 2+ rabbits dies", () => {
      const grid = makeGrid(6, 6)
      grid.setCell(2, 2, SPECIES.GRASS)
      grid.setCell(1, 2, SPECIES.RABBIT)
      grid.setCell(3, 2, SPECIES.RABBIT)
      // Grass at (2,2) has 2 rabbit neighbors -> killed

      const next = grid.step()
      expect(next.getCell(2, 2).species).toBe(SPECIES.EMPTY)
    })

    test("grass adjacent to 1 rabbit survives normally", () => {
      const grid = makeGrid(6, 6)
      // Make a stable grass block
      grid.setCell(2, 2, SPECIES.GRASS)
      grid.setCell(3, 2, SPECIES.GRASS)
      grid.setCell(2, 3, SPECIES.GRASS)
      grid.setCell(3, 3, SPECIES.GRASS)
      // One rabbit nearby
      grid.setCell(1, 1, SPECIES.RABBIT)

      const next = grid.step()
      // Grass block should still be alive (only 1 rabbit neighbor each)
      expect(next.getCell(2, 2).species).toBe(SPECIES.GRASS)
    })
  })

  describe("step - bee pollination", () => {
    test("flowers near bees can birth with 2 neighbors instead of 3", () => {
      const grid = makeGrid(8, 8)
      // Place 2 flowers near an empty cell at (4,4)
      grid.setCell(3, 4, SPECIES.FLOWER)
      grid.setCell(5, 4, SPECIES.FLOWER)
      // Place a bee adjacent to (4,4) to enable pollination
      grid.setCell(4, 3, SPECIES.BEE)

      // Without bee: flower needs 3 flower neighbors to birth. Only 2 here.
      // With bee: pollinateBirth = [2,3], so 2 flower neighbors suffices.
      const next = grid.step()
      expect(next.getCell(4, 4).species).toBe(SPECIES.FLOWER)
    })
  })

  describe("step - immutability", () => {
    test("step returns a new grid, original unchanged", () => {
      const grid = makePlantGrid(6, 6)
      grid.setCell(2, 3, SPECIES.GRASS)
      grid.setCell(3, 3, SPECIES.GRASS)
      grid.setCell(4, 3, SPECIES.GRASS)

      const next = grid.step()
      // Original still has horizontal blinker
      expect(grid.getCell(2, 3).species).toBe(SPECIES.GRASS)
      expect(grid.getCell(4, 3).species).toBe(SPECIES.GRASS)
      // Next has vertical
      expect(next.getCell(2, 3).species).toBe(SPECIES.EMPTY)
    })
  })

  describe("clone", () => {
    test("creates independent copy", () => {
      const grid = makeGrid(4, 4)
      grid.setCell(1, 1, SPECIES.GRASS)
      const copy = grid.clone()
      copy.setCell(1, 1, SPECIES.FLOWER)
      expect(grid.getCell(1, 1).species).toBe(SPECIES.GRASS)
      expect(copy.getCell(1, 1).species).toBe(SPECIES.FLOWER)
    })
  })
})

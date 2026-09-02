import { describe, test, expect } from "@jest/globals"
import { PRESETS } from "../js/Presets.js"
import { SPECIES } from "../js/constants.js"
import { SpeciesRegistry } from "../js/Species.js"
import { Grid } from "../js/Grid.js"
import { PUZZLES } from "../js/PuzzleData.js"

const { gridWidth, gridHeight } = PUZZLES[0]

function byName(name) {
  const preset = PRESETS.find((p) => p.name === name)
  expect(preset).toBeDefined()
  return preset
}

function load(preset) {
  const grid = new Grid(gridWidth, gridHeight, new SpeciesRegistry())
  for (const cell of preset.cells) grid.setCell(cell.x, cell.y, cell.species)
  return grid
}

function advance(grid, generations) {
  let next = grid
  for (let i = 0; i < generations; i++) next = next.step()
  return next
}

/** Plants at either life stage. */
function plants(grid) {
  return grid.countSpecies(SPECIES.GRASS) + grid.countSpecies(SPECIES.FLOWERING_GRASS)
}

describe("PRESETS", () => {
  const placeable = new Set(new SpeciesRegistry().placeable().map((s) => s.id))

  test("each preset has the required fields with correct types", () => {
    for (const preset of PRESETS) {
      expect(typeof preset.name).toBe("string")
      expect(typeof preset.description).toBe("string")
      expect(Array.isArray(preset.cells)).toBe(true)
      expect(preset.cells.length).toBeGreaterThan(0)
    }
  })

  test("preset names are unique", () => {
    const names = PRESETS.map((p) => p.name)
    expect(new Set(names).size).toBe(names.length)
  })

  test("every cell has integer coordinates and a placeable species", () => {
    for (const preset of PRESETS) {
      for (const cell of preset.cells) {
        expect(Number.isInteger(cell.x)).toBe(true)
        expect(Number.isInteger(cell.y)).toBe(true)
        expect(cell.x).toBeGreaterThanOrEqual(0)
        expect(cell.y).toBeGreaterThanOrEqual(0)
        // Life stages are reached by ageing, never placed
        expect(placeable.has(cell.species)).toBe(true)
      }
    }
  })

  test("preset cells fit the grid the game actually uses", () => {
    for (const preset of PRESETS) {
      for (const cell of preset.cells) {
        expect(cell.x).toBeLessThan(gridWidth)
        expect(cell.y).toBeLessThan(gridHeight)
      }
    }
  })

  test("no two cells in a preset share the same coordinate", () => {
    for (const preset of PRESETS) {
      const coords = preset.cells.map((c) => `${c.x},${c.y}`)
      expect(new Set(coords).size).toBe(coords.length)
    }
  })
})

describe("the Glider preset", () => {
  test("is the ordinary glider and still glides", () => {
    const start = load(byName("Glider"))
    const after = advance(start, 4)
    // One glider period is four generations and one diagonal step
    for (let y = 0; y < gridHeight - 1; y++) {
      for (let x = 0; x < gridWidth - 1; x++) {
        expect(after.getCell(x + 1, y + 1).species).toBe(start.getCell(x, y).species)
      }
    }
  })

  test("never blooms, because its cells are always young", () => {
    // Nothing in the glider survives long enough to reach the bloom age, so
    // the life stage does not need a special case for it.
    let grid = load(byName("Glider"))
    for (let i = 0; i < 20; i++) {
      grid = grid.step()
      expect(grid.countSpecies(SPECIES.FLOWERING_GRASS)).toBe(0)
    }
  })
})

describe("the Meadow preset", () => {
  test("settles into a meadow that comes into bloom", () => {
    const grid = advance(load(byName("Meadow")), 20)
    expect(grid.countSpecies(SPECIES.FLOWERING_GRASS)).toBeGreaterThan(0)
    expect(grid.countSpecies(SPECIES.GRASS)).toBe(0)
  })
})

describe("the Pollinator preset", () => {
  test("bees make the grass spread further than it would alone", () => {
    const withBees = byName("Pollinator")
    const control = {
      ...withBees,
      cells: withBees.cells.filter((c) => c.species !== SPECIES.BEE),
    }
    expect(plants(advance(load(withBees), 20))).toBeGreaterThan(plants(advance(load(control), 20)))
  })
})

describe("the food-chain presets", () => {
  const chain = byName("Food Chain")
  const noPredator = byName("No Predator")

  test("differ only by the foxes", () => {
    const key = (cells) =>
      cells
        .map((c) => `${c.x},${c.y},${c.species}`)
        .sort()
        .join("|")
    const foxes = chain.cells.filter((c) => c.species === SPECIES.FOX)
    expect(foxes.length).toBeGreaterThan(0)
    expect(key(chain.cells.filter((c) => c.species !== SPECIES.FOX))).toBe(key(noPredator.cells))
  })

  test("without a predator the rabbits explode and take the grass with them", () => {
    let grid = load(noPredator)
    let rabbitPeak = 0
    for (let i = 0; i < 60; i++) {
      grid = grid.step()
      rabbitPeak = Math.max(rabbitPeak, grid.countSpecies(SPECIES.RABBIT))
    }
    const startingRabbits = noPredator.cells.filter((c) => c.species === SPECIES.RABBIT).length
    expect(rabbitPeak).toBeGreaterThan(startingRabbits * 5)
    expect(plants(grid)).toBe(0)
  })

  test("with the foxes the rabbits stay down and the grass survives", () => {
    let chainGrid = load(chain)
    let chainRabbitPeak = 0
    for (let i = 0; i < 60; i++) {
      chainGrid = chainGrid.step()
      chainRabbitPeak = Math.max(chainRabbitPeak, chainGrid.countSpecies(SPECIES.RABBIT))
    }
    let bareGrid = load(noPredator)
    let bareRabbitPeak = 0
    for (let i = 0; i < 60; i++) {
      bareGrid = bareGrid.step()
      bareRabbitPeak = Math.max(bareRabbitPeak, bareGrid.countSpecies(SPECIES.RABBIT))
    }

    expect(chainRabbitPeak).toBeLessThan(bareRabbitPeak / 2)
    expect(plants(chainGrid)).toBeGreaterThan(0)
  })
})

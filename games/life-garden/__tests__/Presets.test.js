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

  /** Peak count of a species, and the generation it happened. */
  function peak(preset, speciesId, generations) {
    let grid = load(preset)
    let best = { value: grid.countSpecies(speciesId), gen: 0 }
    for (let i = 1; i <= generations; i++) {
      grid = grid.step()
      const value = grid.countSpecies(speciesId)
      if (value > best.value) best = { value, gen: i }
    }
    return best
  }

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

  test("the den cells stay empty without the foxes, so the comparison is honest", () => {
    // A cellular automaton is chaotic: three extra cells anywhere busy would
    // change the whole run on their own, and the old den did exactly that --
    // three foxes that never ate anything still halved the rabbit peak. The den
    // sits on cells this board leaves empty, so any difference between the two
    // charts is the foxes' doing.
    const den = chain.cells.filter((c) => c.species === SPECIES.FOX)
    let grid = load(noPredator)
    for (let i = 0; i < 60; i++) {
      for (const cell of den) {
        expect(grid.getCell(cell.x, cell.y).species).toBe(SPECIES.EMPTY)
      }
      grid = grid.step()
    }
  })

  test("without a predator the rabbits explode and eat the meadow down", () => {
    let grid = load(noPredator)
    const startingPlants = plants(grid)
    let rabbitPeak = 0
    for (let i = 0; i < 60; i++) {
      grid = grid.step()
      rabbitPeak = Math.max(rabbitPeak, grid.countSpecies(SPECIES.RABBIT))
    }
    const startingRabbits = noPredator.cells.filter((c) => c.species === SPECIES.RABBIT).length
    // 4 -> 85 by generation 17
    expect(rabbitPeak).toBeGreaterThan(startingRabbits * 5)
    // 122 plants -> 23 by generation 60, and the rabbits starve with them
    expect(plants(grid)).toBeLessThan(startingPlants / 4)
    expect(grid.countSpecies(SPECIES.RABBIT)).toBe(0)
  })

  test("with the foxes the rabbits are held down and the foxes follow them up", () => {
    const bareRabbits = peak(noPredator, SPECIES.RABBIT, 60)
    const chainRabbits = peak(chain, SPECIES.RABBIT, 60)
    const chainFoxes = peak(chain, SPECIES.FOX, 60)
    const startingFoxes = chain.cells.filter((c) => c.species === SPECIES.FOX).length

    // 85 without the foxes, 49 with them
    expect(chainRabbits.value).toBeLessThan(bareRabbits.value * 0.75)
    // 3 foxes become 29, so the predator is breeding rather than ageing out
    expect(chainFoxes.value).toBeGreaterThan(startingFoxes * 3)
    // ...and it peaks after its prey: rabbits at 17, foxes at 35
    expect(chainFoxes.gen).toBeGreaterThan(chainRabbits.gen + 10)
    // Still the scarcer animal
    expect(chainFoxes.value).toBeLessThan(chainRabbits.value)
  })

  test("it is one boom and bust, not a cycle", () => {
    // Grass cannot grow back from nothing, so once the rabbits have been
    // through a patch there is no second wave. If that ever changes, the README
    // says it does not cycle and would need rewriting.
    let grid = load(chain)
    for (let i = 0; i < 120; i++) grid = grid.step()
    expect(grid.countSpecies(SPECIES.RABBIT)).toBe(0)
    expect(grid.countSpecies(SPECIES.FOX)).toBe(0)
    let laterRabbits = 0
    for (let i = 0; i < 180; i++) {
      grid = grid.step()
      laterRabbits = Math.max(laterRabbits, grid.countSpecies(SPECIES.RABBIT))
    }
    expect(laterRabbits).toBe(0)
  })
})

describe("the Rabbit Run preset", () => {
  test("rabbits work along the strips and then starve", () => {
    const preset = byName("Rabbit Run")
    let grid = load(preset)
    const startingPlants = plants(grid)
    let rabbitPeak = 0
    for (let i = 0; i < 60; i++) {
      grid = grid.step()
      rabbitPeak = Math.max(rabbitPeak, grid.countSpecies(SPECIES.RABBIT))
    }
    // 4 -> 75 by generation 18, then nothing left to eat by generation 20
    expect(rabbitPeak).toBeGreaterThan(startingPlants)
    expect(plants(grid)).toBe(0)
    expect(grid.countSpecies(SPECIES.RABBIT)).toBe(0)
  })
})

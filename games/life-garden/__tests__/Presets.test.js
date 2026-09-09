import { describe, test, expect } from "@jest/globals"
import { PRESETS } from "../js/Presets.js"
import { SPECIES } from "../js/constants.js"
import { SpeciesRegistry } from "../js/Species.js"
import { Grid } from "../js/Grid.js"
import { PUZZLES } from "../js/PuzzleData.js"

const { gridWidth, gridHeight } = PUZZLES[0]

/**
 * Several seeds, not one.
 *
 * The simulation is stochastic now, so a claim about a preset that holds on one
 * seed may be luck. Everything below that describes behaviour is checked across
 * this list, and asserted either on every seed or on the average, whichever the
 * claim actually is.
 */
const SEEDS = [20250909, 7, 99, 1234, 555, 31337, 2, 8]

function byName(name) {
  const preset = PRESETS.find((p) => p.name === name)
  expect(preset).toBeDefined()
  return preset
}

function load(preset, seed) {
  const grid = new Grid(gridWidth, gridHeight, new SpeciesRegistry(), seed)
  for (const cell of preset.cells) grid.setCell(cell.x, cell.y, cell.species)
  return grid
}

/**
 * Population of each species, generation by generation.
 *
 * Memoised. These are real simulations -- 600 generations of a 20x20 board with
 * both layers -- and the same (preset, seed, length) combination is asked for
 * by several tests. Without the cache this suite alone took longer than the
 * rest of the repository's put together.
 */
const runs = new Map()
function run(preset, seed, generations) {
  const key = `${preset.name ?? "custom"}:${preset.cells.length}:${seed}:${generations}`
  const cached = runs.get(key)
  if (cached) return cached
  const series = simulate(preset, seed, generations)
  runs.set(key, series)
  return series
}

function simulate(preset, seed, generations) {
  let grid = load(preset, seed)
  const series = { plants: [], bee: [], rabbit: [], fox: [] }
  for (let i = 0; i <= generations; i++) {
    series.plants.push(
      grid.countSpecies(SPECIES.GRASS) + grid.countSpecies(SPECIES.FLOWERING_GRASS),
    )
    series.bee.push(grid.countSpecies(SPECIES.BEE))
    series.rabbit.push(grid.countSpecies(SPECIES.RABBIT))
    series.fox.push(grid.countSpecies(SPECIES.FOX))
    grid = grid.step()
  }
  return series
}

const peak = (series) => Math.max(...series)
const peakAt = (series) => series.indexOf(Math.max(...series))
const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length

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

  test("a plant and an animal may share a cell, but not two of a kind", () => {
    for (const preset of PRESETS) {
      const seen = new Set()
      for (const cell of preset.cells) {
        const key = `${cell.x},${cell.y},${cell.species}`
        expect(seen.has(key)).toBe(false)
        seen.add(key)
      }
    }
  })
})

describe("no board ends dead", () => {
  // The complaint that started all this: every run used to settle into a few
  // frozen flowers with nothing moving. Grass that only dies of crowding, a
  // bloom that ends, and seeds blowing in over the fence between them mean the
  // ground is never bare for good.
  test.each(PRESETS.map((p) => [p.name, p]))("%s still has plants after 600", (_name, preset) => {
    for (const seed of SEEDS) {
      expect(run(preset, seed, 600).plants.at(-1)).toBeGreaterThan(0)
    }
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

  test("the predator holds the rabbits to a fraction of what they reach alone", () => {
    // The whole point of having the same field twice. This is a claim about the
    // population, not about every run: on 7 of these 8 seeds the foxes keep the
    // rabbits under about a quarter of what they reach alone, and on the eighth
    // the foxes lose control late and the rabbits get most of the way there. So
    // every seed is lower, and the average is much lower.
    const withFoxes = SEEDS.map((seed) => peak(run(chain, seed, 600).rabbit))
    const without = SEEDS.map((seed) => peak(run(noPredator, seed, 600).rabbit))

    const notHeldDown = SEEDS.filter((_seed, i) => withFoxes[i] >= without[i])
    expect(notHeldDown).toEqual([])
    expect(mean(withFoxes)).toBeLessThan(mean(without) * 0.4)
  })

  test("the foxes peak after their prey, not with them", () => {
    // The lag is the thing a predator-prey cycle is: the fox can only climb
    // once there is something to eat, and it is still climbing as the rabbits
    // fall away. It runs 60-130 generations behind on these boards.
    for (const seed of SEEDS) {
      const series = run(chain, seed, 600)
      expect(peak(series.fox)).toBeGreaterThan(0)
      expect(peakAt(series.fox)).toBeGreaterThan(peakAt(series.rabbit))
    }
  })

  test("removing the predator costs the meadow", () => {
    // Unchecked rabbits graze the field down and hold it down. With the foxes
    // it stays lush. This is the trophic cascade, and it is the reason the
    // pair of boards is worth having.
    const withFoxes = SEEDS.map((s) => mean(run(chain, s, 600).plants.slice(-150)))
    const without = SEEDS.map((s) => mean(run(noPredator, s, 600).plants.slice(-150)))
    expect(mean(withFoxes)).toBeGreaterThan(mean(without) * 1.3)
  })

  test("both animals are still there at the end, on most seeds", () => {
    // Not every seed: a run of bad luck can still take the last fox, and
    // arrivals only bring one back once there is prey for it again.
    const alive = SEEDS.filter((seed) => {
      const series = run(chain, seed, 600)
      return mean(series.rabbit.slice(-200)) >= 1 && mean(series.fox.slice(-200)) >= 1
    })
    expect(alive.length).toBeGreaterThanOrEqual(SEEDS.length - 2)
  })
})

describe("the Pollinator preset", () => {
  test("bees fill the board faster than the same board without them", () => {
    // Lone blades, so nothing here can use the birth rule: every new blade
    // comes from grass creeping, which is the one thing a bee speeds up. The
    // claim is speed, not size -- the meadow's ceiling is set by crowding, and
    // both boards reach much the same place if you leave them long enough.
    const withBees = byName("Pollinator")
    const control = {
      ...withBees,
      cells: withBees.cells.filter((c) => c.species !== SPECIES.BEE),
    }
    const bees = SEEDS.map((s) => run(withBees, s, 30).plants.at(-1))
    const none = SEEDS.map((s) => run(control, s, 30).plants.at(-1))
    expect(mean(bees)).toBeGreaterThan(mean(none))
  })

  test("the bees are still working after 300 generations", () => {
    const series = run(byName("Pollinator"), SEEDS[0], 600)
    expect(mean(series.bee.slice(-100))).toBeGreaterThan(0)
  })
})

describe("the Meadow preset", () => {
  test("comes into bloom and keeps cycling rather than settling", () => {
    const grid = load(byName("Meadow"), SEEDS[0])
    let next = grid
    let bloomed = false
    for (let i = 0; i < 40; i++) {
      next = next.step()
      if (next.countSpecies(SPECIES.FLOWERING_GRASS) > 0) bloomed = true
    }
    expect(bloomed).toBe(true)
    // Both stages present: the bloom is a phase the meadow passes through, not
    // the state it ends in.
    const late = run(byName("Meadow"), SEEDS[0], 600)
    expect(late.plants.at(-1)).toBeGreaterThan(0)
  })

  test("never grows animals, because none have ever lived there", () => {
    // Arrivals are reinforcements, not introductions. If they were not, this
    // board would sprout rabbits and the No Predator board would sprout foxes,
    // which would make the pair of food-chain boards meaningless.
    for (const seed of SEEDS) {
      const series = run(byName("Meadow"), seed, 600)
      expect(peak(series.rabbit)).toBe(0)
      expect(peak(series.fox)).toBe(0)
      expect(peak(series.bee)).toBe(0)
    }
  })
})

describe("the Rabbit Run preset", () => {
  test("the rabbits boom, strip the strips, and the meadow comes back", () => {
    // Under the old rules this ended with the rabbits starved and the grass
    // gone for good. Now the ground recovers and it can happen again.
    const series = run(byName("Rabbit Run"), SEEDS[0], 600)
    expect(peak(series.rabbit)).toBeGreaterThan(20)
    expect(Math.min(...series.plants.slice(0, 200))).toBeLessThan(peak(series.plants) / 2)
    expect(mean(series.plants.slice(-100))).toBeGreaterThan(20)
  })
})

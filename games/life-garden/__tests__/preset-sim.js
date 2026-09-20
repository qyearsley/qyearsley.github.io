/**
 * Running a preset forward, for the `Presets.*.test.js` suites.
 *
 * Jest treats this file as a module rather than a suite, because `testMatch` is
 * `**\/*.test.js` and this is not one.
 *
 * These are real simulations -- 600 generations of a 20x20 board with both
 * layers -- and they are what the preset suites cost. The memo below makes a
 * (preset, seed, length) combination cost once no matter how many tests ask for
 * it, but the memo is per module instance, and Jest gives every suite file its
 * own. So the suites are split by *preset*, not by subject: whichever file
 * claims a preset runs all of that preset's generations and no other file runs
 * any of them. Moving a test between those files without moving the preset with
 * it silently doubles the work.
 */

import { describe, expect, test } from "@jest/globals"

import { SPECIES } from "../js/constants.js"
import { Grid } from "../js/Grid.js"
import { PRESETS } from "../js/Presets.js"
import { PUZZLES } from "../js/PuzzleData.js"
import { SpeciesRegistry } from "../js/Species.js"

export const { gridWidth, gridHeight } = PUZZLES[0]

/**
 * Several seeds, not one.
 *
 * The simulation is stochastic now, so a claim about a preset that holds on one
 * seed may be luck. Everything in the preset suites that describes behaviour is
 * checked across this list, and asserted either on every seed or on the
 * average, whichever the claim actually is.
 */
export const SEEDS = [20250909, 7, 99, 1234, 555, 31337, 2, 8]

/** The preset with this name, which must exist. */
export function byName(name) {
  const preset = PRESETS.find((p) => p.name === name)
  expect(preset).toBeDefined()
  return preset
}

/** A board with the preset's cells placed on it, ready to step. */
export function load(preset, seed) {
  const grid = new Grid(gridWidth, gridHeight, new SpeciesRegistry(), seed)
  for (const cell of preset.cells) grid.setCell(cell.x, cell.y, cell.species)
  return grid
}

/** Species counted per generation, in the order `simulate` reads them back. */
const TRACKED = [SPECIES.GRASS, SPECIES.FLOWERING_GRASS, SPECIES.BEE, SPECIES.RABBIT, SPECIES.FOX]

const runs = new Map()

/**
 * Population of each species, generation by generation. Memoised -- see the
 * file comment for what that does and does not survive.
 *
 * @param {Object} preset - A preset, or a preset-shaped object with `cells`
 * @param {number} seed - The board's seed
 * @param {number} generations - How many generations to step
 * @returns {{plants: number[], bee: number[], rabbit: number[], fox: number[]}}
 */
export function run(preset, seed, generations) {
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
    // One pass over the board for all five, not one pass each. Worth a few per
    // cent of the run; `grid.step()` is the rest of it.
    const [grass, flowering, bee, rabbit, fox] = grid.countAll(TRACKED)
    series.plants.push(grass + flowering)
    series.bee.push(bee)
    series.rabbit.push(rabbit)
    series.fox.push(fox)
    grid = grid.step()
  }
  return series
}

export const peak = (series) => Math.max(...series)
export const peakAt = (series) => series.indexOf(Math.max(...series))
export const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length

/**
 * Which preset suite runs which presets.
 *
 * The split is by preset because the memo above is per file: whichever suite
 * claims a preset pays for all of its generations, and no other suite pays for
 * any of them. Keep a preset in exactly one list. `Presets.data.test.js` checks
 * that the lists between them still cover `PRESETS`, so a new preset cannot be
 * added without a suite picking it up.
 */
export const PRESETS_BY_SUITE = {
  "Presets.food-chain.test.js": ["Food Chain", "No Predator"],
  "Presets.meadow.test.js": ["Meadow"],
  "Presets.pollinator.test.js": ["Pollinator"],
  "Presets.rabbit-run.test.js": ["Rabbit Run"],
  "Presets.ecosystem-glider.test.js": ["Ecosystem", "Glider"],
}

/** The presets a given suite file is responsible for simulating. */
export const presetsFor = (suite) => PRESETS_BY_SUITE[suite].map(byName)

/**
 * Declare the "no board ends dead" check for the presets a suite owns.
 *
 * Defined once so the test names stay identical across the suites that call it,
 * and so the 600-generation runs stay in the same file as the preset's other
 * tests and share the memo with them.
 *
 * The complaint that started all this: every run used to settle into a few
 * frozen flowers with nothing moving. Grass that only dies of crowding, a bloom
 * that ends, and seeds blowing in over the fence between them mean the ground
 * is never bare for good.
 *
 * @param {Object[]} presets - The presets this suite is responsible for
 * @returns {void}
 */
export function checkNoBoardEndsDead(presets) {
  describe("no board ends dead", () => {
    test.each(presets.map((p) => [p.name, p]))("%s still has plants after 600", (_name, preset) => {
      for (const seed of SEEDS) {
        expect(run(preset, seed, 600).plants.at(-1)).toBeGreaterThan(0)
      }
    })
  })
}

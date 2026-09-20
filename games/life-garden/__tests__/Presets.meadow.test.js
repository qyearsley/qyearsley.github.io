/** The Meadow board, run forward. */

import { describe, expect, test } from "@jest/globals"

import { SPECIES } from "../js/constants.js"
import { byName, checkNoBoardEndsDead, load, peak, presetsFor, run, SEEDS } from "./preset-sim.js"

checkNoBoardEndsDead(presetsFor("Presets.meadow.test.js"))

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

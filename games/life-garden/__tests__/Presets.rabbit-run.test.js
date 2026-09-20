/** The Rabbit Run board, run forward. */

import { describe, expect, test } from "@jest/globals"

import { byName, checkNoBoardEndsDead, mean, peak, presetsFor, run, SEEDS } from "./preset-sim.js"

checkNoBoardEndsDead(presetsFor("Presets.rabbit-run.test.js"))

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

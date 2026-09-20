/**
 * The Food Chain and No Predator boards, run forward.
 *
 * Both live here because "the food-chain presets" compares them, and the
 * simulation memo in `preset-sim.js` is per file: splitting the pair would run
 * one of them twice.
 */

import { describe, expect, test } from "@jest/globals"

import { SPECIES } from "../js/constants.js"
import {
  byName,
  checkNoBoardEndsDead,
  mean,
  peak,
  peakAt,
  presetsFor,
  run,
  SEEDS,
} from "./preset-sim.js"

checkNoBoardEndsDead(presetsFor("Presets.food-chain.test.js"))

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

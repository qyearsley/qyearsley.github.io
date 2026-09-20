/** The Pollinator board, run forward. */

import { describe, expect, test } from "@jest/globals"

import { SPECIES } from "../js/constants.js"
import { byName, checkNoBoardEndsDead, mean, presetsFor, run, SEEDS } from "./preset-sim.js"

checkNoBoardEndsDead(presetsFor("Presets.pollinator.test.js"))

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

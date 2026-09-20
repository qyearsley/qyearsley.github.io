/**
 * The presets as data: shape, names, coordinates. No simulation.
 *
 * The suites that run the presets forward are split by preset --
 * `Presets.food-chain.test.js` and its siblings -- because the simulation memo
 * in `preset-sim.js` does not survive a file boundary. See `PRESETS_BY_SUITE`.
 */

import { describe, expect, test } from "@jest/globals"

import { PRESETS } from "../js/Presets.js"
import { SpeciesRegistry } from "../js/Species.js"
import { gridHeight, gridWidth, PRESETS_BY_SUITE } from "./preset-sim.js"

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

  test("every preset is simulated by exactly one of the sibling suites", () => {
    // Without this, adding a preset gives it a board nobody ever runs, and the
    // "no board ends dead" checks pass because they were never asked.
    const owned = Object.values(PRESETS_BY_SUITE).flat()
    expect(new Set(owned).size).toBe(owned.length)
    expect(owned.sort()).toEqual(PRESETS.map((p) => p.name).sort())
  })
})

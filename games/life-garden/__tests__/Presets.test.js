import { describe, test, expect } from "@jest/globals"
import { PRESETS } from "../js/Presets.js"
import { SPECIES, GRID } from "../js/constants.js"

describe("PRESETS", () => {
  const validSpecies = new Set(Object.values(SPECIES))

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

  test("every cell has integer coordinates and a known species", () => {
    for (const preset of PRESETS) {
      for (const cell of preset.cells) {
        expect(Number.isInteger(cell.x)).toBe(true)
        expect(Number.isInteger(cell.y)).toBe(true)
        expect(cell.x).toBeGreaterThanOrEqual(0)
        expect(cell.y).toBeGreaterThanOrEqual(0)
        expect(validSpecies.has(cell.species)).toBe(true)
        expect(cell.species).not.toBe(SPECIES.EMPTY)
      }
    }
  })

  test("preset cells fit within the maximum supported grid size", () => {
    for (const preset of PRESETS) {
      for (const cell of preset.cells) {
        expect(cell.x).toBeLessThan(GRID.MAX_SIZE)
        expect(cell.y).toBeLessThan(GRID.MAX_SIZE)
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

import { describe, test, expect, beforeEach } from "@jest/globals"
import { Renderer } from "../js/Renderer.js"
import { SpeciesRegistry } from "../js/Species.js"

/**
 * The drawing methods are exercised by playing the game; these tests cover the
 * geometry and colour maths behind them, which fail silently rather than
 * visibly. A stub canvas keeps jsdom's unimplemented 2d context out of it.
 */
function makeRenderer(width = 400, height = 300) {
  const canvas = { width, height, getContext: () => ({}) }
  return new Renderer(canvas, null)
}

describe("Renderer", () => {
  let renderer

  beforeEach(() => {
    renderer = makeRenderer()
  })

  describe("fitToGrid", () => {
    test("uses the limiting axis so cells stay square", () => {
      // 400/10 = 40 wide but 300/10 = 30 tall, so 30 wins.
      renderer.fitToGrid(10, 10)
      expect(renderer.cellSize).toBe(30)
    })

    test("centres the grid in the leftover space", () => {
      renderer.fitToGrid(10, 10)
      // 400 - 300 = 100 spare horizontally, none vertically.
      expect(renderer.offsetX).toBe(50)
      expect(renderer.offsetY).toBe(0)
    })

    test("uses whole pixels for cell size and offsets", () => {
      renderer.fitToGrid(7, 7)
      for (const value of [renderer.cellSize, renderer.offsetX, renderer.offsetY]) {
        expect(Number.isInteger(value)).toBe(true)
      }
    })
  })

  describe("canvasToGrid", () => {
    beforeEach(() => {
      renderer.fitToGrid(10, 10) // cellSize 30, offsetX 50, offsetY 0
    })

    test("maps a point to the cell containing it", () => {
      expect(renderer.canvasToGrid(50, 0)).toEqual({ x: 0, y: 0 })
      expect(renderer.canvasToGrid(79, 29)).toEqual({ x: 0, y: 0 })
      expect(renderer.canvasToGrid(80, 30)).toEqual({ x: 1, y: 1 })
    })

    test("maps the last cell", () => {
      expect(renderer.canvasToGrid(340, 290)).toEqual({ x: 9, y: 9 })
    })

    test("returns null outside the grid", () => {
      expect(renderer.canvasToGrid(49, 10)).toBeNull() // left of the grid
      expect(renderer.canvasToGrid(350, 10)).toBeNull() // right of it
      expect(renderer.canvasToGrid(60, -1)).toBeNull() // above it
      expect(renderer.canvasToGrid(60, 300)).toBeNull() // below it
    })

    test("round-trips the centre of every cell", () => {
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          const px = renderer.offsetX + x * renderer.cellSize + renderer.cellSize / 2
          const py = renderer.offsetY + y * renderer.cellSize + renderer.cellSize / 2
          expect(renderer.canvasToGrid(px, py)).toEqual({ x, y })
        }
      }
    })
  })

  describe("locked cells", () => {
    test("reports cells that were locked", () => {
      renderer.setLockedCells([
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ])
      expect(renderer.isLocked(1, 2)).toBe(true)
      expect(renderer.isLocked(3, 4)).toBe(true)
    })

    test("reports other cells as unlocked", () => {
      renderer.setLockedCells([{ x: 1, y: 2 }])
      expect(renderer.isLocked(2, 1)).toBe(false)
      expect(renderer.isLocked(0, 0)).toBe(false)
    })

    test("replaces the previous set rather than adding to it", () => {
      renderer.setLockedCells([{ x: 1, y: 2 }])
      renderer.setLockedCells([{ x: 5, y: 6 }])
      expect(renderer.isLocked(1, 2)).toBe(false)
      expect(renderer.isLocked(5, 6)).toBe(true)
    })
  })

  describe("_lerpColor", () => {
    test("returns the endpoints at t=0 and t=1", () => {
      expect(renderer._lerpColor("#000000", "#ffffff", 0)).toBe("rgb(0, 0, 0)")
      expect(renderer._lerpColor("#000000", "#ffffff", 1)).toBe("rgb(255, 255, 255)")
    })

    test("interpolates each channel independently", () => {
      expect(renderer._lerpColor("#000000", "#ff8800", 0.5)).toBe("rgb(128, 68, 0)")
    })
  })

  describe("textures", () => {
    // A missing case in _drawTexture draws a plain coloured square rather than
    // raising, so a species whose texture nobody implemented looks merely dull.
    // Check every registered texture actually reaches a draw method.
    test.each(new SpeciesRegistry().all().map((def) => [def.name, def]))(
      "%s draws something",
      (_name, def) => {
        let calls = 0
        const ctx = new Proxy(
          {},
          {
            get: () => () => {
              calls++
            },
          },
        )
        renderer._drawTexture(ctx, 0, 0, 20, 20, def, 0)
        expect(calls).toBeGreaterThan(0)
      },
    )

    test("an unknown texture is skipped rather than throwing", () => {
      const ctx = new Proxy({}, { get: () => () => {} })
      expect(() => renderer._drawTexture(ctx, 0, 0, 20, 20, { texture: "nope" }, 0)).not.toThrow()
    })
  })
})

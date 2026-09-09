import { describe, test, expect, beforeAll, beforeEach, afterEach, jest } from "@jest/globals"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const here = dirname(fileURLToPath(import.meta.url))
const html = readFileSync(join(here, "..", "index.html"), "utf8")

/**
 * Boot the real page.
 *
 * Every other suite tests a module on its own, which leaves the wiring between
 * them uncovered: an element id that `index.html` no longer has, a UI method
 * `game.js` calls by an old name, a renderer reading a field the grid stopped
 * carrying. All of those pass their own unit tests and produce a blank canvas
 * in a browser. This loads the actual markup, runs the actual entry point, and
 * drives the actual controls.
 *
 * jsdom has no 2d canvas context, so the drawing calls are stubbed. What is
 * being checked is that everything is called, on the right things, without
 * throwing.
 */
function stubContext() {
  return new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === "canvas") return { width: 640, height: 640 }
        return () => {}
      },
      set: () => true,
    },
  )
}

/**
 * `game.js` exports nothing and starts itself from DOMContentLoaded, so it is
 * imported once and the event is fired per test. Importing it again would not
 * re-run it -- the module registry is keyed by URL -- and would leave the one
 * listener it registered attached anyway.
 */
function boot() {
  document.documentElement.innerHTML = html.replace(/<script[\s\S]*?<\/script>/g, "")
  document.dispatchEvent(new Event("DOMContentLoaded"))
  if (!window.game) throw new Error(`the game did not start: ${errors.join("; ") || "no error"}`)
  return window.game
}

let errors = []

describe("the page boots", () => {
  beforeAll(async () => {
    // jsdom implements neither of these. `getContext` is what the two canvases
    // draw through, and `matchMedia` is what game.js watches for a change to
    // the OS dark-mode preference.
    HTMLCanvasElement.prototype.getContext = stubContext
    window.matchMedia = () => ({ matches: false, addEventListener() {} })
    window.__prefersDark = () => false
    await import("../js/game.js")
  })

  beforeEach(() => {
    errors = []
    jest.spyOn(console, "error").mockImplementation((...args) => errors.push(args.join(" ")))
    localStorage.clear()
  })

  afterEach(() => {
    jest.restoreAllMocks()
    delete window.game
  })

  test("with no errors logged", () => {
    const game = boot()
    expect(game).toBeDefined()
    expect(errors).toEqual([])
  })

  test("and fills in the palette, the presets and the species card", async () => {
    boot()
    expect(document.querySelectorAll(".species-btn")).toHaveLength(4)
    expect(document.querySelectorAll(".preset-btn").length).toBeGreaterThan(0)
    expect(document.getElementById("species-info").textContent).toContain("Grass")
  })

  test("and the rules section the top bar links to is really there", async () => {
    boot()
    const link = document.querySelector(".rules-link")
    expect(link).not.toBeNull()
    expect(document.querySelector(link.getAttribute("href"))).not.toBeNull()
  })

  test("stepping advances the generation and leaves Back able to undo it", async () => {
    const game = boot()
    game._loadPreset(0)
    expect(document.getElementById("generation-display").textContent).toBe("Gen 0")

    game._stepOnce()
    expect(document.getElementById("generation-display").textContent).toBe("Gen 1")

    game._stepBack()
    expect(document.getElementById("generation-display").textContent).toBe("Gen 0")
    expect(errors).toEqual([])
  })

  test("Back replays the same generation Step produced", async () => {
    // The grid carries its own generator, so an old grid stepped again has to
    // give the same result. Otherwise Back would quietly change the future.
    const game = boot()
    game._loadPreset(4)
    game._stepOnce()
    game._stepOnce()
    const forward = game.grid.countLiving()
    game._stepBack()
    game._stepOnce()
    expect(game.grid.countLiving()).toBe(forward)
  })

  test("every preset loads and runs", async () => {
    const game = boot()
    const { PRESETS } = await import("../js/Presets.js")
    PRESETS.forEach((_preset, i) => {
      game._loadPreset(i)
      for (let n = 0; n < 5; n++) game._stepOnce()
    })
    expect(errors).toEqual([])
  })

  test("selecting a species updates the card", async () => {
    const game = boot()
    const { SPECIES } = await import("../js/constants.js")
    game._selectSpecies(SPECIES.FOX)
    const card = document.getElementById("species-info").textContent
    expect(card).toContain("Fox")
    expect(card).toContain("Rabbit") // what it eats
  })

  test("the card counts what is on the board", async () => {
    const game = boot()
    const { SPECIES } = await import("../js/constants.js")
    game._selectSpecies(SPECIES.GRASS)
    game.grid.setCell(1, 1, SPECIES.GRASS)
    game.grid.setCell(2, 2, SPECIES.GRASS)
    game._updateSpeciesInfo()
    const values = [...document.querySelectorAll(".species-info-rows dd")]
    expect(values.at(-1).textContent).toBe("2")
  })

  describe("painting across the two layers", () => {
    // The gesture mode used to be picked from "is anything in this cell",
    // while placement asked "is this species' own layer free". The two
    // disagreed, so the first click of a gesture did the opposite of what a
    // drag through the same cell did.
    let game
    let SPECIES

    /** A click: mousedown probes for the mode, then paints that one cell. */
    function clickAt(x, y) {
      const cb = game.events.cb
      const px = game.renderer.offsetX + x * game.renderer.cellSize + 1
      const py = game.renderer.offsetY + y * game.renderer.cellSize + 1
      const mode = cb.onCanvasProbe(px, py) ? "erase" : "place"
      cb.onCanvasDrag(px, py, mode)
    }

    beforeEach(async () => {
      game = boot()
      ;({ SPECIES } = await import("../js/constants.js"))
    })

    test("a rabbit can be dropped into grass", () => {
      game.grid.setCell(5, 5, SPECIES.GRASS)
      game._selectSpecies(SPECIES.RABBIT)
      clickAt(5, 5)
      expect(game.grid.getAnimal(5, 5)?.species).toBe(SPECIES.RABBIT)
      expect(game.grid.getPlant(5, 5).species).toBe(SPECIES.GRASS)
    })

    test("grass can be planted under a rabbit", () => {
      game.grid.setCell(6, 6, SPECIES.RABBIT)
      game._selectSpecies(SPECIES.GRASS)
      clickAt(6, 6)
      expect(game.grid.getPlant(6, 6).species).toBe(SPECIES.GRASS)
      expect(game.grid.getAnimal(6, 6)?.species).toBe(SPECIES.RABBIT)
    })

    test("clicking the animal you can see takes the animal, not the grass", () => {
      game.grid.setCell(7, 7, SPECIES.GRASS)
      game.grid.setCell(7, 7, SPECIES.RABBIT)
      game._selectSpecies(SPECIES.RABBIT)
      clickAt(7, 7)
      expect(game.grid.getAnimal(7, 7)).toBeNull()
      expect(game.grid.getPlant(7, 7).species).toBe(SPECIES.GRASS)
    })

    test("a click that drifts still only takes one thing", () => {
      // mousedown and every mousemove after it both paint, so without a guard a
      // click that wobbles one pixel cleared the rabbit and then the grass.
      game.grid.setCell(8, 8, SPECIES.GRASS)
      game.grid.setCell(8, 8, SPECIES.RABBIT)
      game._selectSpecies(SPECIES.RABBIT)
      const cb = game.events.cb
      const px = game.renderer.offsetX + 8 * game.renderer.cellSize + 1
      const py = game.renderer.offsetY + 8 * game.renderer.cellSize + 1
      const mode = cb.onCanvasProbe(px, py) ? "erase" : "place"
      cb.onCanvasDrag(px, py, mode)
      cb.onCanvasDrag(px + 1, py, mode)
      cb.onCanvasDrag(px, py + 1, mode)

      expect(game.grid.getAnimal(8, 8)).toBeNull()
      expect(game.grid.getPlant(8, 8).species).toBe(SPECIES.GRASS)
    })
  })

  test("clearing empties the board and resets the counter", async () => {
    const game = boot()
    game._loadPreset(0)
    game._stepOnce()
    game._resetGrid()
    expect(game.grid.countLiving()).toBe(0)
    expect(document.getElementById("generation-display").textContent).toBe("Gen 0")
  })
})

describe("the rules on the page match the rules in the code", () => {
  // The table in index.html is hand-written, because the build translates by
  // matching English text in static HTML and anything JavaScript writes at
  // runtime stays in English. Hand-written means it goes stale: five of its
  // numbers were wrong after one tuning pass. This is the guard.
  test("the animal table is the real SPECIES_DEFS", async () => {
    const { SPECIES_DEFS } = await import("../js/Species.js")
    const { KIND } = await import("../js/constants.js")
    const doc = new DOMParser().parseFromString(html, "text/html")

    const rows = [...doc.querySelectorAll(".rules-table tbody tr")]
    const animals = Object.values(SPECIES_DEFS).filter((d) => d.kind === KIND.ANIMAL)
    expect(rows).toHaveLength(animals.length)

    for (const row of rows) {
      const name = row.querySelector("th").textContent.trim()
      const def = animals.find((d) => name.endsWith(d.name))
      if (!def) throw new Error(`the table row "${name}" names no known species`)

      const [, eats, sees, runsFrom, meal, digests, splitsAt] = [...row.children].map((c) =>
        c.textContent.trim(),
      )
      expect(eats).not.toBe("")
      expect(sees).toBe(String(def.sight))
      expect(meal).toBe(String(def.gain))
      expect(digests).toBe(String(def.digest))
      expect(splitsAt).toBe(String(def.breedAt))
      // "foxes, at 3" carries fearSight; an em dash means it fears nothing
      if (def.fears) expect(runsFrom).toContain(String(def.fearSight))
      else expect(runsFrom).not.toMatch(/\d/)
    }
  })

  test("the prose numbers are the real ones too", async () => {
    const { SPECIES_DEFS } = await import("../js/Species.js")
    const { SPECIES } = await import("../js/constants.js")
    const grass = SPECIES_DEFS[SPECIES.GRASS]
    const bloom = SPECIES_DEFS[SPECIES.FLOWERING_GRASS]
    const bee = SPECIES_DEFS[SPECIES.BEE]
    const doc = new DOMParser().parseFromString(html, "text/html")
    const prose = doc.querySelector("#how-it-works").textContent.replace(/\s+/g, " ")

    expect(prose).toContain(`stood ${grass.bloomAge} generations`)
    expect(prose).toContain(`${bloom.bloomDuration} generations later`)
    // Grass spreads on exactly 3, and is crowded out above its survive list
    expect(prose).toContain(`exactly ${grass.birth[0]} plants beside it`)
    expect(prose).toContain(`${Math.max(...grass.survive) + 1} or more neighbours`)
    // The two multipliers are spelled out in the prose, so compare in words
    const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight"]
    expect(prose).toContain(`${words[bloom.sproutChance / grass.sproutChance]} times as likely`)
    expect(prose).toContain(`by ${words[bee.sproutBonus]}`)
  })
})

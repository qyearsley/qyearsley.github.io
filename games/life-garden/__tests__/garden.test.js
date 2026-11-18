import { describe, test, expect } from "@jest/globals"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { Garden, RULES, SIZE } from "../js/garden.js"

const BOARD = SIZE * SIZE

/** Run a preset for `steps` generations and return the counts after each one. */
function run(preset, seed, steps) {
  const garden = new Garden(preset, seed)
  const history = []
  for (let i = 0; i < steps; i++) {
    garden.step()
    history.push(garden.counts())
  }
  return history
}

describe("grass alone", () => {
  test.each([1, 2, 3])("fills nearly the whole board (seed %i)", (seed) => {
    const last = run("grass", seed, 150).pop()
    expect(last.grass).toBeGreaterThan(BOARD * 0.99)
    expect(last.rabbit + last.fox).toBe(0)
  })
})

describe("rabbits with no foxes", () => {
  test.each([1, 2, 3])("become common and then hold a level (seed %i)", (seed) => {
    const history = run("rabbits", seed, 400)
    const later = history.slice(100).map((c) => c.rabbit)
    // A large population: well over a tenth of the board, up from 20.
    expect(Math.min(...later)).toBeGreaterThan(BOARD * 0.1)
    // And it stays near one level instead of running away or collapsing.
    expect(Math.max(...later) / Math.min(...later)).toBeLessThan(1.6)
  })

  test("a faster-growing garden holds more rabbits", () => {
    const level = (regrow) => {
      const garden = new Garden("rabbits", 1, { ...RULES, regrow })
      for (let i = 0; i < 300; i++) garden.step()
      return garden.counts().rabbit
    }
    expect(level(0.08)).toBeGreaterThan(level(0.02))
  })
})

describe("rabbits and foxes", () => {
  const SEEDS = 30
  const GENERATIONS = 500
  const runs = Array.from({ length: SEEDS }, (_, i) => run("both", i + 1, GENERATIONS))

  test("both species usually survive several hundred generations", () => {
    const survived = runs.filter((history) =>
      history.every((c) => c.rabbit > 0 && c.fox > 0),
    ).length
    // Measured: 98 of 100 seeds at 500 generations, 91 of 100 at 1000.
    expect(survived / SEEDS).toBeGreaterThanOrEqual(0.9)
  })

  test("populations boom and crash, with foxes following the rabbits", () => {
    for (const history of runs.filter((h) => h.every((c) => c.rabbit && c.fox))) {
      const rabbits = history.slice(50).map((c) => c.rabbit)
      const foxes = history.slice(50).map((c) => c.fox)
      // Rabbits swing at least fivefold, and foxes at least twofold.
      expect(Math.max(...rabbits) / Math.min(...rabbits)).toBeGreaterThan(5)
      expect(Math.max(...foxes) / Math.min(...foxes)).toBeGreaterThan(2)
      // The fox count rises and falls with a delay behind the rabbits.
      expect(bestLag(rabbits, foxes)).toBeGreaterThan(0)
    }
  })
})

/** The delay (in generations) at which fox counts best match rabbit counts. */
function bestLag(rabbits, foxes) {
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
  const [mr, mf] = [mean(rabbits), mean(foxes)]
  let best = { lag: 0, score: -Infinity }
  for (let lag = 0; lag <= 40; lag++) {
    let score = 0
    for (let i = 0; i + lag < rabbits.length; i++) {
      score += (rabbits[i] - mr) * (foxes[i + lag] - mf)
    }
    if (score > best.score) best = { lag, score }
  }
  return best.lag
}

describe("the model", () => {
  test("the same seed replays the same run", () => {
    expect(run("both", 7, 60)).toEqual(run("both", 7, 60))
  })

  test("the board wraps around at the edges", () => {
    const garden = new Garden("grass", 1)
    const corner = garden._around(0)
    expect(corner).toHaveLength(8)
    expect(corner).toContain(BOARD - 1)
  })

  test("a rabbit with no energy left dies, and a lone fox starves", () => {
    const garden = new Garden("grass", 1, { ...RULES, regrow: 0 })
    garden.grass.fill(0)
    garden.paint(5, "fox")
    for (let i = 0; i < RULES.fox.splitAt; i++) garden.step()
    expect(garden.counts().fox).toBe(0)
  })

  test("a fox eats the rabbit next to it", () => {
    const garden = new Garden("grass", 1, { ...RULES, regrow: 0 })
    garden.grass.fill(0)
    garden.paint(5, "fox")
    garden.paint(6, "rabbit")
    garden.step()
    expect(garden.counts().rabbit).toBe(0)
    expect(garden.counts().fox).toBe(1)
  })

  test("paint places, and erase removes the animal before the grass", () => {
    const garden = new Garden("grass", 1)
    garden.grass.fill(0)
    garden.paint(3, "grass")
    garden.paint(3, "rabbit")
    garden.paint(3, "erase")
    expect(garden.counts()).toEqual({ grass: 1, rabbit: 0, fox: 0 })
    garden.paint(3, "erase")
    expect(garden.counts().grass).toBe(0)
  })
})

describe("the rules written on the page", () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const html = readFileSync(join(here, "..", "index.html"), "utf8")

  test("quote the same numbers as RULES", () => {
    const quoted = [...html.matchAll(/<span data-rule="([\w.]+)">([^<]*)<\/span>/g)]
    expect(quoted.length).toBeGreaterThanOrEqual(5)
    for (const [, path, text] of quoted) {
      const [a, b] = path.split(".")
      const value = b ? RULES[a][b] : RULES[a]
      expect(text).toBe(a === "regrow" ? `${value * 100}%` : String(value))
    }
  })
})

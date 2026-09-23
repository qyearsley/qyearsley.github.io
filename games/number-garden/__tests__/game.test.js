/**
 * Bootstrap test for the real entry point.
 *
 * game.js exports nothing -- it boots itself on DOMContentLoaded -- so a unit
 * test that hand-builds `new ActivityGenerator(mockState)` never exercises the
 * bootstrap's own wiring. This drives the real index.html and the real
 * DOMContentLoaded listener instead, which is the only way to catch the
 * bootstrap building an `ActivityGenerator` that never gets the game's state.
 */
import { describe, expect, jest, test } from "@jest/globals"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const html = readFileSync(join(here, "../index.html"), "utf8")

// Importing registers the DOMContentLoaded listener; it does not run the game.
await import("../js/game.js")

function boot() {
  localStorage.clear()
  document.documentElement.innerHTML = html.replace(/<!DOCTYPE[^>]*>/i, "")
  document.dispatchEvent(new Event("DOMContentLoaded"))
}

const byId = (id) => document.getElementById(id)
const click = (id) => byId(id).click()

// Captured before any test spies on Math.random, so it always calls the real
// generator -- even from inside a mock that a later test installed.
const REAL_RANDOM = Math.random.bind(Math)

/**
 * Pin the next two Math.random() draws to the top of their range, then fall
 * back to real randomness.
 *
 * `generateAddition` draws num1 and num2 in that order, so this makes them
 * land exactly on the difficulty's ceiling (10 for Explorer, 15 for
 * Adventurer, 20 for Master). Pinning every draw instead -- rather than just
 * the two that matter -- sends `generateMathOptions`'s distractor loop the
 * same offset and direction forever, so it can never fill its option set and
 * spins until the process runs out of memory.
 */
function pinNextTwoDraws() {
  let calls = 0
  jest.spyOn(Math, "random").mockImplementation(() => (calls++ < 2 ? 0.99 : REAL_RANDOM()))
}

/** Set the difficulty select the way a tap in the settings modal does. */
function setDifficulty(value) {
  click("settings-button")
  const select = byId("difficulty-select")
  select.value = value
  select.dispatchEvent(new Event("change", { bubbles: true }))
  click("close-settings")
}

function enterFlowerMeadow() {
  document.querySelector('.garden-area[data-area="flower-meadow"]').click()
}

describe("difficulty setting reaches the real activity generator", () => {
  test("Explorer produces the Explorer number range, not the fallback default", () => {
    jest.spyOn(console, "warn").mockImplementation(() => {})

    boot()
    click("start-button")
    document.querySelector('.project-option[data-project="garden"]').click()
    setDifficulty("explorer")
    pinNextTwoDraws()
    enterFlowerMeadow()

    expect(byId("question-text").textContent).toBe("10 + 10 = ?")
    // This is the fallback path's own log line -- if it fired, the generator
    // the game is actually using was built with no game state at all.
    expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining("no gameState provided"))

    jest.restoreAllMocks()
  })

  test("changing difficulty mid-session changes the next question", () => {
    boot()
    click("start-button")
    document.querySelector('.project-option[data-project="garden"]').click()
    pinNextTwoDraws()
    enterFlowerMeadow()
    // Adventurer is the default difficulty.
    expect(byId("question-text").textContent).toBe("15 + 15 = ?")

    click("back-button")
    setDifficulty("master")
    pinNextTwoDraws()
    enterFlowerMeadow()

    expect(byId("question-text").textContent).toBe("20 + 20 = ?")

    jest.restoreAllMocks()
  })
})

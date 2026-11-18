import { describe, test, expect, beforeAll, beforeEach, afterEach, jest } from "@jest/globals"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const here = dirname(fileURLToPath(import.meta.url))
const html = readFileSync(join(here, "..", "index.html"), "utf8")

// jsdom has no 2d canvas, so every drawing call is a no-op. What is checked is
// that the page's element ids and game.js still agree, and that nothing throws.
const context = new Proxy({}, { get: () => () => {}, set: () => true })

function boot() {
  document.documentElement.innerHTML = html.replace(/<script[\s\S]*?<\/script>/g, "")
  document.dispatchEvent(new Event("DOMContentLoaded"))
  return window.game
}

const text = (id) => document.getElementById(id).textContent
const click = (selector) => document.querySelector(selector).click()

describe("the page", () => {
  beforeAll(async () => {
    HTMLCanvasElement.prototype.getContext = () => context
    await import("../js/game.js")
  })

  beforeEach(() => {
    jest.useFakeTimers()
    jest.spyOn(console, "error")
  })

  afterEach(() => {
    window.game.dispose()
    jest.useRealTimers()
    jest.restoreAllMocks()
    delete window.game
  })

  test("boots with no errors and the counts filled in", () => {
    expect(boot()).toBeDefined()
    expect(console.error).not.toHaveBeenCalled()
    expect(text("generation")).toBe("0")
    expect(Number(text("count-rabbit"))).toBe(80)
    expect(Number(text("count-fox"))).toBe(16)
  })

  test("Step advances one generation and Reset goes back to zero", () => {
    boot()
    click("#step-btn")
    expect(text("generation")).toBe("1")
    click("#reset-btn")
    expect(text("generation")).toBe("0")
  })

  test("Play runs on a timer, and Pause stops it", () => {
    boot()
    click("#play-btn")
    expect(document.getElementById("pause-btn").classList.contains("hidden")).toBe(false)
    jest.advanceTimersByTime(120 * 5)
    expect(text("generation")).toBe("5")
    click("#pause-btn")
    jest.advanceTimersByTime(1000)
    expect(text("generation")).toBe("5")
  })

  test("a preset replaces the board, and Grass only has no animals", () => {
    boot()
    click('[data-preset="grass"]')
    expect(text("count-rabbit")).toBe("0")
    expect(text("count-fox")).toBe("0")
    expect(document.querySelector('[data-preset="grass"]').getAttribute("aria-pressed")).toBe(
      "true",
    )
    expect(document.querySelector('[data-preset="both"]').getAttribute("aria-pressed")).toBe(
      "false",
    )
  })

  test("painting with a tool puts an animal on the board", () => {
    const game = boot()
    click('[data-preset="grass"]')
    click('[data-tool="fox"]')
    const board = document.getElementById("board")
    board.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 640 })
    board.dispatchEvent(new MouseEvent("pointerdown", { clientX: 20, clientY: 20 }))
    window.dispatchEvent(new Event("pointerup"))
    expect(game.garden.counts().fox).toBe(1)
    expect(text("count-fox")).toBe("1")
  })

  test("Space plays and pauses, and R resets", () => {
    boot()
    document.dispatchEvent(new KeyboardEvent("keydown", { key: " " }))
    jest.advanceTimersByTime(120 * 2)
    expect(text("generation")).toBe("2")
    document.dispatchEvent(new KeyboardEvent("keydown", { key: " " }))
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "r" }))
    expect(text("generation")).toBe("0")
  })

  test("the link to the rules points at a section that exists", () => {
    boot()
    const link = document.querySelector(".rules-link")
    expect(document.querySelector(link.getAttribute("href"))).not.toBeNull()
  })
})

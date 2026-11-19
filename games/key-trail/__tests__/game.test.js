/** Drives game.js through the real index.html with simulated key presses. */
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import "../../../shared/nav.js" // the site shortcuts, which must not see typed letters
import { init } from "../js/game.js"

const here = dirname(fileURLToPath(import.meta.url))
const html = readFileSync(join(here, "../index.html"), "utf8")
const byId = (id) => document.getElementById(id)
const visible = (id) => !byId(id).classList.contains("hidden")

function key(k) {
  // On body, as in a browser: nav.js reads event.target.matches, which document lacks.
  document.body.dispatchEvent(
    new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }),
  )
}

/** The text of the line on screen. */
const lineText = () => [...byId("line").children].map((s) => s.textContent).join("")

/** Type the current line, optionally with one wrong key first. */
function typeLine(withMistake = false) {
  if (withMistake) key("!")
  for (const ch of lineText()) key(ch)
}

function boot() {
  document.documentElement.innerHTML = html.replace(/<!DOCTYPE[^>]*>/i, "")
  init(document)
}

describe("key trail page", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    localStorage.clear()
    boot()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test("the menu lists every lesson", () => {
    expect(visible("menu")).toBe(true)
    expect(byId("lesson-list").children).toHaveLength(14)
  })

  test("a lesson shows the next key and moves the walker", () => {
    byId("lesson-list").querySelector("button").click()
    expect(visible("play")).toBe(true)
    const first = lineText()[0]
    expect(byId("hint").textContent).toMatch(/index finger/)
    expect(byId("keyboard").querySelector(".next").textContent).toBe(first)
    key(first)
    expect(byId("walker").style.left).not.toBe("0%")
    expect(byId("line").children[0].classList.contains("typed")).toBe(true)
  })

  test("a wrong key does not move the player and marks the letter", () => {
    byId("lesson-list").querySelector("button").click()
    key("!")
    expect(byId("line").children[0].classList.contains("missed")).toBe(true)
    expect(byId("line").children[0].classList.contains("current")).toBe(true)
  })

  test("finishing two clean lines earns three stars, saved for next time", () => {
    byId("lesson-list").querySelector("button").click()
    typeLine()
    expect(visible("play")).toBe(true)
    typeLine()
    jest.advanceTimersByTime(600)
    expect(visible("done")).toBe(true)
    expect(byId("done-big").textContent).toBe("★★★")
    boot()
    expect(byId("lesson-list").querySelector("button").textContent).toContain("★★★")
  })

  test("Enter on the done screen starts the next lesson", () => {
    byId("lesson-list").querySelector("button").click()
    for (let i = 0; i < 2; i++) typeLine(i === 0)
    jest.advanceTimersByTime(600)
    key("Enter")
    expect(byId("play-title").textContent).toBe("Lesson 2: d k")
  })

  test("Backspace changes nothing and says why", () => {
    byId("lesson-list").querySelector("button").click()
    key("Backspace")
    expect(byId("line").children[0].classList.contains("current")).toBe(true)
    expect(byId("hint").textContent).toMatch(/No need to erase/)
  })

  test("the picked walker and its goal are shown and saved", () => {
    byId("walkers").children[2].click() // bee
    expect(byId("walker").textContent).toBe("\u{1F41D}")
    expect(byId("home").textContent).toBe("\u{1F33C}")
    boot()
    expect(byId("walker").textContent).toBe("\u{1F41D}")
    expect(byId("walkers").children[2].getAttribute("aria-pressed")).toBe("true")
  })

  test("Escape goes back to the menu", () => {
    byId("lesson-list").querySelector("button").click()
    key("Escape")
    expect(visible("menu")).toBe(true)
  })

  test("typing t in a lesson does not cycle the site theme", () => {
    window.__themeToggle = jest.fn()
    key("t") // positive control: on the menu, t is the site shortcut
    expect(window.__themeToggle).toHaveBeenCalledTimes(1)
    byId("lesson-list").querySelectorAll("button")[7].click() // lesson 8 teaches t
    key("t")
    key("?")
    expect(window.__themeToggle).toHaveBeenCalledTimes(1)
    expect(document.querySelector(".keyboard-help-backdrop")).toBeNull()
    delete window.__themeToggle
  })

  test("the speed run counts only the characters typed", () => {
    byId("speed-btn").click()
    // All ten sentences, so a free character per sentence would show as +2.
    let typed = 0
    for (let i = 0; i < 10; i++) {
      typed += lineText().length
      typeLine()
    }
    jest.advanceTimersByTime(61000)
    expect(byId("done-big").textContent).toBe(`${Math.round(typed / 5)} words per minute`)
  })

  test("the speed run shows live words per minute after five seconds", () => {
    byId("speed-btn").click()
    typeLine()
    jest.advanceTimersByTime(4000)
    expect(byId("play-progress").textContent).not.toMatch(/wpm/)
    jest.advanceTimersByTime(2000)
    expect(byId("play-progress").textContent).toMatch(/^0:5\d, \d+ wpm$/)
  })

  test("Escape in the speed run shows the score so far, but not as a best", () => {
    byId("speed-btn").click()
    typeLine()
    jest.advanceTimersByTime(10000)
    key("Escape")
    expect(byId("done-title").textContent).toBe("Stopped early")
    expect(byId("done-big").textContent).toMatch(/^[1-9]\d* words per minute$/)
    expect(JSON.parse(localStorage.getItem("key-trail")).best).toBe(0)
  })

  test("the speed run ends after a minute with a best score", () => {
    byId("speed-btn").click()
    typeLine()
    jest.advanceTimersByTime(61000)
    expect(visible("done")).toBe(true)
    expect(byId("done-big").textContent).toMatch(/\d+ words per minute/)
    expect(JSON.parse(localStorage.getItem("key-trail")).best).toBeGreaterThan(0)
  })
})

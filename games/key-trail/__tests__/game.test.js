/** Drives game.js through the real index.html with simulated key presses. */
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { init } from "../js/game.js"

const here = dirname(fileURLToPath(import.meta.url))
const html = readFileSync(join(here, "../index.html"), "utf8")
const byId = (id) => document.getElementById(id)
const visible = (id) => !byId(id).classList.contains("hidden")

function key(k) {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }))
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

  test("finishing three clean lines earns three stars, saved for next time", () => {
    byId("lesson-list").querySelector("button").click()
    typeLine()
    typeLine()
    typeLine()
    jest.advanceTimersByTime(600)
    expect(visible("done")).toBe(true)
    expect(byId("done-big").textContent).toBe("★★★")
    boot()
    expect(byId("lesson-list").querySelector("button").textContent).toContain("★★★")
  })

  test("Enter on the done screen starts the next lesson", () => {
    byId("lesson-list").querySelector("button").click()
    for (let i = 0; i < 3; i++) typeLine(i === 0)
    jest.advanceTimersByTime(600)
    key("Enter")
    expect(byId("play-title").textContent).toBe("Lesson 2: d k")
  })

  test("Escape goes back to the menu", () => {
    byId("lesson-list").querySelector("button").click()
    key("Escape")
    expect(visible("menu")).toBe(true)
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

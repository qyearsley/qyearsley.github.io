/**
 * Drives game.js through the real index.html. `init()` takes the document, so
 * each test boots onto a fresh copy of the page.
 */
import { describe, expect, jest, test, beforeEach, afterEach } from "@jest/globals"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { init } from "../js/game.js"

const here = dirname(fileURLToPath(import.meta.url))
const html = readFileSync(join(here, "../index.html"), "utf8")

const byId = (id) => document.getElementById(id)
const steps = () => byId("step-display").textContent

function boot(url = "/games/turing-tape/") {
  window.history.replaceState(null, "", url)
  document.documentElement.innerHTML = html.replace(/<!DOCTYPE[^>]*>/i, "")
  init(document)
}

/** Pick a value in a rule row's select, the way the player does. */
function pick(select, value) {
  select.value = value
  select.dispatchEvent(new Event("change", { bubbles: true }))
}

/** Fill the first rule row: [state, read, write, move, next]. */
function fillRule(values) {
  const selects = byId("rule-body").querySelector("tr").querySelectorAll("select")
  values.forEach((value, i) => pick(selects[i], value))
}

/** A rule that reads a blank, writes a blank and stays in A: it runs forever. */
const LOOP = ["A", "_", "_", "S", "A"]

function key(k, eventInit = {}) {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, ...eventInit }))
}

describe("turing tape page", () => {
  beforeEach(() => {
    localStorage.clear()
    jest.spyOn(console, "error").mockImplementation(() => {})
    boot()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  test("opens on the first puzzle with one empty rule row", () => {
    expect(console.error).not.toHaveBeenCalled()
    expect(byId("level-title").textContent).toBe("Write One")
    expect(byId("level-nav").children.length).toBe(5)
    expect(byId("demo-nav").children.length).toBe(3)
    expect(byId("rule-body").querySelectorAll("tr").length).toBe(1)
    expect(steps()).toBe("Steps: 0")
  })

  test("?level= picks the puzzle", () => {
    boot("/games/turing-tape/?level=2")
    expect(byId("level-title").textContent).toBe("Flip It")
  })

  test("a correct rule solves the puzzle, saves it, and offers the next one", () => {
    fillRule(["A", "_", "1", "S", "HALT"])
    byId("step-btn").click()
    expect(byId("result-msg").textContent).toContain("Solved in 1 steps!")
    expect(byId("level-nav").children[0].classList.contains("completed")).toBe(true)
    expect(JSON.parse(localStorage.getItem("turingTape"))).toEqual(["write-one"])
    byId("result-msg").querySelector("button").click()
    expect(byId("level-title").textContent).toBe("Flip It")
  })

  test("a missing rule is reported and disables Step", () => {
    byId("step-btn").click()
    expect(byId("result-msg").textContent).toContain("No rule for state A")
    expect(byId("step-btn").disabled).toBe(true)
  })

  test("a rule that halts on the wrong tape does not solve the puzzle", () => {
    fillRule(["A", "_", "0", "S", "HALT"])
    byId("step-btn").click()
    expect(byId("result-msg").textContent).toContain("doesn't match the goal")
    expect(localStorage.getItem("turingTape")).toBeNull()
  })

  test("Play steps on a timer and Pause stops it", () => {
    jest.useFakeTimers()
    boot()
    fillRule(LOOP)
    byId("play-btn").click()
    jest.advanceTimersByTime(1200)
    expect(steps()).toBe("Steps: 3")
    expect(byId("play-btn").textContent).toContain("Pause")
    byId("play-btn").click()
    jest.advanceTimersByTime(1200)
    expect(steps()).toBe("Steps: 3")
    expect(byId("play-btn").textContent).toContain("Play")
  })

  test("Reset puts the machine back at step 0", () => {
    fillRule(LOOP)
    byId("step-btn").click()
    expect(steps()).toBe("Steps: 1")
    byId("reset-btn").click()
    expect(steps()).toBe("Steps: 0")
  })

  test("Add rule adds a blank row and the delete button removes it", () => {
    byId("add-rule-btn").click()
    const rows = byId("rule-body").querySelectorAll("tr")
    expect(rows.length).toBe(2)
    rows[1].querySelector(".delete-rule-btn").click()
    expect(byId("rule-body").querySelectorAll("tr").length).toBe(1)
  })

  test("a demo has read-only rules and no target, and runs to a halt", () => {
    byId("demo-nav").children[0].click()
    expect(byId("target-section").classList.contains("hidden")).toBe(true)
    expect(byId("add-rule-btn").classList.contains("hidden")).toBe(true)
    expect(byId("rule-body").querySelector("select").disabled).toBe(true)
    for (let i = 0; i < 50 && !byId("step-btn").disabled; i++) byId("step-btn").click()
    expect(byId("result-msg").textContent).toMatch(/^Halted after \d+ steps/)
  })

  test("Space steps, Enter plays, R resets", () => {
    jest.useFakeTimers()
    boot()
    fillRule(LOOP)
    key(" ")
    expect(steps()).toBe("Steps: 1")
    key("Enter")
    jest.advanceTimersByTime(400)
    expect(steps()).toBe("Steps: 2")
    key("r")
    expect(steps()).toBe("Steps: 0")
  })

  test("the shortcuts leave modifier chords alone", () => {
    fillRule(LOOP)
    key(" ", { metaKey: true })
    key(" ", { ctrlKey: true })
    expect(steps()).toBe("Steps: 0")
  })

  test("the shortcuts leave a focused control alone", () => {
    fillRule(LOOP)
    const select = byId("rule-body").querySelector("select")
    select.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }))
    expect(steps()).toBe("Steps: 0")
  })
})

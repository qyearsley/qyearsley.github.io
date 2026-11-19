/**
 * Drives ui.js through the real index.html. `initUI()` looks its elements up
 * when called, so each test loads a fresh copy of the page and calls it.
 */
import { describe, expect, jest, test, beforeEach, afterEach } from "@jest/globals"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { initUI } from "../ui.js"
import { clearAll } from "../state.js"
import { PREDEFINED_EXAMPLES } from "../examples.js"

const here = dirname(fileURLToPath(import.meta.url))
const html = readFileSync(join(here, "../index.html"), "utf8")

const byId = (id) => document.getElementById(id)
const stepTexts = () => [...document.querySelectorAll(".step-expression")].map((e) => e.textContent)
const message = () => byId("status-message").textContent

function boot(url = "/javascript/logic-engine/") {
  window.history.replaceState(null, "", url)
  document.documentElement.innerHTML = html.replace(/<!DOCTYPE[^>]*>/i, "")
  clearAll()
  initUI()
}

/** Type into the premise box and press Add. */
function addPremises(text) {
  byId("premise-input").value = text
  byId("add-premise").click()
}

describe("logic engine page", () => {
  beforeEach(() => {
    jest.spyOn(console, "warn").mockImplementation(() => {})
    boot()
  })

  afterEach(() => jest.restoreAllMocks())

  test("opens on the first example, with one button per example", () => {
    expect(document.querySelectorAll(".example-btn").length).toBe(PREDEFINED_EXAMPLES.length)
    expect(stepTexts()).toEqual(PREDEFINED_EXAMPLES[0].premises)
  })

  test("?example= opens that example instead", () => {
    const example = PREDEFINED_EXAMPLES[1]
    boot(`/javascript/logic-engine/?example=${encodeURIComponent(example.name)}`)
    expect(stepTexts()).toEqual(example.premises)
  })

  test("clicking an example loads it and records it in the URL", () => {
    const example = PREDEFINED_EXAMPLES[1]
    document.querySelectorAll(".example-btn")[1].click()
    expect(stepTexts()).toEqual(example.premises)
    expect(new URLSearchParams(window.location.search).get("example")).toBe(example.name)
  })

  test("Clear all empties the proof and shows the empty state", () => {
    byId("clear-all").click()
    expect(stepTexts()).toEqual([])
    expect(byId("steps-container").textContent).toContain("No proof steps yet")
  })

  test("Add takes several comma-separated premises and clears the box", () => {
    byId("clear-all").click()
    addPremises("p -> q, p")
    expect(stepTexts()).toEqual(["p -> q", "p"])
    expect(byId("premise-input").value).toBe("")
  })

  test("Enter in the box adds the premise", () => {
    byId("clear-all").click()
    byId("premise-input").value = "p"
    byId("premise-input").dispatchEvent(new KeyboardEvent("keypress", { key: "Enter" }))
    expect(stepTexts()).toEqual(["p"])
  })

  test("a bad premise is reported and nothing from that input is added", () => {
    byId("clear-all").click()
    addPremises("p, ->")
    expect(message()).toContain('Invalid expression "->"')
    expect(stepTexts()).toEqual([])
  })

  test("adding a premise by hand drops ?example=", () => {
    document.querySelectorAll(".example-btn")[1].click()
    addPremises("z")
    expect(new URLSearchParams(window.location.search).has("example")).toBe(false)
  })

  test("Run Inference needs a premise", () => {
    byId("clear-all").click()
    byId("run-inference").click()
    expect(message()).toContain("Add at least one premise")
  })

  test("Run Inference adds the derived steps and says so", () => {
    byId("clear-all").click()
    addPremises("p -> q, p")
    byId("run-inference").click()
    expect(byId("run-inference").disabled).toBe(false)
    expect(stepTexts()).toContain("q")
    expect(message()).toContain("New conclusions derived")
    expect(document.querySelector(".proof-step.derived .step-refs").textContent).toContain(
      "from steps",
    )
  })

  test("Run Inference with nothing new says so", () => {
    byId("clear-all").click()
    addPremises("p")
    byId("run-inference").click()
    expect(message()).toContain("No new conclusions found")
  })

  test("an error message is escaped, not parsed as HTML", () => {
    byId("clear-all").click()
    addPremises("<b>x</b> & ->")
    expect(message()).toContain("Invalid expression")
    expect(byId("status-message").querySelector("b")).toBeNull()
  })
})

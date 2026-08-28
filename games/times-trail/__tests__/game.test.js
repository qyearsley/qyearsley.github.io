/**
 * End-to-end tests for game.js, driven black-box through the real index.html.
 *
 * `game.js` exports nothing -- it is the page entry point and bootstraps itself
 * on DOMContentLoaded -- so there is no class to construct. That is why this file
 * clicks real buttons and dispatches real events instead of calling methods: it
 * is the only way to reach the module at all, and it has the side benefit of
 * covering the bootstrap, the `EventManager` wiring, and `GameUI` together.
 *
 * Scope: the settings path and the session loop's entry points. The pure modules
 * have their own thorough unit tests and are not re-tested here; what this file
 * covers is the part no unit test can -- that the wiring between them actually
 * connects on the shipped markup.
 */
import { describe, expect, jest, test, beforeEach } from "@jest/globals"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const html = readFileSync(join(here, "../index.html"), "utf8")

// Importing registers the DOMContentLoaded listener; it does not run the game.
await import("../js/game.js")

/** Reset the document to the real markup and let the game bootstrap onto it. */
function boot() {
  localStorage.clear()
  document.documentElement.innerHTML = html.replace(/<!DOCTYPE[^>]*>/i, "")
  document.dispatchEvent(new Event("DOMContentLoaded"))
}

const byId = (id) => document.getElementById(id)
const click = (id) => byId(id).click()

/** Tick or untick a table toggle the way a tap does. */
function toggleTable(table, checked) {
  const input = byId(`table-${table}`)
  input.checked = checked
  input.dispatchEvent(new Event("change", { bubbles: true }))
}

describe("game", () => {
  beforeEach(() => {
    jest.spyOn(console, "warn").mockImplementation(() => {})
    jest.spyOn(console, "error").mockImplementation(() => {})
    boot()
  })

  test("bootstraps without falling back to the error banner", () => {
    expect(document.querySelector(".error-container")).toBeNull()
    expect(byId("title-screen").classList.contains("active")).toBe(true)
    expect(console.error).not.toHaveBeenCalled()
  })

  test("Play starts a session and renders a question on the keypad", () => {
    click("start-button")
    expect(byId("play-screen").classList.contains("active")).toBe(true)
    expect(byId("question-text").textContent).toMatch(/^\d+ × \d+ = \?$/)
    expect(byId("keypad").classList.contains("hidden")).toBe(false)
    expect(byId("keypad").querySelectorAll("button").length).toBe(12)
  })

  test("the settings modal opens with every table on and the real pool size", () => {
    click("settings-button")
    expect(byId("settings-modal").classList.contains("hidden")).toBe(false)
    for (const table of [2, 3, 4, 5, 6, 7, 8, 9]) {
      expect(byId(`table-${table}`).checked).toBe(true)
    }
    expect(byId("session-length-select").value).toBe("20")
    expect(byId("pool-size").textContent).toBe("36 facts in play")
  })

  test("the retired difficulty controls are gone from the shipped markup", () => {
    expect(byId("difficulty-select")).toBeNull()
    expect(byId("custom-tables-group")).toBeNull()
  })

  test("unticking tables narrows the pool and the readout follows", () => {
    click("settings-button")
    for (const table of [2, 3, 4, 5, 8, 9]) toggleTable(table, false)
    expect(byId("pool-size").textContent).toBe("15 facts in play")
    toggleTable(6, false)
    expect(byId("pool-size").textContent).toBe("8 facts in play")
  })

  test("unticking the last table is refused and the toggle springs back", () => {
    click("settings-button")
    for (const table of [3, 4, 5, 6, 7, 8, 9]) toggleTable(table, false)
    expect(byId("pool-size").textContent).toBe("8 facts in play")
    toggleTable(2, false)
    expect(byId("table-2").checked).toBe(true)
    expect(byId("pool-size").textContent).toBe("8 facts in play")
  })

  test("the session length setting reaches the progress bar", () => {
    click("settings-button")
    const select = byId("session-length-select")
    select.value = "10"
    select.dispatchEvent(new Event("change", { bubbles: true }))
    click("close-settings")

    click("start-button")
    expect(byId("progress-bar").getAttribute("aria-valuemax")).toBe("10")
    expect(byId("progress-text").textContent).toBe("0/10")
  })

  // Every read of settings.sessionLength was already live, but the bar is only
  // written on answer and on session start, so mid-session it went on claiming
  // "/20" until the next question and read as a setting that had not applied.
  test("changing the session length mid-session redraws the bar at once", () => {
    click("start-button")
    expect(byId("progress-text").textContent).toBe("0/20")

    click("play-settings-button")
    const select = byId("session-length-select")
    select.value = "30"
    select.dispatchEvent(new Event("change", { bubbles: true }))

    expect(byId("progress-text").textContent).toBe("0/30")
    expect(byId("progress-bar").getAttribute("aria-valuemax")).toBe("30")
  })

  test("the gate message is gone -- the trail explains itself by what it asks", () => {
    click("start-button")
    expect(byId("gate-message")).toBeNull()
  })

  // Narrowing the pool rebuilds the journey, which can move the gating region --
  // a region with no active facts is skipped outright. Without reseeding, the
  // selector went on pushing the old region's facts until the next correct
  // answer, and on a narrowed pool those may not be in the pool at all.
  test("changing the tables mid-session keeps asking from the new pool", () => {
    click("start-button")
    click("play-settings-button")
    for (const table of [2, 3, 4, 5, 6, 8, 9]) toggleTable(table, false)
    click("close-settings")

    // Tables [7]: every remaining fact contains a 7, so a question that does not
    // is a question drawn against the old pool.
    click("start-button")
    const [, left, right] = byId("question-text").textContent.match(/^(\d+) × (\d+)/)
    expect([Number(left), Number(right)]).toContain(7)
  })

  test("the narrowed pool is what actually gets asked", () => {
    click("settings-button")
    for (const table of [2, 3, 4, 5, 6, 8, 9]) toggleTable(table, false)
    expect(byId("pool-size").textContent).toBe("8 facts in play")
    click("close-settings")

    click("start-button")
    const [, left, right] = byId("question-text").textContent.match(/^(\d+) × (\d+)/)
    expect([Number(left), Number(right)]).toContain(7)
  })

  test("settings persist across a reload", () => {
    click("settings-button")
    const select = byId("session-length-select")
    select.value = "30"
    select.dispatchEvent(new Event("change", { bubbles: true }))
    toggleTable(2, false)
    click("close-settings")

    // Reboot onto fresh markup WITHOUT clearing storage, the way a reload does.
    document.documentElement.innerHTML = html.replace(/<!DOCTYPE[^>]*>/i, "")
    document.dispatchEvent(new Event("DOMContentLoaded"))

    click("progress-button")
    click("settings-button")
    expect(byId("session-length-select").value).toBe("30")
    expect(byId("table-2").checked).toBe(false)
    // 35, not 28: under table-FAMILY semantics unticking the 2s removes only
    // 2x2, because 2x3 is still in the 3 times table. Unticking a LOW table
    // barely narrows anything; narrowing works by unticking everything else.
    expect(byId("pool-size").textContent).toBe("35 facts in play")
  })
})

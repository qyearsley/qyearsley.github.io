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
    expect(byId("session-length-select").value).toBe("10")
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

  test("a new player's round is 10 questions", () => {
    click("start-button")
    expect(byId("progress-text").textContent).toBe("Question 1 of 10")
  })

  test("the session length setting reaches the round counter", () => {
    click("settings-button")
    const select = byId("session-length-select")
    select.value = "20"
    select.dispatchEvent(new Event("change", { bubbles: true }))
    click("close-settings")

    click("start-button")
    expect(byId("progress-text").textContent).toBe("Question 1 of 20")
  })

  // Every read of settings.sessionLength was already live, but the counter is
  // only written when a question is asked, so mid-session it went on claiming
  // "of 10" until the next question and read as a setting that had not applied.
  test("changing the session length mid-session redraws the counter at once", () => {
    click("start-button")
    expect(byId("progress-text").textContent).toBe("Question 1 of 10")

    click("play-settings-button")
    const select = byId("session-length-select")
    select.value = "30"
    select.dispatchEvent(new Event("change", { bubbles: true }))

    expect(byId("progress-text").textContent).toBe("Question 1 of 30")
  })

  test("the play screen has one bar: the trail strip", () => {
    click("start-button")
    expect(byId("progress-bar")).toBeNull()
    expect(byId("play-trail-strip").querySelectorAll(".strip-space").length).toBeGreaterThan(0)
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

  // Escape is the dialog's second exit and must route through the same
  // closeSettings the Done button does, or the countdown openSettings paused
  // stays paused and the round never advances.
  test("Escape closes the settings modal", () => {
    click("start-button")
    click("play-settings-button")
    expect(byId("settings-modal").classList.contains("hidden")).toBe(false)

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    expect(byId("settings-modal").classList.contains("hidden")).toBe(true)
    expect(byId("play-screen").classList.contains("active")).toBe(true)
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

  // The hub IS the list of trails: there is no separate picker screen, and no
  // "Practice" button between the player and the questions.
  test("the hub lists every trail, and the old picker screen is gone", () => {
    click("progress-button")
    expect(byId("hub-screen").classList.contains("active")).toBe(true)
    const rows = Array.from(document.querySelectorAll("#hub-screen [data-trail-id]"))
    expect(rows.map((row) => row.dataset.trailId)).toEqual([
      "doubles",
      "fives",
      "squares",
      "nines",
      "tough",
    ])
    expect(byId("trail-screen")).toBeNull()
    expect(byId("trail-button")).toBeNull()
    expect(byId("mode-quick-recall")).toBeNull()
  })

  test("a new player's hub says Start on the first trail, with nothing walked yet", () => {
    click("progress-button")
    const note = document.querySelector('[data-trail-id="doubles"] .trail-row-note')
    expect(note.textContent).toBe("Start: 0 of 8 strong.")
    expect(
      document.querySelector('[data-trail-id="doubles"]').classList.contains("is-current"),
    ).toBe(true)
  })

  // Regression: a trail change used to call a save method the class does not
  // have, which threw after the trail was already switched.
  test("tapping a trail starts a round on it and remembers the choice", () => {
    click("progress-button")
    const fivesRow = document.querySelector('[data-trail-id="fives"]')
    expect(fivesRow.disabled).toBe(false)

    fivesRow.click()
    expect(console.error).not.toHaveBeenCalled()
    expect(byId("play-screen").classList.contains("active")).toBe(true)
    expect(byId("play-trail-strip").textContent).toContain("Fives")
    expect(byId("progress-text").textContent).toBe("Question 1 of 10")

    // Reboot onto fresh markup WITHOUT clearing storage, the way a reload does.
    document.documentElement.innerHTML = html.replace(/<!DOCTYPE[^>]*>/i, "")
    document.dispatchEvent(new Event("DOMContentLoaded"))

    click("progress-button")
    expect(document.querySelector('[data-trail-id="fives"]').classList.contains("is-current")).toBe(
      true,
    )
    expect(
      document.querySelector('[data-trail-id="doubles"]').classList.contains("is-current"),
    ).toBe(false)
  })

  test("a trail the enabled tables leave empty is disabled on the hub", () => {
    click("settings-button")
    // The Tough Ten never contains a 2, 5 or 9, so tables 2, 5 and 9 alone empty it.
    for (const table of [3, 4, 6, 7, 8]) toggleTable(table, false)
    click("close-settings")
    click("progress-button")
    expect(document.querySelector('[data-trail-id="tough"]').disabled).toBe(true)
    expect(document.querySelector('[data-trail-id="doubles"]').disabled).toBe(false)
  })
})

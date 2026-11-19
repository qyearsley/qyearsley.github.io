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
import { STORAGE } from "../js/constants.js"
import { defaultProgress } from "../js/storage.js"

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

/** Boot onto a save written by an earlier build, the way a reload does. */
function bootWithSave(patch) {
  localStorage.setItem(
    STORAGE.KEY,
    JSON.stringify({ ...defaultProgress(), ...patch, version: STORAGE.VERSION }),
  )
  document.documentElement.innerHTML = html.replace(/<!DOCTYPE[^>]*>/i, "")
  document.dispatchEvent(new Event("DOMContentLoaded"))
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

  test("the settings modal offers the session length and nothing about tables", () => {
    click("settings-button")
    expect(byId("settings-modal").classList.contains("hidden")).toBe(false)
    expect(byId("session-length-select").value).toBe("10")
    expect(document.querySelector('#settings-modal input[type="checkbox"]')).toBeNull()
    expect(byId("pool-size")).toBeNull()
    expect(byId("table-2")).toBeNull()
  })

  test("the retired difficulty controls are gone from the shipped markup", () => {
    expect(byId("difficulty-select")).toBeNull()
    expect(byId("custom-tables-group")).toBeNull()
  })

  // A trail always uses all of its own facts, and the answering tests check the
  // round. Here the old save only has to load and start a trail.
  test("a save with narrowed tables loads and starts a trail", () => {
    bootWithSave({ settings: { tables: [7], sessionLength: 20 } })
    expect(document.querySelector(".error-container")).toBeNull()
    expect(console.error).not.toHaveBeenCalled()

    click("progress-button")
    document.querySelector('[data-trail-id="squares"]').click()
    expect(byId("progress-text").textContent).toBe("Question 1 of 20")
    const [, left, right] = byId("question-text").textContent.match(/^(\d+) × (\d+)/)
    expect(left).toBe(right)
  })

  test("saving drops the retired tables and sound settings", () => {
    bootWithSave({ settings: { tables: [7], sound: "off" } })
    click("settings-button")
    const select = byId("session-length-select")
    select.value = "20"
    select.dispatchEvent(new Event("change", { bubbles: true }))
    expect(JSON.parse(localStorage.getItem(STORAGE.KEY)).settings).toEqual({
      sessionLength: 20,
    })
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
    click("close-settings")

    // Reboot onto fresh markup WITHOUT clearing storage, the way a reload does.
    document.documentElement.innerHTML = html.replace(/<!DOCTYPE[^>]*>/i, "")
    document.dispatchEvent(new Event("DOMContentLoaded"))

    click("progress-button")
    click("settings-button")
    expect(byId("session-length-select").value).toBe("30")
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

  test("no trail is disabled on the hub", () => {
    click("progress-button")
    for (const row of document.querySelectorAll("#hub-screen [data-trail-id]")) {
      expect(row.disabled).toBe(false)
    }
  })
})

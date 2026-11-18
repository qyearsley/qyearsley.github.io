/**
 * Answer and timer paths of game.js, driven through the real index.html.
 *
 * Boots the game the way game.test.js does, then answers questions by clicking
 * the buttons and advances fake timers past the 1.5s "next question" delay and
 * the 1s retry delay.
 */
import { describe, expect, jest, test, beforeEach, afterEach } from "@jest/globals"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { TIMING, DEFAULTS } from "../js/constants.js"

const here = dirname(fileURLToPath(import.meta.url))
const html = readFileSync(join(here, "../index.html"), "utf8")

// Importing registers the DOMContentLoaded listener; it does not run the game.
await import("../js/game.js")

const byId = (id) => document.getElementById(id)
const click = (id) => byId(id).click()
const activeScreen = () => document.querySelector(".screen.active").id
const correctButton = () => document.querySelector('.answer-button[data-correct="true"]')
const wrongButton = () => document.querySelector('.answer-button[data-correct="false"]')

/** Load the page on a fresh document. `boot` also wipes the save; `reload` keeps it. */
function boot(url = "/games/number-garden/") {
  localStorage.clear()
  reload(url)
}

function reload(url = "/games/number-garden/") {
  window.history.replaceState(null, "", url)
  document.documentElement.innerHTML = html.replace(/<!DOCTYPE[^>]*>/i, "")
  document.dispatchEvent(new Event("DOMContentLoaded"))
}

/** Pick a project and walk into the first area. */
function enterFlowerMeadow() {
  click("start-button")
  document.querySelector('.project-option[data-project="castle"]').click()
  document.querySelector('.garden-area[data-area="flower-meadow"]').click()
}

function setSetting(id, value) {
  click("settings-button")
  const select = byId(id)
  select.value = value
  select.dispatchEvent(new Event("change", { bubbles: true }))
  click("close-settings")
}

/** Answer correctly and let the next question (or the level-complete screen) arrive. */
function answerCorrectly() {
  correctButton().click()
  jest.advanceTimersByTime(TIMING.NEXT_ACTIVITY_DELAY)
}

describe("number garden answering", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.spyOn(console, "warn").mockImplementation(() => {})
    boot()
    enterFlowerMeadow()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  test("a correct answer cheers, counts, and hands back fresh buttons after the delay", () => {
    correctButton().click()
    expect(byId("feedback-area").textContent).toContain("Correct!")
    expect(byId("progress-text").textContent).toBe(`1/${DEFAULTS.QUESTIONS_PER_LEVEL}`)
    expect(byId("activity-star-count").textContent).toBe("1")
    expect(document.querySelector(".answer-button").classList.contains("disabled")).toBe(true)

    jest.advanceTimersByTime(TIMING.NEXT_ACTIVITY_DELAY)
    expect(document.querySelector(".answer-button.disabled")).toBeNull()
    expect(byId("question-text").textContent).not.toBe("")
    expect(activeScreen()).toBe("activity-screen")
  })

  test("a wrong answer is struck off, and the others come back after the retry delay", () => {
    const wrong = wrongButton()
    wrong.click()
    expect(byId("feedback-area").textContent).toContain("Try again!")
    expect(wrong.classList.contains("struck")).toBe(true)
    expect(byId("progress-text").textContent).toBe(`0/${DEFAULTS.QUESTIONS_PER_LEVEL}`)
    expect(correctButton().classList.contains("disabled")).toBe(true)

    jest.advanceTimersByTime(TIMING.RETRY_DELAY)
    expect(correctButton().classList.contains("disabled")).toBe(false)
    expect(wrong.classList.contains("disabled")).toBe(true)

    // The retry works: the right answer is still accepted.
    correctButton().click()
    expect(byId("progress-text").textContent).toBe(`1/${DEFAULTS.QUESTIONS_PER_LEVEL}`)
  })

  test("a second tap while an answer is processing is ignored", () => {
    const button = correctButton()
    button.click()
    button.click()
    expect(byId("progress-text").textContent).toBe(`1/${DEFAULTS.QUESTIONS_PER_LEVEL}`)
  })

  test("a full level of correct answers ends on the level-complete screen", () => {
    for (let i = 0; i < DEFAULTS.QUESTIONS_PER_LEVEL; i++) answerCorrectly()
    expect(activeScreen()).toBe("level-complete-screen")

    // Continue goes on to the next area.
    click("continue-playing-button")
    expect(activeScreen()).toBe("activity-screen")
  })

  test("Return to hub after a level goes back to the garden hub", () => {
    for (let i = 0; i < DEFAULTS.QUESTIONS_PER_LEVEL; i++) answerCorrectly()
    click("return-to-hub-button")
    expect(activeScreen()).toBe("garden-hub")
  })

  test("leaving the screen cancels the pending level-complete screen", () => {
    for (let i = 0; i < DEFAULTS.QUESTIONS_PER_LEVEL - 1; i++) answerCorrectly()
    correctButton().click()
    click("back-button")
    jest.advanceTimersByTime(TIMING.LEVEL_COMPLETE_DELAY * 3)
    expect(activeScreen()).toBe("garden-hub")
  })

  test("typed answers: right is accepted, wrong is rejected and the field comes back", () => {
    setSetting("input-mode-select", "keyboard")
    click("back-button")
    document.querySelector('.garden-area[data-area="flower-meadow"]').click()

    const input = byId("answer-input-field")
    input.value = "-1"
    click("submit-answer-btn")
    expect(byId("feedback-area").textContent).toContain("Try again!")
    expect(input.disabled).toBe(true)
    jest.advanceTimersByTime(TIMING.RETRY_DELAY)
    expect(input.disabled).toBe(false)

    input.value = input.dataset.correct
    click("submit-answer-btn")
    expect(byId("feedback-area").textContent).toContain("Correct!")
  })
})

describe("number garden screens around the questions", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.spyOn(console, "warn").mockImplementation(() => {})
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  test("the castle button shows the castle and Back returns to the hub", () => {
    boot()
    click("start-button")
    document.querySelector('.project-option[data-project="castle"]').click()
    click("castle-button")
    expect(activeScreen()).toBe("castle-screen")
    expect(byId("castle-svg-container").innerHTML).toContain("<svg")
    click("castle-back-button")
    expect(activeScreen()).toBe("garden-hub")
  })

  test("?unlock=all opens every area on the hub", () => {
    boot("/games/number-garden/?unlock=all")
    click("start-button")
    document.querySelector('.project-option[data-project="castle"]').click()
    expect(document.querySelectorAll(".garden-area.locked").length).toBe(0)
  })

  test("Start Fresh asks first, and only resets when confirmed", () => {
    boot()
    enterFlowerMeadow()
    answerCorrectly()
    reload()
    expect(byId("start-fresh-button").classList.contains("hidden")).toBe(false)

    jest.spyOn(window, "confirm").mockReturnValue(false)
    click("start-fresh-button")
    expect(activeScreen()).toBe("title-screen")

    window.confirm.mockReturnValue(true)
    click("start-fresh-button")
    expect(activeScreen()).toBe("garden-hub")
    expect(byId("star-count").textContent).toBe("0")
  })
})

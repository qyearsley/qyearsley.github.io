/**
 * The answer and timer paths of game.js, driven through the real index.html:
 * keypad clicks for the answers, fake timers for the holds between questions.
 *
 * game.test.js covers settings and session start. This file covers what happens
 * after a question is on screen. The answer is read off the question text, the
 * same way a child would work it out.
 */
import { describe, expect, jest, test, beforeEach, afterEach } from "@jest/globals"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { TIMING } from "../js/constants.js"

const here = dirname(fileURLToPath(import.meta.url))
const html = readFileSync(join(here, "../index.html"), "utf8")

// Importing registers the DOMContentLoaded listener; it does not run the game.
await import("../js/game.js")

const byId = (id) => document.getElementById(id)
const click = (id) => byId(id).click()
const activeScreen = () => document.querySelector(".screen.active").id
const progress = () => byId("progress-text").textContent
const questionFact = () =>
  byId("question-text")
    .textContent.match(/^(\d+) × (\d+)/)
    .slice(1)
    .map(Number)
const feedback = () => byId("feedback-area").textContent

function boot() {
  localStorage.clear()
  document.documentElement.innerHTML = html.replace(/<!DOCTYPE[^>]*>/i, "")
  document.dispatchEvent(new Event("DOMContentLoaded"))
}

function tapKey(key) {
  document.querySelector(`.keypad-key[data-key="${key}"]`).click()
}

/** Tap a number on the keypad, then the check mark. */
function submit(number) {
  for (const digit of String(number)) tapKey(digit)
  tapKey("enter")
}

/** The product the on-screen question asks for. */
function rightAnswer() {
  const [, left, right] = byId("question-text").textContent.match(/^(\d+) × (\d+)/)
  return Number(left) * Number(right)
}

function answerCorrectly() {
  submit(rightAnswer())
  jest.advanceTimersByTime(TIMING.CORRECT_FEEDBACK_MS)
}

function answerWrongly() {
  submit(rightAnswer() + 1)
}

describe("times trail answering", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.spyOn(console, "warn").mockImplementation(() => {})
    jest.spyOn(console, "error").mockImplementation(() => {})
    boot()
    click("start-button")
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  test("a correct answer is praised, counted and saved, then the next question comes", () => {
    submit(rightAnswer())
    expect(feedback()).toContain("=")
    expect(byId("feedback-area").classList.contains("correct")).toBe(true)
    expect(progress()).toBe("Question 1 of 10")
    expect(Number(byId("play-star-count").textContent)).toBeGreaterThan(0)
    expect(byId("play-streak").textContent).toBe("Streak 1")
    expect(JSON.parse(localStorage.getItem("timesTrailProgress")).totals.factsCorrect).toBe(1)

    // The keypad stays dead for the hold, then comes back with a clean readout.
    expect(document.querySelector(".keypad-key").disabled).toBe(true)
    jest.advanceTimersByTime(TIMING.CORRECT_FEEDBACK_MS)
    expect(document.querySelector(".keypad-key").disabled).toBe(false)
    expect(byId("answer-display").textContent).toBe("?")
    expect(byId("question-text").textContent).toMatch(/^\d+ × \d+ = \?$/)
  })

  test("the counter moves to the next question after an answer", () => {
    answerCorrectly()
    expect(progress()).toBe("Question 2 of 10")
  })

  test("a wrong answer shows the right one, breaks the streak, then teaches it", () => {
    answerCorrectly()
    answerWrongly()
    expect(byId("feedback-area").classList.contains("incorrect")).toBe(true)
    expect(byId("play-streak").textContent).toBe("Streak 0")
    expect(JSON.parse(localStorage.getItem("timesTrailProgress")).totals.factsCorrect).toBe(1)
    expect(byId("scaffold-area").classList.contains("hidden")).toBe(true)

    // Not before the miss has been seen; then the scaffold takes over the keypad.
    jest.advanceTimersByTime(TIMING.WRONG_FEEDBACK_MS)
    expect(byId("scaffold-area").classList.contains("hidden")).toBe(false)
    expect(byId("keypad").classList.contains("hidden")).toBe(true)
  })

  test("Got it dismisses the teaching and asks the next question", () => {
    answerWrongly()
    jest.advanceTimersByTime(TIMING.WRONG_FEEDBACK_MS)
    click("scaffold-continue")
    expect(byId("scaffold-area").classList.contains("hidden")).toBe(true)
    expect(byId("keypad").classList.contains("hidden")).toBe(false)
    expect(byId("answer-display").textContent).toBe("?")
    // Dismissed once: the auto-advance timer must not ask a second question.
    const question = byId("question-text").textContent
    jest.advanceTimersByTime(TIMING.SCAFFOLD_DWELL_MS * 3)
    expect(byId("question-text").textContent).toBe(question)
  })

  test("the teaching moves on by itself if nobody taps Got it", () => {
    answerWrongly()
    jest.advanceTimersByTime(TIMING.WRONG_FEEDBACK_MS)
    jest.advanceTimersByTime(TIMING.SCAFFOLD_DWELL_MS + 12 * TIMING.SKIP_COUNT_TICK_MS)
    expect(byId("scaffold-area").classList.contains("hidden")).toBe(true)
    expect(byId("keypad").classList.contains("hidden")).toBe(false)
  })

  test("the keypad digits and backspace edit the answer readout", () => {
    tapKey("4")
    tapKey("2")
    expect(byId("answer-display").textContent).toBe("42")
    tapKey("backspace")
    expect(byId("answer-display").textContent).toBe("4")
  })

  test("leaving mid-hold cancels the queued question", () => {
    jest.spyOn(window, "confirm").mockReturnValue(true)
    submit(rightAnswer())
    click("back-button")
    expect(activeScreen()).toBe("hub-screen")
    jest.advanceTimersByTime(TIMING.CORRECT_FEEDBACK_MS * 5)
    expect(activeScreen()).toBe("hub-screen")
  })

  test("opening settings pauses the hold and Done starts it again", () => {
    submit(rightAnswer())
    click("play-settings-button")
    const question = byId("question-text").textContent
    jest.advanceTimersByTime(TIMING.CORRECT_FEEDBACK_MS * 5)
    expect(byId("question-text").textContent).toBe(question)
    expect(document.querySelector(".keypad-key").disabled).toBe(true)

    click("close-settings")
    jest.advanceTimersByTime(TIMING.CORRECT_FEEDBACK_MS)
    expect(document.querySelector(".keypad-key").disabled).toBe(false)
  })

  test("a full session ends on the summary, and Play Again starts a new one", () => {
    for (let i = 0; i < 10; i++) {
      submit(rightAnswer())
      jest.advanceTimersByTime(i === 9 ? TIMING.SUMMARY_DELAY_MS : TIMING.CORRECT_FEEDBACK_MS)
    }
    expect(activeScreen()).toBe("summary-screen")
    expect(byId("summary-correct").textContent).toBe("10/10")
    expect(byId("summary-streak").textContent).toBe("10")
    expect(JSON.parse(localStorage.getItem("timesTrailProgress")).totals.sessionsCompleted).toBe(1)

    click("play-again-button")
    expect(activeScreen()).toBe("play-screen")
    expect(progress()).toBe("Question 1 of 10")
  })

  // The point of the trail rework: every question is on the trail being walked,
  // so every correct answer can move the token. Misses come back from the same
  // trail, because the retry queue only holds facts that were asked.
  test("a round on Squares asks only squares, retries included", () => {
    jest.spyOn(window, "confirm").mockReturnValue(true)
    click("back-button")
    document.querySelector('[data-trail-id="squares"]').click()

    for (let i = 0; i < 10; i++) {
      const [left, right] = questionFact()
      expect(left).toBe(right)
      if (i === 1 || i === 4) {
        answerWrongly()
        jest.advanceTimersByTime(TIMING.WRONG_FEEDBACK_MS)
        click("scaffold-continue")
      } else {
        submit(rightAnswer())
        jest.advanceTimersByTime(TIMING.CORRECT_FEEDBACK_MS)
      }
    }
  })

  test("every correct answer on a trail moves the token", () => {
    jest.spyOn(window, "confirm").mockReturnValue(true)
    click("back-button")
    document.querySelector('[data-trail-id="squares"]').click()

    const spaceOf = () => {
      const spaces = Array.from(byId("play-trail-strip").querySelectorAll(".strip-space"))
      return spaces.findIndex((space) => space.classList.contains("strip-space-current"))
    }
    const start = spaceOf()
    answerCorrectly()
    expect(spaceOf()).toBe(start + 1)
    answerCorrectly()
    expect(spaceOf()).toBe(start + 2)
  })

  test("a round on the default trail asks only facts with a 2", () => {
    for (let i = 0; i < 9; i++) {
      expect(questionFact()).toContain(2)
      answerCorrectly()
    }
  })
})

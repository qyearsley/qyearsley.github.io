/**
 * End-to-end tests for game.js, driven black-box through the real index.html.
 *
 * `game.js` exports nothing -- it is the page entry point and calls `start()` as
 * it evaluates -- so there is no class to construct and no bootstrap event to
 * dispatch. Importing the module *is* starting the game. That is why this file
 * clicks real buttons and dispatches real events instead of calling methods: it
 * is the only way to reach the module at all, and it has the side benefit of
 * covering the wiring between GameState, StorageManager, and GameUI on the
 * shipped markup. The approach follows `games/times-trail/__tests__/game.test.js`.
 *
 * Two pieces of setup are specific to this game:
 *
 * - Because the module self-starts, "reload the page" means importing it again.
 *   ESM caches by specifier, so each load appends a unique query string. The
 *   modules game.js imports stay cached, which is fine -- none of them holds
 *   per-page state; only game.js does.
 * - The questions come from a run seed, so the test cannot know the answer up
 *   front. It reads the save the game just wrote and runs it back through
 *   `rehydrate`, which is exactly how a reloading page recovers the question on
 *   screen. That keeps the tests deterministic without pinning a seed or reaching
 *   into the module.
 *
 * Spring is untimed, so no countdown interferes; fake timers are here for the
 * 900ms answer flash, which is what gates the next question.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { PHASE, PLAY, STORAGE } from "../js/constants.js"
import { rehydrate } from "../js/GameState.js"
import { getSeason } from "../js/seasons.js"

const HERE = dirname(fileURLToPath(import.meta.url))
const HTML = readFileSync(join(HERE, "..", "index.html"), "utf-8")
const SPRING = getSeason("spring")

/** Bumped per load so each import gets a fresh module instance. */
let loadCount = 0

/**
 * Reset the document to the real markup and let the game start on it. Does not
 * touch localStorage, so calling it twice models a reload.
 * @returns {Promise<void>} Resolves once the game has drawn its first screen
 */
async function boot() {
  document.documentElement.innerHTML = HTML.replace(/<!DOCTYPE[^>]*>/i, "")
  document.body.className = ""
  loadCount += 1
  await import(`../js/game.js?load=${loadCount}`)
}

const byId = (id) => document.getElementById(id)
const isActive = (id) => byId(id).classList.contains("active")
const cards = () => Array.from(document.querySelectorAll("#character-grid .character-card"))
const choices = () => Array.from(document.querySelectorAll("#choices button"))

/** The save the game has written, parsed. */
const saved = () => JSON.parse(localStorage.getItem(STORAGE.KEY))

/**
 * The question currently on screen, recovered the way a reload recovers it.
 * @returns {Object} The live question, with its `answer`
 */
function liveQuestion() {
  return rehydrate(saved().run).question
}

/** Index of the button holding the correct answer. */
function correctIndex() {
  const answer = String(liveQuestion().answer)
  const index = choices().findIndex((button) => button.dataset.value === answer)
  expect(index).toBeGreaterThanOrEqual(0)
  return index
}

/** Tap a character card by id. */
function chooseCharacter(id) {
  byId("character-grid").querySelector(`[data-character-id="${id}"]`).click()
}

/** Press a number key the way the keyboard fallback expects. */
function pressKey(key) {
  document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }))
}

/** Click through dispatchEvent, which -- unlike `.click()` -- reaches a disabled button. */
function forceClick(button) {
  button.dispatchEvent(new MouseEvent("click", { bubbles: true }))
}

beforeEach(async () => {
  jest.useFakeTimers()
  localStorage.clear()
  await boot()
})

afterEach(() => {
  jest.clearAllTimers()
  jest.useRealTimers()
})

describe("first load", () => {
  it("lands on the character screen with the whole roster", () => {
    expect(isActive("screen-character")).toBe(true)
    expect(isActive("screen-play")).toBe(false)
    expect(isActive("screen-result")).toBe(false)
    expect(cards()).toHaveLength(4)
    expect(cards().map((card) => card.dataset.characterId)).toEqual([
      "banana-slug",
      "sloth",
      "phoenix",
      "porcupine",
    ])
  })

  it("saves nothing until the player does something", () => {
    expect(localStorage.getItem(STORAGE.KEY)).toBeNull()
  })
})

describe("choosing a character", () => {
  it("starts spring and puts a question on the play screen", () => {
    chooseCharacter("sloth")
    expect(isActive("screen-play")).toBe(true)
    expect(isActive("screen-character")).toBe(false)
    expect(byId("season-name").textContent).toBe("Spring")
    expect(byId("demand-line").textContent).toBe(SPRING.demandText)
    expect(byId("item-count").textContent).toBe("0")
    expect(byId("item-demand").textContent).toBe(String(SPRING.demand))
    expect(byId("question-prompt").textContent).not.toBe("")
    expect(choices()).toHaveLength(PLAY.CHOICE_COUNT)
  })

  it("draws the trail with the token at the start", () => {
    chooseCharacter("phoenix")
    expect(document.querySelectorAll("#trail .trail-marker")).toHaveLength(SPRING.spaces)
    expect(document.querySelectorAll("#trail .trail-marker.is-done")).toHaveLength(0)
    expect(document.querySelector("#trail .trail-token")).not.toBeNull()
  })

  it("records the choice in the save", () => {
    chooseCharacter("porcupine")
    expect(saved().run.characterId).toBe("porcupine")
    expect(saved().run.seasonId).toBe("spring")
    expect(saved().run.phase).toBe(PHASE.TRAIL)
  })
})

describe("answering", () => {
  beforeEach(() => {
    chooseCharacter("sloth")
  })

  it("a correct answer collects an item and advances a space", () => {
    choices()[correctIndex()].click()
    expect(byId("item-count").textContent).toBe("1")
    expect(saved().run.items).toBe(1)
    expect(saved().run.position).toBe(1)
  })

  it("a wrong answer collects nothing and stays put", () => {
    const wrong = choices()[(correctIndex() + 1) % PLAY.CHOICE_COUNT]
    wrong.click()
    expect(byId("item-count").textContent).toBe("0")
    expect(saved().run.items).toBe(0)
    expect(saved().run.position).toBe(0)
    expect(wrong.classList.contains("is-wrong")).toBe(true)
  })

  it("shows the right answer either way, and locks the buttons", () => {
    const answer = String(liveQuestion().answer)
    choices()[(correctIndex() + 1) % PLAY.CHOICE_COUNT].click()
    const marked = Array.from(document.querySelectorAll("#choices .is-correct"))
    expect(marked).toHaveLength(1)
    expect(marked[0].dataset.value).toBe(answer)
    expect(choices().every((button) => button.disabled)).toBe(true)
  })

  it("the next question arrives after the flash, not before", () => {
    choices()[correctIndex()].click()
    const prompt = byId("question-prompt").textContent

    jest.advanceTimersByTime(800)
    expect(choices().every((button) => button.disabled)).toBe(true)

    jest.advanceTimersByTime(100)
    expect(choices()).toHaveLength(PLAY.CHOICE_COUNT)
    expect(choices().every((button) => button.disabled === false)).toBe(true)
    expect(byId("question-prompt").textContent).not.toBe(prompt)
    expect(document.querySelectorAll("#trail .trail-marker.is-done")).toHaveLength(1)
  })

  it("three correct answers in a row collect three items", () => {
    for (let i = 0; i < 3; i += 1) {
      choices()[correctIndex()].click()
      jest.advanceTimersByTime(900)
    }
    expect(byId("item-count").textContent).toBe("3")
    expect(saved().run.position).toBe(3)
  })
})

describe("the number keys", () => {
  beforeEach(() => {
    chooseCharacter("sloth")
  })

  it.each([1, 2, 3, 4])("key %i presses the matching choice", (key) => {
    const button = choices()[key - 1]
    const wasCorrect = button.dataset.value === String(liveQuestion().answer)
    pressKey(String(key))
    expect(choices().every((option) => option.disabled)).toBe(true)
    expect(button.classList.contains(wasCorrect ? "is-correct" : "is-wrong")).toBe(true)
    expect(byId("item-count").textContent).toBe(wasCorrect ? "1" : "0")
  })

  it("a key with no button behind it does nothing", () => {
    pressKey("9")
    pressKey("0")
    pressKey("a")
    expect(choices().every((button) => button.disabled === false)).toBe(true)
    expect(byId("item-count").textContent).toBe("0")
  })

  it("keys are ignored on the character screen", async () => {
    localStorage.clear()
    await boot()
    pressKey("1")
    expect(isActive("screen-character")).toBe(true)
    expect(localStorage.getItem(STORAGE.KEY)).toBeNull()
  })
})

// The `answering` guard in game.js. Without it a fast double-tap, or a tap
// landing in the same frame as a timeout, scores twice: here the second press
// would apply a wrong answer and wilt the item the first one just collected.
describe("the double-tap guard", () => {
  beforeEach(() => {
    chooseCharacter("sloth")
  })

  it("two different buttons pressed in the same tick score once", () => {
    const buttons = choices()
    const right = correctIndex()
    const other = (right + 1) % PLAY.CHOICE_COUNT

    // A probe on the second button, so this test cannot pass for the wrong
    // reason. `flashAnswer` disables the buttons, and jsdom (correctly) drops
    // `.click()` on a disabled control -- that would make the guard untested.
    // `dispatchEvent` still reaches listeners, so the second answer really is
    // delivered to game.js and really is refused by `answering`.
    const probe = jest.fn()
    buttons[other].addEventListener("click", probe)

    forceClick(buttons[right])
    forceClick(buttons[other])

    expect(buttons[other].disabled).toBe(true)
    expect(probe).toHaveBeenCalledTimes(1)
    expect(byId("item-count").textContent).toBe("1")
    expect(saved().run.items).toBe(1)
    expect(saved().run.questionsAsked).toBe(1)
    expect(buttons[other].classList.contains("is-wrong")).toBe(false)
  })

  it("a wrong tap followed by the right one still counts only the wrong tap", () => {
    const buttons = choices()
    const right = correctIndex()
    const other = (right + 1) % PLAY.CHOICE_COUNT

    forceClick(buttons[other])
    forceClick(buttons[right])

    expect(byId("item-count").textContent).toBe("0")
    expect(saved().run.questionsAsked).toBe(1)
    expect(saved().run.correctCount).toBe(0)
  })

  it("a key press during the flash is ignored too", () => {
    pressKey(String(correctIndex() + 1))
    pressKey("1")
    pressKey("2")
    expect(saved().run.questionsAsked).toBe(1)
    expect(byId("item-count").textContent).toBe("1")
  })

  it("the guard lifts once the flash is over", () => {
    choices()[correctIndex()].click()
    jest.advanceTimersByTime(900)
    choices()[correctIndex()].click()
    expect(saved().run.questionsAsked).toBe(2)
    expect(byId("item-count").textContent).toBe("2")
  })
})

describe("persistence", () => {
  it("writes a save under the game's own key", () => {
    chooseCharacter("sloth")
    choices()[correctIndex()].click()
    expect(STORAGE.KEY).toBe("seasonsProgress")
    expect(localStorage.getItem(STORAGE.KEY)).not.toBeNull()
    expect(saved().version).toBe(STORAGE.VERSION)
    expect(saved().run.position).toBe(1)
  })

  it("a reload resumes the trail rather than asking for a character again", async () => {
    chooseCharacter("phoenix")
    for (let i = 0; i < 2; i += 1) {
      choices()[correctIndex()].click()
      jest.advanceTimersByTime(900)
    }
    expect(byId("item-count").textContent).toBe("2")

    // Reboot onto fresh markup WITHOUT clearing storage, the way a reload does.
    await boot()

    expect(isActive("screen-play")).toBe(true)
    expect(isActive("screen-character")).toBe(false)
    expect(byId("item-count").textContent).toBe("2")
    expect(byId("season-name").textContent).toBe("Spring")
    expect(document.querySelectorAll("#trail .trail-marker.is-done")).toHaveLength(2)
    expect(choices()).toHaveLength(PLAY.CHOICE_COUNT)
  })

  it("a reload shows the same question, not a fresh one", async () => {
    chooseCharacter("phoenix")
    const prompt = byId("question-prompt").textContent
    const values = choices().map((button) => button.dataset.value)

    await boot()

    expect(byId("question-prompt").textContent).toBe(prompt)
    expect(choices().map((button) => button.dataset.value)).toEqual(values)
  })

  it("a save from an incompatible version is discarded, not half-read", async () => {
    localStorage.setItem(STORAGE.KEY, JSON.stringify({ version: "0.1", run: { position: 99 } }))
    await boot()
    expect(isActive("screen-character")).toBe(true)
    expect(cards()).toHaveLength(4)
  })

  it("garbage in the key starts a fresh run rather than failing to load", async () => {
    localStorage.setItem(STORAGE.KEY, "{not json")
    await boot()
    expect(isActive("screen-character")).toBe(true)
    expect(cards()).toHaveLength(4)
  })
})

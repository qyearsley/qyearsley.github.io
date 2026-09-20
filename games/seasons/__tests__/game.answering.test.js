/** Answering a question: the buttons, the letter keys, and the guard on both. */

import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { PLAY, STORAGE } from "../js/constants.js"
import { hudCount } from "./helpers.js"
import {
  SPRING,
  FLASH_MS,
  isCrossing,
  finishCrossing,
  settleCrossing,
  boot,
  byId,
  isActive,
  choices,
  earnedPips,
  trailSpace,
  saved,
  liveQuestion,
  correctIndex,
  chooseCharacter,
  pressKey,
  choiceKey,
  tapRight,
  answerCorrectly,
  answerWrongly,
  setupGameHarness,
} from "./game-harness.js"

setupGameHarness()

describe("answering", () => {
  beforeEach(() => {
    chooseCharacter("sloth")
  })

  it("a correct answer collects an item and advances a space", () => {
    tapRight()
    expect(hudCount()).toMatchObject({ items: 1 })
    expect(earnedPips()).toBe(1)
    expect(saved().run.items).toBe(1)
    expect(saved().run.position).toBe(1)
  })

  it("a wrong answer collects nothing and stays put", () => {
    const wrong = choices()[(correctIndex() + 1) % PLAY.CHOICE_COUNT]
    wrong.click()
    expect(hudCount()).toMatchObject({ items: 0 })
    expect(earnedPips()).toBe(0)
    expect(saved().run.items).toBe(0)
    expect(saved().run.position).toBe(0)
    expect(wrong.classList.contains("is-wrong")).toBe(true)
  })

  // `aria-disabled`, not `disabled`: disabling the element that has focus drops
  // focus to <body>, so a keyboard user had to tab in from the top of the
  // document before every single question.
  it("shows the right answer either way, and locks the buttons without disabling them", () => {
    const answer = String(liveQuestion().answer)
    const pressed = choices()[(correctIndex() + 1) % PLAY.CHOICE_COUNT]
    pressed.focus()
    pressed.click()

    const marked = Array.from(document.querySelectorAll("#choices .is-correct"))
    expect(marked).toHaveLength(1)
    expect(marked[0].dataset.value).toBe(answer)
    expect(choices().every((button) => button.getAttribute("aria-disabled") === "true")).toBe(true)
    expect(choices().every((button) => button.classList.contains("is-locked"))).toBe(true)
    expect(choices().every((button) => button.disabled === false)).toBe(true)
    expect(document.activeElement).toBe(pressed)
  })

  it("the next question arrives after the flash and the crossing, not before", async () => {
    tapRight()
    expect(saved().run.questionsAsked).toBe(1)

    jest.advanceTimersByTime(FLASH_MS - 100)
    expect(choices().every((button) => button.getAttribute("aria-disabled") === "true")).toBe(true)

    jest.advanceTimersByTime(100)
    await settleCrossing()
    // The flash is over, but the character is mid-leap over the obstacle it was
    // standing at, and the buttons stay locked for the whole of it.
    expect(isCrossing()).toBe(true)
    expect(choices().every((button) => button.getAttribute("aria-disabled") === "true")).toBe(true)

    finishCrossing()
    await settleCrossing()

    expect(choices()).toHaveLength(PLAY.CHOICE_COUNT)
    expect(choices().every((button) => button.getAttribute("aria-disabled") === null)).toBe(true)
    expect(choices().every((button) => button.classList.contains("is-locked") === false)).toBe(true)
    // A fresh question, asserted by the counter rather than by the prompt
    // changing: prompts come from a seeded generator and two in a row can
    // legitimately be identical, which made that assertion flake.
    expect(saved().run.questionsAsked).toBe(1)
    expect(byId("question-prompt").textContent).not.toBe("")
    expect(trailSpace()).toEqual({ space: 2, of: SPRING.spaces })
  })

  it("three correct answers in a row collect three items", async () => {
    for (let i = 0; i < 3; i += 1) {
      await answerCorrectly()
    }
    expect(hudCount()).toMatchObject({ items: 3 })
    expect(earnedPips()).toBe(3)
    expect(saved().run.position).toBe(3)
    expect(trailSpace()).toEqual({ space: 4, of: SPRING.spaces })
  })

  it("counts every answer against the lifetime totals", async () => {
    await answerCorrectly()
    answerWrongly()
    await answerCorrectly()
    expect(saved().totals.questionsAnswered).toBe(3)
    expect(saved().totals.questionsCorrect).toBe(2)
  })
})

describe("the letter keys", () => {
  beforeEach(() => {
    chooseCharacter("sloth")
  })

  it.each([
    ["a", 0],
    ["b", 1],
    ["c", 2],
    ["d", 3],
  ])("key %s presses choice %i", (key, index) => {
    const button = choices()[index]
    const wasCorrect = button.dataset.value === String(liveQuestion().answer)
    pressKey(key)
    expect(choices().every((option) => option.getAttribute("aria-disabled") === "true")).toBe(true)
    expect(button.classList.contains(wasCorrect ? "is-correct" : "is-wrong")).toBe(true)
    expect(hudCount()).toMatchObject({ items: wasCorrect ? 1 : 0 })
  })

  // Caps lock is not a reason to stop being able to play.
  it("the uppercase letter works the same as the lowercase one", () => {
    const button = choices()[2]
    const wasCorrect = button.dataset.value === String(liveQuestion().answer)
    pressKey("C")
    expect(button.classList.contains(wasCorrect ? "is-correct" : "is-wrong")).toBe(true)
    expect(hudCount()).toMatchObject({ items: wasCorrect ? 1 : 0 })
  })

  // The reason the shortcut is a letter at all: every answer on screen is a
  // number, so the digits have to stay inert rather than picking a choice each.
  it.each(["1", "2", "3", "4", "9", "0"])("digit %s does nothing", (key) => {
    pressKey(key)
    expect(choices().every((button) => button.getAttribute("aria-disabled") === null)).toBe(true)
    expect(hudCount()).toMatchObject({ items: 0 })
    expect(saved().run.questionsAsked).toBe(0)
  })

  it("a letter past the last choice does nothing", () => {
    pressKey("e")
    pressKey("z")
    // Sorts before "a", so the arithmetic goes negative rather than long.
    pressKey("!")
    // Named keys are more than one character and never reach the arithmetic.
    pressKey("ArrowLeft")
    pressKey("F5")
    expect(choices().every((button) => button.getAttribute("aria-disabled") === null)).toBe(true)
    expect(hudCount()).toMatchObject({ items: 0 })
    expect(saved().run.questionsAsked).toBe(0)
  })

  // A letter typed into a field belongs to the field. The play screen has no
  // text input today, so this dispatches from one added for the test -- the
  // guard is there to keep the next one that gets added from answering the
  // question behind the player's back.
  it("a letter typed into a text field is left alone", () => {
    for (const tag of ["input", "textarea", "select"]) {
      const field = document.createElement(tag)
      document.body.append(field)
      field.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }))
      field.remove()
    }
    expect(choices().every((button) => button.getAttribute("aria-disabled") === null)).toBe(true)
    expect(hudCount()).toMatchObject({ items: 0 })
    expect(saved().run.questionsAsked).toBe(0)
  })

  // Cmd-A selects everything on the page and Alt-A types a character on some
  // layouts; answering the question as well is not what anyone meant.
  it.each([["metaKey"], ["ctrlKey"], ["altKey"]])(
    "a %s chord is left to the browser",
    (modifier) => {
      pressKey("a", { [modifier]: true })
      expect(saved().run.questionsAsked).toBe(0)
      expect(hudCount()).toMatchObject({ items: 0 })
      expect(choices().every((button) => button.getAttribute("aria-disabled") === null)).toBe(true)
    },
  )

  it("keys are ignored on the character screen", async () => {
    localStorage.clear()
    await boot()
    pressKey("a")
    expect(isActive("screen-character")).toBe(true)
    expect(localStorage.getItem(STORAGE.KEY)).toBeNull()
  })
})

// The `answering` guard in game.js. Without it a fast double-tap, or a tap
// landing in the same frame as a timeout, scores twice: here the second press
// would apply a wrong answer and wilt the item the first one just collected.
//
// The buttons are no longer `disabled`, so a second `.click()` really does reach
// game.js -- which is the point. Every assertion below is on the *score*, not on
// the button state, so deleting the guard fails these tests rather than being
// papered over by the DOM refusing the click.

describe("the double-tap guard", () => {
  beforeEach(() => {
    chooseCharacter("sloth")
  })

  it("two different buttons pressed in the same tick score once", () => {
    const buttons = choices()
    const right = correctIndex()
    const other = (right + 1) % PLAY.CHOICE_COUNT

    // A probe on the second button, so this test cannot pass for the wrong
    // reason: it proves the second click really was delivered to a listener and
    // was refused by `answering` rather than dropped by the DOM.
    const probe = jest.fn()
    buttons[other].addEventListener("click", probe)

    buttons[right].click()
    buttons[other].click()

    expect(probe).toHaveBeenCalledTimes(1)
    expect(buttons[other].disabled).toBe(false)
    expect(buttons[other].getAttribute("aria-disabled")).toBe("true")
    expect(hudCount()).toMatchObject({ items: 1 })
    expect(earnedPips()).toBe(1)
    expect(saved().run.items).toBe(1)
    expect(saved().run.questionsAsked).toBe(1)
    expect(saved().totals.questionsAnswered).toBe(1)
    expect(buttons[other].classList.contains("is-wrong")).toBe(false)
  })

  it("a wrong tap followed by the right one still counts only the wrong tap", () => {
    const buttons = choices()
    const right = correctIndex()
    const other = (right + 1) % PLAY.CHOICE_COUNT

    buttons[other].click()
    buttons[right].click()

    expect(hudCount()).toMatchObject({ items: 0 })
    expect(saved().run.questionsAsked).toBe(1)
    expect(saved().run.correctCount).toBe(0)
    expect(saved().totals.questionsAnswered).toBe(1)
  })

  it("the same button tapped ten times scores once", () => {
    const button = choices()[correctIndex()]
    for (let i = 0; i < 10; i += 1) {
      button.click()
    }
    expect(saved().run.questionsAsked).toBe(1)
    expect(saved().run.items).toBe(1)
    expect(saved().totals.questionsAnswered).toBe(1)
  })

  it("a key press during the flash is ignored too", () => {
    pressKey(choiceKey(correctIndex()))
    pressKey("a")
    pressKey("b")
    expect(saved().run.questionsAsked).toBe(1)
    expect(hudCount()).toMatchObject({ items: 1 })
  })

  it("the guard lifts once the flash and the crossing are over", async () => {
    await answerCorrectly()
    tapRight()
    expect(saved().run.questionsAsked).toBe(2)
    expect(hudCount()).toMatchObject({ items: 2 })
  })
})

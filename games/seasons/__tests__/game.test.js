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
 * Three pieces of setup are specific to this game:
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
 * - Some situations take a long time to play into -- the boss with too few
 *   items, the middle of timed summer -- so `seedSave` writes a save describing
 *   one and boots onto it. That is the same path a returning player takes, and
 *   it keeps a five-line test from needing twenty clicks of setup.
 *
 * One consequence of reloading by re-importing: the `keydown` and
 * `visibilitychange` listeners a previous load put on `document` are still
 * there, and `BaseGameUI.setText` looks its target up by id rather than using a
 * cached node, so an older instance can still write to the live page. The
 * newest load always registers last and therefore paints last, which is why
 * this matters in practice only for assertions about something the *current*
 * load deliberately does not draw. Prefer asserting on the save or on the
 * screen the current load owns.
 *
 * Spring is untimed, so no countdown interferes there; fake timers are here for
 * the 900ms answer flash, which is what gates the next question, and for the
 * countdown in the seasons that do have one.
 *
 * Finally, nothing here may inherit a rule. `RULES.WRONG_ANSWER` and
 * `RULES.BOSS_FAILURE` are undecided design switches, so a test that depends on
 * one pins it with `useRules` (see helpers.js) and names it, and a test that
 * only wanted *some* state change is written not to care which.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"
import { CHARACTERS, getCharacter } from "../js/characters.js"
import {
  BOSS_FAILURE,
  BOSS_TRIES,
  PHASE,
  PLAY,
  SEASON_ORDER,
  STORAGE,
  WRONG_ANSWER,
} from "../js/constants.js"
import { createState, rehydrate, startSeason } from "../js/GameState.js"
import { getSeason } from "../js/seasons.js"
import { toSavedRun } from "../js/storage.js"
import {
  hudCount,
  itWithASecondTry,
  many,
  mountIndexDocument,
  one,
  restoreRulesBetweenTests,
  resultButtons,
  summaryRows,
  useRules,
  zeroTotals,
} from "./helpers.js"

const SPRING = getSeason("spring")
const SUMMER = getSeason("summer")
const LAST_SEASON = getSeason(SEASON_ORDER[SEASON_ORDER.length - 1])

/**
 * Player-facing copy this file pins on purpose, collected in one place.
 *
 * Everything else about the result screens is asserted by shape -- that the
 * losing text states both numbers, that the winning text names the collectible
 * -- precisely so Ella can rewrite the villain's voice without a red suite. But
 * the *titles* are how a test tells one branch of `_renderResult` from another,
 * and there is no shape-level way to say "this is the end-of-run screen and not
 * the end-of-season one". So they are pinned, and pinned here: rewording them is
 * one edit to this block.
 */
const TITLE = {
  runComplete: "The potion is finished",
  seasonComplete: (season) => `${season.name} complete`,
  seasonLost: "Not quite enough",
  runOver: "Back to the beginning",
}

/**
 * What a perfect run of a season banks: every ordinary space, every glowing one
 * at the default rate, and the boss's rescue on top.
 *
 * @param {Object} season - The season to measure
 * @returns {number} Items delivered by a run that misses nothing
 */
function perfectRun(season) {
  return (
    (season.spaces - season.glowingAt.length) * PLAY.ITEMS_PER_SPACE +
    season.glowingAt.length * PLAY.ITEMS_PER_GLOWING_SPACE +
    season.boss.rescue
  )
}

const PERFECT_SPRING = perfectRun(SPRING)

/** Bumped per load so each import gets a fresh module instance. */
let loadCount = 0

/**
 * Reset the document to the real markup and let the game start on it. Does not
 * touch localStorage, so calling it twice models a reload.
 * @returns {Promise<void>} Resolves once the game has drawn its first screen
 */
async function boot() {
  mountIndexDocument()
  loadCount += 1
  await import(`../js/game.js?load=${loadCount}`)
}

const byId = (id) => document.getElementById(id)
const isActive = (id) => byId(id).classList.contains("active")
const cards = () => Array.from(document.querySelectorAll("#character-grid .character-card"))
const choices = () => Array.from(document.querySelectorAll("#choices button"))

/**
 * The label the run-complete summary gives a season: its own name and its own
 * collectible, which is the whole point of that screen existing.
 * @param {string} id - A season id
 * @returns {string} The row label
 */
const seasonRowLabel = (id) => `${getSeason(id).name} — ${many(getSeason(id))}`

/** The verdict under the question. */
const feedback = () => byId("feedback").textContent

/** How many item slots are filled in. */
const earnedPips = () => document.querySelectorAll("#item-track .item-pip.is-earned").length

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
function pressKey(key, modifiers = {}) {
  document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...modifiers }))
}

/** Tap the right answer. Does not wait out the flash. */
function tapRight() {
  choices()[correctIndex()].click()
}

/**
 * Tap an answer that is not the right one.
 * @returns {number} The answer it should have been, for checking the copy
 */
function tapWrong() {
  const answer = liveQuestion().answer
  choices()[(correctIndex() + 1) % PLAY.CHOICE_COUNT].click()
  return answer
}

/** Tap the right answer and let the flash run out, so the next question lands. */
function answerCorrectly() {
  tapRight()
  jest.advanceTimersByTime(900)
}

/** Tap a wrong answer and let the flash run out. */
function answerWrongly() {
  tapWrong()
  jest.advanceTimersByTime(900)
}

/**
 * Miss the boss question until there are no tries left, so the failure rule
 * has to resolve the season. Spends `BOSS_TRIES` rather than a hard-coded two,
 * because making the boss single-shot again is a supported tuning change.
 */
function missEveryBossTry() {
  for (let i = 0; i < BOSS_TRIES; i += 1) {
    answerWrongly()
  }
}

/**
 * Play the season on screen without missing anything, until the result screen
 * takes over. The cap is a guard against an infinite loop, not a real bound.
 */
function playSeasonPerfectly(limit = 40) {
  for (let i = 0; i < limit && isActive("screen-play"); i += 1) {
    answerCorrectly()
  }
  expect(isActive("screen-result")).toBe(true)
}

/**
 * Write a save describing a run mid-flight, so a test can boot straight into a
 * position that would otherwise take twenty clicks to reach.
 *
 * @param {Object} [run] - Fields to override on a freshly started season
 * @param {Object} [save] - Fields to override on the surrounding save
 */
function seedSave(run = {}, save = {}) {
  const characterId = run.characterId ?? "sloth"
  const seasonId = run.seasonId ?? "spring"
  const base = startSeason({ ...createState(4242), characterId }, seasonId)
  localStorage.setItem(
    STORAGE.KEY,
    JSON.stringify({
      version: STORAGE.VERSION,
      run: toSavedRun({ ...base, ...run }),
      unlocked: ["spring"],
      totals: zeroTotals(),
      ...save,
    }),
  )
}

/** Clear storage, seed a run, and boot onto it. */
async function bootInto(run = {}, save = {}) {
  localStorage.clear()
  seedSave(run, save)
  await boot()
}

/** The single save/restore for the whole file. See helpers.js. */
restoreRulesBetweenTests()

beforeEach(async () => {
  jest.useFakeTimers()
  localStorage.clear()
  await boot()
})

afterEach(() => {
  jest.clearAllTimers()
  jest.useRealTimers()
  jest.restoreAllMocks()
})

describe("first load", () => {
  it("lands on the character screen with the whole roster", () => {
    expect(isActive("screen-character")).toBe(true)
    expect(isActive("screen-play")).toBe(false)
    expect(isActive("screen-result")).toBe(false)
    expect(cards()).toHaveLength(CHARACTERS.length)
    expect(cards().map((card) => card.dataset.characterId)).toEqual(
      CHARACTERS.map((character) => character.id),
    )
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
    expect(hudCount()).toMatchObject({ items: 0, demand: SPRING.demand, noun: many(SPRING) })
    expect(byId("question-prompt").textContent).not.toBe("")
    expect(choices()).toHaveLength(PLAY.CHOICE_COUNT)
  })

  // The collectible itself, drawn once per item she asked for. Before this the
  // whole quest was the numeral 11.
  it("draws an empty item track, one slot per item she asked for", () => {
    chooseCharacter("sloth")
    expect(document.querySelectorAll("#item-track .item-pip")).toHaveLength(SPRING.demand)
    expect(earnedPips()).toBe(0)
    expect(document.querySelectorAll("#item-track svg")).toHaveLength(0)
  })

  it("labels each answer button with the number key that presses it", () => {
    chooseCharacter("sloth")
    expect(choices().map((button) => button.getAttribute("aria-label"))).toEqual(
      choices().map((button, index) => `Answer ${index + 1}: ${button.dataset.value}`),
    )
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

  it("the next question arrives after the flash, not before", () => {
    tapRight()
    expect(saved().run.questionsAsked).toBe(1)

    jest.advanceTimersByTime(800)
    expect(choices().every((button) => button.getAttribute("aria-disabled") === "true")).toBe(true)

    jest.advanceTimersByTime(100)
    expect(choices()).toHaveLength(PLAY.CHOICE_COUNT)
    expect(choices().every((button) => button.getAttribute("aria-disabled") === null)).toBe(true)
    expect(choices().every((button) => button.classList.contains("is-locked") === false)).toBe(true)
    // A fresh question, asserted by the counter rather than by the prompt
    // changing: prompts come from a seeded generator and two in a row can
    // legitimately be identical, which made that assertion flake.
    expect(saved().run.questionsAsked).toBe(1)
    expect(byId("question-prompt").textContent).not.toBe("")
    expect(document.querySelectorAll("#trail .trail-marker.is-done")).toHaveLength(1)
  })

  it("three correct answers in a row collect three items", () => {
    for (let i = 0; i < 3; i += 1) {
      answerCorrectly()
    }
    expect(hudCount()).toMatchObject({ items: 3 })
    expect(earnedPips()).toBe(3)
    expect(saved().run.position).toBe(3)
  })

  it("counts every answer against the lifetime totals", () => {
    answerCorrectly()
    answerWrongly()
    answerCorrectly()
    expect(saved().totals.questionsAnswered).toBe(3)
    expect(saved().totals.questionsCorrect).toBe(2)
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
    expect(choices().every((option) => option.getAttribute("aria-disabled") === "true")).toBe(true)
    expect(button.classList.contains(wasCorrect ? "is-correct" : "is-wrong")).toBe(true)
    expect(hudCount()).toMatchObject({ items: wasCorrect ? 1 : 0 })
  })

  it("a key with no button behind it does nothing", () => {
    pressKey("9")
    pressKey("0")
    pressKey("a")
    expect(choices().every((button) => button.getAttribute("aria-disabled") === null)).toBe(true)
    expect(hudCount()).toMatchObject({ items: 0 })
    expect(saved().run.questionsAsked).toBe(0)
  })

  // Cmd-1 switches browser tab and Ctrl-1 is a system shortcut on some
  // machines; answering the question as well is not what anyone meant.
  it.each([["metaKey"], ["ctrlKey"], ["altKey"]])(
    "a %s chord is left to the browser",
    (modifier) => {
      pressKey("1", { [modifier]: true })
      expect(saved().run.questionsAsked).toBe(0)
      expect(hudCount()).toMatchObject({ items: 0 })
      expect(choices().every((button) => button.getAttribute("aria-disabled") === null)).toBe(true)
    },
  )

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
    pressKey(String(correctIndex() + 1))
    pressKey("1")
    pressKey("2")
    expect(saved().run.questionsAsked).toBe(1)
    expect(hudCount()).toMatchObject({ items: 1 })
  })

  it("the guard lifts once the flash is over", () => {
    answerCorrectly()
    tapRight()
    expect(saved().run.questionsAsked).toBe(2)
    expect(hudCount()).toMatchObject({ items: 2 })
  })
})

// Every branch of `_feedbackFor`. Twelve of them had no assertion at all, which
// is how "3 Everlasting Rose!" and a miss that never said what the answer was
// both survived. Each case boots into the exact state that produces its line.
describe("the verdict under the question", () => {
  it("a plain correct answer names what it collected", async () => {
    await bootInto({ position: 0, items: 0 })
    tapRight()
    expect(feedback()).toBe(`+1 ${one(SPRING)}`)
    expect(byId("feedback").classList.contains("success")).toBe(true)
  })

  // Pluralises the rare item. This used to read "3 Everlasting Rose!" whenever a
  // glowing space paid out more than one, which is every time.
  it("a glowing space names the rare item, pluralised", async () => {
    await bootInto({ position: SPRING.glowingAt[0], items: 4 })
    tapRight()
    expect(feedback()).toBe(`3 ${SPRING.rareItemName.toLowerCase()}s!`)
  })

  it("a correct answer after a wilt says the item came back", async () => {
    await bootInto({ position: 1, items: 0, wilting: 1, lastWasWrong: true })
    tapRight()
    expect(feedback()).toBe(`+1 ${one(SPRING)}, and your ${one(SPRING)} is back`)
  })

  it("the comeback bonus says it doubled", async () => {
    await bootInto({ characterId: "porcupine", position: 1, items: 0, lastWasWrong: true })
    tapRight()
    expect(feedback()).toBe(`Double! +2 ${many(SPRING)}`)
  })

  it("the boss question names what it rescued", async () => {
    await bootInto({ phase: PHASE.BOSS, position: SPRING.spaces, items: 18 })
    tapRight()
    expect(feedback()).toBe(`Yes! That is ${SPRING.boss.rescue} more for the potion.`)
  })

  // A miss always states the correct answer, because that is the only teaching
  // this screen does -- the right-hand button turning green was otherwise the
  // sole way to learn it.
  it("a miss with nothing to lose still states the answer", async () => {
    await bootInto({ position: 0, items: 0 })
    const answer = tapWrong()
    expect(feedback()).toBe(`Not quite. The answer was ${answer}.`)
    expect(byId("feedback").classList.contains("error")).toBe(true)
  })

  // Three of the miss branches only exist under one wrong-answer rule, so each
  // one pins the rule it is describing rather than inheriting whichever is
  // shipping today. Flipping the switch in constants.js has to stay a one-line
  // change that costs nobody a red suite.
  describe("under the wilt rule", () => {
    useRules({ wrongAnswer: WRONG_ANSWER.WILT })

    it.each([
      ["sloth", 1, `Your ${one(SPRING)} is wilting.`],
      ["phoenix", 3, `Your ${many(SPRING)} are wilting.`],
    ])("a miss as the %s says what is wilting", async (characterId, items, clause) => {
      await bootInto({ characterId, position: 1, items, forgivenessLeft: 0 })
      const answer = tapWrong()
      expect(feedback()).toBe(`${clause} The answer was ${answer}.`)
    })

    it("a second miss in a row says what was lost for good", async () => {
      await bootInto({ position: 1, items: 1, wilting: 1, lastWasWrong: true })
      const answer = tapWrong()
      expect(feedback()).toBe(`Lost 1 ${one(SPRING)}. The answer was ${answer}.`)
    })

    // The perk only spends itself on a miss that was going to cost something,
    // so it needs a rule that costs something. The gentle case below is the
    // other half of that.
    it("a forgiven miss names the perk that saved it", async () => {
      await bootInto({ characterId: "phoenix", position: 1, items: 1, forgivenessLeft: 1 })
      const answer = tapWrong()
      expect(feedback()).toBe(
        `${getCharacter("phoenix").perkName} saved you! The answer was ${answer}.`,
      )
      expect(saved().run.forgivenessLeft).toBe(0)
    })
  })

  describe("under the step-back rule", () => {
    useRules({ wrongAnswer: WRONG_ANSWER.STEP_BACK })

    // Only reachable under this rule, and only with nothing left to take: with
    // items in hand the line reports the loss instead.
    it("a miss with nothing to lose but ground says how far back it went", async () => {
      await bootInto({ position: 2, items: 0, forgivenessLeft: 0 })
      const answer = tapWrong()
      expect(feedback()).toBe(`Back 1. The answer was ${answer}.`)
      expect(saved().run.position).toBe(1)
    })

    it("a miss that costs an item says so", async () => {
      await bootInto({ position: 2, items: 2, forgivenessLeft: 0 })
      const answer = tapWrong()
      expect(feedback()).toBe(`Lost 1 ${one(SPRING)}. The answer was ${answer}.`)
    })
  })

  describe("under the gentle rule", () => {
    useRules({ wrongAnswer: WRONG_ANSWER.GENTLE })

    // Nothing is ever lost, so the miss says only what the answer was -- and
    // the perk stays in hand, because spending it on a free mistake reads as a
    // bug to a player.
    it("a miss says only what the answer was, and keeps the perk", async () => {
      await bootInto({ characterId: "phoenix", position: 1, items: 1, forgivenessLeft: 1 })
      const answer = tapWrong()
      expect(feedback()).toBe(`Not quite. The answer was ${answer}.`)
      expect(saved().run.forgivenessLeft).toBe(1)
    })
  })

  // Running out of time is its own branch, and it still has to teach the
  // answer. Summer is the first season with a clock.
  it("a timeout says so, and states the answer", async () => {
    await bootInto({ characterId: "banana-slug", seasonId: "summer", position: 1 })
    const answer = liveQuestion().answer
    expect(byId("timer").textContent).toBe(String(SUMMER.timerSeconds))

    jest.advanceTimersByTime(SUMMER.timerSeconds * 1000)

    expect(feedback()).toBe(`Time ran out! The answer was ${answer}.`)
    expect(saved().run.questionsAsked).toBe(1)
    expect(saved().run.correctCount).toBe(0)
  })

  it("is cleared again when the next question arrives", async () => {
    await bootInto({ position: 0, items: 0 })
    answerCorrectly()
    expect(feedback()).toBe("")
  })

  // One branch of `_feedbackFor` has no case here: the bare "Right!" for a
  // correct answer that gained nothing. It needs either a boss whose
  // `rescue` is 0 or a character whose `glowingItems` is 0, and no shipped
  // season or character has either -- the smallest rescue is spring's 3 and
  // the smallest glowing payout is the banana slug's 2. So the line is
  // unreachable through the real game today, and the only way to assert it
  // would be to invent content the player cannot meet. If a season or
  // character ever does zero one of those out, add the case here.
})

// The wrong-answer rule is the switch Ella is still choosing between, so each
// option gets an end-to-end case of what it actually costs -- not just what the
// verdict line says about it. GameState.test.js proves the arithmetic; these
// prove the save and the screen agree with it.
describe("what a wrong answer costs", () => {
  describe("under the gentle rule", () => {
    useRules({ wrongAnswer: WRONG_ANSWER.GENTLE })

    it("takes nothing and moves nothing", async () => {
      await bootInto({ position: 2, items: 2, forgivenessLeft: 0 })
      answerWrongly()
      expect(hudCount()).toMatchObject({ items: 2 })
      expect(earnedPips()).toBe(2)
      expect(saved().run.items).toBe(2)
      expect(saved().run.position).toBe(2)
      expect(saved().run.wilting).toBe(0)
      expect(saved().run.lost).toBe(0)
      // A fresh question, though: the player is not stuck on the one they
      // missed.
      expect(saved().run.questionsAsked).toBe(1)
      expect(isActive("screen-play")).toBe(true)
    })
  })

  describe("under the wilt rule", () => {
    useRules({ wrongAnswer: WRONG_ANSWER.WILT })

    it("sets the newest item wilting, and the next right answer brings it back", async () => {
      await bootInto({ position: 2, items: 2, forgivenessLeft: 0 })
      answerWrongly()
      expect(hudCount()).toMatchObject({ items: 1 })
      expect(saved().run.wilting).toBe(1)
      expect(saved().run.position).toBe(2)
      expect(byId("wilt-note").classList.contains("hidden")).toBe(false)

      answerCorrectly()
      expect(hudCount()).toMatchObject({ items: 3 })
      expect(saved().run.wilting).toBe(0)
      expect(saved().run.lost).toBe(0)
      expect(byId("wilt-note").classList.contains("hidden")).toBe(true)
    })
  })

  describe("under the step-back rule", () => {
    useRules({ wrongAnswer: WRONG_ANSWER.STEP_BACK })

    it("moves the token back a space and takes the item outright", async () => {
      await bootInto({ position: 2, items: 2, forgivenessLeft: 0 })
      answerWrongly()
      expect(saved().run.position).toBe(1)
      expect(saved().run.items).toBe(1)
      expect(saved().run.lost).toBe(1)
      expect(saved().run.wilting).toBe(0)
      expect(hudCount()).toMatchObject({ items: 1 })
      expect(earnedPips()).toBe(1)
      // Nothing is wilting, so nothing is promised back.
      expect(byId("wilt-note").classList.contains("hidden")).toBe(true)
      expect(document.querySelectorAll("#trail .trail-marker.is-done")).toHaveLength(1)
    })
  })
})

// The single highest-value gap the audit found: nothing exercised the end of a
// season at all, so `_renderResult`, `_unlockAfter`, `_onAdvance`, `_onRetry`,
// `_startNewRun` and the totals bookkeeping were all untested.
describe("playing a season to the end", () => {
  beforeEach(() => {
    chooseCharacter("sloth")
    playSeasonPerfectly()
  })

  it("hands over to the result screen with the season's figures", () => {
    expect(isActive("screen-result")).toBe(true)
    expect(isActive("screen-play")).toBe(false)
    expect(byId("result-title").textContent).toBe(TITLE.seasonComplete(SPRING))
    // Shape, not sentence: the winning copy has to name what she just counted.
    // The rest of the line is Ella's to rewrite.
    expect(byId("result-text").textContent).toContain(many(SPRING))
    expect(summaryRows()).toEqual([
      [`${SPRING.itemPlural} delivered`, String(PERFECT_SPRING)],
      ["She asked for", String(SPRING.demand)],
      ["Questions right", `${SPRING.spaces + 1} of ${SPRING.spaces + 1}`],
      ["Best streak", String(SPRING.spaces + 1)],
    ])
  })

  it("offers exactly one way onward, named after the next season", () => {
    expect(resultButtons().map((button) => button.textContent)).toEqual(["On to Summer"])
    expect(resultButtons()[0].className).toBe("big-btn is-primary")
    // `render` moves focus to the screen's heading after drawing it, so a
    // screen-reader user hears "Spring complete" rather than landing on a
    // button with no idea what just happened.
    expect(document.activeElement).toBe(byId("result-title"))
    expect(byId("result-title").getAttribute("tabindex")).toBe("-1")
  })

  it("unlocks summer and counts the season as cleared", () => {
    expect(saved().unlocked).toEqual(["spring", "summer"])
    expect(saved().totals.seasonsCleared).toBe(1)
    expect(saved().totals.runsCompleted).toBe(0)
    expect(saved().totals.questionsAnswered).toBe(SPRING.spaces + 1)
    expect(saved().totals.questionsCorrect).toBe(SPRING.spaces + 1)
    expect(saved().run.phase).toBe(PHASE.SEASON_WON)
    expect(saved().run.collected).toEqual({ spring: PERFECT_SPRING })
  })

  it("starts summer when the button is pressed", () => {
    resultButtons()[0].click()

    expect(isActive("screen-play")).toBe(true)
    expect(byId("season-name").textContent).toBe("Summer")
    expect(byId("demand-line").textContent).toBe(SUMMER.demandText)
    expect(hudCount()).toMatchObject({ items: 0, demand: SUMMER.demand, noun: many(SUMMER) })
    expect(document.querySelectorAll("#item-track .item-pip")).toHaveLength(SUMMER.demand)
    expect(saved().run.seasonId).toBe("summer")
    expect(saved().run.position).toBe(0)
    expect(saved().run.items).toBe(0)
    // Spring's tally survives into the run summary; the per-season counters do not.
    expect(saved().run.collected).toEqual({ spring: PERFECT_SPRING })
    // Summer is the first timed season, and the sloth's ten seconds apply.
    expect(byId("timer-wrap").classList.contains("hidden")).toBe(false)
    expect(byId("timer").textContent).toBe(String(SUMMER.timerSeconds + 10))
  })

  it("does not unlock summer twice when spring is cleared again", () => {
    resultButtons()[0].click()
    expect(saved().unlocked).toEqual(["spring", "summer"])
  })
})

// The end of the run, which nothing reached before: no test in this file had
// ever seen PHASE.RUN_COMPLETE, so the run-complete branch of `_renderResult`
// and the `runsCompleted` tally were both unexercised.
//
// The screen's whole reason for existing is that its summary is per-season.
// Every per-season counter has been reset by the time the last season ends, so
// the default summary -- the one every other result screen uses -- reports that
// one season as though it were the entire journey. The assertions below are
// written against each season's own figures, and against the default summary
// explicitly *not* being what is on screen.
//
// Everything here reads SEASON_ORDER rather than naming four seasons, so a
// fifth one in seasons.js costs this block nothing.
describe("finishing the whole journey", () => {
  /** What each season banks when nothing is missed, in play order. */
  const PERFECT = SEASON_ORDER.map((id) => perfectRun(getSeason(id)))

  /** Every season but the last, which the boss tests below bank up front. */
  const EARLIER_SEASONS = SEASON_ORDER.slice(0, -1)

  /** The best streak a perfect run reaches: the last trail plus its boss. */
  const PERFECT_STREAK = LAST_SEASON.spaces + 1

  /** The last season's own figures, banked from the seeded boss question. */
  const LAST_FROM_BOSS = LAST_SEASON.demand + LAST_SEASON.boss.rescue

  /** A streak set by the seed, so the row cannot be right by coincidence. */
  const SEEDED_STREAK = 9

  /**
   * Play every season perfectly, pressing on at each result screen. The last
   * press is "Finish the journey", which is what ends the run.
   */
  function playWholeRun() {
    chooseCharacter("sloth")
    for (let i = 0; i < SEASON_ORDER.length; i += 1) {
      playSeasonPerfectly()
      resultButtons()[0].click()
    }
  }

  /**
   * Boot onto the last season's boss with earlier seasons already banked, so a
   * test can play the last stretch instead of every question of a full run.
   *
   * @param {Object<string, number>} collected - Seasons already delivered
   */
  async function bootIntoLastBoss(collected) {
    await bootInto({
      seasonId: LAST_SEASON.id,
      phase: PHASE.BOSS,
      position: LAST_SEASON.spaces,
      items: LAST_SEASON.demand,
      bestStreak: SEEDED_STREAK,
      collected,
    })
  }

  /** Answer the last season's boss and press through to the end of the run. */
  function finishLastSeason() {
    answerCorrectly()
    expect(byId("result-title").textContent).toBe(TITLE.seasonComplete(LAST_SEASON))
    resultButtons()[0].click()
  }

  it("ends the run once the last season is cleared, played all the way through", () => {
    playWholeRun()

    expect(isActive("screen-result")).toBe(true)
    expect(isActive("screen-play")).toBe(false)
    expect(byId("result-title").textContent).toBe(TITLE.runComplete)
    // The ending copy is Ella's; all this needs is that there *is* some, and
    // that the title above says which branch drew it.
    expect(byId("result-text").textContent.length).toBeGreaterThan(0)
    expect(saved().run.phase).toBe(PHASE.RUN_COMPLETE)
    expect(document.activeElement).toBe(byId("result-title"))
    expect(saved().run.collected).toEqual(
      Object.fromEntries(SEASON_ORDER.map((id, index) => [id, PERFECT[index]])),
    )
  })

  // The headline: one row per season, from `state.collected`, and emphatically
  // not the default summary of winter's counters.
  it("summarises every season played rather than the last one over and over", () => {
    playWholeRun()

    expect(summaryRows()).toEqual([
      ...SEASON_ORDER.map((id, index) => [seasonRowLabel(id), String(PERFECT[index])]),
      ["Best streak", String(PERFECT_STREAK)],
    ])

    // The label format, pinned once and only here. Every other row assertion in
    // this file derives it, so this is the single line to update if the summary
    // ever reads something other than "Spring — roses".
    expect(summaryRows()[0][0]).toBe(`${SPRING.name} — ${SPRING.itemPlural.toLowerCase()}`)

    // The exact screen this replaced. Spelled out rather than implied, because
    // dropping the rows argument silently falls back to precisely this.
    expect(summaryRows()).not.toEqual([
      [`${LAST_SEASON.itemPlural} delivered`, String(PERFECT.at(-1))],
      ["She asked for", String(LAST_SEASON.demand)],
      ["Questions right", `${PERFECT_STREAK} of ${PERFECT_STREAK}`],
      ["Best streak", String(PERFECT_STREAK)],
    ])
  })

  it("counts the completed run once, and not at the end of each season", () => {
    chooseCharacter("sloth")
    const perSeason = []
    for (let i = 0; i < SEASON_ORDER.length; i += 1) {
      playSeasonPerfectly()
      perSeason.push(saved().totals.runsCompleted)
      resultButtons()[0].click()
    }

    expect(perSeason).toEqual(SEASON_ORDER.map(() => 0))
    expect(saved().totals.runsCompleted).toBe(1)
    expect(saved().totals.seasonsCleared).toBe(SEASON_ORDER.length)
  })

  describe("the last stretch of it", () => {
    beforeEach(async () => {
      await bootIntoLastBoss(
        Object.fromEntries(EARLIER_SEASONS.map((id, index) => [id, PERFECT[index]])),
      )
      finishLastSeason()
    })

    it("shows each season's own tally, the last from the boss it just answered", () => {
      expect(byId("result-title").textContent).toBe(TITLE.runComplete)
      expect(summaryRows()).toEqual([
        ...EARLIER_SEASONS.map((id, index) => [seasonRowLabel(id), String(PERFECT[index])]),
        [seasonRowLabel(LAST_SEASON.id), String(LAST_FROM_BOSS)],
        ["Best streak", String(SEEDED_STREAK)],
      ])
    })

    // The high-water mark for the whole run, not for winter: one correct boss
    // answer is a streak of 1, and the row still reports the seeded best.
    it("reports the run's best streak, last", () => {
      expect(saved().run.streak).toBe(1)
      expect(saved().run.bestStreak).toBe(SEEDED_STREAK)
      expect(summaryRows().at(-1)).toEqual(["Best streak", String(SEEDED_STREAK)])
    })

    it("offers one way onward, and it is Play again", () => {
      expect(resultButtons().map((button) => button.textContent)).toEqual(["Play again"])
      expect(resultButtons()[0].className).toBe("big-btn is-primary")
    })

    it("throws the run away when Play again is confirmed", () => {
      jest.spyOn(window, "confirm").mockReturnValue(true)
      resultButtons()[0].click()

      expect(window.confirm).toHaveBeenCalledTimes(1)
      expect(isActive("screen-character")).toBe(true)
      expect(isActive("screen-result")).toBe(false)
      expect(saved().run.phase).toBe(PHASE.CHARACTER_SELECT)
      expect(saved().run.seasonId).toBeNull()
      expect(saved().run.collected).toEqual({})
      // The journey goes; the ledger of journeys stays.
      expect(saved().totals.runsCompleted).toBe(1)
    })

    it("keeps the finished run when the confirm is dismissed", () => {
      jest.spyOn(window, "confirm").mockReturnValue(false)
      resultButtons()[0].click()

      expect(window.confirm).toHaveBeenCalledTimes(1)
      expect(isActive("screen-result")).toBe(true)
      expect(byId("result-title").textContent).toBe(TITLE.runComplete)
      expect(saved().run.phase).toBe(PHASE.RUN_COMPLETE)
      expect(saved().run.collected[LAST_SEASON.id]).toBe(LAST_FROM_BOSS)
    })

    it("counts the run once, and not again when the finished page is reloaded", async () => {
      expect(saved().totals.runsCompleted).toBe(1)
      const rows = summaryRows()

      await boot()

      expect(byId("result-title").textContent).toBe(TITLE.runComplete)
      expect(summaryRows()).toEqual(rows)
      expect(saved().totals.runsCompleted).toBe(1)
    })
  })

  // The filter is load-bearing, not decoration. `collected` comes off a save
  // file, and `storage.js` drops any key that is not a current season id -- so
  // a run carried across a season rename, or one saved before a season existed,
  // arrives here with a gap in it. The summary lists what was delivered rather
  // than one row per season in the calendar; without the filter the missing
  // ones render as "undefined".
  it("lists only the seasons that were actually cleared", async () => {
    await bootIntoLastBoss({ [SEASON_ORDER[0]]: PERFECT[0] })
    finishLastSeason()

    expect(summaryRows()).toEqual([
      [seasonRowLabel(SEASON_ORDER[0]), String(PERFECT[0])],
      [seasonRowLabel(LAST_SEASON.id), String(LAST_FROM_BOSS)],
      ["Best streak", String(SEEDED_STREAK)],
    ])
    // The seasons in between were never delivered, so they get no row at all.
    for (const id of EARLIER_SEASONS.slice(1)) {
      expect(summaryRows().map(([label]) => label)).not.toContain(seasonRowLabel(id))
    }
    expect(summaryRows().map(([, value]) => value)).not.toContain("undefined")
  })
})

// Ella's rule: "if you miss the boss question you get a chance to go back and
// try again." A miss draws a fresh boss question rather than ending the season,
// and only running out of tries hands over to the failure rule -- which is the
// other undecided switch, so each of its three options gets its own block below
// rather than whichever one happens to be shipping.
describe("the boss question", () => {
  /** Spring's boss, reached with two items banked and the demand well short. */
  const bootIntoBoss = () => bootInto({ phase: PHASE.BOSS, position: SPRING.spaces, items: 2 })

  // Independent of the failure rule: this is about the tries, not what happens
  // once they are gone.
  itWithASecondTry(
    "gives another try after the first miss instead of ending the season",
    async () => {
      await bootIntoBoss()
      answerWrongly()
      expect(isActive("screen-play")).toBe(true)
      expect(saved().run.phase).toBe(PHASE.BOSS)
      expect(saved().run.bossTriesLeft).toBe(BOSS_TRIES - 1)
      expect(saved().run.position).toBe(SPRING.spaces)
      expect(choices()).toHaveLength(PLAY.CHOICE_COUNT)
    },
  )

  describe("under the retry-season rule", () => {
    useRules({ bossFailure: BOSS_FAILURE.RETRY_SEASON })
    beforeEach(bootIntoBoss)

    it("loses the season once the tries run out", () => {
      missEveryBossTry()
      expect(isActive("screen-result")).toBe(true)
      expect(byId("result-title").textContent).toBe(TITLE.seasonLost)
      // Shape, not sentence: the losing copy has to state both numbers -- what she
      // wanted, and what actually arrived -- in that order.
      expect(byId("result-text").textContent).toMatch(
        new RegExp(`\\b${SPRING.demand}\\b[\\s\\S]*\\b2\\b`),
      )
      expect(resultButtons().map((button) => button.textContent)).toEqual([
        "Try Spring again",
        "Pick a new character",
      ])
      expect(saved().run.phase).toBe(PHASE.SEASON_LOST)
      expect(saved().run.runOver).toBe(false)
      expect(saved().totals.seasonsCleared).toBe(0)
      expect(saved().unlocked).toEqual(["spring"])
    })

    it("replays the season from the top, with different questions", () => {
      missEveryBossTry()
      resultButtons()[0].click()

      expect(isActive("screen-play")).toBe(true)
      expect(byId("season-name").textContent).toBe("Spring")
      expect(hudCount()).toMatchObject({ items: 0 })
      expect(saved().run.position).toBe(0)
      expect(saved().run.items).toBe(0)
      expect(saved().run.phase).toBe(PHASE.TRAIL)
      // `attempt` is folded into the question seed, so a retry is real practice
      // rather than the same twenty questions in the same order.
      expect(saved().run.attempt).toBe(1)
    })

    it("clears the run when the second button is confirmed", () => {
      jest.spyOn(window, "confirm").mockReturnValue(true)
      missEveryBossTry()
      resultButtons()[1].click()

      expect(window.confirm).toHaveBeenCalledTimes(1)
      expect(isActive("screen-character")).toBe(true)
      expect(saved().run.phase).toBe(PHASE.CHARACTER_SELECT)
      expect(saved().run.seasonId).toBeNull()
    })

    it("keeps the run when the confirm is dismissed", () => {
      jest.spyOn(window, "confirm").mockReturnValue(false)
      missEveryBossTry()
      resultButtons()[1].click()

      expect(window.confirm).toHaveBeenCalledTimes(1)
      expect(isActive("screen-result")).toBe(true)
      expect(saved().run.phase).toBe(PHASE.SEASON_LOST)
    })
  })

  describe("under the always-pass rule", () => {
    useRules({ bossFailure: BOSS_FAILURE.ALWAYS_PASS })
    beforeEach(bootIntoBoss)

    it("clears the season anyway, banking only what was collected", () => {
      missEveryBossTry()
      expect(isActive("screen-result")).toBe(true)
      expect(byId("result-title").textContent).toBe(TITLE.seasonComplete(SPRING))
      expect(saved().run.phase).toBe(PHASE.SEASON_WON)
      expect(saved().run.runOver).toBe(false)
      expect(saved().run.collected.spring).toBe(2)
      expect(saved().totals.seasonsCleared).toBe(1)
      expect(saved().unlocked).toEqual(["spring", "summer"])
      // One way on, and it goes to the next season rather than back here.
      expect(resultButtons().map((button) => button.textContent)).toEqual(["On to Summer"])
    })
  })

  describe("under the end-run rule", () => {
    useRules({ bossFailure: BOSS_FAILURE.END_RUN })
    beforeEach(bootIntoBoss)

    it("ends the whole run once the tries run out", () => {
      missEveryBossTry()
      expect(isActive("screen-result")).toBe(true)
      expect(byId("result-title").textContent).toBe(TITLE.runOver)
      expect(saved().run.phase).toBe(PHASE.SEASON_LOST)
      expect(saved().run.runOver).toBe(true)
      expect(saved().totals.seasonsCleared).toBe(0)
      // "Start again", not "Try Spring again": the run is over, so the retry
      // goes back to the first season rather than replaying this one.
      expect(resultButtons().map((button) => button.textContent)).toEqual([
        "Start again",
        "Pick a new character",
      ])

      resultButtons()[0].click()
      expect(isActive("screen-play")).toBe(true)
      expect(byId("season-name").textContent).toBe(getSeason(SEASON_ORDER[0]).name)
      expect(saved().run.runOver).toBe(false)
      expect(saved().run.items).toBe(0)
    })
  })
})

// The restart button in the top bar throws the whole journey away. On a shared
// iPad the next child to pick it up would otherwise erase a half-finished run
// with one tap, so it asks first.
describe("the restart button", () => {
  beforeEach(() => {
    chooseCharacter("sloth")
    answerCorrectly()
    answerCorrectly()
  })

  it("erases the run once the confirm is accepted", () => {
    jest.spyOn(window, "confirm").mockReturnValue(true)
    byId("restart").click()

    expect(window.confirm).toHaveBeenCalledTimes(1)
    expect(isActive("screen-character")).toBe(true)
    expect(isActive("screen-play")).toBe(false)
    expect(saved().run.phase).toBe(PHASE.CHARACTER_SELECT)
    expect(saved().run.position).toBe(0)
    expect(saved().run.items).toBe(0)
    // A restart resets the ledger too, not just the run in progress.
    expect(saved().unlocked).toEqual(["spring"])
    expect(saved().totals).toEqual(zeroTotals())
  })

  it("changes nothing when the confirm is dismissed", () => {
    jest.spyOn(window, "confirm").mockReturnValue(false)
    const before = localStorage.getItem(STORAGE.KEY)
    byId("restart").click()

    expect(window.confirm).toHaveBeenCalledTimes(1)
    expect(isActive("screen-play")).toBe(true)
    expect(hudCount()).toMatchObject({ items: 2 })
    expect(localStorage.getItem(STORAGE.KEY)).toBe(before)
  })
})

// Locking an iPad mid-question used to leave the countdown running, so the
// child came back to a question that had already timed out -- or, worse, that
// timed out while the screen was off and scored a miss.
describe("leaving and coming back", () => {
  /** Pretend the tab went to the background, or came back. */
  function setHidden(hidden) {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden })
    document.dispatchEvent(new Event("visibilitychange"))
  }

  afterEach(() => {
    delete document.hidden
  })

  it("stops the clock while hidden and restarts it on return", async () => {
    await bootInto({ characterId: "banana-slug", seasonId: "summer", position: 1 })
    expect(byId("timer").textContent).toBe("20")

    jest.advanceTimersByTime(3_000)
    expect(byId("timer").textContent).toBe("17")

    setHidden(true)
    jest.advanceTimersByTime(9_000)
    expect(byId("timer").textContent).toBe("17")
    expect(saved().run.questionsAsked).toBe(0)

    // Restarted, not resumed: the alternative is handing back a question with
    // two seconds left because the iPad was locked.
    setHidden(false)
    expect(byId("timer").textContent).toBe("20")
    jest.advanceTimersByTime(2_000)
    expect(byId("timer").textContent).toBe("18")
  })

  it("hiding the page mid-flash does not lose the answer that just landed", async () => {
    await bootInto({ characterId: "banana-slug", seasonId: "summer", position: 1 })
    tapRight()
    setHidden(true)
    setHidden(false)
    jest.advanceTimersByTime(900)

    expect(saved().run.questionsAsked).toBe(1)
    expect(saved().run.correctCount).toBe(1)
    expect(isActive("screen-play")).toBe(true)
  })
})

describe("persistence", () => {
  it("writes a save under the game's own key", () => {
    chooseCharacter("sloth")
    tapRight()
    expect(STORAGE.KEY).toBe("seasonsProgress")
    expect(localStorage.getItem(STORAGE.KEY)).not.toBeNull()
    expect(saved().version).toBe(STORAGE.VERSION)
    expect(saved().run.position).toBe(1)
  })

  it("a reload resumes the trail rather than asking for a character again", async () => {
    chooseCharacter("phoenix")
    for (let i = 0; i < 2; i += 1) {
      answerCorrectly()
    }
    expect(hudCount()).toMatchObject({ items: 2 })

    // Reboot onto fresh markup WITHOUT clearing storage, the way a reload does.
    await boot()

    expect(isActive("screen-play")).toBe(true)
    expect(isActive("screen-character")).toBe(false)
    expect(hudCount()).toMatchObject({ items: 2 })
    expect(byId("season-name").textContent).toBe("Spring")
    expect(document.querySelectorAll("#trail .trail-marker.is-done")).toHaveLength(2)
    expect(choices()).toHaveLength(PLAY.CHOICE_COUNT)
  })

  // The real case, rather than the pieces of it. Everything a returning player
  // sees has to line up at once: a restored question with the previous run's
  // choices, or a count that disagrees with the trail, is a save bug that the
  // separate checks below would each miss.
  //
  // The wrong answer in the middle is here to make the state worth restoring,
  // not because this test is about any particular wrong-answer rule -- so what
  // it costs is left to whichever rule is in force, and the sanity checks below
  // only say the run really is mid-trail.
  it("a reload puts back the whole screen, not just parts of it", async () => {
    chooseCharacter("porcupine")
    answerCorrectly()
    answerWrongly()
    answerCorrectly()
    answerCorrectly()

    const before = {
      prompt: byId("question-prompt").textContent,
      values: choices().map((button) => button.dataset.value),
      labels: choices().map((button) => button.getAttribute("aria-label")),
      count: hudCount().line,
      pips: earnedPips(),
      done: document.querySelectorAll("#trail .trail-marker.is-done").length,
      run: saved().run,
    }
    expect(before.run.questionsAsked).toBe(4)
    expect(before.run.position).toBeGreaterThan(0)
    expect(before.run.position).toBeLessThan(SPRING.spaces)
    expect(before.run.phase).toBe(PHASE.TRAIL)

    await boot()

    expect(byId("question-prompt").textContent).toBe(before.prompt)
    expect(choices().map((button) => button.dataset.value)).toEqual(before.values)
    expect(choices().map((button) => button.getAttribute("aria-label"))).toEqual(before.labels)
    expect(hudCount().line).toBe(before.count)
    expect(earnedPips()).toBe(before.pips)
    expect(document.querySelectorAll("#trail .trail-marker.is-done")).toHaveLength(before.done)
    expect(saved().run).toEqual(before.run)
    // ...and the restored question is still answerable, with the same answer.
    tapRight()
    expect(saved().run.correctCount).toBe(before.run.correctCount + 1)
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
    expect(cards()).toHaveLength(CHARACTERS.length)
  })

  it("garbage in the key starts a fresh run rather than failing to load", async () => {
    localStorage.setItem(STORAGE.KEY, "{not json")
    await boot()
    expect(isActive("screen-character")).toBe(true)
    expect(cards()).toHaveLength(CHARACTERS.length)
  })
})

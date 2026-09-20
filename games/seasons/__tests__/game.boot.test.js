/**
 * Loading the game, starting a run, and everything that outlives one: the save
 * it writes, coming back to it, throwing it away, and the debug entry point.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"
import { CHARACTERS } from "../js/characters.js"
import { PHASE, PLAY, SEASON_ORDER, STORAGE } from "../js/constants.js"
import { getSeason } from "../js/seasons.js"
import { hudCount, many, zeroTotals } from "./helpers.js"
import {
  SPRING,
  boot,
  byId,
  isActive,
  cards,
  choices,
  earnedPips,
  trailSpace,
  saved,
  correctIndex,
  chooseCharacter,
  pressKey,
  choiceKey,
  tapRight,
  landAnswer,
  answerCorrectly,
  answerWrongly,
  seedSave,
  bootInto,
  TIMED,
  setupGameHarness,
} from "./game-harness.js"

setupGameHarness()

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

  it("labels each answer button with the letter key that presses it", () => {
    chooseCharacter("sloth")
    expect(choices().map((button) => button.getAttribute("aria-label"))).toEqual(
      choices().map(
        (button, index) => `Answer ${choiceKey(index).toUpperCase()}: ${button.dataset.value}`,
      ),
    )
  })

  it("draws the trail with the token at the start", () => {
    chooseCharacter("phoenix")
    // One obstacle per space, and the glowing ones are wherever the route puts
    // its hard obstacles -- both derived, so retuning a route costs this nothing.
    expect(document.querySelectorAll("#trail .trail-obstacle")).toHaveLength(SPRING.spaces)
    expect(document.querySelectorAll("#trail .trail-obstacle.is-glowing")).toHaveLength(
      SPRING.glowingAt.length,
    )
    expect(document.querySelector("#trail .trail-token")).not.toBeNull()
    expect(trailSpace()).toEqual({ space: 1, of: SPRING.spaces })
  })

  it("records the choice in the save", () => {
    chooseCharacter("porcupine")
    expect(saved().run.characterId).toBe("porcupine")
    expect(saved().run.seasonId).toBe("spring")
    expect(saved().run.phase).toBe(PHASE.TRAIL)
  })
})

// The site's help overlay covers the answer buttons the same way the settings
// dialog does. It publishes `__helpOverlayIsOpen` from shared/nav.js precisely
// so a game can ask, and for a while no game did.
describe("the site help overlay", () => {
  afterEach(() => {
    delete window.__helpOverlayIsOpen
  })

  it("swallows the answer keys while it is open", async () => {
    await bootInto({ seasonId: "spring", position: 1 })
    window.__helpOverlayIsOpen = () => true

    pressKey(choiceKey(correctIndex()))

    expect(saved().run.questionsAsked).toBe(0)
  })

  it("lets them through again once it closes", async () => {
    await bootInto({ seasonId: "spring", position: 1 })
    window.__helpOverlayIsOpen = () => false

    pressKey(choiceKey(correctIndex()))
    await landAnswer()

    expect(saved().run.questionsAsked).toBe(1)
  })
})

// The restart button in the top bar throws the whole journey away. On a shared
// iPad the next child to pick it up would otherwise erase a half-finished run
// with one tap, so it asks first.
describe("the restart button", () => {
  beforeEach(async () => {
    chooseCharacter("sloth")
    await answerCorrectly()
    await answerCorrectly()
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
    // Read from the season rather than written as a literal: the clock is meant
    // to be retunable, and this test is about the pause, not the length. The
    // Banana Slug has no timer perk, so what the season says is what shows.
    const full = getSeason("summer").timerSeconds
    await bootInto({ characterId: "banana-slug", seasonId: "summer", position: 1 }, TIMED)
    expect(byId("timer").textContent).toBe(String(full))

    jest.advanceTimersByTime(3_000)
    expect(byId("timer").textContent).toBe(String(full - 3))

    setHidden(true)
    jest.advanceTimersByTime(9_000)
    expect(byId("timer").textContent).toBe(String(full - 3))
    expect(saved().run.questionsAsked).toBe(0)

    // Restarted, not resumed: the alternative is handing back a question with
    // two seconds left because the iPad was locked.
    setHidden(false)
    expect(byId("timer").textContent).toBe(String(full))
    jest.advanceTimersByTime(2_000)
    expect(byId("timer").textContent).toBe(String(full - 2))
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
      await answerCorrectly()
    }
    expect(hudCount()).toMatchObject({ items: 2 })

    // Reboot onto fresh markup WITHOUT clearing storage, the way a reload does.
    await boot()

    expect(isActive("screen-play")).toBe(true)
    expect(isActive("screen-character")).toBe(false)
    expect(hudCount()).toMatchObject({ items: 2 })
    expect(byId("season-name").textContent).toBe("Spring")
    expect(trailSpace()).toEqual({ space: 3, of: SPRING.spaces })
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
    await answerCorrectly()
    answerWrongly()
    await answerCorrectly()
    await answerCorrectly()

    const before = {
      prompt: byId("question-prompt").textContent,
      values: choices().map((button) => button.dataset.value),
      labels: choices().map((button) => button.getAttribute("aria-label")),
      count: hudCount().line,
      pips: earnedPips(),
      where: trailSpace(),
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
    expect(trailSpace()).toEqual(before.where)
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

/**
 * The debug query string, which exists so a grown-up can look at winter without
 * playing three seasons to reach it.
 *
 * The load-bearing test here is the one about storage. Everything else is a
 * convenience; writing over a child's half-finished run while checking the art
 * is the kind of damage that is silent and cannot be undone.
 *
 * Every other test in this file boots at jsdom's default location, which has no
 * query string, so they exercise the non-debug path already.
 */
describe("the debug query string", () => {
  /**
   * Boot with a query string, from a clean save.
   * @param {string} search - The query string, including its leading "?"
   * @returns {Promise<void>} Resolves once the game has drawn
   */
  async function bootWith(search) {
    localStorage.clear()
    document.body.removeAttribute("data-debug")
    window.history.replaceState({}, "", `/${search}`)
    await boot()
  }

  afterEach(() => window.history.replaceState({}, "", "/"))

  /**
   * The kind of the question on screen, worked out from its prompt. Debug mode
   * writes no save, so `liveQuestion` -- which reads one back -- cannot be used.
   * @returns {string} A form kind
   */
  function liveQuestionKind() {
    const prompt = byId("question-prompt").textContent
    if (/×.*[+-]/.test(prompt)) return "twoStep"
    if (prompt.includes("÷")) return "div"
    if (prompt.includes("×")) return "mul"
    return prompt.includes("+") ? "add" : "sub"
  }

  it("drops straight into the named season", async () => {
    await bootWith("?season=winter")
    expect(isActive("screen-play")).toBe(true)
    expect(byId("season-name").textContent).toContain(getSeason("winter").name)
  })

  it("writes nothing to storage, so a real run survives being looked at", async () => {
    localStorage.clear()
    seedSave({ seasonId: "spring", position: 4 })
    const before = localStorage.getItem(STORAGE.KEY)
    document.body.removeAttribute("data-debug")
    window.history.replaceState({}, "", "/?season=winter")
    await boot()
    // Play a question, which is what would normally trigger a save.
    choices()[0].click()
    jest.advanceTimersByTime(4000)
    expect(localStorage.getItem(STORAGE.KEY)).toBe(before)
  })

  it("marks the page, so a debug session does not read as a save bug", async () => {
    await bootWith("?season=autumn")
    expect(document.body.getAttribute("data-debug")).toBe("autumn")
  })

  it("takes the character too", async () => {
    await bootWith("?season=summer&character=sloth")
    expect(byId("season-name").textContent).toContain(getSeason("summer").name)
    expect(saved()).toBeNull()
  })

  it("jumps to the last screen in the game", async () => {
    // The one that is otherwise four seasons away, and so the least-looked-at
    // screen in the game.
    await bootWith("?phase=end")
    expect(isActive("screen-result")).toBe(true)
    expect(byId("result-title").textContent).toBe("The potion is finished")
    // Every season has to show a haul, or the summary is a blank table.
    const summary = byId("result-summary").textContent
    for (const id of SEASON_ORDER) expect(summary).toContain(getSeason(id).name)
    // And the picture: one rare collectible per season in the finished flask.
    // This screen used to be a title, a paragraph and four numbers.
    expect(byId("result-haul").querySelectorAll(".finale-item")).toHaveLength(SEASON_ORDER.length)
    expect(byId("result-haul").querySelector(".finale-flask")).not.toBeNull()
  })

  it("jumps to a boss, with a boss question already drawn", async () => {
    await bootWith("?season=autumn&phase=boss")
    expect(isActive("screen-play")).toBe(true)
    expect(choices()).toHaveLength(4)
    const kinds = getSeason("autumn").boss.forms.map((form) => form.kind)
    expect(kinds).toContain(liveQuestionKind())
  })

  it.each([
    ["won", "screen-result"],
    ["lost", "screen-result"],
  ])("jumps to the %s screen", async (phase, screen) => {
    await bootWith(`?season=summer&phase=${phase}`)
    expect(isActive(screen)).toBe(true)
  })

  it("opens every season when asked for nothing else", async () => {
    await bootWith("?debug=1")
    expect(isActive("screen-character")).toBe(true)
    expect(document.body.getAttribute("data-debug")).toBe("on")
  })

  it.each([
    ["an unknown season", "?season=monsoon"],
    ["an unknown character", "?character=dragon"],
    ["an unrelated param", "?utm_source=whatever"],
    ["nothing at all", ""],
  ])("stays out of the way for %s", async (_label, search) => {
    await bootWith(search)
    expect(document.body.hasAttribute("data-debug")).toBe(false)
  })
})

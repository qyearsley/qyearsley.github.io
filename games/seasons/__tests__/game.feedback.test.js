/**
 * What the player sees between answering and the next question: the crossing,
 * the verdict line, what a wrong answer costs, and the clock.
 */

import { describe, expect, it, jest } from "@jest/globals"
import { getCharacter } from "../js/characters.js"
import { PHASE, WRONG_ANSWER } from "../js/constants.js"
import { hudCount, many, one, useRules } from "./helpers.js"
import {
  SPRING,
  SUMMER,
  TITLE,
  FLASH_MS,
  isCrossing,
  finishCrossing,
  settleCrossing,
  watchCrossings,
  byId,
  isActive,
  choices,
  feedback,
  earnedPips,
  trailSpace,
  spaceFacing,
  ordinarySpace,
  saved,
  liveQuestion,
  correctIndex,
  pressKey,
  choiceKey,
  tapRight,
  tapWrong,
  answerCorrectly,
  answerWrongly,
  bootInto,
  TIMED,
  setupGameHarness,
} from "./game-harness.js"

setupGameHarness()

// Every space is an obstacle, and a correct answer is what gets the character
// over the one in its way. The crossing sits between the answer and the next
// question -- the only asynchronous step in the cycle -- so it has its own block.
describe("crossing the obstacle in the way", () => {
  it("crosses the obstacle it was standing at, not the one it lands in front of", async () => {
    // A mountain on purpose. It is the only hard kind, so it is also the glowing
    // space, and it is where crossing the arrival obstacle instead of the
    // departure one would look most plausible.
    const mountain = spaceFacing(SPRING, "mountain")
    // Which is the glowing space, by the same token: the mountain is the only
    // hard kind, so this case covers both at once.
    expect(SPRING.glowingAt).toContain(mountain)
    await bootInto({ position: mountain })
    const crossings = watchCrossings()

    await answerCorrectly()

    expect(crossings).toHaveBeenCalledTimes(1)
    expect(crossings).toHaveBeenCalledWith(mountain, "mountain")
    // Which `spaceFacing` guarantees is a different kind, so the assertion above
    // really did distinguish the two.
    expect(SPRING.route[mountain + 1]).not.toBe("mountain")
    expect(saved().run.position).toBe(mountain + 1)
    expect(trailSpace()).toEqual({ space: mountain + 2, of: SPRING.spaces })
  })

  // Pinned to the gentle rule so that "where it was" can be exact: the step-back
  // rule moves the token *backwards*, which is what "what a wrong answer costs"
  // covers. What matters here is that no rule crosses anything.
  describe("a wrong answer", () => {
    useRules({ wrongAnswer: WRONG_ANSWER.GENTLE })

    it("crosses nothing and leaves the character where it was", async () => {
      const start = ordinarySpace(SPRING)
      await bootInto({ position: start, items: 2, forgivenessLeft: 0 })
      const crossings = watchCrossings()

      answerWrongly()

      expect(crossings).not.toHaveBeenCalled()
      expect(isCrossing()).toBe(false)
      expect(saved().run.position).toBe(start)
      expect(trailSpace()).toEqual({ space: start + 1, of: SPRING.spaces })
      // And the next question is already up: there was nothing to wait for.
      expect(saved().run.questionsAsked).toBe(1)
      expect(choices().every((button) => button.getAttribute("aria-disabled") === null)).toBe(true)
    })
  })

  it("crosses nothing at the boss, where there is no obstacle past the last space", async () => {
    await bootInto({ phase: PHASE.BOSS, position: SPRING.spaces, items: SPRING.demand })
    const crossings = watchCrossings()

    await answerCorrectly()

    expect(crossings).not.toHaveBeenCalled()
    expect(isCrossing()).toBe(false)
    expect(isActive("screen-result")).toBe(true)
    expect(byId("result-title").textContent).toBe(TITLE.seasonComplete(SPRING))
  })

  // The guard that matters most. `answering` covers the crossing as well as the
  // flash, so a child who taps while the character is in the air cannot score
  // against a question they have not been shown yet.
  it("holds both the next question and a second answer until the character lands", async () => {
    const start = ordinarySpace(SPRING)
    await bootInto({ position: start, items: 0 })
    const crossings = watchCrossings()

    tapRight()
    jest.advanceTimersByTime(FLASH_MS)
    await settleCrossing()

    expect(crossings).toHaveBeenCalledTimes(1)
    expect(isCrossing()).toBe(true)
    expect(choices().every((button) => button.getAttribute("aria-disabled") === "true")).toBe(true)

    // A tap mid-leap. The buttons are not `disabled`, so it really does reach
    // game.js -- the probe proves that rather than leaving the DOM to refuse it.
    const probe = jest.fn()
    choices()[0].addEventListener("click", probe)
    choices()[0].click()
    expect(probe).toHaveBeenCalledTimes(1)
    pressKey("a")
    await settleCrossing()

    expect(saved().run.questionsAsked).toBe(1)
    expect(saved().run.correctCount).toBe(1)
    expect(saved().run.items).toBe(1)
    expect(saved().totals.questionsAnswered).toBe(1)
    expect(hudCount()).toMatchObject({ items: 1 })

    finishCrossing()
    await settleCrossing()

    expect(isCrossing()).toBe(false)
    expect(choices().every((button) => button.getAttribute("aria-disabled") === null)).toBe(true)
    expect(trailSpace()).toEqual({ space: start + 2, of: SPRING.spaces })
  })

  // Anyone who taps faster than the animation should not have to wait for it.
  it("lands the character early when the page is tapped", async () => {
    const start = ordinarySpace(SPRING)
    await bootInto({ position: start, items: 0 })

    tapRight()
    jest.advanceTimersByTime(FLASH_MS)
    expect(isCrossing()).toBe(true)

    document.dispatchEvent(new Event("pointerdown"))
    await settleCrossing()

    // Unlocked buttons without `finishCrossing`: the tap, and nothing else,
    // ended the animation and released the next question.
    expect(isCrossing()).toBe(false)
    expect(choices().every((button) => button.getAttribute("aria-disabled") === null)).toBe(true)
    expect(trailSpace()).toEqual({ space: start + 2, of: SPRING.spaces })
  })

  // The flash used to be unskippable, so a tap only half worked: it cut the
  // crossing and then sat through the 900ms verdict anyway.
  it("cuts the flash short when the page is tapped after a right answer", async () => {
    const start = ordinarySpace(SPRING)
    await bootInto({ position: start, items: 0 })

    tapRight()
    expect(isCrossing()).toBe(false)

    // Nowhere near FLASH_MS: without the tap nothing would have moved yet.
    jest.advanceTimersByTime(100)
    document.dispatchEvent(new Event("pointerdown"))

    expect(isCrossing()).toBe(true)
  })

  // The other half of the rule. A wrong answer's flash is carrying the line
  // that says what the answer actually was, so hurrying past it would skip the
  // only part of the loop that teaches.
  it("holds the full flash after a wrong answer, however fast she taps", async () => {
    const start = ordinarySpace(SPRING)
    await bootInto({ position: start, items: 0 })

    tapWrong()
    jest.advanceTimersByTime(100)
    document.dispatchEvent(new Event("pointerdown"))

    // Still locked: the verdict is still on screen.
    expect(choices().some((button) => button.getAttribute("aria-disabled") === "true")).toBe(true)

    jest.advanceTimersByTime(FLASH_MS)
    expect(choices().every((button) => button.getAttribute("aria-disabled") === null)).toBe(true)
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
    await bootInto({ characterId: "banana-slug", seasonId: "summer", position: 1 }, TIMED)
    const answer = liveQuestion().answer
    expect(byId("timer").textContent).toBe(String(SUMMER.timerSeconds))

    jest.advanceTimersByTime(SUMMER.timerSeconds * 1000)

    expect(feedback()).toBe(`Time ran out! The answer was ${answer}.`)
    expect(saved().run.questionsAsked).toBe(1)
    expect(saved().run.correctCount).toBe(0)
  })

  it("is cleared again when the next question arrives", async () => {
    await bootInto({ position: 0, items: 0 })
    await answerCorrectly()
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

      await answerCorrectly()
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
      // The drawn trail has to agree with the save. `_onAnswer` used to redraw
      // only the HUD, so the token stayed a space ahead of where the player
      // actually was -- visible only under this rule, since it is the one that
      // moves you backwards.
      expect(trailSpace()).toMatchObject({ space: 2 })
    })
  })
})

// The countdown is optional because a clock is the part of this game a nervous
// player finds hardest, and three of the four seasons have one. The setting has
// to survive a reload and a "start over", and it has to take effect on the
// question already on screen -- a player who turns it off is looking at a
// question that is counting down while she does it.
describe("the countdown setting", () => {
  const modal = () => byId("settings-modal")
  const isOpen = () => modal().classList.contains("hidden") === false
  const timerBox = () => byId("setting-timer")
  const clockShowing = () => byId("timer-wrap").classList.contains("hidden") === false

  /** Open settings, set the box, and close again -- what a player does. */
  function setCountdown(on) {
    byId("settings-button").click()
    timerBox().checked = on
    timerBox().dispatchEvent(new Event("change"))
    byId("close-settings").click()
  }

  /** A timed season, part-way along, so there is a clock to look at. */
  const bootIntoSummer = (save = TIMED) =>
    bootInto({ characterId: "banana-slug", seasonId: "summer", position: 1 }, save)

  it("defaults to off, so a player who never opens settings is never raced", async () => {
    await bootIntoSummer({})
    expect(timerBox().checked).toBe(false)
    expect(clockShowing()).toBe(false)
    // The clock is not merely hidden -- the question does not expire.
    jest.advanceTimersByTime(SUMMER.timerSeconds * 3000)
    expect(feedback()).toBe("")
    // A save written before this key existed has no `settings` at all --
    // `bootIntoSummer({})` seeds exactly that -- and the first write fills it in.
    await answerCorrectly()
    expect(saved().settings).toEqual({ timer: false })
  })

  // The other half of the default: a save from before the flip that had ticked
  // the box carries a literal `true`, so it keeps its clock.
  it("is on for a save that had asked for it", async () => {
    await bootIntoSummer()
    expect(timerBox().checked).toBe(true)
    expect(clockShowing()).toBe(true)
    expect(byId("timer").textContent).toBe(String(SUMMER.timerSeconds))
  })

  it("opening settings stops the clock, so a question cannot expire behind it", async () => {
    await bootIntoSummer()
    byId("settings-button").click()
    expect(isOpen()).toBe(true)

    jest.advanceTimersByTime(SUMMER.timerSeconds * 2000)

    expect(feedback()).toBe("")
    expect(saved().run.questionsAsked).toBe(0)
  })

  it("closing it hands the question back with a full clock, not the remainder", async () => {
    await bootIntoSummer()
    jest.advanceTimersByTime(10_000)
    expect(byId("timer").textContent).toBe(String(SUMMER.timerSeconds - 10))

    byId("settings-button").click()
    byId("close-settings").click()

    expect(isOpen()).toBe(false)
    expect(byId("timer").textContent).toBe(String(SUMMER.timerSeconds))
  })

  it("turning it off takes the clock off the question already on screen", async () => {
    await bootIntoSummer()
    setCountdown(false)

    expect(saved().settings).toEqual({ timer: false })
    expect(clockShowing()).toBe(false)
    jest.advanceTimersByTime(SUMMER.timerSeconds * 3000)
    expect(feedback()).toBe("")
    expect(saved().run.questionsAsked).toBe(0)
  })

  it("stays off across a reload, and leaves a timed season untimed", async () => {
    await bootIntoSummer({ settings: { timer: false } })
    expect(clockShowing()).toBe(false)
    expect(timerBox().checked).toBe(false)

    // The same question, answered correctly, with no clock to beat.
    jest.advanceTimersByTime(120_000)
    expect(saved().run.questionsAsked).toBe(0)
    await answerCorrectly()
    expect(saved().run.correctCount).toBe(1)
    expect(clockShowing()).toBe(false)
  })

  it("turning it back on restarts the clock", async () => {
    await bootIntoSummer({ settings: { timer: false } })
    setCountdown(true)

    expect(saved().settings).toEqual({ timer: true })
    expect(clockShowing()).toBe(true)
    expect(byId("timer").textContent).toBe(String(SUMMER.timerSeconds))
  })

  it("does not invent a clock for a season that never had one", async () => {
    await bootInto({ seasonId: "spring", position: 1 })
    setCountdown(true)
    expect(clockShowing()).toBe(false)
  })

  // The perk applies to the clock the setting turns on, not to some other clock.
  // Moved here from "playing a season to the end", which reaches summer on a
  // fresh save and so no longer has a countdown to measure.
  it("adds the sloth's ten seconds to the season's own allowance", async () => {
    await bootInto({ characterId: "sloth", seasonId: "summer", position: 1 }, TIMED)
    expect(clockShowing()).toBe(true)
    expect(byId("timer").textContent).toBe(String(SUMMER.timerSeconds + 10))
  })

  it("Escape closes the dialog", async () => {
    await bootIntoSummer()
    byId("settings-button").click()
    expect(isOpen()).toBe(true)
    pressKey("Escape")
    expect(isOpen()).toBe(false)
  })

  // The help overlay is drawn on top of the dialog and `shared/nav.js` does not
  // stop propagation, so one Escape used to dismiss both -- and restart the
  // question's full countdown while the shortcut list was still being read.
  it("leaves the dialog alone when Escape is closing the help overlay", async () => {
    await bootIntoSummer()
    byId("settings-button").click()
    window.__helpOverlayIsOpen = () => true

    pressKey("Escape")

    expect(isOpen()).toBe(true)
    delete window.__helpOverlayIsOpen
  })

  it("closes on the next Escape, once the overlay has gone", async () => {
    await bootIntoSummer()
    byId("settings-button").click()
    window.__helpOverlayIsOpen = () => true
    pressKey("Escape")

    window.__helpOverlayIsOpen = () => false
    pressKey("Escape")

    expect(isOpen()).toBe(false)
    delete window.__helpOverlayIsOpen
  })

  // The dialog covers the answer buttons, so a letter aimed at it must not
  // answer the question underneath.
  it("swallows the answer keys while it is open", async () => {
    await bootIntoSummer()
    byId("settings-button").click()
    pressKey(choiceKey(correctIndex()))
    expect(saved().run.questionsAsked).toBe(0)
    expect(isOpen()).toBe(true)
  })

  // The flash keeps running while the dialog is open, so an answer that ended
  // the season resolves behind it. Drawing the result screen is fine; pulling
  // focus onto its heading, out of an aria-modal dialog, is not.
  it("keeps focus inside the dialog when the season resolves behind it", async () => {
    // At the boss, with the demand already met, so the next answer ends spring.
    await bootInto({ seasonId: "spring", position: SPRING.spaces, items: SPRING.demand })
    expect(byId("question-tag").textContent).toContain("snake woman")

    // Answer, then open settings inside the 900ms flash -- before `advance()`
    // has run, which is what puts the result screen up behind the dialog.
    tapRight()
    byId("settings-button").click()
    expect(isOpen()).toBe(true)

    jest.advanceTimersByTime(FLASH_MS)
    await settleCrossing()

    expect(isActive("screen-result")).toBe(true)
    expect(modal().contains(document.activeElement)).toBe(true)
  })

  it("survives 'start over', which erases the journey and not the preference", async () => {
    await bootIntoSummer()
    setCountdown(false)
    jest.spyOn(window, "confirm").mockReturnValue(true)

    byId("restart").click()

    expect(isActive("screen-character")).toBe(true)
    expect(saved().run.seasonId).toBeNull()
    expect(saved().totals.questionsAnswered).toBe(0)
    expect(saved().settings).toEqual({ timer: false })
  })
})

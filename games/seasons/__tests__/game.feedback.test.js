/**
 * What the player sees between answering and the next question: the crossing,
 * the verdict line, what a wrong answer costs, and the clock.
 */

import { describe, expect, it, jest } from "@jest/globals"
import { getCharacter } from "../js/characters.js"
import { HINT_CHOICES_LEFT, PHASE, PLAY } from "../js/constants.js"
import { hudCount, one } from "./helpers.js"
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
  dismissReinforcement,
  landAnswer,
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

  it("crosses nothing on a wrong answer and leaves the character where it was", async () => {
    const start = ordinarySpace(SPRING)
    await bootInto({ position: start, items: 2 })
    const crossings = watchCrossings()

    tapWrong()

    expect(crossings).not.toHaveBeenCalled()
    expect(isCrossing()).toBe(false)
    expect(saved().run.position).toBe(start)
    expect(trailSpace()).toEqual({ space: start + 1, of: SPRING.spaces })
    // And the same question is still up, with every choice but the one just
    // struck off still live: there is nothing to wait for on this path.
    expect(saved().run.retrying).toBe(true)
    expect(choices().filter((button) => !button.classList.contains("is-out"))).toHaveLength(3)
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

  // A wrong answer used to hold the page for the full flash, because the flash
  // was carrying the line that said what the answer had been. Since 2026-09-21 it
  // says no such thing: the choice is struck off, the guard comes straight back
  // off, and the question is hers again with no wait at all. What used to be
  // asserted here is now "strikes the choice off and leaves the rest live".
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

  it("the boss question names what it rescued", async () => {
    await bootInto({
      phase: PHASE.BOSS,
      position: SPRING.spaces,
      items: SPRING.demand - SPRING.boss.rescue,
    })
    tapRight()
    expect(feedback()).toBe(`Yes! That is ${SPRING.boss.rescue} more for the potion.`)
  })

  // The rule Ella asked for, and the assertion that holds it: the answer is
  // **not** stated. She has to find it herself, and the reinforcement card
  // afterwards is where the fact gets taught. Saying it here would skip both.
  it("a miss does not give the answer away", async () => {
    await bootInto({ position: 0, items: 0 })
    const answer = tapWrong()
    expect(feedback()).toBe("Not quite — have another look.")
    expect(feedback()).not.toContain(String(answer))
    expect(byId("feedback").classList.contains("error")).toBe(true)
  })

  it("the extra question says the way on is clear once it is answered", async () => {
    await bootInto({ position: 1, items: 1 })
    tapWrong()
    jest.advanceTimersByTime(FLASH_MS)
    tapRight()
    jest.advanceTimersByTime(FLASH_MS)
    dismissReinforcement()
    expect(saved().run.owed).toBe(0)
    expect(saved().run.extrasDone).toBe(1)

    tapRight()
    expect(feedback()).toBe(`+1 ${one(SPRING)}`)
  })

  it("the phoenix's hint names the perk that fired it", async () => {
    await bootInto({ characterId: "phoenix", position: 1, items: 1 })
    tapWrong()
    expect(feedback()).toBe(`${getCharacter("phoenix").perkName} — two of them are gone!`)
    expect(saved().run.hintsLeft).toBe(0)
  })

  // Regression test for the audit's bug A. `hintTargets` used to be worked out
  // by game.js before the pressed button was struck off, so it saw all four
  // choices live and could remove a full two more wrong ones on top of the one
  // she just pressed -- leaving nothing standing but the answer, for whichever
  // wrong choice was not among the two it happened to pick. `tapWrong` always
  // reaches for the same choice, which is why this presses every wrong one in
  // turn, on a fresh run each time, rather than relying on that helper.
  it("the phoenix's hint always leaves exactly HINT_CHOICES_LEFT choices standing, whichever wrong one she presses", async () => {
    for (let index = 0; index < PLAY.CHOICE_COUNT; index += 1) {
      await bootInto({ characterId: "phoenix", position: 1, items: 1 })
      if (index === correctIndex()) continue
      choices()[index].click()
      const live = choices().filter((button) => !button.classList.contains("is-out"))
      expect(live).toHaveLength(HINT_CHOICES_LEFT)
    }
  })

  // Running out of time is its own branch, and it has to say that the clock is
  // gone as well as that it ran out -- the retry is deliberately untimed.
  it("a timeout says so, and promises the clock is off", async () => {
    await bootInto({ characterId: "porcupine", seasonId: "summer", position: 1 }, TIMED)
    const answer = liveQuestion().answer
    expect(byId("timer").textContent).toBe(String(SUMMER.timerSeconds))

    jest.advanceTimersByTime(SUMMER.timerSeconds * 1000)

    expect(feedback()).toBe("Time ran out. Take as long as you like now.")
    expect(feedback()).not.toContain(String(answer))
    expect(saved().run.questionsAsked).toBe(1)
    expect(saved().run.correctCount).toBe(0)
  })

  it("is cleared again when the next question arrives", async () => {
    await bootInto({ position: 0, items: 0 })
    await answerCorrectly()
    expect(feedback()).toBe("")
  })

  // One branch of `_feedbackFor` has no case here: the bare "Right!" for a
  // correct answer that gained nothing outside the extra-question path. It
  // needs a boss whose `rescue` is 0, and no shipped season has one -- the
  // smallest is spring's 3. So the line is unreachable through the real game
  // today, and the only way to assert it would be to invent content the player
  // cannot meet.
})

// The retry rule end to end: what the screen and the save do, not just what the
// verdict line says. GameState.test.js proves the arithmetic; these prove the
// two agree with it.
describe("what a wrong answer costs", () => {
  it("takes nothing, moves nothing, and keeps the question up", async () => {
    await bootInto({ position: 2, items: 2 })
    const question = byId("question-prompt").textContent
    tapWrong()

    expect(hudCount()).toMatchObject({ items: 2 })
    expect(earnedPips()).toBe(2)
    expect(saved().run.items).toBe(2)
    expect(saved().run.position).toBe(2)
    // The same question, not a fresh one: she has to find the answer she missed.
    expect(byId("question-prompt").textContent).toBe(question)
    expect(saved().run.retrying).toBe(true)
    expect(isActive("screen-play")).toBe(true)
  })

  it("strikes the choice off and leaves the rest live, with no flash to wait out", async () => {
    await bootInto({ position: 2, items: 2 })
    const pressed = choices()[correctIndex() === 0 ? 1 : 0]
    pressed.click()

    expect(pressed.classList.contains("is-out")).toBe(true)
    expect(pressed.getAttribute("aria-disabled")).toBe("true")
    const live = choices().filter((button) => !button.classList.contains("is-out"))
    expect(live).toHaveLength(3)
    for (const button of live) expect(button.getAttribute("aria-disabled")).toBeNull()
    // Nothing is marked correct: the answer is not given away.
    expect(choices().some((button) => button.classList.contains("is-correct"))).toBe(false)
  })

  it("ignores a second tap on a choice already struck off", async () => {
    await bootInto({ position: 2, items: 2 })
    const pressed = choices()[correctIndex() === 0 ? 1 : 0]
    pressed.click()
    expect(saved().run.questionsAsked).toBe(1)
    pressed.click()
    pressed.click()
    expect(saved().run.questionsAsked).toBe(1)
  })

  it("owes one more question before the item is paid", async () => {
    const start = ordinarySpace(SPRING)
    await bootInto({ position: start, items: 2 })
    tapWrong()
    jest.advanceTimersByTime(FLASH_MS)

    // Right at last: no item yet, and the card comes up.
    tapRight()
    jest.advanceTimersByTime(FLASH_MS)
    dismissReinforcement()
    expect(saved().run.items).toBe(2)
    expect(saved().run.position).toBe(start)

    // The extra question pays out and moves her on.
    await answerCorrectly()
    expect(saved().run.items).toBe(3)
    expect(saved().run.position).toBe(start + 1)
  })

  it("lets the porcupine go straight on without the extra question", async () => {
    const start = ordinarySpace(SPRING)
    await bootInto({ characterId: "porcupine", position: start, items: 2 })
    tapWrong()
    jest.advanceTimersByTime(FLASH_MS)
    expect(saved().run.owed).toBe(0)

    tapRight()
    jest.advanceTimersByTime(FLASH_MS)
    dismissReinforcement()
    await settleCrossing()
    expect(saved().run.items).toBe(3)
    expect(saved().run.position).toBe(start + 1)
  })

  it("takes the clock off a question being retried", async () => {
    // The hole the retry rule would otherwise open: a timeout is a wrong
    // answer, and a wrong answer keeps the question -- so a clock on the retry
    // would time the same question out again, forever, for the child who could
    // not answer it.
    await bootInto({ characterId: "porcupine", seasonId: "summer", position: 1 }, TIMED)
    expect(byId("timer-wrap").classList.contains("hidden")).toBe(false)

    tapWrong()

    expect(byId("timer-wrap").classList.contains("hidden")).toBe(true)
    // And it stays off however long she takes.
    jest.advanceTimersByTime(SUMMER.timerSeconds * 3000)
    expect(isActive("screen-play")).toBe(true)
    expect(saved().run.questionsAsked).toBe(1)
  })
})

// The card is the only teaching the loop does now that a miss no longer states
// the answer, and the only screen in the game with no clock on it.
describe("the reinforcement card", () => {
  it("comes up once a missed question is finally answered right", async () => {
    await bootInto({ position: 1, items: 1 })
    const question = byId("question-prompt").textContent
    const answer = liveQuestion().answer

    tapWrong()
    jest.advanceTimersByTime(FLASH_MS)
    expect(byId("reinforce-card").classList.contains("hidden")).toBe(true)

    tapRight()
    jest.advanceTimersByTime(FLASH_MS)

    expect(byId("reinforce-card").classList.contains("hidden")).toBe(false)
    expect(byId("reinforce-equation").textContent).toBe(`${question} = ${answer}`)
  })

  it("does not come up for a question answered right first time", async () => {
    await bootInto({ position: 1, items: 1 })
    tapRight()
    jest.advanceTimersByTime(FLASH_MS)
    expect(byId("reinforce-card").classList.contains("hidden")).toBe(true)
  })

  it("waits for the button and holds the next question behind it", async () => {
    const start = ordinarySpace(SPRING)
    await bootInto({ position: start, items: 1 })
    const question = byId("question-prompt").textContent
    tapWrong()
    jest.advanceTimersByTime(FLASH_MS)
    tapRight()
    jest.advanceTimersByTime(FLASH_MS)

    // No timer takes it away, however long she reads it for.
    jest.advanceTimersByTime(60_000)
    expect(byId("reinforce-card").classList.contains("hidden")).toBe(false)
    expect(byId("question-prompt").textContent).toBe(question)

    dismissReinforcement()
    expect(byId("reinforce-card").classList.contains("hidden")).toBe(true)
    expect(byId("question-prompt").textContent).not.toBe(question)
  })

  it("swallows the answer keys while it is up", async () => {
    await bootInto({ position: 1, items: 1 })
    tapWrong()
    jest.advanceTimersByTime(FLASH_MS)
    tapRight()
    jest.advanceTimersByTime(FLASH_MS)
    const asked = saved().run.questionsAsked

    pressKey("a")
    pressKey("b")

    expect(saved().run.questionsAsked).toBe(asked)
  })

  it("draws a dot array for a times fact", async () => {
    // Spring's ordinary spaces include `mul` with small tables, so a seeded run
    // reaches one. Which model appears is the challenge module's call; what is
    // asserted here is that GameUI draws whatever it was handed.
    await bootInto({ position: 1, items: 1 })
    tapWrong()
    jest.advanceTimersByTime(FLASH_MS)
    tapRight()
    jest.advanceTimersByTime(FLASH_MS)

    const picture = byId("reinforce-picture")
    expect(picture.querySelectorAll(".dot").length).toBeGreaterThan(0)
  })

  it("goes away when the journey is thrown out from under it", async () => {
    // It waits for a tap rather than a timer, so a restart while it is up would
    // otherwise leave it covering the character screen with a "Got it" button
    // wired to a run that no longer exists.
    await bootInto({ position: 1, items: 1 })
    tapWrong()
    jest.advanceTimersByTime(FLASH_MS)
    tapRight()
    jest.advanceTimersByTime(FLASH_MS)
    expect(byId("reinforce-card").classList.contains("hidden")).toBe(false)

    window.confirm = () => true
    byId("restart").click()

    expect(byId("reinforce-card").classList.contains("hidden")).toBe(true)
    expect(isActive("screen-character")).toBe(true)
  })

  // Regression test for the audit's bug B. The "Got it" button is focused when
  // the card opens; its onclick only hides the card, and nothing ever sent
  // focus anywhere afterwards. jsdom does not blur an element for merely being
  // `display: none` -- real browsers do -- so the meaningful half of this
  // assertion is the positive one: focus has to land explicitly on the next
  // question's first choice, not just "somewhere that is not <body>".
  it("moves focus onto the next question rather than dropping it", async () => {
    await bootInto({ position: 1, items: 1 })
    tapWrong()
    tapRight()
    await landAnswer()

    expect(document.activeElement).toBe(choices()[0])
    expect(document.activeElement).not.toBe(document.body)
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

  /**
   * A timed season, part-way along, so there is a clock to look at.
   *
   * The Porcupine on purpose: her perk is about the extra question and touches
   * no clock. The Banana Slug used to serve here and cannot any more -- since
   * 2026-09-21 she has no countdown at all, whatever the setting says.
   */
  const bootIntoSummer = (save = TIMED) =>
    bootInto({ characterId: "porcupine", seasonId: "summer", position: 1 }, save)

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

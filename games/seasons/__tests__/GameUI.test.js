/**
 * Tests for the Seasons rendering layer.
 *
 * The fixture is the real `games/seasons/index.html`, read from disk and
 * assigned to `document.body.innerHTML`. A hand-written fixture drifts the
 * moment an id is renamed, and then every test here passes while the page
 * renders blank in a browser -- which is the failure these tests exist to catch.
 * Assigning to `innerHTML` does not run scripts, so the page's
 * `<script type="module">` is inert.
 *
 * Two pieces of setup are worth knowing about:
 *
 * - jsdom implements no SVG geometry, so `SVGPathElement.getTotalLength` does
 *   not exist. `GameUI._pointsAlong` has a documented fallback for exactly this,
 *   spreading the markers along a straight line. The trail tests therefore
 *   assert structure and finite coordinates rather than specific positions --
 *   the numbers are jsdom's, but the shape of the output is the real thing.
 * - The countdown runs on `setInterval`, so its group uses fake timers. Every
 *   other group uses real ones, because `shakeElement`'s stray timeout is
 *   harmless and faking time globally would hide it.
 *
 * The security group is the practical version of the "nothing here uses
 * innerHTML" claim in GameUI's header: every string the class writes is fed an
 * `<script>` payload, and the assertion is that it comes back as text and no
 * element was ever created.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { CHARACTERS } from "../js/characters.js"
import { PLAY } from "../js/constants.js"
import { GameUI } from "../js/GameUI.js"
import { buildTrail } from "../js/Journey.js"
import { getSeason } from "../js/seasons.js"

const HERE = dirname(fileURLToPath(import.meta.url))
const INDEX_HTML = readFileSync(join(HERE, "..", "index.html"), "utf-8")
const BODY = INDEX_HTML.replace(/[\s\S]*<body[^>]*>/i, "").replace(/<\/body>[\s\S]*/i, "")

const SPRING = getSeason("spring")
const WINTER = getSeason("winter")

/** A payload that becomes two elements if anything writes it as markup. */
const XSS = '<script>window.pwned = true</script><img src=x onerror="window.pwned = true">'

/** @type {GameUI} */
let ui

/**
 * A HUD-shaped state. Only the fields renderHud reads.
 * @param {Object} [overrides] - Fields to replace
 * @returns {Object} A state-shaped object
 */
function hudState(overrides = {}) {
  return { items: 0, wilting: 0, forgivenessLeft: 0, characterId: "banana-slug", ...overrides }
}

/**
 * A state carrying a question. Only the fields renderQuestion reads.
 * @param {Object} [overrides] - Fields to replace on the question
 * @returns {Object} A state-shaped object
 */
function questionState(overrides = {}) {
  return {
    question: {
      kind: "add",
      prompt: "27 + 46",
      answer: 73,
      choices: [73, 72, 74, 83],
      ...overrides,
    },
  }
}

/**
 * A result-shaped state. Only the fields renderResult reads.
 * @param {Object} [overrides] - Fields to replace
 * @returns {Object} A state-shaped object
 */
function resultState(overrides = {}) {
  return { items: 11, correctCount: 12, questionsAsked: 15, bestStreak: 6, lost: 0, ...overrides }
}

/**
 * The `translate(x y)` an element was positioned with.
 * @param {Element} element - A node carrying a transform
 * @returns {number[]} [x, y]
 */
function translateOf(element) {
  const match = /translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)\s*\)/.exec(
    element.getAttribute("transform") ?? "",
  )
  expect(match).not.toBeNull()
  return [Number(match[1]), Number(match[2])]
}

/** The answer buttons currently on screen. */
const choiceButtons = () => Array.from(document.querySelectorAll("#choices button"))

beforeEach(() => {
  document.body.innerHTML = BODY
  document.body.className = ""
  ui = new GameUI()
})

describe("the fixture", () => {
  it.each([
    "character-grid",
    "season-name",
    "demand-line",
    "villain-portrait",
    "item-count",
    "item-demand",
    "item-label",
    "wilt-note",
    "perk-note",
    "trail",
    "question-prompt",
    "question-tag",
    "choices",
    "timer",
    "timer-bar",
    "feedback",
    "result-title",
    "result-text",
    "result-summary",
    "result-actions",
    "screen-character",
    "screen-play",
    "screen-result",
    "restart",
  ])("index.html contains #%s exactly once", (id) => {
    expect(document.getElementById(id)).not.toBeNull()
    expect(document.querySelectorAll(`#${id}`)).toHaveLength(1)
  })

  it("the constructor caches every id it names to a real node", () => {
    for (const [id, node] of Object.entries(ui.elements)) {
      expect(node).toBe(document.getElementById(id))
      expect(node).not.toBeNull()
    }
  })

  it("constructing writes nothing to the page", () => {
    document.body.innerHTML = BODY
    const before = document.body.innerHTML
    new GameUI()
    expect(document.body.innerHTML).toBe(before)
  })
})

describe("renderCharacterCards", () => {
  it("draws one button per character, with its name and both perk lines", () => {
    ui.renderCharacterCards("sloth", () => {})
    const cards = Array.from(document.querySelectorAll("#character-grid .character-card"))
    expect(cards).toHaveLength(CHARACTERS.length)

    cards.forEach((card, index) => {
      const entry = CHARACTERS[index]
      expect(card.type).toBe("button")
      expect(card.dataset.characterId).toBe(entry.id)
      expect(card.querySelector(".character-name").textContent).toBe(entry.name)
      expect(card.querySelector(".character-perk").textContent).toBe(entry.perkName)
      expect(card.querySelector(".character-perk-text").textContent).toBe(entry.perkText)
      expect(card.querySelector(".character-art svg")).not.toBeNull()
    })
  })

  it("shows the cost line only for a character that has one", () => {
    ui.renderCharacterCards("sloth", () => {})
    for (const entry of CHARACTERS) {
      const card = document.querySelector(`[data-character-id="${entry.id}"]`)
      const cost = card.querySelector(".character-cost")
      if (entry.costText) {
        expect(cost.textContent).toBe(entry.costText)
      } else {
        expect(cost).toBeNull()
      }
    }
  })

  it.each(CHARACTERS.map((entry) => entry.id))("marks %s pressed when it is selected", (id) => {
    ui.renderCharacterCards(id, () => {})
    const pressed = Array.from(document.querySelectorAll('[aria-pressed="true"]'))
    expect(pressed).toHaveLength(1)
    expect(pressed[0].dataset.characterId).toBe(id)
  })

  it("marks nothing pressed when nothing is selected", () => {
    ui.renderCharacterCards("", () => {})
    expect(document.querySelectorAll('#character-grid [aria-pressed="true"]')).toHaveLength(0)
    expect(document.querySelectorAll('#character-grid [aria-pressed="false"]')).toHaveLength(
      CHARACTERS.length,
    )
  })

  it("calls back with the id of the card that was tapped", () => {
    const onChoose = jest.fn()
    ui.renderCharacterCards("banana-slug", onChoose)
    document.querySelector('[data-character-id="porcupine"]').click()
    expect(onChoose).toHaveBeenCalledTimes(1)
    expect(onChoose).toHaveBeenCalledWith("porcupine")
  })

  it("rebuilds rather than appends", () => {
    ui.renderCharacterCards("sloth", () => {})
    ui.renderCharacterCards("phoenix", () => {})
    expect(document.querySelectorAll("#character-grid .character-card")).toHaveLength(
      CHARACTERS.length,
    )
    expect(document.querySelectorAll('#character-grid [aria-pressed="true"]')).toHaveLength(1)
  })
})

describe("renderTrail", () => {
  it("does not throw under jsdom, which implements no SVG geometry", () => {
    expect(
      typeof document.createElementNS("http://www.w3.org/2000/svg", "path").getTotalLength,
    ).toBe("undefined")
    expect(() => ui.renderTrail(SPRING, 0, "sloth")).not.toThrow()
    expect(document.querySelector("#trail svg.trail-svg")).not.toBeNull()
  })

  it.each([
    ["spring", SPRING],
    ["winter", WINTER],
  ])("draws one marker per space for %s", (_id, season) => {
    ui.renderTrail(season, 0, "sloth")
    expect(document.querySelectorAll("#trail .trail-marker")).toHaveLength(season.spaces)
    expect(buildTrail(season)).toHaveLength(season.spaces)
  })

  it("marks exactly the glowing spaces", () => {
    ui.renderTrail(SPRING, 0, "sloth")
    const markers = Array.from(document.querySelectorAll("#trail .trail-marker"))
    const glowing = markers.flatMap((marker, index) =>
      marker.classList.contains("is-glowing") ? [index] : [],
    )
    expect(glowing).toEqual(SPRING.glowingAt)
    // A glowing marker also gets the two halo circles Ella asked for.
    expect(document.querySelectorAll("#trail .marker-glow")).toHaveLength(SPRING.glowingAt.length)
  })

  it.each([0, 1, 7, 14])("marks the %i spaces already walked as done", (position) => {
    ui.renderTrail(SPRING, position, "sloth")
    const markers = Array.from(document.querySelectorAll("#trail .trail-marker"))
    const done = markers.flatMap((marker, index) =>
      marker.classList.contains("is-done") ? [index] : [],
    )
    expect(done).toEqual(Array.from({ length: Math.min(position, SPRING.spaces) }, (_, i) => i))
  })

  it("includes a boss group and a character token", () => {
    ui.renderTrail(SPRING, 3, "phoenix")
    const boss = document.querySelector("#trail .trail-boss")
    const token = document.querySelector("#trail .trail-token")
    expect(boss).not.toBeNull()
    expect(token).not.toBeNull()
    expect(boss.childElementCount).toBeGreaterThan(0)
    expect(token.childElementCount).toBeGreaterThan(0)
    expect(boss.firstElementChild.getAttribute("transform")).toContain("scale")
    expect(token.firstElementChild.getAttribute("transform")).toContain("scale")
  })

  // The fallback's numbers are jsdom's, not the browser's. What matters is that
  // they are numbers: an NaN here puts every marker in the same corner.
  it("gives every marker, the boss, and the token finite coordinates", () => {
    ui.renderTrail(WINTER, 9, "porcupine")
    const positioned = Array.from(
      document.querySelectorAll("#trail .trail-marker, #trail .trail-boss, #trail .trail-token"),
    )
    expect(positioned).toHaveLength(WINTER.spaces + 2)
    for (const node of positioned) {
      const [x, y] = translateOf(node)
      expect(Number.isFinite(x)).toBe(true)
      expect(Number.isFinite(y)).toBe(true)
    }
  })

  it("sets the walked fraction the stylesheet animates", () => {
    ui.renderTrail(SPRING, 7, "sloth")
    const walked = document.querySelector("#trail .trail-walked")
    expect(walked.getAttribute("pathLength")).toBe("1")
    expect(Number(walked.style.getPropertyValue("--walked"))).toBeCloseTo(7 / SPRING.spaces)
  })

  it("labels the trail for a screen reader", () => {
    ui.renderTrail(SPRING, 4, "sloth")
    const canvas = document.querySelector("#trail svg.trail-svg")
    expect(canvas.getAttribute("role")).toBe("img")
    expect(canvas.getAttribute("aria-label")).toBe(`Spring trail, space 5 of ${SPRING.spaces}`)
  })

  it("rebuilds rather than appends", () => {
    ui.renderTrail(SPRING, 0, "sloth")
    ui.renderTrail(SPRING, 5, "sloth")
    expect(document.querySelectorAll("#trail svg")).toHaveLength(1)
    expect(document.querySelectorAll("#trail .trail-marker")).toHaveLength(SPRING.spaces)
    expect(document.querySelectorAll("#trail .trail-token")).toHaveLength(1)
  })

  it("draws nothing at all for a null season, rather than an empty frame", () => {
    ui.renderTrail(SPRING, 0, "sloth")
    expect(() => ui.renderTrail(null, 0, "sloth")).not.toThrow()
    // The previous trail is left alone: a missing season is a caller bug, and
    // wiping the screen would hide it behind a blank page.
    expect(document.querySelectorAll("#trail svg")).toHaveLength(1)
  })
})

describe("renderHud", () => {
  it("writes the season, the demand line, and the running count", () => {
    ui.renderHud(hudState({ items: 4 }), SPRING)
    expect(document.getElementById("season-name").textContent).toBe("Spring")
    expect(document.getElementById("demand-line").textContent).toBe(SPRING.demandText)
    expect(document.getElementById("item-count").textContent).toBe("4")
    expect(document.getElementById("item-demand").textContent).toBe(String(SPRING.demand))
    expect(document.querySelector("#villain-portrait svg")).not.toBeNull()
  })

  it.each([
    [0, "Roses"],
    [1, "Rose"],
    [2, "Roses"],
    [10, "Roses"],
  ])("labels %i items as %s", (items, label) => {
    ui.renderHud(hudState({ items }), SPRING)
    expect(document.getElementById("item-label").textContent).toBe(label)
  })

  it("shows the wilt note only when something is wilting", () => {
    const note = document.getElementById("wilt-note")
    ui.renderHud(hudState({ wilting: 0 }), SPRING)
    expect(note.classList.contains("hidden")).toBe(true)

    ui.renderHud(hudState({ items: 3, wilting: 1 }), SPRING)
    expect(note.classList.contains("hidden")).toBe(false)
    expect(note.textContent).toContain("1 rose wilting")

    ui.renderHud(hudState({ items: 3, wilting: 2 }), SPRING)
    expect(note.textContent).toContain("2 roses wilting")
    expect(note.textContent).toContain("bring them back")

    ui.renderHud(hudState({ wilting: 0 }), SPRING)
    expect(note.classList.contains("hidden")).toBe(true)
  })

  it("shows the perk note only while the perk is still in hand", () => {
    const note = document.getElementById("perk-note")
    ui.renderHud(hudState({ characterId: "phoenix", forgivenessLeft: 0 }), SPRING)
    expect(note.classList.contains("hidden")).toBe(true)

    ui.renderHud(hudState({ characterId: "phoenix", forgivenessLeft: 1 }), SPRING)
    expect(note.classList.contains("hidden")).toBe(false)
    expect(note.textContent).toBe("Rising Again: 1 left this season")

    ui.renderHud(hudState({ characterId: "phoenix", forgivenessLeft: 0 }), SPRING)
    expect(note.classList.contains("hidden")).toBe(true)
  })

  it("leaves the HUD untouched for a null season", () => {
    ui.renderHud(hudState({ items: 4 }), SPRING)
    ui.renderHud(hudState({ items: 9 }), null)
    expect(document.getElementById("item-count").textContent).toBe("4")
  })
})

describe("renderQuestion", () => {
  it("writes the prompt and one button per choice", () => {
    ui.renderQuestion(questionState(), false, false, () => {})
    expect(document.getElementById("question-prompt").textContent).toBe("27 + 46")
    const buttons = choiceButtons()
    expect(buttons).toHaveLength(PLAY.CHOICE_COUNT)
    expect(buttons.map((button) => button.textContent)).toEqual(["73", "72", "74", "83"])
    expect(buttons.map((button) => button.dataset.value)).toEqual(["73", "72", "74", "83"])
    for (const button of buttons) {
      expect(button.type).toBe("button")
      expect(button.disabled).toBe(false)
    }
  })

  it("renders no more than CHOICE_COUNT buttons even if the question offers more", () => {
    ui.renderQuestion(questionState({ choices: [1, 2, 3, 4, 5, 6] }), false, false, () => {})
    expect(choiceButtons()).toHaveLength(PLAY.CHOICE_COUNT)
  })

  it.each([
    [false, false, "", true],
    [true, false, "Glowing challenge", false],
    [false, true, "Boss challenge", false],
    [true, true, "Boss challenge", false],
  ])("glowing=%p boss=%p tags the question %p", (glowing, isBoss, tag, hidden) => {
    ui.renderQuestion(questionState(), glowing, isBoss, () => {})
    const element = document.getElementById("question-tag")
    expect(element.textContent).toBe(tag)
    expect(element.classList.contains("hidden")).toBe(hidden)
    expect(document.body.classList.contains("is-glowing-question")).toBe(glowing || isBoss)
  })

  it("clears the glowing class when an ordinary question follows a glowing one", () => {
    ui.renderQuestion(questionState(), true, false, () => {})
    expect(document.body.classList.contains("is-glowing-question")).toBe(true)
    ui.renderQuestion(questionState(), false, false, () => {})
    expect(document.body.classList.contains("is-glowing-question")).toBe(false)
  })

  it("calls back with the chosen value and the button that was pressed", () => {
    const onAnswer = jest.fn()
    ui.renderQuestion(questionState(), false, false, onAnswer)
    const buttons = choiceButtons()
    buttons[2].click()
    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer).toHaveBeenCalledWith(74, buttons[2])
  })

  it("rebuilds rather than appends", () => {
    ui.renderQuestion(questionState(), false, false, () => {})
    ui.renderQuestion(
      questionState({ prompt: "8 × 7", choices: [56, 54, 63, 48] }),
      false,
      false,
      () => {},
    )
    expect(choiceButtons()).toHaveLength(PLAY.CHOICE_COUNT)
    expect(document.getElementById("question-prompt").textContent).toBe("8 × 7")
  })

  it("draws nothing when there is no question", () => {
    ui.renderQuestion({ question: null }, false, false, () => {})
    expect(choiceButtons()).toHaveLength(0)
    expect(document.getElementById("question-prompt").textContent).toBe("")
    expect(() => ui.renderQuestion(null, false, false, () => {})).not.toThrow()
  })
})

describe("flashAnswer", () => {
  const correct = { correct: true }
  const wrong = { correct: false }

  beforeEach(() => {
    ui.renderQuestion(questionState(), false, false, () => {})
  })

  it("locks every button", () => {
    ui.flashAnswer(correct, choiceButtons()[0], 73, "Right!")
    expect(choiceButtons().every((button) => button.disabled)).toBe(true)
  })

  it("marks the correct button on a correct answer", () => {
    const buttons = choiceButtons()
    ui.flashAnswer(correct, buttons[0], 73, "Right!")
    expect(buttons[0].classList.contains("is-correct")).toBe(true)
    expect(document.querySelectorAll("#choices .is-wrong")).toHaveLength(0)
  })

  // Seeing the right answer is the only teaching this screen does, so it is
  // marked even -- especially -- when the player got it wrong.
  it("marks the correct button on a wrong answer too, and the pressed one wrong", () => {
    const buttons = choiceButtons()
    ui.flashAnswer(wrong, buttons[3], 73, "Not quite.")
    expect(buttons[0].classList.contains("is-correct")).toBe(true)
    expect(buttons[3].classList.contains("is-wrong")).toBe(true)
    expect(document.querySelectorAll("#choices .is-correct")).toHaveLength(1)
    expect(document.querySelectorAll("#choices .is-wrong")).toHaveLength(1)
  })

  it("marks nothing wrong on a timeout, where no button was pressed", () => {
    ui.flashAnswer(wrong, null, 73, "Time.")
    expect(document.querySelectorAll("#choices .is-correct")).toHaveLength(1)
    expect(document.querySelectorAll("#choices .is-wrong")).toHaveLength(0)
    expect(choiceButtons().every((button) => button.disabled)).toBe(true)
  })

  it("marks nothing correct when the correct value is not on screen", () => {
    ui.flashAnswer(wrong, choiceButtons()[1], 999, "Not quite.")
    expect(document.querySelectorAll("#choices .is-correct")).toHaveLength(0)
    expect(document.querySelectorAll("#choices .is-wrong")).toHaveLength(1)
  })

  // Regression test. BaseGameUI.showFeedback writes to a hard-coded
  // #feedback-area; this page's element is #feedback, so the inherited version
  // null-checked and silently dropped every verdict the game composed. GameUI
  // overrides both showFeedback and hideFeedback for exactly this reason.
  it("puts the message on screen through the override", () => {
    expect(document.getElementById("feedback-area")).toBeNull()
    ui.flashAnswer(correct, choiceButtons()[0], 73, "+1 rose")
    const feedback = document.getElementById("feedback")
    expect(feedback.textContent).toBe("+1 rose")
    expect(feedback.classList.contains("success")).toBe(true)
  })

  it("marks the verdict as an error when the answer was wrong", () => {
    ui.flashAnswer(wrong, choiceButtons()[1], 73, "Not quite.")
    const feedback = document.getElementById("feedback")
    expect(feedback.textContent).toBe("Not quite.")
    expect(feedback.classList.contains("error")).toBe(true)
  })

  it("clears the text rather than fading it, so aria-live stops announcing", () => {
    ui.flashAnswer(correct, choiceButtons()[0], 73, "+1 rose")
    ui.hideFeedback()
    const feedback = document.getElementById("feedback")
    expect(feedback.textContent).toBe("")
    // The base class sets opacity: 0 and leaves the text in place, which a
    // screen reader still reads out. This override must not do that.
    expect(feedback.style.opacity).toBe("")
  })

  it("the next question clears the marks and unlocks the buttons", () => {
    ui.flashAnswer(wrong, choiceButtons()[3], 73, "Not quite.")
    ui.renderQuestion(questionState(), false, false, () => {})
    expect(document.querySelectorAll("#choices .is-correct")).toHaveLength(0)
    expect(document.querySelectorAll("#choices .is-wrong")).toHaveLength(0)
    expect(choiceButtons().every((button) => button.disabled === false)).toBe(true)
  })

  it("survives being called with no question on screen", () => {
    document.getElementById("choices").replaceChildren()
    expect(() => ui.flashAnswer(wrong, null, 73, "x")).not.toThrow()
  })
})

describe("the countdown", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    ui.stopTimer()
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  it.each([[null], [0], [undefined]])(
    "startTimer(%p) hides the clock and never fires",
    (seconds) => {
      const onExpire = jest.fn()
      ui.startTimer(seconds, onExpire)
      // The whole wrapper must go, not just the number. Hiding #timer alone
      // left the bar on screen at full width, reading as a clock stuck at 100%
      // through the whole of untimed spring.
      expect(document.getElementById("timer-wrap").classList.contains("hidden")).toBe(true)
      jest.advanceTimersByTime(120_000)
      expect(onExpire).not.toHaveBeenCalled()
    },
  )

  it("shows the clock and paints the starting value for a timed question", () => {
    ui.startTimer(5, jest.fn())
    expect(document.getElementById("timer-wrap").classList.contains("hidden")).toBe(false)
    expect(document.getElementById("timer").textContent).toBe("5")
    expect(document.getElementById("timer-bar").style.width).toBe("100%")
  })

  it("fires after the full five seconds and not a tick before", () => {
    const onExpire = jest.fn()
    ui.startTimer(5, onExpire)
    jest.advanceTimersByTime(4_900)
    expect(onExpire).not.toHaveBeenCalled()
    jest.advanceTimersByTime(100)
    expect(onExpire).toHaveBeenCalledTimes(1)
    expect(document.getElementById("timer").textContent).toBe("0")
    expect(document.getElementById("timer-bar").style.width).toBe("0%")
  })

  it("counts down as it goes and flags the last quarter", () => {
    ui.startTimer(4, jest.fn())
    jest.advanceTimersByTime(1_000)
    expect(document.getElementById("timer").textContent).toBe("3")
    expect(document.getElementById("timer-bar").classList.contains("is-low")).toBe(false)
    jest.advanceTimersByTime(2_100)
    expect(document.getElementById("timer-bar").classList.contains("is-low")).toBe(true)
  })

  it("fires exactly once, not once per tick", () => {
    const onExpire = jest.fn()
    ui.startTimer(2, onExpire)
    jest.advanceTimersByTime(30_000)
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it("stopTimer prevents it firing, and is safe when nothing is running", () => {
    const onExpire = jest.fn()
    expect(() => ui.stopTimer()).not.toThrow()
    ui.startTimer(5, onExpire)
    jest.advanceTimersByTime(2_000)
    ui.stopTimer()
    jest.advanceTimersByTime(30_000)
    expect(onExpire).not.toHaveBeenCalled()
    expect(() => ui.stopTimer()).not.toThrow()
  })

  // Two intervals ticking at once is the bug that makes a question expire in
  // half the advertised time, so the second call must replace the first.
  it("a second startTimer replaces the first rather than running both", () => {
    const first = jest.fn()
    const second = jest.fn()
    ui.startTimer(5, first)
    jest.advanceTimersByTime(3_000)
    ui.startTimer(5, second)

    jest.advanceTimersByTime(4_900)
    expect(first).not.toHaveBeenCalled()
    expect(second).not.toHaveBeenCalled()

    jest.advanceTimersByTime(100)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)

    jest.advanceTimersByTime(30_000)
    expect(second).toHaveBeenCalledTimes(1)
  })

  it("switching to an untimed season stops the clock that was running", () => {
    const onExpire = jest.fn()
    ui.startTimer(5, onExpire)
    jest.advanceTimersByTime(1_000)
    ui.startTimer(null, jest.fn())
    jest.advanceTimersByTime(30_000)
    expect(onExpire).not.toHaveBeenCalled()
  })

  it("flashDuration is a positive number game.js can schedule against", () => {
    expect(typeof ui.flashDuration).toBe("number")
    expect(ui.flashDuration).toBeGreaterThan(0)
  })
})

describe("renderResult", () => {
  const actions = () => [
    { label: "On to Summer", onClick: jest.fn(), primary: true },
    { label: "Pick a new character", onClick: jest.fn() },
  ]

  it("writes the title and the verdict", () => {
    ui.renderResult(resultState(), SPRING, [], "Spring complete", "She takes them.")
    expect(document.getElementById("result-title").textContent).toBe("Spring complete")
    expect(document.getElementById("result-text").textContent).toBe("She takes them.")
  })

  it("builds the four summary rows, each a label and a value", () => {
    ui.renderResult(resultState(), SPRING, [], "t", "x")
    const rows = Array.from(document.querySelectorAll("#result-summary .summary-row"))
    expect(rows).toHaveLength(4)
    expect(
      rows.map((row) => [row.firstElementChild.textContent, row.lastElementChild.textContent]),
    ).toEqual([
      ["Roses delivered", "11"],
      ["She asked for", String(SPRING.demand)],
      ["Questions right", "12 of 15"],
      ["Best streak", "6"],
    ])
    for (const row of rows) {
      expect(row.lastElementChild.tagName).toBe("STRONG")
    }
  })

  it("adds a fifth row only when something was lost for good", () => {
    ui.renderResult(resultState({ lost: 3 }), SPRING, [], "t", "x")
    const rows = Array.from(document.querySelectorAll("#result-summary .summary-row"))
    expect(rows).toHaveLength(5)
    expect(rows[4].textContent).toBe("Roses lost3")
  })

  it("builds one button per action, in order, and marks the primary one", () => {
    const list = actions()
    ui.renderResult(resultState(), SPRING, list, "t", "x")
    const buttons = Array.from(document.querySelectorAll("#result-actions button"))
    expect(buttons.map((button) => button.textContent)).toEqual([
      "On to Summer",
      "Pick a new character",
    ])
    expect(buttons[0].className).toBe("big-btn is-primary")
    expect(buttons[1].className).toBe("big-btn")
    expect(buttons.every((button) => button.type === "button")).toBe(true)
  })

  it("wires each button to its own handler", () => {
    const list = actions()
    ui.renderResult(resultState(), SPRING, list, "t", "x")
    const buttons = Array.from(document.querySelectorAll("#result-actions button"))
    buttons[1].click()
    expect(list[0].onClick).not.toHaveBeenCalled()
    expect(list[1].onClick).toHaveBeenCalledTimes(1)
    buttons[0].click()
    expect(list[0].onClick).toHaveBeenCalledTimes(1)
  })

  it("focuses the first action, so the keyboard lands somewhere useful", () => {
    ui.renderResult(resultState(), SPRING, actions(), "t", "x")
    expect(document.activeElement).toBe(document.querySelector("#result-actions button"))
  })

  it("rebuilds rather than appends", () => {
    ui.renderResult(resultState(), SPRING, actions(), "t", "x")
    ui.renderResult(resultState(), SPRING, actions(), "t", "x")
    expect(document.querySelectorAll("#result-summary .summary-row")).toHaveLength(4)
    expect(document.querySelectorAll("#result-actions button")).toHaveLength(2)
  })

  it("skips the summary for a null season but still writes the copy and the buttons", () => {
    ui.renderResult(resultState(), null, actions(), "Ribbit", "You are a frog.")
    expect(document.getElementById("result-title").textContent).toBe("Ribbit")
    expect(document.querySelectorAll("#result-summary .summary-row")).toHaveLength(0)
    expect(document.querySelectorAll("#result-actions button")).toHaveLength(2)
  })
})

describe("applyPalette and focusHeading", () => {
  it("sets every custom property on the root and records the season", () => {
    ui.applyPalette(SPRING)
    const root = document.documentElement
    expect(root.dataset.season).toBe("spring")
    for (const [property, value] of Object.entries(ui.pack.palette("spring"))) {
      expect(root.style.getPropertyValue(property)).toBe(value)
    }
  })

  it("replaces the previous season's palette rather than merging it", () => {
    ui.applyPalette(SPRING)
    ui.applyPalette(WINTER)
    expect(document.documentElement.dataset.season).toBe("winter")
    expect(document.documentElement.style.getPropertyValue("--season-sky")).toBe(
      ui.pack.palette("winter")["--season-sky"],
    )
  })

  it("leaves the page alone for a null season", () => {
    ui.applyPalette(WINTER)
    ui.applyPalette(null)
    expect(document.documentElement.dataset.season).toBe("winter")
  })

  it.each(["screen-character", "screen-play", "screen-result"])(
    "focusHeading moves focus into %s",
    (screenId) => {
      ui.focusHeading(screenId)
      const heading = document.getElementById(screenId).querySelector("h1, h2")
      expect(heading.getAttribute("tabindex")).toBe("-1")
      expect(document.activeElement).toBe(heading)
    },
  )

  it("focusHeading on an unknown screen does not throw", () => {
    expect(() => ui.focusHeading("nope")).not.toThrow()
  })
})

// The practical form of GameUI's "nothing here uses innerHTML" claim: feed a
// script payload through every string the class writes and check it lands as
// text. If any of these ever switch to innerHTML, `querySelector("script")`
// stops being null.
describe("content is written as text, never as markup", () => {
  const evilSeason = {
    ...SPRING,
    name: XSS,
    demandText: XSS,
    itemName: XSS,
    itemPlural: XSS,
    rareItemName: XSS,
  }

  // The shipped page carries its own `<script>` tags, so "no script element
  // exists" is not the assertion to make -- "no script element appeared that the
  // fixture did not already have" is.
  let baselineScripts = 0

  beforeEach(() => {
    baselineScripts = document.querySelectorAll("script").length
    expect(baselineScripts).toBeGreaterThan(0)
  })

  afterEach(() => {
    delete window.pwned
  })

  /** Nothing rendered produced a new element or ran anything. */
  function expectNoInjection() {
    expect(document.querySelectorAll("script")).toHaveLength(baselineScripts)
    expect(document.querySelector("img")).toBeNull()
    expect(window.pwned).toBeUndefined()
  }

  it("renders a whole hostile season without creating a single element from a string", () => {
    ui.applyPalette(evilSeason)
    ui.renderHud(
      hudState({ items: 2, wilting: 1, characterId: "phoenix", forgivenessLeft: 1 }),
      evilSeason,
    )
    ui.renderTrail(evilSeason, 3, "phoenix")
    ui.renderQuestion(questionState({ prompt: XSS }), true, false, () => {})
    ui.flashAnswer({ correct: false }, choiceButtons()[0], 73, XSS)
    ui.renderResult(
      resultState({ lost: 1 }),
      evilSeason,
      [{ label: XSS, onClick: () => {} }],
      XSS,
      XSS,
    )

    expectNoInjection()
  })

  it.each([
    ["season-name", () => ui.renderHud(hudState(), evilSeason)],
    ["demand-line", () => ui.renderHud(hudState(), evilSeason)],
    ["item-label", () => ui.renderHud(hudState({ items: 1 }), evilSeason)],
    [
      "question-prompt",
      () => ui.renderQuestion(questionState({ prompt: XSS }), false, false, () => {}),
    ],
    ["result-title", () => ui.renderResult(resultState(), SPRING, [], XSS, "x")],
    ["result-text", () => ui.renderResult(resultState(), SPRING, [], "x", XSS)],
  ])("#%s holds the payload as text", (id, render) => {
    render()
    const element = document.getElementById(id)
    expect(element.textContent).toBe(XSS)
    expect(element.children).toHaveLength(0)
    expectNoInjection()
  })

  it("an action label is text on the button, not markup inside it", () => {
    ui.renderResult(resultState(), SPRING, [{ label: XSS, onClick: () => {} }], "t", "x")
    const button = document.querySelector("#result-actions button")
    expect(button.textContent).toBe(XSS)
    expect(button.children).toHaveLength(0)
    expectNoInjection()
  })

  it("a hostile choice value becomes button text, not a node", () => {
    ui.renderQuestion(questionState({ choices: [XSS, 1, 2, 3] }), false, false, () => {})
    const button = choiceButtons()[0]
    expect(button.textContent).toBe(XSS)
    expect(button.children).toHaveLength(0)
    expectNoInjection()
  })
})

describe("a page whose markup has drifted", () => {
  it("every method degrades quietly rather than throwing", () => {
    document.body.innerHTML = ""
    const bare = new GameUI()
    expect(() => {
      bare.applyPalette(SPRING)
      bare.renderCharacterCards("sloth", () => {})
      bare.renderTrail(SPRING, 2, "sloth")
      bare.renderHud(hudState(), SPRING)
      bare.renderQuestion(questionState(), true, false, () => {})
      bare.flashAnswer({ correct: false }, null, 73, "x")
      bare.startTimer(null, () => {})
      bare.stopTimer()
      bare.renderResult(resultState(), SPRING, [{ label: "x", onClick: () => {} }], "t", "x")
      bare.focusHeading("screen-play")
    }).not.toThrow()
  })
})

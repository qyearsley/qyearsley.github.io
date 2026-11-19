/**
 * Tests for the Times Trail rendering layer.
 *
 * The fixture is read from `games/times-trail/index.html` on disk rather than
 * hand-written here. A hand-written fixture drifts from the real page the moment
 * an id is renamed, and then every test passes while the game renders blank in a
 * browser -- which is the exact failure mode these tests exist to prevent. The
 * `node:fs` / `node:path` import pattern mirrors `__tests__/html.test.js`, which
 * already reads files under the default jsdom environment; the path is resolved
 * from `import.meta.url` rather than `process.cwd()` because `process` is not in
 * eslint's globals allowlist for files under `games/`.
 *
 * Assigning the extracted `<body>` content to `document.body.innerHTML` does not
 * execute scripts, so the page's `<script type="module">` tag is inert here.
 *
 * Every group here exists because a reviewer found a real defect: the feedback
 * class-preservation cycle, the reset-then-one-affordance invariant of
 * `renderQuestion`, the mastery grid writing both a `strength-N` class and
 * `data-strength`, `showScreen` moving focus to the new heading, and
 * `updateProgressBar` actually changing `aria-valuenow`.
 *
 * A second round found several pieces of feedback that never reached the screen
 * at all, so the assertions below are deliberately exact -- counted lengths and
 * whole strings rather than "greater than zero" and "not empty", which is how
 * those bugs shipped green. `flyStars` runs on fake timers, because its bug was
 * entirely in what happened between the class change and the timeout. The few
 * fixes that live only in CSS (specificity, opacity, grid areas) are guarded by
 * the `stylesheet` group, which reads `styles/main.css` as text -- jsdom applies
 * no stylesheet, so there is nothing else to assert against.
 */

import { beforeEach, describe, expect, jest, test } from "@jest/globals"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { GameUI } from "../js/GameUI.js"
import {
  KEYPAD,
  OPERAND_MAX,
  OPERAND_MIN,
  TRAILS,
  SESSION,
  TIMING,
  TOKEN_EMOJI,
  TOTAL_FACTS,
} from "../js/constants.js"
import { FACTS } from "../js/facts.js"

const HERE = dirname(fileURLToPath(import.meta.url))
const INDEX_HTML = readFileSync(join(HERE, "..", "index.html"), "utf-8")
const BODY = INDEX_HTML.replace(/[\s\S]*<body[^>]*>/i, "").replace(/<\/body>[\s\S]*/i, "")
const MAIN_CSS = readFileSync(join(HERE, "..", "styles", "main.css"), "utf-8")

/**
 * The declaration block of the rule whose selector list is exactly `selector`.
 * jsdom applies no stylesheet, so the handful of fixes that live only in CSS --
 * a specificity ordering, an opacity, a grid area -- can only be asserted
 * against the sheet as text.
 * @param {string} selector - Selector text as written in the sheet
 * @returns {string} The declarations, or "" when no such rule exists
 */
function cssRule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = MAIN_CSS.match(new RegExp(`(?:^|\n)${escaped}\\s*\\{([^}]*)\\}`))
  return match === null ? "" : match[1]
}

/** Every id in the DOM contract, copied literally. */
const CONTRACT_IDS = [
  "game-container",
  "title-screen",
  "title-heading",
  "start-button",
  "continue-button",
  "start-fresh-button",
  "progress-button",
  "hub-screen",
  "hub-heading",
  "home-button",
  "hud",
  "star-count",
  "gem-count",
  "flame-display",
  "settings-button",
  "map-button",
  "collection-button",
  "play-screen",
  "play-heading",
  "back-button",
  "play-star-count",
  "play-streak",
  "play-settings-button",
  "progress-text",
  "play-trail-strip",
  "play-area",
  "question-text",
  "answer-display",
  "keypad",
  "scaffold-area",
  "scaffold-array",
  "scaffold-counts",
  "scaffold-text",
  "scaffold-continue",
  "feedback-area",
  "star-fly",
  "summary-screen",
  "summary-title",
  "play-again-button",
  "summary-hub-button",
  "summary-stars",
  "summary-gems",
  "summary-correct",
  "summary-streak",
  "summary-goal",
  "summary-trail",
  "summary-milestones",
  "summary-cards",
  "trail-spaces",
  "trail-legend",
  "map-screen",
  "map-heading",
  "map-back-button",
  "mastery-grid",
  "mastery-legend",
  "collection-screen",
  "collection-heading",
  "collection-back-button",
  "collection-count",
  "collection-cards",
  "collection-legend",
  "settings-modal",
  "session-length-select",
  "close-settings",
  "summary-milestones-group",
  "summary-cards-group",
]

/** Ids the settings decisions deleted; none may reappear. */
const DELETED_IDS = [
  "squares-note",
  "input-mode-select",
  "scaffolds-select",
  "sound-select",
  "reduced-motion-select",
  // Retired with the difficulty presets: the dropdown and the picker it revealed.
  "difficulty-select",
  "custom-tables-group",
  // Retired when a trail began to use all of its own facts.
  "pool-size",
  "table-2",
  "table-9",
]

/**
 * A keypad challenge.
 * @returns {Object} Challenge-shaped object
 */
function keypadChallenge() {
  return { prompt: "8 × 9 = ?" }
}

/**
 * The 64 mastery cells, with strength cycling 0-5 so every class is exercised.
 * @returns {Object[]} MasteryCell-shaped objects
 */
function masteryCells() {
  const cells = []
  let n = 0
  for (let row = OPERAND_MIN; row <= OPERAND_MAX; row += 1) {
    for (let col = OPERAND_MIN; col <= OPERAND_MAX; col += 1) {
      const strength = n % 6
      const tiers = ["new", "weak", "weak", "strengthening", "mastered", "mastered"]
      cells.push({
        row,
        col,
        factId: `${Math.min(row, col)}x${Math.max(row, col)}`,
        strength,
        isSquare: row === col,
        product: row * col,
        tierLabel: tiers[strength],
      })
      n += 1
    }
  }
  return cells
}

/**
 * All 36 card views, tier cycling through the three tiers.
 * @returns {Object[]} CardView-shaped objects
 */
function cardViews() {
  const tiers = ["grey", "colored", "foiled"]
  return FACTS.map((fact, index) => ({
    factId: fact.id,
    a: fact.a,
    b: fact.b,
    product: fact.product,
    tier: tiers[index % 3],
    isNew: index === 0,
  }))
}

/**
 * A picker view spanning the row states the screen has to draw: finished
 * (Doubles), current and part-walked (Squares), and untouched (Fives, Nines,
 * Tough).
 * @param {Object} [overrides] - Fields to replace
 * @returns {Object} TrailView-shaped object
 */
function trailView(overrides = {}) {
  const byId = {
    doubles: { space: 19, totalSpaces: 20, strong: 8, total: 8, complete: true },
    fives: { space: 0, totalSpaces: 20, strong: 0, total: 8, complete: false },
    squares: { space: 4, totalSpaces: 20, strong: 3, total: 8, complete: false },
    nines: { space: 0, totalSpaces: 20, strong: 0, total: 8, complete: false },
    tough: { space: 0, totalSpaces: 20, strong: 0, total: 10, complete: false },
  }
  const trails = TRAILS.map((trail) => ({
    id: trail.id,
    name: trail.name,
    emoji: trail.emoji,
    blurb: trail.blurb,
    current: trail.id === "squares",
    ...byId[trail.id],
  }))
  return { trails, tokenEmoji: TOKEN_EMOJI, ...overrides }
}

/**
 * A summary view.
 * @param {Object} [overrides] - Fields to replace
 * @returns {Object} SummaryView-shaped object
 */
function summaryView(overrides = {}) {
  return {
    stars: 120,
    gems: 2,
    factsCorrect: 17,
    factsAnswered: 20,
    bestStreak: 9,
    newCards: cardViews().slice(0, 3),
    trailFinishedName: "Squares",
    milestoneLabels: ["10 facts right", "5 facts mastered"],
    goalJustMet: true,
    ...overrides,
  }
}

/** @type {GameUI} */
let ui

beforeEach(() => {
  document.body.innerHTML = BODY
  ui = new GameUI()
})

describe("GameUI", () => {
  describe("fixture", () => {
    test.each(CONTRACT_IDS)("index.html contains #%s exactly once", (id) => {
      expect(document.getElementById(id)).not.toBeNull()
      expect(document.querySelectorAll(`#${id}`)).toHaveLength(1)
    })

    test.each(DELETED_IDS)("index.html does not contain the deleted #%s", (id) => {
      expect(document.getElementById(id)).toBeNull()
    })

    test("has no control for reduced motion, input mode, scaffolds, or sound", () => {
      expect(BODY).not.toMatch(/reduced-motion|input-mode|scaffolds-select|sound-select/)
    })

    test("#answer-display is not a live region", () => {
      // It is reset to "?" on every question render, and the play screen already
      // has four live regions competing. `role=status` implies aria-live, so
      // neither may come back.
      const display = document.getElementById("answer-display")
      expect(display.getAttribute("aria-live")).toBeNull()
      expect(display.getAttribute("role")).toBeNull()
    })
  })

  describe("constructor", () => {
    test("populates elements rather than leaving the base class's empty map", () => {
      expect(ui.elements).toBeTruthy()
      expect(Object.keys(ui.elements).length).toBeGreaterThan(50)
      expect(ui.elements).not.toEqual({})
    })

    test("caches the base class's common elements", () => {
      expect(ui.elements.settingsModal).toBe(document.getElementById("settings-modal"))
      expect(ui.elements.startButton).toBe(document.getElementById("start-button"))
      expect(ui.elements.closeSettings).toBe(document.getElementById("close-settings"))
    })

    test("caches Times Trail elements to the expected nodes", () => {
      expect(ui.elements.questionText).toBe(document.getElementById("question-text"))
      expect(ui.elements.masteryGrid).toBe(document.getElementById("mastery-grid"))
      expect(ui.elements.starFly).toBe(document.getElementById("star-fly"))
    })

    test("does not write to the document", () => {
      document.body.innerHTML = BODY
      const before = document.body.innerHTML
      new GameUI()
      expect(document.body.innerHTML).toBe(before)
    })

    test("has no setReducedMotion method", () => {
      expect(ui.setReducedMotion).toBeUndefined()
    })
  })

  describe("updateHud", () => {
    const hud = {
      starsTotal: 1234,
      gemsTotal: 7,
      streakDays: 3,
      flame: { index: 2, id: "flame", emoji: "🔥", dimmed: false },
    }

    test("writes lifetime stars, gems, and the flame", () => {
      ui.updateHud(hud)
      expect(document.getElementById("star-count").textContent).toBe("1234")
      expect(document.getElementById("gem-count").textContent).toBe("7")
      expect(document.getElementById("flame-display").textContent).toBe("🔥")
    })

    test("puts the day count in the flame's label, since it has no element", () => {
      ui.updateHud(hud)
      expect(document.getElementById("flame-display").getAttribute("aria-label")).toBe(
        "Daily streak: 3 days",
      )
      ui.updateHud({ ...hud, streakDays: 1 })
      expect(document.getElementById("flame-display").getAttribute("aria-label")).toBe(
        "Daily streak: 1 day",
      )
    })

    test("dims the flame when the streak is at risk", () => {
      ui.updateHud({ ...hud, flame: { ...hud.flame, dimmed: true } })
      expect(document.getElementById("flame-display").style.opacity).not.toBe("1")
      ui.updateHud(hud)
      expect(document.getElementById("flame-display").style.opacity).toBe("1")
    })

    test("does not touch the play HUD -- one writer per id", () => {
      ui.updateHud(hud)
      expect(document.getElementById("play-star-count").textContent).toBe("0")
      expect(document.getElementById("play-streak").textContent).toBe("Streak 0")
    })
  })

  describe("updatePlayHud", () => {
    test("writes session stars and the session streak", () => {
      ui.updatePlayHud({ sessionStars: 85, sessionStreak: 4 })
      expect(document.getElementById("play-star-count").textContent).toBe("85")
      expect(document.getElementById("play-streak").textContent).toBe("Streak 4")
    })

    test("does not touch the hub HUD -- one writer per id", () => {
      ui.updatePlayHud({ sessionStars: 85, sessionStreak: 4 })
      expect(document.getElementById("star-count").textContent).toBe("0")
      expect(document.getElementById("gem-count").textContent).toBe("0")
    })
  })

  describe("updateRoundCount", () => {
    test("writes the question number and the round length as text", () => {
      ui.updateRoundCount(3, 10)
      expect(document.getElementById("progress-text").textContent).toBe("Question 3 of 10")
      ui.updateRoundCount(10, 10)
      expect(document.getElementById("progress-text").textContent).toBe("Question 10 of 10")
    })

    // One bar on the play screen: the trail strip. The round only has a counter.
    test("the play screen has no second progress bar", () => {
      expect(document.querySelector('#play-screen [role="progressbar"]')).toBeNull()
    })
  })

  describe("flyStars", () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    test("shows the +N reward and starts the flight", () => {
      ui.flyStars(40)
      const el = document.getElementById("star-fly")
      expect(el.textContent).toBe("+40 ⭐")
      expect(el.classList.contains("hidden")).toBe(false)
      expect(el.classList.contains("star-fly-active")).toBe(true)
    })

    test("forces a layout read between unhiding and starting the flight", () => {
      // .hidden is `display: none !important`, so removing it and adding
      // .star-fly-active in one tick left no start state to transition from and
      // the reward was never visible. The offsetWidth read is what fixes that,
      // so its position in the sequence is the thing worth asserting.
      const el = document.getElementById("star-fly")
      const classesAtLayoutRead = []
      Object.defineProperty(el, "offsetWidth", {
        configurable: true,
        get() {
          classesAtLayoutRead.push([...el.classList])
          return 0
        },
      })

      ui.flyStars(40)

      expect(classesAtLayoutRead).toHaveLength(1)
      expect(classesAtLayoutRead[0]).not.toContain("hidden")
      expect(classesAtLayoutRead[0]).not.toContain("star-fly-active")
      expect(el.classList.contains("star-fly-active")).toBe(true)
    })

    test("stays visible for the whole flight, then hides itself", () => {
      ui.flyStars(40)
      const el = document.getElementById("star-fly")

      jest.advanceTimersByTime(TIMING.STAR_FLY_MS - 1)
      expect(el.classList.contains("star-fly-active")).toBe(true)
      expect(el.classList.contains("hidden")).toBe(false)

      jest.advanceTimersByTime(1)
      expect(el.classList.contains("star-fly-active")).toBe(false)
      expect(el.classList.contains("hidden")).toBe(true)
    })

    test("a second call replaces the text instead of duplicating the element", () => {
      ui.flyStars(40)
      ui.flyStars(20)
      expect(document.querySelectorAll("#star-fly")).toHaveLength(1)
      expect(document.getElementById("star-fly").textContent).toBe("+20 ⭐")
      expect(document.getElementById("star-fly").classList.contains("star-fly-active")).toBe(true)
    })

    test("a second call restarts the clock rather than being cut short by the first", () => {
      const el = document.getElementById("star-fly")
      ui.flyStars(40)
      jest.advanceTimersByTime(TIMING.STAR_FLY_MS - 100)
      ui.flyStars(20)

      // The first flight's timeout would have fired 100ms into the second one.
      jest.advanceTimersByTime(TIMING.STAR_FLY_MS - 1)
      expect(el.classList.contains("star-fly-active")).toBe(true)
      expect(el.classList.contains("hidden")).toBe(false)

      jest.advanceTimersByTime(1)
      expect(el.classList.contains("hidden")).toBe(true)
    })
  })

  describe("showScreen", () => {
    test.each([
      "hub-screen",
      "play-screen",
      "summary-screen",
      "map-screen",
      "collection-screen",
      "title-screen",
    ])("focuses %s's heading", (screenId) => {
      ui.showScreen(screenId)
      const screen = document.getElementById(screenId)
      const heading = screen.querySelector("h1, h2")
      expect(screen.classList.contains("active")).toBe(true)
      expect(heading.getAttribute("tabindex")).toBe("-1")
      expect(document.activeElement).toBe(heading)
    })

    test("moves focus off the button that was just tapped", () => {
      const button = document.getElementById("map-button")
      button.focus()
      expect(document.activeElement).toBe(button)
      ui.showScreen("map-screen")
      expect(document.activeElement).not.toBe(button)
      expect(document.activeElement).toBe(document.getElementById("map-heading"))
    })

    test("a screen with no heading does not throw", () => {
      const bare = document.createElement("div")
      bare.id = "bare-screen"
      bare.className = "screen"
      document.getElementById("game-container").appendChild(bare)
      expect(() => ui.showScreen("bare-screen")).not.toThrow()
      expect(bare.classList.contains("active")).toBe(true)
    })

    test("an unknown screen id warns and does not throw", () => {
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {})
      expect(() => ui.showScreen("nope")).not.toThrow()
      expect(warn).toHaveBeenCalled()
      warn.mockRestore()
    })
  })

  describe("renderQuestion", () => {
    test("a question shows the prompt, the readout and the keypad, and nothing else", () => {
      ui.renderQuestion(keypadChallenge())
      expect(document.getElementById("question-text").textContent).toBe("8 × 9 = ?")
      expect(document.getElementById("keypad").classList.contains("hidden")).toBe(false)
      expect(document.getElementById("answer-display").classList.contains("hidden")).toBe(false)
      expect(document.getElementById("answer-display").textContent).toBe(KEYPAD.EMPTY_DISPLAY)
      expect(document.getElementById("scaffold-area").classList.contains("hidden")).toBe(true)
    })

    test("resets the feedback and the scaffold", () => {
      ui.showFeedback("Nope", "incorrect")
      ui.showScaffold({ rows: 2, cols: 3, product: 6, skipCounts: [3, 6], text: "x" })
      ui.renderQuestion(keypadChallenge())
      expect(document.getElementById("feedback-area").classList.contains("hidden")).toBe(true)
      expect(document.getElementById("scaffold-area").classList.contains("hidden")).toBe(true)
    })

    test("writes the prompt as text, never as markup", () => {
      ui.renderQuestion({ prompt: "<img src=x>" })
      const el = document.getElementById("question-text")
      expect(el.textContent).toContain("<img src=x>")
      expect(el.querySelector("img")).toBeNull()
    })
  })

  describe("setAnswerDisplay", () => {
    test("writes the readout and restores the empty display", () => {
      ui.setAnswerDisplay("42")
      expect(document.getElementById("answer-display").textContent).toBe("42")
      ui.setAnswerDisplay(KEYPAD.EMPTY_DISPLAY)
      expect(document.getElementById("answer-display").textContent).toBe("?")
    })

    test("the readout is a <p> with no input near it, so iOS never opens a keyboard", () => {
      expect(ui.elements.answerDisplay.tagName).toBe("P")
      expect(ui.elements.answerDisplay.querySelector("input")).toBeNull()
    })

    test("writing again clears a previous .correct state", () => {
      ui.markAnswerDisplayCorrect("42")
      ui.setAnswerDisplay("4")
      const el = document.getElementById("answer-display")
      expect(el.classList.contains("correct")).toBe(false)
      expect(el.textContent).toBe("4")
    })
  })

  describe("setAnswerDisplayVisible", () => {
    test("toggles .hidden on #answer-display", () => {
      ui.setAnswerDisplayVisible(true)
      expect(document.getElementById("answer-display").classList.contains("hidden")).toBe(false)
      ui.setAnswerDisplayVisible(false)
      expect(document.getElementById("answer-display").classList.contains("hidden")).toBe(true)
    })
  })

  describe("markAnswerDisplayCorrect", () => {
    test("keeps the typed answer on screen and marks it correct", () => {
      ui.renderQuestion(keypadChallenge())
      ui.setAnswerDisplay("72")
      ui.markAnswerDisplayCorrect("72")
      const el = document.getElementById("answer-display")
      expect(el.textContent).toBe("72")
      expect(el.classList.contains("correct")).toBe(true)
      expect(el.classList.contains("hidden")).toBe(false)
      expect(document.querySelectorAll("#play-screen .correct")).toHaveLength(1)
    })

    test("without an argument it marks whatever the readout already holds", () => {
      ui.setAnswerDisplay("56")
      ui.markAnswerDisplayCorrect()
      const el = document.getElementById("answer-display")
      expect(el.textContent).toBe("56")
      expect(el.classList.contains("correct")).toBe(true)
    })

    test("the next question clears the mark and the answer", () => {
      ui.setAnswerDisplay("56")
      ui.markAnswerDisplayCorrect()
      ui.renderQuestion(keypadChallenge())
      const el = document.getElementById("answer-display")
      expect(el.classList.contains("correct")).toBe(false)
      expect(el.textContent).toBe(KEYPAD.EMPTY_DISPLAY)
    })

    test("writes the answer as text, never as markup", () => {
      ui.markAnswerDisplayCorrect("<b>42</b>")
      const el = document.getElementById("answer-display")
      expect(el.textContent).toBe("<b>42</b>")
      expect(el.querySelector("b")).toBeNull()
    })
  })

  describe("showFeedback", () => {
    test("preserves .feedback-area and never sets the base class's .feedback", () => {
      ui.showFeedback("Nice", "correct")
      const el = document.getElementById("feedback-area")
      expect(el.classList.contains("feedback-area")).toBe(true)
      expect(el.classList.contains("correct")).toBe(true)
      expect(el.classList.contains("hidden")).toBe(false)
      expect(el.classList.contains("feedback")).toBe(false)
      expect(el.textContent).toBe("Nice")
    })

    test("swapping type removes the previous type class", () => {
      ui.showFeedback("Nice", "correct")
      ui.showFeedback("No", "incorrect")
      const el = document.getElementById("feedback-area")
      expect(el.classList.contains("incorrect")).toBe(true)
      expect(el.classList.contains("correct")).toBe(false)
      expect(el.classList.contains("feedback-area")).toBe(true)
    })

    test("never sets inline opacity, which fought .hidden", () => {
      ui.showFeedback("Nice", "correct")
      expect(document.getElementById("feedback-area").style.opacity).toBe("")
    })

    test("writes the message as text, never as markup", () => {
      ui.showFeedback("<b>x</b>", "info")
      const el = document.getElementById("feedback-area")
      expect(el.textContent).toBe("<b>x</b>")
      expect(el.querySelector("b")).toBeNull()
    })
  })

  describe("hideFeedback", () => {
    test("a full show/hide cycle keeps .feedback-area and ends hidden and empty", () => {
      ui.showFeedback("Nice", "correct")
      ui.hideFeedback()
      const el = document.getElementById("feedback-area")
      expect(el.classList.contains("feedback-area")).toBe(true)
      expect(el.classList.contains("hidden")).toBe(true)
      expect(el.classList.contains("correct")).toBe(false)
      expect(el.classList.contains("feedback")).toBe(false)
      expect(el.textContent).toBe("")
      expect(el.style.opacity).toBe("")
    })

    test("repeated cycles never lose .feedback-area", () => {
      for (const type of ["correct", "incorrect", "encourage", "info"]) {
        ui.showFeedback("m", type)
        expect(document.getElementById("feedback-area").classList.contains("feedback-area")).toBe(
          true,
        )
        ui.hideFeedback()
        expect(document.getElementById("feedback-area").classList.contains("feedback-area")).toBe(
          true,
        )
      }
    })
  })

  describe("showScaffold", () => {
    const scaffold = {
      rows: 6,
      cols: 7,
      product: 42,
      skipCounts: [7, 14, 21, 28, 35, 42],
      text: "6 rows of 7 makes 42",
    }

    test("renders the dot array, the skip counts, the text, and the continue button", () => {
      ui.showScaffold(scaffold)
      expect(document.getElementById("scaffold-area").classList.contains("hidden")).toBe(false)
      expect(document.querySelectorAll("#scaffold-array .array-dot")).toHaveLength(42)
      const counts = Array.from(document.querySelectorAll("#scaffold-counts .skip-count"))
      expect(counts).toHaveLength(6)
      expect(counts.map((c) => c.textContent)).toEqual(["7", "14", "21", "28", "35", "42"])
      expect(document.getElementById("scaffold-text").textContent).toBe("6 rows of 7 makes 42")
      expect(document.getElementById("scaffold-continue").classList.contains("hidden")).toBe(false)
    })

    test("rebuilds rather than appends", () => {
      ui.showScaffold(scaffold)
      ui.showScaffold({ rows: 2, cols: 3, product: 6, skipCounts: [3, 6], text: "x" })
      expect(document.querySelectorAll("#scaffold-array .array-dot")).toHaveLength(6)
      expect(document.querySelectorAll("#scaffold-counts .skip-count")).toHaveLength(2)
    })
  })

  describe("highlightSkipCount", () => {
    test("puts .active on exactly one skip count", () => {
      ui.showScaffold({ rows: 3, cols: 4, product: 12, skipCounts: [4, 8, 12], text: "x" })
      ui.highlightSkipCount(2)
      const active = document.querySelectorAll("#scaffold-counts .skip-count.active")
      expect(active).toHaveLength(1)
      expect(active[0].textContent).toBe("12")
      ui.highlightSkipCount(0)
      const moved = document.querySelectorAll("#scaffold-counts .skip-count.active")
      expect(moved).toHaveLength(1)
      expect(moved[0].textContent).toBe("4")
    })

    test("an out-of-range index clears the highlight without throwing", () => {
      ui.showScaffold({ rows: 2, cols: 2, product: 4, skipCounts: [2, 4], text: "x" })
      ui.highlightSkipCount(0)
      expect(() => ui.highlightSkipCount(9)).not.toThrow()
      expect(document.querySelectorAll("#scaffold-counts .skip-count.active")).toHaveLength(0)
    })
  })

  describe("hideScaffold", () => {
    test("re-adds .hidden", () => {
      ui.showScaffold({ rows: 2, cols: 2, product: 4, skipCounts: [2, 4], text: "x" })
      ui.hideScaffold()
      expect(document.getElementById("scaffold-area").classList.contains("hidden")).toBe(true)
    })
  })

  // The landscape stylesheet lays the play area out in one centred column during
  // normal play and two columns only while the scaffold teaches. The class is the
  // whole contract between GameUI and that stylesheet.
  describe("the teaching class", () => {
    const SCAFFOLD = { rows: 2, cols: 2, product: 4, skipCounts: [2, 4], text: "x" }
    const teaching = () => document.getElementById("play-area").classList.contains("teaching")

    test("is absent before anything is shown", () => {
      expect(teaching()).toBe(false)
    })

    test("showScaffold adds it and hideScaffold removes it", () => {
      ui.showScaffold(SCAFFOLD)
      expect(teaching()).toBe(true)
      ui.hideScaffold()
      expect(teaching()).toBe(false)
    })

    test("a scaffold that is not shown does not claim the layout", () => {
      ui.showScaffold(null)
      expect(teaching()).toBe(false)
    })

    test("teaching hides the readout, so the miss is not left on screen", () => {
      ui.renderQuestion({ prompt: "2 × 6 = ?" })
      ui.setAnswerDisplay("13")
      expect(document.getElementById("answer-display").classList.contains("hidden")).toBe(false)
      ui.showScaffold(SCAFFOLD)
      expect(document.getElementById("answer-display").classList.contains("hidden")).toBe(true)
    })

    test("rendering the next question clears it, so the split cannot outlive the miss", () => {
      ui.showScaffold(SCAFFOLD)
      expect(teaching()).toBe(true)
      ui.renderQuestion({ prompt: "6 × 7 = ?" })
      expect(teaching()).toBe(false)
    })

    test("leaving the play screen clears it, even without hideScaffold", () => {
      ui.showScaffold(SCAFFOLD)
      ui.showScreen("hub-screen")
      expect(teaching()).toBe(false)
    })

    test("repeated calls stay idempotent", () => {
      ui.showScaffold(SCAFFOLD)
      ui.showScaffold(SCAFFOLD)
      expect(document.getElementById("play-area").className).toBe("play-area teaching")
      ui.hideScaffold()
      ui.hideScaffold()
      expect(document.getElementById("play-area").className).toBe("play-area")
    })
  })

  describe("renderPlayTrailStrip", () => {
    const strip = {
      trailName: "Squares",
      trailEmoji: "🔲",
      totalSpaces: 20,
      space: 4,
    }

    test("draws the whole trail, the token in the current space, and the name", () => {
      ui.renderPlayTrailStrip(strip)
      const spaces = Array.from(document.querySelectorAll("#play-trail-strip .strip-space"))
      expect(spaces).toHaveLength(20)
      const current = document.querySelectorAll("#play-trail-strip .strip-space-current")
      expect(current).toHaveLength(1)
      expect(current[0]).toBe(spaces[4])
      expect(current[0].querySelector(".strip-token").textContent).toBe(TOKEN_EMOJI)
      expect(document.querySelector("#play-trail-strip .strip-region").textContent).toBe("🔲")
      expect(document.querySelector("#play-trail-strip .strip-region-name").textContent).toBe(
        "Squares",
      )
    })

    // Walked and ahead have to be distinguishable. The old strip had only
    // "current" and everything else.
    test("separates walked from ahead", () => {
      ui.renderPlayTrailStrip(strip)
      const spaces = Array.from(document.querySelectorAll("#play-trail-strip .strip-space"))
      const classOf = (i) => spaces[i].className
      expect(classOf(0)).toBe("strip-space")
      expect(classOf(3)).toBe("strip-space")
      expect(classOf(5)).toContain("strip-space-ahead")
      expect(classOf(19)).toContain("strip-space-ahead")
    })

    test("draws nothing but the labels for a zero-length trail", () => {
      ui.renderPlayTrailStrip({ ...strip, totalSpaces: 0, space: 0 })
      expect(document.querySelectorAll("#play-trail-strip .strip-space")).toHaveLength(0)
    })

    test("calling twice does not accumulate", () => {
      ui.renderPlayTrailStrip({ ...strip, space: 9 })
      ui.renderPlayTrailStrip({ ...strip, space: 9 })
      expect(document.querySelectorAll("#play-trail-strip .strip-space")).toHaveLength(20)
      expect(document.querySelectorAll("#play-trail-strip .strip-region")).toHaveLength(1)
    })
  })

  describe("renderTrail", () => {
    test("draws one row per trail, each with its own spaces", () => {
      const view = trailView()
      ui.renderTrail(view)
      const rows = Array.from(document.querySelectorAll("#trail-spaces .trail-region-row"))
      expect(rows).toHaveLength(TRAILS.length)
      for (const [index, row] of rows.entries()) {
        expect(row.querySelectorAll(".trail-space")).toHaveLength(view.trails[index].totalSpaces)
        expect(row.querySelector(".trail-region-label").textContent).not.toBe("")
      }
      expect(rows[0].querySelector(".trail-region-label").textContent).toContain("Doubles")
    })

    // Choosing the trail is what this screen is for, so the rows are buttons
    // carrying the id the click handler reads.
    test("every row is a button carrying its trail id", () => {
      ui.renderTrail(trailView())
      const rows = Array.from(document.querySelectorAll("#trail-spaces .trail-region-row"))
      expect(rows.map((row) => row.tagName)).toEqual(rows.map(() => "BUTTON"))
      expect(rows.map((row) => row.dataset.trailId)).toEqual(TRAILS.map((trail) => trail.id))
    })

    test("marks the current trail", () => {
      ui.renderTrail(trailView())
      const current = Array.from(document.querySelectorAll("#trail-spaces .is-current"))
      expect(current).toHaveLength(1)
      expect(current[0].dataset.trailId).toBe("squares")
    })

    test("puts one token in each trail that has been walked", () => {
      ui.renderTrail(trailView())
      const rows = Array.from(document.querySelectorAll("#trail-spaces .trail-region-row"))
      const squares = rows.find((row) => row.dataset.trailId === "squares")
      const current = squares.querySelectorAll(".trail-space-current")
      expect(current).toHaveLength(1)
      expect(current[0].dataset.space).toBe("4")
      expect(current[0].querySelector(".trail-token").textContent).toBe(TOKEN_EMOJI)
    })

    test("separates walked from ahead", () => {
      ui.renderTrail(trailView())
      const squares = document.querySelector('[data-trail-id="squares"]')
      const spaces = Array.from(squares.querySelectorAll(".trail-space"))
      expect(spaces[0].className).toBe("trail-space")
      expect(spaces[5].className).toContain("trail-space-ahead")
      expect(spaces[19].className).toContain("trail-space-ahead")
    })

    test("no row is disabled: every trail can be started", () => {
      ui.renderTrail(trailView())
      for (const row of document.querySelectorAll("#trail-spaces .trail-region-row")) {
        expect(row.disabled).toBe(false)
      }
    })

    test("a finished trail says so", () => {
      ui.renderTrail(trailView())
      const doubles = document.querySelector('[data-trail-id="doubles"]')
      expect(doubles.classList.contains("is-complete")).toBe(true)
      expect(doubles.querySelector(".trail-row-note").textContent).toBe(
        "Finished, 8 of 8 strong. Tap to practice again.",
      )
    })

    test("a trail with the token past the start says Continue and counts what is strong", () => {
      ui.renderTrail(trailView())
      const note = document.querySelector('[data-trail-id="squares"] .trail-row-note')
      expect(note.textContent).toBe("Continue: 3 of 8 strong.")
    })

    test("a trail not yet walked says Start", () => {
      ui.renderTrail(trailView())
      const note = document.querySelector('[data-trail-id="fives"] .trail-row-note')
      expect(note.textContent).toBe("Start: 0 of 8 strong.")
    })

    // Twenty individually announced spaces would bury the one sentence that
    // matters, so the spaces are decorative and the row carries the label.
    test("the row's accessible name is the sentence, not the spaces", () => {
      ui.renderTrail(trailView())
      const squares = document.querySelector('[data-trail-id="squares"]')
      expect(squares.querySelector(".trail-row-spaces").getAttribute("aria-hidden")).toBe("true")
      expect(squares.getAttribute("aria-label")).toBe(
        "Squares. Continue: 3 of 8 strong. A number times itself.",
      )
    })

    test("populates the legend with one entry per state", () => {
      ui.renderTrail(trailView())
      const items = Array.from(document.querySelectorAll("#trail-legend .legend-item"))
      expect(items).toHaveLength(3)
      expect(items.map((item) => item.lastElementChild.textContent)).toEqual([
        "You are here",
        "Walked",
        "Ahead",
      ])
      expect(items[0].querySelector(".trail-token").textContent).toBe(TOKEN_EMOJI)
    })

    test("rebuilds rather than appends", () => {
      ui.renderTrail(trailView())
      ui.renderTrail(trailView())
      expect(document.querySelectorAll("#trail-spaces .trail-region-row")).toHaveLength(
        TRAILS.length,
      )
      expect(document.querySelectorAll("#trail-legend .legend-item")).toHaveLength(3)
    })

    test("survives a junk view rather than throwing", () => {
      for (const view of [undefined, null, {}, { trails: "none" }]) {
        expect(() => ui.renderTrail(view)).not.toThrow()
      }
      expect(document.querySelectorAll("#trail-spaces .trail-region-row")).toHaveLength(0)
    })
  })

  describe("renderMasteryGrid", () => {
    test("renders 64 data cells, 17 headers, and nine table rows", () => {
      ui.renderMasteryGrid(masteryCells())
      expect(document.querySelectorAll("#mastery-grid .mastery-cell")).toHaveLength(64)
      expect(document.querySelectorAll("#mastery-grid .mastery-header")).toHaveLength(17)
      expect(document.querySelectorAll('#mastery-grid [role="row"]')).toHaveLength(9)
      expect(document.getElementById("mastery-grid").getAttribute("role")).toBe("table")
    })

    test("marks the eight diagonal cells as squares", () => {
      ui.renderMasteryGrid(masteryCells())
      expect(document.querySelectorAll("#mastery-grid .mastery-cell-square")).toHaveLength(8)
    })

    test("every data cell carries both the strength class and data-strength", () => {
      ui.renderMasteryGrid(masteryCells())
      const cells = Array.from(document.querySelectorAll("#mastery-grid .mastery-cell"))
      expect(cells).toHaveLength(64)
      const seen = new Set()
      for (const cell of cells) {
        const strength = cell.dataset.strength
        expect(strength).toMatch(/^[0-5]$/)
        expect(cell.classList.contains(`strength-${strength}`)).toBe(true)
        seen.add(strength)
      }
      expect(Array.from(seen).sort()).toEqual(["0", "1", "2", "3", "4", "5"])
    })

    test.each([0, 1, 2, 3, 4, 5])("a strength-%i cell gets class and attribute", (strength) => {
      ui.renderMasteryGrid([
        {
          row: 6,
          col: 7,
          factId: "6x7",
          strength,
          isSquare: false,
          product: 42,
          tierLabel: "mastered",
        },
      ])
      const cell = document.querySelector('#mastery-grid [data-fact-id="6x7"]')
      expect(cell.dataset.strength).toBe(String(strength))
      expect(cell.classList.contains(`strength-${strength}`)).toBe(true)
    })

    test("every data cell has a well-formed aria-label", () => {
      ui.renderMasteryGrid(masteryCells())
      const cells = Array.from(document.querySelectorAll("#mastery-grid .mastery-cell"))
      expect(cells).toHaveLength(64)
      for (const cell of cells) {
        expect(cell.getAttribute("aria-label")).toMatch(
          /^\d times \d, \d+, (new|weak|strengthening|mastered)$/,
        )
      }
    })

    test("the 6x7 cell at strength 5 reads exactly '6 times 7, 42, mastered'", () => {
      ui.renderMasteryGrid([
        {
          row: 6,
          col: 7,
          factId: "6x7",
          strength: 5,
          isSquare: false,
          product: 42,
          tierLabel: "mastered",
        },
      ])
      const cell = document.querySelector('#mastery-grid [data-fact-id="6x7"]')
      expect(cell.getAttribute("aria-label")).toBe("6 times 7, 42, mastered")
    })

    test("strength is never conveyed by colour alone", () => {
      ui.renderMasteryGrid(masteryCells())
      const cells = Array.from(document.querySelectorAll("#mastery-grid .mastery-cell"))
      expect(cells).toHaveLength(64)
      for (const cell of cells) {
        const pip = cell.querySelector(".mastery-pip")
        expect(pip).not.toBeNull()
        expect(pip.textContent).not.toBe("")
      }
      const weakest = document.querySelector("#mastery-grid .strength-0 .mastery-pip")
      const strongest = document.querySelector("#mastery-grid .strength-5 .mastery-pip")
      expect(weakest.textContent).not.toBe(strongest.textContent)
    })

    test("populates the legend with a swatch, a pip, and a word per strength", () => {
      ui.renderMasteryGrid(masteryCells())
      const items = Array.from(document.querySelectorAll("#mastery-legend .legend-item"))
      // Six strengths plus the squares note.
      expect(items).toHaveLength(7)
      for (let strength = 0; strength <= 5; strength += 1) {
        const swatch = document.querySelector(`#mastery-legend .strength-${strength}`)
        expect(swatch).not.toBeNull()
        expect(swatch.querySelector(".mastery-pip").textContent).not.toBe("")
      }
      const text = document.getElementById("mastery-legend").textContent
      expect(text).toContain("new")
      expect(text).toContain("mastered")
      expect(text.toLowerCase()).toContain("squares")
    })

    test("a second call replaces rather than appends", () => {
      ui.renderMasteryGrid(masteryCells())
      ui.renderMasteryGrid(masteryCells())
      expect(document.querySelectorAll("#mastery-grid .mastery-cell")).toHaveLength(64)
      expect(document.querySelectorAll("#mastery-legend .legend-item")).toHaveLength(7)
    })

    test("missing cells still yield a full, aligned grid", () => {
      ui.renderMasteryGrid([])
      expect(document.querySelectorAll("#mastery-grid .mastery-cell")).toHaveLength(64)
      expect(document.querySelectorAll("#mastery-grid .mastery-header")).toHaveLength(17)
    })
  })

  describe("renderCollection", () => {
    test("renders 36 cards in FACTS order", () => {
      ui.renderCollection(cardViews())
      const cards = Array.from(document.querySelectorAll("#collection-cards .fact-card"))
      expect(cards).toHaveLength(TOTAL_FACTS)
      expect(cards[0].dataset.factId).toBe(FACTS[0].id)
      expect(cards[cards.length - 1].dataset.factId).toBe(FACTS[FACTS.length - 1].id)
    })

    test("orders shuffled input back into FACTS order", () => {
      ui.renderCollection(cardViews().slice().reverse())
      const cards = Array.from(document.querySelectorAll("#collection-cards .fact-card"))
      expect(cards.map((c) => c.dataset.factId)).toEqual(FACTS.map((f) => f.id))
    })

    test("maps tiers to card classes and marks new cards", () => {
      ui.renderCollection(cardViews())
      const cards = cardViews()
      const countOf = (tier) => cards.filter((card) => card.tier === tier).length
      expect(document.querySelectorAll("#collection-cards .card-grey")).toHaveLength(
        countOf("grey"),
      )
      expect(document.querySelectorAll("#collection-cards .card-colored")).toHaveLength(
        countOf("colored"),
      )
      expect(document.querySelectorAll("#collection-cards .card-foiled")).toHaveLength(
        countOf("foiled"),
      )
      expect(document.querySelectorAll("#collection-cards .card-new")).toHaveLength(1)
    })

    test("reports both numbers, so it cannot say 0 while cards are visibly changing", () => {
      const cards = cardViews()
      const colored = cards.filter((c) => c.tier === "colored" || c.tier === "foiled").length
      const foiled = cards.filter((c) => c.tier === "foiled").length
      ui.renderCollection(cards)
      expect(document.getElementById("collection-count").textContent).toBe(
        `${colored} of ${TOTAL_FACTS} cards colored, ${foiled} foiled`,
      )
    })

    test("counts colored cards even when nothing is foiled yet", () => {
      const cards = cardViews().map((card, index) => ({
        ...card,
        tier: index < 12 ? "colored" : "grey",
      }))
      ui.renderCollection(cards)
      expect(document.getElementById("collection-count").textContent).toBe(
        `12 of ${TOTAL_FACTS} cards colored, 0 foiled`,
      )
    })

    test("a grey card shows no product -- the collection is not an answer key", () => {
      const cards = cardViews().map((card) => ({ ...card, tier: "grey", isNew: false }))
      ui.renderCollection(cards)
      const rendered = Array.from(document.querySelectorAll("#collection-cards .fact-card"))
      expect(rendered).toHaveLength(TOTAL_FACTS)
      for (const [index, el] of rendered.entries()) {
        const fact = FACTS[index]
        expect(el.querySelector(".card-face").textContent).toBe(`${fact.a} × ${fact.b}`)
        expect(el.textContent).not.toContain(String(fact.product))
        expect(el.getAttribute("aria-label")).toBe(`${fact.a} times ${fact.b}, grey card`)
      }
    })

    test.each(["colored", "foiled"])("a %s card shows the product", (tier) => {
      const fact = FACTS[0]
      ui.renderCollection([
        { factId: fact.id, a: fact.a, b: fact.b, product: fact.product, tier, isNew: false },
      ])
      const el = document.querySelector("#collection-cards .fact-card")
      expect(el.querySelector(".card-face").textContent).toBe(
        `${fact.a} × ${fact.b} = ${fact.product}`,
      )
      expect(el.getAttribute("aria-label")).toBe(
        `${fact.a} times ${fact.b} equals ${fact.product}, ${tier} card`,
      )
    })

    test("every card carries a non-colour tier cue, and the three differ", () => {
      ui.renderCollection(cardViews())
      const cards = Array.from(document.querySelectorAll("#collection-cards .fact-card"))
      expect(cards).toHaveLength(TOTAL_FACTS)
      for (const card of cards) {
        const pip = card.querySelector(".card-pip")
        expect(pip).not.toBeNull()
        expect(pip.textContent).not.toBe("")
        expect(pip.getAttribute("aria-hidden")).toBe("true")
      }
      const pipFor = (tier) =>
        document.querySelector(`#collection-cards .card-${tier} .card-pip`).textContent
      expect(new Set([pipFor("grey"), pipFor("colored"), pipFor("foiled")]).size).toBe(3)
    })

    test("populates the legend with a swatch, a pip, and a word per tier", () => {
      ui.renderCollection(cardViews())
      const items = Array.from(document.querySelectorAll("#collection-legend .legend-item"))
      expect(items).toHaveLength(3)
      for (const tier of ["grey", "colored", "foiled"]) {
        const swatch = document.querySelector(`#collection-legend .card-swatch.card-${tier}`)
        expect(swatch).not.toBeNull()
        expect(swatch.textContent).not.toBe("")
        expect(swatch.getAttribute("aria-hidden")).toBe("true")
      }
      const text = document.getElementById("collection-legend").textContent
      expect(text).toContain("Not yet")
      expect(text).toContain("Getting there")
      expect(text).toContain("Mastered")
    })

    test("rebuilds rather than appends", () => {
      ui.renderCollection(cardViews())
      ui.renderCollection(cardViews())
      expect(document.querySelectorAll("#collection-cards .fact-card")).toHaveLength(TOTAL_FACTS)
      expect(document.querySelectorAll("#collection-legend .legend-item")).toHaveLength(3)
    })
  })

  describe("renderSessionSummary", () => {
    test("writes the tallies", () => {
      ui.renderSessionSummary(summaryView())
      expect(document.getElementById("summary-stars").textContent).toBe("120")
      expect(document.getElementById("summary-gems").textContent).toBe("2")
      expect(document.getElementById("summary-correct").textContent).toBe("17/20")
      expect(document.getElementById("summary-streak").textContent).toBe("9")
    })

    test("renders one element per new card", () => {
      ui.renderSessionSummary(summaryView())
      expect(document.querySelectorAll("#summary-cards .fact-card")).toHaveLength(3)
    })

    test("says which trail was finished, only when one was", () => {
      ui.renderSessionSummary(summaryView())
      const trail = document.getElementById("summary-trail")
      expect(trail.classList.contains("hidden")).toBe(false)
      expect(trail.textContent).toBe("Trail finished: Squares!")
      ui.renderSessionSummary(summaryView({ trailFinishedName: null }))
      expect(document.getElementById("summary-trail").classList.contains("hidden")).toBe(true)
      expect(document.getElementById("summary-trail").textContent).toBe("")
    })

    // The GROUP is what gets hidden, not the bare list: the group carries the
    // heading, and without it "1000 stars" (a lifetime gem milestone) read as a
    // session tally sitting under "⭐ 1189 stars".
    test("writes one list item per milestone and hides the labelled group when empty", () => {
      ui.renderSessionSummary(summaryView())
      const list = document.getElementById("summary-milestones")
      const group = document.getElementById("summary-milestones-group")
      expect(list.querySelectorAll("li")).toHaveLength(2)
      expect(group.classList.contains("hidden")).toBe(false)
      expect(list.textContent).toContain("10 facts right")
      expect(group.textContent).toContain("New gems earned")

      ui.renderSessionSummary(summaryView({ milestoneLabels: [] }))
      expect(document.getElementById("summary-milestones").querySelectorAll("li")).toHaveLength(0)
      expect(document.getElementById("summary-milestones-group").classList.contains("hidden")).toBe(
        true,
      )
    })

    test("hides the card group when no card grew, so four unlabelled cards never appear alone", () => {
      ui.renderSessionSummary(summaryView())
      const group = document.getElementById("summary-cards-group")
      expect(group.classList.contains("hidden")).toBe(false)
      expect(group.textContent).toContain("Cards that grew")

      ui.renderSessionSummary(summaryView({ newCards: [] }))
      expect(document.querySelectorAll("#summary-cards .fact-card")).toHaveLength(0)
      expect(document.getElementById("summary-cards-group").classList.contains("hidden")).toBe(true)
    })

    test("shows the goal line only when the goal was just met", () => {
      ui.renderSessionSummary(summaryView())
      const goal = document.getElementById("summary-goal")
      expect(goal.classList.contains("hidden")).toBe(false)
      expect(goal.textContent).not.toBe("")
      ui.renderSessionSummary(summaryView({ goalJustMet: false }))
      expect(document.getElementById("summary-goal").classList.contains("hidden")).toBe(true)
    })

    test("rebuilds rather than appends", () => {
      ui.renderSessionSummary(summaryView())
      ui.renderSessionSummary(summaryView())
      expect(document.querySelectorAll("#summary-cards .fact-card")).toHaveLength(3)
      expect(document.getElementById("summary-milestones").querySelectorAll("li")).toHaveLength(2)
    })
  })

  describe("renderSettings", () => {
    test("the table picker and the pool readout are gone", () => {
      ui.renderSettings({ sessionLength: 20 })
      expect(document.getElementById("table-2")).toBeNull()
      expect(document.getElementById("pool-size")).toBeNull()
      expect(ui.elements.tableToggles).toBeUndefined()
      expect(document.getElementById("difficulty-select")).toBeNull()
      expect(document.getElementById("custom-tables-group")).toBeNull()
    })

    test("selects the session length", () => {
      for (const length of SESSION.LENGTH_OPTIONS) {
        ui.renderSettings({ sessionLength: length })
        expect(document.getElementById("session-length-select").value).toBe(String(length))
      }
    })

    test("tolerates a missing session length without clearing the select", () => {
      ui.renderSettings({ sessionLength: 30 })
      ui.renderSettings({})
      expect(document.getElementById("session-length-select").value).toBe("30")
    })
  })

  describe("inherited behavior", () => {
    test("showSettings removes .hidden from the modal", () => {
      ui.showSettings()
      expect(document.getElementById("settings-modal").classList.contains("hidden")).toBe(false)
      ui.hideSettings()
      expect(document.getElementById("settings-modal").classList.contains("hidden")).toBe(true)
    })

    // All three are save-dependent: a fresh player has nothing to continue, no
    // progress to look at, and nothing to reset.
    test("updateTitleButtons toggles continue, progress, and reset together", () => {
      const ids = ["continue-button", "progress-button", "start-fresh-button"]
      ui.updateTitleButtons(true)
      for (const id of ids) {
        expect(document.getElementById(id).classList.contains("hidden")).toBe(false)
      }
      ui.updateTitleButtons(false)
      for (const id of ids) {
        expect(document.getElementById(id).classList.contains("hidden")).toBe(true)
      }
    })
  })

  describe("stylesheet", () => {
    test("the current trail space is scoped so the walked and ahead states cannot repaint it", () => {
      // All three were single-class selectors, so the later ones won at equal
      // specificity and "you are here" painted transparent or grey.
      expect(cssRule(".trail-space.trail-space-current")).toContain("background-color")
      expect(cssRule(".trail-space-current")).toBe("")
    })

    test("a correct keypad answer has a rule to paint", () => {
      expect(cssRule("#answer-display.correct")).toContain("color: var(--tt-correct)")
    })

    test("the readout and the feedback do not share a cell", () => {
      expect(cssRule("#answer-display")).toContain("grid-area: readout")

      const landscapeAt = MAIN_CSS.indexOf("@media (orientation: landscape)")
      const portrait = MAIN_CSS.slice(
        MAIN_CSS.indexOf("@media (orientation: portrait)"),
        landscapeAt,
      )
      const landscape = MAIN_CSS.slice(landscapeAt)
      for (const area of ["question", "readout", "entry", "extra"]) {
        expect(portrait).toContain(area)
        expect(landscape).toContain(area)
      }
    })

    // The `extra` row is sized rather than auto. `.feedback-area` reserves 3rem,
    // but `.hidden` is `display: none`, so the row collapsed between answers and
    // `align-content: center` re-centred the column -- the keypad moved on every
    // single answer.
    test("the feedback row is reserved so the keypad cannot move under it", () => {
      const landscapeAt = MAIN_CSS.indexOf("@media (orientation: landscape)")
      const portrait = MAIN_CSS.slice(
        MAIN_CSS.indexOf("@media (orientation: portrait)"),
        landscapeAt,
      )
      const landscape = MAIN_CSS.slice(landscapeAt)
      for (const block of [portrait, landscape]) {
        expect(block).toContain('"extra" minmax(3rem, auto)')
      }
      expect(cssRule(".feedback-area")).toContain("min-height: 3rem")
    })

    test("the star reward has a visible start state to transition from", () => {
      expect(cssRule(".star-fly")).toContain("opacity: 1")
      expect(cssRule(".star-fly-active")).toContain("opacity: 0")
    })

    test("the feedback types nothing produces have no rules", () => {
      expect(MAIN_CSS).not.toContain(".feedback-area.info")
      expect(MAIN_CSS).not.toContain(".feedback-area.encourage")
    })
  })

  describe("missing elements", () => {
    test("constructing and rendering against an empty document throws nothing", () => {
      document.body.innerHTML = ""
      const bare = new GameUI()
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {})
      expect(() => {
        bare.updateHud({ starsTotal: 1, gemsTotal: 1, streakDays: 1, flame: null })
        bare.updatePlayHud({ sessionStars: 1, sessionStreak: 1 })
        bare.updateRoundCount(1, 20)
        bare.flyStars(10)
        bare.showScreen("hub-screen")
        bare.renderQuestion(keypadChallenge())
        bare.setKeypadVisible(true)
        bare.setAnswerDisplay("42")
        bare.setAnswerDisplayVisible(true)
        bare.markAnswerDisplayCorrect("42")
        bare.showFeedback("m", "correct")
        bare.hideFeedback()
        bare.showScaffold({ rows: 2, cols: 2, product: 4, skipCounts: [2, 4], text: "x" })
        bare.highlightSkipCount(0)
        bare.hideScaffold()
        bare.renderPlayTrailStrip({ trailName: "x", trailEmoji: "y", totalSpaces: 5, space: 0 })
        bare.renderTrail(trailView())
        bare.renderMasteryGrid(masteryCells())
        bare.renderCollection(cardViews())
        bare.renderSessionSummary(summaryView())
        bare.renderSettings({ sessionLength: 20 })
      }).not.toThrow()
      warn.mockRestore()
    })

    test("render methods tolerate missing view models", () => {
      expect(() => {
        ui.updateHud(null)
        ui.updatePlayHud(null)
        ui.renderQuestion(null)
        ui.showScaffold(null)
        ui.renderPlayTrailStrip(null)
        ui.renderTrail(null)
        ui.renderMasteryGrid(null)
        ui.renderCollection(null)
        ui.renderSessionSummary(null)
        ui.renderSettings(null)
      }).not.toThrow()
    })
  })
})

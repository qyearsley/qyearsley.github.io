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
  ALL_TABLES,
  KEYPAD,
  OPERAND_MAX,
  OPERAND_MIN,
  REGIONS,
  SESSION,
  TIMING,
  TOKEN_EMOJI,
  TOTAL_FACTS,
  TRAIL,
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

/** Every id in the § 22 DOM contract, copied literally. */
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
  "hub-region-name",
  "settings-button",
  "mode-quick-recall",
  "trail-button",
  "map-button",
  "collection-button",
  "play-screen",
  "play-heading",
  "back-button",
  "play-star-count",
  "play-streak",
  "play-settings-button",
  "progress-bar",
  "progress-text",
  "play-trail-strip",
  "play-area",
  "question-text",
  "answer-tiles",
  "answer-display",
  "keypad",
  "scaffold-area",
  "scaffold-array",
  "scaffold-counts",
  "scaffold-text",
  "scaffold-continue",
  "feedback-area",
  "gate-message",
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
  "summary-region",
  "summary-milestones",
  "summary-cards",
  "trail-screen",
  "trail-heading",
  "trail-back-button",
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
  "difficulty-select",
  "custom-tables-group",
  ...ALL_TABLES.map((table) => `table-${table}`),
  "close-settings",
]

/** Ids the settings decisions deleted; none may reappear. */
const DELETED_IDS = [
  "squares-note",
  "input-mode-select",
  "scaffolds-select",
  "sound-select",
  "reduced-motion-select",
]

/**
 * A tiles challenge.
 * @param {Object} [overrides] - Fields to replace
 * @returns {Object} Challenge-shaped object
 */
function tilesChallenge(overrides = {}) {
  return { prompt: "6 × 7 = ?", entry: "tiles", options: [36, 42, 48, 49], ...overrides }
}

/**
 * A keypad challenge.
 * @returns {Object} Challenge-shaped object
 */
function keypadChallenge() {
  return { prompt: "8 × 9 = ?", entry: "keypad", options: null }
}

/**
 * Which of the entry affordances are currently visible.
 * @returns {string[]} Ids of the affordances lacking `.hidden`
 */
function visibleAffordances() {
  return ["answer-tiles", "keypad"].filter(
    (id) => !document.getElementById(id).classList.contains("hidden"),
  )
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
 * A trail view with the token in region 2 and the last two regions locked.
 * @param {Object} [overrides] - Fields to replace
 * @returns {Object} TrailView-shaped object
 */
function trailView(overrides = {}) {
  const regions = REGIONS.map((region, index) => ({
    id: region.id,
    name: region.name,
    emoji: region.emoji,
    startSpace: index * TRAIL.SPACES_PER_REGION,
    spaces: region.spaces,
    unlocked: index < 6,
    mastered: 1,
    required: 2,
    skipped: index === 1,
  }))
  return {
    space: 7,
    totalSpaces: TRAIL.TOTAL_SPACES,
    regions,
    tokenEmoji: TOKEN_EMOJI,
    ...overrides,
  }
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
    newRegionName: "Triple Bridge",
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
      expect(ui.elements.tableToggles).toHaveLength(ALL_TABLES.length)
      expect(ui.elements.tableToggles[0].input).toBe(document.getElementById("table-2"))
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
      regionName: "Beehive Hollow",
    }

    test("writes lifetime stars, gems, the flame, and the region name", () => {
      ui.updateHud(hud)
      expect(document.getElementById("star-count").textContent).toBe("1234")
      expect(document.getElementById("gem-count").textContent).toBe("7")
      expect(document.getElementById("flame-display").textContent).toBe("🔥")
      expect(document.getElementById("hub-region-name").textContent).toBe("Beehive Hollow")
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

  describe("updateProgressBar", () => {
    test("writes the width, the text, and aria-valuenow/max", () => {
      ui.updateProgressBar(5, 20)
      const bar = document.getElementById("progress-bar")
      expect(bar.style.width).toBe("25%")
      expect(document.getElementById("progress-text").textContent).toBe("5/20")
      expect(bar.getAttribute("aria-valuenow")).toBe("5")
      expect(bar.getAttribute("aria-valuemax")).toBe("20")
      expect(bar.getAttribute("aria-valuemin")).toBe("0")
    })

    test("aria-valuenow actually changes across calls", () => {
      const bar = document.getElementById("progress-bar")
      expect(bar.getAttribute("aria-valuenow")).toBe("0")
      ui.updateProgressBar(5, 20)
      expect(bar.getAttribute("aria-valuenow")).toBe("5")
      ui.updateProgressBar(20, 20)
      expect(bar.getAttribute("aria-valuenow")).toBe("20")
      expect(bar.style.width).toBe("100%")
    })

    test("derives aria-valuemax from the session constant when total is omitted", () => {
      ui.updateProgressBar(3)
      const bar = document.getElementById("progress-bar")
      expect(bar.getAttribute("aria-valuemax")).toBe(String(SESSION.FACTS_PER_SESSION))
      expect(document.getElementById("progress-text").textContent).toBe(
        `3/${SESSION.FACTS_PER_SESSION}`,
      )
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
      "trail-screen",
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
      const button = document.getElementById("trail-button")
      button.focus()
      expect(document.activeElement).toBe(button)
      ui.showScreen("trail-screen")
      expect(document.activeElement).not.toBe(button)
      expect(document.activeElement).toBe(document.getElementById("trail-heading"))
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
    test("a tiles question shows tiles and nothing else", () => {
      ui.renderQuestion(tilesChallenge())
      expect(document.getElementById("question-text").textContent).toBe("6 × 7 = ?")
      expect(document.querySelectorAll("#answer-tiles .answer-btn")).toHaveLength(4)
      expect(document.getElementById("answer-tiles").classList.contains("hidden")).toBe(false)
      expect(document.getElementById("keypad").classList.contains("hidden")).toBe(true)
      expect(document.getElementById("scaffold-area").classList.contains("hidden")).toBe(true)
      expect(document.getElementById("answer-display").textContent).toBe(KEYPAD.EMPTY_DISPLAY)
    })

    test.each([
      ["tiles", tilesChallenge(), true],
      ["keypad", keypadChallenge(), false],
    ])("the keypad readout is hidden for entry %s: %s", (_entry, challenge, hidden) => {
      ui.renderQuestion(challenge)
      expect(document.getElementById("answer-display").classList.contains("hidden")).toBe(hidden)
    })

    test("the readout is hidden again when a keypad question is followed by tiles", () => {
      ui.renderQuestion(keypadChallenge())
      expect(document.getElementById("answer-display").classList.contains("hidden")).toBe(false)
      ui.renderQuestion(tilesChallenge())
      expect(document.getElementById("answer-display").classList.contains("hidden")).toBe(true)
    })

    test("a keypad question leaves the tiles empty AND hidden", () => {
      ui.renderQuestion(tilesChallenge())
      ui.renderQuestion(keypadChallenge())
      const tiles = document.getElementById("answer-tiles")
      expect(tiles.children).toHaveLength(0)
      expect(tiles.classList.contains("hidden")).toBe(true)
      expect(document.getElementById("keypad").classList.contains("hidden")).toBe(false)
    })

    test.each([
      ["tiles", tilesChallenge()],
      ["keypad", keypadChallenge()],
    ])("exactly one affordance is visible for entry %s", (_entry, challenge) => {
      ui.renderQuestion(challenge)
      expect(visibleAffordances()).toHaveLength(1)
    })

    test("switching entry types back to back never accumulates tiles", () => {
      const sequence = [tilesChallenge(), keypadChallenge(), tilesChallenge()]
      for (const challenge of sequence) {
        ui.renderQuestion(challenge)
        expect(visibleAffordances()).toHaveLength(1)
        const expected = challenge.entry === "tiles" ? 4 : 0
        expect(document.querySelectorAll("#answer-tiles .answer-btn")).toHaveLength(expected)
      }
    })

    test("resets the feedback and the scaffold", () => {
      ui.showFeedback("Nope", "incorrect")
      ui.showScaffold({ rows: 2, cols: 3, product: 6, skipCounts: [3, 6], text: "x" })
      ui.renderQuestion(keypadChallenge())
      expect(document.getElementById("feedback-area").classList.contains("hidden")).toBe(true)
      expect(document.getElementById("scaffold-area").classList.contains("hidden")).toBe(true)
    })

    test("leaves the gate message alone -- it is persistent state, not feedback", () => {
      // Clearing it here wiped the game's only explanation of why the trail
      // stopped one feedback hold after it appeared. game.js owns clearing it.
      const message = "Master 2 more facts in Doubling Meadow to cross the bridge"
      ui.showGateMessage(message)
      ui.renderQuestion(keypadChallenge())
      ui.renderQuestion(tilesChallenge())
      const el = document.getElementById("gate-message")
      expect(el.textContent).toBe(message)
      expect(el.classList.contains("hidden")).toBe(false)
    })

    test("an unknown entry mode leaves every affordance hidden and warns", () => {
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {})
      ui.renderQuestion(tilesChallenge())
      ui.renderQuestion(tilesChallenge({ entry: "telepathy" }))
      expect(visibleAffordances()).toHaveLength(0)
      expect(warn).toHaveBeenCalledTimes(1)
      warn.mockRestore()
    })

    test("writes the prompt as text, never as markup", () => {
      ui.renderQuestion(tilesChallenge({ prompt: "<img src=x>" }))
      const el = document.getElementById("question-text")
      expect(el.textContent).toContain("<img src=x>")
      expect(el.querySelector("img")).toBeNull()
    })
  })

  describe("renderTiles", () => {
    test("gives each button data-answer, data-index, and an aria-label", () => {
      ui.renderTiles([36, 42, 48, 49])
      const buttons = Array.from(document.querySelectorAll("#answer-tiles .answer-btn"))
      expect(buttons).toHaveLength(4)
      expect(buttons.map((b) => b.dataset.answer)).toEqual(["36", "42", "48", "49"])
      expect(buttons.map((b) => b.dataset.index)).toEqual(["0", "1", "2", "3"])
      expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual([
        "Answer 1: 36",
        "Answer 2: 42",
        "Answer 3: 48",
        "Answer 4: 49",
      ])
      for (const button of buttons) {
        expect(button.type).toBe("button")
      }
    })

    test("writes no data-correct anywhere -- the answer is not in the markup", () => {
      ui.renderTiles([36, 42, 48, 49])
      expect(document.querySelectorAll("[data-correct]")).toHaveLength(0)
    })

    test("the inherited disableAnswerButtons reaches the rendered tiles", () => {
      ui.renderTiles([36, 42, 48, 49])
      ui.disableAnswerButtons()
      const buttons = Array.from(document.querySelectorAll("#answer-tiles .answer-btn"))
      expect(buttons.every((b) => b.disabled)).toBe(true)
      ui.enableAnswerButtons()
      expect(buttons.every((b) => b.disabled)).toBe(false)
    })

    test("rendering twice does not accumulate buttons", () => {
      ui.renderTiles([36, 42, 48, 49])
      ui.renderTiles([1, 2, 3, 4])
      expect(document.querySelectorAll("#answer-tiles .answer-btn")).toHaveLength(4)
    })
  })

  describe("clearTiles", () => {
    test("empties the container", () => {
      ui.renderTiles([36, 42, 48, 49])
      ui.clearTiles()
      expect(document.getElementById("answer-tiles").children).toHaveLength(0)
    })

    test("drops the frozen reveal state so the next question is interactive", () => {
      ui.renderTiles([36, 42, 48, 49])
      ui.freezeTiles()
      ui.clearTiles()
      expect(
        document.getElementById("answer-tiles").classList.contains("answer-tiles-frozen"),
      ).toBe(false)
    })
  })

  describe("freezeTiles", () => {
    test("keeps the marked tiles on screen but inert", () => {
      ui.renderQuestion(tilesChallenge())
      const tiles = Array.from(document.querySelectorAll("#answer-tiles .answer-btn"))
      expect(tiles).toHaveLength(4)
      ui.markButtonCorrect(tiles[1])
      ui.markButtonIncorrect(tiles[0])

      ui.freezeTiles()

      const container = document.getElementById("answer-tiles")
      expect(container.classList.contains("hidden")).toBe(false)
      expect(container.classList.contains("answer-tiles-frozen")).toBe(true)
      expect(document.querySelectorAll("#answer-tiles .answer-btn")).toHaveLength(4)
      expect(document.querySelectorAll("#answer-tiles .answer-btn.correct")).toHaveLength(1)
      expect(document.querySelectorAll("#answer-tiles .answer-btn.incorrect")).toHaveLength(1)
      expect(tiles.every((tile) => tile.disabled)).toBe(true)
    })

    test("re-shows a tiles container that had been hidden", () => {
      ui.renderQuestion(tilesChallenge())
      ui.setTilesVisible(false)
      ui.freezeTiles()
      expect(document.getElementById("answer-tiles").classList.contains("hidden")).toBe(false)
    })

    test("the next question clears the marks and the frozen state", () => {
      ui.renderQuestion(tilesChallenge())
      ui.markButtonCorrect(document.querySelector("#answer-tiles .answer-btn"))
      ui.freezeTiles()
      ui.renderQuestion(tilesChallenge())
      const container = document.getElementById("answer-tiles")
      expect(container.classList.contains("answer-tiles-frozen")).toBe(false)
      expect(document.querySelectorAll("#answer-tiles .answer-btn.correct")).toHaveLength(0)
      expect(document.querySelectorAll("#answer-tiles .answer-btn")).toHaveLength(4)
      expect(
        Array.from(document.querySelectorAll("#answer-tiles .answer-btn")).every(
          (tile) => tile.disabled === false,
        ),
      ).toBe(true)
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
      ui.renderQuestion({ prompt: "2 × 6 = ?", entry: "keypad", options: null })
      ui.setAnswerDisplay("13")
      expect(document.getElementById("answer-display").classList.contains("hidden")).toBe(false)
      ui.showScaffold(SCAFFOLD)
      expect(document.getElementById("answer-display").classList.contains("hidden")).toBe(true)
    })

    test("rendering the next question clears it, so the split cannot outlive the miss", () => {
      ui.showScaffold(SCAFFOLD)
      expect(teaching()).toBe(true)
      ui.renderQuestion({ prompt: "6 × 7 = ?", entry: "keypad", options: null })
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
      regionName: "Triple Bridge",
      regionEmoji: "🌉",
      spacesInRegion: TRAIL.SPACES_PER_REGION,
      indexInRegion: 2,
      gated: false,
    }

    test("renders five spaces, the token in the current one, and the region", () => {
      ui.renderPlayTrailStrip(strip)
      const spaces = Array.from(document.querySelectorAll("#play-trail-strip .strip-space"))
      expect(spaces).toHaveLength(5)
      const current = document.querySelectorAll("#play-trail-strip .strip-space-current")
      expect(current).toHaveLength(1)
      expect(current[0]).toBe(spaces[2])
      expect(current[0].querySelector(".strip-token").textContent).toBe(TOKEN_EMOJI)
      expect(document.querySelector("#play-trail-strip .strip-region").textContent).toBe("🌉")
      expect(document.querySelector("#play-trail-strip .strip-region-name").textContent).toBe(
        "Triple Bridge",
      )
    })

    test("gated appends a sixth marker after the region's five spaces", () => {
      // The real blocked state: the token sits on the last space of the region,
      // so the gate belongs to the space after the five this region owns. The
      // old in-loop `i === indexInRegion + 1` test asked for index 5 of a
      // five-iteration loop and drew nothing at all.
      ui.renderPlayTrailStrip({ ...strip, indexInRegion: TRAIL.SPACES_PER_REGION - 1, gated: true })
      const container = document.getElementById("play-trail-strip")
      const spaces = Array.from(container.querySelectorAll(".strip-space"))
      expect(spaces).toHaveLength(TRAIL.SPACES_PER_REGION + 1)
      const gates = container.querySelectorAll(".strip-space-gate")
      expect(gates).toHaveLength(1)
      expect(gates[0]).toBe(spaces[TRAIL.SPACES_PER_REGION])
      expect(gates[0]).toBe(container.lastElementChild)
      expect(gates[0].getAttribute("aria-hidden")).toBe("true")
      expect(container.querySelectorAll(".strip-space-current")).toHaveLength(1)
    })

    test("gated draws the marker wherever the token stands in the region", () => {
      for (let index = 0; index < TRAIL.SPACES_PER_REGION; index += 1) {
        ui.renderPlayTrailStrip({ ...strip, indexInRegion: index, gated: true })
        const gates = document.querySelectorAll("#play-trail-strip .strip-space-gate")
        expect(gates).toHaveLength(1)
        expect(document.querySelectorAll("#play-trail-strip .strip-space")).toHaveLength(
          TRAIL.SPACES_PER_REGION + 1,
        )
      }
    })

    test("no gate when not gated", () => {
      ui.renderPlayTrailStrip(strip)
      expect(document.querySelectorAll("#play-trail-strip .strip-space-gate")).toHaveLength(0)
      expect(document.querySelectorAll("#play-trail-strip .strip-space")).toHaveLength(
        TRAIL.SPACES_PER_REGION,
      )
    })

    test("calling twice does not accumulate", () => {
      ui.renderPlayTrailStrip({ ...strip, gated: true })
      ui.renderPlayTrailStrip({ ...strip, gated: true })
      expect(document.querySelectorAll("#play-trail-strip .strip-space")).toHaveLength(
        TRAIL.SPACES_PER_REGION + 1,
      )
      expect(document.querySelectorAll("#play-trail-strip .strip-space-gate")).toHaveLength(1)
      expect(document.querySelectorAll("#play-trail-strip .strip-region")).toHaveLength(1)
    })
  })

  describe("formatGateMessage", () => {
    test("names the number of facts and the region", () => {
      expect(
        ui.formatGateMessage({ regionName: "Doubling Meadow", mastered: 3, required: 5 }),
      ).toBe("Master 2 more facts in Doubling Meadow to cross the bridge")
    })

    test("uses the singular for one remaining fact", () => {
      expect(ui.formatGateMessage({ regionName: "Triple Bridge", mastered: 4, required: 5 })).toBe(
        "Master 1 more fact in Triple Bridge to cross the bridge",
      )
    })

    test("says the trail has ended when nothing is required", () => {
      expect(ui.formatGateMessage({ regionName: null, mastered: 5, required: 5 })).toBe(
        "You have reached the end of the trail",
      )
    })
  })

  describe("showGateMessage", () => {
    test("shows the exact string and reveals the element", () => {
      const message = "Master 2 more facts in Doubling Meadow to cross the bridge"
      ui.showGateMessage(message)
      const el = document.getElementById("gate-message")
      expect(el.textContent).toBe(message)
      expect(el.classList.contains("hidden")).toBe(false)
      expect(el.getAttribute("aria-live")).toBe("polite")
    })

    test("accepts a plain gate view model and formats it", () => {
      ui.showGateMessage({ regionName: "Doubling Meadow", mastered: 3, required: 5 })
      expect(document.getElementById("gate-message").textContent).toBe(
        "Master 2 more facts in Doubling Meadow to cross the bridge",
      )
    })

    test("null hides the element and clears the text", () => {
      ui.showGateMessage("Blocked")
      ui.showGateMessage(null)
      const el = document.getElementById("gate-message")
      expect(el.textContent).toBe("")
      expect(el.classList.contains("hidden")).toBe(true)
    })

    test("writes the message as text, never as markup", () => {
      ui.showGateMessage("<img src=x onerror=1>")
      const el = document.getElementById("gate-message")
      expect(el.textContent).toBe("<img src=x onerror=1>")
      expect(el.querySelector("img")).toBeNull()
    })
  })

  describe("renderTrail", () => {
    test("renders eight labelled rows of five spaces", () => {
      const view = trailView()
      ui.renderTrail(view)
      const rows = Array.from(document.querySelectorAll("#trail-spaces .trail-region-row"))
      expect(rows).toHaveLength(REGIONS.length)
      expect(document.querySelectorAll("#trail-spaces .trail-space")).toHaveLength(view.totalSpaces)
      for (const row of rows) {
        expect(row.querySelectorAll(".trail-space")).toHaveLength(TRAIL.SPACES_PER_REGION)
        expect(row.querySelector(".trail-region-label").textContent).not.toBe("")
      }
      expect(rows[0].querySelector(".trail-region-label").textContent).toContain("Doubling Meadow")
    })

    test("marks exactly one current space and puts the token in it", () => {
      ui.renderTrail(trailView())
      const current = document.querySelectorAll("#trail-spaces .trail-space-current")
      expect(current).toHaveLength(1)
      expect(current[0].dataset.space).toBe("7")
      expect(current[0].querySelector(".trail-token").textContent).toBe(TOKEN_EMOJI)
    })

    test("locked and skipped regions mark their spaces", () => {
      ui.renderTrail(trailView())
      expect(document.querySelectorAll("#trail-spaces .trail-space-locked")).toHaveLength(
        2 * TRAIL.SPACES_PER_REGION,
      )
      expect(document.querySelectorAll("#trail-spaces .trail-space-skipped")).toHaveLength(
        TRAIL.SPACES_PER_REGION,
      )
    })

    test("populates the legend with one entry per state", () => {
      ui.renderTrail(trailView())
      const items = Array.from(document.querySelectorAll("#trail-legend .legend-item"))
      expect(items).toHaveLength(4)
      expect(items.map((item) => item.lastElementChild.textContent)).toEqual([
        "You are here",
        "Open",
        "Locked",
        "Skipped",
      ])
      expect(items[0].querySelector(".trail-token").textContent).toBe(TOKEN_EMOJI)
    })

    test("the current space keeps its own class inside a skipped region", () => {
      // Space 7 is in region index 1, the skipped one. Both classes must land on
      // the same element; main.css scopes .trail-space.trail-space-current so
      // the skipped rule cannot repaint over "you are here".
      ui.renderTrail(trailView({ space: 7 }))
      const current = document.querySelector("#trail-spaces .trail-space-current")
      expect(current.classList.contains("trail-space-skipped")).toBe(true)
      expect(current.getAttribute("aria-label")).toBe("Space 8, you are here, skipped")
    })

    test("rebuilds rather than appends", () => {
      ui.renderTrail(trailView())
      ui.renderTrail(trailView())
      expect(document.querySelectorAll("#trail-spaces .trail-region-row")).toHaveLength(
        REGIONS.length,
      )
      expect(document.querySelectorAll("#trail-legend .legend-item")).toHaveLength(4)
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

    test("shows the new region only when there is one", () => {
      ui.renderSessionSummary(summaryView())
      const region = document.getElementById("summary-region")
      expect(region.classList.contains("hidden")).toBe(false)
      expect(region.textContent).toContain("Triple Bridge")
      ui.renderSessionSummary(summaryView({ newRegionName: null }))
      expect(document.getElementById("summary-region").classList.contains("hidden")).toBe(true)
      expect(document.getElementById("summary-region").textContent).toBe("")
    })

    test("writes one list item per milestone and hides the list when empty", () => {
      ui.renderSessionSummary(summaryView())
      const list = document.getElementById("summary-milestones")
      expect(list.querySelectorAll("li")).toHaveLength(2)
      expect(list.classList.contains("hidden")).toBe(false)
      expect(list.textContent).toContain("10 facts right")
      ui.renderSessionSummary(summaryView({ milestoneLabels: [] }))
      expect(document.getElementById("summary-milestones").querySelectorAll("li")).toHaveLength(0)
      expect(document.getElementById("summary-milestones").classList.contains("hidden")).toBe(true)
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
    test("sets the difficulty select's value", () => {
      ui.renderSettings({ difficulty: "master", customTables: [] })
      expect(document.getElementById("difficulty-select").value).toBe("master")
    })

    test("presses exactly the named tables", () => {
      ui.renderSettings({ difficulty: "custom", customTables: [6, 7] })
      for (const table of ALL_TABLES) {
        const expected = table === 6 || table === 7
        const input = document.getElementById(`table-${table}`)
        const label = document.querySelector(`label[for="table-${table}"]`)
        expect(input.checked).toBe(expected)
        expect(label.getAttribute("aria-pressed")).toBe(String(expected))
      }
    })

    test("un-presses tables that were dropped", () => {
      ui.renderSettings({ difficulty: "custom", customTables: [6, 7] })
      ui.renderSettings({ difficulty: "custom", customTables: [9] })
      expect(document.getElementById("table-6").checked).toBe(false)
      expect(document.getElementById("table-9").checked).toBe(true)
      expect(document.querySelector('label[for="table-6"]').getAttribute("aria-pressed")).toBe(
        "false",
      )
    })

    test("shows #custom-tables-group only for the custom difficulty", () => {
      const group = document.getElementById("custom-tables-group")
      ui.renderSettings({ difficulty: "custom", customTables: [6] })
      expect(group.classList.contains("hidden")).toBe(false)
      ui.renderSettings({ difficulty: "adventurer", customTables: [6] })
      expect(group.classList.contains("hidden")).toBe(true)
      ui.renderSettings({ difficulty: "custom", customTables: [6] })
      expect(group.classList.contains("hidden")).toBe(false)
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
    test("the current trail space is scoped so skipped and locked cannot repaint it", () => {
      // All three were single-class selectors, so the later ones won at equal
      // specificity and "you are here" painted transparent or grey.
      expect(cssRule(".trail-space.trail-space-current")).toContain("background-color")
      expect(cssRule(".trail-space-current")).toBe("")
    })

    test("the marked tiles are not left faded by .disabled", () => {
      expect(cssRule(".answer-btn.correct")).toContain("opacity: 1")
      expect(cssRule(".answer-btn.incorrect")).toContain("opacity: 1")
    })

    test("a correct keypad answer has a rule to paint", () => {
      expect(cssRule("#answer-display.correct")).toContain("color: var(--tt-correct)")
    })

    test("the readout, the feedback, and the gate message do not share a cell", () => {
      expect(cssRule("#answer-display")).toContain("grid-area: readout")
      expect(cssRule("#gate-message")).toContain("grid-area: gate")

      const landscapeAt = MAIN_CSS.indexOf("@media (orientation: landscape)")
      const portrait = MAIN_CSS.slice(
        MAIN_CSS.indexOf("@media (orientation: portrait)"),
        landscapeAt,
      )
      const landscape = MAIN_CSS.slice(landscapeAt)
      for (const area of ["question", "readout", "entry", "extra", "gate"]) {
        expect(portrait).toContain(area)
        expect(landscape).toContain(area)
      }
    })

    test("the star reward has a visible start state to transition from", () => {
      expect(cssRule(".star-fly")).toContain("opacity: 1")
      expect(cssRule(".star-fly-active")).toContain("opacity: 0")
    })

    test("the frozen tiles rule the miss path depends on exists", () => {
      expect(cssRule(".answer-tiles-frozen")).toContain("pointer-events: none")
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
        bare.updateHud({ starsTotal: 1, gemsTotal: 1, streakDays: 1, flame: null, regionName: "x" })
        bare.updatePlayHud({ sessionStars: 1, sessionStreak: 1 })
        bare.updateProgressBar(1, 20)
        bare.flyStars(10)
        bare.showScreen("hub-screen")
        bare.renderQuestion(tilesChallenge())
        bare.renderQuestion(keypadChallenge())
        bare.renderTiles([1, 2, 3, 4])
        bare.clearTiles()
        bare.setTilesVisible(true)
        bare.setKeypadVisible(true)
        bare.setAnswerDisplay("42")
        bare.setAnswerDisplayVisible(true)
        bare.markAnswerDisplayCorrect("42")
        bare.freezeTiles()
        bare.showFeedback("m", "correct")
        bare.hideFeedback()
        bare.showScaffold({ rows: 2, cols: 2, product: 4, skipCounts: [2, 4], text: "x" })
        bare.highlightSkipCount(0)
        bare.hideScaffold()
        bare.renderPlayTrailStrip({
          regionName: "x",
          regionEmoji: "y",
          spacesInRegion: 5,
          indexInRegion: 0,
          gated: true,
        })
        bare.showGateMessage("blocked")
        bare.showGateMessage(null)
        bare.renderTrail(trailView())
        bare.renderMasteryGrid(masteryCells())
        bare.renderCollection(cardViews())
        bare.renderSessionSummary(summaryView())
        bare.renderSettings({ difficulty: "custom", customTables: [6] })
      }).not.toThrow()
      warn.mockRestore()
    })

    test("render methods tolerate missing view models", () => {
      expect(() => {
        ui.updateHud(null)
        ui.updatePlayHud(null)
        ui.renderQuestion(null)
        ui.renderTiles(null)
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

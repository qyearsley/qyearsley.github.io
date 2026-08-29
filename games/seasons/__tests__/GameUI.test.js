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
 *   the numbers are jsdom's, but the shape of the output is the real thing. The
 *   `_pointsAlong` group hands the method fake path objects so the real-browser
 *   branch, and its error handling, are covered too.
 * - The countdown runs on `setInterval`, so its group uses fake timers. Every
 *   other group uses real ones, because `shakeElement`'s stray timeout is
 *   harmless and faking time globally would hide it.
 *
 * The security group is the practical version of the "nothing here uses
 * innerHTML" claim in GameUI's header: every string the class writes is fed an
 * `<script>` payload, and the assertion is that it comes back as text and no
 * element was ever created.
 *
 * One thing this file must not do is inherit a rule. `renderHud` words the wilt
 * note differently under `RULES.WRONG_ANSWER = WILT` than under the other two
 * options, so the tests about that wording pin the rule they are describing
 * with `useRules` -- see helpers.js -- and say which one in their name.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"
import { CHARACTERS, getCharacter } from "../js/characters.js"
import { PLAY, WRONG_ANSWER } from "../js/constants.js"
import { GameUI } from "../js/GameUI.js"
import { buildTrail } from "../js/Journey.js"
import { getSeason, SEASON_LIST } from "../js/seasons.js"
import {
  choiceButtons,
  countLine,
  INDEX_BODY,
  madeUpSeason,
  many,
  mountIndexBody,
  one,
  pips,
  restoreRulesBetweenTests,
  resultButtons,
  summaryRows,
  useRules,
} from "./helpers.js"

const SPRING = getSeason("spring")
const SUMMER = getSeason("summer")
const WINTER = getSeason("winter")

/**
 * A season whose copy and numbers this file owns.
 *
 * Every assertion below that pins an *exact rendered sentence* runs against
 * this rather than against spring. Pinning one against spring means that
 * retuning spring's demand, or renaming its collectible, breaks a copy
 * assertion about a formatting rule that did not change -- and a suite that
 * goes red for reasons unrelated to the edit is a suite nobody runs. The real
 * seasons are still swept, but for derivation: "names its own collectible",
 * "draws one slot per item it asked for".
 */
const MADE_UP = madeUpSeason()

/**
 * Every id `GameUI.cacheElements` names, spelled out here rather than derived.
 * Deriving the list from `ui.elements` is what let the old version of the
 * caching test pass on an empty object: it compared each entry to
 * `document.getElementById(id)`, the same expression the source runs, and
 * iterated zero times if nothing had been cached at all.
 */
const CACHED_IDS = [
  "character-grid",
  "season-name",
  "demand-line",
  "villain-portrait",
  "item-count",
  "item-track",
  "wilt-note",
  "perk-note",
  "trail",
  "question-prompt",
  "question-tag",
  "choices",
  "timer",
  "timer-wrap",
  "timer-bar",
  "feedback",
  "result-title",
  "result-text",
  "result-summary",
  "result-actions",
]

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

/**
 * The `translate(Xpx, Ypx)` the token was moved with. The token moves via
 * `style.transform`, not the presentation attribute, because that is the half
 * the CSS transition animates.
 * @param {Element} element - The trail token
 * @returns {number[]} [x, y]
 */
function styleTranslateOf(element) {
  const match = /translate\(\s*(-?[\d.]+)px[\s,]+(-?[\d.]+)px\s*\)/.exec(element.style.transform)
  expect(match).not.toBeNull()
  return [Number(match[1]), Number(match[2])]
}

/** The single save/restore for the whole file. See helpers.js. */
restoreRulesBetweenTests()

beforeEach(() => {
  mountIndexBody()
  ui = new GameUI()
})

describe("the fixture", () => {
  it.each([...CACHED_IDS, "screen-character", "screen-play", "screen-result", "restart"])(
    "index.html contains #%s exactly once",
    (id) => {
      expect(document.getElementById(id)).not.toBeNull()
      expect(document.querySelectorAll(`#${id}`)).toHaveLength(1)
    },
  )

  // #item-demand and #item-label are gone: the count is one sentence in one
  // node now. Asserting their absence keeps a half-finished revert from leaving
  // three elements each holding a fragment of a sentence.
  it.each(["item-demand", "item-label"])("index.html no longer contains #%s", (id) => {
    expect(document.getElementById(id)).toBeNull()
  })

  // #item-count is the whole state of the game in one line, so it has to be
  // announced; #wilt-note deliberately is not, because #feedback already says
  // the same thing and two polite regions read it twice.
  it("puts the count in a live region and keeps the wilt note out of one", () => {
    expect(document.getElementById("item-count").getAttribute("role")).toBe("status")
    expect(document.getElementById("wilt-note").getAttribute("aria-live")).toBeNull()
    expect(document.getElementById("wilt-note").getAttribute("role")).toBeNull()
  })

  // The old version of this test compared each cached node to
  // `document.getElementById(id)` -- the same expression cacheElements runs --
  // and iterated zero times if the object were empty, so it passed whether or
  // not anything had been cached. The set and the count are asserted instead.
  it("the constructor caches exactly the ids it names, each to a real node", () => {
    expect(Object.keys(ui.elements)).toHaveLength(CACHED_IDS.length)
    expect(Object.keys(ui.elements).sort()).toEqual([...CACHED_IDS].sort())
    for (const id of CACHED_IDS) {
      expect(ui.elements[id]).toBeInstanceOf(HTMLElement)
      expect(ui.elements[id].id).toBe(id)
    }
  })

  it("constructing writes nothing to the page", () => {
    document.body.innerHTML = INDEX_BODY
    const before = document.body.innerHTML
    new GameUI()
    expect(document.body.innerHTML).toBe(before)
  })
})

describe("renderCharacterCards", () => {
  it("draws one button per character, with its name and both perk lines", () => {
    ui.renderCharacterCards(() => {})
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
    ui.renderCharacterCards(() => {})
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

  it("marks nothing pressed -- the cards are actions, not toggles", () => {
    // Choosing a card starts the season immediately, so there is no persistent
    // selected state for aria-pressed to describe. It used to be set from
    // `state.characterId`, which defaults to the banana slug, so the first card
    // announced itself as already chosen on a screen headed "Choose who makes
    // the journey". Removed rather than guarded: a guard on a truthy default
    // never fires, which is exactly how that bug survived its first fix.
    ui.renderCharacterCards(() => {})
    expect(document.querySelectorAll("#character-grid .character-card")).toHaveLength(
      CHARACTERS.length,
    )
    expect(document.querySelectorAll("#character-grid [aria-pressed]")).toHaveLength(0)
  })

  it("calls back with the id of the card that was tapped", () => {
    const onChoose = jest.fn()
    ui.renderCharacterCards(onChoose)
    document.querySelector('[data-character-id="porcupine"]').click()
    expect(onChoose).toHaveBeenCalledTimes(1)
    expect(onChoose).toHaveBeenCalledWith("porcupine")
  })

  it("rebuilds rather than appends", () => {
    ui.renderCharacterCards(() => {})
    ui.renderCharacterCards(() => {})
    expect(document.querySelectorAll("#character-grid .character-card")).toHaveLength(
      CHARACTERS.length,
    )
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
  it("gives every marker and the boss finite coordinates", () => {
    ui.renderTrail(WINTER, 9, "porcupine")
    const positioned = Array.from(
      document.querySelectorAll("#trail .trail-marker, #trail .trail-boss"),
    )
    expect(positioned).toHaveLength(WINTER.spaces + 1)
    for (const node of positioned) {
      const [x, y] = translateOf(node)
      expect(Number.isFinite(x)).toBe(true)
      expect(Number.isFinite(y)).toBe(true)
    }
  })

  // The token is placed with `style.transform`, not the presentation attribute,
  // so that the CSS transition on `.trail-token` has a property to animate.
  it("moves the token with a style transform, not the attribute", () => {
    ui.renderTrail(WINTER, 9, "porcupine")
    const token = document.querySelector("#trail .trail-token")
    expect(token.getAttribute("transform")).toBeNull()
    const [x, y] = styleTranslateOf(token)
    expect(Number.isFinite(x)).toBe(true)
    expect(Number.isFinite(y)).toBe(true)
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

  // At the boss there is no space 15 of 14 to stand on. Repeating "space 14 of
  // 14" said nothing had changed at the one moment everything had.
  it("says the trail is complete once the boss is reached", () => {
    ui.renderTrail(SPRING, SPRING.spaces, "sloth")
    expect(document.querySelector("#trail svg.trail-svg").getAttribute("aria-label")).toBe(
      "Spring trail complete — you have reached the snake woman",
    )
  })

  // Rebuilding the SVG every question is what made the CSS transitions on
  // `.trail-token` and `.trail-walked` dead code -- a transition needs an
  // element that survives while its value changes. The scene must therefore be
  // built once per season+character and only moved afterwards.
  it("reuses the canvas when only the position changed", () => {
    ui.renderTrail(SPRING, 0, "sloth")
    const canvas = document.querySelector("#trail svg.trail-svg")
    const token = document.querySelector("#trail .trail-token")
    const walked = document.querySelector("#trail .trail-walked")
    const before = styleTranslateOf(token)

    ui.renderTrail(SPRING, 5, "sloth")

    expect(document.querySelector("#trail svg.trail-svg")).toBe(canvas)
    expect(document.querySelector("#trail .trail-token")).toBe(token)
    expect(document.querySelectorAll("#trail svg")).toHaveLength(1)
    // Same node, new value -- which is exactly what a transition needs.
    expect(styleTranslateOf(token)[0]).toBeGreaterThan(before[0])
    expect(Number(walked.style.getPropertyValue("--walked"))).toBeCloseTo(5 / SPRING.spaces)
    expect(document.querySelectorAll("#trail .trail-marker.is-done")).toHaveLength(5)
  })

  it.each([
    ["the character changes", () => ui.renderTrail(SPRING, 5, "phoenix")],
    ["the season changes", () => ui.renderTrail(WINTER, 5, "sloth")],
  ])("rebuilds the canvas when %s", (_what, rerender) => {
    ui.renderTrail(SPRING, 0, "sloth")
    const canvas = document.querySelector("#trail svg.trail-svg")
    rerender()
    expect(document.querySelector("#trail svg.trail-svg")).not.toBe(canvas)
    expect(document.querySelectorAll("#trail svg")).toHaveLength(1)
  })

  it("rebuilds when the host was emptied behind its back", () => {
    ui.renderTrail(SPRING, 0, "sloth")
    document.getElementById("trail").replaceChildren()
    ui.renderTrail(SPRING, 1, "sloth")
    expect(document.querySelectorAll("#trail svg.trail-svg")).toHaveLength(1)
    expect(document.querySelectorAll("#trail .trail-marker")).toHaveLength(SPRING.spaces)
  })

  // `getTotalLength()` on a detached path returns 0 in some engines, and
  // `_pointsAlong` reads 0 as "unsupported" and drops to the straight-line
  // fallback meant for jsdom -- putting every marker in a row across a wavy
  // path, with no error anywhere. So the canvas has to be in the document first.
  it("measures the path only after the canvas is in the document", () => {
    // Read at call time, not afterwards: by the time the assertion runs the
    // canvas is attached either way, so a spy that only records the argument
    // would pass whichever order the source used.
    const original = ui._pointsAlong.bind(ui)
    let connectedWhenMeasured = null
    jest.spyOn(ui, "_pointsAlong").mockImplementation((path, ...rest) => {
      connectedWhenMeasured = path.isConnected
      return original(path, ...rest)
    })

    ui.renderTrail(SPRING, 0, "sloth")

    expect(ui._pointsAlong).toHaveBeenCalledTimes(1)
    expect(connectedWhenMeasured).toBe(true)
    ui._pointsAlong.mockRestore()
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

// `_pointsAlong` is the one place the game depends on real SVG geometry, and
// jsdom provides none -- so without a fake path the only branch these tests
// ever reached was the straight-line fallback. These hand the method path-shaped
// stubs so the measured branch, the zero-length branch, and the catch around
// `getTotalLength` are all exercised.
describe("_pointsAlong", () => {
  /**
   * A path stub that reports geometry the way a browser would.
   * @param {number} total - What `getTotalLength` should report
   * @returns {Object} A path-shaped stub
   */
  function fakePath(total) {
    return {
      getTotalLength: () => total,
      // A straight diagonal, so a point is trivially predictable from its
      // distance along the path.
      getPointAtLength: (length) => ({ x: length, y: length * 2 }),
    }
  }

  it("walks the real path geometry when the browser provides it", () => {
    const points = ui._pointsAlong(fakePath(100), 5, 1000, 220)
    expect(points).toEqual([
      { x: 0, y: 0 },
      { x: 25, y: 50 },
      { x: 50, y: 100 },
      { x: 75, y: 150 },
      { x: 100, y: 200 },
    ])
  })

  it("asks for a single point at the start when only one is wanted", () => {
    expect(ui._pointsAlong(fakePath(100), 1, 1000, 220)).toEqual([{ x: 0, y: 0 }])
  })

  // A detached path reports 0 in some engines, and a season could in principle
  // hand back a degenerate curve. Either way the markers must still land
  // somewhere sensible rather than all on top of each other.
  it("falls back to an even line when the path measures zero", () => {
    const points = ui._pointsAlong(fakePath(0), 3, 900, 200)
    expect(points).toEqual([
      { x: 0, y: 100 },
      { x: 450, y: 100 },
      { x: 900, y: 100 },
    ])
  })

  // Firefox throws on `getTotalLength()` for a path that has never been laid
  // out. The catch around it is real error handling, and an uncaught throw here
  // would take the whole trail down mid-season.
  it("falls back rather than propagating a throwing getTotalLength", () => {
    const exploding = {
      getTotalLength: () => {
        throw new Error("NS_ERROR_FAILURE")
      },
      getPointAtLength: () => {
        throw new Error("should never be reached")
      },
    }
    let points
    expect(() => {
      points = ui._pointsAlong(exploding, 3, 900, 200)
    }).not.toThrow()
    expect(points).toEqual([
      { x: 0, y: 100 },
      { x: 450, y: 100 },
      { x: 900, y: 100 },
    ])
  })

  it.each([[null], [undefined], [{}]])(
    "falls back for %p, which has no geometry at all",
    (path) => {
      const points = ui._pointsAlong(path, 2, 400, 100)
      expect(points).toEqual([
        { x: 0, y: 50 },
        { x: 400, y: 50 },
      ])
    },
  )
})

describe("renderHud", () => {
  it("writes the season's own name, demand line and collectible", () => {
    ui.renderHud(hudState({ items: 4 }), SPRING)
    expect(document.getElementById("season-name").textContent).toBe(SPRING.name)
    expect(document.getElementById("demand-line").textContent).toBe(SPRING.demandText)
    expect(countLine()).toBe(`4 of ${SPRING.demand} ${many(SPRING)} — ${SPRING.demand - 4} to go`)
    expect(document.querySelector("#villain-portrait svg")).not.toBeNull()
  })

  // Every real season, so none can be half-wired: the sentence has to carry
  // that season's own demand and that season's own noun, not spring's.
  it.each(SEASON_LIST.map((season) => [season.id, season]))(
    "%s names its own collectible and its own demand",
    (_id, season) => {
      ui.renderHud(hudState({ items: 2 }), season)
      expect(countLine()).toContain(many(season))
      expect(countLine()).toContain(String(season.demand))
      expect(document.getElementById("season-name").textContent).toBe(season.name)
    },
  )

  // The exact sentence, pinned -- and pinned against MADE_UP rather than
  // spring, so retuning a real season cannot break a test about wording.
  //
  // One sentence in one live region. Three elements each holding a fragment
  // ("9", "of", "13", "Diamonds") announce as disconnected words, and the count
  // -- the whole state of the game -- sat in no live region at all, so it
  // changed silently.
  //
  // "1 to go" then "0 to go" would be a strange way to tell a child she is
  // finished, so the last clause changes rather than counting to zero.
  it.each([
    [0, "0 of 6 pebbles — 6 to go"],
    [1, "1 of 6 pebbles — 5 to go"],
    [5, "5 of 6 pebbles — 1 to go"],
    [6, "6 of 6 pebbles — she has enough"],
    [7, "7 of 6 pebbles — she has enough"],
    [40, "40 of 6 pebbles — she has enough"],
  ])("%i items reads %p", (items, sentence) => {
    ui.renderHud(hudState({ items }), MADE_UP)
    expect(countLine()).toBe(sentence)
  })

  // The noun follows the demand, not the count: "0 of 1 pebble", never "0 of 1
  // pebbles". No shipped season asks for one, but the sentence has to survive a
  // retune to one.
  it("uses the singular noun for a season that asks for one item", () => {
    ui.renderHud(hudState({ items: 0 }), madeUpSeason({ demand: 1 }))
    expect(countLine()).toBe("0 of 1 pebble — 1 to go")
  })

  // Visibility follows `state.wilting` alone, whichever wrong-answer rule is
  // in force -- only the wording of the note changes with the rule, and that is
  // pinned in the two blocks below.
  it("shows the wilt note only when something is wilting", () => {
    const note = document.getElementById("wilt-note")
    ui.renderHud(hudState({ wilting: 0 }), MADE_UP)
    expect(note.classList.contains("hidden")).toBe(true)

    ui.renderHud(hudState({ items: 3, wilting: 1 }), MADE_UP)
    expect(note.classList.contains("hidden")).toBe(false)
    expect(note.textContent).toContain(`1 ${one(MADE_UP)}`)

    ui.renderHud(hudState({ items: 3, wilting: 2 }), MADE_UP)
    expect(note.textContent).toContain(`2 ${many(MADE_UP)}`)

    ui.renderHud(hudState({ wilting: 0 }), MADE_UP)
    expect(note.classList.contains("hidden")).toBe(true)
  })

  // The wilt rule is the only one that gives an item back, so it is the only
  // one whose note may promise it. Pinned rather than inherited: which rule
  // ships is still an open question.
  describe("under the wilt rule", () => {
    useRules({ wrongAnswer: WRONG_ANSWER.WILT })

    it("the wilt note says the next right answer brings the items back", () => {
      const note = document.getElementById("wilt-note")
      ui.renderHud(hudState({ items: 3, wilting: 1 }), MADE_UP)
      expect(note.textContent).toBe(
        `1 ${one(MADE_UP)} wilting — get the next one right to bring it back`,
      )

      ui.renderHud(hudState({ items: 3, wilting: 2 }), MADE_UP)
      expect(note.textContent).toBe(
        `2 ${many(MADE_UP)} wilting — get the next one right to bring them back`,
      )
    })
  })

  // Under the other two options nothing comes back, so the note only warns.
  // Step-back never leaves anything wilting in a real run, but `renderHud` is
  // handed whatever state it is handed and must not promise a revival that the
  // active rule will not deliver.
  describe("under the step-back rule", () => {
    useRules({ wrongAnswer: WRONG_ANSWER.STEP_BACK })

    it("the wilt note only says the items are at risk", () => {
      const note = document.getElementById("wilt-note")
      ui.renderHud(hudState({ items: 3, wilting: 1 }), MADE_UP)
      expect(note.textContent).toBe(`1 ${one(MADE_UP)} at risk`)

      ui.renderHud(hudState({ items: 3, wilting: 2 }), MADE_UP)
      expect(note.textContent).toBe(`2 ${many(MADE_UP)} at risk`)
      expect(note.textContent).not.toContain("back")
    })
  })

  it("names the season's own collectible in the wilt note", () => {
    ui.renderHud(hudState({ items: 3, wilting: 2 }), SUMMER)
    expect(document.getElementById("wilt-note").textContent).toContain(many(SUMMER))
  })

  it("shows the perk note only while the perk is still in hand", () => {
    const note = document.getElementById("perk-note")
    // The perk's name comes from the roster; the ": N free mistake(s) left"
    // half is this screen's own copy, so that is the half pinned literally.
    const perk = getCharacter("phoenix").perkName
    ui.renderHud(hudState({ characterId: "phoenix", forgivenessLeft: 0 }), SPRING)
    expect(note.classList.contains("hidden")).toBe(true)

    ui.renderHud(hudState({ characterId: "phoenix", forgivenessLeft: 1 }), SPRING)
    expect(note.classList.contains("hidden")).toBe(false)
    expect(note.textContent).toBe(`${perk}: 1 free mistake left`)

    ui.renderHud(hudState({ characterId: "phoenix", forgivenessLeft: 3 }), SPRING)
    expect(note.textContent).toBe(`${perk}: 3 free mistakes left`)

    ui.renderHud(hudState({ characterId: "phoenix", forgivenessLeft: 0 }), SPRING)
    expect(note.classList.contains("hidden")).toBe(true)
  })

  it("leaves the HUD untouched for a null season", () => {
    ui.renderHud(hudState({ items: 4 }), MADE_UP)
    const drawn = countLine()
    ui.renderHud(hudState({ items: 9 }), null)
    expect(countLine()).toBe(drawn)
    expect(pips().filter((pip) => pip.classList.contains("is-earned"))).toHaveLength(4)
  })
})

// The art pack has always exported `item()` and drawn a rose, a diamond, a leaf
// and an icicle -- and until now nothing ever called it. A child told to fetch
// eleven roses was shown the numeral 11. This group protects the game's central
// metaphor actually being on screen, and it is also the only place the wilt rule
// becomes visible rather than an item silently leaving a count.
describe("renderItemTrack", () => {
  /** How many pips carry a given state class. */
  const countOf = (className) => pips().filter((pip) => pip.classList.contains(className)).length

  // The demand is this file's own number, so the assertion is not `pips ===
  // season.demand` restating GameUI's own expression back at it.
  it.each([1, 6, 13, 30])("draws %i slots for a season that asks for that many", (demand) => {
    ui.renderItemTrack(hudState(), madeUpSeason({ demand }))
    expect(pips()).toHaveLength(demand)
  })

  // ...and every real season is swept for free, so none can be wired to
  // another season's demand.
  it.each(SEASON_LIST.map((season) => [season.id, season]))(
    "%s draws one slot per item she asked for",
    (_id, season) => {
      ui.renderItemTrack(hudState(), season)
      expect(pips()).toHaveLength(season.demand)
    },
  )

  // Slots grow past the demand if she overshoots, so a good run still shows
  // every item rather than capping at the quota and hiding the surplus.
  it.each([
    [12, 0, 12],
    [11, 3, 14],
    [0, 15, 15],
  ])("grows to %i earned plus %i wilting = %i slots", (items, wilting, slots) => {
    ui.renderItemTrack(hudState({ items, wilting }), SPRING)
    expect(pips()).toHaveLength(slots)
  })

  it.each([
    [0, 0],
    [1, 0],
    [4, 2],
    [9, 2],
  ])("fills %i earned and %i wilting slots, leaving the rest empty", (items, wilting) => {
    ui.renderItemTrack(hudState({ items, wilting }), SPRING)
    expect(countOf("is-earned")).toBe(items)
    expect(countOf("is-wilting")).toBe(wilting)
    // Earned first, then wilting, then the outlines she still owes.
    const state = pips().map((pip) =>
      pip.classList.contains("is-earned")
        ? "earned"
        : pip.classList.contains("is-wilting")
          ? "wilting"
          : "empty",
    )
    expect(state.slice(0, items).every((s) => s === "earned")).toBe(true)
    expect(state.slice(items, items + wilting).every((s) => s === "wilting")).toBe(true)
    expect(state.slice(items + wilting).every((s) => s === "empty")).toBe(true)
  })

  it("puts the season's own drawing in a filled slot and nothing in an empty one", () => {
    ui.renderItemTrack(hudState({ items: 2, wilting: 1 }), SPRING)
    const filled = pips().slice(0, 3)
    const empty = pips().slice(3)
    for (const pip of filled) {
      expect(pip.querySelector("svg.item-svg")).not.toBeNull()
    }
    for (const pip of empty) {
      expect(pip.querySelector("svg")).toBeNull()
      expect(pip.childElementCount).toBe(0)
    }
    expect(empty.length).toBeGreaterThan(0)
  })

  it("draws each season with its own item art", () => {
    ui.renderItemTrack(hudState({ items: 1 }), SPRING)
    const spring = pips()[0].querySelector("svg").innerHTML
    ui.renderItemTrack(hudState({ items: 1 }), WINTER)
    expect(pips()[0].querySelector("svg").innerHTML).not.toBe(spring)
  })

  // 21 announced slots would bury the one sentence that already says the same
  // thing, so the track is decorative.
  it("is hidden from the accessibility tree, because the count already says it", () => {
    expect(document.getElementById("item-track").getAttribute("aria-hidden")).toBe("true")
  })

  it("rebuilds rather than appends", () => {
    ui.renderItemTrack(hudState({ items: 5 }), SPRING)
    ui.renderItemTrack(hudState({ items: 2 }), SPRING)
    expect(pips()).toHaveLength(SPRING.demand)
    expect(countOf("is-earned")).toBe(2)
  })

  it("draws nothing for a null season rather than throwing", () => {
    ui.renderItemTrack(hudState({ items: 3 }), SPRING)
    expect(() => ui.renderItemTrack(hudState({ items: 3 }), null)).not.toThrow()
    expect(pips()).toHaveLength(SPRING.demand)
  })

  it("treats negative counts as none rather than drawing backwards", () => {
    ui.renderItemTrack(hudState({ items: -4, wilting: -2 }), SPRING)
    expect(pips()).toHaveLength(SPRING.demand)
    expect(countOf("is-earned")).toBe(0)
    expect(countOf("is-wilting")).toBe(0)
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

  // The 1-4 keyboard shortcut is registered in index.html but is otherwise
  // undiscoverable: a screen reader reading "73, 72, 74, 83" gives no hint that
  // pressing 3 picks the third. The label says which digit goes with which
  // answer, and the number is the button's own position, not the value.
  it("labels each button with the number key that presses it", () => {
    ui.renderQuestion(questionState(), false, false, () => {})
    expect(choiceButtons().map((button) => button.getAttribute("aria-label"))).toEqual([
      "Answer 1: 73",
      "Answer 2: 72",
      "Answer 3: 74",
      "Answer 4: 83",
    ])
  })

  it("renumbers the labels when the next question arrives", () => {
    ui.renderQuestion(questionState(), false, false, () => {})
    ui.renderQuestion(questionState({ choices: [56, 54, 63, 48] }), false, false, () => {})
    expect(choiceButtons().map((button) => button.getAttribute("aria-label"))).toEqual([
      "Answer 1: 56",
      "Answer 2: 54",
      "Answer 3: 63",
      "Answer 4: 48",
    ])
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

  // `aria-disabled` rather than `disabled`. Disabling the element that currently
  // has focus drops focus to <body> in every browser, so a keyboard user had to
  // tab in from the top of the document before every single question. This says
  // the buttons are spent; the `answering` guard in game.js is what enforces it.
  it("locks every button without disabling any of them", () => {
    ui.flashAnswer(correct, choiceButtons()[0], 73, "Right!")
    const buttons = choiceButtons()
    expect(buttons).toHaveLength(PLAY.CHOICE_COUNT)
    expect(buttons.every((button) => button.getAttribute("aria-disabled") === "true")).toBe(true)
    expect(buttons.every((button) => button.classList.contains("is-locked"))).toBe(true)
    expect(buttons.every((button) => button.disabled === false)).toBe(true)
  })

  // The regression this replaces: `button.disabled = true` on the focused
  // button moved focus to <body>, so every question started with focus nowhere.
  // jsdom does not itself blur a disabled element, so the `disabled` assertion
  // is what actually holds the line here; the focus assertion states the intent.
  it("leaves focus exactly where it was", () => {
    const buttons = choiceButtons()
    buttons[2].focus()
    expect(document.activeElement).toBe(buttons[2])
    ui.flashAnswer(wrong, buttons[2], 73, "Not quite.")
    expect(document.activeElement).toBe(buttons[2])
    expect(document.activeElement).not.toBe(document.body)
    expect(buttons.every((button) => button.disabled === false)).toBe(true)
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
    expect(document.querySelectorAll("#choices .is-locked")).toHaveLength(PLAY.CHOICE_COUNT)
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
    expect(document.querySelectorAll("#choices .is-locked")).toHaveLength(0)
    expect(choiceButtons().every((button) => button.getAttribute("aria-disabled") === null)).toBe(
      true,
    )
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

  // The default summary's exact labels, pinned against MADE_UP so the wording
  // is asserted without a real season's collectible being baked in.
  it("builds the four summary rows, each a label and a value", () => {
    ui.renderResult(resultState(), MADE_UP, [], "t", "x")
    const rows = Array.from(document.querySelectorAll("#result-summary .summary-row"))
    expect(rows).toHaveLength(4)
    expect(summaryRows()).toEqual([
      ["Pebbles delivered", "11"],
      ["She asked for", String(MADE_UP.demand)],
      ["Questions right", "12 of 15"],
      ["Best streak", "6"],
    ])
    for (const row of rows) {
      expect(row.lastElementChild.tagName).toBe("STRONG")
    }
  })

  it("labels the first row with the season's own collectible", () => {
    ui.renderResult(resultState(), SUMMER, [], "t", "x")
    expect(summaryRows()[0][0]).toBe(`${SUMMER.itemPlural} delivered`)
  })

  it("adds a fifth row only when something was lost for good", () => {
    ui.renderResult(resultState({ lost: 3 }), MADE_UP, [], "t", "x")
    const rows = Array.from(document.querySelectorAll("#result-summary .summary-row"))
    expect(rows).toHaveLength(5)
    expect(rows[4].textContent).toBe("Pebbles lost3")
  })

  // The run-complete screen passes its own rows. Every per-season counter has
  // been reset three times by the time the potion is finished, so the default
  // summary reported winter's figures under "Every season, delivered".
  it("uses the rows it is handed instead of the season default", () => {
    // Arbitrary rows: `renderResult` must draw whatever it is handed. What
    // game.js actually passes is asserted in game.test.js.
    const rows = [
      ["First — pebbles", "18"],
      ["Second — cobbles", "21"],
      ["Best streak", "9"],
    ]
    ui.renderResult(
      resultState(),
      SPRING,
      [],
      "The potion is finished",
      "She says you passed.",
      rows,
    )
    const drawn = Array.from(document.querySelectorAll("#result-summary .summary-row"))
    expect(drawn).toHaveLength(3)
    expect(summaryRows()).toEqual(rows)
    // None of the season default leaked through.
    expect(document.getElementById("result-summary").textContent).not.toContain("She asked for")
    for (const row of drawn) {
      expect(row.lastElementChild.tagName).toBe("STRONG")
    }
  })

  it("draws explicit rows even with no season to fall back on", () => {
    ui.renderResult(resultState(), null, [], "t", "x", [["Best streak", "4"]])
    const drawn = Array.from(document.querySelectorAll("#result-summary .summary-row"))
    expect(drawn).toHaveLength(1)
    expect(drawn[0].textContent).toBe("Best streak4")
  })

  it("falls back to the season default when rows are omitted or null", () => {
    ui.renderResult(resultState(), MADE_UP, [], "t", "x", null)
    const drawn = Array.from(document.querySelectorAll("#result-summary .summary-row"))
    expect(drawn).toHaveLength(4)
    expect(drawn[0].textContent).toBe("Pebbles delivered11")
  })

  it("builds one button per action, in order, and marks the primary one", () => {
    const list = actions()
    ui.renderResult(resultState(), SPRING, list, "t", "x")
    const buttons = resultButtons()
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
    const buttons = resultButtons()
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
  // The old version of this test derived its expectation from
  // `ui.pack.palette(...)` -- the same call the source makes -- so it agreed
  // with the source whatever either of them said, and passed on an empty
  // palette. Concrete values, and a count, are asserted instead.
  it("sets spring's actual custom properties on the root and records the season", () => {
    ui.applyPalette(SPRING)
    const root = document.documentElement
    expect(root.dataset.season).toBe("spring")
    expect(root.style.getPropertyValue("--season-sky")).toBe("#dff3e4")
    expect(root.style.getPropertyValue("--season-ground")).toBe("#6fae82")
    expect(root.style.getPropertyValue("--season-accent")).toBe("#e8657f")
    expect(root.style.getPropertyValue("--season-ink")).toBe("#2b3d31")
  })

  it("writes every property the pack offers, and the pack offers some", () => {
    const palette = ui.pack.palette("winter")
    expect(Object.keys(palette).length).toBeGreaterThanOrEqual(8)
    ui.applyPalette(WINTER)
    const root = document.documentElement
    for (const [property, value] of Object.entries(palette)) {
      expect(property.startsWith("--season-")).toBe(true)
      expect(value).not.toBe("")
      expect(root.style.getPropertyValue(property)).toBe(value)
    }
  })

  it("replaces the previous season's palette rather than merging it", () => {
    ui.applyPalette(SPRING)
    ui.applyPalette(WINTER)
    expect(document.documentElement.dataset.season).toBe("winter")
    expect(document.documentElement.style.getPropertyValue("--season-sky")).toBe("#e7eff7")
    expect(document.documentElement.style.getPropertyValue("--season-accent")).toBe("#4f6f96")
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

  // The count sentence embeds the item name rather than being it, so the
  // payload is a substring here rather than the whole value.
  it.each(["item-count", "wilt-note"])("#%s embeds a hostile item name as text", (id) => {
    ui.renderHud(hudState({ items: 1, wilting: 1 }), evilSeason)
    const element = document.getElementById(id)
    expect(element.textContent).toContain(XSS.toLowerCase())
    expect(element.children).toHaveLength(0)
    expectNoInjection()
  })

  it("a summary row built from caller-supplied text stays text", () => {
    ui.renderResult(resultState(), SPRING, [], "t", "x", [[XSS, XSS]])
    const row = document.querySelector("#result-summary .summary-row")
    expect(row.firstElementChild.textContent).toBe(XSS)
    expect(row.lastElementChild.textContent).toBe(XSS)
    expect(row.firstElementChild.children).toHaveLength(0)
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
      bare.renderCharacterCards(() => {})
      bare.renderTrail(SPRING, 2, "sloth")
      bare.renderHud(hudState(), SPRING)
      bare.renderItemTrack(hudState({ items: 2, wilting: 1 }), SPRING)
      bare.renderQuestion(questionState(), true, false, () => {})
      bare.flashAnswer({ correct: false }, null, 73, "x")
      bare.startTimer(null, () => {})
      bare.stopTimer()
      bare.renderResult(resultState(), SPRING, [{ label: "x", onClick: () => {} }], "t", "x")
      bare.focusHeading("screen-play")
    }).not.toThrow()
  })
})

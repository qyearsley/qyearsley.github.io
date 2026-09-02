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
 * - jsdom implements no Web Animations API, so `window.Element.prototype.animate` does
 *   not exist. `crossObstacle` and `_panCamera` both check for it and place
 *   things instantly instead, so that fallback is what runs by default here and
 *   the trail group asserts against it. The animated paths are covered too, by
 *   the crossing group, which installs an `animate` stub returning a fake
 *   animation it can inspect and finish on demand -- once for the full crossing
 *   and once for the shorter one `prefers-reduced-motion` asks for. Those are
 *   two conditions with the same historical fallback, and they are two groups
 *   here for exactly that reason: folded together, whichever one was checked
 *   second would stop being checked at all. No SVG geometry is measured
 *   anywhere in the source any more -- `layout` returns positions outright --
 *   so the coordinates asserted below are the real ones a browser would use.
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
import { buildTrail, kindAt } from "../js/Journey.js"
import { getObstacle, isHardKind } from "../js/obstacles.js"
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
  "journey-so-far",
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
  "result-haul",
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

/** The trail's `<svg>`, which is also the node carrying the accessible label. */
const trailCanvas = () => document.querySelector("#trail svg.trail-svg")

/** The one group everything that moves with the ground lives in. */
const trailCamera = () => document.querySelector("#trail .trail-camera")

/** The backdrop's planes, back to front. Each pans at its own rate. */
const trailLayers = () => Array.from(document.querySelectorAll("#trail .trail-layer"))

/**
 * How far one group has been panned, in user units. Negative means panned to
 * the right, which is the only direction the walk goes; 0 is the start.
 * @param {Element} group - A camera or backdrop-layer group
 * @returns {number} The signed shift
 */
function shiftOf(group) {
  const match = /translateX\(\s*(-?[\d.]+)px\s*\)/.exec(group.style.transform)
  expect(match).not.toBeNull()
  return Number(match[1])
}

/** The character's group on the trail. */
const trailToken = () => document.querySelector("#trail .trail-token")

/** One group per space, in the order they were drawn. */
const trailObstacles = () => Array.from(document.querySelectorAll("#trail .trail-obstacle"))

/**
 * How far the camera has scrolled the landscape, in user units. Negative means
 * panned to the right, which is the only direction the walk goes; 0 is the start
 * of the trail.
 * @returns {number} The signed shift
 */
function cameraShift() {
  return shiftOf(trailCamera())
}

/**
 * A season-shaped object with a route this file owns.
 *
 * `madeUpSeason` predates routes, and the real seasons derive `spaces` and
 * `glowingAt` from theirs at module load -- a hand-made one has to do the same
 * derivation or the three fields disagree, which is the bug the derivation
 * exists to prevent. Used wherever a test pins an exact sentence or an exact
 * order of obstacles, for the reason MADE_UP exists at all.
 *
 * @param {string[]} route - One obstacle kind per space
 * @param {Object} [overrides] - Any other season field to replace
 * @returns {Object} A Season-shaped object
 */
function routedSeason(route, overrides = {}) {
  return madeUpSeason({
    route,
    spaces: route.length,
    glowingAt: route.flatMap((kind, index) => (isHardKind(kind) ? [index] : [])),
    ...overrides,
  })
}

/**
 * Swap the UI's art pack for a copy whose functions can be watched.
 *
 * `ui.pack` is an ES module namespace object, whose properties are read-only, so
 * `jest.spyOn` cannot touch it. Spreading it into a plain object gives something
 * mutable that still runs the real implementations.
 *
 * @param {GameUI} target - The instance to re-pack
 * @returns {Object<string, Function>} The watched functions, by name
 */
function watchPack(target) {
  const spies = {
    layout: jest.fn(target.pack.layout),
    obstacle: jest.fn(target.pack.obstacle),
    traversal: jest.fn(target.pack.traversal),
    reducedTraversal: jest.fn(target.pack.reducedTraversal),
    standing: jest.fn(target.pack.standing),
  }
  target.pack = { ...target.pack, ...spies }
  return spies
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

describe("renderJourneySoFar", () => {
  const saveWith = (overrides = {}) => ({
    unlocked: [SEASON_LIST[0].id],
    totals: { runsCompleted: 0, seasonsCleared: 0, questionsAnswered: 0, questionsCorrect: 0 },
    ...overrides,
  })
  const panel = () => document.getElementById("journey-so-far")
  const entries = () => Array.from(panel().querySelectorAll(".journey-season"))

  it("lists every season in play order, so the four are visible at all", () => {
    ui.renderJourneySoFar(saveWith(), SEASON_LIST)
    expect(entries()).toHaveLength(SEASON_LIST.length)
    entries().forEach((item, index) => {
      expect(item.querySelector(".journey-ordinal").textContent).toBe(String(index + 1))
      expect(item.querySelector(".journey-season-name").textContent).toBe(SEASON_LIST[index].name)
    })
  })

  it("marks only the unlocked seasons as open", () => {
    const open = [SEASON_LIST[0].id, SEASON_LIST[1].id]
    ui.renderJourneySoFar(saveWith({ unlocked: open }), SEASON_LIST)
    const flags = entries().map((item) => item.classList.contains("is-open"))
    expect(flags).toEqual(SEASON_LIST.map((season) => open.includes(season.id)))
  })

  it("says open or not in words, since the styling alone says it only in colour", () => {
    ui.renderJourneySoFar(saveWith(), SEASON_LIST)
    const said = entries().map((item) => item.querySelector(".visually-hidden").textContent)
    expect(said[0]).toContain("open")
    expect(said[1]).toContain("not reached")
  })

  // Four zeros on a first run would read as a report card rather than a start.
  it("leaves the totals off entirely until a question has been answered", () => {
    ui.renderJourneySoFar(saveWith(), SEASON_LIST)
    expect(panel().querySelector(".journey-totals")).toBeNull()
  })

  it("states the lifetime counts once there are any", () => {
    const totals = {
      runsCompleted: 2,
      seasonsCleared: 3,
      questionsAnswered: 128,
      questionsCorrect: 112,
    }
    ui.renderJourneySoFar(saveWith({ totals }), SEASON_LIST)
    const text = panel().querySelector(".journey-totals").textContent
    expect(text).toContain("128")
    expect(text).toContain("112")
    expect(text).toContain("3 seasons")
  })

  it("says season, not seasons, for exactly one", () => {
    const totals = {
      runsCompleted: 1,
      seasonsCleared: 1,
      questionsAnswered: 20,
      questionsCorrect: 18,
    }
    ui.renderJourneySoFar(saveWith({ totals }), SEASON_LIST)
    expect(panel().querySelector(".journey-totals").textContent).toContain("1 season.")
  })

  it("draws nothing at all without a save, rather than a panel of blanks", () => {
    ui.renderJourneySoFar(null, SEASON_LIST)
    expect(panel().children).toHaveLength(0)
  })
})

describe("renderTrail", () => {
  it("draws a canvas under jsdom, which implements no Web Animations API", () => {
    // The absent `animate` is what makes instant placement the branch this
    // group exercises; the crossing group installs a stub for the other one.
    expect(typeof document.createElementNS("http://www.w3.org/2000/svg", "g").animate).toBe(
      "undefined",
    )
    expect(() => ui.renderTrail(SPRING, 0, "sloth")).not.toThrow()
    expect(trailCanvas()).not.toBeNull()
  })

  // Panning one group is how the ground scrolls, because a viewBox cannot be
  // animated and a transform can. Anything that belongs to the ground and was
  // left outside that group would sit still while the landscape moved past it.
  // The backdrop's planes are the deliberate exception: they are siblings, not
  // children, because each of them moves at a different rate.
  it("puts everything that moves with the ground inside a single camera group", () => {
    ui.renderTrail(SPRING, 0, "sloth")
    const cameras = document.querySelectorAll("#trail .trail-camera")
    expect(cameras).toHaveLength(1)
    for (const selector of [
      ".trail-ground",
      ".trail-ground-edge",
      ".trail-obstacle",
      ".trail-boss",
      ".trail-token",
    ]) {
      const nodes = Array.from(document.querySelectorAll(`#trail ${selector}`))
      expect(nodes.length).toBeGreaterThan(0)
      for (const node of nodes) expect(node.parentElement).toBe(cameras[0])
    }
    // Backdrop planes first and the camera last, so everything the pack calls
    // backdrop is painted behind the ground rather than over it.
    const children = Array.from(trailCanvas().children)
    expect(children[children.length - 1]).toBe(cameras[0])
    for (const node of children.slice(0, -1)) {
      expect(node.classList.contains("trail-layer")).toBe(true)
    }
  })

  it.each([
    ["spring", SPRING],
    ["winter", WINTER],
  ])("draws one obstacle per space for %s, the kinds its route names", (_id, season) => {
    ui.renderTrail(season, 0, "sloth")
    const groups = trailObstacles()
    expect(groups).toHaveLength(season.spaces)
    expect(buildTrail(season)).toHaveLength(season.spaces)
    groups.forEach((group, index) => {
      // The drawing is the group's last child; a glowing space puts a halo
      // behind it. Compared as markup, because the pack hands back a fresh
      // element every call, and comparing it is the only thing that can fail
      // when a trail draws the same obstacle everywhere.
      expect(group.lastElementChild.outerHTML).toBe(
        ui.pack.obstacle(season.route[index], season.id).element.outerHTML,
      )
    })
  })

  it("stands each obstacle exactly where the layout put it", () => {
    const plan = ui.pack.layout(SPRING)
    ui.renderTrail(SPRING, 0, "sloth")
    expect(trailObstacles().map((group) => translateOf(group))).toEqual(
      plan.obstacles.map((spot) => [spot.x, spot.y]),
    )
  })

  // `glowing` is a property of the obstacle kind now, not of the space: the
  // mountain is the hard one, so a season's glowing spaces are wherever its
  // route puts mountains.
  it("glows exactly the hard obstacles, and haloes only those", () => {
    ui.renderTrail(SPRING, 0, "sloth")
    const groups = trailObstacles()
    const glowing = groups.flatMap((group, index) =>
      group.classList.contains("is-glowing") ? [index] : [],
    )
    expect(glowing.length).toBeGreaterThan(0)
    expect(glowing).toEqual(SPRING.glowingAt)
    for (const index of glowing) expect(isHardKind(SPRING.route[index])).toBe(true)

    groups.forEach((group, index) => {
      expect(group.querySelectorAll(".obstacle-glow")).toHaveLength(glowing.includes(index) ? 1 : 0)
    })
    expect(document.querySelectorAll("#trail .obstacle-glow")).toHaveLength(glowing.length)
  })

  // One path per unbroken stretch of ground. Winter's route has gaps in it, and
  // a gap is an absence of ground rather than a dark shape drawn on top of it.
  it("draws the ground as the layout's segments, break and all", () => {
    const plan = ui.pack.layout(WINTER)
    ui.renderTrail(WINTER, 0, "sloth")
    const ground = Array.from(document.querySelectorAll("#trail .trail-ground"))
    expect(ground.map((path) => path.getAttribute("d"))).toEqual(plan.groundSegments)
    expect(ground.length).toBeGreaterThan(1)
  })

  // The band of grass, leaves or snow crust along the top of the ground. Its
  // geometry is the pack's -- it has to follow the deformed ground line into
  // every river basin and stop at the lip of every gap -- so all this checks is
  // that the paths arrive intact and are stacked in the right order.
  it("lays the ground's textured edge over the earth and under what stands on it", () => {
    const plan = ui.pack.layout(WINTER)
    ui.renderTrail(WINTER, 0, "sloth")
    const edges = Array.from(document.querySelectorAll("#trail .trail-ground-edge"))
    expect(edges.map((path) => path.getAttribute("d"))).toEqual(plan.groundEdges)
    expect(edges.length).toBeGreaterThan(1)

    const order = Array.from(trailCamera().children)
    const has = (node, name) => node.classList.contains(name)
    expect(order.findIndex((node) => has(node, "trail-ground-edge"))).toBeGreaterThan(
      order.findLastIndex((node) => has(node, "trail-ground")),
    )
    expect(order.findIndex((node) => has(node, "trail-obstacle"))).toBeGreaterThan(
      order.findLastIndex((node) => has(node, "trail-ground-edge")),
    )
  })

  // At the trail's width, not the viewport's: the backdrop scrolls with
  // everything else, so a viewport-sized one would run out halfway along.
  it("mounts one group per backdrop layer, in the order the pack gave them", () => {
    const plan = ui.pack.layout(SPRING)
    const backdrop = ui.pack.backdrop(SPRING.id, plan.width)
    ui.renderTrail(SPRING, 0, "sloth")
    const groups = trailLayers()
    expect(groups.length).toBeGreaterThan(1)
    expect(groups).toHaveLength(backdrop.layers.length)
    groups.forEach((group, index) => {
      expect(group.dataset.layer).toBe(backdrop.layers[index].name)
      expect(group.firstElementChild.outerHTML).toBe(backdrop.layers[index].element.outerHTML)
    })
  })

  // The whole point of the split. One offset, scaled by each layer's own
  // factor, so a ridge on the horizon falls behind the ground the character
  // walks on instead of keeping pace with it.
  it("pans each backdrop layer by its own share of the camera's offset", () => {
    const plan = ui.pack.layout(SPRING)
    const factors = ui.pack.backdrop(SPRING.id, plan.width).layers.map((layer) => layer.factor)
    ui.renderTrail(SPRING, 8, "sloth")
    const offset = -cameraShift()
    expect(offset).toBeGreaterThan(0)
    expect(trailLayers().map(shiftOf)).toEqual(
      // A factor of 0 is written as a plain 0 rather than the -0 the arithmetic
      // would give, which is a distinction Jest's equality cares about.
      factors.map((factor) => (factor === 0 ? 0 : -(offset * factor))),
    )
  })

  it("marks a layer that never moves, so it is not promoted for nothing", () => {
    const plan = ui.pack.layout(SPRING)
    const fixed = ui.pack
      .backdrop(SPRING.id, plan.width)
      .layers.filter((layer) => layer.factor === 0)
    ui.renderTrail(SPRING, 0, "sloth")
    const still = trailLayers().filter((group) => group.classList.contains("is-still"))
    expect(still).toHaveLength(fixed.length)
    expect(still.length).toBeGreaterThan(0)
  })

  it("keeps every layer inside the landscape it was given, at both ends", () => {
    const plan = ui.pack.layout(WINTER)
    const spans = ui.pack.backdrop(WINTER.id, plan.width).layers.map((layer) => layer.span)
    for (const position of [0, WINTER.spaces]) {
      ui.renderTrail(WINTER, position, "sloth")
      trailLayers().forEach((group, index) => {
        const shown = -shiftOf(group)
        // Never left of the landscape's start, and never past the far edge of
        // what the layer actually draws -- either would show blank canvas.
        expect(shown).toBeGreaterThanOrEqual(0)
        expect(shown + plan.viewportWidth).toBeLessThanOrEqual(spans[index])
      })
    }
  })

  it("includes a boss group and a character token", () => {
    ui.renderTrail(SPRING, 3, "phoenix")
    const boss = document.querySelector("#trail .trail-boss")
    const token = trailToken()
    expect(boss).not.toBeNull()
    expect(token).not.toBeNull()
    expect(boss.childElementCount).toBeGreaterThan(0)
    expect(token.childElementCount).toBeGreaterThan(0)
    expect(boss.firstElementChild.getAttribute("transform")).toContain("scale")
    expect(token.firstElementChild.getAttribute("transform")).toContain("scale")
  })

  it("draws the chosen character in the token", () => {
    ui.renderTrail(SPRING, 0, "phoenix")
    const art = trailToken().firstElementChild
    expect(art.innerHTML).toBe(ui.pack.character("phoenix").element.innerHTML)
    expect(art.innerHTML).not.toBe(ui.pack.character("sloth").element.innerHTML)
  })

  it("waits at the end of the trail with the boss, past the last stop", () => {
    const plan = ui.pack.layout(SPRING)
    ui.renderTrail(SPRING, 0, "sloth")
    const [x] = translateOf(document.querySelector("#trail .trail-boss"))
    expect(x).toBeGreaterThanOrEqual(plan.stops[plan.stops.length - 1].x)
    expect(x).toBeLessThanOrEqual(plan.width)
  })

  // A single NaN here stacks the whole trail in one corner, with no error.
  it("gives every obstacle and the boss finite coordinates", () => {
    ui.renderTrail(WINTER, 9, "porcupine")
    const positioned = Array.from(
      document.querySelectorAll("#trail .trail-obstacle, #trail .trail-boss"),
    )
    expect(positioned).toHaveLength(WINTER.spaces + 1)
    for (const node of positioned) {
      const [x, y] = translateOf(node)
      expect(Number.isFinite(x)).toBe(true)
      expect(Number.isFinite(y)).toBe(true)
    }
  })

  // The token moves with `style.transform`, not the presentation attribute:
  // that is the half the pack's transforms and the crossing animation both
  // write, and mixing the two would have them fight.
  it.each([0, 1, 7, 14])("stands the token on stop %i, where the pack says", (position) => {
    const plan = ui.pack.layout(SPRING)
    ui.renderTrail(SPRING, position, "sloth")
    expect(trailToken().getAttribute("transform")).toBeNull()
    expect(trailToken().style.transform).toBe(ui.pack.standing(plan.stops[position]))
  })

  it("asks the pack where to stand rather than working it out here", () => {
    const spies = watchPack(ui)
    ui.renderTrail(SPRING, 6, "sloth")
    expect(spies.standing).toHaveBeenCalledWith(ui.pack.layout(SPRING).stops[6])
  })

  it.each([[SPRING.spaces + 3], [-4]])("clamps the off-trail position %i", (position) => {
    const plan = ui.pack.layout(SPRING)
    ui.renderTrail(SPRING, position, "sloth")
    const stop = position < 0 ? plan.stops[0] : plan.stops[plan.stops.length - 1]
    expect(trailToken().style.transform).toBe(ui.pack.standing(stop))
  })

  // The camera is clamped at both ends. Without the near clamp, standing at the
  // start pans the landscape the wrong way and shows blank canvas to the left
  // of the trail; without the far clamp, the last stop scrolls off the end of
  // it. Neither throws, and neither is visible in a test that only checks the
  // character is somewhere on screen.
  it("never pans back past the start of the trail", () => {
    ui.renderTrail(SPRING, 0, "sloth")
    expect(cameraShift()).toBe(0)
  })

  it("never pans on past the end of the trail", () => {
    const plan = ui.pack.layout(SPRING)
    ui.renderTrail(SPRING, SPRING.spaces, "sloth")
    expect(cameraShift()).toBe(-(plan.width - plan.viewportWidth))
  })

  it("keeps the character in view at every stop, both ends included", () => {
    const plan = ui.pack.layout(SPRING)
    for (let position = 0; position <= SPRING.spaces; position += 1) {
      ui.renderTrail(SPRING, position, "sloth")
      const shift = cameraShift()
      expect(shift).toBeLessThanOrEqual(0)
      expect(shift).toBeGreaterThanOrEqual(-(plan.width - plan.viewportWidth))
      const onScreen = plan.stops[position].x + shift
      expect(onScreen).toBeGreaterThanOrEqual(0)
      expect(onScreen).toBeLessThanOrEqual(plan.viewportWidth)
    }
  })

  it("labels the trail with the obstacle standing at the current space", () => {
    // The exact sentence, pinned against a season this file owns.
    const season = routedSeason(["hill", "river", "mountain"])
    ui.renderTrail(season, 1, "sloth")
    expect(trailCanvas().getAttribute("role")).toBe("img")
    expect(trailCanvas().getAttribute("aria-label")).toBe(
      "Testing trail, space 2 of 3: a river to cross",
    )
  })

  // "a river to cross" is the one label the old hardcoded "to cross" also
  // produced, so it cannot tell the two apart. These can: each obstacle has to
  // contribute its own verb.
  it.each([
    ["hill", "a hill to climb"],
    ["thicket", "a thicket to push through"],
    ["boulder", "a boulder to clamber over"],
    ["gap", "a gap to leap across"],
    ["mountain", "a mountain to climb"],
  ])("says what the player does to a %s, not just 'cross'", (kind, expected) => {
    const season = routedSeason([kind, "river", "river"])
    ui.renderTrail(season, 0, "sloth")
    expect(trailCanvas().getAttribute("aria-label")).toBe(
      `Testing trail, space 1 of 3: ${expected}`,
    )
  })

  it.each(SEASON_LIST.map((season) => [season.id, season]))(
    "names %s's own obstacle at whichever space the player is on",
    (_id, season) => {
      for (const position of [0, 1, season.spaces - 1]) {
        ui.renderTrail(season, position, "sloth")
        const label = trailCanvas().getAttribute("aria-label")
        expect(label).toContain(season.name)
        expect(label).toContain(`space ${position + 1} of ${season.spaces}`)
        expect(label).toContain(getObstacle(kindAt(season, position)).name.toLowerCase())
      }
    },
  )

  // At the boss there is no space 15 of 14 to stand on. Repeating "space 14 of
  // 14" said nothing had changed at the one moment everything had.
  it("says the trail is complete once the boss is reached", () => {
    const season = routedSeason(["hill", "river", "mountain"])
    ui.renderTrail(season, season.spaces, "sloth")
    expect(trailCanvas().getAttribute("aria-label")).toBe(
      "Testing trail complete — you have reached the snake woman",
    )
  })

  // Rebuilding the scene every question would make the character teleport and
  // the landscape jump: both the camera pan and the crossing animation need
  // elements that survive while their transforms change. So it is built once
  // per season+character and only moved afterwards.
  it("reuses the canvas when only the position changed", () => {
    const plan = ui.pack.layout(SPRING)
    ui.renderTrail(SPRING, 0, "sloth")
    const canvas = trailCanvas()
    const camera = trailCamera()
    const token = trailToken()

    ui.renderTrail(SPRING, 5, "sloth")

    expect(trailCanvas()).toBe(canvas)
    expect(trailCamera()).toBe(camera)
    expect(trailToken()).toBe(token)
    expect(document.querySelectorAll("#trail svg")).toHaveLength(1)
    // Same nodes, new values -- which is exactly what an animation needs.
    expect(token.style.transform).toBe(ui.pack.standing(plan.stops[5]))
    expect(cameraShift()).toBeLessThan(0)
  })

  it("builds the scene once, not once per question", () => {
    const spies = watchPack(ui)
    ui.renderTrail(SPRING, 0, "sloth")
    expect(spies.obstacle).toHaveBeenCalledTimes(SPRING.spaces)
    ui.renderTrail(SPRING, 1, "sloth")
    ui.renderTrail(SPRING, 2, "sloth")
    expect(spies.obstacle).toHaveBeenCalledTimes(SPRING.spaces)
  })

  it.each([
    ["the character changes", () => ui.renderTrail(SPRING, 5, "phoenix")],
    ["the season changes", () => ui.renderTrail(WINTER, 5, "sloth")],
  ])("rebuilds the canvas when %s", (_what, rerender) => {
    ui.renderTrail(SPRING, 0, "sloth")
    const canvas = trailCanvas()
    rerender()
    expect(trailCanvas()).not.toBe(canvas)
    expect(document.querySelectorAll("#trail svg")).toHaveLength(1)
  })

  it("rebuilds when the host was emptied behind its back", () => {
    ui.renderTrail(SPRING, 0, "sloth")
    document.getElementById("trail").replaceChildren()
    ui.renderTrail(SPRING, 1, "sloth")
    expect(document.querySelectorAll("#trail svg.trail-svg")).toHaveLength(1)
    expect(trailObstacles()).toHaveLength(SPRING.spaces)
  })

  it("rebuilds rather than appends", () => {
    ui.renderTrail(SPRING, 0, "sloth")
    ui.renderTrail(WINTER, 5, "sloth")
    expect(document.querySelectorAll("#trail svg")).toHaveLength(1)
    expect(document.querySelectorAll("#trail .trail-camera")).toHaveLength(1)
    expect(document.querySelectorAll("#trail .trail-token")).toHaveLength(1)
    expect(trailObstacles()).toHaveLength(WINTER.spaces)
  })

  it("draws nothing at all for a null season, rather than an empty frame", () => {
    ui.renderTrail(SPRING, 0, "sloth")
    expect(() => ui.renderTrail(null, 0, "sloth")).not.toThrow()
    // The previous trail is left alone: a missing season is a caller bug, and
    // wiping the screen would hide it behind a blank page.
    expect(document.querySelectorAll("#trail svg")).toHaveLength(1)
    expect(trailObstacles()).toHaveLength(SPRING.spaces)
  })
})

// The animated half of the trail. Three branches ship and all three are
// covered: no Web Animations API at all, which is what jsdom gives by default
// and where `window.Element.prototype.animate` is simply absent; the reduced
// crossing a player who has asked for less motion gets; and the full one. The
// last two both need an `animate`, so the stub below is shared -- it hands back
// an animation a test can hold open, finish, or cancel.
describe("crossing an obstacle", () => {
  /** The stop spring's first obstacle is crossed from. */
  const FIRST = 0

  /** Every animation started since the test began, oldest first. */
  let started = []

  /**
   * A stand-in for what `Element.animate` returns. It stays "running" until
   * something finishes or cancels it, which is what lets a test hold a
   * crossing open and then assert on `skipTraversal`.
   *
   * @param {Element} element - The node being animated
   * @param {Array<Object>} keyframes - The keyframes it was handed
   * @param {Object} options - The timing it was handed
   * @returns {Object} An Animation-shaped stub
   */
  function fakeAnimation(element, keyframes, options) {
    let settle
    let fail
    const animation = {
      element,
      keyframes,
      options,
      playState: "running",
      finished: new Promise((resolve, reject) => {
        settle = resolve
        fail = reject
      }),
      finish: jest.fn(() => {
        animation.playState = "finished"
        settle()
      }),
      // A real cancel rejects `finished` with an AbortError, which is what
      // the catch in `crossObstacle` is there for.
      cancel: jest.fn(() => {
        animation.playState = "idle"
        fail(new Error("AbortError"))
      }),
    }
    return animation
  }

  /** The animation running on a node, if one was started for it. */
  const animationOn = (element) => started.find((animation) => animation.element === element)

  /** Give the environment the `Element.animate` jsdom does not have. */
  function installAnimate() {
    started = []
    window.Element.prototype.animate = jest.fn(function (keyframes, options) {
      const animation = fakeAnimation(this, keyframes, options)
      started.push(animation)
      return animation
    })
  }

  describe("with no Web Animations API, as jsdom has none", () => {
    it("lands the character on the next stop and resolves", async () => {
      const plan = ui.pack.layout(SPRING)
      const spies = watchPack(ui)
      ui.renderTrail(SPRING, 2, "sloth")

      await expect(ui.crossObstacle(2, kindAt(SPRING, 2))).resolves.toBeUndefined()

      expect(trailToken().style.transform).toBe(ui.pack.standing(plan.stops[3]))
      // Nothing can be animated, so nothing is asked of the pack's motion --
      // neither the full crossing nor the reduced one.
      expect(spies.traversal).not.toHaveBeenCalled()
      expect(spies.reducedTraversal).not.toHaveBeenCalled()
    })

    it("follows with the camera, just instantly", async () => {
      const plan = ui.pack.layout(SPRING)
      ui.renderTrail(SPRING, 5, "sloth")
      const before = cameraShift()

      await ui.crossObstacle(5, kindAt(SPRING, 5))

      expect(cameraShift()).toBeLessThan(before)
      expect(plan.stops[6].x + cameraShift()).toBeLessThanOrEqual(plan.viewportWidth)
    })

    it("resolves rather than throwing when no trail has been drawn", async () => {
      await expect(ui.crossObstacle(0, "hill")).resolves.toBeUndefined()
    })
  })

  describe("with the Web Animations API a browser provides", () => {
    beforeEach(installAnimate)

    afterEach(() => {
      delete window.Element.prototype.animate
    })

    it("does not animate the first draw, which has nothing to move from", () => {
      ui.renderTrail(SPRING, 4, "sloth")
      expect(window.Element.prototype.animate).not.toHaveBeenCalled()
      expect(started).toHaveLength(0)
    })

    it("asks the pack to cross the kind in the way, between the two right stops", async () => {
      const plan = ui.pack.layout(SPRING)
      const spies = watchPack(ui)
      ui.renderTrail(SPRING, FIRST, "sloth")

      const crossing = ui.crossObstacle(FIRST, kindAt(SPRING, FIRST))

      expect(spies.traversal).toHaveBeenCalledTimes(1)
      expect(spies.traversal).toHaveBeenCalledWith(
        SPRING.route[FIRST],
        plan.stops[FIRST],
        plan.stops[FIRST + 1],
      )
      const move = animationOn(trailToken())
      expect(move.keyframes).toEqual(
        ui.pack.traversal(SPRING.route[FIRST], plan.stops[FIRST], plan.stops[FIRST + 1]).keyframes,
      )
      // Held at the end, or the token snaps back the moment it lands.
      expect(move.options.fill).toBe("forwards")

      move.finish()
      await expect(crossing).resolves.toBeUndefined()
    })

    it("pans the camera alongside the character and leaves it where it lands", async () => {
      ui.renderTrail(SPRING, 5, "sloth")
      const before = cameraShift()

      const crossing = ui.crossObstacle(5, kindAt(SPRING, 5))

      const pan = animationOn(trailCamera())
      expect(pan).toBeDefined()
      expect(pan.options.fill).toBe("forwards")
      // From where the camera is to where it is going.
      expect(pan.keyframes).toHaveLength(2)
      const landed = cameraShift()
      expect(landed).toBeLessThan(before)

      animationOn(trailToken()).finish()
      pan.finish()
      await crossing
      expect(cameraShift()).toBe(landed)
    })

    it("does not resolve until the crossing has actually finished", async () => {
      ui.renderTrail(SPRING, FIRST, "sloth")
      let arrived = false
      const crossing = ui.crossObstacle(FIRST, kindAt(SPRING, FIRST)).then(() => {
        arrived = true
      })

      await Promise.resolve()
      expect(arrived).toBe(false)

      animationOn(trailToken()).finish()
      await crossing
      expect(arrived).toBe(true)
    })

    // game.js waits on this promise before asking the next question, so a
    // rejection would end the season on the spot.
    it("resolves rather than rejecting when the animation is cancelled", async () => {
      ui.renderTrail(SPRING, FIRST, "sloth")
      const crossing = ui.crossObstacle(FIRST, kindAt(SPRING, FIRST))
      animationOn(trailToken()).cancel()
      await expect(crossing).resolves.toBeUndefined()
    })

    it("describes the space it is heading for as soon as the crossing starts", async () => {
      const season = routedSeason(["hill", "river", "mountain"])
      ui.renderTrail(season, 0, "sloth")

      const crossing = ui.crossObstacle(0, "hill")

      expect(trailCanvas().getAttribute("aria-label")).toBe(
        "Testing trail, space 2 of 3: a river to cross",
      )
      animationOn(trailToken()).finish()
      await crossing
    })

    it("skipTraversal finishes a crossing that is still running", async () => {
      const plan = ui.pack.layout(SPRING)
      ui.renderTrail(SPRING, FIRST, "sloth")
      const crossing = ui.crossObstacle(FIRST, kindAt(SPRING, FIRST))
      const move = animationOn(trailToken())
      const pan = animationOn(trailCamera())
      expect([move.playState, pan.playState]).toEqual(["running", "running"])

      ui.skipTraversal()

      expect(move.finish).toHaveBeenCalledTimes(1)
      expect(pan.finish).toHaveBeenCalledTimes(1)
      await crossing
      // Skipping lands the character rather than abandoning it mid-air.
      expect(trailToken().style.transform).toBe(ui.pack.standing(plan.stops[FIRST + 1]))
    })

    it("skipTraversal is safe with nothing running, and cannot skip the same crossing twice", async () => {
      ui.renderTrail(SPRING, FIRST, "sloth")
      // Before any crossing at all -- which is the case every tap on the screen
      // outside a crossing hits.
      expect(() => ui.skipTraversal()).not.toThrow()

      const crossing = ui.crossObstacle(FIRST, kindAt(SPRING, FIRST))
      const move = animationOn(trailToken())
      ui.skipTraversal()
      ui.skipTraversal()
      expect(move.finish).toHaveBeenCalledTimes(1)

      await crossing
      expect(() => ui.skipTraversal()).not.toThrow()
      expect(move.finish).toHaveBeenCalledTimes(1)
    })

    it("skipTraversal leaves an animation that has already stopped alone", async () => {
      ui.renderTrail(SPRING, FIRST, "sloth")
      const crossing = ui.crossObstacle(FIRST, kindAt(SPRING, FIRST))
      const move = animationOn(trailToken())
      const pan = animationOn(trailCamera())
      // A real pan can end before the character lands, and finishing something
      // that has already stopped is what the playState guard avoids.
      pan.playState = "finished"

      ui.skipTraversal()

      expect(pan.finish).not.toHaveBeenCalled()
      expect(move.finish).toHaveBeenCalledTimes(1)
      await crossing
    })
  })

  // Reduced motion used to mean *no* motion: the character was placed on the
  // next stop instantly and the camera jumped after it, so the crossing -- the
  // trail's main piece of feedback -- simply did not happen for anyone with the
  // system setting on. It plays a plain slide now. What these hold is that the
  // slide happens, that it is plain, and that everything the animated path is
  // careful about still holds on this one: the promise settles, the skip works,
  // and the last frame is exactly where the character is meant to end up.
  describe("when the player has asked for less motion", () => {
    /** @type {typeof window.matchMedia|undefined} */
    let realMatchMedia

    beforeEach(() => {
      // An assignment rather than a spy: jsdom provides no matchMedia at all,
      // which is also why every other group here takes the full-motion path.
      realMatchMedia = window.matchMedia
      window.matchMedia = jest.fn((query) => ({
        media: query,
        matches: query === "(prefers-reduced-motion: reduce)",
        addEventListener: () => {},
        removeEventListener: () => {},
      }))
      installAnimate()
    })

    afterEach(() => {
      delete window.Element.prototype.animate
      if (realMatchMedia === undefined) delete window.matchMedia
      else window.matchMedia = realMatchMedia
    })

    it("asks the pack for its reduced crossing, never the full one", async () => {
      const plan = ui.pack.layout(SPRING)
      const spies = watchPack(ui)
      ui.renderTrail(SPRING, 3, "sloth")

      const crossing = ui.crossObstacle(3, kindAt(SPRING, 3))

      expect(spies.traversal).not.toHaveBeenCalled()
      expect(spies.reducedTraversal).toHaveBeenCalledTimes(1)
      expect(spies.reducedTraversal).toHaveBeenCalledWith(
        SPRING.route[3],
        plan.stops[3],
        plan.stops[4],
      )

      animationOn(trailToken()).finish()
      await expect(crossing).resolves.toBeUndefined()
    })

    it("moves the character, rather than teleporting it as it used to", async () => {
      const plan = ui.pack.layout(SPRING)
      ui.renderTrail(SPRING, 3, "sloth")

      const crossing = ui.crossObstacle(3, kindAt(SPRING, 3))

      const move = animationOn(trailToken())
      expect(move).toBeDefined()
      // Two ends that are not the same place: an animation whose keyframes all
      // said the same thing would be the old jump wearing a costume.
      expect(move.keyframes[0].transform).toBe(ui.pack.standing(plan.stops[3]))
      expect(move.keyframes[move.keyframes.length - 1].transform).toBe(
        ui.pack.standing(plan.stops[4]),
      )
      expect(move.options.fill).toBe("forwards")
      // Short, or it is a slow drift rather than less motion.
      expect(move.options.duration).toBeLessThan(400)

      move.finish()
      await crossing
      expect(trailToken().style.transform).toBe(ui.pack.standing(plan.stops[4]))
    })

    it("uses none of the arcing and squashing the preference is about", async () => {
      const plan = ui.pack.layout(SPRING)
      const arced = ui.pack.traversal(kindAt(SPRING, 3), plan.stops[3], plan.stops[4]).keyframes
      ui.renderTrail(SPRING, 3, "sloth")

      const crossing = ui.crossObstacle(3, kindAt(SPRING, 3))

      const move = animationOn(trailToken())
      expect(move.keyframes).not.toEqual(arced)
      for (const frame of move.keyframes) expect(frame.transform).not.toMatch(/scale/i)
      move.finish()
      await crossing
    })

    it("still pans the camera, briefly, and still clamps it", async () => {
      const plan = ui.pack.layout(SPRING)
      ui.renderTrail(SPRING, 5, "sloth")
      const before = cameraShift()

      const crossing = ui.crossObstacle(5, kindAt(SPRING, 5))

      const pan = animationOn(trailCamera())
      expect(pan).toBeDefined()
      expect(pan.options.easing).toBe("linear")
      // Well under the 900ms leisurely drift the full path uses: a long eased
      // pan of the whole landscape is a large moving field, which is precisely
      // what the preference is asking for less of.
      expect(pan.options.duration).toBeLessThan(500)
      expect(cameraShift()).toBeLessThan(before)

      animationOn(trailToken()).finish()
      pan.finish()
      await crossing
      expect(cameraShift()).toBeGreaterThanOrEqual(-(plan.width - plan.viewportWidth))
    })

    it("can still be cut short by a tap", async () => {
      const plan = ui.pack.layout(SPRING)
      ui.renderTrail(SPRING, 3, "sloth")
      const crossing = ui.crossObstacle(3, kindAt(SPRING, 3))
      const move = animationOn(trailToken())

      ui.skipTraversal()

      expect(move.finish).toHaveBeenCalledTimes(1)
      await crossing
      expect(trailToken().style.transform).toBe(ui.pack.standing(plan.stops[4]))
    })

    it("still resolves when the pack has no reduced crossing to offer", async () => {
      const plan = ui.pack.layout(SPRING)
      ui.renderTrail(SPRING, 3, "sloth")
      // The documented degradation: back to instant placement, which is what
      // every player with the setting on used to get anyway.
      ui.pack = { ...ui.pack, reducedTraversal: undefined }

      await expect(ui.crossObstacle(3, kindAt(SPRING, 3))).resolves.toBeUndefined()

      expect(trailToken().style.transform).toBe(ui.pack.standing(plan.stops[4]))
    })

    it("still resolves when the reduced crossing throws", async () => {
      const plan = ui.pack.layout(SPRING)
      const error = jest.spyOn(console, "error").mockImplementation(() => {})
      ui.renderTrail(SPRING, 3, "sloth")
      ui.pack = {
        ...ui.pack,
        reducedTraversal: () => {
          throw new Error("no")
        },
      }

      await expect(ui.crossObstacle(3, kindAt(SPRING, 3))).resolves.toBeUndefined()

      expect(trailToken().style.transform).toBe(ui.pack.standing(plan.stops[4]))
      expect(error).toHaveBeenCalled()
      error.mockRestore()
    })

    it("draws a fresh trail with no animation at all, and still clamps both ends", () => {
      const plan = ui.pack.layout(SPRING)
      ui.renderTrail(SPRING, 0, "sloth")
      expect(cameraShift()).toBe(0)
      expect(window.Element.prototype.animate).not.toHaveBeenCalled()

      ui.renderTrail(SPRING, SPRING.spaces, "sloth")
      expect(cameraShift()).toBe(-(plan.width - plan.viewportWidth))
      // A first draw has nothing to move from, reduced motion or not.
      expect(window.Element.prototype.animate).not.toHaveBeenCalled()
    })
  })
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
    ui.renderQuestion(questionState(), {}, () => {})
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
    ui.renderQuestion(questionState({ choices: [1, 2, 3, 4, 5, 6] }), {}, () => {})
    expect(choiceButtons()).toHaveLength(PLAY.CHOICE_COUNT)
  })

  // The A-D keyboard shortcut is registered in index.html but is otherwise
  // undiscoverable: a screen reader reading "73, 72, 74, 83" gives no hint that
  // pressing C picks the third. The label says which letter goes with which
  // answer, and the letter is the button's own position, not the value.
  it("labels each button with the letter key that presses it", () => {
    ui.renderQuestion(questionState(), {}, () => {})
    expect(choiceButtons().map((button) => button.getAttribute("aria-label"))).toEqual([
      "Answer A: 73",
      "Answer B: 72",
      "Answer C: 74",
      "Answer D: 83",
    ])
  })

  it("carries the shortcut letter for the stylesheet to print", () => {
    // `data-key` rather than text inside the button, so `textContent` stays
    // exactly the answer -- the screen reader, the tests and the flash all read
    // it. The letter is drawn by `.choice::before`, and only on a device with a
    // real pointer, so the iPad never shows a stray marker beside an answer.
    ui.renderQuestion(questionState(), {}, () => {})
    const buttons = choiceButtons()
    expect(buttons.map((button) => button.dataset.key)).toEqual(["A", "B", "C", "D"])
    expect(buttons.map((button) => button.textContent)).toEqual(["73", "72", "74", "83"])
  })

  it("relabels the buttons when the next question arrives", () => {
    ui.renderQuestion(questionState(), {}, () => {})
    ui.renderQuestion(questionState({ choices: [56, 54, 63, 48] }), {}, () => {})
    expect(choiceButtons().map((button) => button.getAttribute("aria-label"))).toEqual([
      "Answer A: 56",
      "Answer B: 54",
      "Answer C: 63",
      "Answer D: 48",
    ])
  })

  // The label is composed by the caller and passed in -- see game.js's
  // `_questionTag`, which is where the boss wording lives, because it needs the
  // rescue value and how many tries are left. This only checks it is displayed.
  it.each([
    [{}, "", true, false],
    [{ tag: "Glowing challenge", lit: true }, "Glowing challenge", false, true],
    [
      { tag: "Last try — worth 3 more roses", lit: true },
      "Last try — worth 3 more roses",
      false,
      true,
    ],
    [{ tag: "A label with no glow" }, "A label with no glow", false, false],
  ])("shows the label it is given (%p)", (label, text, hidden, lit) => {
    ui.renderQuestion(questionState(), label, () => {})
    const element = document.getElementById("question-tag")
    expect(element.textContent).toBe(text)
    expect(element.classList.contains("hidden")).toBe(hidden)
    expect(document.body.classList.contains("is-glowing-question")).toBe(lit)
  })

  it("clears the glowing class when an ordinary question follows a glowing one", () => {
    ui.renderQuestion(questionState(), { tag: "Glowing challenge", lit: true }, () => {})
    expect(document.body.classList.contains("is-glowing-question")).toBe(true)
    ui.renderQuestion(questionState(), {}, () => {})
    expect(document.body.classList.contains("is-glowing-question")).toBe(false)
  })

  it("calls back with the chosen value and the button that was pressed", () => {
    const onAnswer = jest.fn()
    ui.renderQuestion(questionState(), {}, onAnswer)
    const buttons = choiceButtons()
    buttons[2].click()
    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer).toHaveBeenCalledWith(74, buttons[2])
  })

  it("rebuilds rather than appends", () => {
    ui.renderQuestion(questionState(), {}, () => {})
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
    ui.renderQuestion(questionState(), {}, () => {})
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
    ui.renderQuestion(questionState(), {}, () => {})
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

  describe("the haul in the jar", () => {
    const jar = () => document.getElementById("result-haul")
    const items = () => Array.from(jar().querySelectorAll(".haul-item"))

    it("draws one collectible per item delivered", () => {
      ui.renderResult(resultState({ items: 11 }), SPRING, [], "t", "x")
      expect(items()).toHaveLength(11)
      for (const item of items()) {
        expect(item.querySelector("svg")).not.toBeNull()
      }
    })

    it("staggers them, so they read as being counted in one at a time", () => {
      ui.renderResult(resultState({ items: 4 }), SPRING, [], "t", "x")
      const order = items().map((item) => item.style.getPropertyValue("--haul-index"))
      expect(order).toEqual(["0", "1", "2", "3"])
    })

    it("names the collectible, plural for many and singular for one", () => {
      ui.renderResult(resultState({ items: 3 }), SPRING, [], "t", "x")
      expect(jar().querySelector(".haul-caption").textContent).toBe("3 roses into her jar")
      ui.renderResult(resultState({ items: 1 }), SPRING, [], "t", "x")
      expect(jar().querySelector(".haul-caption").textContent).toBe("1 rose into her jar")
    })

    // The end-of-run screen passes its own rows, and every per-season counter on
    // the state belongs to the last season played. A jar there would be a lie.
    it("draws nothing when the caller supplied its own rows", () => {
      ui.renderResult(resultState({ items: 11 }), SPRING, [], "t", "x", [["Best streak", "4"]])
      expect(jar().children).toHaveLength(0)
    })

    it("draws nothing for an empty-handed season, rather than an empty jar", () => {
      ui.renderResult(resultState({ items: 0 }), SPRING, [], "t", "x")
      expect(jar().children).toHaveLength(0)
    })

    it("clears the previous season's haul instead of stacking on it", () => {
      ui.renderResult(resultState({ items: 9 }), SPRING, [], "t", "x")
      ui.renderResult(resultState({ items: 2 }), SUMMER, [], "t", "x")
      expect(items()).toHaveLength(2)
    })

    // `items` comes off a save file that storage only clamps to non-negative.
    it("caps a corrupted count instead of building a node per item", () => {
      ui.renderResult(resultState({ items: 5_000_000 }), SPRING, [], "t", "x")
      expect(items().length).toBeLessThanOrEqual(60)
    })
  })

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
    const spring = ui.pack.palette(SPRING.id)
    const winter = ui.pack.palette(WINTER.id)
    ui.applyPalette(SPRING)
    ui.applyPalette(WINTER)
    expect(document.documentElement.dataset.season).toBe("winter")

    // Read from the pack rather than pinning hexes. This test is about which
    // season's values ended up on the page, not about what the colours are, and
    // the pinned version broke the first time the winter art was retouched.
    for (const [property, value] of Object.entries(winter)) {
      expect(document.documentElement.style.getPropertyValue(property)).toBe(value)
    }
    // Without this the loop above would still pass if both packs were identical.
    expect(winter).not.toEqual(spring)
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
    ui.renderQuestion(
      questionState({ prompt: XSS }),
      { tag: "Glowing challenge", lit: true },
      () => {},
    )
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
    ["question-prompt", () => ui.renderQuestion(questionState({ prompt: XSS }), {}, () => {})],
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
    ui.renderQuestion(questionState({ choices: [XSS, 1, 2, 3] }), {}, () => {})
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
      bare.renderQuestion(questionState(), { tag: "Glowing challenge", lit: true }, () => {})
      bare.flashAnswer({ correct: false }, null, 73, "x")
      bare.startTimer(null, () => {})
      bare.stopTimer()
      bare.renderResult(resultState(), SPRING, [{ label: "x", onClick: () => {} }], "t", "x")
      bare.focusHeading("screen-play")
    }).not.toThrow()
  })
})

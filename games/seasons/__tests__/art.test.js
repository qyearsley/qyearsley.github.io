/**
 * Tests for the Seasons art layer: the `svg` helper and the registry in
 * art/index.js, plus the placeholder pack that implements the pack contract.
 *
 * Two things are being protected here, and they are quite different.
 *
 * The first is the security property the whole game rests on. art/index.js says
 * "innerHTML is deliberately not used anywhere in this game, so there is no path
 * by which content could become markup". `svg` is the single choke point for
 * that claim, so the string-child case is tested with an actual `<script>`
 * payload rather than a benign string: a text node is the only acceptable
 * result, and the assertions check both the escaped serialization and that no
 * element was created.
 *
 * The second is the pack contract. A replacement art pack is meant to be one new
 * file plus one string in constants.ART.PACK, which only works if "implements
 * the contract" is checkable -- and a sprite pack is planned, so this block is
 * the thing standing between that pack and shipping half-implemented. It walks
 * every character id in characters.js, every season id in SEASON_ORDER and every
 * obstacle kind in obstacles.js, and asserts a real drawing comes back for each
 * -- an SVG element with something in it, a viewBox the caller can actually size
 * against, and, crucially, markup that is neither the unknown-id fallback nor any
 * other id's drawing. The structural checks alone are not enough: the fallback
 * grey blob satisfies every one of them, so a pack shipping with no winter item
 * would render a grey disc and pass. The distinctness assertions are what make
 * this block able to fail.
 *
 * The trail half of the contract is checked the same way. `layout` is asserted
 * for internal consistency rather than against the placeholder's numbers -- one
 * stop per space plus the boss, one obstacle per route entry and of the kind the
 * route named, everything left to right and inside the trail, and no NaN
 * anywhere -- because a pack is free to choose its own spacing. The two places
 * where the numbers do carry meaning are pinned: the trail has to be wider than
 * the viewport or nothing scrolls, and a route containing a `gap` has to break
 * the ground into more than one segment, which is the entire reason
 * `groundSegments` is a list rather than a string.
 *
 * Non-obvious setup: none. These modules build DOM through `document`, which the
 * jsdom test environment already provides, and they hold no state between calls.
 */

import { describe, expect, it, jest } from "@jest/globals"
import { activePack, getPack, packNames, SVG_NS, svg } from "../js/art/index.js"
import * as placeholder from "../js/art/placeholder.js"
import { CHARACTERS } from "../js/characters.js"
import { ART, SEASON_ORDER } from "../js/constants.js"
import { isObstacleKind, OBSTACLE_KINDS } from "../js/obstacles.js"
import { SEASON_LIST } from "../js/seasons.js"

/** Every character id the roster offers. */
const CHARACTER_IDS = CHARACTERS.map((character) => character.id)

/**
 * The palette keys the obstacle drawings need. Named here rather than derived
 * from the palette itself, so dropping one from every season is a failure
 * instead of an agreement.
 */
const MATERIAL_KEYS = [
  "--season-water",
  "--season-rock",
  "--season-leaf",
  "--season-earth",
  "--season-trunk",
]

/** Two stops a traversal is asked to move between, and the distance apart. */
const FROM = { x: 150, y: 196 }
const TO = { x: 390, y: 204 }

/**
 * Whether a string is something CSS would accept as a colour. Deliberately
 * loose about the form and strict about it being non-empty and not, say, the
 * string "undefined" -- a palette hole shows up as a missing key or a bad value,
 * and both should fail.
 * @param {unknown} value - A palette value
 * @returns {boolean} True if it reads as a colour
 */
function isColor(value) {
  if (typeof value !== "string") return false
  return (
    /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value) ||
    /^(?:rgb|rgba|hsl|hsla)\([^)]+\)$/i.test(value) ||
    /^[a-z]+$/.test(value)
  )
}

/**
 * Parse a viewBox into its four numbers, asserting the string is well formed.
 * @param {unknown} viewBox - The viewBox a drawing was tagged with
 * @returns {number[]} [x, y, width, height]
 */
function parseViewBox(viewBox) {
  expect(typeof viewBox).toBe("string")
  const parts = String(viewBox).trim().split(/\s+/)
  expect(parts).toHaveLength(4)
  const numbers = parts.map(Number)
  for (const number of numbers) expect(Number.isFinite(number)).toBe(true)
  return numbers
}

/**
 * Assert a value is a usable Drawing: a populated SVG element in the SVG
 * namespace, plus a viewBox with positive extent.
 *
 * Structure only. The unknown-id fallback passes every check in here, so a
 * caller testing a specific id has to compare against the fallback as well.
 * @param {unknown} drawing - The value a pack function returned
 */
function expectDrawing(drawing) {
  expect(drawing).toBeTruthy()
  const { element, viewBox } = /** @type {{element: Element, viewBox: string}} */ (drawing)
  expect(element).toBeInstanceOf(window.SVGElement)
  expect(element.namespaceURI).toBe(SVG_NS)
  expect(element.childElementCount).toBeGreaterThan(0)
  const [, , width, height] = parseViewBox(viewBox)
  expect(width).toBeGreaterThan(0)
  expect(height).toBeGreaterThan(0)
}

/**
 * A drawing's markup, for comparing one id's art against another's.
 * @param {{element: Element}} drawing - A Drawing
 * @returns {string} The serialized element
 */
function markup(drawing) {
  return drawing.element.outerHTML
}

/**
 * The two numbers in a `translate(Xpx, Ypx)`, asserting the string is one.
 * @param {unknown} transform - A CSS transform from `standing` or a keyframe
 * @returns {number[]} [x, y] in user units
 */
function translatePx(transform) {
  expect(typeof transform).toBe("string")
  const match = /translate\(\s*(-?[\d.]+)px[\s,]+(-?[\d.]+)px\s*\)/.exec(String(transform))
  expect(match).not.toBeNull()
  return [Number(match[1]), Number(match[2])]
}

/**
 * Assert a layout is internally consistent, whatever route produced it.
 *
 * Deliberately says nothing about the placeholder pack's own spacing: a pack
 * chooses how far apart its obstacles sit. What it does insist on is that the
 * pieces agree with each other, that the trail runs left to right, and that
 * every number is a number -- a single NaN here stacks the whole trail in one
 * corner, which is exactly the failure a structural test can otherwise miss.
 *
 * @param {Object} plan - What `layout` returned
 */
function expectLayout(plan) {
  expect(plan).toBeTruthy()
  for (const key of ["width", "height", "viewportWidth"]) {
    expect(Number.isFinite(plan[key])).toBe(true)
    expect(plan[key]).toBeGreaterThan(0)
  }
  // The viewBox is the window onto the trail, not the trail itself.
  const [, , boxWidth, boxHeight] = parseViewBox(plan.viewBox)
  expect(boxWidth).toBe(plan.viewportWidth)
  expect(boxHeight).toBe(plan.height)

  expect(Array.isArray(plan.groundSegments)).toBe(true)
  expect(plan.groundSegments.length).toBeGreaterThan(0)
  for (const d of plan.groundSegments) {
    expect(typeof d).toBe("string")
    expect(d.trim().startsWith("M")).toBe(true)
    expect(d).not.toContain("NaN")
  }

  // One stop per obstacle, plus the boss's.
  expect(Array.isArray(plan.stops)).toBe(true)
  expect(Array.isArray(plan.obstacles)).toBe(true)
  expect(plan.obstacles.length).toBeGreaterThan(0)
  expect(plan.stops).toHaveLength(plan.obstacles.length + 1)

  for (const list of [plan.stops, plan.obstacles]) {
    let previous = -Infinity
    for (const point of list) {
      expect(Number.isFinite(point.x)).toBe(true)
      expect(Number.isFinite(point.y)).toBe(true)
      // Strictly increasing: two obstacles at the same x are one drawn on top of
      // the other, and two stops at the same x are a crossing that goes nowhere.
      expect(point.x).toBeGreaterThan(previous)
      expect(point.x).toBeGreaterThanOrEqual(0)
      expect(point.x).toBeLessThanOrEqual(plan.width)
      expect(point.y).toBeGreaterThanOrEqual(0)
      expect(point.y).toBeLessThanOrEqual(plan.height)
      previous = point.x
    }
  }
}

describe("svg", () => {
  it("creates elements in the SVG namespace, not the HTML one", () => {
    const circle = svg("circle")
    expect(circle.namespaceURI).toBe(SVG_NS)
    expect(SVG_NS).toBe("http://www.w3.org/2000/svg")
    expect(circle.tagName).toBe("circle")
    expect(circle).toBeInstanceOf(window.SVGElement)
  })

  it("sets every attribute given, stringifying numbers", () => {
    const circle = svg("circle", { cx: 10, cy: 20.5, r: 3, fill: "#fff" })
    expect(circle.getAttribute("cx")).toBe("10")
    expect(circle.getAttribute("cy")).toBe("20.5")
    expect(circle.getAttribute("r")).toBe("3")
    expect(circle.getAttribute("fill")).toBe("#fff")
  })

  it("skips null and undefined values rather than writing them as text", () => {
    const path = svg("path", { d: "M0 0", stroke: null, fill: undefined, opacity: 0 })
    expect(path.hasAttribute("d")).toBe(true)
    expect(path.hasAttribute("stroke")).toBe(false)
    expect(path.hasAttribute("fill")).toBe(false)
    // 0 and "" are values, not absences.
    expect(path.getAttribute("opacity")).toBe("0")
  })

  it("appends element children in order", () => {
    const a = svg("circle", { r: 1 })
    const b = svg("rect", { width: 2 })
    const group = svg("g", {}, [a, b])
    expect(Array.from(group.children)).toEqual([a, b])
  })

  it("appends a string child as a text node, never as markup", () => {
    const text = svg("text", {}, ["hello"])
    expect(text.childNodes).toHaveLength(1)
    expect(text.firstChild.nodeType).toBe(window.Node.TEXT_NODE)
    expect(text.textContent).toBe("hello")
    expect(text.childElementCount).toBe(0)
  })

  // The security-relevant case. art/index.js claims there is no path by which
  // content becomes markup; `svg` is the only place a string enters the DOM, so
  // this is where that claim is either true or not.
  it("cannot be used to inject markup through a string child", () => {
    const payload = '<script>window.pwned = true</script><img src=x onerror="alert(1)">'
    const container = document.createElement("div")
    container.append(svg("svg", {}, [svg("text", {}, [payload])]))

    expect(container.querySelector("script")).toBeNull()
    expect(container.querySelector("img")).toBeNull()
    expect(document.querySelector("script")).toBeNull()
    expect(container.innerHTML).toContain("&lt;script&gt;")
    expect(container.innerHTML).not.toContain("<script>")
    expect(container.textContent).toBe(payload)
    expect(window.pwned).toBeUndefined()
  })

  it("cannot be used to inject markup through an attribute value", () => {
    const payload = '"><script>x</script>'
    const container = document.createElement("div")
    container.append(svg("circle", { fill: payload }))
    expect(container.querySelector("circle").getAttribute("fill")).toBe(payload)
    expect(container.querySelector("script")).toBeNull()

    // The serialization escapes the quote, so re-parsing it cannot break out of
    // the attribute either. `<` inside a quoted attribute value is not markup.
    const reparsed = document.createElement("div")
    reparsed.innerHTML = container.innerHTML
    expect(reparsed.querySelector("script")).toBeNull()
    expect(reparsed.children).toHaveLength(1)
  })
})

describe("the registry", () => {
  it("returns the placeholder pack by name, without warning", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {})
    expect(getPack("placeholder")).toBe(placeholder)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it.each([["nope"], [""], [null], [undefined], [42], [{}]])(
    "falls back to placeholder and warns for the unknown name %p",
    (name) => {
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {})
      expect(getPack(name)).toBe(placeholder)
      expect(warn).toHaveBeenCalledTimes(1)
      expect(String(warn.mock.calls[0][0])).toContain("unknown art pack")
      warn.mockRestore()
    },
  )

  it("does not fall back for an inherited Object property", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {})
    expect(getPack("toString")).toBe(placeholder)
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it("lists placeholder among the pack names", () => {
    expect(packNames()).toContain("placeholder")
    expect(packNames()).toEqual(expect.arrayContaining([placeholder.id]))
  })

  it("the active pack is the one constants.ART.PACK names", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {})
    // Named module, not `getPack(ART.PACK)` -- activePack's whole body is
    // `return getPack(ART.PACK)`, so that comparison could not fail.
    expect(activePack()).toBe(placeholder)
    expect(ART.PACK).toBe("placeholder")
    expect(activePack().id).toBe(ART.PACK)
    // A configured pack that does not exist would be a silent downgrade.
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})

// This block is the reason this file exists. It is written against the pack
// contract rather than against the placeholder pack's specific shapes, so it can
// be pointed at a replacement pack unchanged.
describe("the placeholder pack fulfils the art-pack contract", () => {
  const pack = placeholder

  it.each([
    ["id", "string"],
    ["name", "string"],
    ["palette", "function"],
    ["character", "function"],
    ["item", "function"],
    ["villain", "function"],
    ["layout", "function"],
    ["obstacle", "function"],
    ["traversal", "function"],
    ["standing", "function"],
    ["backdrop", "function"],
  ])("exports %s as a %s", (name, type) => {
    expect(typeof pack[name]).toBe(type)
    if (type === "string") expect(pack[name].length).toBeGreaterThan(0)
  })

  // `trailPath` was the one-viewBox curve the trail used to be drawn along.
  // Nothing measures a path any more -- `layout` returns positions outright --
  // and a pack still exporting it would be written against a contract that is
  // gone.
  it("no longer exports trailPath, which the scrolling trail replaced", () => {
    expect(pack.trailPath).toBeUndefined()
  })

  it.each(CHARACTER_IDS)("draws the character %s", (characterId) => {
    const drawing = pack.character(characterId)
    expectDrawing(drawing)
    // Not the unknown-id blob. Without this the test passes on a pack that has
    // never heard of this character, because the fallback is a real drawing.
    expect(markup(drawing)).not.toBe(markup(pack.character("nope")))
  })

  it("draws a different character for each id, so no two share art", () => {
    const drawn = CHARACTER_IDS.map((characterId) => markup(pack.character(characterId)))
    expect(new Set(drawn).size).toBe(CHARACTER_IDS.length)
  })

  it.each(SEASON_ORDER)("draws the ordinary item for %s", (seasonId) => {
    const drawing = pack.item(seasonId, false)
    expectDrawing(drawing)
    expect(markup(drawing)).not.toBe(markup(pack.item("nope")))
  })

  it.each(SEASON_ORDER)("draws the rare item for %s", (seasonId) => {
    const drawing = pack.item(seasonId, true)
    expectDrawing(drawing)
    expect(markup(drawing)).not.toBe(markup(pack.item("nope")))
  })

  it("draws a distinct item for every season, plain and rare alike", () => {
    const drawn = SEASON_ORDER.flatMap((seasonId) => [
      markup(pack.item(seasonId, false)),
      markup(pack.item(seasonId, true)),
    ])
    expect(new Set(drawn).size).toBe(SEASON_ORDER.length * 2)
  })

  it("the rare item differs from the ordinary one, or the glow means nothing", () => {
    for (const seasonId of SEASON_ORDER) {
      expect(markup(pack.item(seasonId, true))).not.toBe(markup(pack.item(seasonId, false)))
    }
  })

  it("draws the villain", () => {
    expectDrawing(pack.villain())
  })

  it("hands back a fresh element every call, so one drawing cannot be reparented", () => {
    // GameUI mounts the same drawing in several places on one screen.
    const first = pack.character("phoenix").element
    const second = pack.character("phoenix").element
    expect(first).not.toBe(second)
    expect(first.outerHTML).toBe(second.outerHTML)
  })

  describe("layout", () => {
    it.each(SEASON_LIST.map((season) => [season.id, season]))(
      "lays out the %s trail from its route",
      (_id, season) => {
        const plan = pack.layout(season)
        expectLayout(plan)
        // One stop per space, and one more to stand on facing the boss.
        expect(plan.stops).toHaveLength(season.route.length + 1)
        // Same count, same order, same kinds -- the route is what is drawn.
        expect(plan.obstacles).toHaveLength(season.route.length)
        expect(plan.obstacles.map((spot) => spot.kind)).toEqual(season.route)
        // The trail scrolls, so it has to be longer than the window onto it.
        // A trail that fits on screen would leave the camera nothing to do.
        expect(plan.width).toBeGreaterThan(plan.viewportWidth)
      },
    )

    // A malformed season still has to produce something drawable: GameUI passes
    // whatever the save gave it, and a thrown error here is a blank screen.
    // Only the trail-is-wider-than-the-viewport promise is dropped -- a
    // one-space fallback trail genuinely fits on screen and simply does not
    // scroll.
    it.each([[null], [undefined], [{}], [{ route: [] }], [{ route: "hill" }]])(
      "still lays out a usable trail for %p",
      (season) => {
        const plan = pack.layout(season)
        expectLayout(plan)
        for (const spot of plan.obstacles) expect(isObstacleKind(spot.kind)).toBe(true)
      },
    )

    // The whole reason `groundSegments` is a list. A gap is an absence of
    // ground, so it ends one stretch of it and starts the next; a pack that
    // returned one path always would be drawing a gap as a sticker on solid
    // earth, which is what this replaced.
    it("breaks the ground where a gap is, and nowhere else", () => {
      const gapless = pack.layout({ id: "spring", route: ["hill", "boulder", "thicket"] })
      const withGap = pack.layout({ id: "spring", route: ["hill", "gap", "thicket"] })
      expect(gapless.groundSegments).toHaveLength(1)
      expect(withGap.groundSegments.length).toBeGreaterThan(1)
    })

    it("hands back the same geometry every call, so two callers cannot disagree", () => {
      const season = SEASON_LIST[0]
      expect(pack.layout(season)).toEqual(pack.layout(season))
    })
  })

  describe("obstacle", () => {
    it.each(OBSTACLE_KINDS.flatMap((kind) => SEASON_ORDER.map((seasonId) => [kind, seasonId])))(
      "draws a %s for %s",
      (kind, seasonId) => {
        expectDrawing(pack.obstacle(kind, seasonId))
      },
    )

    // The distinctness check that makes the block above able to fail. An
    // unknown kind falls back to the hill, so a pack that has never heard of a
    // river draws a hill for it -- structurally perfect, and two obstacles on
    // the trail that look identical.
    it.each(SEASON_ORDER)("draws a different obstacle for every kind in %s", (seasonId) => {
      const drawn = OBSTACLE_KINDS.map((kind) => markup(pack.obstacle(kind, seasonId)))
      expect(new Set(drawn).size).toBe(OBSTACLE_KINDS.length)
    })

    it.each([["nope"], [null], [undefined], [42]])(
      "obstacle(%p) draws something rather than throwing",
      (kind) => {
        expect(() => pack.obstacle(kind, "spring")).not.toThrow()
        expectDrawing(pack.obstacle(kind, "spring"))
      },
    )
  })

  describe("traversal", () => {
    it.each(OBSTACLE_KINDS)("moves the character across a %s", (kind) => {
      const { keyframes, options } = pack.traversal(kind, FROM, TO)
      expect(Array.isArray(keyframes)).toBe(true)
      // Two is the minimum that can describe a move: where it starts and where
      // it ends. One keyframe is a jump with extra steps.
      expect(keyframes.length).toBeGreaterThanOrEqual(2)
      for (const frame of keyframes) {
        expect(typeof frame.transform).toBe("string")
        expect(frame.transform).not.toContain("NaN")
        translatePx(frame.transform)
      }

      expect(Number.isFinite(options.duration)).toBe(true)
      expect(options.duration).toBeGreaterThan(0)

      // Starts standing where the character is and ends standing where it is
      // going. Anything else teleports the token at one end of the crossing,
      // which is precisely what the animation exists to stop.
      expect(keyframes[0].transform).toContain(pack.standing(FROM))
      expect(keyframes[keyframes.length - 1].transform).toContain(pack.standing(TO))

      // Any offsets given run forwards through the crossing. An out-of-order
      // one throws in a real browser, where nothing here would. Offsets are
      // optional -- a pack may let them distribute evenly -- so this checks the
      // ones that are there rather than insisting on them.
      let previous = 0
      for (const frame of keyframes.slice(1, -1)) {
        if (frame.offset === undefined) continue
        expect(frame.offset).toBeGreaterThan(previous)
        expect(frame.offset).toBeLessThan(1)
        previous = frame.offset
      }
    })

    // Same two points, different weight. A pack that timed every obstacle alike
    // would leave a mountain feeling like a step over a hill.
    it("gives every kind its own timing, so the motion has character", () => {
      const durations = OBSTACLE_KINDS.map(
        (kind) => pack.traversal(kind, FROM, TO).options.duration,
      )
      expect(new Set(durations).size).toBe(OBSTACLE_KINDS.length)
    })

    it("does not simply slide the character along the ground", () => {
      const [startX, startY] = translatePx(pack.standing(FROM))
      const [endX, endY] = translatePx(pack.standing(TO))
      for (const kind of OBSTACLE_KINDS) {
        const middles = pack.traversal(kind, FROM, TO).keyframes.slice(1, -1)
        expect(middles.length).toBeGreaterThan(0)
        // Either the crossing arcs above the line between the two stops, or it
        // deforms the character -- a thicket is pushed through rather than
        // climbed. Sliding flat with neither is the one thing that reads as
        // nothing having happened.
        const lifted = middles.some((frame) => {
          const [x, y] = translatePx(frame.transform)
          const along = (x - startX) / (endX - startX)
          return y < startY + (endY - startY) * along
        })
        const deformed = middles.some((frame) => /scale/i.test(frame.transform))
        expect(lifted || deformed).toBe(true)
      }
    })

    it.each([["nope"], [null], [undefined]])(
      "traversal(%p) still returns a usable animation",
      (kind) => {
        const { keyframes, options } = pack.traversal(kind, FROM, TO)
        expect(keyframes.length).toBeGreaterThanOrEqual(2)
        expect(options.duration).toBeGreaterThan(0)
        for (const frame of keyframes) expect(frame.transform).not.toContain("NaN")
      },
    )
  })

  describe("standing", () => {
    it("turns a stop into a transform that tracks the stop's coordinates", () => {
      const at = (stop) => translatePx(pack.standing(stop))
      const base = at({ x: 400, y: 190 })
      // Moving the stop moves the transform by the same amount, in both axes.
      expect(at({ x: 460, y: 190 })).toEqual([base[0] + 60, base[1]])
      expect(at({ x: 400, y: 150 })).toEqual([base[0], base[1] - 40])
      // And it is a transform *to the stop*, not to some unrelated origin. The
      // slack is whatever the pack's drawing needs to stand its feet on the
      // ground; a whole trail's worth of drift is a different bug.
      expect(Math.abs(base[0] - 400)).toBeLessThan(150)
      expect(Math.abs(base[1] - 190)).toBeLessThan(150)
    })

    it.each(SEASON_LIST.map((season) => [season.id, season]))(
      "stands on every stop of the %s trail without an NaN",
      (_id, season) => {
        for (const stop of pack.layout(season).stops) {
          expect(pack.standing(stop)).not.toContain("NaN")
          const [x, y] = translatePx(pack.standing(stop))
          expect(Number.isFinite(x)).toBe(true)
          expect(Number.isFinite(y)).toBe(true)
        }
      },
    )
  })

  describe("backdrop", () => {
    it.each(SEASON_ORDER)("draws a backdrop for %s", (seasonId) => {
      expectDrawing(pack.backdrop(seasonId, 4000))
    })

    it("draws a different backdrop for each season", () => {
      const drawn = SEASON_ORDER.map((seasonId) => markup(pack.backdrop(seasonId, 4000)))
      expect(new Set(drawn).size).toBe(SEASON_ORDER.length)
    })

    // Generated at the trail's real width rather than scaled to it, which is
    // width, which is the whole difference between the two. A backdrop that
    // ignored the width would be stretched across the trail by the browser and
    // its hills would flatten into bands.
    it("scales to the width it is given", () => {
      const narrow = pack.backdrop("spring", 1200)
      const wide = pack.backdrop("spring", 4800)
      expect(parseViewBox(narrow.viewBox)[2]).toBe(1200)
      expect(parseViewBox(wide.viewBox)[2]).toBe(4800)
      expect(markup(wide)).not.toBe(markup(narrow))
      expect(markup(wide)).not.toContain("NaN")
    })

    it.each(SEASON_LIST.map((season) => [season.id, season]))(
      "fills the whole %s trail",
      (_id, season) => {
        const plan = pack.layout(season)
        const drawing = pack.backdrop(season.id, plan.width)
        expectDrawing(drawing)
        expect(parseViewBox(drawing.viewBox)[2]).toBe(plan.width)
      },
    )
  })
})

describe("unknown ids", () => {
  it.each([["nope"], [null], [undefined], [42]])(
    "character(%p) returns a neutral drawing rather than throwing",
    (characterId) => {
      expect(() => placeholder.character(characterId)).not.toThrow()
      expectDrawing(placeholder.character(characterId))
    },
  )

  it.each([["nope"], [null], [undefined], [42]])(
    "item(%p) returns a neutral drawing rather than throwing",
    (seasonId) => {
      expect(() => placeholder.item(seasonId)).not.toThrow()
      expectDrawing(placeholder.item(seasonId))
    },
  )

  it("every season defines the same properties, so no season is half-themed", () => {
    const expected = Object.keys(placeholder.palette(SEASON_ORDER[0])).sort()
    expect(expected.length).toBeGreaterThan(0)
    for (const seasonId of SEASON_ORDER) {
      expect(Object.keys(placeholder.palette(seasonId)).sort()).toEqual(expected)
    }
  })

  it.each([["nope"], [null], [undefined], [42]])("%p falls back to spring", (seasonId) => {
    expect(placeholder.palette(seasonId)).toEqual(placeholder.palette("spring"))
  })

  // The materials the obstacle drawings are painted in. Named explicitly rather
  // than swept, because "every season defines the same properties" above is
  // satisfied by every season dropping the same key -- and the shapes then all
  // dissolve into the ground they stand on.
  it.each(SEASON_ORDER)("%s defines every material the obstacles need", (seasonId) => {
    const colors = placeholder.palette(seasonId)
    for (const key of MATERIAL_KEYS) {
      expect(Object.keys(colors)).toContain(key)
      expect(isColor(colors[key])).toBe(true)
    }
  })
})

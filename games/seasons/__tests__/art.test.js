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
import { getSeason, SEASON_LIST } from "../js/seasons.js"

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
 * A whole backdrop's markup, layer by layer.
 *
 * `backdrop` is the one pack function that does not return a `Drawing`: it
 * returns a stack of planes, each with its own parallax factor, so there is no
 * single element to serialize.
 * @param {{layers: Array<{element: Element}>}} backdrop - What `backdrop` returned
 * @returns {string} Every layer's markup, in order
 */
function backdropMarkup(backdrop) {
  return backdrop.layers.map((layer) => layer.element.outerHTML).join("\n")
}

/**
 * Assert a value is a usable backdrop: an ordered stack of planes, each a real
 * drawing, each declaring how fast it pans and how wide it is.
 *
 * A layer may legitimately be empty -- three of the four seasons put nothing in
 * the fixed sky beyond its colour, and a season with no weather would have an
 * empty air layer -- so the populated check is on the stack rather than on each
 * plane.
 * @param {unknown} backdrop - The value `backdrop` returned
 * @param {number} span - The width it was asked for
 */
function expectBackdrop(backdrop, span) {
  expect(backdrop).toBeTruthy()
  const { layers, viewBox } = /** @type {{layers: Array<Object>, viewBox: string}} */ (backdrop)
  expect(Array.isArray(layers)).toBe(true)
  expect(layers.length).toBeGreaterThan(0)
  expect(layers.some((layer) => layer.element.childElementCount > 0)).toBe(true)

  let previous = -Infinity
  for (const layer of layers) {
    expect(layer.element).toBeInstanceOf(window.SVGElement)
    expect(layer.element.namespaceURI).toBe(SVG_NS)
    expect(typeof layer.name).toBe("string")
    expect(layer.name.length).toBeGreaterThan(0)
    expect(Number.isFinite(layer.factor)).toBe(true)
    expect(layer.factor).toBeGreaterThanOrEqual(0)
    // Nothing may outrun the ground. A layer faster than the trail overtakes
    // the character, which the eye reads as the background sliding backwards.
    expect(layer.factor).toBeLessThanOrEqual(1)
    // Back to front. A nearer plane drawn behind a further one is a stack in
    // the wrong order, which no factor can rescue.
    expect(layer.factor).toBeGreaterThanOrEqual(previous)
    previous = layer.factor
    expect(Number.isFinite(layer.span)).toBe(true)
    expect(layer.span).toBeGreaterThan(0)
  }

  const [, , boxWidth, boxHeight] = parseViewBox(viewBox)
  expect(boxWidth).toBe(span)
  expect(boxHeight).toBeGreaterThan(0)
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
 * Every y coordinate in a path `d`, in order.
 *
 * Works because every path this pack emits for the ground uses only absolute
 * `M`, `L` and `Q` commands, all of which take whole `x y` pairs -- so the odd
 * numbers in the string are the y values and nothing else is. A pack using
 * relative commands or arcs would need its own reader; these assertions are
 * placeholder-specific and say so.
 * @param {string} d - An SVG path
 * @returns {number[]} Its y coordinates
 */
function pathYs(d) {
  const numbers = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
  return numbers.filter((_value, index) => index % 2 === 1)
}

/** The longest trail in the game, which is where a coverage bug shows up first. */
const LONGEST = SEASON_LIST.reduce((a, b) => (b.route.length > a.route.length ? b : a))

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
  // One band of surface material per stretch of ground, and never a band with
  // no ground under it: the two lists are built from the same samples, so a
  // length mismatch means the band has stepped over a break the ground did not.
  expect(Array.isArray(plan.groundEdges)).toBe(true)
  expect(plan.groundEdges).toHaveLength(plan.groundSegments.length)
  for (const d of [...plan.groundSegments, ...plan.groundEdges]) {
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

/**
 * A colour's rough lightness, 0..1, for comparing two palettes against each
 * other. Not a WCAG luminance -- it skips the gamma step, which is fine for
 * "which of these four is the lightest" and would be wrong for a contrast claim.
 * @param {string} hex - A six-digit hex colour
 * @returns {number} Its lightness
 */
function lightness(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
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
    ["reducedTraversal", "function"],
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

  // `onTrail` selects a pose. A pack is free to use the same drawing for both --
  // most of this one's characters do -- but a pack that quietly ignored the flag
  // for every character would put the sloth on the trail still hanging from a
  // branch, so at least one has to answer it.
  it("gives at least one character a different pose on the trail", () => {
    const posed = CHARACTER_IDS.filter(
      (characterId) =>
        markup(pack.character(characterId, true)) !== markup(pack.character(characterId, false)),
    )
    expect(posed.length).toBeGreaterThan(0)
  })

  it.each(CHARACTER_IDS)("draws %s on the trail without its card's scenery", (characterId) => {
    // Whatever the pose, it is still that character and still a real drawing --
    // an empty trail pose would leave the token invisible mid-season.
    const drawing = pack.character(characterId, true)
    expectDrawing(drawing)
    expect(markup(drawing)).not.toBe(markup(pack.character("nope", true)))
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

    // The band of material along the top of the ground. The two places it can
    // go wrong are the two places the ground is not flat, and both are here: a
    // band drawn from its own idea of where the ground is floats over a river
    // basin, and a band that does not know where the ground stops carries on
    // across a gap. Neither throws, and neither shows up in a test that only
    // asks whether a path was produced.
    describe("the ground's textured edge", () => {
      it("breaks with the ground at a gap, and nowhere else", () => {
        const gapless = pack.layout({ id: "spring", route: ["hill", "boulder", "thicket"] })
        const withGap = pack.layout({ id: "spring", route: ["hill", "gap", "thicket"] })
        expect(gapless.groundEdges).toHaveLength(1)
        expect(withGap.groundEdges).toHaveLength(withGap.groundSegments.length)
        expect(withGap.groundEdges.length).toBeGreaterThan(1)
      })

      it("follows the ground down into a river basin instead of bridging it", () => {
        const flat = pack.layout({ id: "spring", route: ["hill"] })
        const river = pack.layout({ id: "spring", route: ["river"] })
        const deepest = (plan) => Math.max(...pathYs(plan.groundEdges[0]))
        // The same trail with a basin sunk into the middle of it. If the band
        // ignored the deformation the two would come out within a unit or two
        // of each other, because both trails roll by the same amount.
        expect(deepest(river) - deepest(flat)).toBeGreaterThan(30)
      })

      it.each(SEASON_LIST.map((season) => [season.id, season]))(
        "lies on %s's ground rather than above it",
        (_id, season) => {
          const plan = pack.layout(season)
          plan.groundEdges.forEach((edge, index) => {
            // The ground path closes down to the bottom of the trail, so its own
            // corners have to come off before it can be read as a surface.
            const surface = pathYs(plan.groundSegments[index]).filter((y) => y !== plan.height)
            const band = pathYs(edge)
            // Never below the surface -- a band hanging under the ground would
            // be buried -- and never far above it. The exact clearance is the
            // pack's business; what is pinned is that it is a band on a surface
            // and not a second landscape floating over one.
            expect(Math.max(...band)).toBeLessThanOrEqual(Math.max(...surface) + 0.01)
            expect(Math.min(...band)).toBeGreaterThan(Math.min(...surface) - 25)
          })
        },
      )

      it("textures every season differently, or the ground says nothing about when it is", () => {
        const drawn = SEASON_LIST.map((season) => pack.layout(season).groundEdges.join())
        // Route lengths differ too, so this cannot fail for the wrong reason on
        // its own -- but the same route in four seasons still has to differ.
        const sameRoute = SEASON_ORDER.map((seasonId) =>
          pack.layout({ id: seasonId, route: ["hill", "river"] }).groundEdges.join(),
        )
        expect(new Set(drawn).size).toBe(SEASON_LIST.length)
        expect(new Set(sameRoute).size).toBe(SEASON_ORDER.length)
      })
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

      // And ends on nothing *but* that. Crossings play with `fill: "forwards"`,
      // so a scale left on the last keyframe outlives the animation: the
      // character wears it for the whole of the next question. The gap used to
      // finish on `scaleY(0.9)` and leave the animal standing 10% short.
      expect(keyframes[keyframes.length - 1].transform).toBe(pack.standing(TO))

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

    it("moves in small steps, so the path curves instead of cornering", () => {
      // The point of sampling the path rather than posing it. Each crossing used
      // to be three to six keyframes, which the browser joins with straight
      // lines -- so a jump traced a triangle and visibly cornered at the apex,
      // where the old hill turned through 73 degrees in one step.
      //
      // Phrased as "no single step covers much ground" rather than as an angle,
      // because that holds for any path shape a pack might choose: a bounce is
      // allowed to be a sharp corner, as long as it is a corner between two
      // short steps rather than two long ones.
      const span = Math.hypot(TO.x - FROM.x, TO.y - FROM.y)
      for (const kind of OBSTACLE_KINDS) {
        const points = pack.traversal(kind, FROM, TO).keyframes.map((f) => translatePx(f.transform))
        let longest = 0
        for (let i = 1; i < points.length; i += 1) {
          longest = Math.max(
            longest,
            Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]),
          )
        }
        expect(longest).toBeLessThan(span * 0.15)
      }
    })

    it("varies how high it lifts, so the kinds do not all move alike", () => {
      // `does not simply slide the character along the ground` accepts a squash
      // in place of a lift, which is right for the thicket -- but it means every
      // arc in the pack could be flattened to nothing and only that one kind
      // would notice. This asks that the pack actually varies its vertical
      // motion, without dictating which kind gets what.
      const [, groundY] = translatePx(pack.standing(FROM))
      const peaks = OBSTACLE_KINDS.map((kind) => {
        const ys = pack.traversal(kind, FROM, TO).keyframes.map((f) => translatePx(f.transform)[1])
        return Math.round(groundY - Math.min(...ys))
      })
      expect(Math.max(...peaks)).toBeGreaterThan(40)
      expect(new Set(peaks).size).toBeGreaterThan(2)
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

  // The crossing a player who has asked for less motion gets instead. It used
  // not to exist: GameUI placed the character on the next stop instantly, so
  // the trail's main piece of feedback simply stopped happening for anyone with
  // the system setting on. What is checked here is that the replacement is a
  // real move and that it is *plain* -- the arc, the hang and the squash are
  // precisely the swooping and elastic motion the preference asks to be rid of.
  describe("reducedTraversal", () => {
    it.each(OBSTACLE_KINDS)("slides the character across a %s", (kind) => {
      const { keyframes, options } = pack.reducedTraversal(kind, FROM, TO)
      expect(keyframes.length).toBeGreaterThanOrEqual(2)
      expect(keyframes[0].transform).toBe(pack.standing(FROM))
      // Exactly `standing(to)`, for the `fill: "forwards"` reason above: a
      // reduced crossing that left a transform on its last frame would dress the
      // character in it for the whole of the next question just as loudly.
      expect(keyframes[keyframes.length - 1].transform).toBe(pack.standing(TO))
      expect(Number.isFinite(options.duration)).toBe(true)
      expect(options.duration).toBeGreaterThan(0)
      // Shorter than the crossing it stands in for. A reduced motion that took
      // as long as the full one would be a slow drift, which is worse.
      expect(options.duration).toBeLessThan(pack.traversal(kind, FROM, TO).options.duration)
    })

    it("moves the character somewhere, or it is a cut with extra steps", () => {
      for (const kind of OBSTACLE_KINDS) {
        const { keyframes } = pack.reducedTraversal(kind, FROM, TO)
        expect(keyframes[0].transform).not.toBe(keyframes[keyframes.length - 1].transform)
      }
    })

    it("keeps to the straight line between the stops, with nothing deformed", () => {
      const [startX, startY] = translatePx(pack.standing(FROM))
      const [endX, endY] = translatePx(pack.standing(TO))
      for (const kind of OBSTACLE_KINDS) {
        for (const frame of pack.reducedTraversal(kind, FROM, TO).keyframes) {
          expect(frame.transform).not.toMatch(/scale/i)
          const [x, y] = translatePx(frame.transform)
          const along = (x - startX) / (endX - startX)
          expect(y).toBeCloseTo(startY + (endY - startY) * along, 6)
        }
      }
    })

    it.each([["nope"], [null], [undefined]])(
      "reducedTraversal(%p) still returns a usable animation",
      (kind) => {
        const { keyframes, options } = pack.reducedTraversal(kind, FROM, TO)
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
    it.each(SEASON_ORDER)("draws a layered backdrop for %s", (seasonId) => {
      expectBackdrop(pack.backdrop(seasonId, 4000), 4000)
    })

    it("draws a different backdrop for each season", () => {
      const drawn = SEASON_ORDER.map((seasonId) => backdropMarkup(pack.backdrop(seasonId, 4000)))
      expect(new Set(drawn).size).toBe(SEASON_ORDER.length)
    })

    // The whole point of the layer stack. One factor for everything is what the
    // backdrop used to be, and it meant a hill on the horizon panned at exactly
    // the speed of the grass underfoot -- no depth at all, however many bands
    // were drawn.
    it("gives its layers different speeds, or the stack is one flat painting", () => {
      const factors = pack.backdrop("spring", 4000).layers.map((layer) => layer.factor)
      expect(new Set(factors).size).toBeGreaterThan(1)
      // Something at or near the horizon, and something keeping up with the
      // ground. A stack whose factors were all 0.9 would pass the check above
      // and still read as flat.
      expect(Math.min(...factors)).toBeLessThan(0.4)
      expect(Math.max(...factors)).toBeGreaterThan(0.6)
    })

    it("gives every season the same stack, so no season is half-built", () => {
      const shapes = SEASON_ORDER.map((seasonId) =>
        pack.backdrop(seasonId, 4000).layers.map((layer) => [layer.name, layer.factor]),
      )
      for (const stack of shapes) expect(stack).toEqual(shapes[0])
    })

    // Generated at the trail's real width rather than scaled to it, which is
    // the whole difference between the two. A backdrop that ignored the width
    // would be stretched across the trail by the browser and its hills would
    // flatten into bands.
    it("scales to the width it is given", () => {
      const narrow = pack.backdrop("spring", 1200)
      const wide = pack.backdrop("spring", 4800)
      expect(parseViewBox(narrow.viewBox)[2]).toBe(1200)
      expect(parseViewBox(wide.viewBox)[2]).toBe(4800)
      for (const layer of narrow.layers) expect(layer.span).toBe(1200)
      for (const layer of wide.layers) expect(layer.span).toBe(4800)
      expect(backdropMarkup(wide)).not.toBe(backdropMarkup(narrow))
      expect(backdropMarkup(wide)).not.toContain("NaN")
    })

    it.each(SEASON_LIST.map((season) => [season.id, season]))(
      "fills the whole %s trail",
      (_id, season) => {
        const plan = pack.layout(season)
        const backdrop = pack.backdrop(season.id, plan.width)
        expectBackdrop(backdrop, plan.width)
      },
    )

    // Determinism, and the reason it matters: the scene is rebuilt whenever the
    // season or the character changes, and a backdrop scattered by chance would
    // deal a new snowfall each time. Nothing in this game calls Math.random.
    it.each(SEASON_ORDER)("builds %s identically every time it is asked", (seasonId) => {
      expect(backdropMarkup(pack.backdrop(seasonId, 3777))).toBe(
        backdropMarkup(pack.backdrop(seasonId, 3777)),
      )
    })

    // The failure mode a slower layer invites, checked at both ends of the
    // longest trail in the game rather than in the abstract. GameUI clamps the
    // camera to [0, width - viewportWidth] and pans layer n by offset * factor,
    // so the furthest into a layer it ever looks is factor * furthest +
    // viewportWidth. A layer narrower than that runs out mid-walk and the trail
    // ends in a band of blank canvas -- silently, because nothing throws.
    it("never runs out of landscape at either end of the longest trail", () => {
      const plan = pack.layout(LONGEST)
      const furthest = plan.width - plan.viewportWidth
      expect(furthest).toBeGreaterThan(0)
      for (const layer of pack.backdrop(LONGEST.id, plan.width).layers) {
        for (const offset of [0, furthest]) {
          const shown = offset * layer.factor
          expect(shown).toBeGreaterThanOrEqual(0)
          expect(layer.span).toBeGreaterThanOrEqual(shown + plan.viewportWidth)
        }
      }
    })
  })
})

// Placeholder-specific, and deliberately outside the contract block above: a
// replacement pack is free to draw winter however it likes. What is pinned here
// is this pack's answer to "winter is the least distinctive season despite being
// the climax" -- snow underfoot, snow on everything standing in it, and a sky
// with some value in it -- so a later palette tidy-up cannot quietly undo it.
describe("the placeholder pack's winter", () => {
  const others = SEASON_ORDER.filter((seasonId) => seasonId !== "winter")

  it("lays the lightest ground of the four under the darkest sky", () => {
    const ground = (seasonId) => lightness(placeholder.palette(seasonId)["--season-ground"])
    const sky = (seasonId) => lightness(placeholder.palette(seasonId)["--season-sky"])
    for (const seasonId of others) {
      expect(ground("winter")).toBeGreaterThan(ground(seasonId))
      expect(sky("winter")).toBeLessThan(sky(seasonId))
    }
    // And far enough apart that the trail is not one flat wash. Winter used to
    // be pale sky over pale ground, which is the whole thing this replaced.
    expect(ground("winter") - sky("winter")).toBeGreaterThan(0.2)
  })

  it("puts snow on every obstacle, over the silhouette the seasons share", () => {
    for (const kind of OBSTACLE_KINDS) {
      const winter = placeholder.obstacle(kind, "winter").element
      // Shape count, not markup: recolouring alone already makes the two differ,
      // so only the extra layer can tell a snowy obstacle from a bare one.
      for (const seasonId of others) {
        const bare = placeholder.obstacle(kind, seasonId).element
        expect(winter.childElementCount).toBeGreaterThan(bare.childElementCount)
      }
    }
  })

  it("snows on an unknown kind too, which is drawn as a hill", () => {
    expect(placeholder.obstacle("nope", "winter").element.outerHTML).toBe(
      placeholder.obstacle("hill", "winter").element.outerHTML,
    )
  })

  it("falls snow through its backdrop, and something different through everyone else's", () => {
    const air = (seasonId) =>
      placeholder.backdrop(seasonId, 3000).layers.find((layer) => layer.name === "air")
    expect(air("winter").element.childElementCount).toBeGreaterThan(0)
    for (const seasonId of others) {
      // Every season has weather now -- blossom, haze, leaves -- so a count is
      // no longer what tells winter apart. The markup is.
      expect(air("winter").element.outerHTML).not.toBe(air(seasonId).element.outerHTML)
    }
  })
})

// Also placeholder-specific: the layer stack is this pack's answer to "the
// landscape is a painted flat", and the two properties below are the ones that
// are invisible until they are wrong. A ridge that stops short leaves blank
// canvas at the end of a trail; a prop drawn a few units too low settles on the
// ground the character is walking on, which is the one place weather must not
// be. Both are cheap to check and neither throws when broken.
describe("the placeholder pack's parallax backdrop", () => {
  /** Wider than any real trail, and deliberately not a multiple of the ridge step. */
  const SPAN = 5100

  /** The layers of a season's backdrop, by name. */
  const stack = (seasonId) =>
    Object.fromEntries(placeholder.backdrop(seasonId, SPAN).layers.map((l) => [l.name, l]))

  it.each(SEASON_ORDER)("paints %s's sky and both ridges edge to edge", (seasonId) => {
    const layers = stack(seasonId)
    const sky = layers.sky.element.firstElementChild
    expect(sky.tagName).toBe("rect")
    expect(sky.getAttribute("x")).toBe("0")
    expect(sky.getAttribute("width")).toBe(String(SPAN))
    for (const name of ["far", "near"]) {
      const d = layers[name].element.firstElementChild.getAttribute("d")
      expect(d.startsWith("M 0 ")).toBe(true)
      // The ridge is sampled every 40 units and 5100 is not a multiple of 40,
      // so the last sample has to be written at the span itself. Left to the
      // loop it stopped 20 units short and the top edge ran diagonally down
      // into the bottom corner -- invisible on a fast layer, and this pack has
      // none, but it is one factor change away from being on screen.
      expect(d).toContain(` L ${SPAN} `)
    }
  })

  it.each(SEASON_ORDER)("keeps everything %s puts in the air off the ground", (seasonId) => {
    // The highest the ground can ever be: every obstacle profile pushes it down
    // from its resting line, never up, so the stops are the ceiling.
    const highestGround = Math.min(...placeholder.layout(getSeason(seasonId)).stops.map((s) => s.y))
    const props = Array.from(stack(seasonId).air.element.children)
    expect(props.length).toBeGreaterThan(0)
    for (const prop of props) {
      // The lowest point the shape can reach. A rotated ellipse can present
      // either radius downwards, so the larger of the two is the honest figure.
      const radius = Math.max(
        Number(prop.getAttribute("r") ?? 0),
        Number(prop.getAttribute("rx") ?? 0),
        Number(prop.getAttribute("ry") ?? 0),
        Number(prop.getAttribute("stroke-width") ?? 0),
      )
      const centre = prop.hasAttribute("cy")
        ? Number(prop.getAttribute("cy"))
        : Math.max(...pathYs(prop.getAttribute("d")))
      expect(centre + radius).toBeLessThan(highestGround)
    }
  })

  it("scatters its props without ever calling Math.random", () => {
    // The determinism check in the contract block covers the output; this one
    // covers the mechanism, because a pack could be deterministic today by
    // luck of a seeded stub and stop being so tomorrow.
    const random = jest.spyOn(Math, "random")
    for (const seasonId of SEASON_ORDER) placeholder.backdrop(seasonId, SPAN)
    expect(random).not.toHaveBeenCalled()
    random.mockRestore()
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

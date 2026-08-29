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
 * the contract" is checkable. The contract block below walks every character id
 * in characters.js and every season id in SEASON_ORDER and asserts a real
 * drawing comes back for each -- an SVG element with something in it, and a
 * viewBox the caller can actually size against. That is what stops a future pack
 * from shipping with, say, no winter item: the game would render an empty box
 * and nothing else would complain.
 *
 * Non-obvious setup: none. These modules build DOM through `document`, which the
 * jsdom test environment already provides, and they hold no state between calls.
 */

import { describe, expect, it, jest } from "@jest/globals"
import { activePack, getPack, packNames, SVG_NS, svg } from "../js/art/index.js"
import * as placeholder from "../js/art/placeholder.js"
import { CHARACTERS } from "../js/characters.js"
import { ART, SEASON_ORDER } from "../js/constants.js"
import { SEASON_LIST } from "../js/seasons.js"

/** Every character id the roster offers. */
const CHARACTER_IDS = CHARACTERS.map((character) => character.id)

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
    expect(activePack()).toBe(getPack(ART.PACK))
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
    ["scenery", "function"],
    ["villain", "function"],
    ["trailPath", "function"],
  ])("exports %s as a %s", (name, type) => {
    expect(typeof pack[name]).toBe(type)
    if (type === "string") expect(pack[name].length).toBeGreaterThan(0)
  })

  it.each(CHARACTER_IDS)("draws the character %s", (characterId) => {
    expectDrawing(pack.character(characterId))
  })

  it.each(SEASON_ORDER)("draws the ordinary item for %s", (seasonId) => {
    expectDrawing(pack.item(seasonId, false))
  })

  it.each(SEASON_ORDER)("draws the rare item for %s", (seasonId) => {
    expectDrawing(pack.item(seasonId, true))
  })

  it("the rare item differs from the ordinary one, or the glow means nothing", () => {
    for (const seasonId of SEASON_ORDER) {
      const plain = pack.item(seasonId, false).element.outerHTML
      const rare = pack.item(seasonId, true).element.outerHTML
      expect(rare).not.toBe(plain)
    }
  })

  it.each(SEASON_ORDER)("draws the scenery for %s", (seasonId) => {
    expectDrawing(pack.scenery(seasonId))
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

  it("scenery of an unknown season still draws, using spring's colours", () => {
    expectDrawing(placeholder.scenery("nope"))
    expect(placeholder.scenery("nope").element.outerHTML).toBe(
      placeholder.scenery("spring").element.outerHTML,
    )
  })
})

describe("palette", () => {
  it.each(SEASON_ORDER)("%s returns only --season-* custom properties", (seasonId) => {
    const colors = placeholder.palette(seasonId)
    const keys = Object.keys(colors)
    expect(keys.length).toBeGreaterThan(0)
    for (const key of keys) {
      expect(key.startsWith("--season-")).toBe(true)
      expect(isColor(colors[key])).toBe(true)
    }
  })

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
})

describe("trailPath", () => {
  const seasonLike = (spaces) => ({ id: "spring", name: "Spring", spaces })

  it.each(SEASON_LIST.map((season) => [season.id, season]))(
    "%s gets a path, a viewBox, and positive extent",
    (_id, season) => {
      const path = placeholder.trailPath(season)
      expect(path.d.startsWith("M")).toBe(true)
      expect(path.d).not.toContain("NaN")
      expect(path.width).toBeGreaterThan(0)
      expect(path.height).toBeGreaterThan(0)
      const [, , width, height] = parseViewBox(path.viewBox)
      expect(width).toBe(path.width)
      expect(height).toBe(path.height)
    },
  )

  it.each([[null], [undefined], [{}], [seasonLike(NaN)], [seasonLike("many")]])(
    "%p still yields a usable path rather than NaN coordinates",
    (season) => {
      const path = placeholder.trailPath(season)
      expect(path.d.startsWith("M")).toBe(true)
      expect(path.d).not.toContain("NaN")
      expect(path.width).toBeGreaterThan(0)
      expect(path.height).toBeGreaterThan(0)
      parseViewBox(path.viewBox)
    },
  )

  it("a longer season winds more but fills the same box", () => {
    const short = placeholder.trailPath(seasonLike(14))
    const long = placeholder.trailPath(seasonLike(20))
    expect(short.viewBox).toBe(long.viewBox)
    const curves = (d) => d.split("C").length - 1
    expect(curves(long.d)).toBeGreaterThan(curves(short.d))
  })

  it("clamps the winding so an absurd season length cannot produce a busy scribble", () => {
    const huge = placeholder.trailPath(seasonLike(1000))
    const curves = huge.d.split("C").length - 1
    expect(curves).toBeLessThanOrEqual(6)
    expect(curves).toBeGreaterThanOrEqual(3)
  })
})

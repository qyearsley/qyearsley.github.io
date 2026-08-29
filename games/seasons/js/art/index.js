/**
 * Seasons art registry -- the seam between the game and how it looks.
 *
 * No other module knows what anything in this game looks like. GameUI asks for
 * `character("phoenix")` and gets back an SVG element; it has no idea whether
 * that element is a few circles, a hand-drawn illustration, or an `<image>`
 * pointing at a sprite sheet. Swapping the art is therefore one new file in
 * this directory, two lines here (an import and a PACKS entry), and one string
 * in constants.ART.PACK. The graphics are undecided, so the decision is
 * isolated rather than deferred.
 *
 * A pack must export `id`, `name`, `palette`, `character`, `item`, `scenery`,
 * `villain`, and `trailPath`. See placeholder.js for the reference
 * implementation and the exact signatures, and ../README.md for the recipe.
 *
 * - Palettes live here, not in seasons.js, because "what colour is autumn" is a
 *   question about the art and a new pack should be free to answer it
 *   differently. A pack returns CSS custom properties, which GameUI sets on the
 *   root element; the stylesheet reads them and knows nothing about seasons.
 * - Every pack builds DOM with `createElementNS` via the `svg` helper below.
 *   `innerHTML` is deliberately not used anywhere in this game, matching the
 *   rest of the repo, so there is no path by which content could become markup.
 *
 * Note the import cycle: this file imports placeholder.js to register it, and
 * placeholder.js imports `svg` from here. It is the only cycle in the game and
 * it works only because `svg` is a hoisted function declaration -- it exists
 * before placeholder.js runs, and placeholder.js never calls it at module
 * scope. Turning `svg` into a `const` arrow, or building a drawing at the top
 * level of a pack, would make this a ReferenceError at load. Adding a second
 * pack is the point at which `svg` should move to its own module.
 *
 * Error Handling: `getPack` falls back to the placeholder pack for an unknown
 * name, logging as it goes. Missing art should look wrong, not crash the game.
 */

import { ART } from "../constants.js"
import * as placeholder from "./placeholder.js"

/**
 * The SVG namespace. Elements created with `createElement` instead of
 * `createElementNS` render as nothing at all, silently, so every SVG node in
 * this game goes through the helper below.
 * @type {string}
 */
export const SVG_NS = "http://www.w3.org/2000/svg"

/**
 * Build an SVG element.
 *
 * Attributes are set with `setAttribute`, and children may be elements or
 * strings; a string becomes a text node, never markup.
 *
 * @param {string} tag - SVG tag name, e.g. "circle"
 * @param {Object<string, string|number>} [attrs] - Attributes to set
 * @param {Array<Element|string>} [children] - Child elements or text
 * @returns {SVGElement} The new element
 */
export function svg(tag, attrs = {}, children = []) {
  const element = document.createElementNS(SVG_NS, tag)
  for (const [name, value] of Object.entries(attrs)) {
    if (value !== null && value !== undefined) element.setAttribute(name, String(value))
  }
  for (const child of children) {
    element.append(typeof child === "string" ? document.createTextNode(child) : child)
  }
  return element
}

/**
 * A drawing to hand to GameUI: an SVG element plus the viewBox it was drawn
 * for, so the caller can size it without knowing the pack's coordinate system.
 *
 * @typedef {Object} Drawing
 * @property {SVGElement} element - A `<g>` holding the artwork
 * @property {string} viewBox     - The viewBox the artwork assumes
 */

/**
 * Every available art pack, keyed by name.
 * @type {Object<string, Object>}
 */
const PACKS = {
  placeholder,
}

/**
 * Every registered pack name. Useful for a future art-style picker.
 * @returns {string[]} The known pack names
 */
export function packNames() {
  return Object.keys(PACKS)
}

/**
 * Look up an art pack by name.
 *
 * @param {unknown} name - A pack name
 * @returns {Object} The pack; the placeholder pack if the name is unknown
 */
export function getPack(name) {
  if (typeof name === "string" && Object.hasOwn(PACKS, name)) return PACKS[name]
  console.warn(`getPack: unknown art pack "${name}"; falling back to placeholder`)
  return PACKS.placeholder
}

/**
 * The pack the game is configured to use.
 *
 * @returns {Object} The active pack
 */
export function activePack() {
  return getPack(ART.PACK)
}

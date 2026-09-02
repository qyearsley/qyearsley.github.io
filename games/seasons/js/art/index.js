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
 * A pack must export twelve names: `id`, `name`, `palette`, the drawings
 * `character`, `item`, `obstacle`, `villain` and `backdrop`, and the
 * trail's geometry and motion, `layout`, `traversal`, `reducedTraversal` and
 * `standing`. See placeholder.js for the reference implementation and the exact
 * signatures, and ../README.md for what each one returns and where the recipe
 * lives.
 *
 * Two of those have return shapes worth stating here rather than only in the
 * reference pack, because both are contracts GameUI reads directly:
 *
 * - **`backdrop(seasonId, width)` returns layers, not a drawing.** It used to
 *   hand back a single `Drawing` and GameUI appended it inside the one camera
 *   group, which meant a hill on the horizon panned at exactly the speed of the
 *   grass under the character's feet -- no depth at all. It now returns
 *   `{layers, viewBox}`, back to front, and each layer says how fast it moves;
 *   GameUI pans layer `n` by `offset * factor[n]` and owns no opinion about how
 *   many layers there are or what is in them. A pack wanting the old behaviour
 *   returns one layer at a factor of 1.
 * - **`reducedTraversal(kind, from, to)` is the crossing for a player who has
 *   asked for less motion**, in the same `{keyframes, options}` shape as
 *   `traversal`. It exists because `prefers-reduced-motion` used to mean *no*
 *   motion: GameUI placed the character on the next stop instantly, and the
 *   crossing -- the trail's main piece of feedback -- simply stopped happening
 *   for anyone with the system setting on. Deciding what "less motion" looks
 *   like is a drawing decision, so it belongs to the pack; GameUI only chooses
 *   *when* to ask for it. A pack that does not export one degrades to instant
 *   placement, which is the old behaviour and never worse than it.
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
 * One plane of a backdrop, and how fast it pans.
 *
 * `factor` is the fraction of the ground's own scroll this layer takes: 0 is
 * nailed to the screen, 1 moves exactly with the trail. It must not exceed 1 --
 * a layer faster than the ground overtakes the character, which the eye reads
 * as the background sliding backwards.
 *
 * `span` is how wide the layer's artwork actually is, in trail units, and it is
 * the layer's promise that no gap can open at either end. GameUI clamps the
 * camera to `[0, width - viewportWidth]`, so the furthest into a layer it will
 * ever look is `factor * (width - viewportWidth) + viewportWidth`, and `span`
 * has to be at least that. Generating every layer at the trail's full width
 * satisfies it for any factor at or below 1, which is what the placeholder pack
 * does; a pack that tiled a short strip instead would have to say how far the
 * tiling reaches.
 *
 * @typedef {Object} BackdropLayer
 * @property {SVGElement} element - A `<g>` holding this plane's artwork
 * @property {string} name        - What the plane is, e.g. "sky"; for debugging
 * @property {number} factor      - Its share of the camera's scroll, 0 to 1
 * @property {number} span        - How wide its artwork is, in trail units
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

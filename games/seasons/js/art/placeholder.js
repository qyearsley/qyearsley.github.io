/**
 * Seasons placeholder art pack -- flat vector shapes, drawn in code.
 *
 * The reference implementation of the art-pack contract described in
 * art/index.js. Every export here is the signature a replacement pack must
 * match.
 *
 * It exists so the game is playable and legible before any art decision has
 * been made. It is deliberately geometric: layered paths and flat fills, no
 * gradients, no external files, no emoji. The bar it is trying to clear is
 * "clearly a porcupine and not embarrassing", not "finished".
 *
 * Gradients are avoided on purpose. They need `<defs>` with document-unique
 * ids, and a single drawing here is rendered many times on one page -- one
 * `character()` per card on the select screen, one `item()` per slot in the HUD
 * item track -- so ids would either collide or need a counter threaded through
 * every function. Flat fills with layered opacity get most of the depth for
 * none of that.
 *
 * Replacing this pack: write a module exporting the same names, register it in
 * art/index.js (an import line and a PACKS entry), and point constants.ART.PACK
 * at it. A pack backed by image files would return `<image>` elements from the
 * same functions; nothing about the contract assumes the art is drawn rather
 * than loaded. See ../README.md for the full recipe.
 *
 * Note that `svg` is imported from art/index.js, which imports this file back.
 * That cycle is safe only while nothing here calls `svg` at module scope; see
 * the header of art/index.js.
 *
 * Error Handling: every function tolerates an unknown id and returns a neutral
 * shape rather than throwing, so a typo shows up as a grey blob on screen
 * instead of an empty page.
 */

import { svg } from "./index.js"

/**
 * The pack's identity, for the registry and any future art-style picker.
 */
export const id = "placeholder"
export const name = "Placeholder shapes"

/**
 * The coordinate system every character and item drawing assumes.
 * @type {string}
 */
const UNIT_VIEWBOX = "0 0 100 100"

/**
 * Season palettes, as CSS custom properties. GameUI sets these on the root
 * element and the stylesheet reads them, so the CSS never names a season.
 *
 * Each season carries three accents, not one, because the colour that looks
 * right painting a trail is usually too light to be legible as text:
 * `--season-accent` paints, and `--season-accent-text` / `-dark` are tuned to
 * clear 4.5:1 against the light and dark surfaces respectively. The stylesheet
 * picks between the two text values; a pack cannot know which theme is active.
 * @private
 */
const PALETTES = {
  spring: {
    "--season-sky": "#dff3e4",
    "--season-far": "#a8d5ba",
    "--season-ground": "#6fae82",
    "--season-accent": "#e8657f",
    "--season-accent-text": "#e02c50",
    "--season-accent-text-dark": "#e86680",
    "--season-glow": "#fff2a8",
    "--season-ink": "#2b3d31",
  },
  summer: {
    "--season-sky": "#d9eefb",
    "--season-far": "#8fcfe8",
    "--season-ground": "#f0c36b",
    "--season-accent": "#4aa3d4",
    "--season-accent-text": "#297dab",
    "--season-accent-text-dark": "#4aa3d4",
    "--season-glow": "#fff3c4",
    "--season-ink": "#26404d",
  },
  autumn: {
    "--season-sky": "#fbe9d4",
    "--season-far": "#e0a96d",
    "--season-ground": "#b5703a",
    "--season-accent": "#c94f2c",
    "--season-accent-text": "#c94f2c",
    "--season-accent-text-dark": "#da7558",
    "--season-glow": "#ffd98a",
    "--season-ink": "#43281a",
  },
  winter: {
    "--season-sky": "#e7eff7",
    "--season-far": "#b8cbdd",
    "--season-ground": "#8fa6bd",
    "--season-accent": "#4f6f96",
    "--season-accent-text": "#4f6f96",
    "--season-accent-text-dark": "#7794b7",
    "--season-glow": "#ffffff",
    "--season-ink": "#22303f",
  },
}

/**
 * Used when an id is unknown, so missing art is visible but harmless.
 * @private
 */
const NEUTRAL = "#9aa5ad"

/**
 * The CSS custom properties for a season.
 *
 * @param {unknown} seasonId - A season id
 * @returns {Object<string, string>} Custom properties; spring's if unknown
 */
export function palette(seasonId) {
  return Object.hasOwn(PALETTES, seasonId) ? PALETTES[seasonId] : PALETTES.spring
}

/**
 * Wrap a list of shapes in a group tagged with its viewBox.
 * @private
 * @param {Array<Element>} shapes - The shapes to group
 * @param {string} [viewBox] - The coordinate system they assume
 * @returns {import("./index.js").Drawing} The drawing
 */
function _drawing(shapes, viewBox = UNIT_VIEWBOX) {
  return { element: svg("g", {}, shapes), viewBox }
}

/**
 * Character drawings, keyed by character id. Each returns a list of shapes in
 * the 100x100 unit box, drawn facing right.
 * @private
 */
const CHARACTERS = {
  "banana-slug": () => [
    // Body: a long low blob with the head raised at the right.
    svg("path", {
      d: "M10 74 C10 62 20 57 36 56 C54 55 70 53 78 45 C85 38 95 43 93 54 C90 67 79 74 60 76 L18 78 C13 78 10 77 10 74 Z",
      fill: "#e8d05a",
    }),
    // Mantle, the saddle-shaped shield over the back.
    svg("ellipse", { cx: 40, cy: 62, rx: 20, ry: 9, fill: "#d4b943" }),
    // Spots.
    svg("circle", { cx: 28, cy: 70, r: 2.6, fill: "#a8912c", "fill-opacity": 0.7 }),
    svg("circle", { cx: 52, cy: 68, r: 2.2, fill: "#a8912c", "fill-opacity": 0.7 }),
    svg("circle", { cx: 66, cy: 64, r: 1.8, fill: "#a8912c", "fill-opacity": 0.7 }),
    // Eyestalks.
    svg("path", {
      d: "M84 46 L80 28",
      stroke: "#e8d05a",
      "stroke-width": 5,
      "stroke-linecap": "round",
    }),
    svg("path", {
      d: "M90 47 L96 32",
      stroke: "#e8d05a",
      "stroke-width": 5,
      "stroke-linecap": "round",
    }),
    svg("circle", { cx: 79, cy: 26, r: 4, fill: "#3a3222" }),
    svg("circle", { cx: 97, cy: 30, r: 4, fill: "#3a3222" }),
    svg("circle", { cx: 80, cy: 25, r: 1.4, fill: "#fff" }),
    svg("circle", { cx: 98, cy: 29, r: 1.4, fill: "#fff" }),
  ],

  sloth: () => [
    // Branch to hang from.
    svg("rect", { x: 2, y: 11, width: 96, height: 7, rx: 3.5, fill: "#7a5b3a" }),
    // Body.
    svg("ellipse", { cx: 52, cy: 66, rx: 21, ry: 23, fill: "#9b8468" }),
    svg("ellipse", { cx: 52, cy: 70, rx: 13, ry: 15, fill: "#b6a189", "fill-opacity": 0.8 }),
    // Head.
    svg("circle", { cx: 52, cy: 44, r: 16, fill: "#c3b099" }),
    // Eye patches, the sloth's whole face really.
    svg("ellipse", { cx: 45, cy: 42, rx: 6, ry: 7, fill: "#6d5a45", "fill-opacity": 0.85 }),
    svg("ellipse", { cx: 59, cy: 42, rx: 6, ry: 7, fill: "#6d5a45", "fill-opacity": 0.85 }),
    svg("circle", { cx: 45, cy: 42, r: 2.6, fill: "#2e2519" }),
    svg("circle", { cx: 59, cy: 42, r: 2.6, fill: "#2e2519" }),
    svg("circle", { cx: 52, cy: 50, r: 2.4, fill: "#6d5a45" }),
    // The permanent faint smile.
    svg("path", {
      d: "M46 55 Q52 59 58 55",
      stroke: "#6d5a45",
      "stroke-width": 2,
      fill: "none",
      "stroke-linecap": "round",
    }),
    // Arms last, so they hang in FRONT of the body and head. Behind them the
    // sloth reads as a generic round animal with no reason to be up a tree.
    //
    // Filled bands rather than thick strokes, for the same reason as the snake
    // woman's coils: a stroke-only path disappears in renderers that treat
    // `stroke-width` loosely, and the arms are too much of the silhouette to
    // risk that.
    svg("path", { d: "M43 59 C29 53 25 32 31 14 L22 15 C17 33 21 54 35 63 Z", fill: "#8a7259" }),
    svg("path", { d: "M61 59 C75 53 79 32 73 14 L82 15 C87 33 83 54 69 63 Z", fill: "#8a7259" }),
    // Claws hooked over the branch.
    svg("path", { d: "M20 16 C18 8 26 4 31 9 L28 13 C25 10 21 12 24 17 Z", fill: "#4a3b2c" }),
    svg("path", { d: "M84 16 C86 8 78 4 73 9 L76 13 C79 10 83 12 80 17 Z", fill: "#4a3b2c" }),
  ],

  phoenix: () => [
    // Tail plumes, layered back to front.
    svg("path", { d: "M40 62 C22 72 12 86 16 96 C26 90 34 80 44 74 Z", fill: "#d94f2b" }),
    svg("path", { d: "M42 60 C28 64 16 74 14 84 C26 80 36 72 46 68 Z", fill: "#f08a2c" }),
    // Wing, swept up.
    svg("path", { d: "M50 52 C40 34 46 16 66 8 C64 26 62 40 58 54 Z", fill: "#f5b53f" }),
    svg("path", {
      d: "M52 54 C48 40 54 26 68 18 C66 32 62 44 58 56 Z",
      fill: "#ffd76a",
      "fill-opacity": 0.85,
    }),
    // Body.
    svg("path", {
      d: "M46 70 C42 56 50 44 62 44 C74 44 82 54 80 66 C78 78 66 84 56 80 Z",
      fill: "#e8642a",
    }),
    // Head and crest.
    svg("circle", { cx: 74, cy: 40, r: 11, fill: "#f5843a" }),
    svg("path", { d: "M72 30 C70 20 76 14 84 12 C80 20 80 26 79 31 Z", fill: "#ffd76a" }),
    // Beak and eye.
    svg("path", { d: "M84 40 L95 44 L84 47 Z", fill: "#f5b53f" }),
    svg("circle", { cx: 77, cy: 37, r: 3, fill: "#3a1f0e" }),
    svg("circle", { cx: 78, cy: 36, r: 1.1, fill: "#fff" }),
  ],

  porcupine: () => {
    // Quills, generated so the fan is even rather than hand-placed.
    const quills = []
    for (let i = 0; i < 13; i += 1) {
      const angle = Math.PI * (0.08 + (i / 12) * 0.84)
      const cx = 52
      const cy = 66
      const inner = 22
      const outer = 40
      quills.push(
        svg("path", {
          d: `M${cx - Math.cos(angle) * inner} ${cy - Math.sin(angle) * inner} L${
            cx - Math.cos(angle) * outer
          } ${cy - Math.sin(angle) * outer}`,
          stroke: i % 2 === 0 ? "#4a3b2c" : "#6d5642",
          "stroke-width": 3.4,
          "stroke-linecap": "round",
        }),
      )
    }
    return [
      ...quills,
      // Body.
      svg("ellipse", { cx: 50, cy: 68, rx: 27, ry: 21, fill: "#6d5642" }),
      svg("ellipse", { cx: 50, cy: 72, rx: 20, ry: 14, fill: "#8a7159", "fill-opacity": 0.7 }),
      // Snout.
      svg("path", { d: "M74 66 C84 64 92 68 92 73 C92 78 82 80 74 77 Z", fill: "#a3907c" }),
      svg("circle", { cx: 91, cy: 72, r: 2.6, fill: "#33291f" }),
      // Eye.
      svg("circle", { cx: 71, cy: 63, r: 3.2, fill: "#33291f" }),
      svg("circle", { cx: 72, cy: 62, r: 1.2, fill: "#fff" }),
      // Feet.
      svg("ellipse", { cx: 38, cy: 87, rx: 7, ry: 4, fill: "#4a3b2c" }),
      svg("ellipse", { cx: 60, cy: 87, rx: 7, ry: 4, fill: "#4a3b2c" }),
    ]
  },
}

/**
 * Draw a character.
 *
 * @param {unknown} characterId - A character id
 * @returns {import("./index.js").Drawing} The drawing; a neutral blob if unknown
 */
export function character(characterId) {
  // Object.hasOwn, not a bare lookup: `character("constructor")` off a
  // corrupted save would otherwise reach Object.prototype and throw, and
  // this file's header promises an unknown id degrades to a neutral shape.
  const draw = Object.hasOwn(CHARACTERS, characterId) ? CHARACTERS[characterId] : null
  if (!draw) return _drawing([svg("circle", { cx: 50, cy: 55, r: 30, fill: NEUTRAL })])
  return _drawing(draw())
}

/**
 * Item drawings, keyed by season id -- the rose, diamond, leaf, and icicle Ella
 * named. `rare` swaps in the brighter treatment for a glowing space's reward.
 * @private
 */
const ITEMS = {
  spring: (rare) => [
    svg("path", {
      d: "M50 62 L50 92",
      stroke: "#4f7a4a",
      "stroke-width": 4,
      "stroke-linecap": "round",
    }),
    svg("path", { d: "M50 76 C40 72 34 76 32 82 C40 84 47 82 50 78 Z", fill: "#4f7a4a" }),
    svg("circle", { cx: 50, cy: 44, r: 24, fill: rare ? "#ff8fa8" : "#d94f6a" }),
    svg("circle", { cx: 50, cy: 44, r: 16, fill: rare ? "#ffb3c4" : "#e8657f" }),
    svg("circle", { cx: 50, cy: 44, r: 9, fill: rare ? "#ffd9e2" : "#f18ba0" }),
    svg("circle", { cx: 50, cy: 44, r: 3.5, fill: rare ? "#fff6b0" : "#c93f5c" }),
  ],
  summer: (rare) => [
    svg("path", { d: "M50 12 L82 42 L50 92 L18 42 Z", fill: rare ? "#a8f0ff" : "#7fd8f0" }),
    svg("path", { d: "M50 12 L82 42 L50 42 Z", fill: "#fff", "fill-opacity": 0.45 }),
    svg("path", { d: "M18 42 L50 42 L50 92 Z", fill: "#2b7fa8", "fill-opacity": 0.3 }),
    svg("path", { d: "M50 12 L50 42", stroke: "#fff", "stroke-width": 2, "stroke-opacity": 0.7 }),
  ],
  autumn: (rare) => [
    svg("path", {
      d: "M50 90 C20 74 18 34 50 10 C82 34 80 74 50 90 Z",
      fill: rare ? "#f2c14e" : "#d97b28",
    }),
    svg("path", {
      d: "M50 90 L50 24",
      stroke: "#8a4a18",
      "stroke-width": 3,
      "stroke-linecap": "round",
    }),
    svg("path", {
      d: "M50 44 L32 32 M50 58 L34 50 M50 44 L68 32 M50 58 L66 50",
      stroke: "#8a4a18",
      "stroke-width": 2,
    }),
  ],
  winter: (rare) => [
    // Winter's palette is the palest of the four, and an icicle drawn in ice
    // colours vanishes into it. The saturated cap and the shaded facet are what
    // give it an edge without relying on a stroke.
    svg("rect", { x: 30, y: 4, width: 40, height: 8, rx: 3, fill: rare ? "#7fc9e8" : "#4f9ec4" }),
    svg("path", { d: "M34 10 L66 10 L55 60 L50 94 L45 60 Z", fill: rare ? "#d8f4ff" : "#8fd4ee" }),
    svg("path", { d: "M34 10 L50 10 L48 58 L45 60 Z", fill: "#4f9ec4", "fill-opacity": 0.45 }),
    svg("path", { d: "M57 15 L61 15 L53 54 L51 47 Z", fill: "#fff", "fill-opacity": 0.8 }),
  ],
}

/**
 * Draw a season's collectible.
 *
 * @param {unknown} seasonId - A season id
 * @param {boolean} [rare] - Whether this is the glowing-space version
 * @returns {import("./index.js").Drawing} The drawing; a neutral disc if unknown
 */
export function item(seasonId, rare = false) {
  const draw = Object.hasOwn(ITEMS, seasonId) ? ITEMS[seasonId] : null
  if (!draw) return _drawing([svg("circle", { cx: 50, cy: 50, r: 26, fill: NEUTRAL })])
  return _drawing(draw(rare))
}

/**
 * The background band behind the trail: three layers of hills in the season's
 * palette. Drawn in a wide box because it sits behind the whole journey.
 *
 * @param {unknown} seasonId - A season id
 * @returns {import("./index.js").Drawing} The drawing
 */
export function scenery(seasonId) {
  const colors = palette(seasonId)
  return _drawing(
    [
      svg("rect", { x: 0, y: 0, width: 1000, height: 220, fill: colors["--season-sky"] }),
      svg("path", {
        d: "M0 150 C120 110 200 160 320 138 C450 114 520 158 660 136 C790 116 880 154 1000 132 L1000 220 L0 220 Z",
        fill: colors["--season-far"],
        "fill-opacity": 0.7,
      }),
      svg("path", {
        d: "M0 182 C140 156 240 196 380 176 C520 156 620 194 760 174 C860 160 930 186 1000 176 L1000 220 L0 220 Z",
        fill: colors["--season-ground"],
        "fill-opacity": 0.85,
      }),
    ],
    "0 0 1000 220",
  )
}

/**
 * The snake woman. A coiled serpent with a crowned head -- she is a
 * potion-maker who sets the quest, not a threat, so the shape leans regal and
 * composed rather than monstrous.
 *
 * Built almost entirely from filled shapes rather than thick strokes: a stroked
 * path looks identical in a browser but vanishes in any renderer that treats
 * `stroke-width` loosely, and the coil reads better as a solid body anyway.
 *
 * @returns {import("./index.js").Drawing} The drawing
 */
export function villain() {
  return _drawing([
    // Coils, back to front. Each is an ellipse with a darker inner ellipse, so
    // it reads as a ring of body rather than a flat blob.
    svg("ellipse", { cx: 50, cy: 82, rx: 37, ry: 15, fill: "#4b7a5a" }),
    svg("ellipse", { cx: 50, cy: 83, rx: 21, ry: 6, fill: "#3d6549" }),
    svg("ellipse", { cx: 53, cy: 68, rx: 27, ry: 12, fill: "#5a8c66" }),
    svg("ellipse", { cx: 53, cy: 69, rx: 14, ry: 5, fill: "#4b7a5a" }),
    // Tail tip curling out of the lower coil.
    svg("path", { d: "M13 84 C6 82 4 76 8 72 C10 78 14 79 17 79 Z", fill: "#4b7a5a" }),
    // The body rising out of the coils, tapering toward the hood.
    svg("path", { d: "M44 66 C42 54 45 43 52 35 L66 40 C60 47 57 55 58 66 Z", fill: "#6a9c76" }),
    // Hood.
    svg("path", {
      d: "M38 33 C38 13 78 13 78 33 C78 46 58 51 58 51 C58 51 38 46 38 33 Z",
      fill: "#6a9c76",
    }),
    svg("path", {
      d: "M46 31 C46 20 70 20 70 31 C70 39 58 43 58 43 C58 43 46 39 46 31 Z",
      fill: "#7fb08b",
    }),
    // Head.
    svg("ellipse", { cx: 58, cy: 28, rx: 13, ry: 14, fill: "#8fc39b" }),
    // Her crown.
    svg("path", { d: "M45 17 L49 6 L54 15 L58 2 L62 15 L67 6 L71 17 Z", fill: "#e8c34a" }),
    svg("circle", { cx: 58, cy: 4, r: 2.2, fill: "#f5e08a" }),
    // Eyes, slit pupils.
    svg("ellipse", { cx: 52, cy: 28, rx: 3.4, ry: 4.4, fill: "#f5f0c8" }),
    svg("ellipse", { cx: 64, cy: 28, rx: 3.4, ry: 4.4, fill: "#f5f0c8" }),
    svg("ellipse", { cx: 52, cy: 28, rx: 1.1, ry: 3.4, fill: "#2b3d31" }),
    svg("ellipse", { cx: 64, cy: 28, rx: 1.1, ry: 3.4, fill: "#2b3d31" }),
    // Forked tongue.
    svg("path", {
      d: "M56.6 40 L59.4 40 L59.4 47 L62 51 L60 52 L58 49 L56 52 L54 51 L56.6 47 Z",
      fill: "#c94f6a",
    }),
  ])
}

/**
 * The path the trail is drawn along, as an SVG `d` string.
 *
 * A longer season winds more, so the trail always fills the same box whether it
 * has fourteen spaces or twenty. GameUI walks this path with `getPointAtLength`
 * to place the space markers and the character, so the curve can change shape
 * completely without any layout code changing.
 *
 * @param {import("../seasons.js").Season|null} season - The season being played
 * @returns {{d: string, viewBox: string, width: number, height: number}} The path
 */
export function trailPath(season) {
  const width = 1000
  const height = 220
  const margin = 56
  const amplitude = 46
  const mid = height / 2 + 12
  const spaces = Number.isFinite(season?.spaces) ? season.spaces : 12
  // One full wave per four spaces, clamped so the curve never gets too busy.
  const waves = Math.max(3, Math.min(6, Math.round(spaces / 3.5)))
  const span = (width - margin * 2) / waves

  let d = `M ${margin} ${mid}`
  for (let i = 0; i < waves; i += 1) {
    const x0 = margin + span * i
    const x1 = x0 + span
    const lift = i % 2 === 0 ? -amplitude : amplitude
    d += ` C ${x0 + span / 3} ${mid + lift}, ${x1 - span / 3} ${mid + lift}, ${x1} ${mid}`
  }
  return { d, viewBox: `0 0 ${width} ${height}`, width, height }
}

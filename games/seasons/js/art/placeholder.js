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
    "--season-water": "#6fb0cf",
    "--season-rock": "#71857c",
    "--season-leaf": "#3f8455",
    "--season-earth": "#5b9c6e",
    "--season-trunk": "#5a4632",
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
    "--season-water": "#3f9ccf",
    "--season-rock": "#8d8168",
    "--season-leaf": "#5f8f3d",
    "--season-earth": "#d9a94f",
    "--season-trunk": "#6b5533",
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
    "--season-water": "#5f8fae",
    "--season-rock": "#7a6553",
    "--season-leaf": "#a8551c",
    "--season-earth": "#96552a",
    "--season-trunk": "#5b3a22",
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
    "--season-water": "#5b86a8",
    "--season-rock": "#5f6d7d",
    "--season-leaf": "#4f6f68",
    "--season-earth": "#7890a8",
    "--season-trunk": "#48535e",
    // Warm rather than white. A white glow on winter's near-white sky was
    // invisible, in the one season Ella called the hardest.
    "--season-glow": "#ffd27a",
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
    // Branch to hang from -- card only; see `character(id, onTrail)`.
    svg("rect", {
      x: 2,
      y: 11,
      width: 96,
      height: 7,
      rx: 3.5,
      fill: "#7a5b3a",
      "data-hangs-from": "1",
    }),
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
    svg("path", {
      d: "M20 16 C18 8 26 4 31 9 L28 13 C25 10 21 12 24 17 Z",
      fill: "#4a3b2c",
      "data-hangs-from": "1",
    }),
    svg("path", {
      d: "M84 16 C86 8 78 4 73 9 L76 13 C79 10 83 12 80 17 Z",
      fill: "#4a3b2c",
      "data-hangs-from": "1",
    }),
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
 * @param {boolean} [onTrail] - Drop anything the animal hangs from on its card
 * @returns {import("./index.js").Drawing} The drawing; a neutral blob if unknown
 */
export function character(characterId, onTrail = false) {
  // Object.hasOwn, not a bare lookup: `character("constructor")` off a
  // corrupted save would otherwise reach Object.prototype and throw, and
  // this file's header promises an unknown id degrades to a neutral shape.
  const draw = Object.hasOwn(CHARACTERS, characterId) ? CHARACTERS[characterId] : null
  if (!draw) return _drawing([svg("circle", { cx: 50, cy: 55, r: 30, fill: NEUTRAL })])
  // On the trail the animal is standing on the ground, so anything it hangs
  // from on its card has to go: the sloth's branch otherwise travelled with it
  // as a stick floating in mid-air.
  return _drawing(draw().filter((shape) => !(onTrail && shape.dataset?.hangsFrom)))
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

/* ==================== Obstacles ==================== */

/**
 * The six obstacle drawings, keyed by kind. Each is drawn in trail coordinates
 * around an origin of (0, 0) sitting on the ground, so `layout` can place it by
 * translation alone. They read from the season palette rather than fixed
 * colours, so one drawing serves all four seasons.
 * @private
 */
const OBSTACLE_ART = {
  hill: (c, edge) => [
    // Broad and low: the gentlest thing on a trail, and a much wider silhouette
    // than the boulder so the two never read alike.
    svg("path", {
      d: "M-118 2 C-84 -44 -44 -62 0 -62 C46 -62 88 -42 118 2 Z",
      fill: c.earth,
      ...edge,
    }),
    svg("path", {
      d: "M-118 2 C-84 -44 -44 -62 0 -62 C-22 -38 -44 -16 -56 2 Z",
      fill: c.leaf,
      "fill-opacity": 0.45,
    }),
    svg("path", {
      d: "M-40 -44 C-20 -54 12 -54 34 -44",
      stroke: "#fff",
      "stroke-width": 3,
      "stroke-opacity": 0.22,
      fill: "none",
    }),
  ],

  mountain: (c, edge) => [
    // Deliberately the biggest thing on any trail: it is the hard question.
    svg("path", { d: "M-124 2 L-40 -120 L0 -78 L44 -108 L128 2 Z", fill: c.rock, ...edge }),
    svg("path", {
      d: "M-40 -120 L0 -78 L-14 -60 L-72 2 L-124 2 Z",
      fill: c.ink,
      "fill-opacity": 0.22,
    }),
    svg("path", { d: "M-40 -120 L-60 -84 L-18 -84 Z", fill: "#fff", "fill-opacity": 0.9 }),
    svg("path", { d: "M44 -108 L28 -80 L60 -80 Z", fill: "#fff", "fill-opacity": 0.8 }),
  ],

  river: (c, edge) => [
    // Sits in the basin `layout` sinks into the ground for it. Stepping stones,
    // because the crossing animation lands on them twice.
    svg("path", {
      d: "M-106 -4 C-66 34 -30 50 0 50 C34 50 70 32 106 -4 Z",
      fill: c.water,
      ...edge,
    }),
    svg("path", {
      d: "M-70 6 C-52 -2 -34 2 -18 -4",
      stroke: "#fff",
      "stroke-width": 3.5,
      "stroke-opacity": 0.55,
      fill: "none",
      "stroke-linecap": "round",
    }),
    svg("path", {
      d: "M20 12 C36 4 54 8 70 2",
      stroke: "#fff",
      "stroke-width": 3.5,
      "stroke-opacity": 0.38,
      fill: "none",
      "stroke-linecap": "round",
    }),
    svg("ellipse", { cx: -42, cy: 6, rx: 19, ry: 8, fill: c.rock, ...edge }),
    svg("ellipse", { cx: 42, cy: 6, rx: 19, ry: 8, fill: c.rock, ...edge }),
  ],

  boulder: (c, edge) => [
    // Angular and faceted, in rock rather than earth, so it does not read as a
    // second, smaller hill.
    svg("ellipse", { cx: 4, cy: 0, rx: 70, ry: 11, fill: c.ink, "fill-opacity": 0.18 }),
    svg("path", { d: "M-58 2 L-46 -50 L-6 -78 L38 -62 L58 -20 L48 2 Z", fill: c.rock, ...edge }),
    svg("path", {
      d: "M-58 2 L-46 -50 L-6 -78 L-2 -38 L-14 2 Z",
      fill: c.ink,
      "fill-opacity": 0.24,
    }),
    svg("path", { d: "M-6 -78 L38 -62 L34 -34 L-2 -38 Z", fill: "#fff", "fill-opacity": 0.24 }),
  ],

  thicket: (c, edge) => [
    // Three trunked shrubs with daylight between them, so the silhouette is
    // clearly vegetation to push through rather than one solid mound.
    svg("path", {
      d: "M-80 4 L-78 -34",
      stroke: c.trunk,
      "stroke-width": 8,
      "stroke-linecap": "round",
    }),
    svg("path", {
      d: "M-2 4 L-4 -54",
      stroke: c.trunk,
      "stroke-width": 10,
      "stroke-linecap": "round",
    }),
    svg("path", {
      d: "M80 4 L76 -30",
      stroke: c.trunk,
      "stroke-width": 8,
      "stroke-linecap": "round",
    }),
    svg("circle", { cx: -80, cy: -58, r: 30, fill: c.leaf, ...edge }),
    svg("circle", { cx: 78, cy: -54, r: 28, fill: c.leaf, ...edge }),
    svg("circle", { cx: -4, cy: -86, r: 40, fill: c.leaf, ...edge }),
    svg("circle", { cx: -18, cy: -98, r: 20, fill: "#fff", "fill-opacity": 0.2 }),
    svg("circle", { cx: -90, cy: -70, r: 13, fill: "#fff", "fill-opacity": 0.16 }),
  ],

  gap: (c) => [
    // A break in the ground rather than an object on it: nothing to climb, and
    // the darkness IS the obstacle. It widens with depth and overshoots the
    // canvas on purpose: the ground's break is a constant width, so a shape that
    // tapered inward let the backdrop show through either side of it.
    svg("path", { d: "M-64 -2 L64 -2 L72 120 L-72 120 Z", fill: c.ink, "fill-opacity": 0.88 }),
    svg("path", { d: "M-64 -2 L-72 120 L-40 120 L-40 -2 Z", fill: c.ink, "fill-opacity": 0.55 }),
    svg("path", { d: "M-74 -4 L-58 -4 L-54 12 L-76 10 Z", fill: c.rock }),
    svg("path", { d: "M74 -4 L58 -4 L54 12 L76 10 Z", fill: c.rock }),
  ],
}

/**
 * Draw the obstacle standing at a space.
 *
 * Returned in trail coordinates with its base at the origin, so `layout`'s
 * obstacle positions place it by translation. Unlike `character` and `item`,
 * this takes a season so one drawing can be recoloured for all four.
 *
 * @param {unknown} kind - An obstacle kind; see obstacles.js
 * @param {unknown} seasonId - The season being played, for the palette
 * @returns {import("./index.js").Drawing} The drawing; a plain mound if unknown
 */
export function obstacle(kind, seasonId) {
  const colors = palette(seasonId)
  // Materials, not palette slots. A boulder is rock, a thicket is leaf and
  // trunk, a river is water -- so each obstacle separates from the ground it
  // stands on instead of dissolving into it, which is what happened when every
  // shape was drawn in the season's two earth tones.
  const c = {
    earth: colors["--season-earth"],
    rock: colors["--season-rock"],
    leaf: colors["--season-leaf"],
    trunk: colors["--season-trunk"],
    water: colors["--season-water"],
    far: colors["--season-far"],
    ink: colors["--season-ink"],
  }
  // One shared outline for every silhouette. Materials do most of the
  // separation, but a season whose ground happens to sit close to a material
  // would still flatten out; the edge guarantees the shape reads regardless.
  const edge = { stroke: c.ink, "stroke-opacity": 0.3, "stroke-width": 2.5 }
  const draw = Object.hasOwn(OBSTACLE_ART, kind) ? OBSTACLE_ART[kind] : OBSTACLE_ART.hill
  return { element: svg("g", {}, draw(c, edge)), viewBox: "-124 -200 248 208" }
}

/* ==================== Trail geometry ==================== */

/**
 * Trail geometry, in user units. The trail is drawn far wider than the screen
 * and scrolled; VIEWPORT_WIDTH is how much is visible at once, so about four
 * obstacles are on screen and each is large enough to animate over.
 * @private
 */
const SPACING = 240
const MARGIN = 150
const HEIGHT = 258
const VIEWPORT_WIDTH = 1100

/** Where the ground rests, and how far it undulates either side. @private */
const GROUND = 190
const ROLL = 14

/** Half the drawn token's width, and how far its feet sit below its origin. @private */
const TOKEN_HALF = 34
const TOKEN_FOOT = 62

/**
 * How each obstacle kind deforms the ground it stands on.
 *
 * Hills, boulders, thickets and mountains sit *on* the ground and change nothing
 * here. A river and a gap are holes *in* it, and drawing them as objects on a
 * flat band was why neither read as anything -- a river looked like a puddle and
 * a gap like a dark sticker. A river sinks the ground into a basin that can hold
 * water; a gap removes the ground outright, which is what makes the leap legible.
 * @private
 */
const GROUND_PROFILE = {
  river: { dip: 46, halfWidth: 104 },
  gap: { breakHalfWidth: 62, dip: 10, halfWidth: 96 },
}

/**
 * The ground's resting height at a given x, before any obstacle deforms it.
 * @private
 * @param {number} x - Horizontal position in user units
 * @returns {number} The ground's y
 */
function restingGroundY(x) {
  return GROUND + Math.sin(x / 260) * ROLL
}

/**
 * Smooth 0..1 falloff, 1 at a feature's centre and 0 at its edge, so a river
 * basin eases into the surrounding ground instead of stepping down into it.
 * @private
 * @param {number} distance - Distance from the feature's centre
 * @param {number} halfWidth - Where the feature reaches zero
 * @returns {number} A weight in 0..1
 */
function falloff(distance, halfWidth) {
  if (Math.abs(distance) >= halfWidth) return 0
  return (Math.cos((distance / halfWidth) * Math.PI) + 1) / 2
}

/**
 * Where each obstacle sits, and what it does to the ground under it.
 * @private
 * @param {string[]} route - The season's obstacle kinds
 * @returns {Array<{kind: string, x: number, profile: Object|null}>} Placements
 */
function placements(route) {
  return route.map((kind, i) => ({
    kind,
    x: MARGIN + i * SPACING + SPACING / 2,
    profile: Object.hasOwn(GROUND_PROFILE, kind) ? GROUND_PROFILE[kind] : null,
  }))
}

/**
 * The ground's height at x with every obstacle's deformation applied.
 * @private
 * @param {number} x - Horizontal position
 * @param {Array<Object>} spots - Output of `placements`
 * @returns {number} The deformed ground y
 */
function deformedGroundY(x, spots) {
  let y = restingGroundY(x)
  for (const spot of spots) {
    if (spot.profile) y += spot.profile.dip * falloff(x - spot.x, spot.profile.halfWidth)
  }
  return y
}

/**
 * The ground as one or more filled paths.
 *
 * More than one because a gap genuinely removes the ground: each gap ends a
 * segment and starts the next, so the void between them is the sky showing
 * through rather than a dark shape drawn on top of solid earth.
 * @private
 * @param {number} width - Total trail width
 * @param {Array<Object>} spots - Output of `placements`
 * @returns {string[]} One SVG path `d` per unbroken stretch of ground
 */
function groundSegmentsFor(width, spots) {
  const breaks = spots
    .filter((spot) => spot.profile?.breakHalfWidth)
    .map((spot) => [spot.x - spot.profile.breakHalfWidth, spot.x + spot.profile.breakHalfWidth])
  const inBreak = (x) => breaks.some(([from, to]) => x > from && x < to)

  const segments = []
  let points = []
  const flush = () => {
    if (points.length >= 2) {
      const first = points[0]
      const last = points[points.length - 1]
      const line = points.map(([x, y], i) => `${i ? "L" : "M"} ${x} ${y}`).join(" ")
      segments.push(`${line} L ${last[0]} ${HEIGHT} L ${first[0]} ${HEIGHT} Z`)
    }
    points = []
  }
  for (let x = 0; x <= width; x += 12) {
    if (inBreak(x)) flush()
    else points.push([x, deformedGroundY(x, spots)])
  }
  flush()
  return segments
}

/**
 * The sky and distant hills behind a whole trail.
 *
 * Generated at the trail's real width rather than scaled to it: an earlier
 * fixed-size vignette stretched across a 5000-unit trail flattened its hills
 * into flat bands. Two rolling layers at different frequencies, which gives a
 * little depth as the camera pans.
 *
 * @param {unknown} seasonId - The season being played
 * @param {number} width - Total trail width in user units
 * @returns {import("./index.js").Drawing} The backdrop
 */
export function backdrop(seasonId, width) {
  const colors = palette(seasonId)
  const span = Math.max(1, width)
  const band = (amplitude, wavelength, top, fill, opacity) => {
    let d = `M 0 ${top + Math.sin(0) * amplitude}`
    for (let x = 40; x <= span; x += 40) {
      d += ` L ${x} ${top + Math.sin(x / wavelength) * amplitude}`
    }
    return svg("path", {
      d: `${d} L ${span} ${HEIGHT} L 0 ${HEIGHT} Z`,
      fill,
      "fill-opacity": opacity,
    })
  }
  return {
    element: svg("g", {}, [
      svg("rect", { x: 0, y: 0, width: span, height: HEIGHT, fill: colors["--season-sky"] }),
      band(26, 520, 150, colors["--season-far"], 0.55),
      band(18, 300, 196, colors["--season-far"], 0.85),
    ]),
    viewBox: `0 0 ${span} ${HEIGHT}`,
  }
}

/**
 * Geometry for a season's trail.
 *
 * `stops[i]` is where the character stands while facing obstacle `i`, and
 * `stops[route.length]` is the boss. Obstacle `i` sits between stops `i` and
 * `i + 1`, so crossing it is a move from one stop to the next.
 *
 * @param {import("../seasons.js").Season|null} season - The season being played
 * @returns {{width: number, height: number, viewportWidth: number, viewBox: string,
 *   groundSegments: string[], stops: Array<{x: number, y: number}>,
 *   obstacles: Array<{kind: string, x: number, y: number}>, tokenScale: number,
 *   bossOffset: number, bossTransform: string,
 *   glow: {cy: number, r: number}}} The trail's geometry, plus how this pack
 *   wants the shared pieces placed within it
 */
export function layout(season) {
  const route = Array.isArray(season?.route) && season.route.length ? season.route : ["hill"]
  const width = MARGIN * 2 + route.length * SPACING
  const spots = placements(route)
  // Stops sit on the resting ground, never the deformed ground: the character
  // stands at the near edge of each obstacle, not down in a basin or a void.
  const stops = Array.from({ length: route.length + 1 }, (_, i) => {
    const x = MARGIN + i * SPACING
    return { x, y: restingGroundY(x) }
  })
  return {
    width,
    height: HEIGHT,
    viewportWidth: VIEWPORT_WIDTH,
    viewBox: `0 0 ${VIEWPORT_WIDTH} ${HEIGHT}`,
    groundSegments: groundSegmentsFor(width, spots),
    stops,
    obstacles: spots.map((spot) => ({ kind: spot.kind, x: spot.x, y: restingGroundY(spot.x) })),
    // How the shared pieces are scaled and placed in *this* pack's coordinate
    // system. GameUI used to hard-code these four numbers, which quietly made it
    // a second place that knew how the art was drawn -- so a replacement pack
    // could not actually be dropped in without editing the UI too.
    tokenScale: 0.68,
    bossOffset: 60,
    bossTransform: "translate(-52 -132) scale(1.05)",
    glow: { cy: -88, r: 86 },
  }
}

/**
 * How the character gets across one obstacle, as Web Animations keyframes.
 *
 * The pack owns the motion as well as the drawing, so a future sprite pack can
 * return frame-swapping keyframes where this one returns transforms, and GameUI
 * does not have to know which it got. Every kind moves between the same two
 * points; what differs is the shape of the path and the timing, which is where
 * the sense of weight comes from.
 *
 * @param {string} kind - The obstacle kind being crossed
 * @param {{x: number, y: number}} from - The stop being left
 * @param {{x: number, y: number}} to - The stop being reached
 * @returns {{keyframes: Array<Object>, options: Object}} Input for `Element.animate`
 */
export function traversal(kind, from, to) {
  const at = (point, lift = 0, extra = "") =>
    `translate(${point.x - TOKEN_HALF}px, ${point.y - TOKEN_FOOT - lift}px)${extra}`
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
  const quarter = { x: from.x + (to.x - from.x) * 0.25, y: from.y + (to.y - from.y) * 0.25 }
  const threeQuarter = { x: from.x + (to.x - from.x) * 0.75, y: from.y + (to.y - from.y) * 0.75 }

  switch (kind) {
    case "gap":
      // A long low leap: fast, committed, no hang time.
      return {
        keyframes: [
          { transform: at(from, 0, " scaleY(0.86)") },
          { transform: at(mid, 96), offset: 0.5 },
          { transform: at(to, 0, " scaleY(0.9)") },
        ],
        options: { duration: 620, easing: "ease-out" },
      }
    case "river":
      // Two hops across, as if using stones -- low, quick, a bob each time.
      return {
        keyframes: [
          { transform: at(from) },
          { transform: at(quarter, 44), offset: 0.25 },
          { transform: at(mid, 4), offset: 0.5 },
          { transform: at(threeQuarter, 44), offset: 0.75 },
          { transform: at(to) },
        ],
        options: { duration: 780, easing: "ease-in-out" },
      }
    case "boulder":
      // Up and over something solid: steep, and a moment on top.
      return {
        keyframes: [
          { transform: at(from) },
          { transform: at(quarter, 84), offset: 0.35 },
          { transform: at(mid, 100), offset: 0.55 },
          { transform: at(to) },
        ],
        options: { duration: 760, easing: "ease-in-out" },
      }
    case "thicket":
      // No lift at all -- pushing through, squashed narrow, and slower for it.
      return {
        keyframes: [
          { transform: at(from) },
          { transform: at(quarter, 0, " scaleX(0.78)"), offset: 0.3 },
          { transform: at(threeQuarter, 0, " scaleX(0.82)"), offset: 0.7 },
          { transform: at(to) },
        ],
        options: { duration: 880, easing: "ease-in-out" },
      }
    case "mountain":
      // The hard one. Slow, high, and it pauses at the summit.
      return {
        keyframes: [
          { transform: at(from, 0, " scaleY(0.92)") },
          { transform: at(quarter, 104), offset: 0.3 },
          { transform: at(mid, 128), offset: 0.5 },
          { transform: at(mid, 128), offset: 0.62 },
          { transform: at(threeQuarter, 104), offset: 0.82 },
          { transform: at(to) },
        ],
        options: { duration: 1150, easing: "ease-in-out" },
      }
    case "hill":
    default:
      // A rolling scramble up and down the far side.
      return {
        keyframes: [
          { transform: at(from) },
          { transform: at(mid, 74), offset: 0.5 },
          { transform: at(to) },
        ],
        options: { duration: 700, easing: "ease-in-out" },
      }
  }
}

/**
 * Where the character stands, as a transform, with no animation. Used to place
 * the token on first draw and after a jump that should not be animated.
 *
 * @param {{x: number, y: number}} stop - The stop to stand on
 * @returns {string} A CSS transform
 */
export function standing(stop) {
  return `translate(${stop.x - TOKEN_HALF}px, ${stop.y - TOKEN_FOOT}px)`
}

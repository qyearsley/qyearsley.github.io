/**
 * Seasons art: flat vector shapes drawn in code. No other module knows what
 * anything in this game looks like. GameUI asks for `character("phoenix")` and
 * gets back an SVG element. See ../README.md for the exports and what each
 * returns.
 *
 * No gradients. They need document-unique `<defs>` ids, and one drawing is
 * rendered many times on a page (one `character()` per card, one `item()` per
 * HUD slot). Flat fills with layered opacity avoid that.
 *
 * Every function tolerates an unknown id and returns a neutral shape rather
 * than throwing, so a typo shows up as a grey blob instead of an empty page.
 */

import { svg } from "./svg.js"

/**
 * A drawing to hand to GameUI: an SVG element plus the viewBox it was drawn
 * for, so the caller can size it without knowing the coordinate system.
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
 * satisfies it for any factor at or below 1.
 *
 * @typedef {Object} BackdropLayer
 * @property {SVGElement} element - A `<g>` holding this plane's artwork
 * @property {string} name        - What the plane is, e.g. "sky"; for debugging
 * @property {number} factor      - Its share of the camera's scroll, 0 to 1
 * @property {number} span        - How wide its artwork is, in trail units
 */

/**
 * The coordinate system every character and item drawing assumes.
 * @type {string}
 */
const UNIT_VIEWBOX = "0 0 100 100"

/**
 * Season palettes, as CSS custom properties. GameUI sets these on the root
 * element and the stylesheet reads them, so the CSS never names a season.
 *
 * Each season has three accents because the colour that paints a trail is
 * usually too light to read as text: `--season-accent` paints, and
 * `--season-accent-text` / `-dark` clear 4.5:1 on the light and dark surfaces.
 * The stylesheet picks between them; a pack cannot know the theme.
 *
 * Three keys let one shape serve all four seasons:
 *
 * - `--season-crust` is what lies along the top of the ground: grass, leaves or
 *   snow. It cannot be `--season-leaf`, which is a dark teal in winter.
 * - `--season-prop` is what the season drops through its sky. Spring's blossom
 *   is pink over green grass, so it cannot reuse the crust.
 * - `--season-sun` is the sky disc. Only summer draws one, but every season
 *   must define the same keys (`art.test.js` holds them equal). It cannot be
 *   `--season-glow`, a cream that is nearly invisible on summer's pale sky.
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
    "--season-crust": "#3f8455",
    "--season-prop": "#f7c9d8",
    "--season-sun": "#ffe9a8",
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
    "--season-crust": "#6f9c46",
    "--season-prop": "#ffcf7a",
    "--season-sun": "#ffc233",
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
    "--season-crust": "#8f4a1e",
    "--season-prop": "#c95f22",
    "--season-sun": "#f0a84a",
  },
  // Winter is built on value rather than hue: the only saturated sky, ridges
  // darker than the sky, and snow-white ground. That gives three separated bands
  // even to an eye that cannot tell the blues apart. Every material is dark so
  // it silhouettes against both the sky and the snow.
  winter: {
    "--season-sky": "#6f9dcc",
    "--season-far": "#55779f",
    "--season-ground": "#dfeaf7",
    "--season-accent": "#3b6ea8",
    "--season-accent-text": "#2f5f95",
    "--season-accent-text-dark": "#8fb0d6",
    "--season-water": "#3f7ba6",
    "--season-rock": "#4f5f70",
    "--season-leaf": "#2f5850",
    "--season-earth": "#6d87a3",
    "--season-trunk": "#3a444f",
    // Warm, not white: white is lost against the snow and the falling flakes.
    "--season-glow": "#ffd27a",
    "--season-ink": "#16283a",
    // White, not the blued ground snow: the crust is the freshest fall.
    "--season-crust": "#ffffff",
    "--season-prop": "#ffffff",
    // Never drawn, but named so the key set matches the other three.
    "--season-sun": "#cfe2f5",
  },
}

/**
 * Seasons whose ground and obstacles are under snow. A set rather than a
 * palette entry: "is there snow here" is a fact, not a colour.
 * @private
 */
const SNOWY = new Set(["winter"])

/**
 * What snow is painted in: brighter than the blue-tinted ground snow.
 * @private
 */
const SNOW = "#fff"

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
 * the 100x100 unit box, drawn facing right. An entry is one function, or
 * `{card, trail}` for a different pose on the select screen and the trail (only
 * the sloth: hanging from a branch, or walking).
 * @private
 */
const CHARACTERS = {
  // Drawn low in the box on purpose: the token puts y=91 on the trail.
  "banana-slug": () => [
    // Body: a long low blob with the head raised at the right.
    svg("path", {
      d: "M10 87 C10 75 20 70 36 69 C54 68 70 66 78 58 C85 51 95 56 93 67 C90 80 79 87 60 89 L18 91 C13 91 10 90 10 87 Z",
      fill: "#e8d05a",
    }),
    // Mantle, the saddle-shaped shield over the back.
    svg("ellipse", { cx: 40, cy: 75, rx: 20, ry: 9, fill: "#d4b943" }),
    // Spots.
    svg("circle", { cx: 28, cy: 83, r: 2.6, fill: "#a8912c", "fill-opacity": 0.7 }),
    svg("circle", { cx: 52, cy: 81, r: 2.2, fill: "#a8912c", "fill-opacity": 0.7 }),
    svg("circle", { cx: 66, cy: 77, r: 1.8, fill: "#a8912c", "fill-opacity": 0.7 }),
    // Eyestalks.
    svg("path", {
      d: "M84 59 L80 41",
      stroke: "#e8d05a",
      "stroke-width": 5,
      "stroke-linecap": "round",
    }),
    svg("path", {
      d: "M90 60 L96 45",
      stroke: "#e8d05a",
      "stroke-width": 5,
      "stroke-linecap": "round",
    }),
    svg("circle", { cx: 79, cy: 39, r: 4, fill: "#3a3222" }),
    svg("circle", { cx: 97, cy: 43, r: 4, fill: "#3a3222" }),
    svg("circle", { cx: 80, cy: 38, r: 1.4, fill: "#fff" }),
    svg("circle", { cx: 98, cy: 42, r: 1.4, fill: "#fff" }),
  ],

  sloth: {
    // Hanging from a branch.
    card: () => [
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
      // Arms last, so they hang in front of the body. Filled bands rather than
      // strokes, which can vanish in renderers that treat `stroke-width` loosely.
      svg("path", {
        d: "M43 59 C29 53 25 32 31 14 L22 15 C17 33 21 54 35 63 Z",
        fill: "#8a7259",
      }),
      svg("path", {
        d: "M61 59 C75 53 79 32 73 14 L82 15 C87 33 83 54 69 63 Z",
        fill: "#8a7259",
      }),
      // Claws hooked over the branch.
      svg("path", { d: "M20 16 C18 8 26 4 31 9 L28 13 C25 10 21 12 24 17 Z", fill: "#4a3b2c" }),
      svg("path", { d: "M84 16 C86 8 78 4 73 9 L76 13 C79 10 83 12 80 17 Z", fill: "#4a3b2c" }),
    ],

    // Crawling, for the trail. Off its branch a sloth is low, long and slow, so
    // the animal is redrawn rather than adjusted. Everything but the smile is a
    // filled shape, for the reason given above.
    // arms give above.
    trail: () => [
      // The far pair of limbs, behind the body and a shade darker for it.
      svg("path", { d: "M64 58 C59 72 59 84 63 90 L72 90 C68 82 68 70 71 58 Z", fill: "#7a6350" }),
      svg("path", { d: "M22 60 C17 74 17 84 21 90 L30 90 C26 82 26 70 29 60 Z", fill: "#7a6350" }),
      svg("ellipse", { cx: 67, cy: 89, rx: 5.5, ry: 2.8, fill: "#4a3b2c" }),
      svg("ellipse", { cx: 25, cy: 89, rx: 5.5, ry: 2.8, fill: "#4a3b2c" }),
      // Body, long and low, with the belly nearly on the ground.
      svg("ellipse", { cx: 42, cy: 62, rx: 29, ry: 20, fill: "#9b8468" }),
      svg("ellipse", { cx: 42, cy: 69, rx: 20, ry: 12, fill: "#b6a189", "fill-opacity": 0.8 }),
      // Head, out in front and low, which is the whole difference from the card.
      svg("circle", { cx: 74, cy: 52, r: 17, fill: "#c3b099" }),
      svg("ellipse", { cx: 69, cy: 50, rx: 6, ry: 7, fill: "#6d5a45", "fill-opacity": 0.85 }),
      svg("ellipse", { cx: 82, cy: 50, rx: 6, ry: 7, fill: "#6d5a45", "fill-opacity": 0.85 }),
      svg("circle", { cx: 69, cy: 50, r: 2.6, fill: "#2e2519" }),
      svg("circle", { cx: 82, cy: 50, r: 2.6, fill: "#2e2519" }),
      svg("circle", { cx: 76, cy: 59, r: 2.4, fill: "#6d5a45" }),
      svg("path", {
        d: "M70 64 Q76 68 82 64",
        stroke: "#6d5a45",
        "stroke-width": 2,
        fill: "none",
        "stroke-linecap": "round",
      }),
      // The near pair, in front of the body, mid-stride: the foreleg reaching
      // and the hind leg still under the hip.
      svg("path", { d: "M56 64 C51 76 51 86 55 91 L66 91 C62 84 62 74 65 64 Z", fill: "#8a7259" }),
      svg("path", { d: "M28 66 C23 78 23 87 27 91 L38 91 C34 85 34 76 37 66 Z", fill: "#8a7259" }),
      svg("ellipse", { cx: 60, cy: 90, rx: 7, ry: 3.4, fill: "#4a3b2c" }),
      svg("ellipse", { cx: 32, cy: 90, rx: 7, ry: 3.4, fill: "#4a3b2c" }),
      // The claws, hooked forward: the one cue left that this is a sloth.
      svg("path", { d: "M66 90 C70 87 73 90 70 92 L66 92 Z", fill: "#4a3b2c" }),
      svg("path", { d: "M38 90 C42 87 45 90 42 92 L38 92 Z", fill: "#4a3b2c" }),
    ],
  },

  // Sits a couple of units above the ground, so the tail plumes trail in the air.
  phoenix: () => [
    // Tail plumes, layered back to front.
    svg("path", { d: "M40 55 C22 65 12 79 16 89 C26 83 34 73 44 67 Z", fill: "#d94f2b" }),
    svg("path", { d: "M42 53 C28 57 16 67 14 77 C26 73 36 65 46 61 Z", fill: "#f08a2c" }),
    // Wing, swept up.
    svg("path", { d: "M50 45 C40 27 46 9 66 1 C64 19 62 33 58 47 Z", fill: "#f5b53f" }),
    svg("path", {
      d: "M52 47 C48 33 54 19 68 11 C66 25 62 37 58 49 Z",
      fill: "#ffd76a",
      "fill-opacity": 0.85,
    }),
    // Body.
    svg("path", {
      d: "M46 63 C42 49 50 37 62 37 C74 37 82 47 80 59 C78 71 66 77 56 73 Z",
      fill: "#e8642a",
    }),
    // Head and crest.
    svg("circle", { cx: 74, cy: 33, r: 11, fill: "#f5843a" }),
    svg("path", { d: "M72 23 C70 13 76 7 84 5 C80 13 80 19 79 24 Z", fill: "#ffd76a" }),
    // Beak and eye.
    svg("path", { d: "M84 33 L95 37 L84 40 Z", fill: "#f5b53f" }),
    svg("circle", { cx: 77, cy: 30, r: 3, fill: "#3a1f0e" }),
    svg("circle", { cx: 78, cy: 29, r: 1.1, fill: "#fff" }),
  ],

  porcupine: () => {
    // Quills, generated so the fan is even rather than hand-placed.
    //
    // Rooted on the body's own ellipse, not a circle around it: the body is much
    // wider than tall, so one radius cleared the spine or buried the flank quills.
    const BODY = { cx: 50, cy: 68, rx: 27, ry: 21 }
    // How far down into the body each quill is buried, as a fraction of the
    // body's radius, and how far past the silhouette it stands out. The body is
    // drawn over the roots, so ROOT only has to be inside the outline.
    const ROOT = 0.88
    const LENGTH = 18
    const quills = []
    for (let i = 0; i < 13; i += 1) {
      // Stops short of the head so no quill root sits on the eye.
      const angle = Math.PI * (0.08 + (i / 12) * 0.8)
      const dx = -Math.cos(angle)
      const dy = -Math.sin(angle)
      quills.push(
        svg("path", {
          d:
            `M${BODY.cx + dx * BODY.rx * ROOT} ${BODY.cy + dy * BODY.ry * ROOT} ` +
            `L${BODY.cx + dx * (BODY.rx + LENGTH)} ${BODY.cy + dy * (BODY.ry + LENGTH)}`,
          stroke: i % 2 === 0 ? "#4a3b2c" : "#6d5642",
          "stroke-width": 3.4,
          "stroke-linecap": "round",
        }),
      )
    }
    return [
      ...quills,
      // Body.
      svg("ellipse", { cx: BODY.cx, cy: BODY.cy, rx: BODY.rx, ry: BODY.ry, fill: "#6d5642" }),
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
 * `onTrail` picks a pose, not a subset of shapes, which also suits a pack
 * backed by images. A character with only one pose ignores it.
 *
 * @param {unknown} characterId - A character id
 * @param {boolean} [onTrail] - True for the walking pose, false for the card
 * @returns {import("./index.js").Drawing} The drawing; a neutral blob if unknown
 */
export function character(characterId, onTrail = false) {
  // Object.hasOwn: `character("constructor")` from a corrupt save must not reach Object.prototype.
  const entry = Object.hasOwn(CHARACTERS, characterId) ? CHARACTERS[characterId] : null
  if (!entry) return _drawing([svg("circle", { cx: 50, cy: 55, r: 30, fill: NEUTRAL })])
  const draw = typeof entry === "function" ? entry : onTrail ? entry.trail : entry.card
  return _drawing(draw())
}

/**
 * How a drawing moves when it is standing still.
 *
 * Optional: a pack that omits it gets a trail where only the walk and the
 * weather move. The return value is a motion name. GameUI wraps the drawing in
 * a group classed `idle-<motion>` and main.css animates it, so no stylesheet
 * rule names an animal. An unknown motion does not animate.
 *
 * The wrapping group is a third nested `<g>` because GameUI owns
 * `.trail-token`'s transform and a CSS transform replaces a transform
 * attribute rather than composing with it.
 *
 * @param {unknown} subjectId - A character id, or `"villain"` for the snake
 *   woman. No character uses that id, which is what makes it safe as a reserved
 *   one.
 * @returns {string|null} A motion name, or null for a drawing that stays still
 */
export function idle(subjectId) {
  switch (subjectId) {
    // A slug is one muscle and a sloth is asleep. The porcupine shares the slow
    // scale rather than any travel.
    case "banana-slug":
    case "sloth":
    case "porcupine":
      return "breathe"
    // Hovers, and its tail plumes make vertical travel legible.
    case "phoenix":
      return "bob"
    // A column of coils: she sways, since a bob would read as the tower hopping.
    case "villain":
      return "sway"
    default:
      return null
  }
}

/**
 * Item drawings, keyed by season id -- the rose, diamond, leaf, and icicle.
 * `rare` swaps in the brighter treatment for a glowing space's reward.
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
    // An icicle in ice colours vanishes into the white HUD card; the
    // saturated cap and shaded facet give it an edge.
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
 * The snake woman's coils: one tapering body wound twice, drawn as a chain of
 * overlapping ellipses. Continuity and taper are what say "one body", and
 * separate rings lose both. The chain runs from her waist outward, thick to
 * thin, so painter's order gives the overlap for free. Filled ellipses, since
 * this pack avoids strokes.
 * @private
 * @returns {Array<Object>} Ellipses, back to front
 */
function _coils() {
  // Enough samples that the thin end still overlaps instead of beading.
  const STEPS = 300
  const TURNS = 1.85
  const START = Math.PI * 0.55
  const round1 = (value) => Number(value.toFixed(1))

  /**
   * One link of the chain: where it sits and how thick it is there.
   * @param {number} t - Progress along the body, 0 at her waist
   * @returns {{cx: number, cy: number, body: number, lit: boolean, turn: number}} The link
   */
  const link = (t) => {
    const angle = START + t * TURNS * Math.PI * 2
    const spiral = 12 + 24 * t
    return {
      cx: 50 + spiral * Math.cos(angle),
      // `0.34` is the foreshortening of a coil seen from slightly above.
      cy: 70 + 11 * t + spiral * 0.34 * Math.sin(angle),
      // Thin enough that turns do not merge. The power curve tapers
      // like a tail; linear gives a cone.
      body: 7 - 4.4 * t ** 2.1,
      lit: Math.sin(angle) < -0.2,
      turn: Math.floor((angle - START) / (Math.PI * 2)),
    }
  }

  const blob = (one, grow, fill) =>
    svg("ellipse", {
      cx: round1(one.cx),
      cy: round1(one.cy),
      rx: round1(one.body + grow),
      ry: round1((one.body + grow) * 0.9),
      fill,
    })

  // Grouped by turn, each drawn rim-then-body: the rim shows along the
  // seam where the body crosses itself.
  const links = []
  for (let i = 0; i <= STEPS; i += 1) links.push(link(i / STEPS))
  const turns = [...new Set(links.map((one) => one.turn))]
  return turns.flatMap((turn) => {
    const inTurn = links.filter((one) => one.turn === turn)
    return [
      ...inTurn.map((one) => blob(one, 1.4, "#31543d")),
      ...inTurn.map((one) => blob(one, 0, one.lit ? "#5f9470" : "#4b7a5a")),
    ]
  })
}

/**
 * The snake woman: a witch from the waist up and a serpent below it, holding
 * out the potion she is making.
 *
 * Two constraints shape the drawing:
 *
 * - It has to work at 62px, the demand bar portrait, where the face is about
 *   18px across. The arrangement, brows and hat survive; slit pupils do not.
 *   Her head is larger than realistic proportions.
 * - Her skin is pale enough to vanish on the white portrait surface, so a
 *   darker ellipse rims the face, the hair frames it, and the hat shades it.
 *
 * Mostly filled shapes, not thick strokes, which vanish in renderers that treat
 * `stroke-width` loosely.
 *
 * @param {boolean} [happy] - Draw her delighted: an open grin, eyes curved shut
 *   and the potion raised. Only the end-of-run screen asks for it; the HUD
 *   portrait is too small for the difference to show.
 * @returns {import("./index.js").Drawing} The drawing
 */
export function villain(happy = false) {
  return _drawing([
    // Her coils. See `_coils`.
    ..._coils(),
    // The robe flares onto the top coil, narrow enough that the coil shows either side of the hem.
    svg("path", {
      d: "M45 54 C42 60 39 66 37 74 C44 78 62 78 69 74 C67 66 64 60 61 54 Z",
      fill: "#6b4a86",
    }),
    svg("path", {
      d: "M45 54 C42 60 39 66 37 74 C41 76 45 77 50 77.4 C48 69 47 61 48 54 Z",
      fill: "#573a6f",
    }),
    // The one piece of gold left from her crown.
    svg("circle", { cx: 54, cy: 56, r: 2.8, fill: "#e8c34a" }),
    // Her left arm, resting a hand on the coil. Darker than the robe so it
    // separates from it without an outline.
    svg("path", { d: "M45 57 C40 59 36 64 34 70 L40 73 C42 68 45 64 49 62 Z", fill: "#573a6f" }),
    svg("circle", { cx: 36.5, cy: 72.5, r: 4.4, fill: "#ece0f2" }),
    // Head. The darker rim ellipse is the outline.
    svg("ellipse", { cx: 53, cy: 39, rx: 15.4, ry: 16.4, fill: "#c4aed4" }),
    svg("ellipse", { cx: 53, cy: 39, rx: 14, ry: 15, fill: "#ece0f2" }),
    // Hair, falling either side from under the brim and framing the pale face.
    svg("path", { d: "M41 30 C36 40 35 54 38 64 L45 62 C42 52 41 40 44 31 Z", fill: "#2f2340" }),
    svg("path", { d: "M65 30 C70 40 71 54 68 64 L61 62 C64 52 65 40 62 31 Z", fill: "#2f2340" }),
    // Brows make this read as a face at portrait size, so they are filled, not
    // stroked. Near level; sloped the other way she scowled.
    svg("path", { d: "M44.6 34.3 L51.6 33.1 L51.6 35 L44.6 36.2 Z", fill: "#2f2340" }),
    svg("path", { d: "M61.4 34.3 L54.4 33.1 L54.4 35 L61.4 36.2 Z", fill: "#2f2340" }),
    // Eyes. Green irises, the last thing she has in common with a snake.
    svg("ellipse", { cx: 47.8, cy: 40, rx: 3.7, ry: 3.3, fill: "#fff" }),
    svg("ellipse", { cx: 58.2, cy: 40, rx: 3.7, ry: 3.3, fill: "#fff" }),
    svg("circle", { cx: 48.2, cy: 40, r: 2.2, fill: "#3d6549" }),
    svg("circle", { cx: 58.6, cy: 40, r: 2.2, fill: "#3d6549" }),
    svg("circle", { cx: 48.2, cy: 40, r: 1.1, fill: "#1e1728" }),
    svg("circle", { cx: 58.6, cy: 40, r: 1.1, fill: "#1e1728" }),
    // A soft shadow for the nose tip. A wedge read as a hole.
    svg("ellipse", { cx: 53.6, cy: 45, rx: 2.2, ry: 1.6, fill: "#d9c4e3" }),
    svg("circle", { cx: 45, cy: 45, r: 2.6, fill: "#d9a0b8", "fill-opacity": 0.45 }),
    svg("circle", { cx: 61, cy: 45, r: 2.6, fill: "#d9a0b8", "fill-opacity": 0.45 }),
    // A filled crescent smile. `happy` widens it into a grin and curves the eyes shut.
    happy
      ? svg("path", { d: "M45.6 47.4 Q53 57.6 60.4 47.4 Q53 51.6 45.6 47.4 Z", fill: "#a8506e" })
      : svg("path", { d: "M48.8 48.2 Q53 52.4 57.2 48.2 Q53 50.6 48.8 48.2 Z", fill: "#a8506e" }),
    // Closed smiling eyes, drawn over the open ones; cheaper than branching the face.
    ...(happy
      ? [
          svg("path", {
            d: "M44.4 40.6 Q47.8 36.4 51.2 40.6 Q47.8 38.6 44.4 40.6 Z",
            fill: "#1e1728",
          }),
          svg("path", {
            d: "M54.8 40.6 Q58.2 36.4 61.6 40.6 Q58.2 38.6 54.8 40.6 Z",
            fill: "#1e1728",
          }),
        ]
      : []),
    // The hat, over the head so the brim sits on the forehead. It leans:
    // an upright cone looks like a traffic marker.
    svg("path", { d: "M60 1 C55 9 49 19 42 28 L67 28 C65 19 63 9 60 1 Z", fill: "#3f2a52" }),
    svg("path", { d: "M49.8 18 L64 18 L65.2 23 L46.4 23 Z", fill: "#e8c34a" }),
    svg("path", {
      d: "M55.5 17.1 L56.38 19.29 L58.73 19.45 L56.93 20.96 L57.5 23.25 L55.5 22 L53.5 23.25 L54.07 20.96 L52.27 19.45 L54.62 19.29 Z",
      fill: "#f5e08a",
    }),
    svg("ellipse", { cx: 54, cy: 28, rx: 20.5, ry: 4.4, fill: "#3f2a52" }),
    // Her right arm and the potion, in front. One group so `happy` can
    // raise the limb with one rotation.
    svg("g", happy ? { transform: "rotate(-32 62 57)" } : {}, [
      svg("path", {
        d: "M62 57 C68 58 74 62 78 68 L73 72 C70 67 66 64 59 62 Z",
        fill: "#573a6f",
      }),
      svg("circle", { cx: 79, cy: 71, r: 4.6, fill: "#ece0f2" }),
      svg("rect", { x: 78.5, y: 51, width: 7, height: 3.6, rx: 1.4, fill: "#8a6a4a" }),
      svg("rect", { x: 79.5, y: 54, width: 5, height: 6, fill: "#8fd4ee" }),
      svg("circle", { cx: 82, cy: 64, r: 6.5, fill: "#8fd4ee" }),
      // The arc's ends sit on the circle, so the potion fills the flask
      // exactly to the line rather than spilling out of the glass.
      svg("path", { d: "M75.82 64 A6.5 6.5 0 0 0 88.18 64 Z", fill: "#7fb08b" }),
      svg("circle", { cx: 79.6, cy: 63, r: 1.8, fill: "#fff", "fill-opacity": 0.6 }),
    ]),
  ])
}

/* ==================== Obstacles ==================== */

/**
 * Wrap shapes in a group that moves, using the same convention as the weather:
 * the pack names a behaviour and main.css supplies it. The group carries no
 * `transform` of its own because a CSS transform replaces a transform
 * attribute, and most of these shapes already have one.
 *
 * @private
 * @param {string} motion - Behaviour name; main.css defines `obs-<motion>`
 * @param {number} index - Staggers the start, so identical shapes fall out of
 *   phase rather than moving as one
 * @param {SVGElement[]} shapes - What moves
 * @returns {SVGElement} The wrapping group
 */
function _moving(motion, index, shapes) {
  return svg("g", { class: `obs-mark obs-${motion}`, style: `--obs-index: ${index}` }, shapes)
}

/**
 * The six obstacle drawings, keyed by kind, in trail coordinates around an
 * origin of (0, 0) on the ground, so `layout` places one by translation. They
 * read the season palette, so one drawing serves all four seasons.
 * @private
 */
const OBSTACLE_ART = {
  hill: (c, edge) => [
    // Broad and low, and wider than the boulder so the two never read alike.
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
    // Sits in the basin `layout` sinks into the ground. The crossing
    // lands on the stepping stones twice.
    svg("path", {
      d: "M-106 -4 C-66 34 -30 50 0 50 C34 50 70 32 106 -4 Z",
      fill: c.water,
      ...edge,
    }),
    // Only the two highlights shimmer: the body carries the outline, and
    // an animated edge reads as the bank moving.
    _moving("shimmer", 0, [
      svg("path", {
        d: "M-70 6 C-52 -2 -34 2 -18 -4",
        stroke: "#fff",
        "stroke-width": 3.5,
        "stroke-opacity": 0.55,
        fill: "none",
        "stroke-linecap": "round",
      }),
    ]),
    _moving("shimmer", 1, [
      svg("path", {
        d: "M20 12 C36 4 54 8 70 2",
        stroke: "#fff",
        "stroke-width": 3.5,
        "stroke-opacity": 0.38,
        fill: "none",
        "stroke-linecap": "round",
      }),
    ]),
    svg("ellipse", { cx: -42, cy: 6, rx: 19, ry: 8, fill: c.rock, ...edge }),
    svg("ellipse", { cx: 42, cy: 6, rx: 19, ry: 8, fill: c.rock, ...edge }),
  ],

  boulder: (c, edge) => [
    // Angular, in rock rather than earth, so it does not read as a second hill.
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
    // The canopies sway, out of phase (in lockstep the bush would slide
    // sideways). A translate, not a rotation, which would need a transform origin.
    _moving("sway", 0, [
      svg("circle", { cx: -80, cy: -58, r: 30, fill: c.leaf, ...edge }),
      svg("circle", { cx: -90, cy: -70, r: 13, fill: "#fff", "fill-opacity": 0.16 }),
    ]),
    _moving("sway", 2, [svg("circle", { cx: 78, cy: -54, r: 28, fill: c.leaf, ...edge })]),
    _moving("sway", 1, [
      svg("circle", { cx: -4, cy: -86, r: 40, fill: c.leaf, ...edge }),
      svg("circle", { cx: -18, cy: -98, r: 20, fill: "#fff", "fill-opacity": 0.2 }),
    ]),
  ],

  gap: (c) => [
    // A break in the ground, not an object on it. It widens with depth and
    // overshoots the canvas so the backdrop cannot show through either side.
    svg("path", { d: "M-64 -2 L64 -2 L72 120 L-72 120 Z", fill: c.ink, "fill-opacity": 0.88 }),
    svg("path", { d: "M-64 -2 L-72 120 L-40 120 L-40 -2 Z", fill: c.ink, "fill-opacity": 0.55 }),
    svg("path", { d: "M-74 -4 L-58 -4 L-54 12 L-76 10 Z", fill: c.rock }),
    svg("path", { d: "M74 -4 L58 -4 L54 12 L76 10 Z", fill: c.rock }),
  ],
}

/**
 * The snow lying on each obstacle, drawn over OBSTACLE_ART in the seasons
 * `SNOWY` names. A separate map keeps each kind one recolourable silhouette.
 * Every path stays inside its silhouette, mostly by reusing its vertices; snow
 * that overshot would read as a smear beside the obstacle.
 * @private
 */
const SNOW_ART = {
  hill: (snow) => [
    // The dome's outline closed with a wavy line: a drift thinning to
    // nothing at the base, low near the corners where the dome climbs
    // fastest.
    svg("path", {
      d: "M-118 2 C-84 -44 -44 -62 0 -62 C46 -62 88 -42 118 2 Q98 -24 62 -26 Q26 -12 0 -26 Q-30 -40 -62 -26 Q-96 -12 -118 2 Z",
      fill: snow,
    }),
  ],

  mountain: (snow) => [
    // A snowfield on each peak, from the summit down both ridges,
    // starting and ending on the ridge points.
    svg("path", {
      d: "M-40 -120 L-78 -65 L-70 -70 L-62 -62 L-52 -76 L-42 -68 L-32 -82 L-24 -76 L-16 -95 Z",
      fill: snow,
    }),
    svg("path", {
      d: "M44 -108 L20 -91 L28 -84 L38 -92 L48 -78 L58 -84 L68 -70 L78 -64 Z",
      fill: snow,
    }),
  ],

  river: (snow) => [
    // Ice along both banks and a cap on each stepping stone, which the crossing lands on.
    svg("path", {
      d: "M-106 -4 C-86 15 -67 28 -49 37 C-64 22 -78 8 -92 -4 Z",
      fill: snow,
      "fill-opacity": 0.85,
    }),
    svg("path", {
      d: "M106 -4 C88 14 70 27 52 37 C66 23 80 9 92 -4 Z",
      fill: snow,
      "fill-opacity": 0.85,
    }),
    svg("ellipse", { cx: -42, cy: 3, rx: 15, ry: 4, fill: snow }),
    svg("ellipse", { cx: 42, cy: 3, rx: 15, ry: 4, fill: snow }),
  ],

  boulder: (snow) => [
    // The three top vertices of the boulder, closed with a ragged line across
    // its face: a cap thick enough to read at trail scale.
    svg("path", { d: "M-46 -50 L-6 -78 L38 -62 L30 -50 L2 -62 L-16 -52 L-34 -40 Z", fill: snow }),
  ],

  thicket: (snow) => [
    // One cap per crown, each arc drawn at that crown's own radius so it follows
    // the shrub instead of sitting on it as a separate lump.
    svg("path", {
      d: "M-105 -74 A30 30 0 0 1 -56 -76 Q-68 -64 -80 -70 Q-92 -76 -105 -74 Z",
      fill: snow,
    }),
    svg("path", {
      d: "M-38 -105 A40 40 0 0 1 28 -110 Q12 -94 -6 -102 Q-22 -110 -38 -105 Z",
      fill: snow,
    }),
    svg("path", { d: "M55 -70 A28 28 0 0 1 100 -71 Q88 -60 76 -66 Q64 -72 55 -70 Z", fill: snow }),
  ],

  gap: (snow) => [
    // Snow on the two rock lips, the only place it can settle; it also brightens the rim.
    svg("path", { d: "M-74 -4 L-58 -4 L-57 3 L-66 7 L-75 4 Z", fill: snow }),
    svg("path", { d: "M74 -4 L58 -4 L57 3 L66 7 L75 4 Z", fill: snow }),
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
  // Materials, not palette slots, so each obstacle separates from the ground it stands on.
  const c = {
    earth: colors["--season-earth"],
    rock: colors["--season-rock"],
    leaf: colors["--season-leaf"],
    trunk: colors["--season-trunk"],
    water: colors["--season-water"],
    far: colors["--season-far"],
    ink: colors["--season-ink"],
  }
  // One shared outline: a season whose ground is close to a material would otherwise flatten out.
  const edge = { stroke: c.ink, "stroke-opacity": 0.3, "stroke-width": 2.5 }
  const drawn = Object.hasOwn(OBSTACLE_ART, kind) ? kind : "hill"
  const shapes = OBSTACLE_ART[drawn](c, edge)
  // Snow last, on top of everything. It uses the resolved kind: an unknown
  // kind draws a hill, with snow.
  if (SNOWY.has(seasonId) && Object.hasOwn(SNOW_ART, drawn)) shapes.push(...SNOW_ART[drawn](SNOW))
  return { element: svg("g", {}, shapes), viewBox: "-124 -200 248 208" }
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

/**
 * How often the ground line is sampled, in user units.
 *
 * Fine enough that the river basin comes out as a curve rather than a chamfer,
 * and it also sets the pitch of the textured band along the top edge -- a tuft
 * of grass every other sample, so 24 units apart. Halving it would double the
 * length of every ground path on a trail that can already be 5100 units wide.
 * @private
 */
const GROUND_STEP = 12

/**
 * Half the drawn token's width, and how far its feet sit below its origin.
 * With `layout`'s `tokenScale` these fix the ground line every character is
 * drawn against: a token at a stop puts drawing y `TOKEN_FOOT / tokenScale`,
 * which is 91, on the trail. A character whose lowest shape stops short of 91
 * floats; one that passes it is buried. If `tokenScale` changes, every
 * character moves off the ground together.
 * @private
 */
const TOKEN_HALF = 34
const TOKEN_FOOT = 62

/**
 * How each obstacle kind deforms the ground it stands on. Hills, boulders,
 * thickets and mountains sit on the ground and change nothing. A river sinks
 * the ground into a basin; a gap removes it, which makes the leap legible.
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
 * The ground line, sampled left to right and split wherever a gap removes it:
 * one list of `[x, y]` points per unbroken stretch. The earth and the band
 * along its top are both derived from these points, so they cannot disagree.
 * @private
 * @param {number} width - Total trail width
 * @param {Array<Object>} spots - Output of `placements`
 * @returns {Array<Array<number[]>>} One list of points per unbroken stretch
 */
function groundRuns(width, spots) {
  const breaks = spots
    .filter((spot) => spot.profile?.breakHalfWidth)
    .map((spot) => [spot.x - spot.profile.breakHalfWidth, spot.x + spot.profile.breakHalfWidth])
  const inBreak = (x) => breaks.some(([from, to]) => x > from && x < to)

  const runs = []
  let points = []
  const flush = () => {
    if (points.length >= 2) runs.push(points)
    points = []
  }
  for (let x = 0; x <= width; x += GROUND_STEP) {
    if (inBreak(x)) flush()
    else points.push([x, deformedGroundY(x, spots)])
  }
  flush()
  return runs
}

/**
 * The ground as one or more filled paths.
 *
 * More than one because a gap genuinely removes the ground: each gap ends a
 * segment and starts the next, so the void between them is the sky showing
 * through rather than a dark shape drawn on top of solid earth.
 * @private
 * @param {Array<Array<number[]>>} runs - Output of `groundRuns`
 * @returns {string[]} One SVG path `d` per unbroken stretch of ground
 */
function groundSegmentsFor(runs) {
  return runs.map((points) => {
    const first = points[0]
    const last = points[points.length - 1]
    const line = points.map(([x, y], i) => `${i ? "L" : "M"} ${x} ${y}`).join(" ")
    return `${line} L ${last[0]} ${HEIGHT} L ${first[0]} ${HEIGHT} Z`
  })
}

/**
 * What the top edge of the ground is made of, per season: a strip `depth`
 * thick whose top edge stands `rise` proud in the season's `shape`.
 *
 * - `tuft` alternates flat and raised samples (grass). The height varies by
 *   arithmetic, because a perfectly even sawtooth reads as a zip fastener.
 * - `scallop` runs a quadratic through the same alternation, so the raised
 *   samples become rounded humps (leaves).
 * - `drift` is a shallow sine on a thick band (an unbroken crust of snow).
 * @private
 */
const GROUND_EDGE = {
  spring: { depth: 3, rise: 8, shape: "tuft" },
  summer: { depth: 3, rise: 9, shape: "tuft" },
  autumn: { depth: 4, rise: 7, shape: "scallop" },
  winter: { depth: 8, rise: 2.5, shape: "drift" },
}

/**
 * Where the top of the band sits above the ground at one sample.
 * @private
 * @param {Object} style - An entry from GROUND_EDGE
 * @param {number} x - The sample's x
 * @param {number} y - The ground's y there
 * @param {number} i - The sample's index along the run
 * @returns {number} The band's upper y
 */
function edgeTop({ depth, rise, shape }, x, y, i) {
  if (shape === "drift") return y - depth - Math.sin(x / 43) * rise
  // Every other sample stands up. The moduli are coprime with the alternation so heights differ.
  if (i % 2 === 0) return y - depth
  return y - depth - rise * (0.55 + ((i * 7) % 5) / 8)
}

/**
 * The textured band along the top of the ground, one path per unbroken
 * stretch. Its underside is the ground line itself in reverse, so the band
 * sinks into a river basin and stops at the lip of a gap.
 * @private
 * @param {Array<Array<number[]>>} runs - Output of `groundRuns`
 * @param {unknown} seasonId - The season being played
 * @returns {string[]} One SVG path `d` per unbroken stretch of ground
 */
function groundEdgesFor(runs, seasonId) {
  const style = Object.hasOwn(GROUND_EDGE, seasonId) ? GROUND_EDGE[seasonId] : GROUND_EDGE.spring
  const round = (value) => Number(value.toFixed(2))
  return runs.map((points) => {
    const top = points.map(([x, y], i) => [x, round(edgeTop(style, x, y, i))])
    let d
    if (style.shape === "scallop") {
      // Each raised sample is the control point of a curve between its
      // flat neighbours. An even-length run leaves a final control
      // that is drawn as a plain line.
      d = `M ${top[0][0]} ${top[0][1]}`
      for (let i = 1; i < top.length; i += 2) {
        const end = top[i + 1]
        d += end
          ? ` Q ${top[i][0]} ${top[i][1]} ${end[0]} ${end[1]}`
          : ` L ${top[i][0]} ${top[i][1]}`
      }
    } else {
      d = top.map(([x, y], i) => `${i ? "L" : "M"} ${x} ${y}`).join(" ")
    }
    for (let i = points.length - 1; i >= 0; i -= 1) {
      d += ` L ${points[i][0]} ${round(points[i][1])}`
    }
    return `${d} Z`
  })
}

/* ==================== Backdrop ==================== */

/**
 * How fast each backdrop layer pans, as a fraction of the ground's speed. The
 * numbers are the smallest set that separates four planes. The sky at 0 is
 * fixed to the screen. `air` (weather) is 0.85: near the character's plane but
 * not pinned to the ground. Nothing may exceed 1, or a layer overtakes the
 * character and the background seems to slide the wrong way.
 * @private
 */
const PARALLAX = {
  sky: 0,
  far: 0.25,
  near: 0.55,
  air: 0.85,
}

/**
 * The sun, in the coordinates of the fixed sky layer. Sized against
 * `VIEWPORT_WIDTH`, since a fixed layer only shows its first viewport.
 * @private
 */
const SUN = { cx: VIEWPORT_WIDTH * 0.82, cy: 48, r: 24 }

/**
 * Which seasons put something in the fixed sky layer. Only summer does; a map
 * lets a later season claim a moon without a new branch.
 * @private
 */
const SKY_ART = {
  summer: (colors) => {
    const rays = []
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2
      const [dx, dy] = [Math.cos(angle), Math.sin(angle)]
      rays.push(
        svg("path", {
          d:
            `M${(SUN.cx + dx * (SUN.r + 7)).toFixed(1)} ${(SUN.cy + dy * (SUN.r + 7)).toFixed(1)} ` +
            `L${(SUN.cx + dx * (SUN.r + 19)).toFixed(1)} ${(SUN.cy + dy * (SUN.r + 19)).toFixed(1)}`,
          stroke: colors["--season-sun"],
          "stroke-width": 4,
          "stroke-opacity": 0.55,
          "stroke-linecap": "round",
        }),
      )
    }
    return [
      // A halo before the disc softens the edge without a gradient.
      svg("circle", { ...SUN, r: SUN.r + 14, fill: colors["--season-sun"], "fill-opacity": 0.22 }),
      ...rays,
      svg("circle", { ...SUN, fill: colors["--season-sun"] }),
    ]
  },
}

/**
 * What each season scatters through the air, where, and how it moves.
 *
 * `step` is how far apart marks are seeded, the main cost control: a trail is
 * up to 5100 units wide. `top` and `height` bound the band they fall through,
 * and the lowest mark stays above the highest ground (`GROUND - ROLL`, 176), or
 * weather would settle on the trail the character walks. Summer is the odd one:
 * heat shimmer, drawn low.
 *
 * `motion` is the whole convention with the stylesheet: `backdrop` writes it as
 * the class `air-<motion>` and main.css animates it. A pack cannot ship CSS,
 * and SMIL ignores `prefers-reduced-motion`. The class names a behaviour, never
 * a season, so a replacement pack can re-theme without touching CSS.
 * @private
 */
const AIR_ART = {
  spring: {
    step: 62,
    top: 14,
    height: 151,
    motion: "fall",
    // Blossom: a short wide oval; the tilt stops the field reading as full stops.
    draw: (mark, color) =>
      svg("ellipse", {
        cx: mark.x,
        cy: mark.y,
        rx: 3.4 + mark.size * 0.8,
        ry: 1.9 + mark.size * 0.3,
        fill: color,
        "fill-opacity": 0.55 + mark.size * 0.15,
        transform: `rotate(${mark.tilt} ${mark.x} ${mark.y})`,
      }),
  },
  summer: {
    step: 88,
    top: 110,
    height: 34,
    // Heat hangs and wavers, so summer drifts sideways.
    motion: "drift",
    // Heat haze: a shallow double curve, low but above the tufts of grass, which
    // reach some sixteen units above the ground and are painted over this layer.
    // Absolute coordinates, so `art.test.js` can read the numbers back to check
    // that nothing in the air can settle on the ground.
    draw: (mark, color) =>
      svg("path", {
        d:
          `M${mark.x} ${mark.y} ` +
          `Q${mark.x + 7} ${mark.y - 3.5} ${mark.x + 14} ${mark.y} ` +
          `Q${mark.x + 21} ${mark.y + 3.5} ${mark.x + 28} ${mark.y}`,
        stroke: color,
        "stroke-width": 1.6 + mark.size * 0.5,
        "stroke-opacity": 0.3 + mark.size * 0.12,
        "stroke-linecap": "round",
        fill: "none",
      }),
  },
  autumn: {
    step: 70,
    top: 16,
    height: 149,
    motion: "fall",
    // Falling leaves: longer and flatter than petals, with a wider spread of angles.
    draw: (mark, color) =>
      svg("ellipse", {
        cx: mark.x,
        cy: mark.y,
        rx: 4.2 + mark.size * 0.9,
        ry: 2 + mark.size * 0.2,
        fill: color,
        "fill-opacity": 0.62 + mark.size * 0.12,
        transform: `rotate(${mark.tilt} ${mark.x} ${mark.y})`,
      }),
  },
  winter: {
    step: 52,
    top: 12,
    height: 157,
    motion: "fall",
    draw: (mark, color) =>
      svg("circle", {
        cx: mark.x,
        cy: mark.y,
        r: 1.6 + mark.size * 0.7,
        fill: color,
        "fill-opacity": 0.5 + mark.size * 0.15,
      }),
  },
}

/**
 * Marks scattered across a span, by arithmetic rather than chance. Nothing in
 * this game calls `Math.random` (see ../README.md), and a backdrop that changed
 * on every rebuild would flicker. Every modulus is coprime with the step it
 * perturbs, so the marks do not settle into a lattice.
 * @private
 * @param {number} span - How wide to scatter, in user units
 * @param {number} step - How far apart to seed the marks
 * @param {number} top - The top of the band they fall through
 * @param {number} height - How deep that band is
 * @returns {Array<{x: number, y: number, size: number, tilt: number}>} The marks
 */
function _scatter(span, step, top, height) {
  const marks = []
  for (let i = 0, x = 24; x < span; i += 1, x += step) {
    marks.push({
      x: x + ((i * 29) % 41),
      y: top + ((i * 67) % height),
      size: i % 3,
      tilt: ((i * 47) % 180) - 90,
    })
  }
  return marks
}

/**
 * A rolling ridge, filled down to the bottom of the trail.
 * @private
 * @param {number} span - How wide to draw it
 * @param {number} amplitude - How far the ridge rises and falls
 * @param {number} wavelength - How long one roll is
 * @param {number} top - The ridge's mean height
 * @param {string} fill - What to paint it in
 * @param {number} opacity - How solid it is
 * @returns {SVGElement} The ridge
 */
function _ridge(span, amplitude, wavelength, top, fill, opacity) {
  const at = (x) => `${x} ${(top + Math.sin(x / wavelength) * amplitude).toFixed(2)}`
  let d = `M ${at(0)}`
  for (let x = 40; x < span; x += 40) d += ` L ${at(x)}`
  // The final sample is written at `span` exactly: sampling every 40 units
  // can stop short, leaving a diagonal closing edge.
  d += ` L ${at(span)}`
  return svg("path", {
    d: `${d} L ${span} ${HEIGHT} L 0 ${HEIGHT} Z`,
    fill,
    "fill-opacity": opacity,
  })
}

/**
 * The layered landscape behind a whole trail, generated at its real width
 * (scaling a small vignette flattened the hills). Four layers, each with its
 * own parallax factor (see `PARALLAX`); GameUI pans layer `n` by
 * `offset * factor[n]`.
 *
 * Every layer spans the whole trail. The camera is clamped to
 * `[0, width - viewportWidth]`, so a layer at factor `f` needs at most
 * `f * (width - viewportWidth) + viewportWidth`, which is at most `width` for
 * any `f` up to 1. `art.test.js` checks this at both ends of the longest trail.
 *
 * @param {unknown} seasonId - The season being played
 * @param {number} width - Total trail width in user units
 * @returns {{layers: Array<import("./index.js").BackdropLayer>, viewBox: string}} The
 *   backdrop, back to front
 */
export function backdrop(seasonId, width) {
  const colors = palette(seasonId)
  const span = Math.max(1, width)
  const layer = (name, shapes) => ({
    name,
    factor: PARALLAX[name],
    span,
    element: svg("g", {}, shapes),
  })

  const sky = [
    svg("rect", { x: 0, y: 0, width: span, height: HEIGHT, fill: colors["--season-sky"] }),
  ]
  if (Object.hasOwn(SKY_ART, seasonId)) sky.push(...SKY_ART[seasonId](colors))

  const air = Object.hasOwn(AIR_ART, seasonId) ? AIR_ART[seasonId] : null
  // Each mark is wrapped rather than tagged, because petals and leaves already
  // carry a `transform` for their tilt and a CSS transform would replace it.
  // The two custom properties are the stagger and the speed, derived from the
  // index so the field is identical on every rebuild. `--air-size` is 0, 1 or 2,
  // which the stylesheet turns into three fall speeds; otherwise a hundred
  // flakes descend in step and read as a sliding texture.
  const props = air
    ? _scatter(span, air.step, air.top, air.height).map((mark, index) =>
        svg(
          "g",
          {
            class: `air-mark air-${air.motion}`,
            style: `--air-index: ${index}; --air-size: ${mark.size}`,
          },
          [air.draw(mark, colors["--season-prop"])],
        ),
      )
    : []

  return {
    layers: [
      layer("sky", sky),
      layer("far", [_ridge(span, 26, 520, 150, colors["--season-far"], 0.55)]),
      layer("near", [_ridge(span, 18, 300, 196, colors["--season-far"], 0.85)]),
      layer("air", props),
    ],
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
 * `groundSegments` and `groundEdges` are parallel lists of the same length (the
 * earth, and the band along its top), both built from `groundRuns`, so a gap
 * breaks both in the same place.
 *
 * @param {import("../seasons.js").Season|null} season - The season being played
 * @returns {{width: number, height: number, viewportWidth: number, viewBox: string,
 *   groundSegments: string[], groundEdges: string[], stops: Array<{x: number, y: number}>,
 *   obstacles: Array<{kind: string, x: number, y: number}>, tokenScale: number,
 *   bossOffset: number, bossTransform: string,
 *   glow: {cy: number, r: number}}} The trail's geometry, plus how this pack
 *   wants the shared pieces placed within it
 */
export function layout(season) {
  const route = Array.isArray(season?.route) && season.route.length ? season.route : ["hill"]
  const width = MARGIN * 2 + route.length * SPACING
  const spots = placements(route)
  const runs = groundRuns(width, spots)
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
    groundSegments: groundSegmentsFor(runs),
    groundEdges: groundEdgesFor(runs, season?.id),
    stops,
    obstacles: spots.map((spot) => ({ kind: spot.kind, x: spot.x, y: restingGroundY(spot.x) })),
    // How the shared pieces are scaled and placed in this pack's
    // coordinates, so the UI hard-codes none of it.
    tokenScale: 0.68,
    bossOffset: 60,
    bossTransform: "translate(-52 -132) scale(1.05)",
    glow: { cy: -88, r: 86 },
  }
}

/**
 * How many keyframes a crossing is sampled into. Twenty-four is where a 620ms
 * leap stops showing corners on a 60Hz screen.
 * @private
 */
const TRAVERSAL_SAMPLES = 24

/**
 * Height of a jump at `t`, as a fraction of its peak: a projectile, slowest
 * near the apex.
 * @private
 * @param {number} t - Progress through the jump, 0 to 1
 * @returns {number} Height as a fraction of the peak
 */
function _arc(t) {
  return 4 * t * (1 - t)
}

/**
 * Progress along the ground at `t`. `hang` slows the middle of the crossing:
 * the derivative is `1 + hang * cos(2*pi*t)`, so it must stay under 1 or the
 * character walks backwards.
 * @private
 * @param {number} t - Progress through the crossing, 0 to 1
 * @param {number} hang - How much to dwell in the middle, 0 to 0.8
 * @returns {number} Fraction of the distance covered
 */
function _ground(t, hang) {
  return t + (hang * Math.sin(2 * Math.PI * t)) / (2 * Math.PI)
}

/**
 * A brief compression centred on one moment of the crossing, a raised cosine
 * so it eases in and out. Each dip must satisfy `at + width <= 1`.
 * @private
 * @param {number} t - Progress through the crossing, 0 to 1
 * @param {Array<{at: number, width: number, depth: number}>} dips - Where to compress
 * @returns {number} Total compression at `t`, 0 being none
 */
function _compression(t, dips) {
  let total = 0
  for (const { at, width, depth } of dips) {
    const distance = Math.abs(t - at)
    if (distance < width) total += depth * 0.5 * (1 + Math.cos((Math.PI * distance) / width))
  }
  return total
}

/**
 * The shape and timing of one kind of crossing. `height` is the arc peak in
 * pixels, `hops` splits it into that many arcs, `hang` dwells at the top,
 * `squash` compresses vertically and `narrow` horizontally. Each kind has its
 * own `duration`, or a mountain would feel like a step over a hill.
 * @private
 * @param {string} kind - The obstacle kind
 * @returns {Object} The crossing's shape
 */
function _crossing(kind) {
  switch (kind) {
    case "gap":
      // A long low leap with no hang, so ground speed stays constant like a real jump's.
      return {
        duration: 620,
        height: 96,
        hang: 0,
        squash: [
          { at: 0, width: 0.16, depth: 0.14 },
          { at: 0.88, width: 0.12, depth: 0.18 },
        ],
      }
    case "river":
      // Two hops across, as if using stones: `hops: 2` puts a touchdown at the halfway point.
      return {
        duration: 780,
        height: 44,
        hops: 2,
        hang: 0,
        squash: [
          { at: 0.5, width: 0.1, depth: 0.08 },
          { at: 0.92, width: 0.08, depth: 0.07 },
        ],
      }
    case "boulder":
      // Up and over something solid: a moment on top, and a firm landing.
      return {
        duration: 760,
        height: 100,
        hang: 0.45,
        squash: [
          { at: 0, width: 0.14, depth: 0.1 },
          { at: 0.86, width: 0.14, depth: 0.16 },
        ],
      }
    case "thicket":
      // No lift: pushing through. The hang is the resistance.
      return {
        duration: 880,
        height: 0,
        hang: 0.55,
        squash: [],
        narrow: [
          { at: 0.32, width: 0.3, depth: 0.22 },
          { at: 0.72, width: 0.28, depth: 0.18 },
        ],
      }
    case "mountain":
      // The hard one. Slow, high, it dwells at the summit, and it comes down
      // from further than anything else on the trail.
      return {
        duration: 1150,
        height: 128,
        hang: 0.7,
        squash: [
          { at: 0, width: 0.12, depth: 0.08 },
          { at: 0.9, width: 0.1, depth: 0.2 },
        ],
      }
    case "hill":
    default:
      // A rolling scramble up and down the far side.
      return {
        duration: 700,
        height: 74,
        hang: 0.2,
        squash: [
          { at: 0, width: 0.14, depth: 0.09 },
          { at: 0.87, width: 0.13, depth: 0.11 },
        ],
      }
  }
}

/**
 * How the character gets across one obstacle, as Web Animations keyframes. The
 * pack owns the motion as well as the drawing, so a sprite pack can return
 * frame-swapping keyframes and GameUI need not know. Every kind moves between
 * the same two points; the path and timing give the sense of weight.
 *
 * The path is sampled at `TRAVERSAL_SAMPLES` points, not posed. Three to six
 * keyframes made a jump trace a triangle, and one `ease-in-out` made the
 * character fastest at the apex. The options carry `easing: "linear"` because
 * the timing lives in the samples.
 *
 * Every crossing ends with a squash (how far the animal fell), then a clean
 * final frame with no deformation. That is load-bearing: crossings play with
 * `fill: "forwards"`, so the last frame is how the character looks for the whole
 * next question. Each dip keeps `at + width <= 1` so compression is zero by then.
 *
 * The squash scales about the bottom of the token, set in `.trail-token`
 * in CSS; otherwise `scaleY` would lift the character off the ground.
 *
 * @param {string} kind - The obstacle kind being crossed
 * @param {{x: number, y: number}} from - The stop being left
 * @param {{x: number, y: number}} to - The stop being reached
 * @returns {{keyframes: Array<Object>, options: Object}} Input for `Element.animate`
 */
export function traversal(kind, from, to) {
  const shape = _crossing(kind)
  const { height = 0, hops = 1, hang = 0, squash = [], narrow = [] } = shape
  const at = (point, lift = 0, extra = "") =>
    `translate(${point.x - TOKEN_HALF}px, ${point.y - TOKEN_FOOT - lift}px)${extra}`

  /**
   * The deformation at one moment, as a transform suffix.
   * @param {number} t - Progress through the crossing, 0 to 1
   * @returns {string} A scale suffix, or "" when the character is undeformed
   */
  const deform = (t) => {
    const scaleX = 1 - _compression(t, narrow)
    const scaleY = 1 - _compression(t, squash)
    const round = (value) => Number(value.toFixed(4))
    return (
      (scaleX === 1 ? "" : ` scaleX(${round(scaleX)})`) +
      (scaleY === 1 ? "" : ` scaleY(${round(scaleY)})`)
    )
  }

  const keyframes = []
  for (let i = 0; i < TRAVERSAL_SAMPLES; i += 1) {
    const t = i / (TRAVERSAL_SAMPLES - 1)
    const along = _ground(t, hang)
    const point = { x: from.x + (to.x - from.x) * along, y: from.y + (to.y - from.y) * along }
    // With several hops each arc runs its own 0..1. `_arc` is 0 at both
    // ends, so the wrap-around lands.
    const lift = height * _arc((t * hops) % 1)
    keyframes.push({ transform: at(point, Number(lift.toFixed(3)), deform(t)), offset: t })
  }
  // The ends are written exactly: the last must be `standing(to)` (see
  // `fill: "forwards"` above), and the first must match where the
  // character stands.
  keyframes[0] = { transform: at(from, 0, deform(0)), offset: 0 }
  keyframes[keyframes.length - 1] = { transform: at(to), offset: 1 }
  return { keyframes, options: { duration: shape.duration, easing: "linear" } }
}

/**
 * How long the reduced-motion crossing takes: long enough that the eye catches
 * it (under about 150ms reads as a cut), short enough to be a transition.
 * @private
 */
const REDUCED_MS = 240

/**
 * The same crossing for a player who has asked for less motion. The preference
 * asks for less vestibular load, not for the game to stop showing that the
 * character moved. So: a plain linear slide between two keyframes, with no arc,
 * hang, squash or compression. The kind is ignored on purpose, since a heavier
 * mountain crossing would bring the character of the motion back. It ends on
 * exactly `standing(to)`, as `traversal` explains.
 *
 * @param {string} _kind - The obstacle kind; deliberately unused
 * @param {{x: number, y: number}} from - The stop being left
 * @param {{x: number, y: number}} to - The stop being reached
 * @returns {{keyframes: Array<Object>, options: Object}} Input for `Element.animate`
 */
export function reducedTraversal(_kind, from, to) {
  return {
    keyframes: [
      { transform: standing(from), offset: 0 },
      { transform: standing(to), offset: 1 },
    ],
    options: { duration: REDUCED_MS, easing: "linear" },
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

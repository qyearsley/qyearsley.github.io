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
 *
 * Three of these keys exist so that one *shape* can serve all four seasons, in
 * the same way `--season-rock` lets one boulder be four boulders:
 *
 * - `--season-crust` is whatever lies along the top edge of the ground -- grass
 *   in spring and summer, fallen leaves in autumn, a snow crust in winter. It
 *   cannot be `--season-leaf`, which is the colour of a thicket's foliage: in
 *   winter that is a dark evergreen teal, and a dark teal snow crust would be
 *   worse than no crust at all.
 * - `--season-prop` is what the season drops or drifts through its sky. It is
 *   separate from the crust because only two seasons agree with themselves
 *   about it: autumn's leaves fall and then lie there, and winter's snow does
 *   the same, but spring's blossom is pink over green grass.
 * - `--season-sun` is the disc high in the sky. Only summer draws one today,
 *   and the other three still name a value, because every season must define
 *   the same keys -- a palette with holes in it is how a season ends up
 *   half-themed, and `art.test.js` holds the key sets equal for that reason.
 *   It cannot borrow `--season-glow`: summer's glow is a pale cream tuned to
 *   read as light spilling off a mountain, and on summer's pale blue sky a
 *   cream disc is very nearly invisible.
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
  // The climax, and the one season that is not built like the other three.
  // Winter used to be the palest palette here -- a near-white sky over
  // near-white hills over near-white ground -- which read as washed out rather
  // than as the last season. It is built on *value* now instead of hue: the only
  // saturated sky in the game, ridges darker than the sky, and snow-white ground
  // under everything. That gives the trail three separated bands even to an eye
  // that cannot tell the blues apart, which is the same bet the rest of the
  // game's contrast work makes. Every material is a dark tone for the same
  // reason: each has to silhouette against the sky above it and against the snow
  // below it, and a pale material would have managed neither.
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
    // Warm rather than white, still. A white glow on winter's old near-white sky
    // was invisible, in the one season Ella called the hardest; on the snow and
    // the falling flakes a white one would be lost all over again. Warm is the
    // only thing that survives either sky.
    "--season-glow": "#ffd27a",
    "--season-ink": "#16283a",
    // White, not the blued snow the ground is painted in: the crust is the
    // freshest fall, the same reading `SNOW` gives a drift on an obstacle.
    "--season-crust": "#ffffff",
    "--season-prop": "#ffffff",
    // Never drawn -- winter's sky is snowing -- but named, so the key set
    // matches the other three.
    "--season-sun": "#cfe2f5",
  },
}

/**
 * Seasons whose ground and obstacles are under snow.
 *
 * A set here rather than a palette entry, because "is there snow here" is a fact
 * about the season and not a colour -- every season has to define the same
 * palette keys, and there is no sensible value for spring's snow.
 * @private
 */
const SNOWY = new Set(["winter"])

/**
 * What snow is painted in. Brighter than the snow already lying on the ground,
 * which the palette above tints blue, so a drift on an obstacle and a flake in
 * the air both read as a fresher fall than the trail underfoot.
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
 * the 100x100 unit box, drawn facing right.
 *
 * An entry is either one function -- the animal looks the same wherever it is
 * drawn -- or `{card, trail}`, a pose for the select screen and a pose for the
 * trail. The sloth is the only one that needs both so far: on its card it hangs
 * from a branch, and on the trail it is walking somewhere.
 * @private
 */
const CHARACTERS = {
  // Drawn low in the box on purpose. The token is placed so that y=91 sits on
  // the trail, and the slug used to stop at y=78 -- so the one animal in the
  // roster that is nothing but underside travelled nine units above the ground.
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
    // Hanging from a branch, which is what a sloth is famous for and what the
    // select screen has room to show.
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
      // Arms last, so they hang in FRONT of the body and head. Behind them the
      // sloth reads as a generic round animal with no reason to be up a tree.
      //
      // Filled bands rather than thick strokes, for the same reason as the snake
      // woman's coils: a stroke-only path disappears in renderers that treat
      // `stroke-width` loosely, and the arms are too much of the silhouette to
      // risk that.
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

    // Crawling, for the trail. This used to be the hanging pose with the branch
    // subtracted, which left the sloth travelling along the ground with both
    // arms straight up in the air holding nothing. A sloth off its branch is
    // low, long and slow, so the whole animal is redrawn rather than adjusted:
    // body horizontal, head pushed out in front, four limbs down to the ground.
    //
    // Everything but the smile is a filled shape, for the reason the hanging
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
      // The claws, hooked forward. Off the branch they are the one cue left
      // that this is a sloth and not any other brown animal.
      svg("path", { d: "M66 90 C70 87 73 90 70 92 L66 92 Z", fill: "#4a3b2c" }),
      svg("path", { d: "M38 90 C42 87 45 90 42 92 L38 92 Z", fill: "#4a3b2c" }),
    ],
  },

  // Sitting a couple of units clear of where the ground will be, which is the
  // one character that is meant to. Its tail plumes used to reach y=96, five
  // units past the y=91 the token places on the trail, so the longest feathers
  // were buried in the earth rather than trailing behind a bird in flight.
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
    // Rooted on the body's own ellipse rather than on a circle around it. A
    // single `inner` radius cannot do that job: the body is much wider than it
    // is tall, so a radius short enough to bury the quills over the flanks
    // cleared the spine entirely and the quills above the back started in
    // mid-air. Deriving both ends from BODY means this keeps holding if the body
    // is ever resized, which a hand-tuned pair of radii would not.
    const BODY = { cx: 50, cy: 68, rx: 27, ry: 21 }
    // How far down into the body each quill is buried, as a fraction of the
    // body's radius, and how far past the silhouette it stands out. The body is
    // drawn over the roots, so ROOT only has to be inside the outline.
    const ROOT = 0.88
    const LENGTH = 18
    const quills = []
    for (let i = 0; i < 13; i += 1) {
      // Stops short of the head: the fan used to reach 0.92π, which put the last
      // quill's root on top of the eye.
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
 * `onTrail` picks a pose, not a subset of shapes. It used to strip out anything
 * the animal hung from, which was enough to get the sloth's branch off the trail
 * but left it walking with its arms above its head -- and a subtractive flag is
 * meaningless to a pack backed by images, where a pose is a different frame. A
 * character with only one pose ignores the flag.
 *
 * @param {unknown} characterId - A character id
 * @param {boolean} [onTrail] - True for the walking pose, false for the card
 * @returns {import("./index.js").Drawing} The drawing; a neutral blob if unknown
 */
export function character(characterId, onTrail = false) {
  // Object.hasOwn, not a bare lookup: `character("constructor")` off a
  // corrupted save would otherwise reach Object.prototype and throw, and
  // this file's header promises an unknown id degrades to a neutral shape.
  const entry = Object.hasOwn(CHARACTERS, characterId) ? CHARACTERS[characterId] : null
  if (!entry) return _drawing([svg("circle", { cx: 50, cy: 55, r: 30, fill: NEUTRAL })])
  const draw = typeof entry === "function" ? entry : onTrail ? entry.trail : entry.card
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
    // An icicle drawn in ice colours vanishes into the white card it sits on --
    // the item pips are on the game's chrome, not on the season's sky, so the
    // deepened winter palette does not help here. The saturated cap and the
    // shaded facet are what give it an edge without relying on a stroke.
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
 * overlapping ellipses.
 *
 * This was two flat ellipses, each with a darker ellipse in the middle. The dark
 * middle was meant to suggest a rounded ring; what it reads as is a hole, so she
 * sat inside two green hoops rather than on her own tail.
 *
 * A spiral fixes it because the two cues that say "one body" are continuity and
 * taper, and neither survives being drawn as separate rings. The chain runs from
 * her waist outward, thick to thin, and is emitted in that order so the
 * painter's algorithm does the overlap for free: each blob is nearer the viewer
 * than the one before, which is exactly true of a coil spiralling outward and
 * down.
 *
 * Filled ellipses rather than a stroked path, for the reason given on her face:
 * this pack avoids strokes. A tapering stroke would need a variable width
 * anyway, which SVG cannot express.
 * @private
 * @returns {Array<Object>} Ellipses, back to front
 */
function _coils() {
  // Enough samples that consecutive ellipses overlap even at the thin end. The
  // step along the spiral grows with its radius while the body shrinks, so the
  // outer turn is where a chain like this beads into visible lumps.
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
      // `0.34` is the foreshortening: a coil seen from slightly above is a wide,
      // shallow ellipse, not a circle. The drift downward stacks the turns.
      cy: 70 + 11 * t + spiral * 0.34 * Math.sin(angle),
      // Thin enough that consecutive turns do not touch. Thicker and the whole
      // spiral merges into one green mass, which is no better than the two
      // hoops it replaced. The power curve holds the width most of the way and
      // then loses it quickly, which is how a tail actually tapers -- linear
      // gives a cone.
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

  // Grouped by whole turn, and each turn drawn rim-then-body. The rim is only
  // visible where the next thing painted does not cover it: around the outside
  // of the chain, and -- because a turn is completed before the next one starts
  // -- along the seam where the body crosses in front of itself. That seam is
  // what separates one turn from the next; without it the spiral reads as a
  // single flat shape.
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
 * The snake woman. A witch from the waist up and a serpent below it: coils on
 * the ground, a violet robe, a pointed hat, a human face, and the potion she is
 * making held out in one hand.
 *
 * She used to have a snake's head and a crown, which read as a monster wearing
 * jewellery rather than as the potion-maker who sets the quest. The coils stayed
 * -- they are what make her a snake woman rather than a generic witch -- and
 * everything above them is a person now.
 *
 * Two constraints shape the drawing more than taste does:
 *
 * - **It has to work at 62px.** The demand bar portrait is that small, so at
 *   that size the face is about 18px across. What survives is the arrangement,
 *   the brows and the hat; slit pupils and a forked tongue did not. Her head is
 *   deliberately larger than a realistic proportion would allow.
 * - **Her skin is pale enough to disappear** against the white surface the
 *   portrait sits on, which is why a slightly darker ellipse sits behind the
 *   face as a rim and the hair frames it on both sides. The hat does the same
 *   job from above.
 *
 * Built almost entirely from filled shapes rather than thick strokes: a stroked
 * path looks identical in a browser but vanishes in any renderer that treats
 * `stroke-width` loosely, and the coils read better as a solid body anyway.
 *
 * @returns {import("./index.js").Drawing} The drawing
 */
export function villain() {
  return _drawing([
    // Her coils: one tapering body wound twice. See `_coils`.
    ..._coils(),
    // The robe, flaring from the shoulders down onto the top coil. Kept narrow
    // enough that the coil still shows either side of the hem -- draped over the
    // whole width, the two rings stopped reading as a coiled body.
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
    // Head. The rim is the outline: a darker ellipse a shade larger than the
    // face, which survives a renderer that ignores stroke widths.
    svg("ellipse", { cx: 53, cy: 39, rx: 15.4, ry: 16.4, fill: "#c4aed4" }),
    svg("ellipse", { cx: 53, cy: 39, rx: 14, ry: 15, fill: "#ece0f2" }),
    // Hair, falling either side from under the brim and framing the pale face.
    svg("path", { d: "M41 30 C36 40 35 54 38 64 L45 62 C42 52 41 40 44 31 Z", fill: "#2f2340" }),
    svg("path", { d: "M65 30 C70 40 71 54 68 64 L61 62 C64 52 65 40 62 31 Z", fill: "#2f2340" }),
    // Brows, which are what make this read as a face rather than two dots. They
    // do more at portrait size than the eyes themselves, which is exactly why
    // they are filled and not stroked -- see the note above about renderers that
    // treat `stroke-width` loosely. A brow that failed to draw would cost her
    // the expression.
    //
    // Near level, tilting down very slightly towards the outer edge. Sloped the
    // other way -- inner ends low -- she scowled, and she is the one character
    // in the game who is not a threat.
    svg("path", { d: "M44.6 34.3 L51.6 33.1 L51.6 35 L44.6 36.2 Z", fill: "#2f2340" }),
    svg("path", { d: "M61.4 34.3 L54.4 33.1 L54.4 35 L61.4 36.2 Z", fill: "#2f2340" }),
    // Eyes. Green irises, the last thing she has in common with a snake.
    svg("ellipse", { cx: 47.8, cy: 40, rx: 3.7, ry: 3.3, fill: "#fff" }),
    svg("ellipse", { cx: 58.2, cy: 40, rx: 3.7, ry: 3.3, fill: "#fff" }),
    svg("circle", { cx: 48.2, cy: 40, r: 2.2, fill: "#3d6549" }),
    svg("circle", { cx: 58.6, cy: 40, r: 2.2, fill: "#3d6549" }),
    svg("circle", { cx: 48.2, cy: 40, r: 1.1, fill: "#1e1728" }),
    svg("circle", { cx: 58.6, cy: 40, r: 1.1, fill: "#1e1728" }),
    // A soft shadow for the nose tip. Drawn as a wedge it read as a hole, which
    // with two large eyes above it made the face look like a skull.
    svg("ellipse", { cx: 53.6, cy: 45, rx: 2.2, ry: 1.6, fill: "#d9c4e3" }),
    svg("circle", { cx: 45, cy: 45, r: 2.6, fill: "#d9a0b8", "fill-opacity": 0.45 }),
    svg("circle", { cx: 61, cy: 45, r: 2.6, fill: "#d9a0b8", "fill-opacity": 0.45 }),
    // She is pleased to see you and she still wants eleven roses. A filled
    // crescent rather than a stroked arc, for the same reason as the brows.
    svg("path", { d: "M48.8 48.2 Q53 52.4 57.2 48.2 Q53 50.6 48.8 48.2 Z", fill: "#a8506e" }),
    // The hat, drawn over the head so the brim sits on the forehead. Leaning a
    // little, because a perfectly upright cone looks like a traffic marker.
    svg("path", { d: "M60 1 C55 9 49 19 42 28 L67 28 C65 19 63 9 60 1 Z", fill: "#3f2a52" }),
    svg("path", { d: "M49.8 18 L64 18 L65.2 23 L46.4 23 Z", fill: "#e8c34a" }),
    svg("path", {
      d: "M55.5 17.1 L56.38 19.29 L58.73 19.45 L56.93 20.96 L57.5 23.25 L55.5 22 L53.5 23.25 L54.07 20.96 L52.27 19.45 L54.62 19.29 Z",
      fill: "#f5e08a",
    }),
    svg("ellipse", { cx: 54, cy: 28, rx: 20.5, ry: 4.4, fill: "#3f2a52" }),
    // Her right arm and the potion, in front of everything: the flask is the
    // clearest thing in the drawing that says what she does.
    svg("path", { d: "M62 57 C68 58 74 62 78 68 L73 72 C70 67 66 64 59 62 Z", fill: "#573a6f" }),
    svg("circle", { cx: 79, cy: 71, r: 4.6, fill: "#ece0f2" }),
    svg("rect", { x: 78.5, y: 51, width: 7, height: 3.6, rx: 1.4, fill: "#8a6a4a" }),
    svg("rect", { x: 79.5, y: 54, width: 5, height: 6, fill: "#8fd4ee" }),
    svg("circle", { cx: 82, cy: 64, r: 6.5, fill: "#8fd4ee" }),
    // The arc's ends sit on the circle, so the potion fills the flask exactly to
    // the line rather than spilling out of the glass.
    svg("path", { d: "M75.82 64 A6.5 6.5 0 0 0 88.18 64 Z", fill: "#7fb08b" }),
    svg("circle", { cx: 79.6, cy: 63, r: 1.8, fill: "#fff", "fill-opacity": 0.6 }),
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
 * The snow lying on each obstacle, keyed by the same kinds as OBSTACLE_ART and
 * drawn over the top of it in the seasons `SNOWY` names.
 *
 * A separate map rather than a branch inside each drawing above, so a kind is
 * still one silhouette that recolours for all four seasons and winter is an
 * extra layer rather than a second version of every shape.
 *
 * Every path here is written against the silhouette it settles on and stays
 * inside it -- mostly by reusing that silhouette's own vertices, the same trick
 * the hill's shaded face uses. Snow that overshot the outline would read as a
 * white smear floating beside the obstacle rather than as lying on it.
 * @private
 */
const SNOW_ART = {
  hill: (snow) => [
    // The dome's whole outline, closed with a wavy line back to its own base
    // corners: a drift over the crown that thins to nothing where the hill meets
    // the ground. The line has to stay low near the corners, because that is
    // where the dome climbs fastest and snow drawn any higher would leave it.
    svg("path", {
      d: "M-118 2 C-84 -44 -44 -62 0 -62 C46 -62 88 -42 118 2 Q98 -24 62 -26 Q26 -12 0 -26 Q-30 -40 -62 -26 Q-96 -12 -118 2 Z",
      fill: snow,
    }),
  ],

  mountain: (snow) => [
    // A snowfield on each peak, hung from the summit and down both ridges, with
    // a jagged lower edge where the snowline runs out. Both start and end on the
    // ridge points themselves, so the field can only ever be inside the rock.
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
    // Ice growing out from both banks along the water's own edge, and a cap on
    // each stepping stone -- the crossing animation lands on those twice, so
    // they are the part of a frozen river worth drawing.
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
    // Snow on the two rock lips, which is the only part of a hole in the ground
    // that any can settle on. It also brightens the rim, so the void reads even
    // harder against it.
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
  const drawn = Object.hasOwn(OBSTACLE_ART, kind) ? kind : "hill"
  const shapes = OBSTACLE_ART[drawn](c, edge)
  // Snow last, because it lies on top of everything it has fallen on. The
  // resolved kind, not the argument: an unknown kind draws a hill, and it should
  // be a hill with snow on it rather than a bare one.
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
 *
 * Together with `layout`'s `tokenScale` these fix the **ground line** every
 * character is drawn against: a token placed at a stop puts drawing y
 * `TOKEN_FOOT / tokenScale`, which is 91, exactly on the trail. So a character
 * whose lowest shape stops short of y=91 floats, and one that reaches past it is
 * buried. Three of the four got this wrong at some point, and the mistake is
 * invisible in the 100x100 box a character is drawn in -- it only shows once the
 * animal is standing on a hillside. If `tokenScale` changes, every character
 * moves off the ground together.
 * @private
 */
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
 * The ground line, sampled left to right and split wherever a gap removes it.
 *
 * One list of `[x, y]` points per unbroken stretch. Everything drawn along the
 * ground -- the filled earth below it and the textured band along its top edge
 * -- is derived from these same points, which is the only way the two can be
 * guaranteed to agree. Computing the band from its own walk of the ground would
 * work right up until one of the two rounded differently or stepped over a
 * break, and then the band would float over the river basin or bridge the void.
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
 * What the top edge of the ground is made of, per season.
 *
 * The ground used to end at a clean mathematical curve, which is the one thing
 * no ground does: it read as a coloured region rather than as a surface, and it
 * gave the four seasons nothing underfoot to tell them apart beyond hue. This
 * band is a strip of material lying along that curve -- `depth` thick, with a
 * top edge that stands `rise` proud of it in whatever `shape` the season's
 * material makes.
 *
 * Three shapes cover the four seasons:
 *
 * - `tuft` alternates flat and raised at every other sample, which at
 *   `GROUND_STEP` apart is a blade of grass every 24 units. The height is
 *   varied by arithmetic rather than left uniform, because a perfectly even
 *   sawtooth reads as a zip fastener.
 * - `scallop` runs a quadratic through the same alternation instead of a
 *   straight line, so the raised samples become rounded humps -- leaves lying
 *   on the ground rather than grass standing up out of it.
 * - `drift` is a shallow sine on a much thicker band: an unbroken crust of
 *   snow, which is the one material here that does not have individual pieces.
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
  // Every other sample stands up. The moduli are coprime with the alternation
  // so the raised ones are not all the same height, which is what stops a run
  // of grass looking machined.
  if (i % 2 === 0) return y - depth
  return y - depth - rise * (0.55 + ((i * 7) % 5) / 8)
}

/**
 * The textured band along the top of the ground, one path per unbroken stretch.
 *
 * Its underside is the ground line itself, sample for sample and in reverse, so
 * the band cannot drift off the surface it is lying on. That matters in exactly
 * the two places the ground is not flat: it has to sink into a river basin with
 * the ground, and it has to stop at the lip of a gap rather than carry on over
 * the void. Both come free from being built out of `groundRuns`, which has
 * already done the deformation and the splitting.
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
      // Each raised sample becomes the control point of a curve between the two
      // flat samples either side of it, so the hump is round rather than
      // pointed. A run of even length leaves a final control with nothing to
      // curve towards, which is drawn as a plain line to it instead.
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
 * How fast each backdrop layer pans, as a fraction of the ground's speed.
 *
 * The backdrop used to be one group, appended inside the same camera group as
 * the ground, so a hill three miles away slid past at exactly the speed of the
 * grass under the character's feet. That is not a subtle wrongness -- it is the
 * whole reason the landscape read as a painted flat rather than as distance.
 *
 * The numbers are not measured off anything; they are the smallest set that
 * separates four planes. Sky at 0 is nailed to the screen, which is what a sky
 * is: it has no parallax because it has no distance. The two ridges take a
 * quarter and a bit over half, far enough apart that the near one visibly
 * overtakes the far one during a single crossing rather than only over a whole
 * trail. `air` is the weather -- snow, blossom, leaves -- at 0.85: nearly the
 * character's own plane, because it is falling between the player and the
 * trail rather than out on the horizon, but not 1, or it would be pinned to the
 * ground and stop reading as weather at all.
 *
 * Nothing may exceed 1. A layer faster than the ground overtakes the character,
 * which the eye reads as the background sliding the wrong way.
 * @private
 */
const PARALLAX = {
  sky: 0,
  far: 0.25,
  near: 0.55,
  air: 0.85,
}

/**
 * The sun, in the coordinates of a layer that never moves -- so it stays in the
 * same corner of the screen for the whole trail, which is what a sun at that
 * distance does. Sized and placed against `VIEWPORT_WIDTH` rather than the
 * trail's width for the same reason: a fixed layer only ever shows its first
 * viewport.
 * @private
 */
const SUN = { cx: VIEWPORT_WIDTH * 0.82, cy: 48, r: 24 }

/**
 * Which seasons put something in the fixed sky layer, and what.
 *
 * Only summer, which is the one season whose defining feature is overhead
 * rather than falling. A map rather than an `if` so a later season can claim a
 * moon without this function growing a branch.
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
      // A halo before the disc, so the edge of the sun is soft without a
      // gradient -- which this pack cannot use; see the file header.
      svg("circle", { ...SUN, r: SUN.r + 14, fill: colors["--season-sun"], "fill-opacity": 0.22 }),
      ...rays,
      svg("circle", { ...SUN, fill: colors["--season-sun"] }),
    ]
  },
}

/**
 * What each season scatters through the air, and where.
 *
 * `step` is how far apart the marks are seeded, which is the only real cost
 * control here: a trail is up to 5100 units wide, so a step of 52 is around a
 * hundred elements and a step of 5 would be a thousand. `top` and `height`
 * bound the band they fall through, and every one of them is chosen so the
 * lowest possible mark stays clear of the highest possible ground -- the ground
 * rests at `GROUND - ROLL` at its very highest, 176, and every obstacle profile
 * pushes it *down* from there. Anything drawn below that line would settle on
 * the trail the character walks, which is the one place weather must not be.
 *
 * Summer is the odd one: not something falling but the air itself moving, drawn
 * low and warm where heat actually shimmers.
 * @private
 */
const AIR_ART = {
  spring: {
    step: 62,
    top: 14,
    height: 151,
    // Blossom: a petal is a short wide oval, and it is the tilt that stops a
    // field of them reading as a field of full stops.
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
    // Heat haze: a shallow double curve, stroked and half transparent. Drawn
    // low, because rising heat is a thing that happens just above hot ground and
    // nowhere near the top of the picture -- but not so low that the grass
    // standing along the top of the ground hides it. The grass is drawn on the
    // ground's own layer, which is painted over this one, and summer's tufts
    // reach some sixteen units above the ground line.
    //
    // Written in absolute coordinates rather than the shorter relative form, so
    // that every number in every prop this pack draws is a real position on the
    // trail. `art.test.js` reads those numbers back to check that nothing in the
    // air can settle on the ground, and it cannot do that through a chain of
    // deltas.
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
    // Falling leaves. Longer and flatter than spring's petals, and turned
    // through a wider spread of angles, because a leaf on the way down spins.
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
 * Marks scattered across a span, by arithmetic rather than by chance.
 *
 * Nothing in this game calls `Math.random` (see ../README.md), and a backdrop
 * that came out differently each time it was built would make the trail flicker
 * on every rebuild -- the scene is rebuilt whenever the season or the character
 * changes, and a flickering snowfall would be the most visible thing on screen.
 *
 * Every modulus here is coprime with the step it perturbs, which is the whole
 * trick: `x` advances by a constant and is then nudged by a cycle of length 41
 * that never lines up with it, so the marks do not settle into the lattice that
 * a plain `i % n` offset produces.
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
  // The final sample is written at `span` exactly rather than left to the loop.
  // Sampling every 40 units stops up to 39 short of the end on any span that is
  // not a multiple of 40 -- winter's 5100 stops at 5080 -- and the closing edge
  // then ran diagonally from the last ridge point down to the bottom corner.
  d += ` L ${at(span)}`
  return svg("path", {
    d: `${d} L ${span} ${HEIGHT} L 0 ${HEIGHT} Z`,
    fill,
    "fill-opacity": opacity,
  })
}

/**
 * The layered landscape behind a whole trail.
 *
 * Generated at the trail's real width rather than scaled to it: an earlier
 * fixed-size vignette stretched across a 5000-unit trail flattened its hills
 * into flat bands.
 *
 * **Four layers, each with its own parallax factor** -- see `PARALLAX` for what
 * the numbers mean and why this is not one group any more. GameUI pans layer
 * `n` by `offset * factor[n]` instead of panning everything together, so the
 * ridges separate in depth as the character walks.
 *
 * Every layer is generated across the whole trail width and says so in `span`,
 * which is what closes the only hole this arrangement can have. GameUI clamps
 * the camera to `[0, width - viewportWidth]`, so a layer at factor `f` is only
 * ever asked to show `[offset * f, offset * f + viewportWidth]`, and the worst
 * case is `f * (width - viewportWidth) + viewportWidth`. That is at most
 * `width` for any `f` no greater than 1, so a full-width layer can never run
 * out at either end -- and a layer that had been generated at, say, the
 * viewport's width instead would open a gap on winter's 5100-unit trail within
 * the first crossing. `art.test.js` holds the inequality at both ends of the
 * longest trail rather than trusting the arithmetic here.
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
  const props = air
    ? _scatter(span, air.step, air.top, air.height).map((mark) =>
        air.draw(mark, colors["--season-prop"]),
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
 * `groundSegments` and `groundEdges` come back as two parallel lists of the
 * same length: the filled earth, and the band of material lying along its top
 * edge. Two lists rather than one shape because they are painted in different
 * colours and the caller needs to be able to stack them; the same length
 * because both are built from `groundRuns`, so a gap that breaks one breaks the
 * other in exactly the same place.
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
 * How many keyframes a crossing is sampled into.
 *
 * The motion is described as a continuous path and then sampled, rather than
 * written as a handful of poses. Twenty-four is where a 620ms leap stops showing
 * corners on a 60Hz screen -- roughly one sample every 26ms -- and it is cheap:
 * the browser interpolates between them on the compositor either way.
 * @private
 */
const TRAVERSAL_SAMPLES = 24

/**
 * Height of a jump at `t`, as a fraction of its peak. A projectile: 0 at both
 * ends, 1 at the top, and -- the part that matters -- slowest near the apex,
 * because the curve flattens there.
 * @private
 * @param {number} t - Progress through the jump, 0 to 1
 * @returns {number} Height as a fraction of the peak
 */
function _arc(t) {
  return 4 * t * (1 - t)
}

/**
 * Progress along the ground at `t`.
 *
 * `hang` slows the middle of the crossing without changing where it starts or
 * ends: the derivative is `1 + hang * cos(2*pi*t)`, so the character covers
 * ground quickly at take-off and landing and dwells at the top. It has to stay
 * under 1 or the derivative goes negative and the character walks backwards.
 * @private
 * @param {number} t - Progress through the crossing, 0 to 1
 * @param {number} hang - How much to dwell in the middle, 0 to 0.8
 * @returns {number} Fraction of the distance covered
 */
function _ground(t, hang) {
  return t + (hang * Math.sin(2 * Math.PI * t)) / (2 * Math.PI)
}

/**
 * A brief compression centred on one moment of the crossing.
 *
 * A raised cosine rather than a triangle, so the squash eases in and out
 * instead of cornering. Each dip must satisfy `at + width <= 1`, which is what
 * lets the last sample come out clean -- see `traversal`.
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
 * The shape and timing of one kind of crossing.
 *
 * `height` is the peak of the arc in pixels, `hops` splits it into that many
 * arcs in a row, `hang` dwells at the top, `squash` compresses vertically and
 * `narrow` horizontally. Every kind gets its own `duration`, because the same
 * path at the same speed would make a mountain feel like a step over a hill.
 * @private
 * @param {string} kind - The obstacle kind
 * @returns {Object} The crossing's shape
 */
function _crossing(kind) {
  switch (kind) {
    case "gap":
      // A long low leap: committed, no hang at all, so the ground speed stays
      // constant the way a real jump's does. Hardest landing of the flat ones.
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
      // Two hops across, as if using stones. `hops: 2` puts a touchdown exactly
      // at the halfway point, where the second arc starts from zero again.
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
      // No lift at all -- pushing through. The hang is the resistance, and the
      // character comes out still a little compressed sideways rather than
      // dropping onto its feet.
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
 * How the character gets across one obstacle, as Web Animations keyframes.
 *
 * The pack owns the motion as well as the drawing, so a future sprite pack can
 * return frame-swapping keyframes where this one returns transforms, and GameUI
 * does not have to know which it got. Every kind moves between the same two
 * points; what differs is the shape of the path and the timing, which is where
 * the sense of weight comes from.
 *
 * **The path is sampled, not posed.** Each crossing used to be three to six
 * keyframes -- take off, apex, land -- which the browser joins with straight
 * lines, so a jump traced a triangle and visibly cornered at the top. Worse, the
 * single `ease-in-out` across the whole animation made the character *fastest*
 * at the apex, which is backwards: a real jump hangs there. Describing the arc
 * as a function and sampling it at `TRAVERSAL_SAMPLES` points fixes both, and
 * the options carry `easing: "linear"` because the timing now lives in the
 * samples themselves.
 *
 * Every crossing lands the same way: a squash just before the end, then a clean
 * final frame. The squash is how far the animal fell, so a mountain hits harder
 * than a river hop, and it is the cheapest thing on the trail that makes the
 * ground feel solid. The final frame carries no deformation at all, which is
 * load-bearing rather than tidy -- crossings play with `fill: "forwards"`, so
 * whatever the last frame says is what the character keeps looking like for the
 * whole of the next question. The gap used to end on `scaleY(0.9)` and left the
 * animal standing there 10% short. Each dip keeps `at + width <= 1` so the
 * compression has already returned to zero by the end, and the last sample is
 * written out clean regardless.
 *
 * The squash scales about the bottom of the token, not its middle. That is a
 * CSS decision, in `.trail-token`; without it a `scaleY` here lifts the
 * character off the ground instead of pressing it into the ground.
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
    // With more than one hop each arc runs its own 0..1, so the character
    // touches down between them. `_arc` is 0 at both ends, which is what makes
    // the wrap-around land rather than jump.
    const lift = height * _arc((t * hops) % 1)
    keyframes.push({ transform: at(point, Number(lift.toFixed(3)), deform(t)), offset: t })
  }
  // The two ends are written exactly rather than sampled. The last must be
  // `standing(to)` and nothing else, for the `fill: "forwards"` reason above;
  // the first must be exactly where the character already stands, so rounding
  // in `_ground` can never shift it a pixel on take-off.
  keyframes[0] = { transform: at(from, 0, deform(0)), offset: 0 }
  keyframes[keyframes.length - 1] = { transform: at(to), offset: 1 }
  return { keyframes, options: { duration: shape.duration, easing: "linear" } }
}

/**
 * How long the reduced-motion crossing takes.
 *
 * Short enough to read as a transition rather than a journey, long enough that
 * the eye catches it: the crossings it stands in for run 620ms to 1150ms, and
 * anything under about 150ms is indistinguishable from a cut.
 * @private
 */
const REDUCED_MS = 240

/**
 * The same crossing for a player who has asked for less motion.
 *
 * `prefers-reduced-motion` used to mean *no* motion here: the character was
 * placed on the next stop instantly and the camera jumped after it. That reads
 * as the game having no crossings at all, and the crossing is the main piece of
 * feedback the trail gives -- someone playing with the system setting on was
 * told nothing had happened every time something had. The preference asks for
 * less vestibular load, not for the interface to stop telling the truth.
 *
 * So: a plain slide, and nothing else. Two keyframes, so the browser
 * interpolates a straight line; `linear`, so there is no acceleration to feel;
 * no arc, no hang, no squash and no horizontal compression, because those four
 * are exactly the swooping and elastic motion the preference exists to
 * suppress. The distance travelled is the same, which is the point -- the
 * character is *seen* to move from one stop to the next.
 *
 * The kind is ignored on purpose. Giving a mountain a heavier reduced crossing
 * than a hill would be reintroducing the character of the motion through the
 * back door, and character is what has been asked for less of.
 *
 * Ends on exactly `standing(to)` and nothing else, for the `fill: "forwards"`
 * reason spelled out on `traversal`.
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

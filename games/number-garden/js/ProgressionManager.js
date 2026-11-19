/**
 * Per-area theme data for the garden screen.
 *
 * `primaryColor` and `accentColor` are the decorative identity of an area
 * (backgrounds, borders, glows). `inkColor` is the text-safe variant of
 * `primaryColor`: headings are drawn with it, and the two gold/orange
 * primaries (`time-temple` at 2.42:1 and `measurement-market` at 2.85:1
 * against white) are far too light to read as text. Rather than darkening
 * the identity colours, `inkColor` carries a darkened value that clears
 * WCAG AA 4.5:1 while `primaryColor` stays bright for decoration. The four
 * primaries that already pass repeat their value here on purpose -- do not
 * collapse `inkColor` back into `primaryColor`.
 */

// Inline SVG tiles; only the fill colour and opacity change per stage.
const TILES = {
  waves: (c, o) =>
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 40' width='80' height='40'><path fill='${c}' fill-opacity='${o}' d='M0 40a19.96 19.96 0 0 1 5.9-14.11 20.17 20.17 0 0 1 19.44-5.2A20 20 0 0 1 20.2 40H0zM65.32.75A20.02 20.02 0 0 1 40.8 25.26 20.02 20.02 0 0 1 65.32.76zM.07 0h20.1l-.08.07A20.02 20.02 0 0 1 .75 5.25 20.08 20.08 0 0 1 .07 0zm1.94 40h2.53l4.26-4.24v-9.78A17.96 17.96 0 0 0 2 40zm5.38 0h9.8a17.98 17.98 0 0 0 6.67-16.42L7.4 40zm3.43-15.42v9.17l11.62-11.59c-3.97-.5-8.08.3-11.62 2.42zm32.86-.78A18 18 0 0 0 63.85 3.63L43.68 23.8zm7.2-19.17v9.15L62.43 2.22c-3.96-.5-8.05.3-11.57 2.4zm-3.49 2.72c-4.1 4.1-5.81 9.69-5.13 15.03l6.61-6.6V6.02c-.51.41-1 .85-1.48 1.33zM17.18 0H7.42L3.64 3.78A18 18 0 0 0 17.18 0zM2.08 0c-.01.8.04 1.58.14 2.37L4.59 0H2.07z'></path></svg>`,
  crystals: (c, o) =>
    `<svg width='180' height='180' viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'><path d='M81.28 88H68.413l19.298 19.298L81.28 88zm2.107 0h13.226L90 107.838 83.387 88zm15.334 0h12.866l-19.298 19.298L98.72 88zm-32.927-2.207L73.586 78h32.827l.5.5 7.294 7.293L115.414 87l-24.707 24.707-.707.707L64.586 87l1.207-1.207zm2.62.207L74 80.414 79.586 86H68.414zm16 0L90 80.414 95.586 86H84.414zm16 0L106 80.414 111.586 86h-11.172zm-8-6h11.173L98 85.586 92.414 80zM82 85.586L87.586 80H76.414L82 85.586zM17.414 0L.707 16.707 0 17.414V0h17.414zM4.28 0L0 12.838V0h4.28zm10.306 0L2.288 12.298 6.388 0h8.198zM180 17.414L162.586 0H180v17.414zM165.414 0l12.298 12.298L173.612 0h-8.198zM180 12.838L175.72 0H180v12.838zM0 163h16.413l.5.5 7.294 7.293L25.414 172l-8 8H0v-17zm0 10h6.613l-2.334 7H0v-7zm14.586 7l7-7H8.72l-2.333 7h8.2zM0 165.414L5.586 171H0v-5.586zM10.414 171L16 165.414 21.586 171H10.414zm-8-6h11.172L8 170.586 2.414 165zM180 163h-16.413l-7.794 7.793-1.207 1.207 8 8H180v-17zm-14.586 17l-7-7h12.865l2.333 7h-8.2zM180 173h-6.613l2.334 7H180v-7zm-21.586-2l5.586-5.586 5.586 5.586h-11.172zM180 165.414L174.414 171H180v-5.586zm-8 5.172l5.586-5.586h-11.172l5.586 5.586zM152.933 25.653l1.414 1.414-33.94 33.942-1.416-1.416 33.943-33.94zm1.414 127.28l-1.414 1.414-33.942-33.94 1.416-1.416 33.94 33.943zm-127.28 1.414l-1.414-1.414 33.94-33.942 1.416 1.416-33.943 33.94zm-1.414-127.28l1.414-1.414 33.942 33.94-1.416 1.416-33.94-33.943zM0 85c2.21 0 4 1.79 4 4s-1.79 4-4 4v-8zm180 0c-2.21 0-4 1.79-4 4s1.79 4 4 4v-8zM94 0c0 2.21-1.79 4-4 4s-4-1.79-4-4h8zm0 180c0-2.21-1.79-4-4-4s-4 1.79-4 4h8z' fill='${c}' fill-opacity='${o}' fill-rule='evenodd'/></svg>`,
  crosses: (c, o) =>
    `<svg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'><g fill='none' fill-rule='evenodd'><g fill='${c}' fill-opacity='${o}'><path d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/></g></g></svg>`,
}

const pattern = (tile, color, opacity) => {
  const svg = TILES[tile](color, opacity)
    .replace(/</g, "%3C")
    .replace(/>/g, "%3E")
    .replace(/#/g, "%23")
  return `url("data:image/svg+xml,${svg}")`
}

const squares = (c, c2) =>
  [135, 225, 45]
    .map((deg) => `linear-gradient(${deg}deg, ${c} 25%, transparent 25%)`)
    .concat(`linear-gradient(315deg, ${c} 25%, ${c2} 25%)`)
    .join(", ")

const scales = (c, c2) =>
  ["100% 150%", "0 150%"]
    .map(
      (at) =>
        `radial-gradient(circle at ${at}, ${c} 24%, ${c2} 24%, ${c2} 28%, ${c} 28%, ${c} 36%, ${c2} 36%, ${c2} 40%, transparent 40%, transparent)`,
    )
    .join(", ")

// Each row is [background, description, ...image args]; stages are 0, 25, 50, 75, 100 percent.
const stages = (image, rows) =>
  rows.map(([background, description, ...args], i) => ({
    percent: i * 25,
    background,
    backgroundImage: image(...args),
    description,
  }))

export const AREA_THEMES = {
  "flower-meadow": {
    progressionType: "color",
    primaryColor: "#764ba2",
    accentColor: "#667eea",
    inkColor: "#764ba2",
    stages: stages(pattern.bind(null, "waves"), [
      ["#c4c5cc", "barren", "#9C92AC", 0.2],
      ["#d4e5c7", "sprouting", "#7a9b5f", 0.25],
      ["#b8e6ba", "growing", "#56a859", 0.3],
      ["#a8edea", "blooming", "#38b68a", 0.35],
      ["#84fab0", "radiant", "#21c98a", 0.4],
    ]),
    decorations: ["🌱", "🌿", "🍃", "🌾", "✨"],
  },
  "crystal-cave": {
    progressionType: "glow",
    primaryColor: "#6a5acd",
    accentColor: "#9370db",
    inkColor: "#6a5acd",
    stages: stages(pattern.bind(null, "crystals"), [
      ["#2c2c44", "dark", "#4a4a6a", 0.2],
      ["#3d3d5c", "dim", "#5b5b8d", 0.25],
      ["#4a4a6a", "glowing", "#7070aa", 0.3],
      ["#6a5acd", "bright", "#8470ff", 0.35],
      ["#9370db", "radiant", "#da70d6", 0.4],
    ]),
    decorations: ["💎", "🔮", "💠", "✨", "⭐"],
  },
  "enchanted-forest": {
    progressionType: "depth",
    primaryColor: "#4a6b3a",
    accentColor: "#7a9b5f",
    inkColor: "#4a6b3a",
    stages: stages(pattern.bind(null, "waves"), [
      ["#8b9876", "clearing", "#596b47", 0.2],
      ["#7a9b5f", "young forest", "#4a6b3a", 0.25],
      ["#5e824a", "dense forest", "#345a28", 0.3],
      ["#4a6b3a", "enchanted", "#254719", 0.35],
      ["#3a5b2a", "mystical", "#1a3a0f", 0.4],
    ]),
    decorations: ["🌿", "🍄", "🦋", "✨", "🧚"],
  },
  "time-temple": {
    progressionType: "light",
    primaryColor: "#c9a227",
    accentColor: "#f4d03f",
    // Darkened gold: 4.61:1 on white, where #c9a227 is only 2.42:1.
    inkColor: "#8d721b",
    stages: stages(pattern.bind(null, "crosses"), [
      ["#5a5a6e", "frozen", "#3a3a4e", 0.2],
      ["#6a6a7e", "ticking", "#4a4a6e", 0.25],
      ["#8a7a3e", "flowing", "#6a5a2e", 0.3],
      ["#c9a227", "golden", "#a98217", 0.35],
      ["#f4d03f", "timeless", "#d4b02f", 0.4],
    ]),
    decorations: ["⏰", "⌚", "✨", "⭐", "💫"],
  },
  "measurement-market": {
    progressionType: "organized",
    primaryColor: "#e67e22",
    accentColor: "#f39c12",
    // Darkened orange: 4.60:1 on white, where #e67e22 is only 2.85:1.
    inkColor: "#b35f14",
    stages: stages(squares, [
      ["#d4c5b9", "empty", "#d4c5b9", "#e8ded3"],
      ["#dab89f", "stocking", "#dab89f", "#e8d4c3"],
      ["#d39e6f", "busy", "#d39e6f", "#e8c4a3"],
      ["#e67e22", "thriving", "#e67e22", "#f39c12"],
      ["#f39c12", "flourishing", "#f39c12", "#ffb142"],
    ]),
    decorations: ["📏", "⚖️", "📦", "🍎", "🦊"],
  },
  "pattern-path": {
    progressionType: "reveal",
    primaryColor: "#9b59b6",
    accentColor: "#c27ba0",
    inkColor: "#9b59b6",
    stages: stages(scales, [
      ["#b8b8c8", "hidden", "#b8b8c8", "#c8c8d8"],
      ["#a89bc8", "emerging", "#a89bc8", "#b8abd8"],
      ["#9b7bc8", "forming", "#9b7bc8", "#ab8bd8"],
      ["#9b59b6", "clear", "#9b59b6", "#ab69c6"],
      ["#c27ba0", "radiant", "#c27ba0", "#d28bb0"],
    ]),
    decorations: ["🦋", "⭐", "💠", "✨", "🔷"],
  },
}

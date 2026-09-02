import { SPECIES } from "./constants.js"

/**
 * Preset configurations -- interesting starting arrangements to explore.
 * Each preset exposes an array of {x, y, species} cells.
 *
 * The arrangements are written as maps rather than coordinate lists: one string
 * per row, one character per cell, so the shape is visible in the source. Rows
 * may be shorter than the grid and there may be fewer of them than it has rows;
 * anything not covered is empty.
 */
const CHARS = {
  g: SPECIES.GRASS,
  b: SPECIES.BEE,
  r: SPECIES.RABBIT,
  f: SPECIES.FOX,
}

function fromMap(rows) {
  const cells = []
  rows.forEach((row, y) => {
    ;[...row].forEach((char, x) => {
      const species = CHARS[char]
      if (species) cells.push({ x, y, species })
    })
  })
  return cells
}

// The field the two food-chain presets share. Rabbits sit in the top-left
// corner; only "Food Chain" adds the foxes.
const FIELD = [
  "....................",
  ".g...g..gg.g.....gg.",
  ".gg.g..g.....g.gggg.",
  ".g.rr..g..gg.g...g..",
  "...rr..g.g..g...g...",
  ".ggg.g...g..gg......",
  ".gg.g....g..g..gg...",
  "....g..g.g.gg....gg.",
  ".gggg....g....g.ggg.",
  ".g..g.....g..g.gggg.",
  ".......gg....g......",
  "...g.......g..g.g...",
  "..gg..gg..gg.ggg.g..",
  "..g....gg...........",
  "...gggg.ggg.g.g.ggg.",
  "..........gg.g...gg.",
  ".....g....gg..g.....",
  ".g.g......ggg....gg.",
  "....gggg.gg.ggg.g...",
  "....................",
]

// Same field, with a fox trio in the bottom right
const FIELD_WITH_FOXES = FIELD.map((row, y) => {
  if (y === 15) return "..........gg.g.ffgg."
  if (y === 16) return ".....g....gg..gf...."
  return row
})

export const PRESETS = [
  {
    name: "Meadow",
    description: "Grass clusters that settle down and come into bloom",
    cells: fromMap([
      "....................",
      "..gg......gg........",
      "..gg......gg........",
      "..............gg....",
      ".......gg.....gg....",
      ".......gg...........",
      "....................",
      "...gg.........gg....",
      "...gg.........gg....",
      "..........gg........",
      "..........gg........",
      "....gg..............",
      "....gg......gg......",
      "............gg......",
      "..gg................",
      "..gg.....gg.........",
      ".........gg.........",
      "..............gg....",
      "..............gg....",
      "....................",
    ]),
  },
  {
    name: "Pollinator",
    description: "Bees over a small meadow -- they spread it much further",
    cells: fromMap([
      "....................",
      "..gg......gg........",
      "..gg......gg........",
      "....bb......bb......",
      "....................",
      "........gg..........",
      "........gg..........",
      "..bb........bb......",
      "....................",
      "..gg......gg........",
      "..gg......gg........",
      "....bb..............",
      "....................",
    ]),
  },
  {
    name: "Rabbit Run",
    description: "Rabbits in a field of grass",
    cells: fromMap([
      "....................",
      "....................",
      "..gggg..............",
      "..gggg..............",
      "..gggg..............",
      "....................",
      "....................",
      ".......rr...........",
      ".......rr...........",
      "....................",
      "..........gggg......",
      "..........gggg......",
      "..........gggg......",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
    ]),
  },
  {
    name: "Ecosystem",
    description: "All four species at once",
    cells: fromMap([
      "....................",
      "..gg......gg........",
      "..gg......gg........",
      "....bb......bb......",
      "....................",
      "....................",
      "..........gg........",
      "..........gg........",
      "....................",
      "....................",
      "..rr................",
      "..rr................",
      "..gggg..............",
      "..gggg..........ff..",
      "................f...",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
    ]),
  },
  {
    name: "Food Chain",
    description: "Grass, rabbits and a few foxes -- watch the chart",
    cells: fromMap(FIELD_WITH_FOXES),
  },
  {
    name: "No Predator",
    description: "The same field without the foxes. Compare the charts.",
    cells: fromMap(FIELD),
  },
  {
    name: "Glider",
    description: "Classic glider pattern in grass",
    cells: fromMap([
      "....................",
      "....................",
      "...g................",
      "....g...............",
      "..ggg...............",
      "....................",
    ]),
  },
]

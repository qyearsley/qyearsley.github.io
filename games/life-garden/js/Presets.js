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

// Same field, with a fox den in the top-left corner. Those three cells stay
// empty for the whole "No Predator" run, so the two charts differ because of
// the foxes and not because three extra cells nudged a chaotic board.
// Presets.test.js pins that.
const FIELD_WITH_FOXES = FIELD.map((row, y) => {
  if (y === 0) return "....ff.............."
  if (y === 1) return ".g..fg..gg.g.....gg."
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
    description: "Rabbits work along strips of grass and then starve",
    // Strips rather than a clump: the grazing front is visible as it travels,
    // and the rabbits have somewhere to travel to. Rabbits beside a lone clump
    // just sat there, because a rabbit is born on 2-3 blades of grass and a
    // clump only ever offers that on its edge.
    cells: fromMap([
      "....................",
      "....................",
      "..gg.gg.gg.gg.gg.gg.",
      "..gg.gg.gg.gg.gg.gg.",
      ".rr.................",
      ".rr.................",
      "....................",
      "..gg.gg.gg.gg.gg.gg.",
      "..gg.gg.gg.gg.gg.gg.",
      "....................",
    ]),
  },
  {
    name: "Ecosystem",
    description: "All four species at once",
    // The foxes sit at the western edge of the rabbits' range rather than in the
    // far corner, where the grazing front never reached them and they simply
    // aged out. They still only get to about five -- this board is for looking
    // at all four species, not for the chain. Food Chain is for the chain.
    cells: fromMap([
      "....................",
      "..gg......gg........",
      "..gg......gg........",
      "....bb......bb......",
      "....................",
      "....................",
      "..........gg........",
      ".f........gg........",
      ".ff.................",
      "....................",
      "..rr................",
      "..rr................",
      "..gggg..............",
      "..gggg..............",
      "....................",
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

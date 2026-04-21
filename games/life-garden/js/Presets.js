import { SPECIES } from "./constants.js"

/**
 * Preset configurations -- interesting starting arrangements to explore.
 * Each preset is an array of {x, y, species} cells.
 */
export const PRESETS = [
  {
    name: "Meadow",
    description: "Scattered grass and flowers",
    cells: [
      // Grass clusters
      ...[
        [3, 3],
        [4, 3],
        [3, 4],
        [4, 4],
        [10, 8],
        [11, 8],
        [10, 9],
        [11, 9],
        [6, 14],
        [7, 14],
        [6, 15],
        [7, 15],
        [15, 3],
        [16, 3],
        [15, 4],
        [16, 4],
      ].map(([x, y]) => ({ x, y, species: SPECIES.GRASS })),
      // Flower clusters
      ...[
        [8, 5],
        [9, 5],
        [8, 6],
        [14, 12],
        [15, 12],
        [14, 13],
        [2, 10],
        [3, 10],
        [2, 11],
      ].map(([x, y]) => ({ x, y, species: SPECIES.FLOWER })),
    ],
  },
  {
    name: "Pollinator",
    description: "Flowers with bees nearby",
    cells: [
      // Flower ring
      ...[
        [8, 8],
        [9, 8],
        [10, 8],
        [8, 9],
        [10, 9],
        [8, 10],
        [9, 10],
        [10, 10],
      ].map(([x, y]) => ({ x, y, species: SPECIES.FLOWER })),
      // Bees inside
      ...[
        [9, 9],
        [7, 8],
        [11, 10],
      ].map(([x, y]) => ({ x, y, species: SPECIES.BEE })),
      // Some grass for contrast
      ...[
        [3, 3],
        [4, 3],
        [3, 4],
        [4, 4],
        [15, 15],
        [16, 15],
        [15, 16],
        [16, 16],
      ].map(([x, y]) => ({ x, y, species: SPECIES.GRASS })),
    ],
  },
  {
    name: "Rabbit Run",
    description: "Rabbits in a field of grass",
    cells: [
      // Large grass field
      ...[
        [2, 2],
        [3, 2],
        [4, 2],
        [5, 2],
        [2, 3],
        [3, 3],
        [4, 3],
        [5, 3],
        [2, 4],
        [3, 4],
        [4, 4],
        [5, 4],
        [10, 10],
        [11, 10],
        [12, 10],
        [13, 10],
        [10, 11],
        [11, 11],
        [12, 11],
        [13, 11],
        [10, 12],
        [11, 12],
        [12, 12],
        [13, 12],
      ].map(([x, y]) => ({ x, y, species: SPECIES.GRASS })),
      // Rabbit colony
      ...[
        [7, 7],
        [8, 7],
        [7, 8],
        [8, 8],
      ].map(([x, y]) => ({ x, y, species: SPECIES.RABBIT })),
    ],
  },
  {
    name: "Ecosystem",
    description: "All four species together",
    cells: [
      // Grass patches
      ...[
        [2, 2],
        [3, 2],
        [2, 3],
        [3, 3],
        [16, 2],
        [17, 2],
        [16, 3],
        [17, 3],
        [2, 16],
        [3, 16],
        [2, 17],
        [3, 17],
        [9, 9],
        [10, 9],
        [9, 10],
        [10, 10],
      ].map(([x, y]) => ({ x, y, species: SPECIES.GRASS })),
      // Flowers
      ...[
        [7, 4],
        [8, 4],
        [7, 5],
        [8, 5],
        [12, 14],
        [13, 14],
        [12, 15],
      ].map(([x, y]) => ({ x, y, species: SPECIES.FLOWER })),
      // Bees near flowers
      ...[
        [6, 4],
        [9, 5],
      ].map(([x, y]) => ({ x, y, species: SPECIES.BEE })),
      // Rabbits near grass
      ...[
        [4, 3],
        [3, 4],
      ].map(([x, y]) => ({ x, y, species: SPECIES.RABBIT })),
    ],
  },
  {
    name: "Glider",
    description: "Classic glider pattern in grass",
    cells: [
      ...[
        [3, 2],
        [4, 3],
        [2, 4],
        [3, 4],
        [4, 4],
      ].map(([x, y]) => ({ x, y, species: SPECIES.GRASS })),
    ],
  },
]

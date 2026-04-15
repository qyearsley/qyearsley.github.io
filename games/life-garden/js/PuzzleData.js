import { SPECIES } from "./constants.js"

// Single sandbox puzzle. The budget system supports future challenge modes
// with limited seeds -- set budget values to Infinity for unlimited placement.
export const PUZZLES = [
  {
    id: "sandbox",
    name: "Life Garden",
    description: "Plant species and watch your ecosystem evolve.",
    gridWidth: 20,
    gridHeight: 20,
    budget: {
      [SPECIES.GRASS]: Infinity,
      [SPECIES.FLOWER]: Infinity,
      [SPECIES.BEE]: Infinity,
      [SPECIES.RABBIT]: Infinity,
    },
    preplacedCells: [],
    lockedCells: [],
    goals: [],
    maxGenerations: Infinity,
    hint: "",
    unlockAfter: null,
    starThresholds: { 1: 100, 2: 50, 3: 25 },
  },
]

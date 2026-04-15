// Species IDs
export const SPECIES = {
  EMPTY: 0,
  GRASS: 1,
  FLOWER: 2,
  BEE: 3,
  RABBIT: 4,
}

// Grid defaults
export const GRID = {
  DEFAULT_WIDTH: 16,
  DEFAULT_HEIGHT: 16,
  MIN_SIZE: 4,
  MAX_SIZE: 64,
}

// Simulation timing (ms between generations)
export const SPEED = {
  SLOW: 1000,
  NORMAL: 500,
  FAST: 150,
}

// Game phases
export const PHASE = {
  PLACING: "placing",
  SIMULATING: "simulating",
  PAUSED: "paused",
}

// Goal types
export const GOAL_TYPE = {
  SURVIVE: "survive",
  SUSTAIN: "sustain",
  FILL_ZONE: "fill-zone",
  REACH: "reach",
}

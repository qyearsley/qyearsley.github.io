// Species IDs.
// The placeable ones must stay sequential from 1 and in palette order: the
// palette labels its keyboard hints by position, EventManager passes the
// pressed digit straight through as a species id. FLOWERING_GRASS is a life
// stage rather than a palette entry, so it sits after them.
export const SPECIES = {
  EMPTY: 0,
  GRASS: 1,
  BEE: 2,
  RABBIT: 3,
  FOX: 4,
  FLOWERING_GRASS: 5,
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

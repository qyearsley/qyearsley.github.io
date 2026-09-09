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

// What layer a species lives on, and therefore which set of rules moves it.
// Plants are a cellular automaton on the ground. Animals are individuals that
// stand on top of the ground and move about, so a rabbit in the grass does not
// replace the grass it is standing in.
export const KIND = {
  PLANT: "plant",
  ANIMAL: "animal",
}

// Grid defaults
export const GRID = {
  DEFAULT_WIDTH: 16,
  DEFAULT_HEIGHT: 16,
  MIN_SIZE: 4,
  MAX_SIZE: 64,
}

// Seed for the simulation's generator. Fixed rather than time-based so that
// loading a preset twice gives the same run, which is what the preset tests
// assert and what makes Back replay correctly.
export const DEFAULT_SEED = 20250909

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

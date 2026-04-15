import { SPECIES } from "./constants.js"

/**
 * Species definitions. Each species is a plain data object.
 * Adding a new species = adding one object here. The simulation engine
 * and renderer handle them generically.
 *
 * Fields:
 *   id, name, emoji: identification and UI
 *   color, colorAlt: base fill and aged fill on canvas
 *   texture: drawing style ("blades", "petals", "dot", "ears")
 *   survive: neighbor counts that keep a living cell alive
 *   birth: neighbor counts that create a new cell in an empty spot
 *   neighbors: which species IDs count as "neighbors" for this species' rules
 *   priority: resolves birth conflicts (higher wins)
 *   maxAge: cell dies after this many generations (null = immortal)
 *
 * Extended rule fields (optional):
 *   killTargets: array of species IDs this species kills when adjacent count >= killThreshold
 *   killThreshold: minimum adjacent count of this species to kill a killTarget neighbor
 *   pollinates: species ID that gets a birth bonus when this species is adjacent
 *   pollinateBirth: replacement birth array for the pollinated species when bonus applies
 *   birthRequiresOwn: if true, this species can only birth where at least 1 of its own kind is adjacent
 *     (prevents spontaneous generation -- e.g. rabbits shouldn't appear from just grass)
 */
export const SPECIES_DEFS = {
  [SPECIES.GRASS]: {
    id: SPECIES.GRASS,
    name: "Grass",
    emoji: "\u{1f33f}",
    color: "#6abf69",
    colorAlt: "#4a9f49",
    texture: "blades",
    survive: [2, 3],
    birth: [3],
    neighbors: [SPECIES.GRASS, SPECIES.FLOWER],
    priority: 1,
    maxAge: null,
  },
  [SPECIES.FLOWER]: {
    id: SPECIES.FLOWER,
    name: "Flower",
    emoji: "\u{1f338}",
    color: "#e88bc4",
    colorAlt: "#c76ba4",
    texture: "petals",
    survive: [2, 3, 4],
    birth: [3],
    neighbors: [SPECIES.FLOWER],
    priority: 2,
    maxAge: 30,
  },
  [SPECIES.BEE]: {
    id: SPECIES.BEE,
    name: "Bee",
    emoji: "\u{1f41d}",
    color: "#f6c343",
    colorAlt: "#d4a017",
    texture: "dot",
    survive: [1, 2, 3],
    birth: [2],
    neighbors: [SPECIES.FLOWER, SPECIES.BEE],
    priority: 3,
    maxAge: 20,
    // Bees pollinate flowers: flowers near bees can birth at 2 instead of 3
    pollinates: SPECIES.FLOWER,
    pollinateBirth: [2, 3],
    birthRequiresOwn: true,
  },
  [SPECIES.RABBIT]: {
    id: SPECIES.RABBIT,
    name: "Rabbit",
    emoji: "\u{1f407}",
    color: "#b08968",
    colorAlt: "#8d6e53",
    texture: "ears",
    survive: [2, 3],
    birth: [3],
    neighbors: [SPECIES.GRASS, SPECIES.RABBIT],
    priority: 4,
    maxAge: 25,
    // Rabbits eat grass: grass cells adjacent to 2+ rabbits die
    killTargets: [SPECIES.GRASS],
    killThreshold: 2,
    birthRequiresOwn: true,
  },
}

export class SpeciesRegistry {
  constructor(defs = SPECIES_DEFS) {
    this.defs = {}
    for (const key of Object.keys(defs)) {
      this.defs[key] = defs[key]
    }
  }

  get(id) {
    return this.defs[id] || null
  }

  all() {
    return Object.values(this.defs)
  }

  placeable() {
    return this.all().filter((s) => s.id !== SPECIES.EMPTY)
  }

  register(def) {
    this.defs[def.id] = def
  }
}

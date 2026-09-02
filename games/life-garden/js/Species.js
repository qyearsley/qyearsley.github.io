import { SPECIES } from "./constants.js"

/**
 * Species definitions. Each species is a plain data object.
 * Adding a new species = adding one object here. The simulation engine
 * and renderer handle them generically.
 *
 * Fields:
 *   id, name, emoji: identification and UI
 *   color, colorAlt: base fill and aged fill on canvas
 *   texture: drawing style ("blades", "bloom", "dot", "ears", "snout")
 *   survive: neighbor counts that keep a living cell alive
 *   birth: neighbor counts that create a new cell in an empty spot
 *   neighbors: which species IDs count as "neighbors" for this species' rules
 *   priority: resolves birth conflicts (higher wins)
 *   maxAge: cell dies after this many generations (null = immortal)
 *
 * Extended rule fields (optional):
 *   placeable: false hides the species from the palette and from the birth loop.
 *     Reserved for life stages that only exist as a transition from another
 *     species -- see bloomsInto below.
 *   bloomsInto / bloomAge: once a surviving cell reaches bloomAge it becomes
 *     bloomsInto, keeping its age. A life stage, not a death.
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
    neighbors: [SPECIES.GRASS, SPECIES.FLOWERING_GRASS],
    priority: 1,
    maxAge: null,
    bloomsInto: SPECIES.FLOWERING_GRASS,
    bloomAge: 8,
  },
  [SPECIES.BEE]: {
    id: SPECIES.BEE,
    name: "Bee",
    emoji: "\u{1f41d}",
    color: "#f6c343",
    colorAlt: "#d4a017",
    texture: "dot",
    survive: [1, 2, 3],
    // Born on 3, not 2. Flowering grass is permanent where the old flowers
    // aged out, so a bee's food supply no longer disappears on its own -- at 2
    // a bee pair doubles every generation and takes the whole board.
    birth: [3],
    neighbors: [SPECIES.FLOWERING_GRASS, SPECIES.BEE],
    priority: 3,
    maxAge: 20,
    // Bees pollinate: grass near a bee spreads at 2 neighbours instead of 3,
    // and that grass is what goes on to bloom.
    pollinates: SPECIES.GRASS,
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
    neighbors: [SPECIES.GRASS, SPECIES.FLOWERING_GRASS, SPECIES.RABBIT],
    priority: 4,
    maxAge: 25,
    // Rabbits eat grass at either life stage: 2+ adjacent rabbits and it dies
    killTargets: [SPECIES.GRASS, SPECIES.FLOWERING_GRASS],
    killThreshold: 2,
    birthRequiresOwn: true,
  },
  [SPECIES.FOX]: {
    id: SPECIES.FOX,
    name: "Fox",
    emoji: "\u{1f98a}",
    color: "#e2703a",
    colorAlt: "#b4501f",
    texture: "snout",
    // Deliberately scarce and slow. Birth on exactly 4 is the main brake: it
    // takes a real concentration of rabbits before another fox appears, so
    // foxes stay at a few percent of the board while rabbits run to a third of
    // it. maxAge is the other brake -- foxes count each other as neighbours, so
    // without it a fox pair would sit there forever after the rabbits are gone.
    survive: [1, 2, 3],
    birth: [4],
    neighbors: [SPECIES.RABBIT, SPECIES.FOX],
    priority: 5,
    maxAge: 45,
    // Foxes eat rabbits, but it takes three of them to corner one
    killTargets: [SPECIES.RABBIT],
    killThreshold: 3,
    birthRequiresOwn: true,
  },
  [SPECIES.FLOWERING_GRASS]: {
    id: SPECIES.FLOWERING_GRASS,
    name: "Flowering grass",
    emoji: "\u{1f338}",
    color: "#e07ab8",
    colorAlt: "#c05a98",
    texture: "bloom",
    // Same rules as grass -- the bloom is a life stage, not a different plant,
    // so a meadow does not change behaviour the moment it flowers.
    survive: [2, 3],
    birth: [3],
    neighbors: [SPECIES.GRASS, SPECIES.FLOWERING_GRASS],
    priority: 2,
    maxAge: null,
    // Only reachable by grass reaching bloomAge, never placed or born
    placeable: false,
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

  /**
   * Species the player can put on the grid, which is also the set the engine
   * lets be born. Life stages (`placeable: false`) are excluded from both.
   */
  placeable() {
    return this.all().filter((s) => s.id !== SPECIES.EMPTY && s.placeable !== false)
  }

  register(def) {
    this.defs[def.id] = def
  }
}

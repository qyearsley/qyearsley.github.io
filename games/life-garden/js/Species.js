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
 *   survive: neighbor counts that keep a living cell alive, or null for a
 *     species whose neighbours do not decide survival. A consumer counts its
 *     food (see neighbors), and food must not double as a crowding limit --
 *     with survive: [2, 3] a rabbit in the middle of a meadow died of crowding
 *     on 4 blades of grass, which is why the food chain never got going. A
 *     species with survive: null dies of maxAge or of being eaten, nothing else.
 *   birth: neighbor counts that create a new cell in an empty spot
 *   neighbors: which species IDs count as "neighbors" for this species' rules.
 *     For the plants that is their own kind, Conway-style. For a consumer it is
 *     what it eats, so the count decides where the next one is born rather than
 *     how crowded this one is.
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
    // The bee keeps bloom in its own neighbour count, unlike the rabbit and the
    // fox. It pollinates rather than eats, so the flowers it sits among stay
    // there, and counting them is what lets a colony ride a spreading meadow.
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
    // A rabbit counts grass, and only grass: the count says how much there is
    // to eat, not how crowded the rabbit is. It used to count other rabbits too
    // against a survive of [2, 3], so a rabbit surrounded by food died of it and
    // no prey boom could ever form. Now a rabbit dies of maxAge or of a fox.
    survive: null,
    birth: [2, 3],
    neighbors: [SPECIES.GRASS, SPECIES.FLOWERING_GRASS],
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
    // Same shape as the rabbit one level up: the fox counts rabbits, so the
    // count is how much prey is about. Birth on 3 keeps it rare -- it takes a
    // knot of rabbits before another fox appears -- and maxAge is what stops a
    // fox sitting in an empty field forever. The old rules had the fox counting
    // other foxes against survive [1, 2, 3] and birth [4], which made it either
    // a self-sustaining blob or, without its own kind, dead in five generations;
    // neither followed the rabbits.
    survive: null,
    birth: [3],
    neighbors: [SPECIES.RABBIT],
    priority: 5,
    maxAge: 45,
    // One fox is enough to catch a rabbit. It took three while the fox was a
    // blob, and rabbits move too thinly through a grazed field for three of
    // them ever to line up, so the predator never actually ate anything.
    killTargets: [SPECIES.RABBIT],
    killThreshold: 1,
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

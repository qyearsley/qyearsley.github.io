import { SPECIES, KIND } from "./constants.js"

/**
 * Species definitions. Each species is a plain data object, and the engine
 * reads whatever fields it carries.
 *
 * There are two kinds, and they are moved by two different sets of rules.
 *
 * PLANTS are a cellular automaton on the ground layer -- Conway's Game of Life,
 * which is what this game started as. They do not move. A plant's behaviour is
 * its neighbour counts, plus a life stage, plus a small chance of creeping into
 * the bare ground beside it.
 *
 *   survive: neighbour counts that keep a living plant alive. Grass is 1-3,
 *     not Conway's 2-3, and that one number is the biggest departure in the
 *     game -- see the note under GRASS.
 *   birth: neighbour counts that grow a new plant on bare ground
 *   neighbors: which species IDs count towards those two numbers
 *   sproutChance: per-generation chance this plant sprouts grass in any one
 *     bare cell beside it. The chances of the neighbours add up. This is the
 *     only source of grass Conway's rule cannot produce, and without it a
 *     grazed patch could never come back.
 *   bloomsInto / bloomAge: a plant that reaches bloomAge becomes bloomsInto,
 *     with its age reset so the new stage can time itself
 *   revertsTo / bloomDuration: the way back. A bloom is temporary; when it ends
 *     the plant drops to revertsTo and can grow towards blooming again.
 *   eatenBecomes: what is left when an animal grazes this plant. A bloom is
 *     knocked back to grass, grass is grazed down to bare ground.
 *   placeable: false hides a life stage from the palette and from the birth
 *     loop, so it can only be reached by ageing
 *   fadeAge: the age at which the cell has faded fully from color to colorAlt.
 *     Cosmetic, but it makes "about to change stage" visible.
 *
 * ANIMALS are individuals standing on top of the ground layer. Each one carries
 * a single number, its energy, and every turn it does the same four things:
 * spend a point of energy, step towards the nearest food it can see, eat what
 * it lands on, and split in two if it is full. It dies when its energy runs out.
 *
 *   eats: species IDs this animal will move towards and eat
 *   sight: how many cells away it can spot food (Chebyshev distance, so a
 *     square rather than a circle -- it matches the 8-way movement)
 *   gain: energy per meal
 *   digest: generations after a meal before it will look for another. This is
 *     the brake on the whole food chain. Without it an animal eats every cell
 *     it stands on, so grazing scales with how many animals there are rather
 *     than with what they need, and the rabbits strip the board and starve as
 *     one long before anything can grow back.
 *   breedAt: energy at which it splits in two, sharing its energy with the young
 *   startEnergy: energy a newly placed animal begins with, which is also how
 *     long it survives with nothing to eat
 *   fears / fearSight: species this animal runs from, and how far away it
 *     notices them. Always shorter than the hunter's own sight, so a fox can
 *     get close before it is spotted -- two animals of the same speed can
 *     never close the gap, so prey that saw as far as the predator would
 *     never be caught at all.
 *   arriveChance / arriveNeeds: the chance per generation that one arrives at
 *     the edge of the board from outside, and how much of its food has to be
 *     growing there already for it to bother. Plants use `arriveChance` too --
 *     seeds blow in. See `Grid._arrivals`: a board this size cannot hold a food
 *     chain up on its own.
 *   grazes: false if eating leaves the plant standing. Only the bee, which
 *     takes nectar rather than the flower.
 *   sproutBonus: how much this animal multiplies the sprouting chance of the
 *     bare ground beside it. The bee's whole contribution.
 *
 * Note what is not here any more. Animals have no `survive`, no `birth`, no
 * `priority`, no `maxAge`, and no kill thresholds. Those were all attempts to
 * make a neighbour count behave like hunger, and the fox in particular needed
 * three of them plus a page of justification. One energy counter replaces the
 * lot: a fox is rare because prey is rare, not because its birth rule was tuned
 * to be hard to satisfy.
 */
export const SPECIES_DEFS = {
  [SPECIES.GRASS]: {
    id: SPECIES.GRASS,
    name: "Grass",
    emoji: "\u{1f33f}",
    kind: KIND.PLANT,
    color: "#6abf69",
    colorAlt: "#4a9f49",
    texture: "blades",
    // Conway's rule is B3/S23. This is B3/S0123: the birth rule is untouched and
    // grass is still crowded out by four neighbours, but a lone blade no longer
    // dies of loneliness.
    //
    // That one change is what makes the food chain possible, and it was not a
    // free choice. Under S23 a grazed meadow unravels: taking a cell drops its
    // neighbours' counts, the ones left on a single neighbour die too, and the
    // collapse runs ahead of anything that could grow back. Every attempt to
    // patch around it failed -- regrowth from roots, seeds scattered from
    // blooms, faster sprouting -- because whatever grew into the gap was
    // isolated and died the next generation. Measured over a few thousand runs,
    // no combination of the other numbers kept grass, rabbits and foxes alive
    // together for 600 generations while S23 was in force, and every S123 run
    // that passed did so comfortably.
    //
    // The cost is the Conway patterns: a glider under S123 grows into a blob
    // instead of gliding, and a blinker does not blink.
    survive: [0, 1, 2, 3],
    birth: [3],
    neighbors: [SPECIES.GRASS, SPECIES.FLOWERING_GRASS],
    sproutChance: 0.008,
    // Seeds blow in over the fence. Without this a board grazed to nothing
    // stays bare for good, because grass only ever sprouts beside grass.
    arriveChance: 0.08,
    bloomsInto: SPECIES.FLOWERING_GRASS,
    bloomAge: 8,
    eatenBecomes: SPECIES.EMPTY,
    fadeAge: 8,
  },
  [SPECIES.BEE]: {
    id: SPECIES.BEE,
    name: "Bee",
    emoji: "\u{1f41d}",
    kind: KIND.ANIMAL,
    color: "#f6c343",
    colorAlt: "#d4a017",
    texture: "dot",
    // A bee lives on the bloom and pays its way: grass beside a working bee
    // sprouts six times as fast, which is how a meadow reaches ground the
    // birth rule alone would never get to.
    eats: [SPECIES.FLOWERING_GRASS],
    sight: 5,
    gain: 12,
    digest: 4,
    breedAt: 26,
    startEnergy: 13,
    arriveChance: 0.03,
    arriveNeeds: 6,
    grazes: false,
    sproutBonus: 6,
  },
  [SPECIES.RABBIT]: {
    id: SPECIES.RABBIT,
    name: "Rabbit",
    emoji: "\u{1f407}",
    kind: KIND.ANIMAL,
    color: "#b08968",
    colorAlt: "#8d6e53",
    texture: "ears",
    eats: [SPECIES.GRASS, SPECIES.FLOWERING_GRASS],
    sight: 4,
    gain: 16,
    digest: 9,
    breedAt: 88,
    startEnergy: 44,
    // Notices a fox three cells off, which is closer than the fox's own four
    // and deliberately so: see `fears` above.
    fears: [SPECIES.FOX],
    fearSight: 3,
    arriveChance: 0.02,
    arriveNeeds: 12,
  },
  [SPECIES.FOX]: {
    id: SPECIES.FOX,
    name: "Fox",
    emoji: "\u{1f98a}",
    kind: KIND.ANIMAL,
    color: "#e2703a",
    colorAlt: "#b4501f",
    texture: "snout",
    // A big meal and a long one to digest, and far more energy needed before it
    // breeds. Nothing declares the fox rare; it is rare because rabbits are.
    eats: [SPECIES.RABBIT],
    sight: 4,
    gain: 40,
    digest: 14,
    breedAt: 80,
    startEnergy: 40,
    arriveChance: 0.01,
    arriveNeeds: 4,
  },
  [SPECIES.FLOWERING_GRASS]: {
    id: SPECIES.FLOWERING_GRASS,
    name: "Flowering grass",
    emoji: "\u{1f338}",
    kind: KIND.PLANT,
    color: "#e07ab8",
    colorAlt: "#c05a98",
    texture: "bloom",
    // The same neighbour rules as grass -- the bloom is a life stage, not a
    // different plant, so a meadow does not change behaviour the moment it
    // flowers. What is different is that it ends, and that it spreads harder
    // while it lasts. A bloom that never ended is what used to leave every
    // board as a handful of frozen pink squares.
    survive: [0, 1, 2, 3],
    birth: [3],
    neighbors: [SPECIES.GRASS, SPECIES.FLOWERING_GRASS],
    sproutChance: 0.032,
    revertsTo: SPECIES.GRASS,
    bloomDuration: 6,
    eatenBecomes: SPECIES.GRASS,
    fadeAge: 6,
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

  /** Every plant, life stages included. */
  plants() {
    return this.all().filter((s) => s.kind === KIND.PLANT)
  }

  /** Every animal. */
  animals() {
    return this.all().filter((s) => s.kind === KIND.ANIMAL)
  }

  register(def) {
    this.defs[def.id] = def
  }
}

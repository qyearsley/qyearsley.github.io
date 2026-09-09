import { describe, test, expect } from "@jest/globals"
import { SPECIES } from "../js/constants.js"
import { SPECIES_DEFS, SpeciesRegistry } from "../js/Species.js"
import { Grid } from "../js/Grid.js"
import { Random } from "../js/Random.js"

const GRASS = SPECIES_DEFS[SPECIES.GRASS]
const BLOOM = SPECIES_DEFS[SPECIES.FLOWERING_GRASS]
const RABBIT = SPECIES_DEFS[SPECIES.RABBIT]
const FOX = SPECIES_DEFS[SPECIES.FOX]

/**
 * A generator with the randomness taken out of it.
 *
 * Sprouting, wandering, arrivals and the order the animals act in all come from
 * here, and none of them are what most of these tests are about. `next` is
 * pinned so no chance fires (1) or every chance fires (0), and choices always
 * take the first option.
 *
 * It has to be a real Random: `Grid` wraps anything that is not one in
 * `new Random(...)`, so a plain stub object would be silently replaced by a
 * live generator seeded 0 the first time `step()` cloned it.
 *
 * @param {number} value - What `next()` always returns
 */
function fixedRandom(value) {
  const rng = new Random(1)
  rng.next = () => value
  rng.int = (n) => Math.floor(n / 2)
  rng.pick = (items) => (items.length ? items[0] : null)
  rng.shuffle = (items) => items
  rng.clone = () => fixedRandom(value)
  return rng
}

/** A grid on which no chance ever fires, so only the certain rules run. */
function makeGrid(width, height, defs = SPECIES_DEFS) {
  return new Grid(width, height, new SpeciesRegistry(defs), fixedRandom(1))
}

/** Only the plants, for checking the automaton without animals in the way. */
function makePlantGrid(width, height) {
  const plantDefs = {}
  for (const [key, def] of Object.entries(SPECIES_DEFS)) {
    if (def.id === SPECIES.GRASS || def.id === SPECIES.FLOWERING_GRASS) plantDefs[key] = def
  }
  return makeGrid(width, height, plantDefs)
}

/** A 2x2 block: each cell has exactly 3 neighbours. */
function block(grid, x, y, species) {
  for (const [dx, dy] of [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ]) {
    grid.setCell(x + dx, y + dy, species)
  }
}

describe("Grid basics", () => {
  test("initializes empty", () => {
    expect(makeGrid(4, 4).countLiving()).toBe(0)
  })

  test("a plant goes on the ground and an animal stands on top", () => {
    const grid = makeGrid(4, 4)
    grid.setCell(1, 2, SPECIES.GRASS)
    grid.setCell(1, 2, SPECIES.RABBIT)
    expect(grid.getPlant(1, 2).species).toBe(SPECIES.GRASS)
    expect(grid.getAnimal(1, 2).species).toBe(SPECIES.RABBIT)
    expect(grid.countLiving()).toBe(2)
  })

  test("an animal starts with its species' energy", () => {
    const grid = makeGrid(4, 4)
    grid.setCell(1, 1, SPECIES.FOX)
    expect(grid.getAnimal(1, 1).energy).toBe(FOX.startEnergy)
  })

  test("out of bounds reads are null and writes are ignored", () => {
    const grid = makeGrid(4, 4)
    expect(grid.getPlant(-1, 0)).toBeNull()
    expect(grid.getAnimal(4, 0)).toBeNull()
    grid.setCell(-1, 0, SPECIES.GRASS)
    expect(grid.countLiving()).toBe(0)
  })

  test("clearing takes the top layer first", () => {
    // Clicking a rabbit standing in grass should take the rabbit you can see,
    // not the grass underneath it.
    const grid = makeGrid(4, 4)
    grid.setCell(1, 1, SPECIES.GRASS)
    grid.setCell(1, 1, SPECIES.RABBIT)

    grid.clearCell(1, 1)
    expect(grid.getAnimal(1, 1)).toBeNull()
    expect(grid.getPlant(1, 1).species).toBe(SPECIES.GRASS)

    grid.clearCell(1, 1)
    expect(grid.getPlant(1, 1).species).toBe(SPECIES.EMPTY)
  })

  test("isOccupied sees both layers", () => {
    const grid = makeGrid(4, 4)
    expect(grid.isOccupied(1, 1)).toBe(false)
    grid.setCell(1, 1, SPECIES.RABBIT)
    expect(grid.isOccupied(1, 1)).toBe(true)
    grid.clearCell(1, 1)
    grid.setCell(1, 1, SPECIES.GRASS)
    expect(grid.isOccupied(1, 1)).toBe(true)
  })

  test("countSpecies and countNeighbors span both layers", () => {
    const grid = makeGrid(6, 6)
    grid.setCell(2, 2, SPECIES.GRASS)
    grid.setCell(3, 2, SPECIES.GRASS)
    grid.setCell(2, 3, SPECIES.RABBIT)
    expect(grid.countSpecies(SPECIES.GRASS)).toBe(2)
    expect(grid.countSpecies(SPECIES.RABBIT)).toBe(1)
    expect(grid.countNeighbors(3, 3, [SPECIES.GRASS])).toBe(2)
    expect(grid.countNeighbors(3, 3, [SPECIES.RABBIT])).toBe(1)
  })

  test("countSpeciesInZone clamps to the board", () => {
    const grid = makeGrid(4, 4)
    grid.setCell(3, 3, SPECIES.GRASS)
    expect(grid.countSpeciesInZone(SPECIES.GRASS, { x: 2, y: 2, w: 10, h: 10 })).toBe(1)
  })

  test("clone is independent on both layers", () => {
    const grid = makeGrid(4, 4)
    grid.setCell(1, 1, SPECIES.GRASS)
    grid.setCell(2, 2, SPECIES.RABBIT)
    const copy = grid.clone()
    copy.clearCell(1, 1)
    copy.getAnimal(2, 2).energy = 1
    expect(grid.getPlant(1, 1).species).toBe(SPECIES.GRASS)
    expect(grid.getAnimal(2, 2).energy).toBe(RABBIT.startEnergy)
  })

  test("step returns a new grid and leaves this one alone", () => {
    const grid = makePlantGrid(6, 6)
    grid.setCell(2, 2, SPECIES.GRASS)
    grid.step()
    expect(grid.getPlant(2, 2).species).toBe(SPECIES.GRASS)
  })
})

describe("plants: the cellular automaton", () => {
  test("bare ground with exactly 3 neighbours grows grass", () => {
    const grid = makePlantGrid(6, 6)
    for (const [x, y] of [
      [2, 2],
      [3, 2],
      [4, 2],
    ]) {
      grid.setCell(x, y, SPECIES.GRASS)
    }
    expect(grid.step().getPlant(3, 3).species).toBe(SPECIES.GRASS)
  })

  test("2 neighbours are not enough to grow anything", () => {
    const grid = makePlantGrid(6, 6)
    grid.setCell(2, 2, SPECIES.GRASS)
    grid.setCell(4, 2, SPECIES.GRASS)
    expect(grid.step().getPlant(3, 3).species).toBe(SPECIES.EMPTY)
  })

  test("a plant with 4 or more neighbours is crowded out", () => {
    const grid = makePlantGrid(6, 6)
    for (const [x, y] of [
      [2, 2],
      [3, 2],
      [4, 2],
      [2, 3],
      [4, 3],
      [3, 3],
    ]) {
      grid.setCell(x, y, SPECIES.GRASS)
    }
    // (3,3) has five neighbours
    expect(grid.step().getPlant(3, 3).species).toBe(SPECIES.EMPTY)
  })

  test("a lone blade of grass lives on", () => {
    // The one departure from Conway, and the reason the food chain works at
    // all: under B3/S23 a grazed meadow unravels from the inside and no seed
    // that lands on open ground can ever take.
    const grid = makePlantGrid(6, 6)
    grid.setCell(3, 3, SPECIES.GRASS)
    expect(grid.step().getPlant(3, 3).species).toBe(SPECIES.GRASS)
  })

  test("a block of 4 is stable", () => {
    const grid = makePlantGrid(6, 6)
    block(grid, 2, 2, SPECIES.GRASS)
    expect(grid.step().countSpecies(SPECIES.GRASS)).toBe(4)
  })

  test("grass blooms at the bloom age and the bloom then ends", () => {
    const grid = makePlantGrid(6, 6)
    block(grid, 2, 2, SPECIES.GRASS)

    let next = grid
    for (let i = 0; i < GRASS.bloomAge - 1; i++) next = next.step()
    expect(next.getPlant(2, 2).species).toBe(SPECIES.GRASS)

    next = next.step()
    expect(next.getPlant(2, 2).species).toBe(SPECIES.FLOWERING_GRASS)
    // The stage times itself from its own start
    expect(next.getPlant(2, 2).age).toBe(0)

    for (let i = 0; i < BLOOM.bloomDuration; i++) next = next.step()
    expect(next.getPlant(2, 2).species).toBe(SPECIES.GRASS)
  })

  test("a bloomed block cycles rather than freezing", () => {
    // The old bloom was permanent, which is why every board settled into a
    // handful of pink squares and stayed there.
    const grid = makePlantGrid(6, 6)
    block(grid, 2, 2, SPECIES.GRASS)
    let next = grid
    const seen = new Set()
    for (let i = 0; i < 40; i++) {
      next = next.step()
      seen.add(next.getPlant(2, 2).species)
    }
    expect(seen).toEqual(new Set([SPECIES.GRASS, SPECIES.FLOWERING_GRASS]))
  })

  test("the bloom counts as a neighbour for grass", () => {
    const grid = makePlantGrid(6, 6)
    for (const [x, y] of [
      [2, 2],
      [3, 2],
      [4, 2],
    ]) {
      grid.setCell(x, y, SPECIES.FLOWERING_GRASS)
    }
    expect(grid.step().getPlant(3, 3).species).toBe(SPECIES.GRASS)
  })

  test("flowering grass is never born, only reached by ageing", () => {
    const grid = makePlantGrid(6, 6)
    for (const [x, y] of [
      [2, 2],
      [3, 2],
      [4, 2],
    ]) {
      grid.setCell(x, y, SPECIES.FLOWERING_GRASS)
    }
    expect(grid.step().getPlant(3, 3).species).not.toBe(SPECIES.FLOWERING_GRASS)
  })

  test("sprouting adds the chances of the neighbouring plants", () => {
    const grid = makeGrid(6, 6)
    grid.setCell(2, 2, SPECIES.GRASS)
    grid.setCell(4, 2, SPECIES.GRASS)
    expect(grid._sproutChance(3, 3)).toBeCloseTo(GRASS.sproutChance * 2)
    expect(grid._sproutChance(0, 5)).toBe(0)
  })

  test("a bloom seeds the ground beside it harder than plain grass", () => {
    const grid = makeGrid(6, 6)
    grid.setCell(2, 2, SPECIES.GRASS)
    const plain = grid._sproutChance(3, 3)
    grid.setCell(2, 2, SPECIES.FLOWERING_GRASS)
    expect(grid._sproutChance(3, 3)).toBeGreaterThan(plain)
  })

  test("a bee multiplies whatever the chance was", () => {
    const grid = makeGrid(6, 6)
    grid.setCell(2, 2, SPECIES.GRASS)
    const without = grid._sproutChance(3, 3)
    grid.setCell(2, 3, SPECIES.BEE)
    expect(grid._sproutChance(3, 3)).toBeCloseTo(without * SPECIES_DEFS[SPECIES.BEE].sproutBonus)
  })

  test("a bee over bare ground still sprouts nothing", () => {
    // The bonus multiplies; it does not create. Bees do not grow grass.
    const grid = makeGrid(6, 6)
    grid.setCell(3, 3, SPECIES.BEE)
    expect(grid._sproutChance(2, 2)).toBe(0)
  })
})

describe("animals: energy, hunger and movement", () => {
  test("an animal spends a point of energy every generation", () => {
    const grid = makeGrid(8, 8)
    grid.setCell(4, 4, SPECIES.FOX)
    const before = grid.getAnimal(4, 4).energy
    const after = grid.step()
    expect(after.countSpecies(SPECIES.FOX)).toBe(1)
    let energy = null
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (after.getAnimal(x, y)) energy = after.getAnimal(x, y).energy
      }
    }
    expect(energy).toBe(before - 1)
  })

  test("an animal that runs out of energy dies", () => {
    const grid = makeGrid(8, 8)
    grid.setCell(4, 4, SPECIES.FOX)
    grid.getAnimal(4, 4).energy = 1
    expect(grid.step().countSpecies(SPECIES.FOX)).toBe(0)
  })

  test("a rabbit eats the grass it is standing on", () => {
    const grid = makeGrid(8, 8)
    grid.setCell(4, 4, SPECIES.GRASS)
    grid.setCell(4, 4, SPECIES.RABBIT)
    grid.getAnimal(4, 4).energy = 10

    const next = grid.step()
    expect(next.getPlant(4, 4).species).toBe(SPECIES.EMPTY)
    expect(next.getAnimal(4, 4).energy).toBe(10 - 1 + RABBIT.gain)
  })

  test("grazing a bloom sets it back to grass rather than killing it", () => {
    const grid = makeGrid(8, 8)
    grid.setCell(4, 4, SPECIES.FLOWERING_GRASS)
    grid.setCell(4, 4, SPECIES.RABBIT)
    expect(grid.step().getPlant(4, 4).species).toBe(SPECIES.GRASS)
  })

  test("a full animal leaves the food alone while it digests", () => {
    const grid = makeGrid(8, 8)
    grid.setCell(4, 4, SPECIES.GRASS)
    grid.setCell(5, 4, SPECIES.GRASS)
    grid.setCell(4, 4, SPECIES.RABBIT)
    grid.getAnimal(4, 4).full = RABBIT.digest

    const next = grid.step()
    expect(next.countSpecies(SPECIES.GRASS)).toBe(2)
  })

  test("a hungry rabbit walks towards grass it can see", () => {
    const grid = makeGrid(9, 9)
    grid.setCell(4, 4, SPECIES.RABBIT)
    grid.setCell(7, 4, SPECIES.GRASS)
    const next = grid.step()
    expect(next.getAnimal(5, 4)?.species).toBe(SPECIES.RABBIT)
  })

  test("a rabbit ignores grass beyond its sight", () => {
    const grid = makeGrid(20, 3)
    grid.setCell(0, 1, SPECIES.RABBIT)
    grid.setCell(19, 1, SPECIES.GRASS)
    // Nothing in range, so it wanders rather than beelining for the far corner
    const next = grid.step()
    expect(next.getAnimal(1, 1)?.species).toBeUndefined()
  })

  test("a fox catches a rabbit by moving into its cell", () => {
    const grid = makeGrid(8, 8)
    grid.setCell(3, 3, SPECIES.FOX)
    grid.setCell(4, 4, SPECIES.RABBIT)
    // Hungry enough that the meal does not immediately make it split
    grid.getAnimal(3, 3).energy = 5

    const next = grid.step()
    expect(next.countSpecies(SPECIES.RABBIT)).toBe(0)
    expect(next.getAnimal(4, 4)?.species).toBe(SPECIES.FOX)
    expect(next.getAnimal(4, 4).energy).toBe(5 - 1 + FOX.gain)
  })

  test("a rabbit runs from a fox instead of grazing", () => {
    // The grass is on the fox's side, so a rabbit that ignored the fox would
    // move towards it. Flight is what gives prey any refuge at all.
    const grid = makeGrid(11, 11)
    grid.setCell(5, 5, SPECIES.RABBIT)
    grid.setCell(3, 5, SPECIES.FOX)
    grid.setCell(4, 5, SPECIES.GRASS)

    const next = grid.step()
    expect(next.getAnimal(6, 5)?.species).toBe(SPECIES.RABBIT)
    expect(next.getPlant(4, 5).species).toBe(SPECIES.GRASS)
  })

  test("a rabbit does not notice a fox beyond its fear range", () => {
    const grid = makeGrid(15, 3)
    grid.setCell(8, 1, SPECIES.RABBIT)
    grid.setCell(0, 1, SPECIES.FOX)
    grid.setCell(9, 1, SPECIES.GRASS)
    // Fox is 8 cells off, well past fearSight, so the rabbit gets on with lunch
    expect(grid.step().getPlant(9, 1).species).toBe(SPECIES.EMPTY)
  })

  test("a well-fed animal splits in two and shares its energy", () => {
    const grid = makeGrid(8, 8)
    grid.setCell(4, 4, SPECIES.RABBIT)
    grid.getAnimal(4, 4).energy = RABBIT.breedAt + 1
    grid.getAnimal(4, 4).full = RABBIT.digest

    const next = grid.step()
    expect(next.countSpecies(SPECIES.RABBIT)).toBe(2)
    let total = 0
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (next.getAnimal(x, y)) total += next.getAnimal(x, y).energy
      }
    }
    expect(total).toBe(RABBIT.breedAt)
  })

  test("energy stops at the breeding threshold", () => {
    // An animal hemmed in with nowhere to put its young would otherwise bank
    // energy forever and become effectively immortal.
    const grid = makeGrid(8, 8)
    grid.setCell(4, 4, SPECIES.GRASS)
    grid.setCell(4, 4, SPECIES.RABBIT)
    grid.getAnimal(4, 4).energy = RABBIT.breedAt

    const next = grid.step()
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const animal = next.getAnimal(x, y)
        if (animal) expect(animal.energy).toBeLessThanOrEqual(RABBIT.breedAt)
      }
    }
  })

  test("two animals never end up in the same cell", () => {
    const grid = new Grid(6, 6, new SpeciesRegistry())
    for (let y = 1; y < 5; y++) {
      for (let x = 1; x < 5; x++) grid.setCell(x, y, SPECIES.RABBIT)
    }
    let next = grid
    for (let i = 0; i < 20; i++) {
      next = next.step()
      let cells = 0
      for (let y = 0; y < 6; y++) {
        for (let x = 0; x < 6; x++) if (next.getAnimal(x, y)) cells++
      }
      expect(cells).toBe(next.countSpecies(SPECIES.RABBIT))
    }
  })
})

describe("rules that hold for species that do not exist yet", () => {
  // The engine is data-driven -- Species.js promises it "reads whatever fields
  // it carries" -- so these paths are wrong for a species nobody has written
  // yet even though the shipped four never reach them. Each one was a real bug.

  /** The stock definitions with one species overridden. */
  function withDefs(id, changes) {
    const defs = {}
    for (const [key, def] of Object.entries(SPECIES_DEFS)) defs[key] = { ...def }
    defs[id] = { ...defs[id], ...changes }
    return defs
  }

  test("an omnivore takes one meal a turn, not two", () => {
    // `_moveTo` feeds on prey it lands on and `_eatPlant` feeds on the plant in
    // that cell. A species that ate both used to take both in one generation.
    const defs = withDefs(SPECIES.FOX, { eats: [SPECIES.RABBIT, SPECIES.GRASS] })
    const grid = makeGrid(8, 8, defs)
    grid.setCell(3, 3, SPECIES.FOX)
    grid.setCell(4, 4, SPECIES.RABBIT)
    grid.setCell(4, 4, SPECIES.GRASS)
    grid.getAnimal(3, 3).energy = 5

    const next = grid.step()
    expect(next.countSpecies(SPECIES.RABBIT)).toBe(0)
    // The rabbit only: the grass it was standing on survives the same turn
    expect(next.getPlant(4, 4).species).toBe(SPECIES.GRASS)
    expect(next.getAnimal(4, 4).energy).toBe(5 - 1 + SPECIES_DEFS[SPECIES.FOX].gain)
  })

  /**
   * A board where the fox is afraid of the bee, and the only way directly away
   * from the bee is over a rabbit.
   *
   * The bee is stood on a bloom so it has food underfoot and does not wander:
   * a threat that moves changes the escape direction, and then the flight never
   * crosses the prey at all.
   */
  function corneredFox(full) {
    const defs = withDefs(SPECIES.FOX, { fears: [SPECIES.BEE], fearSight: 3 })
    const grid = makeGrid(9, 9, defs)
    grid.setCell(3, 4, SPECIES.FLOWERING_GRASS)
    grid.setCell(3, 4, SPECIES.BEE)
    grid.setCell(4, 4, SPECIES.FOX)
    grid.setCell(5, 4, SPECIES.RABBIT)
    grid.getAnimal(4, 4).full = full
    return grid
  }

  /** The one fox left on the board. */
  function findFox(grid) {
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const animal = grid.getAnimal(x, y)
        if (animal?.species === SPECIES.FOX) return animal
      }
    }
    return null
  }

  test("running away is not hunting", () => {
    // Flight went through the same move as a hunt, so an animal that fled over
    // its own food ate it -- while digesting, which is meant to be the brake on
    // the whole chain.
    const next = corneredFox(SPECIES_DEFS[SPECIES.FOX].digest).step()
    expect(next.countSpecies(SPECIES.RABBIT)).toBe(1)
  })

  test("digesting counts down once, however the turn goes", () => {
    // Every branch of a turn has to tick the counter exactly once. The flee
    // branch used to decrement after moving rather than before, which was only
    // observable when the flight itself fed the animal -- no longer possible
    // now that running away cannot hunt, so this pins the invariant rather
    // than that particular bug.
    expect(findFox(corneredFox(5).step()).full).toBe(4)
  })

  test("a meal never costs an animal energy", () => {
    // `_feed` clamped to breedAt without a floor, so a species that starts with
    // more energy than it needs to breed was cut down by its first meal.
    const defs = withDefs(SPECIES.RABBIT, { startEnergy: 120, breedAt: 88 })
    const grid = makeGrid(8, 8, defs)
    grid.setCell(4, 4, SPECIES.GRASS)
    grid.setCell(4, 4, SPECIES.RABBIT)

    const next = grid.step()
    let total = 0
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (next.getAnimal(x, y)) total += next.getAnimal(x, y).energy
      }
    }
    // It bred, so the energy is split, but none of it was thrown away
    expect(total).toBe(119)
  })
})

describe("arrivals from outside the garden", () => {
  /** A grid whose every chance fires, so arrivals happen without waiting. */
  function alwaysArrives(width, height) {
    return new Grid(width, height, new SpeciesRegistry(), fixedRandom(0))
  }

  test("seeds blow in even onto an empty board", () => {
    // Grass only sprouts beside grass, so without this a board grazed to
    // nothing would stay bare for good.
    expect(alwaysArrives(8, 8).step().countSpecies(SPECIES.GRASS)).toBeGreaterThan(0)
  })

  test("an animal that has never lived here does not turn up", () => {
    // Otherwise loading a board with no foxes would eventually grow foxes,
    // which is the whole point of having the same field with and without them.
    const grid = alwaysArrives(8, 8)
    for (let x = 0; x < 8; x++) grid.setCell(x, 3, SPECIES.GRASS)
    let next = grid
    for (let i = 0; i < 30; i++) next = next.step()
    expect(next.countSpecies(SPECIES.RABBIT)).toBe(0)
    expect(next.countSpecies(SPECIES.FOX)).toBe(0)
  })

  test("a kind that has lived here comes back after dying out", () => {
    const grid = alwaysArrives(8, 8)
    for (let x = 0; x < 8; x++) grid.setCell(x, 3, SPECIES.GRASS)
    grid.setCell(0, 0, SPECIES.RABBIT)
    grid.getAnimal(0, 0).energy = 1 // starves on the first step

    const first = grid.step()
    expect(first.residents.has(SPECIES.RABBIT)).toBe(true)
    let next = first
    for (let i = 0; i < 20; i++) next = next.step()
    expect(next.countSpecies(SPECIES.RABBIT)).toBeGreaterThan(0)
  })

  test("a predator does not walk into an empty field", () => {
    const grid = alwaysArrives(8, 8)
    grid.setCell(0, 0, SPECIES.FOX)
    grid.getAnimal(0, 0).energy = 1
    let next = grid.step()
    for (let i = 0; i < 20; i++) next = next.step()
    expect(next.countSpecies(SPECIES.FOX)).toBe(0)
  })
})

describe("the run is reproducible", () => {
  test("the same seed gives the same generation", () => {
    const build = () => {
      const grid = new Grid(12, 12, new SpeciesRegistry(), 4242)
      for (const [x, y] of [
        [3, 3],
        [4, 3],
        [5, 3],
        [4, 4],
      ]) {
        grid.setCell(x, y, SPECIES.GRASS)
      }
      grid.setCell(6, 6, SPECIES.RABBIT)
      return grid
    }
    const shape = (grid) => {
      const rows = []
      for (let y = 0; y < grid.height; y++) {
        const row = []
        for (let x = 0; x < grid.width; x++) {
          row.push(`${grid.getPlant(x, y).species}${grid.getAnimal(x, y)?.species ?? ""}`)
        }
        rows.push(row.join(","))
      }
      return rows.join("|")
    }

    let a = build()
    let b = build()
    for (let i = 0; i < 40; i++) {
      a = a.step()
      b = b.step()
    }
    expect(shape(a)).toBe(shape(b))
  })

  test("different seeds diverge", () => {
    const build = (seed) => {
      const grid = new Grid(12, 12, new SpeciesRegistry(), seed)
      for (let x = 2; x < 10; x++) grid.setCell(x, 5, SPECIES.GRASS)
      return grid
    }
    let a = build(1)
    let b = build(2)
    for (let i = 0; i < 60; i++) {
      a = a.step()
      b = b.step()
    }
    expect(a.countSpecies(SPECIES.GRASS)).not.toBe(b.countSpecies(SPECIES.GRASS))
  })

  test("a grid carries its generator forward, so rewinding rewinds the luck", () => {
    // game.js keeps old grids for Back. Stepping an old one again has to replay
    // the same run, or Back and Step would not agree.
    const grid = new Grid(10, 10, new SpeciesRegistry(), 99)
    for (let x = 1; x < 9; x++) grid.setCell(x, 5, SPECIES.GRASS)
    const once = grid.step()
    const twice = grid.step()
    expect(once.countSpecies(SPECIES.GRASS)).toBe(twice.countSpecies(SPECIES.GRASS))
  })
})

import { describe, test, expect } from "@jest/globals"
import { SPECIES, KIND } from "../js/constants.js"
import { SPECIES_DEFS, SpeciesRegistry } from "../js/Species.js"

const GRASS = SPECIES_DEFS[SPECIES.GRASS]
const BLOOM = SPECIES_DEFS[SPECIES.FLOWERING_GRASS]
const BEE = SPECIES_DEFS[SPECIES.BEE]
const RABBIT = SPECIES_DEFS[SPECIES.RABBIT]
const FOX = SPECIES_DEFS[SPECIES.FOX]

describe("SPECIES_DEFS", () => {
  test("every species id has a definition", () => {
    for (const id of Object.values(SPECIES)) {
      if (id === SPECIES.EMPTY) continue
      expect(SPECIES_DEFS[id]).toBeDefined()
    }
  })

  test("placeable ids run 1..n in palette order", () => {
    // The palette numbers its keyboard hints by position while EventManager
    // passes the digit through as a species id, so the two must line up.
    expect(new SpeciesRegistry().placeable().map((s) => s.id)).toEqual([1, 2, 3, 4])
  })

  test("every species is a plant or an animal, and carries the fields for it", () => {
    for (const def of Object.values(SPECIES_DEFS)) {
      expect([KIND.PLANT, KIND.ANIMAL]).toContain(def.kind)
      if (def.kind === KIND.PLANT) {
        expect(Array.isArray(def.survive)).toBe(true)
        expect(Array.isArray(def.birth)).toBe(true)
      } else {
        for (const field of ["eats", "sight", "gain", "digest", "breedAt", "startEnergy"]) {
          expect(def[field]).toBeDefined()
        }
      }
    }
  })

  test("every species has a texture", () => {
    for (const def of Object.values(SPECIES_DEFS)) expect(def.texture).toBeDefined()
  })
})

describe("the plants", () => {
  test("grass is born on 3, exactly as in Conway", () => {
    expect(GRASS.birth).toEqual([3])
  })

  test("grass dies only of crowding, which is the one break with Conway", () => {
    // B3/S23 would be Conway. This is B3/S0123: the birth rule is untouched and
    // four neighbours still crowd a plant out, but a lone blade lives. Under
    // S23 a grazed meadow unravels from the inside -- taking one cell drops its
    // neighbours' counts and the collapse outruns anything that could grow
    // back -- and no blade that lands on open ground can ever take.
    expect(GRASS.survive).toEqual([0, 1, 2, 3])
    expect(GRASS.survive).not.toContain(4)
  })

  test("the bloom is a life stage, so it shares grass's neighbour rules", () => {
    expect(BLOOM.survive).toEqual(GRASS.survive)
    expect(BLOOM.birth).toEqual(GRASS.birth)
    expect(BLOOM.neighbors).toEqual(GRASS.neighbors)
  })

  test("grass and its bloom count each other as neighbours", () => {
    for (const def of [GRASS, BLOOM]) {
      expect(def.neighbors).toContain(SPECIES.GRASS)
      expect(def.neighbors).toContain(SPECIES.FLOWERING_GRASS)
    }
  })

  test("blooming is a round trip, not a dead end", () => {
    // A bloom that never ended is what left every board as frozen pink squares.
    expect(GRASS.bloomsInto).toBe(SPECIES.FLOWERING_GRASS)
    expect(GRASS.bloomAge).toBeGreaterThan(0)
    expect(BLOOM.revertsTo).toBe(SPECIES.GRASS)
    expect(BLOOM.bloomDuration).toBeGreaterThan(0)
  })

  test("flowering grass is a life stage, never placed directly", () => {
    expect(BLOOM.placeable).toBe(false)
  })

  test("a bloom seeds the ground beside it harder than plain grass", () => {
    expect(BLOOM.sproutChance).toBeGreaterThan(GRASS.sproutChance)
  })

  test("grazing sets a plant back one stage rather than always clearing it", () => {
    expect(BLOOM.eatenBecomes).toBe(SPECIES.GRASS)
    expect(GRASS.eatenBecomes).toBe(SPECIES.EMPTY)
  })

  test("seeds blow in, so a stripped board is never dead for good", () => {
    expect(GRASS.arriveChance).toBeGreaterThan(0)
  })
})

describe("the animals", () => {
  test("each eats the level below it and nothing else", () => {
    expect(BEE.eats).toEqual([SPECIES.FLOWERING_GRASS])
    expect(RABBIT.eats).toEqual([SPECIES.GRASS, SPECIES.FLOWERING_GRASS])
    expect(FOX.eats).toEqual([SPECIES.RABBIT])
  })

  test("none of them has a neighbour rule or a lifespan", () => {
    // The old animals were cellular automata too, which needed `survive`,
    // `birth`, `priority`, `maxAge` and a kill threshold each, plus a page of
    // justification for the fox. One energy counter replaced the lot.
    for (const def of [BEE, RABBIT, FOX]) {
      for (const gone of ["survive", "birth", "priority", "maxAge", "killTargets"]) {
        expect(def[gone]).toBeUndefined()
      }
    }
  })

  test("a meal is worth more than the digesting costs", () => {
    // Energy drains a point a generation, so gain has to beat digest or the
    // animal starves however much food it finds.
    for (const def of [BEE, RABBIT, FOX]) {
      expect(def.gain).toBeGreaterThan(def.digest)
    }
  })

  test("an animal starts on about half of what it needs to breed", () => {
    for (const def of [BEE, RABBIT, FOX]) {
      expect(def.startEnergy).toBeLessThan(def.breedAt)
      expect(def.startEnergy * 2).toBeGreaterThanOrEqual(def.breedAt - 1)
    }
  })

  test("the fox is the scarcest link: a bigger meal, and longer over it", () => {
    expect(FOX.gain).toBeGreaterThan(RABBIT.gain)
    expect(FOX.digest).toBeGreaterThan(RABBIT.digest)
  })

  test("a rabbit notices a fox later than the fox notices the rabbit", () => {
    // Both move a cell a generation, so prey that saw as far as its hunter
    // could never be caught and the fox would starve beside a full field.
    expect(RABBIT.fears).toEqual([SPECIES.FOX])
    expect(RABBIT.fearSight).toBeLessThan(FOX.sight)
  })

  test("only the fox is feared, and only the rabbit is afraid", () => {
    expect(BEE.fears).toBeUndefined()
    expect(FOX.fears).toBeUndefined()
  })

  test("the bee takes nectar and leaves the flower", () => {
    // It is the only one that does not graze. A bee that ate the bloom would
    // undo most of its own pollinating, because a bloom is the best seeder on
    // the board.
    expect(BEE.grazes).toBe(false)
    expect(BEE.sproutBonus).toBeGreaterThan(1)
    expect(RABBIT.grazes).not.toBe(false)
    expect(FOX.grazes).not.toBe(false)
  })

  test("a predator will not wander in without prey already there", () => {
    for (const def of [BEE, RABBIT, FOX]) {
      expect(def.arriveChance).toBeGreaterThan(0)
      expect(def.arriveNeeds).toBeGreaterThan(0)
    }
  })
})

describe("SpeciesRegistry", () => {
  test("gets species by id", () => {
    const registry = new SpeciesRegistry()
    expect(registry.get(SPECIES.GRASS).name).toBe("Grass")
    expect(registry.get(SPECIES.FOX).name).toBe("Fox")
  })

  test("returns null for unknown id", () => {
    expect(new SpeciesRegistry().get(99)).toBeNull()
  })

  test("all() includes the life stage", () => {
    expect(new SpeciesRegistry().all()).toHaveLength(5)
  })

  test("placeable() excludes EMPTY and life stages", () => {
    const placeable = new SpeciesRegistry().placeable()
    expect(placeable.map((s) => s.id)).not.toContain(SPECIES.EMPTY)
    expect(placeable.map((s) => s.id)).not.toContain(SPECIES.FLOWERING_GRASS)
    expect(placeable).toHaveLength(4)
  })

  test("plants() and animals() split the whole list between them", () => {
    const registry = new SpeciesRegistry()
    expect(registry.plants().map((s) => s.id)).toEqual([SPECIES.GRASS, SPECIES.FLOWERING_GRASS])
    expect(registry.animals().map((s) => s.id)).toEqual([SPECIES.BEE, SPECIES.RABBIT, SPECIES.FOX])
    expect(registry.plants().length + registry.animals().length).toBe(registry.all().length)
  })

  test("register() adds new species", () => {
    const registry = new SpeciesRegistry()
    registry.register({ id: 99, name: "Tree", kind: KIND.PLANT, survive: [0, 1, 2], birth: [3] })
    expect(registry.get(99).name).toBe("Tree")
    expect(registry.all()).toHaveLength(6)
    expect(registry.plants()).toHaveLength(3)
  })
})

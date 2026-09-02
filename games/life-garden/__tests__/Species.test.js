import { describe, test, expect } from "@jest/globals"
import { SPECIES } from "../js/constants.js"
import { SPECIES_DEFS, SpeciesRegistry } from "../js/Species.js"

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
    const ids = new SpeciesRegistry().placeable().map((s) => s.id)
    expect(ids).toEqual([1, 2, 3, 4])
  })

  test("grass and its bloom count each other as neighbours", () => {
    // Otherwise a meadow would fall apart the moment it flowered.
    for (const id of [SPECIES.GRASS, SPECIES.FLOWERING_GRASS]) {
      expect(SPECIES_DEFS[id].neighbors).toContain(SPECIES.GRASS)
      expect(SPECIES_DEFS[id].neighbors).toContain(SPECIES.FLOWERING_GRASS)
    }
  })

  test("bloom is a life stage, so it shares grass's rules", () => {
    const grass = SPECIES_DEFS[SPECIES.GRASS]
    const bloom = SPECIES_DEFS[SPECIES.FLOWERING_GRASS]
    expect(bloom.survive).toEqual(grass.survive)
    expect(bloom.neighbors).toEqual(grass.neighbors)
    expect(bloom.maxAge).toBe(grass.maxAge)
  })

  test("grass blooms into flowering grass", () => {
    const grass = SPECIES_DEFS[SPECIES.GRASS]
    expect(grass.bloomsInto).toBe(SPECIES.FLOWERING_GRASS)
    expect(grass.bloomAge).toBeGreaterThan(0)
  })

  test("flowering grass is a life stage, never placed directly", () => {
    expect(SPECIES_DEFS[SPECIES.FLOWERING_GRASS].placeable).toBe(false)
  })

  test("grass is immortal, the animals are not", () => {
    expect(SPECIES_DEFS[SPECIES.GRASS].maxAge).toBeNull()
    expect(SPECIES_DEFS[SPECIES.FLOWERING_GRASS].maxAge).toBeNull()
    expect(SPECIES_DEFS[SPECIES.BEE].maxAge).toBe(20)
    expect(SPECIES_DEFS[SPECIES.RABBIT].maxAge).toBe(25)
    expect(SPECIES_DEFS[SPECIES.FOX].maxAge).toBe(45)
  })

  test("bees live on the bloom and pollinate the grass that makes it", () => {
    const bee = SPECIES_DEFS[SPECIES.BEE]
    expect(bee.neighbors).toContain(SPECIES.FLOWERING_GRASS)
    expect(bee.pollinates).toBe(SPECIES.GRASS)
    expect(bee.pollinateBirth).toContain(2)
  })

  test("rabbits eat grass at either life stage", () => {
    const rabbit = SPECIES_DEFS[SPECIES.RABBIT]
    expect(rabbit.killTargets).toEqual(
      expect.arrayContaining([SPECIES.GRASS, SPECIES.FLOWERING_GRASS]),
    )
    expect(rabbit.killThreshold).toBe(2)
  })

  test("foxes eat rabbits", () => {
    const fox = SPECIES_DEFS[SPECIES.FOX]
    expect(fox.killTargets).toEqual([SPECIES.RABBIT])
    expect(fox.killThreshold).toBe(3)
    expect(fox.birthRequiresOwn).toBe(true)
  })

  test("the fox is the scarcest and slowest of the animals", () => {
    const fox = SPECIES_DEFS[SPECIES.FOX]
    const rabbit = SPECIES_DEFS[SPECIES.RABBIT]
    // Harder to be born than its prey, and longer-lived
    expect(Math.min(...fox.birth)).toBeGreaterThan(Math.min(...rabbit.birth))
    expect(fox.maxAge).toBeGreaterThan(rabbit.maxAge)
    // Top of the chain, so it wins birth conflicts
    expect(fox.priority).toBeGreaterThan(rabbit.priority)
  })

  test("priority orders the chain: fox > rabbit > bee > plants", () => {
    const p = (id) => SPECIES_DEFS[id].priority
    expect(p(SPECIES.FOX)).toBeGreaterThan(p(SPECIES.RABBIT))
    expect(p(SPECIES.RABBIT)).toBeGreaterThan(p(SPECIES.BEE))
    expect(p(SPECIES.BEE)).toBeGreaterThan(p(SPECIES.FLOWERING_GRASS))
    expect(p(SPECIES.FLOWERING_GRASS)).toBeGreaterThan(p(SPECIES.GRASS))
  })

  test("each species has a texture", () => {
    for (const def of Object.values(SPECIES_DEFS)) {
      expect(def.texture).toBeDefined()
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

  test("register() adds new species", () => {
    const registry = new SpeciesRegistry()
    registry.register({
      id: 99,
      name: "Tree",
      survive: [1, 2, 3, 4],
      birth: [3],
      neighbors: [99],
      priority: 6,
      maxAge: null,
    })
    expect(registry.get(99).name).toBe("Tree")
    expect(registry.all()).toHaveLength(6)
  })
})

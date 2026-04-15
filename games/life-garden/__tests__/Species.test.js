import { describe, test, expect } from "@jest/globals"
import { SPECIES } from "../js/constants.js"
import { SPECIES_DEFS, SpeciesRegistry } from "../js/Species.js"

describe("SPECIES_DEFS", () => {
  test("all four species are defined", () => {
    expect(SPECIES_DEFS[SPECIES.GRASS]).toBeDefined()
    expect(SPECIES_DEFS[SPECIES.FLOWER]).toBeDefined()
    expect(SPECIES_DEFS[SPECIES.BEE]).toBeDefined()
    expect(SPECIES_DEFS[SPECIES.RABBIT]).toBeDefined()
  })

  test("grass counts both grass and flowers as neighbors", () => {
    const grass = SPECIES_DEFS[SPECIES.GRASS]
    expect(grass.neighbors).toContain(SPECIES.GRASS)
    expect(grass.neighbors).toContain(SPECIES.FLOWER)
  })

  test("flowers only count flowers as neighbors", () => {
    const flower = SPECIES_DEFS[SPECIES.FLOWER]
    expect(flower.neighbors).toEqual([SPECIES.FLOWER])
  })

  test("grass is immortal, others have max age", () => {
    expect(SPECIES_DEFS[SPECIES.GRASS].maxAge).toBeNull()
    expect(SPECIES_DEFS[SPECIES.FLOWER].maxAge).toBe(30)
    expect(SPECIES_DEFS[SPECIES.BEE].maxAge).toBe(20)
    expect(SPECIES_DEFS[SPECIES.RABBIT].maxAge).toBe(25)
  })

  test("bees pollinate flowers", () => {
    const bee = SPECIES_DEFS[SPECIES.BEE]
    expect(bee.pollinates).toBe(SPECIES.FLOWER)
    expect(bee.pollinateBirth).toContain(2)
  })

  test("rabbits kill grass", () => {
    const rabbit = SPECIES_DEFS[SPECIES.RABBIT]
    expect(rabbit.killTargets).toContain(SPECIES.GRASS)
    expect(rabbit.killThreshold).toBe(2)
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
    expect(registry.get(SPECIES.BEE).name).toBe("Bee")
  })

  test("returns null for unknown id", () => {
    const registry = new SpeciesRegistry()
    expect(registry.get(99)).toBeNull()
  })

  test("all() returns all species", () => {
    const registry = new SpeciesRegistry()
    expect(registry.all()).toHaveLength(4)
  })

  test("placeable() excludes EMPTY", () => {
    const registry = new SpeciesRegistry()
    const placeable = registry.placeable()
    expect(placeable.every((s) => s.id !== SPECIES.EMPTY)).toBe(true)
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
      priority: 5,
      maxAge: null,
    })
    expect(registry.get(99).name).toBe("Tree")
    expect(registry.all()).toHaveLength(5)
  })
})

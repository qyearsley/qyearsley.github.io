/**
 * Tests for the Seasons character roster.
 *
 * Two things matter here. First, the roster is data, so the tests assert its
 * shape rather than any behaviour: four animals, unique ids, readable copy, and
 * an `effects` object that carries every key of DEFAULT_EFFECTS. That last
 * check is the one that catches a new effect field being added to constants.js
 * without the merge in characters.js picking it up.
 *
 * Second, `getCharacter` deliberately falls back to DEFAULT_CHARACTER rather
 * than returning null, because the id comes off a save file that an older build
 * may have written. That fallback is covered for every kind of bad input.
 */

import { describe, expect, it } from "@jest/globals"
import { DEFAULT_EFFECTS } from "../js/constants.js"
import {
  CHARACTER_IDS,
  CHARACTERS,
  DEFAULT_CHARACTER,
  getCharacter,
  getEffects,
} from "../js/characters.js"

/**
 * The roster as it stands, in display order.
 *
 * The one deliberately hard-coded list in this file, and the only line to touch
 * when Ella adds an animal. Everything below sweeps `CHARACTERS` itself, so a
 * fifth character costs exactly this edit -- the pin is here so that adding one
 * is a decision someone confirms, not a shape check thirty tests re-litigate.
 */
const EXPECTED_IDS = ["banana-slug", "sloth", "phoenix", "porcupine"]

/** Every id actually on the roster, for the sweeps below. */
const ROSTER_IDS = CHARACTERS.map((character) => character.id)

/** How long the roster is at load, for proving a failed write did not grow it. */
const ROSTER_SIZE = CHARACTERS.length

/** Every key a merged effects object must have. */
const EFFECT_KEYS = Object.keys(DEFAULT_EFFECTS)

describe("the roster", () => {
  it("has exactly the expected characters, in display order", () => {
    expect(ROSTER_IDS).toEqual(EXPECTED_IDS)
  })

  it("has unique ids", () => {
    const ids = CHARACTERS.map((character) => character.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("exposes the same ids through CHARACTER_IDS", () => {
    expect([...CHARACTER_IDS].sort()).toEqual([...ROSTER_IDS].sort())
    expect(CHARACTER_IDS.size).toBe(CHARACTERS.length)
  })

  it("defaults to the first character", () => {
    expect(DEFAULT_CHARACTER).toBe(CHARACTERS[0])
    expect(DEFAULT_CHARACTER.id).toBe("banana-slug")
  })

  it.each(ROSTER_IDS)("%s has readable copy", (id) => {
    const character = getCharacter(id)
    for (const field of ["name", "perkName", "perkText"]) {
      expect(typeof character[field]).toBe("string")
      expect(character[field].trim().length).toBeGreaterThan(0)
    }
    // costText is allowed to be empty -- a free perk says nothing about cost.
    expect(typeof character.costText).toBe("string")
  })

  it.each(ROSTER_IDS)("%s has an effects object with every default key", (id) => {
    const { effects } = getCharacter(id)
    expect(effects).not.toBeNull()
    expect(typeof effects).toBe("object")
    // Not a subset check: a new field in DEFAULT_EFFECTS that the merge misses,
    // or a stray field that no default covers, both fail here.
    expect(Object.keys(effects).sort()).toEqual([...EFFECT_KEYS].sort())
  })

  it.each(ROSTER_IDS)("%s matches the type of every default effect", (id) => {
    const { effects } = getCharacter(id)
    for (const key of EFFECT_KEYS) {
      expect(typeof effects[key]).toBe(typeof DEFAULT_EFFECTS[key])
    }
  })

  it("merges effects over the defaults, so an override leaves the rest alone", () => {
    // The Sloth overrides extraSeconds and nothing else.
    const sloth = getCharacter("sloth")
    expect(sloth.effects.extraSeconds).toBe(10)
    expect(sloth.effects.noTimer).toBe(DEFAULT_EFFECTS.noTimer)
    expect(sloth.effects.hintsPerSeason).toBe(DEFAULT_EFFECTS.hintsPerSeason)
    expect(sloth.effects.skipsExtra).toBe(DEFAULT_EFFECTS.skipsExtra)
  })

  it("gives an overriding character the defaults for everything else", () => {
    const slug = getCharacter("banana-slug")
    expect(slug.effects).toEqual({ ...DEFAULT_EFFECTS, noTimer: true })
  })

  it("does not share one effects object between characters", () => {
    const objects = CHARACTERS.map((character) => character.effects)
    expect(new Set(objects).size).toBe(objects.length)
    expect(objects).not.toContain(DEFAULT_EFFECTS)
  })
})

describe("immutability", () => {
  it("freezes the roster array", () => {
    expect(Object.isFrozen(CHARACTERS)).toBe(true)
    // ESM is strict mode, so a write to a frozen object throws rather than
    // failing quietly; either way the roster must come out unchanged.
    expect(() => CHARACTERS.push({ id: "unicorn" })).toThrow(TypeError)
    expect(() => {
      CHARACTERS[0] = { id: "unicorn" }
    }).toThrow(TypeError)
    expect(CHARACTERS).toHaveLength(ROSTER_SIZE)
    expect(CHARACTERS[0].id).toBe(DEFAULT_CHARACTER.id)
  })

  it.each(ROSTER_IDS)("freezes %s and its effects", (id) => {
    const character = getCharacter(id)
    expect(Object.isFrozen(character)).toBe(true)
    expect(Object.isFrozen(character.effects)).toBe(true)

    const originalName = character.name
    const originalSeconds = character.effects.extraSeconds
    expect(() => {
      character.name = "Hacked"
    }).toThrow(TypeError)
    expect(() => {
      character.effects.extraSeconds = 99
    }).toThrow(TypeError)
    expect(() => {
      character.effects.newField = 1
    }).toThrow(TypeError)

    expect(character.name).toBe(originalName)
    expect(character.effects.extraSeconds).toBe(originalSeconds)
    expect("newField" in character.effects).toBe(false)
  })

  it("hands out the same frozen effects object on every lookup", () => {
    expect(getEffects("phoenix")).toBe(getCharacter("phoenix").effects)
    expect(getEffects("phoenix")).toBe(getEffects("phoenix"))
  })
})

describe("getCharacter", () => {
  it.each(ROSTER_IDS)("returns %s for its own id", (id) => {
    expect(getCharacter(id).id).toBe(id)
    expect(getCharacter(id)).toBe(CHARACTERS.find((character) => character.id === id))
  })

  it.each([
    ["an unknown id", "unicorn"],
    ["null", null],
    ["undefined", undefined],
    ["a number", 3],
    ["zero", 0],
    ["an empty string", ""],
    ["an object", {}],
    ["an array", []],
    ["true", true],
    ["a near-miss id", "Banana-Slug"],
  ])("falls back to the default character for %s", (_label, id) => {
    expect(getCharacter(id)).toBe(DEFAULT_CHARACTER)
  })
})

describe("getEffects", () => {
  // Written out in full rather than compared to `getCharacter(id).effects`.
  // getEffects *is* that expression, so the old assertion was `x === x` and said
  // nothing about the merge its name promises. These rows are the merge: each
  // character's own overrides plus the DEFAULT_EFFECTS values it never mentions.
  // Written out in full: these are the merge results, not a re-derivation of
  // it. A new character does not need a row -- add one only if its perk is
  // worth pinning.
  it.each([
    ["banana-slug", { extraSeconds: 0, noTimer: true, hintsPerSeason: 0, skipsExtra: false }],
    ["sloth", { extraSeconds: 10, noTimer: false, hintsPerSeason: 0, skipsExtra: false }],
    ["phoenix", { extraSeconds: 0, noTimer: false, hintsPerSeason: 1, skipsExtra: false }],
    ["porcupine", { extraSeconds: 0, noTimer: false, hintsPerSeason: 0, skipsExtra: true }],
  ])("returns the merged effects for %s", (id, expected) => {
    expect(getEffects(id)).toEqual(expected)
  })

  it.each([
    ["an unknown id", "unicorn"],
    ["null", null],
    ["undefined", undefined],
    ["a number", 3],
    ["an empty string", ""],
    ["an object", {}],
    ["an array", []],
    ["true", true],
  ])("returns the default character's effects for %s", (_label, id) => {
    // `toBe` on the shared frozen object, which is stronger than checking the
    // result is non-null and carries every key: it pins the identity too.
    expect(getEffects(id)).toBe(DEFAULT_CHARACTER.effects)
  })
})

describe("balance", () => {
  it("gives each animal exactly one perk", () => {
    // One field per animal is the shape the roster was rebuilt to on
    // 2026-09-21, and it is what keeps the cards readable: a card that lists
    // two perks and no cost is a card nobody compares.
    for (const character of CHARACTERS) {
      const changed = EFFECT_KEYS.filter((key) => character.effects[key] !== DEFAULT_EFFECTS[key])
      expect([character.id, changed.length]).toEqual([character.id, 1])
    }
  })

  it("charges nobody a cost", () => {
    // Every perk is free now. The costs were priced against an item penalty
    // that no longer exists, so a card claiming one would be describing a rule
    // the game does not have.
    for (const character of CHARACTERS) {
      expect([character.id, character.costText]).toEqual([character.id, ""])
    }
  })

  it("lets no perk change what a space pays", () => {
    // The alignment in seasons.js depends on this: a demand equal to what the
    // trail pays cannot survive a character who collects a different amount.
    for (const character of CHARACTERS) {
      expect(character.effects).not.toHaveProperty("glowingItems")
      expect(character.effects).not.toHaveProperty("itemsPerSpace")
    }
  })

  it("exercises every effect field on at least one character", () => {
    // If no character differs from the default for a field, the code in
    // GameState that reads it is untested by play.
    for (const key of EFFECT_KEYS) {
      const differs = CHARACTERS.some(
        (character) => character.effects[key] !== DEFAULT_EFFECTS[key],
      )
      expect([key, differs]).toEqual([key, true])
    }
  })
})

/**
 * Tests for five-readings.js -- data and lookup helpers for the
 * "One Character, Five Readings" page.
 */

import { CHARACTERS, GROUPS, findCharacter, findGroup, charactersInGroup } from "./five-readings.js"

describe("CHARACTERS data integrity", () => {
  test("has between 15 and 25 characters, per the page's scope", () => {
    expect(CHARACTERS.length).toBeGreaterThanOrEqual(15)
    expect(CHARACTERS.length).toBeLessThanOrEqual(25)
  })

  test("has no duplicate hanzi", () => {
    const seen = new Set(CHARACTERS.map((c) => c.hanzi))
    expect(seen.size).toBe(CHARACTERS.length)
  })

  test("every character has a non-empty reading in each language", () => {
    for (const c of CHARACTERS) {
      expect(c.mandarin).toBeTruthy()
      expect(c.cantonese).toBeTruthy()
      expect(c.japanese).toBeTruthy()
      expect(c.korean.hangul).toBeTruthy()
      expect(c.korean.romanization).toBeTruthy()
      expect(c.vietnamese).toBeTruthy()
      expect(c.meaning).toBeTruthy()
    }
  })

  test("every character's group is a known group id", () => {
    const groupIds = new Set(GROUPS.map((g) => g.id))
    for (const c of CHARACTERS) {
      expect(groupIds.has(c.group)).toBe(true)
    }
  })
})

describe("findCharacter", () => {
  test("finds a known character by hanzi", () => {
    const result = findCharacter("學")
    expect(result).toBeDefined()
    expect(result.mandarin).toBe("xué")
    expect(result.cantonese).toBe("hok6")
    expect(result.japanese).toBe("gaku")
    expect(result.korean.romanization).toBe("hak")
    expect(result.vietnamese).toBe("học")
  })

  test("returns undefined for a hanzi not in the list", () => {
    expect(findCharacter("愛")).toBeUndefined()
  })

  test("returns undefined for an empty string", () => {
    expect(findCharacter("")).toBeUndefined()
  })
})

describe("findGroup", () => {
  test("finds a known group by id", () => {
    const result = findGroup("m")
    expect(result).toBeDefined()
    expect(result.label).toBe("-m merges into -n")
  })

  test("returns undefined for an unknown group id", () => {
    expect(findGroup("nope")).toBeUndefined()
  })
})

describe("charactersInGroup", () => {
  test("returns only characters in the requested group", () => {
    const result = charactersInGroup("k")
    expect(result.length).toBeGreaterThan(0)
    for (const c of result) {
      expect(c.group).toBe("k")
    }
  })

  test("returns an empty array for an unknown group id", () => {
    expect(charactersInGroup("nope")).toEqual([])
  })

  test("groups partition all characters with no overlap", () => {
    const total = GROUPS.reduce((sum, g) => sum + charactersInGroup(g.id).length, 0)
    expect(total).toBe(CHARACTERS.length)
  })
})

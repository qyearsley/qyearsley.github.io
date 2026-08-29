/**
 * Tests for the Seasons challenge registry (js/challenges/index.js).
 *
 * The registry is the seam between a season and what it asks the player to do,
 * so these tests cover the two things that seam promises: a lookup returns a
 * module honouring the `generate` / `check` contract, and an unknown type falls
 * back to arithmetic rather than returning null -- loudly, via console.warn, so
 * a typo in seasons.js does not stay invisible.
 *
 * The last test is the one with teeth: every season in seasons.js must name a
 * challenge type that is actually registered. Without it a typo would only show
 * up as a warning in the console during play.
 */

import { describe, expect, it, jest } from "@jest/globals"
import { challengeTypes, DEFAULT_CHALLENGE, getChallenge } from "../js/challenges/index.js"
import * as arithmetic from "../js/challenges/arithmetic.js"
import { PLAY } from "../js/constants.js"
import { createRng } from "../js/rng.js"
import { SEASON_LIST } from "../js/seasons.js"

/**
 * Run a function with console.warn silenced and recorded.
 * @param {Function} body - Called with no arguments
 * @returns {{result: *, warnings: string[][]}} The return value and the calls
 */
function withSilencedWarn(body) {
  const spy = jest.spyOn(console, "warn").mockImplementation(() => {})
  try {
    return { result: body(), warnings: spy.mock.calls }
  } finally {
    spy.mockRestore()
  }
}

describe("challenges registry", () => {
  describe("challengeTypes", () => {
    it("includes arithmetic", () => {
      expect(challengeTypes()).toContain("arithmetic")
    })

    it("returns a non-empty list of distinct strings", () => {
      const types = challengeTypes()
      expect(types.length).toBeGreaterThan(0)
      expect(new Set(types).size).toBe(types.length)
      for (const type of types) {
        expect(typeof type).toBe("string")
      }
    })

    it("includes the default challenge type", () => {
      expect(challengeTypes()).toContain(DEFAULT_CHALLENGE)
      expect(DEFAULT_CHALLENGE).toBe("arithmetic")
    })

    it("returns a fresh array each call, so a caller cannot corrupt the registry", () => {
      const first = challengeTypes()
      const second = challengeTypes()
      expect(first).not.toBe(second)
      expect(first).toEqual(second)
      first.push("mutated")
      expect(challengeTypes()).not.toContain("mutated")
    })
  })

  describe("getChallenge", () => {
    it("returns a module with both generate and check for the arithmetic type", () => {
      const challenge = getChallenge("arithmetic")
      expect(typeof challenge.generate).toBe("function")
      expect(typeof challenge.check).toBe("function")
      expect(challenge.generate).toBe(arithmetic.generate)
      expect(challenge.check).toBe(arithmetic.check)
    })

    it("returns a module for every registered type", () => {
      for (const type of challengeTypes()) {
        const challenge = getChallenge(type)
        expect(typeof challenge.generate).toBe("function")
        expect(typeof challenge.check).toBe("function")
      }
    })

    it("does not warn for a known type", () => {
      const { warnings } = withSilencedWarn(() => getChallenge("arithmetic"))
      expect(warnings).toEqual([])
    })

    it("falls back to arithmetic for an unknown type, and warns", () => {
      const { result, warnings } = withSilencedWarn(() => getChallenge("mathsy"))
      expect(result.generate).toBe(arithmetic.generate)
      expect(result.check).toBe(arithmetic.check)
      expect(warnings).toHaveLength(1)
      expect(String(warnings[0][0])).toContain("mathsy")
      expect(String(warnings[0][0])).toContain("falling back to arithmetic")
    })

    it("falls back and warns for every non-string and empty input", () => {
      for (const bad of [undefined, null, 42, "", "Arithmetic", {}, [], true]) {
        const { result, warnings } = withSilencedWarn(() => getChallenge(bad))
        expect(typeof result.generate).toBe("function")
        expect(typeof result.check).toBe("function")
        expect(result.generate).toBe(arithmetic.generate)
        expect(warnings).toHaveLength(1)
      }
    })

    it("does not resolve inherited Object properties as challenge types", () => {
      for (const bad of ["toString", "constructor", "hasOwnProperty", "__proto__"]) {
        const { result } = withSilencedWarn(() => getChallenge(bad))
        expect(result.generate).toBe(arithmetic.generate)
      }
    })

    it("returns a module whose generate and check work together", () => {
      const { generate, check } = getChallenge("arithmetic")
      const question = generate(SEASON_LIST[0].forms, createRng("registry"))
      expect(typeof question.prompt).toBe("string")
      expect(question.prompt.length).toBeGreaterThan(0)
      expect(question.choices).toHaveLength(PLAY.CHOICE_COUNT)
      expect(question.choices).toContain(question.answer)
      expect(check(question, question.answer)).toBe(true)
      expect(check(question, question.answer + 1)).toBe(false)
    })
  })

  describe("season definitions", () => {
    it("every season names a registered challenge type", () => {
      const types = challengeTypes()
      for (const season of SEASON_LIST) {
        expect(typeof season.challenge).toBe("string")
        expect(types).toContain(season.challenge)
      }
    })

    it("every season's forms work with the module its challenge names", () => {
      for (const season of SEASON_LIST) {
        const { generate, check } = getChallenge(season.challenge)
        for (const [label, forms] of [
          ["forms", season.forms],
          ["glowingForms", season.glowingForms],
          ["boss.forms", season.boss.forms],
        ]) {
          const question = generate(forms, createRng(`${season.id}-${label}`))
          expect(question.choices).toHaveLength(PLAY.CHOICE_COUNT)
          expect(check(question, question.answer)).toBe(true)
        }
      }
    })
  })
})

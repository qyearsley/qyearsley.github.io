/**
 * Tests for the Seasons RNG.
 *
 * What is being protected here is reproducibility, not statistical quality.
 * mulberry32 is gameplay randomness, so these tests assert three things: a seed
 * pins a sequence, the bounds `int` advertises are the bounds it produces, and
 * no seed at all -- missing, non-finite, zero, or a string -- can yield NaN or a
 * generator stuck on a single value. The distribution of `next` is deliberately
 * not tested; the only fairness claim made about it is that `int` can actually
 * reach both ends of its range, which is a correctness property rather than a
 * statistical one.
 *
 * `shuffle` is the exception, because there the distribution *is* the
 * correctness property: the two usual Fisher-Yates off-by-ones produce a
 * shuffle that reorders, preserves the multiset, and is deterministic, so
 * nothing short of counting orderings can see them. See the bias test at the
 * end of the file for how that is kept deterministic.
 *
 * Two non-obvious decisions:
 *
 * - The golden first draws for a fixed seed are recorded from this
 *   implementation rather than derived independently. They exist to make
 *   swapping the algorithm a deliberate, visible break: a bug report is
 *   reproduced from a seed alone, so a silent change to `_toSeed` or to the
 *   mixing round would quietly invalidate every seed anyone has written down.
 * - Sample counts are large (2000 draws over a three-value range) so a
 *   bound-exclusion bug fails every run rather than intermittently. Missing an
 *   endpoint by luck has probability (2/3)^2000, which is zero in practice.
 *
 * Note the intentional collisions covered below: seed 0, NaN, undefined, null
 * and 1 all normalize to the same 32-bit state, because `_toSeed` maps anything
 * unusable to 1. That is the documented behaviour, so it is asserted rather than
 * worked around.
 */

import { describe, expect, it } from "@jest/globals"
import { createRng } from "../js/rng.js"

/** Draw `count` floats from a generator. */
function draws(rng, count) {
  return Array.from({ length: count }, () => rng.next())
}

/** Draw `count` integers in [min, max] from a generator. */
function intDraws(rng, count, min, max) {
  return Array.from({ length: count }, () => rng.int(min, max))
}

describe("createRng", () => {
  describe("determinism", () => {
    it("gives an identical sequence for the same numeric seed", () => {
      expect(draws(createRng(12345), 50)).toEqual(draws(createRng(12345), 50))
    })

    it("gives an identical sequence for the same string seed", () => {
      expect(draws(createRng("spring-1"), 50)).toEqual(draws(createRng("spring-1"), 50))
    })

    it("diverges for different numeric seeds", () => {
      const a = draws(createRng(1), 20)
      const b = draws(createRng(2), 20)
      expect(a).not.toEqual(b)
      // Not just a different ordering of the same values: no overlap at all.
      expect(a.some((value, index) => value === b[index])).toBe(false)
    })

    it("diverges for different string seeds", () => {
      expect(draws(createRng("spring"), 20)).not.toEqual(draws(createRng("summer"), 20))
      // One character apart, so a weak hash that ignored position would collide.
      expect(draws(createRng("spring-1"), 20)).not.toEqual(draws(createRng("spring-2"), 20))
      expect(draws(createRng("ab"), 20)).not.toEqual(draws(createRng("ba"), 20))
    })

    it("does not share state between two generators from one seed", () => {
      const a = createRng("shared")
      const b = createRng("shared")
      a.next()
      a.next()
      // b is untouched, so its first draw is still the sequence's first value.
      expect(b.next()).toBe(createRng("shared").next())
    })

    it("advances on every call, so a generator does not repeat itself", () => {
      // 200 distinct values out of 200 is a birthday-collision property, not a
      // guarantee: over 2^32 outputs, 200 draws collide by chance about one run
      // in 230000. It is only safe to assert exactly because the seed is pinned
      // -- this sequence has been checked and has no collision, and it cannot
      // change without the algorithm changing. Do not reseed this test
      // arbitrarily; use a different seed only after checking the same way.
      const values = draws(createRng("advance"), 200)
      expect(new Set(values).size).toBe(200)
    })

    it("reproduces recorded values, so a written-down seed keeps working", () => {
      // Recorded from mulberry32 over FNV-1a("spring-1") and over 12345. If these
      // change, every seed in an old bug report now describes a different game.
      expect(draws(createRng("spring-1"), 3)).toEqual([
        0.19068061816506088, 0.8223429922945797, 0.8231960260309279,
      ])
      expect(draws(createRng(12345), 3)).toEqual([
        0.9797282677609473, 0.3067522644996643, 0.484205421525985,
      ])
    })
  })

  describe("seed coercion", () => {
    /** Every seed that has no usable 32-bit value of its own, with a readable label. */
    const junkSeeds = [
      ["undefined", undefined],
      ["null", null],
      ["NaN", NaN],
      ["Infinity", Infinity],
      ["-Infinity", -Infinity],
      ["0", 0],
      ["-0", -0],
      ["the empty string", ""],
      ["an object", {}],
      ["an empty array", []],
      ["true", true],
    ]

    it.each(junkSeeds)("seed %s still produces finite, varying values", (_label, seed) => {
      const values = draws(createRng(seed), 200)
      for (const value of values) {
        expect(Number.isFinite(value)).toBe(true)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThan(1)
      }
      // The failure mode `_toSeed` exists to prevent: a NaN state returns the
      // same value forever.
      expect(new Set(values).size).toBeGreaterThan(1)
    })

    it("maps every unusable seed onto the same state as seed 1", () => {
      // Documented behaviour, not an accident: `_toSeed` returns 1 rather than
      // throwing, so these seeds are aliases of each other.
      const baseline = draws(createRng(1), 5)
      for (const seed of [undefined, null, NaN, Infinity, 0, -0]) {
        expect(draws(createRng(seed), 5)).toEqual(baseline)
      }
    })

    it("floors a fractional seed rather than rejecting it", () => {
      expect(draws(createRng(7.9), 5)).toEqual(draws(createRng(7), 5))
    })

    it("accepts a negative seed", () => {
      const values = draws(createRng(-42), 50)
      expect(values.every((value) => value >= 0 && value < 1)).toBe(true)
      expect(values).not.toEqual(draws(createRng(42), 50))
    })

    it("treats a numeric string as a string seed, not as its number", () => {
      // "12345" is hashed; 12345 is used directly. They must not be confused,
      // because a save file that stringifies a seed would otherwise drift.
      expect(draws(createRng("12345"), 5)).not.toEqual(draws(createRng(12345), 5))
    })
  })

  describe("next", () => {
    it("stays in [0, 1) across many draws and many seeds", () => {
      // One assertion per seed, collecting the draws that broke the bound,
      // rather than three `expect` calls per draw. 105,000 assertions cost over
      // a second of the suite's total runtime, and a failure read "expected 1
      // to be less than 1" without saying which seed or which draw produced it.
      for (const seed of ["spring", "summer", "autumn", "winter", 0, 1, 999999]) {
        const outOfRange = draws(createRng(seed), 5000).flatMap((value, draw) =>
          Number.isFinite(value) && value >= 0 && value < 1 ? [] : [{ seed, draw, value }],
        )
        expect(outOfRange).toEqual([])
      }
    })

    it("produces values in both halves of the range", () => {
      // A generator pinned to one half would pass the bounds check above while
      // being useless.
      const values = draws(createRng("halves"), 1000)
      expect(values.some((value) => value < 0.5)).toBe(true)
      expect(values.some((value) => value >= 0.5)).toBe(true)
    })
  })

  describe("int", () => {
    it("is inclusive at both ends", () => {
      const values = intDraws(createRng("bounds"), 2000, 1, 3)
      expect(new Set(values)).toEqual(new Set([1, 2, 3]))
    })

    it("never leaves the requested range", () => {
      const values = intDraws(createRng("range"), 2000, -5, 5)
      // The offending draws, not the first one to trip an assertion, so a
      // failure says which values escaped and how far.
      expect(
        values.flatMap((value, draw) =>
          Number.isInteger(value) && value >= -5 && value <= 5 ? [] : [{ draw, value }],
        ),
      ).toEqual([])
      expect(values).toContain(-5)
      expect(values).toContain(5)
    })

    it("returns the value itself when min equals max", () => {
      const rng = createRng("same")
      expect(intDraws(rng, 20, 4, 4)).toEqual(Array(20).fill(4))
      expect(rng.int(0, 0)).toBe(0)
      expect(rng.int(-3, -3)).toBe(-3)
    })

    it("swaps a reversed range instead of rejecting it", () => {
      const forward = intDraws(createRng("reversed"), 500, 2, 9)
      const backward = intDraws(createRng("reversed"), 500, 9, 2)
      expect(backward).toEqual(forward)
      expect(new Set(backward)).toEqual(new Set([2, 3, 4, 5, 6, 7, 8, 9]))
    })

    it("is deterministic for a fixed seed", () => {
      expect(intDraws(createRng(2024), 50, 0, 99)).toEqual(intDraws(createRng(2024), 50, 0, 99))
    })

    it("rounds a fractional range inwards", () => {
      // ceil the low end, floor the high end, so int(1.2, 4.8) is int(2, 4).
      const values = intDraws(createRng("fractional"), 1000, 1.2, 4.8)
      expect(new Set(values)).toEqual(new Set([2, 3, 4]))
    })

    it("returns a safe integer for a non-finite or empty range", () => {
      const rng = createRng("degenerate")
      expect(rng.int(NaN, 5)).toBe(0)
      expect(rng.int(3, Infinity)).toBe(3)
      // Nothing between 0.2 and 0.8, so the low end is all it can offer.
      expect(rng.int(0.2, 0.8)).toBe(1)
    })
  })

  describe("pick", () => {
    it("returns undefined for an empty array", () => {
      expect(createRng("pick").pick([])).toBeUndefined()
    })

    it("returns undefined for anything that is not an array", () => {
      const rng = createRng("pick")
      for (const junk of [null, undefined, "abc", 42, {}, new Set([1, 2])]) {
        expect(rng.pick(junk)).toBeUndefined()
      }
    })

    it("only ever returns an element of the input", () => {
      const items = ["alpha", "beta", "gamma", "delta"]
      const rng = createRng("pick-members")
      const picked = Array.from({ length: 1000 }, () => rng.pick(items))
      expect(picked.filter((value) => !items.includes(value))).toEqual([])
    })

    it("can return every element, including the first and last", () => {
      const items = ["a", "b", "c", "d"]
      const rng = createRng("pick-coverage")
      const seen = new Set(Array.from({ length: 2000 }, () => rng.pick(items)))
      expect(seen).toEqual(new Set(items))
    })

    it("returns the only element of a one-item array", () => {
      const rng = createRng("pick-one")
      for (let i = 0; i < 20; i += 1) {
        expect(rng.pick(["only"])).toBe("only")
      }
    })

    it("is deterministic for a fixed seed", () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8]
      const run = (seed) => {
        const rng = createRng(seed)
        return Array.from({ length: 30 }, () => rng.pick(items))
      }
      expect(run("pick-det")).toEqual(run("pick-det"))
      expect(run("pick-det")).not.toEqual(run("pick-other"))
    })

    it("does not mutate the array it picks from", () => {
      const items = ["a", "b", "c"]
      const rng = createRng("pick-pure")
      for (let i = 0; i < 50; i += 1) rng.pick(items)
      expect(items).toEqual(["a", "b", "c"])
    })
  })

  describe("shuffle", () => {
    it("does not mutate its input", () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8]
      const before = items.slice()
      const result = createRng("shuffle").shuffle(items)
      expect(items).toEqual(before)
      expect(result).not.toBe(items)
    })

    it("returns the same multiset, duplicates included", () => {
      const items = ["a", "b", "b", "c", "c", "c"]
      const result = createRng("multiset").shuffle(items)
      expect(result.length).toBe(items.length)
      expect([...result].sort()).toEqual([...items].sort())
    })

    it("returns [] for anything that is not an array", () => {
      const rng = createRng("shuffle-junk")
      for (const junk of [null, undefined, "abc", 42, {}, new Set([1, 2])]) {
        expect(rng.shuffle(junk)).toEqual([])
      }
    })

    it("handles empty and single-element arrays", () => {
      const rng = createRng("shuffle-small")
      expect(rng.shuffle([])).toEqual([])
      expect(rng.shuffle(["only"])).toEqual(["only"])
    })

    it("is deterministic for a fixed seed", () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      expect(createRng("deal").shuffle(items)).toEqual(createRng("deal").shuffle(items))
      expect(createRng("deal").shuffle(items)).not.toEqual(createRng("cut").shuffle(items))
    })

    it("actually reorders, and can produce many different orderings", () => {
      const items = [1, 2, 3, 4, 5, 6]
      const rng = createRng("orderings")
      const orderings = new Set(Array.from({ length: 500 }, () => rng.shuffle(items).join(",")))
      // 6! is 720; seeing well over a handful rules out a no-op or a fixed rotation.
      expect(orderings.size).toBeGreaterThan(50)
    })

    it("keeps every element in place as a multiset across many shuffles", () => {
      const items = Array.from({ length: 40 }, (_, index) => index)
      const rng = createRng("large")
      const wrong = Array.from({ length: 100 }, (_, round) => {
        const result = rng.shuffle(items)
        const sorted = [...result].sort((a, b) => a - b)
        return sorted.length === items.length && sorted.every((v, i) => v === items[i])
          ? null
          : { round, result }
      }).filter(Boolean)
      expect(wrong).toEqual([])
    })

    it("deals every ordering about equally often, so Fisher-Yates is unbiased", () => {
      // The property none of the tests above can see. Two classic off-by-ones
      // pass all of them -- they reorder, they preserve the multiset, they are
      // deterministic -- while dealing a skewed hand:
      //
      // - j = int(0, length - 1) picks from the whole array rather than the
      //   unshuffled head. Measured on this generator it deals "012" 13381
      //   times against "102" 6662, a 2:1 skew.
      // - j = int(0, i - 1) is Sattolo's algorithm: only cyclic permutations,
      //   so two of the six orderings below never appear at all.
      //
      // Deterministic by construction: one pinned seed, one fixed run length,
      // fixed bounds. 60000 shuffles over 6 orderings expects 10000 each; the
      // observed spread for the real implementation is 9868..10185, and the
      // +-6% band is about 6.5 standard deviations of sampling noise, so the
      // margin is wide while both bugs above land far outside it.
      const rng = createRng("bias")
      const counts = new Map()
      for (let i = 0; i < 60000; i += 1) {
        const ordering = rng.shuffle([0, 1, 2]).join("")
        counts.set(ordering, (counts.get(ordering) ?? 0) + 1)
      }
      expect([...counts.keys()].sort()).toEqual(["012", "021", "102", "120", "201", "210"])
      for (const [ordering, count] of counts) {
        // Paired with the label so a failure names the skewed ordering.
        expect([ordering, count > 9400 && count < 10600]).toEqual([ordering, true])
      }
    })

    it("puts every element in every position, over many shuffles", () => {
      // The marginal version of the check above, on a longer array: a shuffle
      // that can never move element 0 out of slot 0, or never reach the last
      // slot, is a fixed-point bug the multiset tests cannot see.
      const items = [0, 1, 2, 3, 4, 5, 6, 7]
      const rng = createRng("positions")
      const seen = items.map(() => new Set())
      for (let i = 0; i < 2000; i += 1) {
        rng.shuffle(items).forEach((value, position) => seen[value].add(position))
      }
      for (const [value, positions] of seen.entries()) {
        expect([value, positions.size]).toEqual([value, items.length])
      }
    })
  })
})

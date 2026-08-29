/**
 * Tests for the Seasons journey -- trail geometry and position bookkeeping.
 *
 * Journey.js is pure: no state, no DOM, no clock. So these tests are mostly
 * about two things -- that a trail is a faithful projection of a Season, and
 * that every entry point survives the junk a save file can hand it.
 *
 * The key decision here is that the invariant tests run against the four real
 * seasons from seasons.js rather than hand-made fixtures. seasons.js is
 * explicitly a file that gets retuned often, and a retune that adds a glowing
 * index past the end of the trail, or shortens a season below its glowing
 * indices, would leave every fixture-based test green while breaking the game.
 * Fixtures are used only for shapes the real content cannot produce: a
 * zero-length season, a season with a non-finite `spaces`, and a null season.
 *
 * Position semantics worth restating, because half these tests turn on it:
 * positions run 0 .. spaces, and position `spaces` is one past the last space
 * and means "at the boss". So `spaceAt` returning null is the normal, expected
 * result at the end of a trail, not an error.
 */

import { describe, expect, it } from "@jest/globals"
import {
  bossPosition,
  buildTrail,
  isAtBoss,
  isGlowingAt,
  normalizePosition,
  progress,
  spaceAt,
} from "../js/Journey.js"
import { PLAY } from "../js/constants.js"
import { maxItems, SEASON_LIST } from "../js/seasons.js"

/** The real seasons, as [name, season] pairs for it.each. */
const SEASONS = SEASON_LIST.map((season) => [season.name, season])

/** A season with no spaces at all -- the degenerate case content cannot produce. */
const EMPTY_SEASON = { id: "void", name: "Void", spaces: 0, glowingAt: [] }

describe("buildTrail", () => {
  it.each(SEASONS)("%s has one space per season.spaces", (_name, season) => {
    const trail = buildTrail(season)
    expect(trail.length).toBe(season.spaces)
    expect(trail.map((space) => space.index)).toEqual(
      Array.from({ length: season.spaces }, (_, index) => index),
    )
  })

  it.each(SEASONS)("%s marks exactly the glowing indices", (_name, season) => {
    const trail = buildTrail(season)
    const glowing = trail.filter((space) => space.glowing).map((space) => space.index)
    expect(glowing).toEqual([...season.glowingAt].sort((a, b) => a - b))
  })

  it.each(SEASONS)("%s keeps every glowing index inside the trail", (_name, season) => {
    // The retune guard: a glowing index past the end would silently never glow.
    for (const index of season.glowingAt) {
      expect(Number.isInteger(index)).toBe(true)
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(season.spaces)
    }
    expect(new Set(season.glowingAt).size).toBe(season.glowingAt.length)
  })

  it.each(SEASONS)("%s carries only an index and a glowing flag", (_name, season) => {
    // A space deliberately does not say what it is worth. It used to carry an
    // `items` field set from PLAY.ITEMS_PER_GLOWING_SPACE, which disagreed with
    // what the player actually collected -- the Banana Slug gets 2 from a
    // glowing space, not 3 -- so the number was both dead and wrong.
    // GameState.answer is the single authority on payout.
    for (const space of buildTrail(season)) {
      expect(Object.keys(space).sort()).toEqual(["glowing", "index"])
    }
  })

  it.each(SEASONS)("%s builds an equal but fresh trail each time", (_name, season) => {
    const first = buildTrail(season)
    const second = buildTrail(season)
    expect(second).toEqual(first)
    // Derived, never cached: mutating one trail cannot affect the next build.
    expect(second).not.toBe(first)
    first[0].glowing = true
    expect(buildTrail(season)[0].glowing).toBe(season.glowingAt.includes(0))
  })

  it("returns [] for a null or missing season", () => {
    expect(buildTrail(null)).toEqual([])
    expect(buildTrail(undefined)).toEqual([])
  })

  it("returns [] for a season with a non-finite or negative length", () => {
    expect(buildTrail({ spaces: NaN, glowingAt: [] })).toEqual([])
    expect(buildTrail({ spaces: Infinity, glowingAt: [] })).toEqual([])
    expect(buildTrail({ spaces: "10", glowingAt: [] })).toEqual([])
    expect(buildTrail({ spaces: -4, glowingAt: [] })).toEqual([])
    expect(buildTrail(EMPTY_SEASON)).toEqual([])
  })

  it("floors a fractional length", () => {
    expect(buildTrail({ spaces: 3.9, glowingAt: [1] }).length).toBe(3)
  })
})

describe("bossPosition", () => {
  it.each(SEASONS)("%s puts the boss one past the last space", (_name, season) => {
    expect(bossPosition(season)).toBe(season.spaces)
  })

  it("puts the boss at the published length of each real season", () => {
    // `season.spaces` rather than `buildTrail(season).length`, which recomputes
    // Math.max(0, Math.floor(season.spaces)) exactly as bossPosition does and so
    // would agree with it however both drift. Reading the published number
    // straight off the season is a real assertion -- an off-by-one or a clamp
    // applied to the wrong value still fails -- and it survives a retune, which
    // a list of literals here did not.
    expect(SEASON_LIST.map((season) => bossPosition(season))).toEqual(
      SEASON_LIST.map((season) => season.spaces),
    )
  })

  it("is 0 for a null season or an unusable length", () => {
    expect(bossPosition(null)).toBe(0)
    expect(bossPosition(undefined)).toBe(0)
    expect(bossPosition({ spaces: NaN })).toBe(0)
    expect(bossPosition({ spaces: -7 })).toBe(0)
    expect(bossPosition(EMPTY_SEASON)).toBe(0)
  })
})

describe("normalizePosition", () => {
  it.each(SEASONS)("%s clamps a negative position to 0", (_name, season) => {
    expect(normalizePosition(season, -1)).toBe(0)
    expect(normalizePosition(season, -999)).toBe(0)
    // Floors first, so anything above -1 still lands on 0.
    expect(normalizePosition(season, -0.5)).toBe(0)
  })

  it.each(SEASONS)("%s clamps a position past the end to the boss", (_name, season) => {
    // season.spaces, not bossPosition(season): normalizePosition is implemented
    // in terms of bossPosition, so comparing the two would still pass if both
    // collapsed to 0.
    expect(normalizePosition(season, season.spaces + 1)).toBe(season.spaces)
    expect(normalizePosition(season, 10000)).toBe(season.spaces)
    expect(normalizePosition(season, Number.MAX_SAFE_INTEGER)).toBe(season.spaces)
  })

  it.each(SEASONS)("%s returns 0 for a non-finite position", (_name, season) => {
    for (const junk of [NaN, Infinity, -Infinity, null, undefined, "5", {}, []]) {
      expect(normalizePosition(season, junk)).toBe(0)
    }
  })

  it.each(SEASONS)("%s floors a fractional position", (_name, season) => {
    expect(normalizePosition(season, 3.9)).toBe(3)
    expect(normalizePosition(season, 0.99)).toBe(0)
    expect(normalizePosition(season, season.spaces - 0.1)).toBe(season.spaces - 1)
  })

  it.each(SEASONS)("%s leaves every in-range position alone", (_name, season) => {
    for (let position = 0; position <= season.spaces; position += 1) {
      expect(normalizePosition(season, position)).toBe(position)
    }
  })

  it.each(SEASONS)("%s is idempotent", (_name, season) => {
    for (const input of [-5, 0, 3, season.spaces, season.spaces + 4, 2.7, NaN]) {
      const once = normalizePosition(season, input)
      expect(normalizePosition(season, once)).toBe(once)
    }
  })

  it("collapses everything to 0 for a null or zero-length season", () => {
    for (const season of [null, undefined, EMPTY_SEASON]) {
      for (const position of [-3, 0, 1, 99, NaN]) {
        expect(normalizePosition(season, position)).toBe(0)
      }
    }
  })
})

describe("isAtBoss", () => {
  it.each(SEASONS)("%s is false anywhere on the trail", (_name, season) => {
    for (let position = 0; position < season.spaces; position += 1) {
      expect(isAtBoss(season, position)).toBe(false)
    }
  })

  it.each(SEASONS)("%s is true at and past the boss position", (_name, season) => {
    expect(isAtBoss(season, season.spaces)).toBe(true)
    expect(isAtBoss(season, season.spaces + 1)).toBe(true)
    expect(isAtBoss(season, 10000)).toBe(true)
  })

  it.each(SEASONS)("%s is false for junk, which normalizes to the start", (_name, season) => {
    for (const junk of [NaN, -1, undefined, "boss"]) {
      expect(isAtBoss(season, junk)).toBe(false)
    }
  })

  it("is true immediately for a zero-length season", () => {
    // There is no trail to walk, so position 0 is already the boss.
    expect(isAtBoss(EMPTY_SEASON, 0)).toBe(true)
  })

  it("is false for a missing season, which is not started rather than finished", () => {
    // Deliberately different from the zero-length case above: a season that
    // really has no spaces is over, but a season that is not there at all has
    // not begun. `progress` agrees, so the two can never contradict each other.
    for (const season of [null, undefined]) {
      expect(isAtBoss(season, 0)).toBe(false)
    }
  })
})

describe("spaceAt", () => {
  it.each(SEASONS)("%s returns the matching space for every position", (_name, season) => {
    const trail = buildTrail(season)
    for (let position = 0; position < season.spaces; position += 1) {
      expect(spaceAt(season, position)).toEqual(trail[position])
    }
  })

  it.each(SEASONS)("%s returns null at the boss", (_name, season) => {
    expect(spaceAt(season, season.spaces)).toBeNull()
    expect(spaceAt(season, season.spaces + 5)).toBeNull()
  })

  it.each(SEASONS)("%s uses the normalized position", (_name, season) => {
    expect(spaceAt(season, 2.9)).toEqual(spaceAt(season, 2))
    expect(spaceAt(season, -10)).toEqual(spaceAt(season, 0))
    expect(spaceAt(season, NaN)).toEqual(spaceAt(season, 0))
  })

  it("returns null for a null or zero-length season", () => {
    for (const season of [null, undefined, EMPTY_SEASON]) {
      expect(spaceAt(season, 0)).toBeNull()
      expect(spaceAt(season, 5)).toBeNull()
    }
  })
})

describe("isGlowingAt", () => {
  it.each(SEASONS)("%s agrees with the season's glowingAt list", (_name, season) => {
    // Against season.glowingAt, which is data. Comparing isGlowingAt to
    // buildTrail's own `glowing` flag would be the same array element on both
    // sides -- isGlowingAt reads exactly that -- and could not fail.
    for (let position = 0; position < season.spaces; position += 1) {
      expect(isGlowingAt(season, position)).toBe(season.glowingAt.includes(position))
    }
  })

  it.each(SEASONS)("%s is false at the boss, where there is no space", (_name, season) => {
    expect(isGlowingAt(season, season.spaces)).toBe(false)
    expect(isGlowingAt(season, season.spaces + 3)).toBe(false)
  })

  it("is false for a null or zero-length season", () => {
    for (const season of [null, undefined, EMPTY_SEASON]) {
      expect(isGlowingAt(season, 0)).toBe(false)
    }
  })
})

describe("progress", () => {
  it.each(SEASONS)("%s is 0 at the start and 1 at the boss", (_name, season) => {
    expect(progress(season, 0)).toBe(0)
    expect(progress(season, season.spaces)).toBe(1)
  })

  it.each(SEASONS)("%s never leaves [0, 1], however junk the position", (_name, season) => {
    for (const position of [-100, -1, 0, 1, season.spaces, season.spaces + 50, NaN, Infinity]) {
      const value = progress(season, position)
      expect(Number.isFinite(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })

  it.each(SEASONS)("%s increases strictly with each space walked", (_name, season) => {
    let previous = -1
    for (let position = 0; position <= season.spaces; position += 1) {
      const value = progress(season, position)
      expect(value).toBeGreaterThan(previous)
      previous = value
    }
    expect(previous).toBe(1)
  })

  it.each(SEASONS)("%s divides the trail into even steps", (_name, season) => {
    expect(progress(season, 1)).toBeCloseTo(1 / season.spaces, 10)
    const middle = Math.floor(season.spaces / 2)
    expect(progress(season, middle)).toBeCloseTo(middle / season.spaces, 10)
  })

  it("is 1 for a zero-length season, which is already finished", () => {
    expect(progress(EMPTY_SEASON, 0)).toBe(1)
    expect(progress(EMPTY_SEASON, 5)).toBe(1)
  })

  it("is 0 for a null season, which is not started rather than finished", () => {
    // A missing season must not read as a completed one: a caller sizing a
    // progress bar off this would otherwise show a journey nobody has begun as
    // over. isAtBoss agrees, so the two can never contradict each other.
    expect(progress(null, 0)).toBe(0)
    expect(isAtBoss(null, 0)).toBe(false)
  })
})

describe("cross-function invariants over the real seasons", () => {
  it.each(SEASONS)("%s: spaceAt is null exactly when isAtBoss is true", (_name, season) => {
    for (let position = 0; position <= season.spaces + 2; position += 1) {
      expect(spaceAt(season, position) === null).toBe(isAtBoss(season, position))
    }
  })

  it.each(SEASONS)("%s: progress reaches 1 exactly at the boss", (_name, season) => {
    for (let position = 0; position <= season.spaces + 2; position += 1) {
      expect(progress(season, position) === 1).toBe(isAtBoss(season, position))
    }
  })

  it.each(SEASONS)("%s: walking every space collects maxItems", (_name, season) => {
    // The trail's shape has to agree with the reachability figure seasons.js
    // publishes for its demands. Payout lives in GameState, so this values the
    // spaces the same way it does. `maxItems` is called rather than its formula
    // copied: a copy would let the two drift apart and stay green, which is the
    // opposite of what this test is for.
    const total = buildTrail(season).reduce(
      (sum, space) => sum + (space.glowing ? PLAY.ITEMS_PER_GLOWING_SPACE : PLAY.ITEMS_PER_SPACE),
      0,
    )
    expect(total).toBe(maxItems(season, PLAY.ITEMS_PER_GLOWING_SPACE))
    expect(total).toBeGreaterThanOrEqual(season.demand)
  })
})

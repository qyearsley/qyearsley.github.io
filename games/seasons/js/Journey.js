/**
 * Seasons journey -- the trail a character walks through a season.
 *
 * Pure geometry and bookkeeping: no state, no DOM, no randomness. This module
 * owns what a space is worth and where the boss sits. It does not own the
 * player's position (GameState does) or the curve the trail is drawn along (the
 * art pack does), so the shape on screen can change completely without touching
 * a rule.
 *
 * - A trail is derived, never stored. `buildTrail` is a pure function of a
 *   Season, so a save records a position and nothing else, and retuning a
 *   season's length cannot leave a stale trail behind.
 * - Positions run 0 .. spaces. Position `spaces` is one past the last space and
 *   means "at the boss"; `isAtBoss` is the only correct way to ask.
 * - `normalizePosition` is the semantic authority on that bound. storage.js
 *   normalizes a position only structurally, because the bound needs the
 *   season; `GameState.rehydrate` applies this one on load.
 *
 * Error Handling: every function tolerates a null season and an out-of-range
 * position, returning a safe zero-ish value rather than throwing.
 */

import { isGlowing } from "./seasons.js"

/**
 * One space on the trail.
 *
 * @typedef {Object} Space
 * @property {number} index    - 0-based position along the trail
 * @property {boolean} glowing - Whether this is a glowing space; the label the
 *                               player sees is "Glowing challenge"
 *
 * Deliberately no `items` field. What a space pays depends on the character's
 * `glowingItems`, so a payout recorded here would disagree with the number the
 * player actually receives. `GameState.answer` is the single authority.
 */

/**
 * Build the list of spaces for a season.
 *
 * @param {import("./seasons.js").Season|null} season - The season being played
 * @returns {Space[]} The spaces in order; empty for a null season
 */
export function buildTrail(season) {
  if (!season || !Number.isFinite(season.spaces)) return []
  const count = Math.max(0, Math.floor(season.spaces))
  return Array.from({ length: count }, (_, index) => ({
    index,
    glowing: isGlowing(season, index),
  }))
}

/**
 * The last valid position, which is the boss position.
 *
 * @param {import("./seasons.js").Season|null} season - The season being played
 * @returns {number} `season.spaces`, or 0 for a null season
 */
export function bossPosition(season) {
  if (!season || !Number.isFinite(season.spaces)) return 0
  return Math.max(0, Math.floor(season.spaces))
}

/**
 * Clamp a position into 0 .. bossPosition. Called on every load, because a
 * position from a save can predate a change to the season's length.
 *
 * @param {import("./seasons.js").Season|null} season - The season being played
 * @param {unknown} position - A position, possibly from a save file
 * @returns {number} A position that is in range for this season
 */
export function normalizePosition(season, position) {
  if (!Number.isFinite(position)) return 0
  return Math.min(bossPosition(season), Math.max(0, Math.floor(/** @type {number} */ (position))))
}

/**
 * Whether the player has walked the whole trail and is facing the boss.
 *
 * A missing season is false, for the same reason `progress` returns 0 for one:
 * "no season" is not started. The two functions have to agree, or a caller can
 * be told the journey is over and unfinished at the same time.
 *
 * @param {import("./seasons.js").Season|null} season - The season being played
 * @param {number} position - Current position
 * @returns {boolean} True at the boss
 */
export function isAtBoss(season, position) {
  if (!season) return false
  return normalizePosition(season, position) >= bossPosition(season)
}

/**
 * The space the player is standing on.
 *
 * @param {import("./seasons.js").Season|null} season - The season being played
 * @param {number} position - Current position
 * @returns {Space|null} The space, or null when at the boss or off the trail
 */
export function spaceAt(season, position) {
  const trail = buildTrail(season)
  const index = normalizePosition(season, position)
  return trail[index] ?? null
}

/**
 * Whether the current space is a glowing one. A convenience over `spaceAt`,
 * because callers almost always want the flag rather than the space.
 *
 * @param {import("./seasons.js").Season|null} season - The season being played
 * @param {number} position - Current position
 * @returns {boolean} True on a glowing space
 */
export function isGlowingAt(season, position) {
  return spaceAt(season, position)?.glowing === true
}

/**
 * How far along the trail the player is, as a fraction. Used to place the
 * character on the drawn path and to size the progress bar.
 *
 * A missing season reads as 0, not 1. "No season" is not started, not
 * finished -- returning 1 would tell a caller drawing a completion bar that a
 * journey nobody has begun is over. A season that really has zero spaces is a
 * different case and does return 1.
 *
 * @param {import("./seasons.js").Season|null} season - The season being played
 * @param {number} position - Current position
 * @returns {number} 0 at the start, 1 at the boss
 */
export function progress(season, position) {
  if (!season) return 0
  const end = bossPosition(season)
  if (end === 0) return 1
  return normalizePosition(season, position) / end
}

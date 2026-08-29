/**
 * Seasons challenge registry -- the seam between a season and the thing it asks
 * the player to do.
 *
 * Architecture: this is the indirection that keeps "Seasons" from being a maths
 * game with a story on top.
 * - A season names a challenge by string (`challenge: "arithmetic"`). Nothing
 *   in seasons.js, GameState.js, or GameUI.js imports a generator directly, so
 *   when Ella invents a matching game, a word puzzle, or a spot-the-difference,
 *   it is a new module in this directory, one line in CHALLENGES, and one
 *   string in the season. No existing file changes shape.
 * - Every challenge module exports exactly two functions with these signatures:
 *
 *     generate(forms: Array<Object>, rng: Rng) -> Question
 *     check(question: Question, given: unknown) -> boolean
 *
 *   `forms` is opaque here: its shape is a contract between one challenge
 *   module and the seasons that use it, and this file never inspects it.
 * - A Question must carry `prompt` (a string to show) and `choices` (an array of
 *   options to render as buttons). Anything else on it belongs to the challenge
 *   module. GameUI renders only those two fields plus the result of `check`,
 *   which is what lets a new challenge type reuse the whole play screen.
 *
 * Error Handling: `getChallenge` falls back to arithmetic for an unknown type
 * rather than returning null. An unknown type means a typo in seasons.js, and
 * an easy question is a far better failure than a season that cannot start.
 * The fallback is logged so the typo does not stay invisible.
 */

import * as arithmetic from "./arithmetic.js"

/**
 * A challenge module.
 *
 * @typedef {Object} Challenge
 * @property {function(Array<Object>, import("../rng.js").Rng): Object} generate
 * @property {function(Object, unknown): boolean} check
 */

/**
 * Every challenge type, keyed by the string a season uses.
 * @type {Object<string, Challenge>}
 */
const CHALLENGES = {
  arithmetic,
}

/**
 * The type used when a season names one that does not exist.
 * @type {string}
 */
export const DEFAULT_CHALLENGE = "arithmetic"

/**
 * Every registered challenge type.
 * @returns {string[]} The known type names
 */
export function challengeTypes() {
  return Object.keys(CHALLENGES)
}

/**
 * Look up a challenge module by type.
 *
 * @param {unknown} type - A challenge type, from a season definition
 * @returns {Challenge} The module; arithmetic if the type is unknown
 */
export function getChallenge(type) {
  if (typeof type === "string" && Object.hasOwn(CHALLENGES, type)) {
    return CHALLENGES[type]
  }
  console.warn(`getChallenge: unknown challenge type "${type}"; falling back to arithmetic`)
  return CHALLENGES[DEFAULT_CHALLENGE]
}

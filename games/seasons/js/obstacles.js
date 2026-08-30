/**
 * Seasons obstacles -- the vocabulary of things standing between the player and
 * the next space.
 *
 * Every space on a trail is an obstacle: a hill to climb, a river to cross, a
 * mountain to haul over. Answer the question and the character gets across it.
 * This file names the kinds and says what each one means to the *rules*; the art
 * pack owns what each looks like and how crossing it is animated, so a new pack
 * can redraw the whole world without touching this file.
 *
 * `hard` lives on the kind rather than on the space. Earlier versions carried a
 * separate `glowingAt` list of indices, which meant the trail's difficulty and
 * the trail's scenery were tuned in two places and could disagree. Now the
 * mountain simply *is* the hard obstacle, which is also how a nine-year-old
 * reads a picture of a mountain. Tuning how many hard spaces a season has means
 * placing that many mountains in its route.
 *
 * `verb` is not read anywhere yet. It is here so a crossing can be described in
 * words when something wants to -- the trail's accessible label currently uses
 * `name` ("a river to cross"), and the feedback line after an answer talks about
 * items rather than movement.
 *
 * Error Handling: `getObstacle` falls back to the first kind for anything
 * unknown, so a typo in a season's route draws the wrong hill rather than
 * breaking the season. `isObstacleKind` is the strict check, and seasons.test.js
 * uses it to hold every route to known kinds.
 */

/**
 * One kind of obstacle.
 *
 * @typedef {Object} Obstacle
 * @property {string} kind - Stable id; the art-pack key and the route value
 * @property {string} name - Display name, for labels and copy
 * @property {string} verb - What the character does to it, third person
 * @property {boolean} hard - Whether this is a harder question worth more items
 */

/**
 * Every obstacle kind, keyed by id. Adding one here plus a drawing and a
 * traversal in the art pack is the whole cost of a new obstacle.
 *
 * Six kinds, all crossable in one answer. The mountain is the only hard one; a
 * second hard kind would work the same way.
 *
 * @type {Object<string, Obstacle>}
 */
const OBSTACLES = {
  hill: { kind: "hill", name: "Hill", verb: "climbs", hard: false },
  river: { kind: "river", name: "River", verb: "crosses", hard: false },
  thicket: { kind: "thicket", name: "Thicket", verb: "pushes through", hard: false },
  boulder: { kind: "boulder", name: "Boulder", verb: "clambers over", hard: false },
  gap: { kind: "gap", name: "Gap", verb: "leaps", hard: false },
  mountain: { kind: "mountain", name: "Mountain", verb: "climbs", hard: true },
}

/** Every valid kind id, in declaration order. @type {string[]} */
export const OBSTACLE_KINDS = Object.freeze(Object.keys(OBSTACLES))

/** The kind used when a route names one that does not exist. @type {Obstacle} */
export const DEFAULT_OBSTACLE = OBSTACLES[OBSTACLE_KINDS[0]]

/**
 * Whether a value is a known obstacle kind. The strict check; use this to
 * validate content rather than to render it.
 *
 * @param {unknown} kind - A candidate kind id
 * @returns {boolean} True if the kind exists
 */
export function isObstacleKind(kind) {
  return typeof kind === "string" && Object.hasOwn(OBSTACLES, kind)
}

/**
 * Look up an obstacle by kind.
 *
 * Falls back rather than returning null: a mistyped kind in a route should show
 * the wrong scenery, not stop the season. `isObstacleKind` is how a test asks
 * the strict question.
 *
 * @param {unknown} kind - A kind id, from a season's route
 * @returns {Obstacle} The obstacle, or DEFAULT_OBSTACLE
 */
export function getObstacle(kind) {
  return isObstacleKind(kind) ? OBSTACLES[kind] : DEFAULT_OBSTACLE
}

/**
 * Whether an obstacle kind is one of the hard ones -- a harder question, worth
 * more items, drawn with the light Ella described. Every season's glowing spaces
 * ask division, the hardest operation by her rule; see seasons.js.
 *
 * @param {unknown} kind - A kind id
 * @returns {boolean} True for a hard obstacle
 */
export function isHardKind(kind) {
  return getObstacle(kind).hard
}

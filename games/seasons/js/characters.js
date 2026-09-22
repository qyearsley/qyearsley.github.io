/**
 * Seasons characters -- the roster, and what choosing one actually does.
 *
 * A character is data, not code. Every perk is expressed as values in an
 * `effects` object that GameState reads: no character has a function attached,
 * and GameState has no `if (character.id === "phoenix")` anywhere. Adding an
 * animal is a new entry in ROSTER and nothing else, as long as it reuses the
 * existing effect fields; a genuinely new *kind* of effect is a new field in
 * DEFAULT_EFFECTS plus the code in GameState that honours it.
 *
 * - Art lives in art/, keyed by character id. Nothing here describes an
 *   appearance beyond the id.
 * - No perk changes how many items a character collects, and none can. A
 *   season's demand is exactly what a finished trail pays plus the boss's
 *   rescue, so an animal who collected a different amount from a mountain could
 *   not reach it. The roster trades on time, hints and patience instead.
 * - Each perk is free. The costs went with the wrong-answer penalty they were
 *   priced against: there is no longer an item to charge one in.
 *
 * Error Handling: `getCharacter` returns the first character rather than null
 * for an unknown id, so a corrupted save selects a playable animal instead of
 * crashing the screen.
 */

import { DEFAULT_EFFECTS } from "./constants.js"

/**
 * A playable character.
 *
 * @typedef {Object} Character
 * @property {string} id          - Stable id; also the art key and the save value
 * @property {string} name        - Display name
 * @property {string} perkName    - Short name of the perk, shown on the card
 * @property {string} perkText    - What the perk does, in a sentence a third
 *                                  grader can read
 * @property {string} costText    - What it costs, same audience. Empty if free.
 * @property {Object} effects     - Overrides merged over DEFAULT_EFFECTS
 */

/**
 * The animals, in display order.
 *
 * Rebuilt on 2026-09-21, when the wrong-answer penalty was removed and three of
 * the four perks stopped doing anything. Each animal now owns exactly one field
 * of DEFAULT_EFFECTS, which is what `characters.test.js` holds them to.
 *
 * Two of them -- the Slug and the Sloth -- only matter when the countdown is
 * switched on, and it is off by default. That is a known soft spot rather than
 * an oversight: they are the animals for a player who wants the clock, one
 * without it and one with more of it. If the roster needs a second always-on
 * perk, give the Slug `hintsPerSeason: 2` and the note in
 * `docs/seasons-plan.md` explains the trade.
 *
 * @type {Character[]}
 */
const ROSTER = [
  {
    id: "banana-slug",
    name: "Banana Slug",
    perkName: "Slow and Steady",
    perkText: "No countdown, ever. You can take as long as you like.",
    costText: "",
    effects: { noTimer: true },
  },
  {
    id: "sloth",
    name: "Sloth",
    perkName: "Takes His Time",
    perkText: "You get 10 extra seconds on every timed question.",
    costText: "",
    effects: { extraSeconds: 10 },
  },
  {
    id: "phoenix",
    name: "Phoenix",
    perkName: "Rising Again",
    perkText: "The first time you slip each season, two wrong answers disappear.",
    costText: "",
    effects: { hintsPerSeason: 1 },
  },
  {
    id: "porcupine",
    name: "Porcupine",
    perkName: "Bounce Back",
    perkText: "Get one wrong and you go straight on, with no extra question.",
    costText: "",
    effects: { skipsExtra: true },
  },
]

/**
 * Every character, with effects already merged over the defaults. Frozen so a
 * caller cannot edit the roster by accident; GameState reads these on every
 * answer and must never see a mutated perk mid-season.
 *
 * @type {ReadonlyArray<Character>}
 */
export const CHARACTERS = Object.freeze(
  ROSTER.map((character) =>
    Object.freeze({
      ...character,
      effects: Object.freeze({ ...DEFAULT_EFFECTS, ...character.effects }),
    }),
  ),
)

/**
 * Every valid character id, for coercing an id off a save file.
 *
 * Deliberately not `Object.freeze`d: freezing a Set does not stop `add` or
 * `delete`, so the call would look like a guarantee it cannot make. Nothing
 * writes to this; it is read-only by convention, not by enforcement.
 *
 * @type {Set<string>}
 */
export const CHARACTER_IDS = new Set(CHARACTERS.map((character) => character.id))

/**
 * The default character, used when a save names one that no longer exists.
 * @type {Character}
 */
export const DEFAULT_CHARACTER = CHARACTERS[0]

/**
 * Look up a character by id.
 *
 * An unknown id returns DEFAULT_CHARACTER rather than null. The id comes off a
 * save file that may have been written by an older build, and the cost of
 * silently playing a slug is far lower than the cost of a blank screen.
 *
 * @param {unknown} id - A character id, from a save file or a click
 * @returns {Character} The matching character, or DEFAULT_CHARACTER
 */
export function getCharacter(id) {
  return CHARACTERS.find((character) => character.id === id) ?? DEFAULT_CHARACTER
}

/**
 * The effects for a character id, ready for GameState to read.
 *
 * @param {unknown} id - A character id
 * @returns {Object} The merged effects; never null
 */
export function getEffects(id) {
  return getCharacter(id).effects
}

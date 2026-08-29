/**
 * Seasons content -- the four levels, their collectibles, and their difficulty.
 *
 * The one place to change how hard the game is, and meant to be edited often.
 * The difficulty table and the demand tuning are written up in ../README.md;
 * what follows is only what an editor of this file needs.
 *
 * - A season names a challenge *type* rather than importing a generator, so a
 *   matching game or a word puzzle can become a season's challenge by changing
 *   one string once the module exists in challenges/. See challenges/index.js.
 * - `forms` and `glowingForms` are passed straight to that challenge module.
 *   Their shape is the challenge's business, not this file's; arithmetic.js
 *   documents the arithmetic forms.
 * - Difficulty escalates on every axis at once: the maths gets harder, the
 *   timer tightens, the demand rises, and more of the trail is glowing. The
 *   target is third grade.
 * - Keep two-digit multiplication to a small first operand and a second operand
 *   in the low tens. Anything larger is a written, vertical-maths question
 *   rather than a mental one, which is not what this format can fairly ask
 *   against a countdown.
 * - Ella's rule for the operations: "addition, subtraction, multiplication,
 *   maybe with division as the hardest one in a level." So division never
 *   appears in a season's ordinary `forms`; it is reserved for `glowingForms`
 *   and the boss. Meeting a division question always means you reached one of
 *   the hard spaces. seasons.test.js enforces this.
 *
 * Reachability: `maxItems` below is what a perfect run collects. Demands are
 * tuned against the Banana Slug, who takes fewer items from a glowing space, so
 * she is always the binding constraint -- and her handicap grows with the
 * number of glowing spaces, which grows every season. seasons.test.js asserts
 * every demand is reachable by every character with headroom to spare, so a
 * retune cannot quietly make a season impossible.
 *
 * Error Handling: `getSeason` returns null for an unknown id. Unlike a
 * character, there is no sensible fallback season -- playing spring when the
 * save says winter would silently erase progress -- so the caller must handle it.
 */

import { SEASON_ORDER } from "./constants.js"

/**
 * One level.
 *
 * @typedef {Object} Season
 * @property {string} id            - Stable id; art key and save value
 * @property {string} name          - Display name
 * @property {string} itemName      - One collectible, singular
 * @property {string} itemPlural    - Collectibles, plural
 * @property {string} rareItemName  - What a glowing space gives, singular
 * @property {string} demandText    - The snake woman's line at the season start
 * @property {number} spaces        - Trail length; also how many correct
 *                                    answers it takes to reach the boss
 * @property {number[]} glowingAt   - 0-based indices of the glowing spaces
 * @property {number} demand        - Items needed to satisfy her
 * @property {number|null} timerSeconds - Seconds per question, or null for none
 * @property {string} challenge     - Challenge type, resolved by challenges/
 * @property {Array} forms          - Question forms for ordinary spaces
 * @property {Array} glowingForms   - Question forms for glowing spaces
 * @property {Object} boss          - Boss question forms plus its rescue value
 */

/**
 * The four seasons, keyed by id. Play order lives in SEASON_ORDER.
 *
 * @type {Object<string, Season>}
 */
const SEASONS = {
  spring: {
    id: "spring",
    name: "Spring",
    itemName: "Rose",
    itemPlural: "Roses",
    rareItemName: "Everlasting Rose",
    demandText: "Eleven roses for my potion, please. The ones that never wilt.",
    spaces: 14,
    glowingAt: [4, 9],
    demand: 11,
    timerSeconds: null,
    challenge: "arithmetic",
    forms: [
      { kind: "add", max: 100 },
      { kind: "sub", max: 100 },
      { kind: "mul", tables: [2, 5, 10], upTo: 10 },
    ],
    glowingForms: [
      { kind: "mul", tables: [2, 5, 10], upTo: 12 },
      { kind: "div", tables: [2, 5, 10], upTo: 6 },
    ],
    boss: {
      rescue: 3,
      forms: [{ kind: "div", tables: [2, 5, 10], upTo: 10 }],
    },
  },

  summer: {
    id: "summer",
    name: "Summer",
    itemName: "Diamond",
    itemPlural: "Diamonds",
    rareItemName: "Blazing Diamond",
    demandText: "Thirteen diamonds next. My potion needs something that catches light.",
    spaces: 16,
    glowingAt: [3, 8, 13],
    demand: 13,
    timerSeconds: 20,
    challenge: "arithmetic",
    forms: [
      { kind: "mul", tables: [2, 3, 4, 5, 6, 7, 8, 9, 10], upTo: 10 },
      { kind: "add", max: 200, borrow: true },
      { kind: "sub", max: 200, borrow: true },
    ],
    glowingForms: [
      { kind: "mul", tables: [6, 7, 8, 9], upTo: 12 },
      { kind: "div", tables: [2, 3, 4, 5, 6, 7, 8, 9, 10], upTo: 10 },
    ],
    boss: {
      rescue: 4,
      forms: [{ kind: "div", tables: [6, 7, 8, 9], upTo: 10 }],
    },
  },

  autumn: {
    id: "autumn",
    name: "Autumn",
    itemName: "Leaf",
    itemPlural: "Leaves",
    rareItemName: "Golden Leaf",
    demandText: "Fifteen leaves, before they all fall. The gold ones are strongest.",
    spaces: 18,
    glowingAt: [3, 7, 11, 15],
    demand: 15,
    timerSeconds: 18,
    challenge: "arithmetic",
    forms: [
      { kind: "mul", tables: [2, 3, 4, 5], upTo: 15, twoDigit: true },
      { kind: "add", max: 1000, borrow: true },
      { kind: "sub", max: 1000, borrow: true },
    ],
    glowingForms: [
      { kind: "mul", tables: [2, 3, 4, 5], upTo: 20, twoDigit: true },
      { kind: "div", tables: [3, 4, 6, 7, 8, 9], upTo: 12 },
    ],
    boss: {
      rescue: 5,
      forms: [{ kind: "div", tables: [4, 6, 7, 8, 9], upTo: 12 }],
    },
  },

  winter: {
    id: "winter",
    name: "Winter",
    itemName: "Icicle",
    itemPlural: "Icicles",
    rareItemName: "Frostfire Icicle",
    demandText: "Seventeen icicles and the potion is finished. This is the hard part.",
    spaces: 20,
    glowingAt: [3, 7, 11, 15, 18],
    demand: 17,
    timerSeconds: 15,
    challenge: "arithmetic",
    forms: [
      { kind: "twoStep", tables: [2, 3, 4, 5, 6, 7, 8, 9], upTo: 12, max: 300 },
      { kind: "mul", tables: [2, 3, 4, 5, 6], upTo: 20, twoDigit: true },
      { kind: "sub", max: 1000, borrow: true },
    ],
    glowingForms: [
      { kind: "div", tables: [3, 4, 6, 7, 8, 9], upTo: 12 },
      { kind: "twoStep", tables: [4, 6, 7, 8, 9], upTo: 12, max: 500 },
    ],
    boss: {
      rescue: 6,
      forms: [{ kind: "div", tables: [6, 7, 8, 9], upTo: 12 }],
    },
  },
}

/**
 * The seasons in play order.
 * @type {Season[]}
 */
export const SEASON_LIST = SEASON_ORDER.map((id) => SEASONS[id])

/**
 * Look up a season by id.
 *
 * Returns null rather than a default for an unknown id. There is no safe
 * fallback: substituting spring for a save that says winter would quietly throw
 * away three seasons of progress, so the caller has to decide what to do.
 *
 * @param {unknown} id - A season id
 * @returns {Season|null} The season, or null if the id is unknown
 */
export function getSeason(id) {
  return typeof id === "string" && Object.hasOwn(SEASONS, id) ? SEASONS[id] : null
}

/**
 * The season after this one in play order.
 *
 * @param {unknown} id - A season id
 * @returns {Season|null} The next season, or null after winter or for an
 *   unknown id -- the caller distinguishes those by checking `getSeason` first
 */
export function nextSeason(id) {
  const index = SEASON_ORDER.indexOf(/** @type {string} */ (id))
  if (index === -1 || index === SEASON_ORDER.length - 1) return null
  return SEASONS[SEASON_ORDER[index + 1]]
}

/**
 * Whether a space is a glowing one -- a harder question, worth more, drawn with
 * the light Ella described.
 *
 * `glowingAt` is checked rather than assumed. Every real season has one, but
 * Journey.js promises its callers that a malformed season degrades rather than
 * throws, and this is the function that promise passes through.
 *
 * @param {Season} season - The season being played
 * @param {number} index - 0-based space index
 * @returns {boolean} True if the space glows
 */
export function isGlowing(season, index) {
  return Array.isArray(season?.glowingAt) && season.glowingAt.includes(index)
}

/**
 * The most items a perfect run of a season can collect, for a character with
 * the given glowing-space value.
 *
 * This exists so seasons.test.js can assert every demand is actually reachable.
 * Editing a season's numbers without checking this is how a season becomes
 * quietly impossible.
 *
 * @param {Season} season - The season to measure
 * @param {number} [glowingItems] - Items per glowing space; defaults to the
 *   unmodified PLAY.ITEMS_PER_GLOWING_SPACE value
 * @returns {number} Items collected by answering every space correctly, before
 *   the boss's rescue
 */
export function maxItems(season, glowingItems = 3) {
  if (!season || !Array.isArray(season.glowingAt) || !Number.isFinite(season.spaces)) return 0
  const glowing = season.glowingAt.length
  const ordinary = season.spaces - glowing
  return ordinary + glowing * glowingItems
}

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
 * - Keep every ordinary question in mental range: the answer has to be found and
 *   four choices read before the countdown ends, so anything that wants written
 *   vertical maths is not something this format can fairly ask. Two-digit
 *   multiplication keeps its product within 100 (`tables` no higher than 5,
 *   `upTo` no higher than 20) -- grade 3 caps there, and `6 x 19` was reachable
 *   before the tables were cut. Addition and subtraction stay within a few
 *   hundred: autumn's 400 and winter's 600 are already three-digit column
 *   arithmetic, and the 1000 they replaced made every carry a written one.
 *   Nothing enforces either ceiling.
 * - Ella's rule for the operations: "addition, subtraction, multiplication,
 *   maybe with division as the hardest one in a level." Division is therefore
 *   the whole of every season's `glowingForms` and every boss -- reaching the
 *   lit mountain is what earns the hard operation -- and never appears in
 *   ordinary `forms`, which seasons.test.js enforces.
 *
 * Reachability: `maxItems` below is what a perfect run collects, and
 * seasons.test.js asserts every demand is reachable by every character with
 * headroom to spare, so a retune cannot quietly make a season impossible. The
 * Banana Slug is always the binding case; ../README.md says why.
 *
 * Error Handling: `getSeason` returns null for an unknown id. Unlike a
 * character, there is no sensible fallback season -- playing spring when the
 * save says winter would silently erase progress -- so the caller must handle it.
 */

import { SEASON_ORDER } from "./constants.js"
import { isHardKind } from "./obstacles.js"

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
 * @property {string[]} route       - One obstacle kind per space, in order.
 *                                    Its length is the trail length, and the
 *                                    mountains in it are the hard spaces --
 *                                    see obstacles.js. `spaces` and
 *                                    `glowingAt` are derived from it below, so
 *                                    the route is the single place a trail is
 *                                    tuned.
 * @property {number} spaces        - Derived: route.length
 * @property {number[]} glowingAt   - Derived: indices of the hard obstacles
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
    route: [
      "hill",
      "river",
      "thicket",
      "boulder",
      "mountain",
      "gap",
      "hill",
      "river",
      "thicket",
      "mountain",
      "boulder",
      "gap",
      "hill",
      "river",
    ],
    demand: 11,
    timerSeconds: null,
    challenge: "arithmetic",
    forms: [
      { kind: "add", max: 100 },
      { kind: "sub", max: 100 },
      { kind: "mul", tables: [2, 5, 10], upTo: 10 },
    ],
    glowingForms: [{ kind: "div", tables: [2, 5, 10], upTo: 10 }],
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
    route: [
      "river",
      "thicket",
      "boulder",
      "mountain",
      "gap",
      "hill",
      "river",
      "thicket",
      "mountain",
      "boulder",
      "gap",
      "hill",
      "river",
      "mountain",
      "thicket",
      "boulder",
    ],
    demand: 13,
    timerSeconds: 20,
    challenge: "arithmetic",
    forms: [
      { kind: "mul", tables: [2, 3, 4, 5, 6, 7, 8, 9, 10], upTo: 10 },
      { kind: "add", max: 200, borrow: true },
      { kind: "sub", max: 200, borrow: true },
    ],
    glowingForms: [{ kind: "div", tables: [2, 3, 4, 5, 6, 7, 8, 9, 10], upTo: 10 }],
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
    route: [
      "thicket",
      "boulder",
      "gap",
      "mountain",
      "hill",
      "river",
      "thicket",
      "mountain",
      "boulder",
      "gap",
      "hill",
      "mountain",
      "river",
      "thicket",
      "boulder",
      "mountain",
      "gap",
      "hill",
    ],
    demand: 15,
    timerSeconds: 18,
    challenge: "arithmetic",
    forms: [
      { kind: "mul", tables: [2, 3, 4, 5], upTo: 15, twoDigit: true },
      { kind: "add", max: 400, borrow: true },
      { kind: "sub", max: 400, borrow: true },
    ],
    glowingForms: [{ kind: "div", tables: [3, 4, 6, 7, 8, 9], upTo: 12 }],
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
    route: [
      "gap",
      "hill",
      "river",
      "mountain",
      "thicket",
      "boulder",
      "gap",
      "mountain",
      "hill",
      "river",
      "thicket",
      "mountain",
      "boulder",
      "gap",
      "hill",
      "mountain",
      "river",
      "thicket",
      "mountain",
      "boulder",
    ],
    demand: 17,
    timerSeconds: 16,
    challenge: "arithmetic",
    forms: [
      { kind: "twoStep", tables: [2, 3, 4, 5, 6, 7, 8, 9], upTo: 12, max: 300 },
      { kind: "mul", tables: [2, 3, 4, 5], upTo: 20, twoDigit: true },
      { kind: "sub", max: 600, borrow: true },
    ],
    glowingForms: [{ kind: "div", tables: [6, 7, 8, 9], upTo: 12 }],
    boss: {
      rescue: 6,
      forms: [{ kind: "div", tables: [6, 7, 8, 9], upTo: 12 }],
    },
  },
}

// `spaces` and `glowingAt` are derived rather than authored. They used to be
// written by hand alongside the trail length, which meant three numbers had to
// agree and nothing checked that they did. Now the route is the only thing to
// edit, and these are computed from it once at load.
for (const season of Object.values(SEASONS)) {
  season.spaces = season.route.length
  season.glowingAt = season.route.flatMap((kind, index) => (isHardKind(kind) ? [index] : []))
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
 * The obstacle kind standing at a space.
 *
 * @param {Season} season - The season being played
 * @param {number} index - 0-based space index
 * @returns {string|null} The kind id, or null if the index is off the trail
 */
export function obstacleAt(season, index) {
  if (!Array.isArray(season?.route)) return null
  return season.route[index] ?? null
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

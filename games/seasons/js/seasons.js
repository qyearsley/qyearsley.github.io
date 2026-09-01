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
 *   vertical maths is not something this format can fairly ask. One rule covers
 *   it: **no single column operation goes past two digits, and every individual
 *   fact stays inside 100.** So addition and subtraction cap at `max: 100`, and
 *   `div` caps at `upTo: 10` (a quotient of 12 on the 9 table is `108 ÷ 9`,
 *   which is outside the grade-3 tables). Escalation comes from the number of
 *   mental steps instead: one fact, then a fact plus a regrouping, then a fact
 *   scaled by ten, then two chained operations.
 * - Answers still get large, which is fine -- `9 × 80` is on grade (3.NBT.A.3)
 *   and purely mental. What is banned is column work, not size.
 * - Ella's rule for the operations: "addition, subtraction, multiplication,
 *   maybe with division as the hardest one in a level." The constraint that
 *   matters is one-directional: division never appears in ordinary `forms`,
 *   which seasons.test.js enforces. A hard slot is free to ask something else,
 *   and winter's does -- by then plain division within 100 has run out of room,
 *   so its climax is the two-step instead.
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
 * One-digit × a multiple of ten, as a `mul` form's `tables`.
 *
 * This is grade 3's 3.NBT.A.3 -- "multiply one-digit whole numbers by multiples
 * of 10 in the range 10-90" -- and it needs no new form kind, because `mul`
 * already means "one operand from `tables`, the other 2..upTo". It is the job
 * autumn's old `4 × 17` was doing illegitimately: large answers, place-value
 * practice, and not one column of written arithmetic.
 *
 * A season takes a slice of this with `tensTo`, because how far the range runs
 * is its own difficulty dial -- see below.
 * @type {number[]}
 */
const TENS = [10, 20, 30, 40, 50, 60, 70, 80, 90]

/**
 * The multiples of ten up to `highest`, as a `mul` form's `tables`.
 *
 * How far the range runs is a difficulty dial in its own right: `4 × 30` is a
 * gentler place-value question than `9 × 80`, and the two seasons that use tens
 * are separated by exactly this.
 * @param {number} highest - The largest multiple of ten to include
 * @returns {number[]} Multiples of ten, 10 up to `highest`
 */
const tensTo = (highest) => TENS.filter((table) => table <= highest)

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
    // One fact, or one two-digit sum that needs no regrouping. The gentlest the
    // game gets, and untimed to match.
    forms: [
      { kind: "add", max: 100 },
      { kind: "sub", max: 100 },
      { kind: "mul", tables: [2, 3, 4, 5, 10], upTo: 10 },
    ],
    glowingForms: [{ kind: "div", tables: [2, 5, 10], from: 4, upTo: 10 }],
    boss: {
      rescue: 3,
      // Wider than the glowing spaces, so the boss is not a rerun of them.
      forms: [{ kind: "div", tables: [2, 3, 4, 5, 10], from: 5, upTo: 10 }],
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
    timerSeconds: 30,
    challenge: "arithmetic",
    // The step up is the regrouping, and the whole times table rather than the
    // easy half of it.
    forms: [
      { kind: "mul", tables: [2, 3, 4, 5, 6, 7, 8, 9, 10], upTo: 10 },
      { kind: "add", max: 100, borrow: true },
      { kind: "sub", max: 100, borrow: true },
    ],
    glowingForms: [{ kind: "div", tables: [2, 3, 4, 5, 6, 7, 8, 9, 10], from: 4, upTo: 10 }],
    boss: {
      rescue: 4,
      forms: [{ kind: "div", tables: [4, 6, 7, 8, 9], from: 5, upTo: 10 }],
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
    timerSeconds: 28,
    challenge: "arithmetic",
    // Two steps up: the facts lose the easiest two, and place value arrives as
    // `7 × 40`. Subtraction stops escalating here on purpose -- two-digit
    // regrouping is the mental ceiling, so once a season has it there is nowhere
    // on-grade left to go.
    forms: [
      { kind: "mul", tables: [2, 3, 4, 6, 7, 8, 9], upTo: 10 },
      { kind: "sub", max: 100, borrow: true },
      { kind: "mul", tables: tensTo(50), upTo: 9 },
    ],
    glowingForms: [{ kind: "div", tables: [3, 4, 6, 7, 8, 9], from: 5, upTo: 10 }],
    boss: {
      rescue: 5,
      forms: [{ kind: "div", tables: [6, 7, 8, 9], from: 6, upTo: 10 }],
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
    timerSeconds: 25,
    challenge: "arithmetic",
    // Nearly all hard facts, and the tens run further than autumn's. The 4 table
    // and the stop at 70 are both deliberate: with the 6-9 facts alone and tens
    // to 90 there was no breather anywhere on the trail, and it played as a
    // wall. The ordinary spaces have reached the on-grade ceiling for a single
    // mental step, so winter's escalation lives in the hard slots below.
    forms: [
      { kind: "mul", tables: [4, 6, 7, 8, 9], upTo: 10 },
      { kind: "sub", max: 100, borrow: true },
      { kind: "mul", tables: tensTo(70), upTo: 9 },
    ],
    // The one season whose lit mountains are not simply division. Two chained
    // operations is grade 3's own two-step standard (3.OA.D.8) and the only
    // thing left that is harder than a single fact without leaving the grade;
    // the division form keeps Ella's hardest-operation rule alive alongside it.
    glowingForms: [
      { kind: "twoStep", tables: [4, 6, 7, 8, 9], from: 5, upTo: 10, max: 100 },
      { kind: "div", tables: [6, 7, 8, 9], from: 6, upTo: 10 },
    ],
    boss: {
      rescue: 6,
      // The two-step alone, so the last question of the game is the hardest
      // shape it has rather than a coin flip between two.
      forms: [{ kind: "twoStep", tables: [6, 7, 8, 9], from: 6, upTo: 10, max: 100 }],
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

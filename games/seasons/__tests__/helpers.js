/**
 * Fixtures and readers shared by the Seasons suites.
 *
 * Jest treats this file as a module rather than a suite, because `testMatch` is
 * `**\/*.test.js` and this is not one.
 *
 * Only things two or more suites genuinely need live here. The point is not
 * tidiness: it is that a content change in `seasons.js` or `characters.js`
 * should cost one edit, not thirty. So the readers below take a season apart
 * rather than restating its copy, and the assertions that use them say what the
 * game has to do ("names the collectible") instead of what it currently says
 * ("+1 rose").
 *
 * Where an exact sentence really is the contract -- the count line's shape, the
 * pluralisation of the rare item -- the suite pins it in one clearly commented
 * place, usually against `madeUpSeason` so that Ella retuning spring does not
 * rewrite a copy assertion that has nothing to do with the retune.
 *
 * The rule helpers at the bottom are here for the same reason: `RULES` is a
 * pair of undecided design switches, so no suite may assume the value either
 * one happens to be shipping with today.
 */

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { afterEach, beforeEach, it } from "@jest/globals"

import { BOSS_TRIES, RULES } from "../js/constants.js"

const HERE = dirname(fileURLToPath(import.meta.url))

/** The shipped markup, read once for the whole run. */
export const INDEX_HTML = readFileSync(join(HERE, "..", "index.html"), "utf-8")

/** Just what is inside `<body>`, for suites that mount the page fragment. */
export const INDEX_BODY = INDEX_HTML.replace(/[\s\S]*<body[^>]*>/i, "").replace(
  /<\/body>[\s\S]*/i,
  "",
)

/**
 * Put the real page body in the document, with no classes left over from the
 * previous test. Does not run scripts: assigning to `innerHTML` never does.
 * @returns {void}
 */
export function mountIndexBody() {
  document.body.innerHTML = INDEX_BODY
  document.body.className = ""
}

/**
 * Replace the whole document with the real page, `<head>` included. `game.js`
 * self-starts on import, so this is what "reload the page" means for it.
 * @returns {void}
 */
export function mountIndexDocument() {
  document.documentElement.innerHTML = INDEX_HTML.replace(/<!DOCTYPE[^>]*>/i, "")
  document.body.className = ""
}

/** An element by id, for the readers below. */
const byId = (id) => document.getElementById(id)

/**
 * The result summary as `[label, value]` pairs, in the order drawn.
 * @returns {string[][]} One pair per row
 */
export const summaryRows = () =>
  Array.from(document.querySelectorAll("#result-summary .summary-row")).map((row) => [
    row.firstElementChild.textContent,
    row.lastElementChild.textContent,
  ])

/**
 * The buttons on the result screen, in the order drawn.
 * @returns {HTMLButtonElement[]} The action buttons
 */
export const resultButtons = () => Array.from(document.querySelectorAll("#result-actions button"))

/**
 * The answer buttons currently on screen, in the order drawn.
 * @returns {HTMLButtonElement[]} The choice buttons
 */
export const choiceButtons = () => Array.from(document.querySelectorAll("#choices button"))

/**
 * The item-track slots currently on screen.
 * @returns {Element[]} The pips
 */
export const pips = () => Array.from(document.querySelectorAll("#item-track .item-pip"))

/** A season's collectible, singular, exactly as the game writes it in a sentence. */
export const one = (season) => season.itemName.toLowerCase()

/** A season's collectible, plural, exactly as the game writes it in a sentence. */
export const many = (season) => season.itemPlural.toLowerCase()

/**
 * The noun for a count of items -- singular only at one.
 * @param {Object} season - The season being played
 * @param {number} count - How many
 * @returns {string} The lowercase noun
 */
export const itemNoun = (season, count) => (count === 1 ? one(season) : many(season))

/** The HUD count line, unparsed. Empty string when the HUD has not been drawn. */
export const countLine = () => byId("item-count")?.textContent ?? ""

/**
 * The HUD count line taken apart.
 *
 * Tests that care about *how many items the player has* should assert on the
 * parsed fields rather than on the whole sentence, so renaming a collectible or
 * retuning a demand does not rewrite them. `line` comes back too, so a failing
 * `toMatchObject` prints the sentence that produced it instead of leaving you
 * with "expected 1, received 0".
 *
 * The sentence's exact shape is pinned once, in GameUI.test.js.
 *
 * @returns {{line: string, items: number|null, demand: number|null,
 *   noun: string|null, remaining: number|null, enough: boolean|null}}
 *   The parsed line, with nulls if it did not parse at all
 */
export function hudCount() {
  const line = countLine()
  const match = /^(\d+) of (\d+) (.+?) — (?:(\d+) to go|she has enough)$/.exec(line)
  if (!match) return { line, items: null, demand: null, noun: null, remaining: null, enough: null }
  return {
    line,
    items: Number(match[1]),
    demand: Number(match[2]),
    noun: match[3],
    remaining: match[4] === undefined ? null : Number(match[4]),
    enough: match[4] === undefined,
  }
}

/**
 * A season-shaped object whose copy and numbers belong to the tests.
 *
 * Use this wherever a test pins an exact rendered sentence. Pinning one against
 * spring means that changing spring's demand, or its collectible, breaks a copy
 * assertion about a formatting rule that did not change -- which is the friction
 * that stops anyone running the suite. Sweeps over the *real* seasons still
 * happen, but they assert derivation ("names this season's own collectible")
 * rather than a literal.
 *
 * @param {Object} [overrides] - Fields to replace
 * @returns {Object} A Season-shaped object
 */
export function madeUpSeason(overrides = {}) {
  return {
    id: "testing",
    name: "Testing",
    itemName: "Pebble",
    itemPlural: "Pebbles",
    rareItemName: "Shining Pebble",
    demandText: "Six pebbles, and be quick about it.",
    spaces: 10,
    glowingAt: [3, 7],
    demand: 6,
    timerSeconds: null,
    challenge: "arithmetic",
    forms: [{ kind: "add", max: 20 }],
    glowingForms: [{ kind: "div", tables: [2], upTo: 5 }],
    boss: { rescue: 2, forms: [{ kind: "div", tables: [2], upTo: 5 }] },
    ...overrides,
  }
}

/**
 * The shipped values of the two rule switches, read once at import time and so
 * before any test has had a chance to change them.
 */
const DEFAULT_RULES = { ...RULES }

/**
 * Make every test in the file start and end on the shipped rules.
 *
 * Call this once at the top level of a suite, above any other hook. `RULES` is
 * a mutable object in constants.js -- deliberately not frozen -- so a test can
 * put a different design option in force simply by assigning to it. This is the
 * single save/restore that stops one doing so from leaking into whatever Jest
 * runs next, and it runs whether or not the test changed anything and whether
 * or not it failed part way through.
 *
 * @returns {void}
 */
export function restoreRulesBetweenTests() {
  beforeEach(() => {
    Object.assign(RULES, DEFAULT_RULES)
  })

  afterEach(() => {
    Object.assign(RULES, DEFAULT_RULES)
  })
}

/**
 * Put the given rules in force for every test in the enclosing describe block.
 *
 * Call this at the top of a describe block instead of writing a bespoke
 * `beforeEach`/`afterEach` pair. There is no matching teardown to forget:
 * `restoreRulesBetweenTests` owns the restore.
 *
 * The assignment happens in a `beforeEach`, so it lands after any hook an
 * enclosing block registered. That is fine for anything that reads `RULES` when
 * it runs -- which is everything in GameState and GameUI -- but a block whose
 * *setup* depends on the rule should do that setup in its own `beforeEach`,
 * declared after this call.
 *
 * @param {Object} rules - The switches to change
 * @param {string} [rules.wrongAnswer] - A WRONG_ANSWER option
 * @param {string} [rules.bossFailure] - A BOSS_FAILURE option
 * @returns {void}
 */
export function useRules({ wrongAnswer, bossFailure } = {}) {
  beforeEach(() => {
    if (wrongAnswer !== undefined) RULES.WRONG_ANSWER = wrongAnswer
    if (bossFailure !== undefined) RULES.BOSS_FAILURE = bossFailure
  })
}

/**
 * `it`, unless the boss is single-shot.
 *
 * `BOSS_TRIES` is a plain number rather than a field on a mutable object, so a
 * test cannot pin it the way `useRules` pins a rule. Setting it to 1 is a
 * supported tuning choice ("make the boss single-shot again"), and it deletes
 * the second try rather than changing it -- so the cases about what the second
 * try does have nothing left to assert and skip themselves instead of failing.
 */
export const itWithASecondTry = BOSS_TRIES > 1 ? it : it.skip

/** A zeroed lifetime-totals block, the shape `defaultSave` starts from. */
export const zeroTotals = () => ({
  runsCompleted: 0,
  seasonsCleared: 0,
  questionsAnswered: 0,
  questionsCorrect: 0,
})

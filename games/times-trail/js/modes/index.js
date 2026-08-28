/**
 * Mode registry and dispatcher for Times Trail
 *
 * One registered mode today: `modes/quickRecall.js`, which shows "7 × 6 = ?".
 * This module is the single place that maps a **mode id** to the implementation
 * behind it, so `game.js` can say "give me a challenge for `6x7` in
 * `quick-recall`" and get one back without ever importing a mode, naming a mode
 * function, or branching on which mode is active. Phase 2 adds the rest.
 *
 * Architecture: a frozen registry (`MODES`) of `ModeDefinition` records plus three
 * thin lookups over it -- `getMode`, `modeIds`, and a `createChallenge` that
 * dispatches by id. There is deliberately no logic here beyond the lookup: the
 * registry adds no fields to a challenge, rewrites none, and validates none, so
 * whatever a mode returns is exactly what the caller receives. A mode's own module
 * remains the only authority on its challenge.
 *
 * Why a registry rather than a `switch`:
 *
 *   - **Mixed Practice (Phase 2)** rotates mode ids through this same dispatcher.
 *     It needs to enumerate the available modes (`MODES` / `modeIds()`) and then
 *     ask for one by id, which a `switch` inside `game.js` cannot offer.
 *   - **The menu and the dispatcher cannot drift.** `MODES` carries the label
 *     alongside the implementation, both drawn from `constants.js`, so a mode that
 *     exists is a mode that can be rendered and a mode that can be asked for.
 *   - **Adding a mode is one entry**, in one file, in menu order.
 *
 * The uniform `Challenge` contract (§ 12.1) is what makes the dispatch worth
 * having, and it is a contract about *every* mode, not a description of one:
 *
 * | key       | type                        | guarantee                                                |
 * |-----------|-----------------------------|----------------------------------------------------------|
 * | `modeId`  | string                      | The `MODE_IDS` value of the mode that built it            |
 * | `factId`  | string                      | Canonical fact id, e.g. `"6x7"`                           |
 * | `left`    | number                      | Left operand as displayed                                 |
 * | `right`   | number                      | Right operand as displayed                                |
 * | `answer`  | number                      | `left * right`                                            |
 * | `prompt`  | string                      | The question, ready to render                             |
 * | `entry`   | `"tiles"\|"keypad"`         | The one authority on the entry affordance                 |
 * | `options` | `number[]\|null`            | Non-null **iff** `entry === "tiles"`                      |
 * | `visual`  | Object                      | Mode-specific render data, discriminated by `visual.kind` |
 * | `check`   | `(input: *) => boolean`     | The one authority on correctness                          |
 * | `scaffold`| Scaffold                    | The post-miss teaching array (§ 12.5)                     |
 *
 * Eleven keys, the same eleven from every mode. `game.js` therefore has no
 * mode-specific branch in its answer path: it renders by `challenge.entry` and
 * `challenge.visual.kind`, scores by `challenge.entry`, and decides correctness
 * with `challenge.check` -- never by recomputing an entry mode or comparing an
 * input to `challenge.answer` itself. A mode is free to accept more input types
 * than the entry paths currently produce, and only `check` knows which.
 *
 * Determinism and purity: this module holds no state, reads no clock, and consumes
 * no randomness of its own. `settings` and `rng` are passed straight through,
 * positionally and unchanged, so a mode's documented rng-call count is also the
 * dispatcher's (1 call on Quick Recall's keypad path). No `document`, `window`,
 * `localStorage`, or `setTimeout`, and no argument is ever mutated.
 */

import { MODE_IDS, MODE_LABELS } from "../constants.js"
import { createChallenge as createQuickRecallChallenge } from "./quickRecall.js"

/**
 * @typedef {import("../facts.js").Fact} Fact
 */

/**
 * @typedef {import("./quickRecall.js").Scaffold} Scaffold
 */

/**
 * @typedef {import("./quickRecall.js").Challenge} Challenge
 */

/**
 * One registered mode: its id, its menu label, and the function that builds its
 * challenges. `id` is a `MODE_IDS` value and `label` is the matching
 * `MODE_LABELS` entry, so neither can drift from the shared contract.
 * @typedef {Object} ModeDefinition
 * @property {string} id - A `MODE_IDS` value, e.g. `"quick-recall"`
 * @property {string} label - Human-readable name from `MODE_LABELS`
 * @property {(fact: Fact, settings?: Object, rng?: () => number) => Challenge} createChallenge
 *   The mode's own builder, referenced rather than wrapped
 */

/**
 * Every mode the game can ask for, in menu order. Quick Recall is the only one:
 * Array Builder was cut because the post-miss array scaffold already teaches the
 * area model, on the fact just missed, in fewer taps.
 *
 * Frozen, array and entries alike, so a UI or mode module cannot rewrite the
 * registry it was handed. Labels come from `MODE_LABELS` rather than being spelled
 * again here -- one string, one home.
 * @type {readonly ModeDefinition[]}
 */
export const MODES = Object.freeze([
  Object.freeze({
    id: MODE_IDS.QUICK_RECALL,
    label: MODE_LABELS[MODE_IDS.QUICK_RECALL],
    createChallenge: createQuickRecallChallenge,
  }),
])

/**
 * Id -> definition index, built once at module load.
 *
 * A `Map` rather than a plain object on purpose: a `Map` has no prototype chain, so
 * `getMode("toString")` and `getMode("constructor")` are misses like any other
 * unknown id instead of returning a function that would then be called as a mode.
 * @private
 * @type {Map<string, ModeDefinition>}
 */
const MODES_BY_ID = new Map(MODES.map((mode) => [mode.id, mode]))

/**
 * Look up a mode by id.
 *
 * Total and non-throwing: anything that is not the id of a registered mode --
 * `"nope"`, `null`, `undefined`, `42`, an object, a `Object.prototype` key -- is
 * simply `null`. Callers that must not proceed without a mode should use
 * `createChallenge`, which throws instead.
 * @param {*} modeId - Candidate mode id; a non-string is never a match
 * @returns {ModeDefinition|null} The frozen definition, or `null` if unregistered
 */
export function getMode(modeId) {
  if (typeof modeId !== "string") return null
  return MODES_BY_ID.get(modeId) ?? null
}

/**
 * The ids of every registered mode, in menu order.
 *
 * A fresh array each call, so a caller may sort, filter, or shuffle it -- which is
 * exactly what Phase 2's Mixed Practice will do -- without disturbing `MODES`.
 * @returns {string[]} A new array of `MODE_IDS` values in menu order
 */
export function modeIds() {
  return MODES.map((mode) => mode.id)
}

/**
 * Build a challenge in the named mode.
 *
 * This is the whole point of the module: `game.js` names a mode and a fact and
 * receives a `Challenge` honouring the uniform contract in the file header, with
 * no knowledge of which module produced it. `settings` and `rng` are forwarded
 * positionally and unmodified, and the mode's return value is passed back
 * untouched -- nothing here inspects, copies, or amends it.
 *
 * Error handling: an unregistered `modeId` is a programming error, not player
 * input, so it throws rather than falling back to a default mode. A silent
 * fallback would let a typo in a saved mode id quietly change what is being
 * practised, which is worse than a loud failure. `fact` validation belongs to the
 * mode -- an invalid fact still raises the mode's own
 * `TypeError("createChallenge requires a Fact")`.
 * @param {*} modeId - A `MODE_IDS` value naming the mode to dispatch to
 * @param {Fact} fact - The fact to ask, from `facts.js`
 * @param {Object} [settings] - Challenge context (§ 12.1): `{strength?, inputModeFor?}`
 * @param {() => number} [rng] - Source of randomness in [0, 1); defaults to `Math.random`
 * @returns {Challenge} The mode's challenge, exactly as the mode returned it
 * @throws {RangeError} If `modeId` names no registered mode
 * @throws {TypeError} From the mode itself, if `fact` is not a `Fact`
 */
export function createChallenge(modeId, fact, settings = {}, rng = Math.random) {
  const mode = getMode(modeId)
  if (mode === null) {
    throw new RangeError(`Unknown mode: ${modeId}`)
  }
  return mode.createChallenge(fact, settings, rng)
}

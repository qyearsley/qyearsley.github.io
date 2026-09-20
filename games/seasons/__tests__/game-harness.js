/**
 * Harness for the end-to-end `game.*.test.js` suites, which drive game.js
 * black-box through the real index.html.
 *
 * Jest treats this file as a module rather than a suite, because `testMatch` is
 * `**\/*.test.js` and this is not one. The suites are split by subject only so
 * that Jest can run them in parallel -- a suite runs in one worker, and as one
 * file these tests were a seventh of the repository's whole wall clock.
 * Everything they share is here, so the setup is still one edit.
 *
 * `game.js` exports nothing -- it is the page entry point and calls `start()` as
 * it evaluates -- so there is no class to construct and no bootstrap event to
 * dispatch. Importing the module *is* starting the game. That is why this file
 * clicks real buttons and dispatches real events instead of calling methods: it
 * is the only way to reach the module at all, and it has the side benefit of
 * covering the wiring between GameState, StorageManager, and GameUI on the
 * shipped markup. The approach follows `games/times-trail/__tests__/game.test.js`.
 *
 * Three pieces of setup are specific to this game:
 *
 * - Because the module self-starts, "reload the page" means importing it again.
 *   ESM caches by specifier, so each load appends a unique query string. The
 *   modules game.js imports stay cached, which is fine -- none of them holds
 *   per-page state; only game.js does.
 * - The questions come from a run seed, so the test cannot know the answer up
 *   front. It reads the save the game just wrote and runs it back through
 *   `rehydrate`, which is exactly how a reloading page recovers the question on
 *   screen. That keeps the tests deterministic without pinning a seed or reaching
 *   into the module.
 * - Some situations take a long time to play into -- the boss with too few
 *   items, the middle of timed summer -- so `seedSave` writes a save describing
 *   one and boots onto it. That is the same path a returning player takes, and
 *   it keeps a five-line test from needing twenty clicks of setup.
 *
 * One consequence of reloading by re-importing: the `keydown` and
 * `visibilitychange` listeners a previous load put on `document` are still
 * there, and `BaseGameUI.setText` looks its target up by id rather than using a
 * cached node, so an older instance can still write to the live page. The
 * newest load always registers last and therefore paints last, which is why
 * this matters in practice only for assertions about something the *current*
 * load deliberately does not draw. Prefer asserting on the save or on the
 * screen the current load owns.
 *
 * Spring is untimed, so no countdown interferes there; fake timers are here for
 * the 900ms answer flash, which is one of the two things gating the next
 * question, and for the countdown in the seasons that do have one.
 *
 * The other gate is the crossing. Every space is an obstacle, and a correct
 * answer gets the character over the one it was standing at, so `_onAnswer`
 * waits on the promise `GameUI.crossObstacle` returns before it asks anything
 * else. Fake timers do not touch the microtask queue, so advancing past the
 * flash is no longer enough on its own: `landAnswer` below is the one place that
 * knows the cycle has two waits in it, which is why every helper that answers
 * correctly is `async` and every call to one has to be awaited. A wrong answer
 * crosses nothing and stays synchronous on purpose -- see `answerWrongly`.
 *
 * jsdom implements no Web Animations API at all, so left alone `crossObstacle`
 * takes its no-animation fallback and hands back an already-resolved promise.
 * That would make "during the crossing" a window one microtask wide and would
 * leave the path a real browser takes untested, so this file installs a small
 * fake `Element.animate` instead and holds the crossing open for exactly as long
 * as a test needs it. See `installFakeAnimations`.
 *
 * Finally, nothing here may inherit a rule. `RULES.WRONG_ANSWER` and
 * `RULES.BOSS_FAILURE` are undecided design switches, so a test that depends on
 * one pins it with `useRules` (see helpers.js) and names it, and a test that
 * only wanted *some* state change is written not to care which.
 */

import { afterEach, beforeEach, expect, jest } from "@jest/globals"
import { BOSS_TRIES, PLAY, SEASON_ORDER, STORAGE } from "../js/constants.js"
import { createState, rehydrate, startSeason } from "../js/GameState.js"
import { GameUI } from "../js/GameUI.js"
import { isHardKind } from "../js/obstacles.js"
import { getSeason } from "../js/seasons.js"
import { toSavedRun } from "../js/storage.js"
import { many, mountIndexDocument, restoreRulesBetweenTests, zeroTotals } from "./helpers.js"

export const SPRING = getSeason("spring")
export const SUMMER = getSeason("summer")
export const LAST_SEASON = getSeason(SEASON_ORDER[SEASON_ORDER.length - 1])

/**
 * Player-facing copy this file pins on purpose, collected in one place.
 *
 * Everything else about the result screens is asserted by shape -- that the
 * losing text states both numbers, that the winning text names the collectible
 * -- precisely so Ella can rewrite the villain's voice without a red suite. But
 * the *titles* are how a test tells one branch of `_renderResult` from another,
 * and there is no shape-level way to say "this is the end-of-run screen and not
 * the end-of-season one". So they are pinned, and pinned here: rewording them is
 * one edit to this block.
 */
export const TITLE = {
  runComplete: "The potion is finished",
  seasonComplete: (season) => `${season.name} complete`,
  seasonLost: "Not quite enough",
  runOver: "Back to the beginning",
}

/**
 * What a perfect run of a season banks: every ordinary space, every glowing one
 * at the default rate, and the boss's rescue on top.
 *
 * @param {Object} season - The season to measure
 * @returns {number} Items delivered by a run that misses nothing
 */
export function perfectRun(season) {
  return (
    (season.spaces - season.glowingAt.length) * PLAY.ITEMS_PER_SPACE +
    season.glowingAt.length * PLAY.ITEMS_PER_GLOWING_SPACE +
    season.boss.rescue
  )
}

export const PERFECT_SPRING = perfectRun(SPRING)

/** The answer flash, in ms: what `GameUI.flashDuration` reports and a player waits. */
export const FLASH_MS = 900

/** Every fake animation the current test has created, oldest first. */
let animations = []

/**
 * Give jsdom enough of the Web Animations API for a crossing to be watched.
 *
 * jsdom implements none of it, so without this `GameUI.crossObstacle` takes its
 * no-animation fallback: the character teleports and the promise it returns is
 * already resolved. These fakes stay running until a test finishes them, which
 * is what lets the guard cases below be about the animation rather than about
 * promise scheduling, and it means the tests drive the path a browser really
 * takes.
 *
 * Only what GameUI touches is implemented -- `finished`, `playState`, `finish()`
 * -- and nothing here knows how long a crossing lasts. The durations belong to
 * the art pack, and to art.test.js.
 */
function installFakeAnimations() {
  animations = []
  // Reached through `window` rather than the bare global, which the lint config
  // does not list: `Element` is not a global any page script here needs.
  window.Element.prototype.animate = function fakeAnimate() {
    let land
    const animation = {
      playState: "running",
      finished: new Promise((resolve) => {
        land = resolve
      }),
      finish() {
        this.playState = "finished"
        land(this)
      },
    }
    animations.push(animation)
    return animation
  }
}

/** Take the fake API away again, so nothing outside this file ever sees it. */
function removeFakeAnimations() {
  delete window.Element.prototype.animate
  animations = []
}

/** Whether a crossing is still playing. */
export const isCrossing = () => animations.some((animation) => animation.playState === "running")

/** Land the character now, the way the end of the real animation would. */
export function finishCrossing() {
  for (const animation of animations) {
    if (animation.playState === "running") animation.finish()
  }
}

/**
 * Let the crossing's promise chain run out.
 *
 * There is nothing to advance: fake timers do not fake microtasks, so the chain
 * only needs turns. Three is what it costs today -- the `catch` and the `then`
 * inside `crossObstacle`, then the `then` in `_onAnswer` -- and the loop runs a
 * couple more so that adding a link to that chain does not turn this whole file
 * red.
 */
export async function settleCrossing() {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve()
  }
}

/**
 * Watch the crossings the game starts, without changing them: the spy calls
 * through, so the animation still runs and the promise still gates the next
 * question.
 *
 * `crossObstacle` is the boundary between the orchestrator and the screen, which
 * makes it the honest place to ask what game.js decided to cross -- there is
 * nothing on the page that says which obstacle an animation was for.
 *
 * @returns {Object} The spy, on the prototype so it catches the live instance
 */
export const watchCrossings = () => jest.spyOn(GameUI.prototype, "crossObstacle")

/** Bumped per load so each import gets a fresh module instance. */
let loadCount = 0

/**
 * Reset the document to the real markup and let the game start on it. Does not
 * touch localStorage, so calling it twice models a reload.
 * @returns {Promise<void>} Resolves once the game has drawn its first screen
 */
export async function boot() {
  mountIndexDocument()
  loadCount += 1
  await import(`../js/game.js?load=${loadCount}`)
}

export const byId = (id) => document.getElementById(id)
export const isActive = (id) => byId(id).classList.contains("active")
export const cards = () => Array.from(document.querySelectorAll("#character-grid .character-card"))
export const choices = () => Array.from(document.querySelectorAll("#choices button"))

/**
 * The label the run-complete summary gives a season: its own name and its own
 * collectible, which is the whole point of that screen existing.
 * @param {string} id - A season id
 * @returns {string} The row label
 */
export const seasonRowLabel = (id) => `${getSeason(id).name} — ${many(getSeason(id))}`

/** The verdict under the question. */
export const feedback = () => byId("feedback").textContent

/** How many item slots are filled in. */
export const earnedPips = () => document.querySelectorAll("#item-track .item-pip.is-earned").length

/**
 * Where the trail says the character is standing.
 *
 * Every space is an obstacle now, drawn once per season, and nothing is ticked
 * off as the player goes past it -- the token moves and the accessible label
 * follows. So this label is what a test reads to see the character travel, and
 * it is the only thing on the play screen that says so.
 *
 * @returns {{space: number, of: number}|null} The 1-based space and the trail's
 *   length, or null once the trail is behind them and the label says that instead
 */
export function trailSpace() {
  const label = document.querySelector("#trail .trail-svg")?.getAttribute("aria-label") ?? ""
  const match = /space (\d+) of (\d+)/.exec(label)
  return match ? { space: Number(match[1]), of: Number(match[2]) } : null
}

/**
 * The first space in a season's route standing at the given obstacle, and with
 * something else after it.
 *
 * Asked of the real route rather than remembered: Ella reorders the obstacles
 * and adds kinds, so a test that knows "space 4 is the mountain" is a test that
 * breaks when she does. The "something else after it" half matters just as much
 * -- with two of a kind in a row, crossing the obstacle behind you and crossing
 * the one ahead of you look identical.
 *
 * @param {Object} season - The season to search
 * @param {string} kind - An obstacle kind id, from obstacles.js
 * @returns {number} The 0-based space index
 */
export function spaceFacing(season, kind) {
  const index = season.route.findIndex(
    (entry, i) => entry === kind && i + 1 < season.route.length && season.route[i + 1] !== kind,
  )
  expect(index).toBeGreaterThanOrEqual(0)
  return index
}

/**
 * An ordinary space: no hard obstacle, so no glow, and far enough along that a
 * step backwards from it is a real move rather than a clamp at zero.
 *
 * @param {Object} season - The season to search
 * @returns {number} The 0-based space index
 */
export function ordinarySpace(season) {
  const index = season.route.findIndex((kind, i) => i > 0 && !isHardKind(kind))
  expect(index).toBeGreaterThanOrEqual(1)
  return index
}

/** The save the game has written, parsed. */
export const saved = () => JSON.parse(localStorage.getItem(STORAGE.KEY))

/**
 * The question currently on screen, recovered the way a reload recovers it.
 * @returns {Object} The live question, with its `answer`
 */
export function liveQuestion() {
  return rehydrate(saved().run).question
}

/** Index of the button holding the correct answer. */
export function correctIndex() {
  const answer = String(liveQuestion().answer)
  const index = choices().findIndex((button) => button.dataset.value === answer)
  expect(index).toBeGreaterThanOrEqual(0)
  return index
}

/** Tap a character card by id. */
export function chooseCharacter(id) {
  byId("character-grid").querySelector(`[data-character-id="${id}"]`).click()
}

/** Press a key the way the keyboard fallback expects. */
export function pressKey(key, modifiers = {}) {
  document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...modifiers }))
}

/** The letter that presses the nth choice: 0 -> "a", 1 -> "b", and so on. */
export function choiceKey(index) {
  return String.fromCodePoint("a".codePointAt(0) + index)
}

/** Tap the right answer. Does not wait out the flash. */
export function tapRight() {
  choices()[correctIndex()].click()
}

/**
 * Tap an answer that is not the right one.
 * @returns {number} The answer it should have been, for checking the copy
 */
export function tapWrong() {
  const answer = liveQuestion().answer
  choices()[(correctIndex() + 1) % PLAY.CHOICE_COUNT].click()
  return answer
}

/**
 * Wait out the flash, land the character, and let the next screen be drawn. The
 * one place that knows the answer cycle has two waits in it.
 */
export async function landAnswer() {
  jest.advanceTimersByTime(FLASH_MS)
  finishCrossing()
  await settleCrossing()
}

/**
 * Tap the right answer and let the whole cycle finish, so that the next question
 * -- or the result screen -- is on the page once this resolves. Must be awaited.
 */
export async function answerCorrectly() {
  tapRight()
  await landAnswer()
}

/**
 * Tap a wrong answer and let the flash run out.
 *
 * Synchronous, unlike `answerCorrectly`, and that is the point: a wrong answer
 * crosses nothing, so `_onAnswer` asks the next question from inside the flash
 * timeout with no promise in between. If a wrong answer ever does start a
 * crossing, every sequence built on this helper stops finding its buttons rather
 * than quietly drifting.
 */
export function answerWrongly() {
  tapWrong()
  jest.advanceTimersByTime(FLASH_MS)
}

/**
 * Miss the boss question until there are no tries left, so the failure rule
 * has to resolve the season. Spends `BOSS_TRIES` rather than a hard-coded two,
 * because making the boss single-shot again is a supported tuning change.
 */
export function missEveryBossTry() {
  for (let i = 0; i < BOSS_TRIES; i += 1) {
    answerWrongly()
  }
}

/**
 * Play the season on screen without missing anything, until the result screen
 * takes over. The cap is a guard against an infinite loop, not a real bound.
 */
export async function playSeasonPerfectly(limit = 40) {
  for (let i = 0; i < limit && isActive("screen-play"); i += 1) {
    await answerCorrectly()
  }
  expect(isActive("screen-result")).toBe(true)
}

/**
 * Write a save describing a run mid-flight, so a test can boot straight into a
 * position that would otherwise take twenty clicks to reach.
 *
 * @param {Object} [run] - Fields to override on a freshly started season
 * @param {Object} [save] - Fields to override on the surrounding save
 */
export function seedSave(run = {}, save = {}) {
  const characterId = run.characterId ?? "sloth"
  const seasonId = run.seasonId ?? "spring"
  const base = startSeason({ ...createState(4242), characterId }, seasonId)
  localStorage.setItem(
    STORAGE.KEY,
    JSON.stringify({
      version: STORAGE.VERSION,
      run: toSavedRun({ ...base, ...run }),
      unlocked: ["spring"],
      totals: zeroTotals(),
      ...save,
    }),
  )
}

/** Clear storage, seed a run, and boot onto it. */
export async function bootInto(run = {}, save = {}) {
  localStorage.clear()
  seedSave(run, save)
  await boot()
}

/**
 * The save fragment a test passes when it is about the countdown.
 *
 * The clock is off by default as of 2026-09-18, so a seeded save has none
 * unless it says so. A test that wants to watch the clock has to ask, which is
 * the right way round: the tests that do not ask now run the game the way a
 * player who never opens settings gets it.
 */
export const TIMED = { settings: { timer: true } }

/**
 * Install the per-test setup every `game.*.test.js` suite needs: fake timers,
 * the fake Web Animations API, a cleared storage, and a freshly started game.
 *
 * Call it once at the top of a suite, before any `describe`. It registers the
 * rules save/restore as well, so a suite that also calls `useRules` still gets
 * the value back afterwards -- see helpers.js.
 *
 * @returns {void}
 */
export function setupGameHarness() {
  restoreRulesBetweenTests()

  beforeEach(async () => {
    jest.useFakeTimers()
    installFakeAnimations()
    localStorage.clear()
    await boot()
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
    jest.restoreAllMocks()
    removeFakeAnimations()
  })
}

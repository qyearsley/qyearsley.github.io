/**
 * Seasons GameState -- the whole rulebook, exercised end to end.
 *
 * This is the game's most important suite: GameState.js is the only module that
 * knows what a wrong answer costs, when a season ends, and whether the run is
 * finished, so everything asserted here is a rule someone can play against.
 *
 * Questions are a pure function of the state's seed, season, `attempt` and
 * `questionsAsked`, so a test can simply read `state.question.answer`.
 * `answerRight` passes that value and `answerWrong` passes it plus one, which
 * keeps long scripted sequences ("three right, one wrong, one right") readable
 * and free of hand-written arithmetic.
 *
 * The file used to open with a second technique: a save/restore around the
 * mutable `RULES` object, so one block could play under `WRONG_ANSWER.WILT` and
 * the next under `STEP_BACK`. Both switches were settled on 2026-09-21 and
 * deleted with every option behind them, so there is one rulebook now and
 * nothing for a block to pin. What replaced those blocks is `the retry rule`
 * below, which is the same body of behaviour with no configuration in it.
 */

import { describe, expect, it } from "@jest/globals"

import { getCharacter } from "../js/characters.js"
import { PHASE, PLAY, SEASON_ORDER } from "../js/constants.js"
import {
  advance,
  answer,
  chooseCharacter,
  countingItems,
  createState,
  questionSeconds,
  rehydrate,
  remainingDemand,
  startSeason,
} from "../js/GameState.js"
import { getSeason, maxItems } from "../js/seasons.js"

/** A fixed run seed. Every question in this file derives from it. */
const SEED = 20240229

/** Spring, the season nearly every test plays. */
const SPRING = getSeason("spring")

/** The zeroed outcome `answer` returns when it is called in a dead phase. */
const ZERO_OUTCOME = {
  correct: false,
  retry: false,
  hinted: false,
  reinforce: null,
  extra: false,
  itemsGained: 0,
  glowing: false,
  reachedBoss: false,
  wasBoss: false,
  rescued: 0,
  phase: PHASE.CHARACTER_SELECT,
}

/**
 * Answer the current question correctly, by reading the answer off the state.
 * @param {Object} state - A state showing a question
 * @returns {{state: Object, outcome: Object}} The result of `answer`
 */
function answerRight(state) {
  return answer(state, state.question.answer)
}

/**
 * Answer the current question wrongly. One more than the answer is never right
 * and is always a number, so it takes the same path as a mistaken tap.
 * @param {Object} state - A state showing a question
 * @returns {{state: Object, outcome: Object}} The result of `answer`
 */
function answerWrong(state) {
  return answer(state, state.question.answer + 1)
}

/**
 * A deep copy of a state, for proving `answer` left its argument alone.
 *
 * `structuredClone` would be the obvious tool, but jest's jsdom environment
 * does not expose it, and a game state is by design entirely serializable, so a
 * JSON round trip is an equally deep copy here.
 * @param {Object} state - The state to copy
 * @returns {Object} A detached deep copy
 */
function deepClone(state) {
  return JSON.parse(JSON.stringify(state))
}

/**
 * Start a run as the given character, in spring, with the fixed seed.
 * @param {string} characterId - The animal to play
 * @param {number} [seed] - Run seed
 * @returns {Object} A state in PHASE.TRAIL
 */
function startAs(characterId, seed = SEED) {
  return chooseCharacter(createState(seed), characterId)
}

/**
 * Answer `count` questions correctly in a row.
 * @param {Object} state - The starting state
 * @param {number} count - How many correct answers
 * @returns {Object} The state afterwards
 */
function rightTimes(state, count) {
  let current = state
  for (let index = 0; index < count; index += 1) current = answerRight(current).state
  return current
}

/**
 * Walk the rest of the trail correctly, stopping in front of the boss.
 *
 * Counts from the state's current position rather than assuming 0, so it can be
 * used to finish a season that is already part-played. Answering past the boss
 * would resolve the season and leave `question` null, which shows up as a
 * confusing null dereference rather than a clear failure.
 *
 * @param {Object} state - A state anywhere on the trail
 * @returns {Object} A state in PHASE.BOSS showing the boss question
 */
function playToBoss(state) {
  return rightTimes(state, getSeason(state.seasonId).spaces - state.position)
}

/**
 * A state standing at the spring boss, with counters staged. The trail is
 * really walked so the boss question is a genuine one; only the bookkeeping
 * fields are overwritten, and none of those feed question generation.
 * @param {string} characterId - The animal to play
 * @param {Object} [overrides] - Fields to force, e.g. `{items: 0}`
 * @returns {Object} A state in PHASE.BOSS
 */
function atSpringBoss(characterId, overrides = {}) {
  return { ...playToBoss(startAs(characterId)), ...overrides }
}

describe("createState", () => {
  it("returns the documented defaults", () => {
    expect(createState()).toEqual({
      phase: PHASE.CHARACTER_SELECT,
      characterId: "banana-slug",
      seasonId: null,
      seed: 1,
      attempt: 0,
      position: 0,
      items: 0,
      retrying: false,
      owed: 0,
      extrasDone: 0,
      hintsLeft: 0,
      streak: 0,
      bestStreak: 0,
      questionsAsked: 0,
      correctCount: 0,
      question: null,
      collected: {},
    })
  })

  it("keeps a custom seed", () => {
    expect(createState(SEED).seed).toBe(SEED)
  })

  it("floors a fractional seed and falls back to 1 for a non-finite one", () => {
    expect(createState(7.9).seed).toBe(7)
    expect(createState(Number.NaN).seed).toBe(1)
    expect(createState("nonsense").seed).toBe(1)
  })
})

describe("chooseCharacter", () => {
  it("starts the first season on the trail with a question", () => {
    const state = startAs("sloth")
    expect(state.phase).toBe(PHASE.TRAIL)
    expect(state.seasonId).toBe(SEASON_ORDER[0])
    expect(state.seasonId).toBe("spring")
    expect(state.position).toBe(0)
    expect(state.items).toBe(0)
    expect(state.question).toMatchObject({
      prompt: expect.any(String),
      answer: expect.any(Number),
    })
    expect(state.question.choices).toHaveLength(PLAY.CHOICE_COUNT)
    expect(state.question.choices).toContain(state.question.answer)
  })

  it("keeps the run seed", () => {
    expect(startAs("sloth").seed).toBe(SEED)
  })

  it.each([
    { characterId: "phoenix", hints: 1 },
    { characterId: "banana-slug", hints: 0 },
    { characterId: "sloth", hints: 0 },
    { characterId: "porcupine", hints: 0 },
  ])("gives $characterId hintsLeft $hints", ({ characterId, hints }) => {
    expect(startAs(characterId).hintsLeft).toBe(hints)
  })

  it("falls back to the banana slug for an unknown character id", () => {
    expect(startAs("wombat").characterId).toBe("banana-slug")
    expect(startAs("wombat").characterId).toBe(getCharacter(null).id)
  })
})

describe("answer purity", () => {
  it("does not mutate the state it is given on a correct answer", () => {
    const state = rightTimes(startAs("sloth"), 4)
    const before = deepClone(state)
    answerRight(state)
    expect(state).toEqual(before)
  })

  it("does not mutate the state it is given on a wrong answer", () => {
    const state = rightTimes(startAs("sloth"), 3)
    const before = deepClone(state)
    answerWrong(state)
    expect(state).toEqual(before)
  })

  it("does not mutate the state it is given at the boss", () => {
    const state = atSpringBoss("sloth")
    const before = deepClone(state)
    answerRight(state)
    expect(state).toEqual(before)
  })
})

describe("correct answers", () => {
  it("advances one space and collects an ordinary space's items", () => {
    const state = startAs("sloth")
    const { state: next, outcome } = answerRight(state)
    expect(next.position).toBe(1)
    expect(next.items).toBe(PLAY.ITEMS_PER_SPACE)
    expect(outcome.correct).toBe(true)
    expect(outcome.itemsGained).toBe(PLAY.ITEMS_PER_SPACE)
    expect(outcome.glowing).toBe(false)
    expect(outcome.retry).toBe(false)
    expect(outcome.extra).toBe(false)
    expect(outcome.reachedBoss).toBe(false)
    expect(outcome.phase).toBe(PHASE.TRAIL)
  })

  it.each(["sloth", "banana-slug", "phoenix", "porcupine"])(
    "gives the %s the same glowing haul as everyone else",
    (characterId) => {
      // No perk touches an item count any more, and none may: a season's demand
      // is exactly what its trail plus its boss pays, so a character who
      // collected a different amount from a mountain could not reach it.
      const state = rightTimes(startAs(characterId), SPRING.glowingAt[0])
      expect(state.position).toBe(SPRING.glowingAt[0])
      const { state: next, outcome } = answerRight(state)
      expect(outcome.glowing).toBe(true)
      expect(outcome.itemsGained).toBe(PLAY.ITEMS_PER_GLOWING_SPACE)
      expect(next.items).toBe(
        SPRING.glowingAt[0] * PLAY.ITEMS_PER_SPACE + PLAY.ITEMS_PER_GLOWING_SPACE,
      )
    },
  )

  it("counts the streak, the correct answers, and the questions asked", () => {
    const state = rightTimes(startAs("sloth"), 3)
    expect(state.streak).toBe(3)
    expect(state.bestStreak).toBe(3)
    expect(state.correctCount).toBe(3)
    expect(state.questionsAsked).toBe(3)
  })

  it("keeps the best streak after it is broken", () => {
    const built = rightTimes(startAs("sloth"), 3)
    const broken = answerWrong(built).state
    expect(broken.streak).toBe(0)
    expect(broken.bestStreak).toBe(3)
    expect(broken.correctCount).toBe(3)
    expect(broken.questionsAsked).toBe(4)

    const rebuilt = answerRight(broken).state
    expect(rebuilt.streak).toBe(1)
    expect(rebuilt.bestStreak).toBe(3)
  })

  it("generates a fresh question after every answer", () => {
    let state = startAs("sloth")
    const prompts = []
    for (let index = 0; index < 6; index += 1) {
      prompts.push(state.question.prompt)
      const next = answerRight(state).state
      expect(next.question).not.toBe(state.question)
      expect(next.question.choices).toContain(next.question.answer)
      state = next
    }
    // Deterministic, but not stuck: six questions are not all the same one.
    expect(new Set(prompts).size).toBeGreaterThan(1)
  })

  it("is reproducible from the seed and diverges for a different one", () => {
    expect(startAs("sloth", 99).question).toEqual(startAs("sloth", 99).question)
    expect(startAs("sloth", 99).question).not.toEqual(startAs("sloth", 100).question)
  })
})

describe("the retry rule", () => {
  it("takes nothing away and keeps the player where she is", () => {
    const state = rightTimes(startAs("sloth"), 3)
    const { state: next, outcome } = answerWrong(state)
    expect(outcome.correct).toBe(false)
    expect(outcome.retry).toBe(true)
    expect(next.items).toBe(state.items)
    expect(next.position).toBe(state.position)
    expect(next.phase).toBe(PHASE.TRAIL)
  })

  it("keeps the very same question on screen", () => {
    // The whole point of the rule: she has to find the answer to the question
    // she missed, not be handed a different one.
    const state = rightTimes(startAs("sloth"), 3)
    const { state: next } = answerWrong(state)
    expect(next.question).toBe(state.question)
    expect(next.retrying).toBe(true)
  })

  it("still counts the question as asked, and still breaks the streak", () => {
    const state = rightTimes(startAs("sloth"), 3)
    const { state: next } = answerWrong(state)
    expect(next.questionsAsked).toBe(state.questionsAsked + 1)
    expect(next.correctCount).toBe(state.correctCount)
    expect(next.streak).toBe(0)
  })

  it("owes one extra question, and no more however many tries it takes", () => {
    const state = rightTimes(startAs("sloth"), 3)
    const once = answerWrong(state).state
    expect(once.owed).toBe(1)
    const twice = answerWrong(once).state
    expect(twice.owed).toBe(1)
    const thrice = answerWrong(twice).state
    expect(thrice.owed).toBe(1)
  })

  it("pays the debt with a question rather than an item", () => {
    const state = rightTimes(startAs("sloth"), 3)
    const missed = answerWrong(state).state
    const { state: next, outcome } = answerRight(missed)
    expect(outcome.correct).toBe(true)
    expect(outcome.extra).toBe(true)
    expect(outcome.itemsGained).toBe(0)
    expect(next.items).toBe(state.items)
    expect(next.position).toBe(state.position)
    expect(next.owed).toBe(0)
    expect(next.extrasDone).toBe(1)
    // A different question, because the debt is paid with a fresh one.
    expect(next.question).not.toBe(missed.question)
    expect(next.retrying).toBe(false)
  })

  it("pays out and moves on once the extra question is answered", () => {
    const state = rightTimes(startAs("sloth"), 3)
    const missed = answerWrong(state).state
    const extra = answerRight(missed).state
    const { state: next, outcome } = answerRight(extra)
    expect(outcome.itemsGained).toBe(PLAY.ITEMS_PER_SPACE)
    expect(outcome.extra).toBe(false)
    expect(next.items).toBe(state.items + PLAY.ITEMS_PER_SPACE)
    expect(next.position).toBe(state.position + 1)
  })

  it("adds no second extra when the extra question is missed too", () => {
    // `extrasDone` is the cap, and this is what it is for: without it every
    // miss added a question, so a space a child kept missing grew without end.
    const state = rightTimes(startAs("sloth"), 3)
    const extra = answerRight(answerWrong(state).state).state
    expect(extra.extrasDone).toBe(1)

    const missedAgain = answerWrong(extra).state
    expect(missedAgain.owed).toBe(0)
    expect(missedAgain.retrying).toBe(true)

    // So getting it right now pays out rather than buying a third question.
    const { state: next, outcome } = answerRight(missedAgain)
    expect(outcome.extra).toBe(false)
    expect(outcome.itemsGained).toBe(PLAY.ITEMS_PER_SPACE)
    expect(next.position).toBe(state.position + 1)
  })

  it("clears the per-space fields on the way to the next obstacle", () => {
    const state = rightTimes(startAs("sloth"), 3)
    const extra = answerRight(answerWrong(state).state).state
    const moved = answerRight(extra).state
    expect(moved.retrying).toBe(false)
    expect(moved.owed).toBe(0)
    expect(moved.extrasDone).toBe(0)
  })

  it("reinforces the fact once it is finally answered right", () => {
    const state = rightTimes(startAs("sloth"), 3)
    const missed = answerWrong(state).state
    const { outcome } = answerRight(missed)
    expect(outcome.reinforce).toMatchObject({
      equation: `${state.question.prompt} = ${state.question.answer}`,
    })
  })

  it("does not reinforce a question that was answered right first time", () => {
    expect(answerRight(startAs("sloth")).outcome.reinforce).toBeNull()
  })

  it("reinforces the extra question too, if that one is missed", () => {
    const state = rightTimes(startAs("sloth"), 3)
    const extra = answerRight(answerWrong(state).state).state
    const missedExtra = answerWrong(extra).state
    expect(answerRight(missedExtra).outcome.reinforce).not.toBeNull()
  })

  it("lets the porcupine skip the extra question", () => {
    const state = rightTimes(startAs("porcupine"), 3)
    const missed = answerWrong(state).state
    expect(missed.owed).toBe(0)
    expect(missed.retrying).toBe(true)

    // Still has to find the answer -- the perk buys the trip, not the question.
    const { state: next, outcome } = answerRight(missed)
    expect(outcome.extra).toBe(false)
    expect(outcome.reinforce).not.toBeNull()
    expect(outcome.itemsGained).toBe(PLAY.ITEMS_PER_SPACE)
    expect(next.position).toBe(state.position + 1)
  })

  it("treats a timeout, delivered as null, as an ordinary wrong answer", () => {
    const state = rightTimes(startAs("sloth"), 3)
    const { state: next, outcome } = answer(state, null)
    expect(outcome.correct).toBe(false)
    expect(outcome.retry).toBe(true)
    expect(next.items).toBe(state.items)
    expect(next.question).toBe(state.question)
    expect(next.streak).toBe(0)
  })
})

describe("the phoenix's hint", () => {
  it("fires on the first miss of the season and spends itself", () => {
    const state = rightTimes(startAs("phoenix"), 3)
    expect(state.hintsLeft).toBe(1)
    const { state: next, outcome } = answerWrong(state)
    expect(outcome.hinted).toBe(true)
    expect(next.hintsLeft).toBe(0)
  })

  it("does not fire twice in one season", () => {
    const state = rightTimes(startAs("phoenix"), 3)
    const spent = answerWrong(state).state
    expect(answerWrong(spent).outcome.hinted).toBe(false)
  })

  it("comes back for the next season", () => {
    const phoenix = startAs("phoenix")
    const spent = answerWrong(phoenix).state
    expect(spent.hintsLeft).toBe(0)
    const summer = startSeason(spent, "summer")
    expect(summer.hintsLeft).toBe(1)
  })

  it.each(["sloth", "banana-slug", "porcupine"])("is not given to the %s", (characterId) => {
    const state = startAs(characterId)
    expect(state.hintsLeft).toBe(0)
    expect(answerWrong(state).outcome.hinted).toBe(false)
  })
})

describe("questionSeconds", () => {
  it("gives the sloth ten extra seconds on a timed season", () => {
    expect(questionSeconds({ seasonId: "summer", characterId: "sloth" })).toBe(
      getSeason("summer").timerSeconds + 10,
    )
    expect(questionSeconds({ seasonId: "winter", characterId: "sloth" })).toBe(
      getSeason("winter").timerSeconds + 10,
    )
  })

  it("returns null for untimed spring, even for the sloth", () => {
    expect(questionSeconds({ seasonId: "spring", characterId: "sloth" })).toBeNull()
    expect(questionSeconds({ seasonId: "spring", characterId: "porcupine" })).toBeNull()
  })

  it("never runs a clock for the banana slug", () => {
    for (const seasonId of SEASON_ORDER) {
      expect(questionSeconds({ seasonId, characterId: "banana-slug" })).toBeNull()
    }
    // And the season really is timed for everyone else, or the assertion above
    // would pass for the wrong reason.
    expect(questionSeconds({ seasonId: "summer", characterId: "porcupine" })).not.toBeNull()
  })

  it("gives every other character the season's plain timer", () => {
    for (const characterId of ["phoenix", "porcupine"]) {
      expect(questionSeconds({ seasonId: "summer", characterId })).toBe(
        getSeason("summer").timerSeconds,
      )
    }
  })

  it("stops the clock for a question being retried", () => {
    // The one that matters. A timeout is a wrong answer, and a wrong answer
    // keeps the question -- so a clock on the retry would time the same
    // question out again forever, for exactly the child who could not answer
    // it. This is also the only thing guaranteeing a season makes progress.
    const timed = { seasonId: "summer", characterId: "porcupine", retrying: false }
    expect(questionSeconds(timed)).toBe(getSeason("summer").timerSeconds)
    expect(questionSeconds({ ...timed, retrying: true })).toBeNull()
  })

  it("returns null for a missing or unknown season", () => {
    expect(questionSeconds(null)).toBeNull()
    expect(questionSeconds({ seasonId: null, characterId: "sloth" })).toBeNull()
    expect(questionSeconds({ seasonId: "monsoon", characterId: "sloth" })).toBeNull()
  })
})

describe("reaching the boss", () => {
  it("switches to PHASE.BOSS on the answer that finishes the trail", () => {
    const lastSpace = rightTimes(startAs("sloth"), SPRING.spaces - 1)
    expect(lastSpace.phase).toBe(PHASE.TRAIL)
    expect(lastSpace.position).toBe(SPRING.spaces - 1)

    const { state: next, outcome } = answerRight(lastSpace)
    expect(outcome.reachedBoss).toBe(true)
    expect(outcome.wasBoss).toBe(false)
    expect(outcome.phase).toBe(PHASE.BOSS)
    expect(next.phase).toBe(PHASE.BOSS)
    expect(next.position).toBe(SPRING.spaces)
  })

  it("does not report reachedBoss before the end of the trail", () => {
    const state = rightTimes(startAs("sloth"), SPRING.spaces - 2)
    expect(answerRight(state).outcome.reachedBoss).toBe(false)
  })

  it("draws the boss question from boss.forms", () => {
    const boss = playToBoss(startAs("sloth"))
    // Division is reserved for the glowing spaces and the boss -- Ella's
    // "division as the hardest one in a level" -- so spring's boss asks div and
    // nothing else.
    expect(SPRING.boss.forms.map((form) => form.kind)).toEqual(["div"])
    expect(boss.question.kind).toBe("div")
    expect(boss.question.choices).toHaveLength(PLAY.CHOICE_COUNT)
  })

  it("arrives exactly the boss's rescue short of the demand", () => {
    // The retune's whole point. Her question is the one that fills the jar, so
    // there is no trail left to walk after the demand is met.
    const boss = playToBoss(startAs("sloth"))
    expect(boss.items).toBe(maxItems(SPRING))
    expect(boss.items).toBe(SPRING.demand - SPRING.boss.rescue)
    expect(remainingDemand(boss)).toBe(SPRING.boss.rescue)
    expect(boss.correctCount).toBe(SPRING.spaces)
  })
})

describe("boss resolution", () => {
  it("adds the season's rescue and reports it", () => {
    const boss = atSpringBoss("sloth")
    const { state: next, outcome } = answerRight(boss)
    expect(outcome.wasBoss).toBe(true)
    expect(outcome.rescued).toBe(SPRING.boss.rescue)
    expect(outcome.itemsGained).toBe(0)
    expect(next.items).toBe(boss.items + SPRING.boss.rescue)
  })

  it("wins the season and records exactly what was delivered", () => {
    const { state: next, outcome } = answerRight(atSpringBoss("sloth"))
    expect(outcome.phase).toBe(PHASE.SEASON_WON)
    expect(next.phase).toBe(PHASE.SEASON_WON)
    expect(next.question).toBeNull()
    expect(next.items).toBe(SPRING.demand)
    expect(next.collected.spring).toBe(SPRING.demand)
  })

  it("does not move the token off the boss space", () => {
    const boss = atSpringBoss("sloth")
    expect(answerRight(boss).state.position).toBe(boss.position)
  })

  it("takes no further answers once the season is resolved", () => {
    const won = answerRight(atSpringBoss("sloth")).state
    const again = answer(won, won.question?.answer ?? 1)
    expect(again.state).toBe(won)
    expect(again.outcome.itemsGained).toBe(0)
  })

  it("clears the per-space fields as it resolves", () => {
    const missed = answerWrong(atSpringBoss("sloth")).state
    const extra = answerRight(missed).state
    const won = answerRight(extra).state
    expect(won.phase).toBe(PHASE.SEASON_WON)
    expect(won.retrying).toBe(false)
    expect(won.owed).toBe(0)
    expect(won.extrasDone).toBe(0)
  })
})

describe("a missed boss question", () => {
  it("costs nothing and keeps her question up", () => {
    const boss = atSpringBoss("sloth")
    const { state: next, outcome } = answerWrong(boss)
    expect(outcome.retry).toBe(true)
    expect(outcome.rescued).toBe(0)
    expect(next.phase).toBe(PHASE.BOSS)
    expect(next.items).toBe(boss.items)
    expect(next.question).toBe(boss.question)
  })

  it("never ends the season, however many times it is missed", () => {
    // There is no lost phase. Her question retries like any other, so a season
    // that has started always ends in SEASON_WON.
    let state = atSpringBoss("sloth")
    for (let i = 0; i < 8; i += 1) state = answerWrong(state).state
    expect(state.phase).toBe(PHASE.BOSS)
    expect(state.items).toBe(SPRING.demand - SPRING.boss.rescue)
  })

  it("owes her one more question before the season resolves", () => {
    const boss = atSpringBoss("sloth")
    const missed = answerWrong(boss).state
    expect(missed.owed).toBe(1)

    const { state: extra, outcome } = answerRight(missed)
    expect(outcome.extra).toBe(true)
    expect(outcome.rescued).toBe(0)
    expect(extra.phase).toBe(PHASE.BOSS)
    expect(extra.items).toBe(boss.items)
    expect(extra.question).not.toBe(missed.question)

    const { state: won, outcome: last } = answerRight(extra)
    expect(last.rescued).toBe(SPRING.boss.rescue)
    expect(won.phase).toBe(PHASE.SEASON_WON)
    expect(won.items).toBe(SPRING.demand)
  })

  it("draws the extra question from boss.forms too", () => {
    const extra = answerRight(answerWrong(atSpringBoss("sloth")).state).state
    expect(extra.question.kind).toBe("div")
  })

  it("lets the porcupine finish without the extra question", () => {
    const boss = atSpringBoss("porcupine")
    const missed = answerWrong(boss).state
    expect(missed.owed).toBe(0)
    const { state: won, outcome } = answerRight(missed)
    expect(outcome.rescued).toBe(SPRING.boss.rescue)
    expect(won.phase).toBe(PHASE.SEASON_WON)
    expect(won.items).toBe(SPRING.demand)
  })
})

describe("advance", () => {
  /** Win spring outright, so `advance` has a real SEASON_WON state to move on from. */
  function wonSpring() {
    return answerRight(playToBoss(startAs("sloth"))).state
  }

  it("starts the next season with the per-season fields reset", () => {
    const won = wonSpring()
    const summer = advance(won)
    expect(summer.phase).toBe(PHASE.TRAIL)
    expect(summer.seasonId).toBe("summer")
    expect(summer.position).toBe(0)
    expect(summer.items).toBe(0)
    expect(summer.retrying).toBe(false)
    expect(summer.owed).toBe(0)
    expect(summer.extrasDone).toBe(0)
    expect(summer.streak).toBe(0)
    expect(summer.questionsAsked).toBe(0)
    expect(summer.correctCount).toBe(0)
    expect(summer.question).not.toBeNull()
  })

  it("keeps what belongs to the run rather than the season", () => {
    const won = wonSpring()
    const summer = advance(won)
    expect(summer.collected).toEqual(won.collected)
    expect(summer.collected.spring).toBe(SPRING.demand)
    expect(summer.bestStreak).toBe(won.bestStreak)
    expect(summer.bestStreak).toBe(SPRING.spaces + 1)
    expect(summer.seed).toBe(SEED)
    expect(summer.characterId).toBe("sloth")
  })

  it("completes the run after the last season", () => {
    const won = { ...wonSpring(), seasonId: SEASON_ORDER.at(-1) }
    const done = advance(won)
    expect(done.phase).toBe(PHASE.RUN_COMPLETE)
    expect(done.question).toBeNull()
    expect(done.collected).toEqual(won.collected)
  })

  it("falls back to CHARACTER_SELECT for an unknown season rather than finishing", () => {
    // `nextSeason` returns null both for "after winter" and for "no such
    // season", so a save naming a season that has since been renamed would read
    // as a completed run and hand out the ending screen. It has to fall out to
    // character select instead.
    const won = { ...wonSpring(), seasonId: "monsoon" }
    const next = advance(won)
    expect(next.phase).toBe(PHASE.CHARACTER_SELECT)
    expect(next.phase).not.toBe(PHASE.RUN_COMPLETE)
    expect(next.seasonId).toBeNull()
    expect(next.question).toBeNull()
    // The rest of the run survives, so nothing is silently thrown away.
    expect(next.collected).toEqual(won.collected)
    expect(next.bestStreak).toBe(won.bestStreak)
  })

  it("resets the attempt counter for the season it starts", () => {
    // A new season is always a first attempt, whatever the last one cost.
    const won = { ...wonSpring(), attempt: 3 }
    expect(advance(won).attempt).toBe(0)
  })

  it("is a no-op outside SEASON_WON", () => {
    const trail = startAs("sloth")
    expect(advance(trail)).toBe(trail)
    const boss = playToBoss(trail)
    expect(advance(boss)).toBe(boss)
    expect(advance(null)).toBeNull()
  })
})

describe("startSeason's attempt counter", () => {
  /**
   * The prompts of the next `count` questions, answered correctly as it goes.
   * @param {Object} state - A state showing a question
   * @param {number} count - How many prompts to collect
   * @returns {string[]} The prompts, in the order they were shown
   */
  function promptsFrom(state, count) {
    const prompts = []
    let current = state
    for (let index = 0; index < count; index += 1) {
      prompts.push(current.question.prompt)
      current = answerRight(current).state
    }
    return prompts
  }

  it("asks a different set of questions for a different attempt", () => {
    // `attempt` is folded into the question seed. Nothing in the game advances
    // it today -- a season can no longer be lost, so there is nothing to replay
    // -- but it is what a season picker would need to stop a replayed spring
    // opening with the exact questions it opened with the first time, and the
    // save and the rng key both still carry it.
    const first = startSeason(createState(SEED), "spring", 0)
    const second = startSeason(createState(SEED), "spring", 1)
    expect(promptsFrom(second, 6)).not.toEqual(promptsFrom(first, 6))
  })

  it("is deterministic for the same attempt", () => {
    const once = startSeason(createState(SEED), "spring", 2)
    const twice = startSeason(createState(SEED), "spring", 2)
    expect(promptsFrom(twice, 6)).toEqual(promptsFrom(once, 6))
  })

  it("coerces a nonsense attempt to zero rather than poisoning the seed", () => {
    const zero = startSeason(createState(SEED), "spring", 0)
    for (const bad of [-3, Number.NaN, "later", undefined]) {
      const state = startSeason(createState(SEED), "spring", bad)
      expect(state.attempt).toBe(0)
      expect(state.question).toEqual(zero.question)
    }
  })

  it("leaves the state alone for an unknown season", () => {
    const state = createState(SEED)
    expect(startSeason(state, "monsoon")).toBe(state)
  })

  it("starts every season at attempt zero through normal play", () => {
    const won = answerRight(playToBoss(startAs("sloth"))).state
    expect(advance(won).attempt).toBe(0)
  })
})

describe("answer guards", () => {
  it.each([PHASE.CHARACTER_SELECT, PHASE.SEASON_WON, PHASE.RUN_COMPLETE])(
    "returns the same state and a zeroed outcome in %s",
    (phase) => {
      const state = { ...startAs("sloth"), phase }
      const { state: next, outcome } = answer(state, 1)
      expect(next).toBe(state)
      expect(outcome).toEqual({ ...ZERO_OUTCOME, phase })
    },
  )

  it("cannot be double-scored by a repeated call after the season is won", () => {
    const won = answerRight(atSpringBoss("sloth")).state
    const first = answer(won, won.items)
    const second = answer(first.state, first.state.items)
    expect(first.state).toBe(won)
    expect(second.state).toBe(won)
    expect(second.outcome.itemsGained).toBe(0)
  })

  it("tolerates a null state", () => {
    const { state, outcome } = answer(null, 1)
    expect(state).toBeNull()
    expect(outcome).toEqual(ZERO_OUTCOME)
  })

  it("resolves a state naming an unknown season to CHARACTER_SELECT", () => {
    const broken = { ...startAs("sloth"), seasonId: "monsoon" }
    const { state, outcome } = answer(broken, 1)
    expect(state.phase).toBe(PHASE.CHARACTER_SELECT)
    expect(outcome).toEqual({ ...ZERO_OUTCOME, phase: PHASE.CHARACTER_SELECT })
  })
})

describe("rehydrate", () => {
  /**
   * A plausible saved run, the shape storage.normalizeSave hands over.
   * @param {Object} [overrides] - Fields to force
   * @returns {Object} A saved run
   */
  function saved(overrides = {}) {
    return {
      phase: PHASE.TRAIL,
      characterId: "sloth",
      seasonId: "spring",
      seed: SEED,
      attempt: 0,
      position: 3,
      items: 3,
      retrying: false,
      owed: 0,
      extrasDone: 0,
      hintsLeft: 0,
      streak: 3,
      bestStreak: 3,
      questionsAsked: 3,
      correctCount: 3,
      collected: {},
      ...overrides,
    }
  }

  it("restores the question a TRAIL save was showing", () => {
    const live = rightTimes(startAs("sloth"), 3)
    const restored = rehydrate({ ...live, question: null })
    expect(restored.phase).toBe(PHASE.TRAIL)
    expect(restored.position).toBe(3)
    expect(restored.question).toEqual(live.question)
  })

  it("restores a boss question for a BOSS save", () => {
    const restored = rehydrate(saved({ phase: PHASE.BOSS, position: SPRING.spaces }))
    expect(restored.phase).toBe(PHASE.BOSS)
    expect(restored.question).not.toBeNull()
    // Division is the boss form in every season now.
    expect(restored.question.kind).toBe("div")
  })

  it("restores the question of the attempt that was saved", () => {
    // `attempt` is part of the question seed, so a save made on a replay has to
    // come back showing that replay's question rather than the first attempt's.
    const first = rehydrate(saved({ attempt: 0 }))
    const replay = rehydrate(saved({ attempt: 1 }))
    expect(replay.attempt).toBe(1)
    expect(replay.question).not.toEqual(first.question)
  })

  it.each([PHASE.CHARACTER_SELECT, PHASE.SEASON_WON, PHASE.RUN_COMPLETE])(
    "leaves the question null in %s",
    (phase) => {
      const restored = rehydrate(saved({ phase }))
      expect(restored.question).toBeNull()
      expect(restored.phase).toBe(phase)
    },
  )

  it("clamps a position past the end of the trail", () => {
    const restored = rehydrate(saved({ phase: PHASE.SEASON_WON, position: 999 }))
    expect(restored.position).toBe(SPRING.spaces)
  })

  it("promotes a TRAIL save that has reached the end to BOSS", () => {
    const restored = rehydrate(saved({ phase: PHASE.TRAIL, position: SPRING.spaces }))
    expect(restored.phase).toBe(PHASE.BOSS)
    expect(restored.position).toBe(SPRING.spaces)
    expect(restored.question.kind).toBe("div")
  })

  it("keeps a retry a save was in the middle of", () => {
    // The debt and the untimed retry both survive a reload. The particular
    // question she was stuck on does not: `questionsAsked` has moved on, so a
    // different one comes back. Persisting the question would mean trusting a
    // save file to describe one, which this design has always refused to do.
    const restored = rehydrate(saved({ retrying: true, owed: 1, extrasDone: 0 }))
    expect(restored.retrying).toBe(true)
    expect(restored.owed).toBe(1)
    expect(restored.question).not.toBeNull()
  })

  it("demotes a BOSS save that is not actually at the end back to TRAIL", () => {
    const restored = rehydrate(saved({ phase: PHASE.BOSS, position: 2 }))
    expect(restored.phase).toBe(PHASE.TRAIL)
    expect(restored.position).toBe(2)
  })

  it("falls back to CHARACTER_SELECT for an unknown season", () => {
    const restored = rehydrate(saved({ seasonId: "monsoon" }))
    expect(restored.phase).toBe(PHASE.CHARACTER_SELECT)
    expect(restored.seasonId).toBeNull()
    expect(restored.question).toBeNull()
    // The rest of the run survives, so nothing is silently thrown away.
    expect(restored.bestStreak).toBe(3)
  })

  it("returns a fresh CHARACTER_SELECT state for a missing save", () => {
    expect(rehydrate(undefined)).toEqual({ ...createState(1), question: null })
    expect(rehydrate(null).phase).toBe(PHASE.CHARACTER_SELECT)
  })

  it("produces a state that plays on exactly like the one that was saved", () => {
    const live = rightTimes(startAs("sloth"), 5)
    const restored = rehydrate({ ...live, question: null })
    expect(answerRight(restored).state).toEqual(answerRight(live).state)
  })
})

describe("countingItems", () => {
  it("counts the items banked this season", () => {
    expect(countingItems({ items: 7 })).toBe(7)
    expect(countingItems({ items: 0 })).toBe(0)
  })

  it("never goes negative and tolerates a missing state", () => {
    expect(countingItems({ items: -5 })).toBe(0)
    expect(countingItems({})).toBe(0)
    expect(countingItems(null)).toBe(0)
    expect(countingItems(undefined)).toBe(0)
  })
})

describe("remainingDemand", () => {
  it("reports what is still owed", () => {
    expect(remainingDemand({ seasonId: "spring", items: 0 })).toBe(SPRING.demand)
    expect(remainingDemand({ seasonId: "spring", items: 4 })).toBe(SPRING.demand - 4)
  })

  it("is zero once the demand is met or beaten", () => {
    expect(remainingDemand({ seasonId: "spring", items: SPRING.demand })).toBe(0)
    expect(remainingDemand({ seasonId: "spring", items: SPRING.demand + 5 })).toBe(0)
  })

  it("is zero when there is no season", () => {
    expect(remainingDemand({ seasonId: null, items: 0 })).toBe(0)
    expect(remainingDemand({ seasonId: "monsoon", items: 0 })).toBe(0)
    expect(remainingDemand(null)).toBe(0)
  })
})

describe("a full playthrough", () => {
  it("clears spring by answering every question correctly", () => {
    const { state } = answerRight(playToBoss(startAs("sloth")))
    expect(state.phase).toBe(PHASE.SEASON_WON)
    expect(state.items).toBe(SPRING.demand)
    expect(remainingDemand(state)).toBe(0)
    expect(state.collected.spring).toBe(state.items)
    expect(state.correctCount).toBe(SPRING.spaces + 1)
  })

  it.each(["sloth", "banana-slug", "phoenix", "porcupine"])(
    "can be completed by the %s, all four seasons, without a single mistake",
    (characterId) => {
      let state = startAs(characterId)
      for (const seasonId of SEASON_ORDER) {
        const season = getSeason(seasonId)
        expect(state.phase).toBe(PHASE.TRAIL)
        expect(state.seasonId).toBe(seasonId)

        const { state: resolved, outcome } = answerRight(playToBoss(state))
        expect(outcome.wasBoss).toBe(true)
        expect(resolved.phase).toBe(PHASE.SEASON_WON)
        // Exactly the demand, not merely enough: the trail plus her question
        // pays the quota and not a rose more.
        expect(resolved.items).toBe(season.demand)
        expect(resolved.collected[seasonId]).toBe(season.demand)

        state = advance(resolved)
      }

      expect(state.phase).toBe(PHASE.RUN_COMPLETE)
      expect(Object.keys(state.collected).sort()).toEqual([...SEASON_ORDER].sort())
      const longestSeason = Math.max(...SEASON_ORDER.map((id) => getSeason(id).spaces))
      // The streak resets with each season, so the best is the longest season
      // plus its boss.
      expect(state.bestStreak).toBe(longestSeason + 1)
    },
  )

  it.each(["sloth", "banana-slug", "phoenix", "porcupine"])(
    "can be completed by the %s while missing every single question once",
    (characterId) => {
      // The worst run the rules allow, and it still finishes with a full jar.
      // That is the guarantee the retry rule buys: mistakes cost questions, so
      // the quota is never out of reach, only further away.
      let state = startAs(characterId)
      for (const seasonId of SEASON_ORDER) {
        const season = getSeason(seasonId)
        // One miss, one retry and one extra question at every space, the boss
        // included. The cap is a guard against a loop, not a real bound.
        for (let step = 0; step < 200 && state.phase !== PHASE.SEASON_WON; step += 1) {
          state = answerWrong(state).state
          state = answerRight(state).state
        }
        expect(state.phase).toBe(PHASE.SEASON_WON)
        expect(state.items).toBe(season.demand)
        // Every question was missed once, so the season cost strictly more
        // answers than it had correct ones. Asserted this way round because the
        // Porcupine skips the extra question, and so answers exactly one
        // question per space correctly where everyone else answers more.
        expect(state.questionsAsked).toBeGreaterThan(state.correctCount)
        state = advance(state)
      }
      expect(state.phase).toBe(PHASE.RUN_COMPLETE)
    },
  )

  it("takes about twice as many questions when every one is missed", () => {
    // The Porcupine skips the extra, so a miss costs her one retry rather than
    // a retry plus a question. Worth pinning: it is the only perk whose value
    // is measured in questions.
    const count = (characterId) => {
      let state = startAs(characterId)
      for (let step = 0; step < 200 && state.phase !== PHASE.SEASON_WON; step += 1) {
        state = answerWrong(state).state
        state = answerRight(state).state
      }
      return state.questionsAsked
    }
    const clean = SPRING.spaces + 1
    expect(count("porcupine")).toBe(clean * 2)
    expect(count("sloth")).toBeGreaterThan(count("porcupine"))
  })
})

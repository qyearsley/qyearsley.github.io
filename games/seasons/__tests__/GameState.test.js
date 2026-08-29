/**
 * Seasons GameState -- the whole rulebook, exercised end to end.
 *
 * This is the game's most important suite: GameState.js is the only module that
 * knows what a wrong answer costs, when a season ends, and whether the run is
 * finished, so everything asserted here is a rule someone can play against.
 *
 * Two techniques carry most of the file.
 *
 * 1. The two undecided design switches live in the mutable `RULES` object in
 *    constants.js, which is deliberately not frozen. Each describe block sets
 *    the rule it is about in `beforeEach` and restores the original value in
 *    `afterEach`, so all three WRONG_ANSWER options and all three BOSS_FAILURE
 *    options are covered without any module mocking, and the defaults are back
 *    in place for the next block whichever order Jest runs them in.
 *
 * 2. Questions are a pure function of the state's seed, season, and
 *    `questionsAsked`, so a test can simply read `state.question.answer`.
 *    `answerRight` passes that value and `answerWrong` passes it plus one,
 *    which keeps long scripted sequences ("three right, one wrong, one right")
 *    readable and free of hand-written arithmetic.
 */

import { afterEach, beforeEach, describe, expect, it } from "@jest/globals"

import { getCharacter } from "../js/characters.js"
import { BOSS_FAILURE, PHASE, PLAY, RULES, SEASON_ORDER, WRONG_ANSWER } from "../js/constants.js"
import {
  advance,
  answer,
  chooseCharacter,
  countingItems,
  createState,
  questionSeconds,
  rehydrate,
  remainingDemand,
  retry,
} from "../js/GameState.js"
import { getSeason } from "../js/seasons.js"

/** A fixed run seed. Every question in this file derives from it. */
const SEED = 20240229

/** Spring, the season nearly every test plays. */
const SPRING = getSeason("spring")

/** The zeroed outcome `answer` returns when it is called in a dead phase. */
const ZERO_OUTCOME = {
  correct: false,
  forgiven: false,
  itemsGained: 0,
  revived: 0,
  wiltedNow: 0,
  lostNow: 0,
  steppedBack: 0,
  doubled: false,
  glowing: false,
  reachedBoss: false,
  wasBoss: false,
  rescued: 0,
  shortfall: 0,
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
      position: 0,
      items: 0,
      wilting: 0,
      lost: 0,
      forgivenessLeft: 0,
      lastWasWrong: false,
      streak: 0,
      bestStreak: 0,
      questionsAsked: 0,
      correctCount: 0,
      question: null,
      collected: {},
      runOver: false,
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
    { characterId: "phoenix", forgiveness: 1 },
    { characterId: "banana-slug", forgiveness: 0 },
    { characterId: "sloth", forgiveness: 0 },
    { characterId: "porcupine", forgiveness: 0 },
  ])("gives $characterId forgivenessLeft $forgiveness", ({ characterId, forgiveness }) => {
    expect(startAs(characterId).forgivenessLeft).toBe(forgiveness)
  })

  it("falls back to the banana slug for an unknown character id", () => {
    expect(startAs("wombat").characterId).toBe("banana-slug")
    expect(startAs("wombat").characterId).toBe(getCharacter(null).id)
  })
})

describe("answer purity", () => {
  const original = RULES.WRONG_ANSWER

  beforeEach(() => {
    RULES.WRONG_ANSWER = WRONG_ANSWER.WILT
  })

  afterEach(() => {
    RULES.WRONG_ANSWER = original
  })

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
    expect(outcome.doubled).toBe(false)
    expect(outcome.reachedBoss).toBe(false)
    expect(outcome.phase).toBe(PHASE.TRAIL)
  })

  it.each([
    { characterId: "sloth", glowingItems: 3 },
    { characterId: "banana-slug", glowingItems: 2 },
  ])("gives $characterId $glowingItems on a glowing space", ({ characterId, glowingItems }) => {
    // Spring glows at spaces 4 and 9, so four correct answers stand on one.
    const state = rightTimes(startAs(characterId), SPRING.glowingAt[0])
    expect(state.position).toBe(SPRING.glowingAt[0])
    const { state: next, outcome } = answerRight(state)
    expect(outcome.glowing).toBe(true)
    expect(outcome.itemsGained).toBe(glowingItems)
    expect(next.items).toBe(SPRING.glowingAt[0] * PLAY.ITEMS_PER_SPACE + glowingItems)
  })

  it("counts the streak, the correct answers, and the questions asked", () => {
    const state = rightTimes(startAs("sloth"), 3)
    expect(state.streak).toBe(3)
    expect(state.bestStreak).toBe(3)
    expect(state.correctCount).toBe(3)
    expect(state.questionsAsked).toBe(3)
    expect(state.lastWasWrong).toBe(false)
  })

  it("keeps the best streak after it is broken", () => {
    const built = rightTimes(startAs("sloth"), 3)
    const broken = answerWrong(built).state
    expect(broken.streak).toBe(0)
    expect(broken.bestStreak).toBe(3)
    expect(broken.correctCount).toBe(3)
    expect(broken.questionsAsked).toBe(4)
    expect(broken.lastWasWrong).toBe(true)

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

describe("WRONG_ANSWER.GENTLE", () => {
  const original = RULES.WRONG_ANSWER

  beforeEach(() => {
    RULES.WRONG_ANSWER = WRONG_ANSWER.GENTLE
  })

  afterEach(() => {
    RULES.WRONG_ANSWER = original
  })

  it("takes nothing away", () => {
    const state = rightTimes(startAs("sloth"), 3)
    const { state: next, outcome } = answerWrong(state)
    expect(next.position).toBe(3)
    expect(next.items).toBe(3)
    expect(next.wilting).toBe(0)
    expect(next.lost).toBe(0)
    expect(outcome.correct).toBe(false)
    expect(outcome.wiltedNow).toBe(0)
    expect(outcome.lostNow).toBe(0)
    expect(outcome.steppedBack).toBe(0)
    expect(outcome.itemsGained).toBe(0)
  })

  it("still resets the streak and asks a new question", () => {
    const state = rightTimes(startAs("sloth"), 3)
    const { state: next } = answerWrong(state)
    expect(next.streak).toBe(0)
    expect(next.bestStreak).toBe(3)
    expect(next.questionsAsked).toBe(4)
    expect(next.question).not.toBe(state.question)
    expect(next.question.choices).toContain(next.question.answer)
  })

  it("does not punish the phoenix's double scale either", () => {
    const state = rightTimes(startAs("phoenix"), 3)
    const forgiven = answerWrong(state).state
    // The free pass is NOT spent here. Under GENTLE a wrong answer already
    // costs nothing, and a perk that says "a wrong answer costs you nothing at
    // all" must not consume itself on one that was free anyway -- to a player
    // that is indistinguishable from the perk being broken.
    expect(forgiven.forgivenessLeft).toBe(1)
    const { state: next, outcome } = answerWrong(forgiven)
    expect(next.items).toBe(3)
    expect(next.wilting).toBe(0)
    expect(next.lost).toBe(0)
    expect(outcome.forgiven).toBe(false)
    expect(next.forgivenessLeft).toBe(1)
  })
})

describe("WRONG_ANSWER.WILT", () => {
  const original = RULES.WRONG_ANSWER

  beforeEach(() => {
    RULES.WRONG_ANSWER = WRONG_ANSWER.WILT
  })

  afterEach(() => {
    RULES.WRONG_ANSWER = original
  })

  it("moves penaltyScale items into wilting and loses nothing yet", () => {
    const state = rightTimes(startAs("sloth"), 3)
    const { state: next, outcome } = answerWrong(state)
    expect(next.items).toBe(2)
    expect(next.wilting).toBe(1)
    expect(next.lost).toBe(0)
    expect(next.position).toBe(3)
    expect(outcome.wiltedNow).toBe(1)
    expect(outcome.lostNow).toBe(0)
    expect(outcome.steppedBack).toBe(0)
  })

  it("revives the wilted items on the next correct answer", () => {
    const wilted = answerWrong(rightTimes(startAs("sloth"), 3)).state
    const { state: next, outcome } = answerRight(wilted)
    expect(outcome.revived).toBe(1)
    // 2 safe + 1 revived + 1 collected from the space just answered.
    expect(next.items).toBe(4)
    expect(next.wilting).toBe(0)
    expect(next.lost).toBe(0)
    expect(next.position).toBe(4)
  })

  it("flushes the first batch into lost on a second wrong answer in a row", () => {
    const first = answerWrong(rightTimes(startAs("sloth"), 3)).state
    expect(first.wilting).toBe(1)
    const { state: next, outcome } = answerWrong(first)
    expect(outcome.lostNow).toBe(1)
    expect(outcome.wiltedNow).toBe(1)
    expect(next.lost).toBe(1)
    expect(next.wilting).toBe(1)
    expect(next.items).toBe(1)
    // The three items are now one safe, one at risk, and one gone for good.
    expect(next.items + next.wilting + next.lost).toBe(3)
  })

  it("wilts nothing, and goes no lower than zero, when there are no items", () => {
    const state = startAs("sloth")
    expect(state.items).toBe(0)
    const { state: next, outcome } = answerWrong(state)
    expect(next.items).toBe(0)
    expect(next.wilting).toBe(0)
    expect(next.lost).toBe(0)
    expect(outcome.wiltedNow).toBe(0)
    expect(outcome.lostNow).toBe(0)
  })

  it("loses an existing batch even when there is nothing left to wilt", () => {
    // One item, wilted; a second wrong answer flushes it with nothing to replace it.
    const wilted = answerWrong(rightTimes(startAs("sloth"), 1)).state
    expect(wilted).toMatchObject({ items: 0, wilting: 1 })
    const { state: next, outcome } = answerWrong(wilted)
    expect(next.items).toBe(0)
    expect(next.wilting).toBe(0)
    expect(next.lost).toBe(1)
    expect(outcome.lostNow).toBe(1)
    expect(outcome.wiltedNow).toBe(0)
  })

  it("does not move the player or count wilting items toward the demand", () => {
    const wilted = answerWrong(rightTimes(startAs("sloth"), 3)).state
    expect(wilted.position).toBe(3)
    expect(countingItems(wilted)).toBe(2)
    expect(remainingDemand(wilted)).toBe(SPRING.demand - 2)
  })
})

describe("WRONG_ANSWER.STEP_BACK", () => {
  const original = RULES.WRONG_ANSWER

  beforeEach(() => {
    RULES.WRONG_ANSWER = WRONG_ANSWER.STEP_BACK
  })

  afterEach(() => {
    RULES.WRONG_ANSWER = original
  })

  it("steps back one space and loses one item outright", () => {
    const state = rightTimes(startAs("sloth"), 3)
    const { state: next, outcome } = answerWrong(state)
    expect(next.position).toBe(2)
    expect(next.items).toBe(2)
    expect(next.lost).toBe(1)
    expect(next.wilting).toBe(0)
    expect(outcome.steppedBack).toBe(1)
    expect(outcome.lostNow).toBe(1)
    expect(outcome.wiltedNow).toBe(0)
  })

  it("never steps below position zero or below zero items", () => {
    const state = startAs("sloth")
    const { state: next, outcome } = answerWrong(state)
    expect(next.position).toBe(0)
    expect(next.items).toBe(0)
    expect(next.lost).toBe(0)
    expect(outcome.steppedBack).toBe(0)
    expect(outcome.lostNow).toBe(0)
  })

  it("clamps the phoenix's double step against a short trail", () => {
    // Phoenix has penaltyScale 2, so this would be two spaces from position 1.
    const forgiven = answerWrong(rightTimes(startAs("phoenix"), 1)).state
    expect(forgiven).toMatchObject({ position: 1, items: 1, forgivenessLeft: 0 })
    const { state: next, outcome } = answerWrong(forgiven)
    expect(next.position).toBe(0)
    expect(next.items).toBe(0)
    expect(next.lost).toBe(1)
    expect(outcome.steppedBack).toBe(1)
    expect(outcome.lostNow).toBe(1)
  })

  it("takes the full double step when there is room", () => {
    const forgiven = answerWrong(rightTimes(startAs("phoenix"), 4)).state
    expect(forgiven).toMatchObject({ position: 4, items: 4 })
    const { state: next, outcome } = answerWrong(forgiven)
    expect(next.position).toBe(2)
    expect(next.items).toBe(2)
    expect(next.lost).toBe(2)
    expect(outcome.steppedBack).toBe(2)
    expect(outcome.lostNow).toBe(2)
  })
})

describe("banana slug", () => {
  const original = RULES.WRONG_ANSWER

  afterEach(() => {
    RULES.WRONG_ANSWER = original
  })

  it.each([WRONG_ANSWER.GENTLE, WRONG_ANSWER.WILT, WRONG_ANSWER.STEP_BACK])(
    "takes no penalty at all under %s",
    (rule) => {
      RULES.WRONG_ANSWER = rule
      const state = rightTimes(startAs("banana-slug"), 3)
      const { state: next, outcome } = answerWrong(state)
      expect(next.position).toBe(3)
      expect(next.items).toBe(3)
      expect(next.wilting).toBe(0)
      expect(next.lost).toBe(0)
      expect(outcome.wiltedNow).toBe(0)
      expect(outcome.lostNow).toBe(0)
      expect(outcome.steppedBack).toBe(0)
      expect(outcome.forgiven).toBe(false)
    },
  )

  it("collects only 2 from a glowing space, the cost of that immunity", () => {
    const state = rightTimes(startAs("banana-slug"), SPRING.glowingAt[0])
    expect(answerRight(state).outcome.itemsGained).toBe(2)
  })
})

describe("phoenix", () => {
  const original = RULES.WRONG_ANSWER

  beforeEach(() => {
    RULES.WRONG_ANSWER = WRONG_ANSWER.WILT
  })

  afterEach(() => {
    RULES.WRONG_ANSWER = original
  })

  it("waves the first wrong answer of the season away for free", () => {
    const state = rightTimes(startAs("phoenix"), 3)
    expect(state.forgivenessLeft).toBe(1)
    const { state: next, outcome } = answerWrong(state)
    expect(outcome.forgiven).toBe(true)
    expect(outcome.correct).toBe(false)
    expect(outcome.wiltedNow).toBe(0)
    expect(outcome.lostNow).toBe(0)
    expect(next.items).toBe(3)
    expect(next.wilting).toBe(0)
    expect(next.lost).toBe(0)
    expect(next.position).toBe(3)
    expect(next.forgivenessLeft).toBe(0)
    // Forgiven, but it still broke the streak.
    expect(next.streak).toBe(0)
    expect(next.lastWasWrong).toBe(true)
  })

  it("charges double for the second wrong answer", () => {
    const forgiven = answerWrong(rightTimes(startAs("phoenix"), 3)).state
    const { state: next, outcome } = answerWrong(forgiven)
    expect(outcome.forgiven).toBe(false)
    expect(outcome.wiltedNow).toBe(2)
    expect(next.items).toBe(1)
    expect(next.wilting).toBe(2)
  })

  it("gets its forgiveness back when a new season starts", () => {
    // Collect something first. With no items banked there is nothing to wilt,
    // so the wrong answer below would cost nothing and the free pass would
    // deliberately not be spent -- see the GENTLE case for why.
    const withItems = rightTimes(startAs("phoenix"), 3)
    const forgiven = answerWrong(withItems).state
    expect(forgiven.forgivenessLeft).toBe(0)
    const won = answerRight(playToBoss(forgiven)).state
    expect(won.phase).toBe(PHASE.SEASON_WON)
    expect(won.forgivenessLeft).toBe(0)
    const summer = advance(won)
    expect(summer.seasonId).toBe("summer")
    expect(summer.forgivenessLeft).toBe(1)
  })
})

describe("porcupine", () => {
  const original = RULES.WRONG_ANSWER

  beforeEach(() => {
    RULES.WRONG_ANSWER = WRONG_ANSWER.WILT
  })

  afterEach(() => {
    RULES.WRONG_ANSWER = original
  })

  it("doubles the correct answer that follows a wrong one", () => {
    const wrong = answerWrong(startAs("porcupine")).state
    expect(wrong.lastWasWrong).toBe(true)
    const { state: next, outcome } = answerRight(wrong)
    expect(outcome.doubled).toBe(true)
    expect(outcome.itemsGained).toBe(PLAY.ITEMS_PER_SPACE * 2)
    expect(next.items).toBe(PLAY.ITEMS_PER_SPACE * 2)
  })

  it("does not double a correct answer that follows a correct one", () => {
    const state = rightTimes(startAs("porcupine"), 2)
    const { outcome } = answerRight(state)
    expect(outcome.doubled).toBe(false)
    expect(outcome.itemsGained).toBe(PLAY.ITEMS_PER_SPACE)
  })

  it("doubles a glowing space too", () => {
    const beforeGlow = rightTimes(startAs("porcupine"), SPRING.glowingAt[0])
    const wrong = answerWrong(beforeGlow).state
    expect(wrong.position).toBe(SPRING.glowingAt[0])
    const { outcome } = answerRight(wrong)
    expect(outcome.glowing).toBe(true)
    expect(outcome.doubled).toBe(true)
    expect(outcome.itemsGained).toBe(6)
  })

  it("reports no doubling at the boss, where the space is worth nothing", () => {
    const boss = { ...atSpringBoss("porcupine"), lastWasWrong: true }
    const { outcome } = answerRight(boss)
    expect(outcome.itemsGained).toBe(0)
    expect(outcome.doubled).toBe(false)
    expect(outcome.rescued).toBe(SPRING.boss.rescue)
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

  it("gives every other character the season's plain timer", () => {
    for (const characterId of ["banana-slug", "phoenix", "porcupine"]) {
      expect(questionSeconds({ seasonId: "summer", characterId })).toBe(
        getSeason("summer").timerSeconds,
      )
    }
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
    // Spring's boss asks two-step problems and nothing else.
    expect(SPRING.boss.forms.map((form) => form.kind)).toEqual(["twoStep"])
    expect(boss.question.kind).toBe("twoStep")
    expect(boss.question.choices).toHaveLength(PLAY.CHOICE_COUNT)
  })

  it("collects a perfect trail's worth of items on the way", () => {
    const boss = playToBoss(startAs("sloth"))
    const ordinary = SPRING.spaces - SPRING.glowingAt.length
    expect(boss.items).toBe(ordinary * PLAY.ITEMS_PER_SPACE + SPRING.glowingAt.length * 3)
    expect(boss.correctCount).toBe(SPRING.spaces)
  })
})

describe("boss resolution", () => {
  const originalBoss = RULES.BOSS_FAILURE
  const originalWrong = RULES.WRONG_ANSWER

  beforeEach(() => {
    RULES.BOSS_FAILURE = BOSS_FAILURE.RETRY_SEASON
  })

  afterEach(() => {
    RULES.BOSS_FAILURE = originalBoss
    RULES.WRONG_ANSWER = originalWrong
  })

  it("adds the season's rescue and reports it", () => {
    const boss = atSpringBoss("sloth", { items: 5, lost: 0, wilting: 0 })
    const { state: next, outcome } = answerRight(boss)
    expect(outcome.wasBoss).toBe(true)
    expect(outcome.rescued).toBe(SPRING.boss.rescue)
    expect(outcome.itemsGained).toBe(0)
    expect(next.items).toBe(5 + SPRING.boss.rescue)
    expect(next.position).toBe(SPRING.spaces)
    expect(next.question).toBeNull()
  })

  it("revives anything wilting when the boss question is right", () => {
    const boss = atSpringBoss("sloth", { items: 5, wilting: 2, lost: 0 })
    const { state: next, outcome } = answerRight(boss)
    expect(outcome.revived).toBe(2)
    expect(next.items).toBe(5 + 2 + SPRING.boss.rescue)
    expect(next.wilting).toBe(0)
    expect(next.lost).toBe(0)
  })

  it("wins the season and records what was delivered when the demand is met", () => {
    const boss = atSpringBoss("sloth")
    const { state: next, outcome } = answerRight(boss)
    expect(next.phase).toBe(PHASE.SEASON_WON)
    expect(outcome.phase).toBe(PHASE.SEASON_WON)
    expect(outcome.shortfall).toBe(0)
    expect(next.items).toBeGreaterThanOrEqual(SPRING.demand)
    expect(next.collected).toEqual({ spring: next.items })
    expect(next.runOver).toBe(false)
  })

  it("writes off anything still wilting at resolution", () => {
    RULES.WRONG_ANSWER = WRONG_ANSWER.WILT
    const boss = atSpringBoss("sloth", { items: 18, wilting: 0, lost: 0 })
    const { state: next } = answerWrong(boss)
    expect(next.phase).toBe(PHASE.SEASON_WON)
    expect(next.items).toBe(17)
    expect(next.wilting).toBe(0)
    expect(next.lost).toBe(1)
    expect(next.collected).toEqual({ spring: 17 })
  })

  it("does not count wilting items toward the demand", () => {
    RULES.WRONG_ANSWER = WRONG_ANSWER.WILT
    // Exactly the demand, then a wrong boss answer wilts one of them away.
    const boss = atSpringBoss("sloth", { items: SPRING.demand, wilting: 0, lost: 0 })
    const { state: next, outcome } = answerWrong(boss)
    expect(outcome.shortfall).toBe(1)
    expect(next.items).toBe(SPRING.demand - 1)
    expect(next.wilting).toBe(0)
    expect(next.lost).toBe(1)
    expect(next.phase).toBe(PHASE.SEASON_LOST)
  })

  it("takes no further answers once the season is resolved", () => {
    const won = answerRight(atSpringBoss("sloth")).state
    const { state: same, outcome } = answer(won, 1)
    expect(same).toBe(won)
    expect(outcome).toEqual({ ...ZERO_OUTCOME, phase: PHASE.SEASON_WON })
  })
})

describe("BOSS_FAILURE rules", () => {
  const originalBoss = RULES.BOSS_FAILURE
  const originalWrong = RULES.WRONG_ANSWER

  beforeEach(() => {
    // Gentle, so the shortfall under test comes only from the staged item count.
    RULES.WRONG_ANSWER = WRONG_ANSWER.GENTLE
  })

  afterEach(() => {
    RULES.BOSS_FAILURE = originalBoss
    RULES.WRONG_ANSWER = originalWrong
  })

  /** A boss with nothing banked: even a rescue leaves the demand unmet. */
  const emptyHanded = () => atSpringBoss("sloth", { items: 0, wilting: 0, lost: 0 })

  it("RETRY_SEASON loses the season without ending the run", () => {
    RULES.BOSS_FAILURE = BOSS_FAILURE.RETRY_SEASON
    const { state: next, outcome } = answerRight(emptyHanded())
    expect(next.phase).toBe(PHASE.SEASON_LOST)
    expect(next.runOver).toBe(false)
    expect(next.collected).toEqual({})
    expect(outcome.shortfall).toBe(SPRING.demand - SPRING.boss.rescue)
    expect(outcome.phase).toBe(PHASE.SEASON_LOST)
  })

  it("ALWAYS_PASS wins the season anyway and still reports the gap", () => {
    RULES.BOSS_FAILURE = BOSS_FAILURE.ALWAYS_PASS
    const { state: next, outcome } = answerRight(emptyHanded())
    expect(next.phase).toBe(PHASE.SEASON_WON)
    expect(next.runOver).toBe(false)
    expect(outcome.shortfall).toBe(SPRING.demand - SPRING.boss.rescue)
    expect(next.collected).toEqual({ spring: SPRING.boss.rescue })
  })

  it("END_RUN ends the whole run", () => {
    RULES.BOSS_FAILURE = BOSS_FAILURE.END_RUN
    const { state: next, outcome } = answerRight(emptyHanded())
    expect(next.phase).toBe(PHASE.SEASON_LOST)
    expect(next.runOver).toBe(true)
    expect(next.collected).toEqual({})
    expect(outcome.shortfall).toBe(SPRING.demand - SPRING.boss.rescue)
  })

  it.each([BOSS_FAILURE.RETRY_SEASON, BOSS_FAILURE.ALWAYS_PASS, BOSS_FAILURE.END_RUN])(
    "still wins under %s when the demand is met",
    (rule) => {
      RULES.BOSS_FAILURE = rule
      const { state: next, outcome } = answerRight(atSpringBoss("sloth"))
      expect(next.phase).toBe(PHASE.SEASON_WON)
      expect(next.runOver).toBe(false)
      expect(outcome.shortfall).toBe(0)
    },
  )

  it("also resolves the season when the boss question is answered wrongly", () => {
    RULES.BOSS_FAILURE = BOSS_FAILURE.RETRY_SEASON
    const { state: next, outcome } = answerWrong(atSpringBoss("sloth", { items: 0 }))
    expect(outcome.correct).toBe(false)
    expect(outcome.rescued).toBe(0)
    expect(next.phase).toBe(PHASE.SEASON_LOST)
    expect(next.question).toBeNull()
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
    expect(summer.wilting).toBe(0)
    expect(summer.lost).toBe(0)
    expect(summer.streak).toBe(0)
    expect(summer.questionsAsked).toBe(0)
    expect(summer.correctCount).toBe(0)
    expect(summer.runOver).toBe(false)
    expect(summer.question).not.toBeNull()
  })

  it("keeps what belongs to the run rather than the season", () => {
    const won = wonSpring()
    const summer = advance(won)
    expect(summer.collected).toEqual(won.collected)
    expect(summer.collected.spring).toBeGreaterThanOrEqual(SPRING.demand)
    expect(summer.bestStreak).toBe(won.bestStreak)
    expect(summer.bestStreak).toBe(SPRING.spaces + 1)
    expect(summer.seed).toBe(SEED)
    expect(summer.characterId).toBe("sloth")
  })

  it("completes the run after winter", () => {
    const won = { ...wonSpring(), seasonId: "winter" }
    const done = advance(won)
    expect(done.phase).toBe(PHASE.RUN_COMPLETE)
    expect(done.question).toBeNull()
    expect(done.collected).toEqual(won.collected)
  })

  it("is a no-op outside SEASON_WON", () => {
    const trail = startAs("sloth")
    expect(advance(trail)).toBe(trail)
    const boss = playToBoss(trail)
    expect(advance(boss)).toBe(boss)
    const lost = { ...boss, phase: PHASE.SEASON_LOST }
    expect(advance(lost)).toBe(lost)
    expect(advance(null)).toBeNull()
  })
})

describe("retry", () => {
  /**
   * A lost spring, staged directly so the test does not depend on which
   * BOSS_FAILURE rule is active.
   * @param {Object} [overrides] - Fields to force
   * @returns {Object} A state in PHASE.SEASON_LOST
   */
  function lostSpring(overrides = {}) {
    return {
      ...playToBoss(startAs("sloth")),
      phase: PHASE.SEASON_LOST,
      items: 4,
      wilting: 1,
      lost: 2,
      question: null,
      collected: { spring: 0 },
      runOver: false,
      ...overrides,
    }
  }

  it("replays the same season, keeping the rest of the run", () => {
    const lost = lostSpring()
    const again = retry(lost)
    expect(again.phase).toBe(PHASE.TRAIL)
    expect(again.seasonId).toBe("spring")
    expect(again.position).toBe(0)
    expect(again.items).toBe(0)
    expect(again.wilting).toBe(0)
    expect(again.lost).toBe(0)
    expect(again.questionsAsked).toBe(0)
    expect(again.question).not.toBeNull()
    expect(again.collected).toEqual({ spring: 0 })
    expect(again.bestStreak).toBe(lost.bestStreak)
    expect(again.seed).toBe(SEED)
  })

  it("restarts the whole run from spring when the run is over", () => {
    const lost = lostSpring({ seasonId: "autumn", runOver: true, collected: { spring: 12 } })
    const again = retry(lost)
    expect(again.phase).toBe(PHASE.TRAIL)
    expect(again.seasonId).toBe(SEASON_ORDER[0])
    expect(again.collected).toEqual({})
    expect(again.bestStreak).toBe(0)
    expect(again.runOver).toBe(false)
    expect(again.seed).toBe(SEED)
    expect(again.characterId).toBe("sloth")
  })

  it("is a no-op outside SEASON_LOST", () => {
    const trail = startAs("sloth")
    expect(retry(trail)).toBe(trail)
    const won = { ...trail, phase: PHASE.SEASON_WON }
    expect(retry(won)).toBe(won)
    expect(retry(null)).toBeNull()
  })
})

describe("answer guards", () => {
  it.each([PHASE.CHARACTER_SELECT, PHASE.SEASON_WON, PHASE.SEASON_LOST, PHASE.RUN_COMPLETE])(
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

  it("treats a timeout, delivered as null, as an ordinary wrong answer", () => {
    const originalRule = RULES.WRONG_ANSWER
    RULES.WRONG_ANSWER = WRONG_ANSWER.WILT
    try {
      const state = rightTimes(startAs("sloth"), 3)
      const { state: next, outcome } = answer(state, null)
      expect(outcome.correct).toBe(false)
      expect(outcome.wiltedNow).toBe(1)
      expect(next.streak).toBe(0)
      expect(next.wilting).toBe(1)
    } finally {
      RULES.WRONG_ANSWER = originalRule
    }
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
      position: 3,
      items: 3,
      wilting: 0,
      lost: 0,
      forgivenessLeft: 0,
      lastWasWrong: false,
      streak: 3,
      bestStreak: 3,
      questionsAsked: 3,
      correctCount: 3,
      collected: {},
      runOver: false,
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
    expect(restored.question.kind).toBe("twoStep")
  })

  it.each([PHASE.CHARACTER_SELECT, PHASE.SEASON_WON, PHASE.SEASON_LOST, PHASE.RUN_COMPLETE])(
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
    expect(restored.question.kind).toBe("twoStep")
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
  it("counts safe items and ignores wilting ones", () => {
    expect(countingItems({ items: 7, wilting: 3 })).toBe(7)
    expect(countingItems({ items: 0, wilting: 4 })).toBe(0)
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

  it("does not credit wilting items", () => {
    expect(remainingDemand({ seasonId: "spring", items: 4, wilting: 6 })).toBe(SPRING.demand - 4)
  })

  it("is zero when there is no season", () => {
    expect(remainingDemand({ seasonId: null, items: 0 })).toBe(0)
    expect(remainingDemand({ seasonId: "monsoon", items: 0 })).toBe(0)
    expect(remainingDemand(null)).toBe(0)
  })
})

describe("a full playthrough", () => {
  const original = RULES.BOSS_FAILURE

  afterEach(() => {
    RULES.BOSS_FAILURE = original
  })

  it("clears spring by answering every question correctly", () => {
    const { state, outcome } = answerRight(playToBoss(startAs("sloth")))
    expect(state.phase).toBe(PHASE.SEASON_WON)
    expect(outcome.shortfall).toBe(0)
    // The demand was genuinely satisfied, not waved through by a failure rule.
    expect(state.items).toBeGreaterThanOrEqual(SPRING.demand)
    expect(remainingDemand(state)).toBe(0)
    expect(state.collected.spring).toBe(state.items)
    expect(state.correctCount).toBe(SPRING.spaces + 1)
    expect(state.lost).toBe(0)
  })

  it.each(["sloth", "banana-slug", "phoenix", "porcupine"])(
    "can be completed by the %s, all four seasons, without a single mistake",
    (characterId) => {
      // END_RUN is the harshest rule; a perfect run must clear every season
      // under it, or the game is not actually completable.
      RULES.BOSS_FAILURE = BOSS_FAILURE.END_RUN
      let state = startAs(characterId)
      for (const seasonId of SEASON_ORDER) {
        const season = getSeason(seasonId)
        expect(state.phase).toBe(PHASE.TRAIL)
        expect(state.seasonId).toBe(seasonId)

        const { state: resolved, outcome } = answerRight(playToBoss(state))
        expect(outcome.wasBoss).toBe(true)
        expect(outcome.shortfall).toBe(0)
        expect(resolved.phase).toBe(PHASE.SEASON_WON)
        expect(resolved.items).toBeGreaterThanOrEqual(season.demand)
        expect(resolved.collected[seasonId]).toBe(resolved.items)

        state = advance(resolved)
      }

      expect(state.phase).toBe(PHASE.RUN_COMPLETE)
      expect(Object.keys(state.collected).sort()).toEqual([...SEASON_ORDER].sort())
      for (const seasonId of SEASON_ORDER) {
        expect(state.collected[seasonId]).toBeGreaterThanOrEqual(getSeason(seasonId).demand)
      }
      const longestSeason = Math.max(...SEASON_ORDER.map((id) => getSeason(id).spaces))
      // The streak resets with each season, so the best is the longest season
      // plus its boss.
      expect(state.bestStreak).toBe(longestSeason + 1)
    },
  )
})

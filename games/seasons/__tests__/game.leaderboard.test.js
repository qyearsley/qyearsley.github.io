/** The leaderboard on the end-of-run screen. */

import { describe, expect, it, jest } from "@jest/globals"
import { PHASE } from "../js/constants.js"
import { BOARD_SIZE } from "../js/leaderboard.js"
import { resultButtons } from "./helpers.js"
import {
  LAST_SEASON,
  answerCorrectly,
  boot,
  byId,
  chooseCharacter,
  playSeasonPerfectly,
  saved,
  seedSave,
  setupGameHarness,
} from "./game-harness.js"

setupGameHarness()

const BOARD_KEY = "seasonsLeaderboard"

/** The stored board, parsed, or null. */
const storedBoard = () => JSON.parse(localStorage.getItem(BOARD_KEY))

/** The board's rows as text. */
const boardRows = () => Array.from(byId("leaderboard-list").children).map((li) => li.textContent)

/** Store a full board whose worst entry has this many slips. */
function storeFullBoard(worst) {
  const entries = Array.from({ length: BOARD_SIZE }, (_, i) => ({
    name: `P${i}`,
    slips: Math.max(0, worst - (BOARD_SIZE - 1) + i),
    characterId: "sloth",
    date: "2026-10-01",
    seed: i + 1,
  }))
  localStorage.setItem(BOARD_KEY, JSON.stringify({ entries, lastName: "Ella", version: "1.0" }))
}

/**
 * Boot onto the last boss with this many slips, then finish the run. Seeds the
 * save without clearing storage, so a board stored first survives.
 */
async function finishRunWith(slips) {
  seedSave({
    seasonId: LAST_SEASON.id,
    phase: PHASE.BOSS,
    position: LAST_SEASON.spaces,
    items: LAST_SEASON.demand - LAST_SEASON.boss.rescue,
    characterId: "phoenix",
    slips,
  })
  await boot()
  await answerCorrectly()
  resultButtons()[0].click()
  expect(saved().run.phase).toBe(PHASE.RUN_COMPLETE)
}

/** Type a name and press Save. */
function submitName(name) {
  byId("leaderboard-name").value = name
  byId("leaderboard-form").querySelector("button").click()
}

describe("the leaderboard", () => {
  it("asks for a name at the end of a run, and stores the entry", async () => {
    await finishRunWith(3)
    expect(byId("leaderboard").hidden).toBe(false)
    expect(byId("leaderboard-form").hidden).toBe(false)

    submitName("  Ella ")

    expect(storedBoard().entries).toEqual([
      expect.objectContaining({
        name: "Ella",
        slips: 3,
        characterId: "phoenix",
        seed: saved().run.seed,
      }),
    ])
    expect(byId("leaderboard-form").hidden).toBe(true)
    expect(boardRows()).toEqual([
      expect.stringMatching(/^Ella — 3 slips \(Phoenix, \d{4}-\d{2}-\d{2}\)$/),
    ])
    expect(byId("leaderboard-list").children[0].className).toBe("is-new")
  })

  it("does not ask again when the finished page is reloaded", async () => {
    await finishRunWith(1)
    submitName("Ella")

    await boot()

    expect(byId("leaderboard").hidden).toBe(false)
    expect(byId("leaderboard-form").hidden).toBe(true)
    expect(boardRows()).toHaveLength(1)
  })

  it("fills the name field with the last name used", async () => {
    storeFullBoard(9)
    await finishRunWith(0)
    expect(byId("leaderboard-name").value).toBe("Ella")
  })

  it("shows the board without asking when the run does not make it", async () => {
    storeFullBoard(2)
    await finishRunWith(2)
    expect(byId("leaderboard").hidden).toBe(false)
    expect(byId("leaderboard-form").hidden).toBe(true)
    expect(boardRows()).toHaveLength(BOARD_SIZE)
  })

  it("ignores a blank name", async () => {
    await finishRunWith(0)
    submitName("   ")
    expect(storedBoard()).toBeNull()
    expect(byId("leaderboard-form").hidden).toBe(false)
  })

  it("is not shown at the end of a season", async () => {
    chooseCharacter("sloth")
    await playSeasonPerfectly()
    expect(byId("leaderboard").hidden).toBe(true)
  })

  it("survives Start over", async () => {
    await finishRunWith(0)
    submitName("Ella")
    jest.spyOn(window, "confirm").mockReturnValue(true)
    byId("restart").click()
    expect(saved().run.phase).toBe(PHASE.CHARACTER_SELECT)
    expect(storedBoard().entries).toHaveLength(1)
  })

  it("is not written in debug mode", async () => {
    window.history.replaceState({}, "", "/?phase=end")
    try {
      await boot()
      expect(byId("leaderboard-form").hidden).toBe(false)
      submitName("Grown-up")
      expect(boardRows()).toHaveLength(1)
      expect(storedBoard()).toBeNull()
    } finally {
      window.history.replaceState({}, "", "/")
      document.body.removeAttribute("data-debug")
    }
  })
})

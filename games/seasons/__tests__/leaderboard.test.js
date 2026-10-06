import { beforeEach, describe, expect, it } from "@jest/globals"
import {
  BOARD_SIZE,
  LeaderboardStorage,
  NAME_MAX,
  addEntry,
  cleanName,
  hasRun,
  normalizeBoard,
  qualifies,
  todayKey,
} from "../js/leaderboard.js"

/** An entry with the given name and slips, and everything else valid. */
function entry(name, slips, seed = slips) {
  return { name, slips, characterId: "sloth", date: "2026-10-06", seed }
}

/** A board holding these [name, slips] pairs in the order given. */
function boardOf(...pairs) {
  return normalizeBoard({ entries: pairs.map(([name, slips], i) => entry(name, slips, i)) })
}

describe("cleanName", () => {
  it("trims and cuts to the maximum length", () => {
    expect(cleanName("  Ella  ")).toBe("Ella")
    expect(cleanName("x".repeat(NAME_MAX + 5))).toHaveLength(NAME_MAX)
  })

  it("turns anything that is not a string into an empty name", () => {
    expect(cleanName(undefined)).toBe("")
    expect(cleanName(42)).toBe("")
  })
})

describe("normalizeBoard", () => {
  it("gives an empty board for anything unreadable", () => {
    for (const raw of [null, undefined, 7, "board", [], { entries: "no" }]) {
      expect(normalizeBoard(raw)).toEqual({ entries: [], lastName: "" })
    }
  })

  it("drops entries with no name or no slip count, and coerces the rest", () => {
    const board = normalizeBoard({
      entries: [
        { name: "  ", slips: 1 },
        { name: "A", slips: "3" },
        { name: "B", slips: 2.7, characterId: "dragon", date: "yesterday" },
      ],
    })
    expect(board.entries).toEqual([
      { name: "B", slips: 2, characterId: "banana-slug", date: "", seed: 0 },
    ])
  })

  it("sorts by slips, keeps stored order on a tie, and keeps only the top entries", () => {
    const board = boardOf(["C", 4], ["A", 1], ["B", 1], ["D", 0], ["E", 9], ["F", 2])
    expect(board.entries.map((one) => one.name)).toEqual(["D", "A", "B", "F", "C"])
    expect(board.entries).toHaveLength(BOARD_SIZE)
  })
})

describe("qualifies", () => {
  it("lets anything in while there is room", () => {
    expect(qualifies(boardOf(["A", 0]), 99)).toBe(true)
  })

  it("on a full board, needs strictly fewer slips than the last entry", () => {
    const full = boardOf(["A", 0], ["B", 1], ["C", 2], ["D", 3], ["E", 4])
    expect(qualifies(full, 3)).toBe(true)
    expect(qualifies(full, 4)).toBe(false)
  })
})

describe("addEntry", () => {
  it("places the entry after any it ties with, and reports its rank", () => {
    const { board, rank } = addEntry(boardOf(["A", 1], ["B", 3]), entry("New", 1, 99))
    expect(board.entries.map((one) => one.name)).toEqual(["A", "New", "B"])
    expect(rank).toBe(1)
    expect(board.lastName).toBe("New")
  })

  it("pushes the last entry off a full board", () => {
    const full = boardOf(["A", 0], ["B", 1], ["C", 2], ["D", 3], ["E", 4])
    const { board, rank } = addEntry(full, entry("New", 0, 99))
    expect(rank).toBe(1)
    expect(board.entries.map((one) => one.name)).toEqual(["A", "New", "B", "C", "D"])
  })

  it("reports -1 when the entry does not make a full board", () => {
    const full = boardOf(["A", 0], ["B", 1], ["C", 2], ["D", 3], ["E", 4])
    expect(addEntry(full, entry("New", 4, 99)).rank).toBe(-1)
  })

  it("does not change the board it was given", () => {
    const before = boardOf(["A", 1])
    addEntry(before, entry("New", 0, 99))
    expect(before.entries.map((one) => one.name)).toEqual(["A"])
  })

  it("ignores an entry with no name", () => {
    const before = boardOf(["A", 1])
    expect(addEntry(before, entry("  ", 0))).toEqual({ board: before, rank: -1 })
  })
})

describe("hasRun", () => {
  it("finds a run by its seed", () => {
    const board = normalizeBoard({ entries: [entry("A", 1, 1234)] })
    expect(hasRun(board, 1234)).toBe(true)
    expect(hasRun(board, 99)).toBe(false)
  })
})

describe("todayKey", () => {
  it("formats a local date with zero padding", () => {
    expect(todayKey(new Date(2026, 0, 5))).toBe("2026-01-05")
  })
})

describe("LeaderboardStorage", () => {
  beforeEach(() => localStorage.clear())

  it("round-trips a board under its own key", () => {
    const storage = new LeaderboardStorage()
    const board = addEntry(normalizeBoard(null), entry("Ella", 2)).board
    expect(storage.save(board)).toBe(true)
    expect(new LeaderboardStorage().load()).toEqual(board)
    expect(localStorage.getItem("seasonsLeaderboard")).not.toBeNull()
  })

  it("loads an empty board when nothing is stored or the JSON is corrupt", () => {
    expect(new LeaderboardStorage().load()).toEqual({ entries: [], lastName: "" })
    localStorage.setItem("seasonsLeaderboard", "{not json")
    expect(new LeaderboardStorage().load()).toEqual({ entries: [], lastName: "" })
  })
})

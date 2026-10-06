/**
 * Seasons leaderboard -- the top finished journeys on this device.
 *
 * A whole run is ranked by slips: wrong answers, timeouts included. Fewer is
 * better, and a tie goes to whoever got there first, so a new run has to beat
 * an entry to take its place.
 *
 * Kept under its own localStorage key rather than inside the save, so neither
 * "Start over" nor a bump of the save version erases it.
 *
 * Error Handling: `normalizeBoard` coerces anything into a valid board, the same
 * way storage.js treats the save. Writes that fail return false and are ignored.
 */

import { StorageManager as BaseStorageManager } from "../../shared/StorageManager.js"
import { CHARACTER_IDS, DEFAULT_CHARACTER } from "./characters.js"

/** How many entries the board keeps. */
export const BOARD_SIZE = 5

/** Longest name the board accepts; anything longer is cut. */
export const NAME_MAX = 12

/**
 * @typedef {Object} Entry
 * @property {string} name        - Who played, as typed
 * @property {number} slips       - Wrong answers in the run
 * @property {string} characterId - The animal played
 * @property {string} date        - Local date, "YYYY-MM-DD"
 * @property {number} seed        - The run's seed, so one run is entered once
 */

/**
 * @typedef {Object} Board
 * @property {Entry[]} entries - Best first, at most BOARD_SIZE
 * @property {string} lastName - The name typed last time, to fill the field
 */

/**
 * Trim a name and cut it to NAME_MAX characters.
 * @param {unknown} raw - Anything
 * @returns {string} A clean name, possibly empty
 */
export function cleanName(raw) {
  return typeof raw === "string" ? raw.trim().slice(0, NAME_MAX) : ""
}

/**
 * Coerce one stored entry, or return null if it cannot be read as one.
 * @private
 * @param {unknown} raw - Anything
 * @returns {Entry|null} A valid entry, or null
 */
function _normalizeEntry(raw) {
  if (raw === null || typeof raw !== "object") return null
  const name = cleanName(raw.name)
  if (!name || !Number.isFinite(raw.slips)) return null
  return {
    name,
    slips: Math.max(0, Math.floor(raw.slips)),
    characterId: CHARACTER_IDS.has(raw.characterId) ? raw.characterId : DEFAULT_CHARACTER.id,
    date: typeof raw.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : "",
    seed: Number.isFinite(raw.seed) ? raw.seed : 0,
  }
}

/**
 * Coerce anything into a valid board. Never throws or mutates its input.
 * @param {unknown} raw - Anything, typically a parsed JSON payload
 * @returns {Board} A new board
 */
export function normalizeBoard(raw) {
  const source = raw !== null && typeof raw === "object" ? raw : {}
  const entries = Array.isArray(source.entries)
    ? source.entries.map(_normalizeEntry).filter(Boolean)
    : []
  // A stable sort keeps stored order on a tie, and stored order is arrival order.
  entries.sort((a, b) => a.slips - b.slips)
  return { entries: entries.slice(0, BOARD_SIZE), lastName: cleanName(source.lastName) }
}

/**
 * Whether a run with this many slips would make the board.
 * @param {Board} board - The current board
 * @param {number} slips - The run's slips
 * @returns {boolean} True if there is room, or it beats the last entry
 */
export function qualifies(board, slips) {
  if (board.entries.length < BOARD_SIZE) return true
  return slips < board.entries.at(-1).slips
}

/**
 * Whether this run is already on the board, so a reload does not ask again.
 * @param {Board} board - The current board
 * @param {number} seed - The run's seed
 * @returns {boolean} True if an entry carries this seed
 */
export function hasRun(board, seed) {
  return board.entries.some((entry) => entry.seed === seed)
}

/**
 * Add an entry in its place, after any entry it ties with.
 * @param {Board} board - The current board; not mutated
 * @param {Entry} entry - The new entry
 * @returns {{board: Board, rank: number}} The new board, and the entry's
 *   0-based place on it, or -1 if it did not make it
 */
export function addEntry(board, entry) {
  const clean = _normalizeEntry(entry)
  if (!clean) return { board, rank: -1 }
  const entries = [...board.entries]
  let rank = entries.findIndex((other) => clean.slips < other.slips)
  if (rank === -1) rank = entries.length
  entries.splice(rank, 0, clean)
  return {
    board: { entries: entries.slice(0, BOARD_SIZE), lastName: clean.name },
    rank: rank < BOARD_SIZE ? rank : -1,
  }
}

/**
 * Today as a local "YYYY-MM-DD" key.
 * @param {Date} [now] - The moment to format
 * @returns {string} The date key
 */
export function todayKey(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0")
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** The leaderboard's own slot in localStorage. */
export class LeaderboardStorage extends BaseStorageManager {
  constructor() {
    super("seasonsLeaderboard", "1.0")
  }

  /** @returns {Board} The stored board, or an empty one */
  load() {
    return normalizeBoard(this.loadGameState())
  }

  /**
   * @param {Board} board - The board to write
   * @returns {boolean} True if the write succeeded
   */
  save(board) {
    return this.saveGameState(normalizeBoard(board))
  }
}

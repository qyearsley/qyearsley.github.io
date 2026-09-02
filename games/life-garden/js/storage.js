import { StorageManager } from "../../shared/StorageManager.js"

/**
 * Saved state for Life Garden: completed puzzles and settings, and nothing
 * else. In particular no species ids and no grid contents, so a save written
 * before the species list changed cannot put a species back on the board.
 *
 * The version is the belt to that braces: species ids were renumbered when
 * flowers became a life stage of grass and the fox was added, so bump it
 * whenever they move again. StorageManager discards data whose version does
 * not match.
 */
export class LifeGardenStorage extends StorageManager {
  constructor() {
    super("lifeGardenProgress", "2.0")
  }

  saveProgress(completedPuzzles, settings) {
    return this.saveGameState({ completedPuzzles, settings })
  }

  loadProgress() {
    const data = this.loadGameState()
    if (!data) return null
    if (!data.completedPuzzles) {
      this._logError("loadProgress", "Invalid structure: missing completedPuzzles")
      return null
    }
    return data
  }

  clearProgress() {
    return this.clearGameState()
  }
}

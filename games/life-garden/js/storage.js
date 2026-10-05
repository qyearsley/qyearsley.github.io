import { StorageManager } from "../../shared/StorageManager.js"

/**
 * Saved state for Life Garden: settings, and nothing else. In particular no
 * species ids and no grid contents, so a save written before the species list
 * changed cannot put a species back on the board.
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

  saveProgress(settings) {
    return this.saveGameState({ settings })
  }

  loadProgress() {
    // Saves written before 2026-10 also hold a `completedPuzzles` map. It is
    // accepted and ignored, so those players keep their settings. The caller
    // checks the shape of `settings`.
    const data = this.loadGameState()
    if (!data || typeof data !== "object") return null
    return data
  }

  clearProgress() {
    return this.clearGameState()
  }
}

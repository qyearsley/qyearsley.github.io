import { StorageManager } from "../../shared/StorageManager.js"

export class LifeGardenStorage extends StorageManager {
  constructor() {
    super("lifeGardenProgress", "1.0")
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

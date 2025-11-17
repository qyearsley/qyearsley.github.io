/**
 * Storage manager for persisting game state
 */
export class StorageManager {
  constructor(gameKey = "wordQuest") {
    this.gameKey = gameKey
  }

  /**
   * Save game state to localStorage
   * @param {Object} data - Game state data
   */
  saveGameState(data) {
    try {
      localStorage.setItem(this.gameKey, JSON.stringify(data))
    } catch (error) {
      console.error("Error saving game state:", error)
    }
  }

  /**
   * Load game state from localStorage
   * @returns {Object|null} Game state data or null
   */
  loadGameState() {
    try {
      const data = localStorage.getItem(this.gameKey)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error("Error loading game state:", error)
      return null
    }
  }

  /**
   * Clear game state from localStorage
   */
  clearGameState() {
    try {
      localStorage.removeItem(this.gameKey)
    } catch (error) {
      console.error("Error clearing game state:", error)
    }
  }

  /**
   * Check if game state exists
   * @returns {boolean} True if game state exists
   */
  hasGameState() {
    return localStorage.getItem(this.gameKey) !== null
  }
}

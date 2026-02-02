/**
 * Base Storage Manager for persisting game state
 * Provides generic localStorage operations with version management
 */
export class StorageManager {
  /**
   * @param {string} gameKey - Unique key for this game's storage
   * @param {string} version - Version string for data compatibility
   */
  constructor(gameKey, version = "1.0") {
    this.gameKey = gameKey
    this.version = version
  }

  /**
   * Save game data to localStorage
   * @param {Object} data - Game state data to save
   * @returns {boolean} True if save was successful
   */
  saveGameState(data) {
    try {
      const payload = {
        ...data,
        version: this.version,
        lastPlayed: Date.now(),
      }
      localStorage.setItem(this.gameKey, JSON.stringify(payload))
      return true
    } catch (error) {
      console.error("Error saving game state:", error)
      return false
    }
  }

  /**
   * Load game data from localStorage
   * @returns {Object|null} Game state data or null if not found/invalid
   */
  loadGameState() {
    try {
      const saved = localStorage.getItem(this.gameKey)
      if (!saved) {
        return null
      }

      const data = JSON.parse(saved)

      // Check version compatibility
      if (data.version !== this.version) {
        console.log(
          `Version mismatch: expected ${this.version}, got ${data.version}. Clearing old data.`,
        )
        this.clearGameState()
        return null
      }

      return data
    } catch (error) {
      console.error("Error loading game state:", error)
      return null
    }
  }

  /**
   * Clear game data from localStorage
   * @returns {boolean} True if clear was successful
   */
  clearGameState() {
    try {
      localStorage.removeItem(this.gameKey)
      return true
    } catch (error) {
      console.error("Error clearing game state:", error)
      return false
    }
  }

  /**
   * Check if game data exists
   * @returns {boolean} True if game state exists
   */
  hasGameState() {
    return localStorage.getItem(this.gameKey) !== null
  }

  /**
   * Export game data as JSON string
   * @returns {string|null} JSON string or null if no data
   */
  exportGameState() {
    const data = this.loadGameState()
    if (data) {
      return JSON.stringify(data, null, 2)
    }
    return null
  }

  /**
   * Import game data from JSON string
   * @param {string} jsonString - JSON string to import
   * @returns {boolean} True if import was successful
   */
  importGameState(jsonString) {
    try {
      const data = JSON.parse(jsonString)

      // Validate version
      if (data.version !== this.version) {
        console.error(
          `Cannot import: version mismatch (expected ${this.version}, got ${data.version})`,
        )
        return false
      }

      localStorage.setItem(this.gameKey, jsonString)
      return true
    } catch (error) {
      console.error("Error importing game state:", error)
      return false
    }
  }
}

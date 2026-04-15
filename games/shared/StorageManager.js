/**
 * Base Storage Manager for persisting game state
 * Provides generic localStorage operations with version management
 *
 * Architecture: This is a reusable base class for game storage.
 * - Handles generic localStorage operations (save, load, import, export)
 * - Manages versioning and compatibility checks
 * - Can be extended by game-specific storage classes (see storage.js)
 * - Designed for reusability across multiple games
 *
 * Error Handling: All methods handle errors gracefully and return safe defaults.
 * - Save/clear operations return boolean (true on success, false on error)
 * - Load operations return null on any error or missing data
 * - All errors are logged to console with descriptive context
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
   * Log error with consistent formatting
   * @private
   * @param {string} operation - Name of the operation that failed
   * @param {string} reason - Reason for the failure
   * @param {Error} [error] - Optional error object
   */
  _logError(operation, reason, error = null) {
    const message = `StorageManager.${operation}: ${reason}`
    if (error) {
      console.error(message, error)
    } else {
      console.error(message)
    }
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
      this._logError("saveGameState", "Failed to save to localStorage", error)
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
        this._logError(
          "loadGameState",
          `Version mismatch: expected ${this.version}, found ${data.version}. Clearing old data.`,
        )
        this.clearGameState()
        return null
      }

      return data
    } catch (error) {
      this._logError("loadGameState", "Failed to load from localStorage", error)
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
      this._logError("clearGameState", "Failed to clear localStorage", error)
      return false
    }
  }

  /**
   * Check if game data exists
   * @returns {boolean} True if game state exists
   */
  hasGameState() {
    try {
      return localStorage.getItem(this.gameKey) !== null
    } catch (error) {
      this._logError("hasGameState", "Failed to check localStorage", error)
      return false
    }
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
        this._logError(
          "importGameState",
          `Version mismatch: expected ${this.version}, got ${data.version}`,
        )
        return false
      }

      localStorage.setItem(this.gameKey, jsonString)
      return true
    } catch (error) {
      this._logError("importGameState", "Failed to import data", error)
      return false
    }
  }
}

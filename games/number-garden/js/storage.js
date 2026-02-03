/**
 * Number Garden Storage - Game-specific storage implementation
 * Extends the base StorageManager with Number Garden specific functionality
 *
 * Architecture: This is the game-specific storage layer.
 * - Extends StorageManager.js (reusable base class)
 * - Adds Number Garden-specific methods (saveProgress, loadProgress)
 * - Handles game-specific data structure and validation
 * - Import this class in game code, not the base StorageManager
 *
 * Error Handling: Follows same patterns as base class.
 * - All validation failures are logged with specific reasons
 * - Returns null for load failures, boolean for save/import operations
 */
import { StorageManager as BaseStorageManager } from "./StorageManager.js"

export class StorageManager extends BaseStorageManager {
  constructor() {
    super("numberGardenProgress", "3.0")
  }

  /**
   * Save Number Garden specific progress
   * @param {Object} stats - Player statistics
   * @param {Object} garden - Garden state
   * @param {Array} unlockedAreas - Array of unlocked area IDs
   * @param {Array} completedAreas - Array of completed area IDs
   * @param {Object} settings - Game settings
   * @param {string} projectType - Current project type
   * @returns {boolean} True if save was successful
   */
  saveProgress(
    stats,
    garden,
    unlockedAreas,
    completedAreas = [],
    settings = {},
    projectType = "castle",
  ) {
    const data = {
      stats: stats,
      garden: garden,
      unlockedAreas: unlockedAreas || ["flower-meadow"],
      completedAreas: completedAreas || [],
      settings: settings || { inputMode: "multipleChoice", visualHints: "on" },
      projectType: projectType,
    }

    return this.saveGameState(data)
  }

  /**
   * Load Number Garden specific progress
   * @returns {Object|null} Progress data or null
   */
  loadProgress() {
    const data = this.loadGameState()

    if (!data) {
      return null
    }

    // Validate Number Garden specific structure
    if (!data.stats || !data.garden) {
      this._logError(
        "loadProgress",
        "Invalid data structure: missing required fields (stats and/or garden)",
      )
      return null
    }

    return data
  }

  /**
   * Clear progress (alias for consistency)
   * @returns {boolean} True if clear was successful
   */
  clearProgress() {
    return this.clearGameState()
  }

  /**
   * Export progress (alias for consistency)
   * @returns {string|null} JSON string or null
   */
  exportProgress() {
    return this.exportGameState()
  }

  /**
   * Import progress with validation
   * @param {string} jsonString - JSON string to import
   * @returns {boolean} True if import was successful
   */
  importProgress(jsonString) {
    try {
      const data = JSON.parse(jsonString)

      // Validate that we have the required fields (stats and garden)
      if (!data.stats || !data.garden) {
        this._logError("importProgress", "Missing required fields: stats and/or garden")
        return false
      }

      // If no version specified, add current version
      if (!data.version) {
        data.version = this.version
      }

      // Save the data (which will add lastPlayed timestamp)
      return this.saveGameState(data)
    } catch (error) {
      this._logError("importProgress", "Failed to parse or save imported data", error)
      return false
    }
  }
}

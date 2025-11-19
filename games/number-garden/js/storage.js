/**
 * Storage manager for saving and loading progress
 * Extends the common StorageManager with Number Garden specific functionality
 */
import { StorageManager as BaseStorageManager } from "../../common/js/StorageManager.js"

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
      settings: settings || { inputMode: "multipleChoice", visualHints: "always" },
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
    if (data.stats && data.garden) {
      return data
    }

    return null
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
        console.error("Cannot import: missing required fields (stats and garden)")
        return false
      }

      // If no version specified, add current version
      if (!data.version) {
        data.version = this.version
      }

      // Save the data (which will add lastPlayed timestamp)
      return this.saveGameState(data)
    } catch (error) {
      console.error("Error importing progress:", error)
      return false
    }
  }
}

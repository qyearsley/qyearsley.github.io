/**
 * Main activity generator for Word Quest
 * Delegates to specialized generators for each quest type
 *
 * This architecture provides:
 * - Separation of concerns (each quest type has its own generator)
 * - Easier testing (test each generator independently)
 * - Better maintainability (changes to one quest don't affect others)
 * - Clearer code organization
 */
import { SoundCipherGenerator } from "./generators/SoundCipherGenerator.js"
import { BlendingWorkshopGenerator } from "./generators/BlendingWorkshopGenerator.js"
import { SpeedVaultGenerator } from "./generators/SpeedVaultGenerator.js"
import { PatternArchiveGenerator } from "./generators/PatternArchiveGenerator.js"
import { SpellForgeGenerator } from "./generators/SpellForgeGenerator.js"
import { StoryVaultGenerator } from "./generators/StoryVaultGenerator.js"
import { getQuestTheme } from "../data/questThemes.js"

export class WordActivityGenerator {
  constructor(wordBank) {
    if (!wordBank) {
      throw new Error("WordActivityGenerator requires a WordBank instance")
    }

    this.wordBank = wordBank

    // Initialize specialized generators for each quest type
    // Each generator focuses on one educational skill
    this.generators = {
      "sound-cipher": new SoundCipherGenerator(wordBank),
      "blending-workshop": new BlendingWorkshopGenerator(wordBank),
      "speed-vault": new SpeedVaultGenerator(wordBank),
      "pattern-archive": new PatternArchiveGenerator(wordBank),
      "spell-forge": new SpellForgeGenerator(wordBank),
      "story-vault": new StoryVaultGenerator(wordBank),
    }
  }

  /**
   * Generate an activity based on quest, difficulty, and activity number
   * Delegates to the appropriate specialized generator
   * @param {number} activityNumber - The activity number (1-based)
   * @param {string} questId - The quest identifier
   * @param {string} difficulty - Difficulty level
   * @returns {Object} Activity object
   * @throws {Error} If questId is invalid
   */
  generateActivity(activityNumber, questId, difficulty) {
    const generator = this.generators[questId]

    if (!generator) {
      console.error(`Unknown quest ID: ${questId}, falling back to sound-cipher`)
      return this.generators["sound-cipher"].generateActivity(activityNumber, difficulty)
    }

    return generator.generateActivity(activityNumber, difficulty)
  }

  /**
   * Get quest theme information
   * Delegates to the quest themes data module
   * @param {string} questId - Quest identifier
   * @returns {Object} Quest theme configuration
   */
  getQuestTheme(questId) {
    return getQuestTheme(questId)
  }
}

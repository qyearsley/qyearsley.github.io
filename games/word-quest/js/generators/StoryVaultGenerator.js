/**
 * Story Vault (Reading Comprehension) Activity Generator
 * Focuses on reading fluency and comprehension
 */
import { BaseActivityGenerator } from "./BaseActivityGenerator.js"
import { getStoriesForDifficulty } from "../../data/stories.js"

export class StoryVaultGenerator extends BaseActivityGenerator {
  /**
   * Generate a story reading comprehension activity
   * @param {number} activityNumber - Activity sequence number
   * @param {string} difficulty - Difficulty level
   * @returns {Object} Activity object
   */
  generateActivity(activityNumber, difficulty) {
    const stories = getStoriesForDifficulty(difficulty)
    const story = stories[activityNumber % stories.length]

    return {
      type: "story",
      question: story.question,
      visual: story.text,
      correctAnswer: story.answer,
      choices: story.choices,
      audioWord: null,
      hint: `Read carefully!`,
      word: null,
      story: story.text,
    }
  }
}

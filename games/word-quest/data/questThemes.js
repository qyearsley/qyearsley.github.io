/**
 * Quest themes and visual configuration for Word Quest
 * Each quest focuses on a specific literacy skill with its own character and aesthetic
 */

/**
 * Quest theme configuration
 * Each theme includes:
 * - Visual elements (icon, creature, colors)
 * - Educational focus
 * - Narrative context for engagement
 */
export const QUEST_THEMES = {
  "sound-cipher": {
    icon: "🔑",
    name: "Sound Code",
    description: "Learn letter sounds",
    creature: "🕵️",
    creatureName: "Detective Dog",
    background: "#1a1f3a",
    accentColor: "#ffd700",
    narrative: "Detective Dog needs your help! Listen to the sounds and crack the code.",
  },
  "blending-workshop": {
    icon: "🧪",
    name: "Potion Lab",
    description: "Mix sounds into words",
    creature: "🐱",
    creatureName: "Wizard Cat",
    background: "#2d1b4e",
    accentColor: "#9d4edd",
    narrative: "Wizard Cat is brewing word potions! Blend these sounds together.",
  },
  "speed-vault": {
    icon: "🎵",
    name: "Rhyme Time",
    description: "Find words that rhyme",
    creature: "🐦",
    creatureName: "DJ Bird",
    background: "#1a535c",
    accentColor: "#ff6b6b",
    narrative: "DJ Bird is mixing beats! Find words that rhyme to complete the song.",
  },
  "pattern-archive": {
    icon: "🗺️",
    name: "Pattern Quest",
    description: "Discover word patterns",
    creature: "🦜",
    creatureName: "Explorer Parrot",
    background: "#bc6c25",
    accentColor: "#ffd60a",
    narrative: "Explorer Parrot found ancient word patterns! Can you spot the pattern?",
  },
  "spell-forge": {
    icon: "🔨",
    name: "Word Forge",
    description: "Build words from sounds",
    creature: "🐻",
    creatureName: "Blacksmith Bear",
    background: "#370617",
    accentColor: "#ff8500",
    narrative: "Blacksmith Bear is forging new words! Put the sounds together.",
  },
  "story-vault": {
    icon: "📖",
    name: "Story Vault",
    description: "Read and understand stories",
    creature: "🦉",
    creatureName: "Librarian Owl",
    background: "#14213d",
    accentColor: "#fca311",
    narrative: "Librarian Owl has a story to share! Read carefully and find the answer.",
  },
}

/**
 * Get theme for a specific quest
 * @param {string} questId - Quest identifier
 * @returns {Object} Quest theme configuration
 */
export function getQuestTheme(questId) {
  return QUEST_THEMES[questId] || QUEST_THEMES["sound-cipher"]
}

/**
 * Get all quest IDs in order
 * @returns {Array<string>} Array of quest IDs
 */
export function getAllQuestIds() {
  return Object.keys(QUEST_THEMES)
}

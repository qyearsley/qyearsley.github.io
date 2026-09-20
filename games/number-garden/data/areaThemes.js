/**
 * Area themes and visual configuration for Number Garden
 * Each area focuses on a specific math concept with its own character and aesthetic
 */

/**
 * Area theme configuration
 * Each theme includes:
 * - Character/creature for the area
 * - Contextual messages for engagement
 * - Visual emoji sets for math representations
 */
export const AREA_THEMES = {
  "flower-meadow": {
    creature: "🦄",
    name: "Flower Meadow",
    mathFocus: "Addition",
    messages: [
      "Can you help me count?",
      "I need help! How many?",
      "Will you help me add?",
      "Can you solve this?",
      "Please help me count!",
    ],
    // Two sets of emojis allow for visual distinction between addends
    visualEmojis1: ["🌹", "🌺", "🌸", "🌼", "🌻"],
    visualEmojis2: ["🌷", "💐", "🏵️", "🥀", "🌾"],
  },
  "crystal-cave": {
    creature: "🔮",
    name: "Crystal Cave",
    mathFocus: "Subtraction",
    messages: [
      "Can you help me?",
      "I lost some gems! How many left?",
      "Will you help me count?",
      "Can you solve this?",
      "Please help me!",
    ],
    visualEmojis1: ["💎", "💠", "🔷", "🔹", "💙"],
    visualEmojis2: ["💜", "🔮", "⚗️", "✨", "⭐"],
  },
  "enchanted-forest": {
    creature: "🧚",
    name: "Enchanted Forest",
    mathFocus: "Multiplication",
    messages: [
      "Can you help me?",
      "I need help with this!",
      "Will you help me count?",
      "Can you solve this?",
      "Please help me!",
    ],
    visualEmojis1: ["🌲", "🌳", "🌴", "🎄", "🌿"],
    visualEmojis2: ["🍄", "🍃", "🌾", "🌱", "🪵"],
  },
  "time-temple": {
    creature: "🕰️",
    name: "Time Temple",
    mathFocus: "Time Telling",
    messages: [
      "Can you help me tell time?",
      "I need help! What time is it?",
      "Will you help me?",
      "Can you read this clock?",
      "Please help me!",
    ],
    visualEmojis1: ["⏰", "⏱️", "⌚", "🕐", "🕑"],
    visualEmojis2: ["🕒", "🕓", "🕔", "🕕", "🕖"],
  },
  "measurement-market": {
    creature: "🦊",
    name: "Measurement Market",
    mathFocus: "Measurement",
    messages: [
      "Can you help me measure?",
      "I need help! How long is it?",
      "Will you help me?",
      "Can you solve this?",
      "Please help me!",
    ],
    visualEmojis1: ["📏", "📐", "⚖️", "🧪", "🧴"],
    visualEmojis2: ["📦", "🎁", "🍎", "🍊", "🥕"],
  },
  "pattern-path": {
    creature: "🦋",
    name: "Pattern Path",
    mathFocus: "Patterns & Sequences",
    messages: [
      "Can you help me?",
      "I need help! What comes next?",
      "Will you help me find it?",
      "Can you see the pattern?",
      "Please help me!",
    ],
    visualEmojis1: ["🔵", "🔴", "🟡", "🟢", "🟣"],
    visualEmojis2: ["⭐", "💠", "🔷", "🔶", "💎"],
  },
}

/**
 * Get theme for a specific area
 * @param {string} areaId - Area identifier
 * @returns {Object} Area theme configuration
 */
export function getAreaTheme(areaId) {
  return AREA_THEMES[areaId] || AREA_THEMES["flower-meadow"]
}

/**
 * Get a random message for an area
 * @param {string} areaId - Area identifier
 * @returns {string} Random message from the area's message pool
 */
export function getRandomMessage(areaId) {
  const theme = getAreaTheme(areaId)
  const messages = theme.messages
  return messages[Math.floor(Math.random() * messages.length)]
}

/**
 * Get visual emoji for area
 * @param {string} areaId - Area identifier
 * @param {number} [set=1] - Emoji set (1 or 2)
 * @returns {string} Random emoji from the specified set
 */
export function getRandomVisualEmoji(areaId, set = 1) {
  const theme = getAreaTheme(areaId)
  const emojis = set === 1 ? theme.visualEmojis1 : theme.visualEmojis2
  return emojis[Math.floor(Math.random() * emojis.length)]
}

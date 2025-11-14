/**
 * Reward system - generates and manages rewards
 */
export class RewardSystem {
  constructor() {
    // Area-specific reward types
    this.areaRewards = {
      "flower-meadow": [
        { color: "red", emoji: "🌹", name: "Rose" },
        { color: "pink", emoji: "🌺", name: "Hibiscus" },
        { color: "yellow", emoji: "🌻", name: "Sunflower" },
        { color: "purple", emoji: "🪻", name: "Lavender" },
        { color: "blue", emoji: "💠", name: "Blue Flower" },
        { color: "orange", emoji: "🌼", name: "Marigold" },
        { color: "white", emoji: "🌸", name: "Cherry Blossom" },
        { color: "pink", emoji: "🌷", name: "Tulip" },
      ],
      "crystal-cave": [
        { color: "purple", emoji: "💎", name: "Diamond" },
        { color: "blue", emoji: "💠", name: "Blue Crystal" },
        { color: "purple", emoji: "🔮", name: "Crystal Ball" },
        { color: "blue", emoji: "🔷", name: "Large Blue Diamond" },
        { color: "blue", emoji: "🔹", name: "Small Blue Diamond" },
        { color: "purple", emoji: "💜", name: "Purple Heart Crystal" },
        { color: "yellow", emoji: "⭐", name: "Star Crystal" },
        { color: "white", emoji: "✨", name: "Sparkles" },
      ],
      "enchanted-forest": [
        { color: "green", emoji: "🌲", name: "Pine Tree" },
        { color: "green", emoji: "🌳", name: "Deciduous Tree" },
        { color: "green", emoji: "🌴", name: "Palm Tree" },
        { color: "green", emoji: "🎄", name: "Christmas Tree" },
        { color: "green", emoji: "🌿", name: "Herb" },
        { color: "red", emoji: "🍄", name: "Mushroom" },
        { color: "green", emoji: "🍃", name: "Leaf" },
        { color: "brown", emoji: "🪵", name: "Wood" },
      ],
      "time-temple": [
        { color: "gold", emoji: "⏰", name: "Alarm Clock" },
        { color: "gold", emoji: "⌚", name: "Watch" },
        { color: "gold", emoji: "⏱️", name: "Stopwatch" },
        { color: "gold", emoji: "🕐", name: "One O'Clock" },
        { color: "yellow", emoji: "⏳", name: "Hourglass" },
        { color: "gold", emoji: "🕰️", name: "Mantle Clock" },
        { color: "yellow", emoji: "⭐", name: "Time Star" },
        { color: "white", emoji: "✨", name: "Sparkles" },
      ],
      "measurement-market": [
        { color: "orange", emoji: "📏", name: "Ruler" },
        { color: "orange", emoji: "📐", name: "Triangle" },
        { color: "orange", emoji: "⚖️", name: "Scale" },
        { color: "orange", emoji: "🧪", name: "Beaker" },
        { color: "red", emoji: "🍎", name: "Apple" },
        { color: "orange", emoji: "🍊", name: "Orange" },
        { color: "orange", emoji: "🦊", name: "Fox" },
        { color: "orange", emoji: "📦", name: "Box" },
      ],
      "pattern-path": [
        { color: "purple", emoji: "🦋", name: "Butterfly" },
        { color: "blue", emoji: "🔵", name: "Blue Circle" },
        { color: "red", emoji: "🔴", name: "Red Circle" },
        { color: "yellow", emoji: "🟡", name: "Yellow Circle" },
        { color: "purple", emoji: "🟣", name: "Purple Circle" },
        { color: "purple", emoji: "💠", name: "Diamond" },
        { color: "yellow", emoji: "⭐", name: "Star" },
        { color: "white", emoji: "✨", name: "Sparkles" },
      ],
    }

    // Keep legacy flowerTypes for backward compatibility
    this.flowerTypes = this.areaRewards["flower-meadow"]

    this.specialRewards = [
      { emoji: "🦋", name: "Butterfly", unlockAt: 5 },
      { emoji: "🌈", name: "Rainbow", unlockAt: 10 },
      { emoji: "⭐", name: "Star", unlockAt: 15 },
      { emoji: "🎆", name: "Sparkles", unlockAt: 20 },
    ]
  }

  generateFlower(areaId = "flower-meadow") {
    // Get area-specific rewards or default to flower meadow
    const rewards = this.areaRewards[areaId] || this.areaRewards["flower-meadow"]

    // Random reward selection
    const reward = rewards[Math.floor(Math.random() * rewards.length)]
    return {
      ...reward,
      timestamp: Date.now(),
    }
  }

  getSpecialReward(activityCount) {
    // Check if player has unlocked any special rewards
    for (const reward of this.specialRewards) {
      if (activityCount === reward.unlockAt) {
        return reward
      }
    }
    return null
  }

  getEncouragingMessage() {
    const messages = [
      "You're doing amazing!",
      "Keep up the great work!",
      "What a clever gardener you are!",
      "The garden is blooming because of you!",
      "Wonderful job!",
      "You're a math superstar!",
      "The creatures are so proud of you!",
      "Look how beautiful the garden is becoming!",
    ]

    return messages[Math.floor(Math.random() * messages.length)]
  }

  getCelebrationEmoji() {
    const emojis = ["🎉", "🎊", "✨", "🌟", "💫", "🎆", "🎇"]
    return emojis[Math.floor(Math.random() * emojis.length)]
  }
}

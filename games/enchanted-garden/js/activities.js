/**
 * Activity generation system
 */
export class ActivityGenerator {
  constructor() {
    // Area-specific themes
    this.areaThemes = {
      "flower-meadow": {
        creature: "🦄",
        messages: [
          "Let's count!",
          "You can do it!",
          "Try this one!",
          "How many?",
          "Count with me!",
        ],
        visualEmojis1: ["🌹", "🌺", "🌸", "🌼", "🌻"],
        visualEmojis2: ["🌷", "💐", "🏵️", "🥀", "🌾"],
      },
      "crystal-cave": {
        creature: "🔮",
        messages: [
          "Help me solve this!",
          "The crystals glow!",
          "You're so smart!",
          "Let's try this!",
          "Magic math!",
        ],
        visualEmojis1: ["💎", "💠", "🔷", "🔹", "💙"],
        visualEmojis2: ["💜", "🔮", "⚗️", "✨", "⭐"],
      },
      "enchanted-forest": {
        creature: "🧚",
        messages: [
          "Let's add these!",
          "You're doing great!",
          "Forest magic!",
          "Try this problem!",
          "Good thinking!",
        ],
        visualEmojis1: ["🌲", "🌳", "🌴", "🎄", "🌿"],
        visualEmojis2: ["🍄", "🍃", "🌾", "🌱", "🪵"],
      },
    }
  }

  generateActivity(activityNumber, areaId = "flower-meadow") {
    // Determine difficulty based on activity number
    const difficulty = this.getDifficulty(activityNumber)

    // Each area focuses on a specific type of math problem
    let activityType
    switch (areaId) {
      case "flower-meadow":
        activityType = "addition"
        break
      case "crystal-cave":
        activityType = "subtraction"
        break
      case "enchanted-forest":
        activityType = "multiplication"
        break
      default:
        activityType = "addition"
    }

    if (activityType === "addition") {
      return this.generateAddition(difficulty, areaId)
    } else if (activityType === "subtraction") {
      return this.generateSubtraction(difficulty, areaId)
    } else {
      return this.generateMultiplication(difficulty, areaId)
    }
  }

  getDifficulty(activityNumber) {
    if (activityNumber < 10) return "easy"
    if (activityNumber < 20) return "medium"
    return "hard"
  }

  generateAddition(difficulty, areaId) {
    let max

    switch (difficulty) {
      case "easy":
        max = 10
        break
      case "medium":
        max = 15
        break
      case "hard":
        max = 20
        break
    }

    const num1 = Math.floor(Math.random() * max) + 1
    const num2 = Math.floor(Math.random() * max) + 1
    const answer = num1 + num2

    // Generate visual representation
    const visual = this.createVisualItems(num1, num2, areaId)

    // Create simple question
    const question = `${num1} + ${num2} = ?`

    // Generate answer options
    const options = this.generateOptions(answer, max * 2)

    return {
      type: "addition",
      question: question,
      correctAnswer: answer,
      options: options,
      visual: visual,
      creature: this.areaThemes[areaId]?.creature || "🦄",
      creatureMessage: this.getRandomMessage(areaId),
    }
  }

  generateSubtraction(difficulty, areaId) {
    let max

    switch (difficulty) {
      case "easy":
        max = 10
        break
      case "medium":
        max = 15
        break
      case "hard":
        max = 20
        break
    }

    const num1 = Math.floor(Math.random() * max) + Math.floor(max / 2) + 1
    const num2 = Math.floor(Math.random() * (num1 - 1)) + 1
    const answer = num1 - num2

    // Generate visual representation (showing items with some crossed out)
    const visual = this.createSubtractionVisual(num1, num2, areaId)

    // Create simple question
    const question = `${num1} - ${num2} = ?`

    // Generate answer options
    const options = this.generateOptions(answer, max * 2)

    return {
      type: "subtraction",
      question: question,
      correctAnswer: answer,
      options: options,
      visual: visual,
      creature: this.areaThemes[areaId]?.creature || "🦄",
      creatureMessage: this.getRandomMessage(areaId),
    }
  }

  generateMultiplication(difficulty, areaId) {
    // One operand is always less than 5
    const smallNum = Math.floor(Math.random() * 4) + 2 // 2-5
    let largeNum

    switch (difficulty) {
      case "easy":
        largeNum = Math.floor(Math.random() * 5) + 1 // 1-5
        break
      case "medium":
        largeNum = Math.floor(Math.random() * 7) + 1 // 1-7
        break
      case "hard":
        largeNum = Math.floor(Math.random() * 10) + 1 // 1-10
        break
    }

    const answer = smallNum * largeNum

    // Generate visual representation (groups of items)
    const visual = this.createMultiplicationVisual(smallNum, largeNum, areaId)

    // Create simple question
    const question = `${smallNum} × ${largeNum} = ?`

    // Generate answer options
    const options = this.generateOptions(answer, 50)

    return {
      type: "multiplication",
      question: question,
      correctAnswer: answer,
      options: options,
      visual: visual,
      creature: this.areaThemes[areaId]?.creature || "🦄",
      creatureMessage: this.getRandomMessage(areaId),
    }
  }

  getRandomMessage(areaId) {
    const theme = this.areaThemes[areaId] || this.areaThemes["flower-meadow"]
    const messages = theme.messages
    return messages[Math.floor(Math.random() * messages.length)]
  }

  createVisualItems(count1, count2, areaId = "flower-meadow") {
    const theme = this.areaThemes[areaId] || this.areaThemes["flower-meadow"]
    const items1 = theme.visualEmojis1
    const items2 = theme.visualEmojis2

    const visual = []

    // First group
    const emoji1 = items1[Math.floor(Math.random() * items1.length)]
    for (let i = 0; i < count1; i++) {
      visual.push(emoji1)
    }

    // Second group (if exists)
    if (count2 > 0) {
      const emoji2 = items2[Math.floor(Math.random() * items2.length)]
      for (let i = 0; i < count2; i++) {
        visual.push(emoji2)
      }
    }

    return visual
  }

  createSubtractionVisual(total, toSubtract, areaId = "flower-meadow") {
    const theme = this.areaThemes[areaId] || this.areaThemes["flower-meadow"]
    const items = theme.visualEmojis1
    const visual = []

    const emoji = items[Math.floor(Math.random() * items.length)]

    // Add items that remain (not crossed out)
    for (let i = 0; i < total - toSubtract; i++) {
      visual.push(emoji)
    }

    // Add crossed out items to show what was subtracted
    for (let i = 0; i < toSubtract; i++) {
      visual.push({ crossed: true, emoji: emoji })
    }

    return visual
  }

  createMultiplicationVisual(groups, itemsPerGroup, areaId = "flower-meadow") {
    const theme = this.areaThemes[areaId] || this.areaThemes["flower-meadow"]
    const items = theme.visualEmojis1
    const visual = []

    const emoji = items[Math.floor(Math.random() * items.length)]

    // Create groups of items with separators
    for (let group = 0; group < groups; group++) {
      // Add items in this group
      for (let i = 0; i < itemsPerGroup; i++) {
        visual.push(emoji)
      }

      // Add separator between groups (but not after the last group)
      if (group < groups - 1) {
        visual.push({ separator: true, emoji: "|" })
      }
    }

    return visual
  }

  generateOptions(correctAnswer, maxRange) {
    const options = new Set([correctAnswer])

    // Generate 3 wrong answers
    while (options.size < 4) {
      let wrongAnswer

      // Generate plausible wrong answers
      const offset = Math.floor(Math.random() * 5) + 1
      if (Math.random() < 0.5) {
        wrongAnswer = correctAnswer + offset
      } else {
        wrongAnswer = correctAnswer - offset
      }

      // Ensure answer is positive and within reasonable range
      if (wrongAnswer > 0 && wrongAnswer <= maxRange && wrongAnswer !== correctAnswer) {
        options.add(wrongAnswer)
      }
    }

    // Convert to array and shuffle
    return this.shuffleArray(Array.from(options))
  }

  shuffleArray(array) {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }
}

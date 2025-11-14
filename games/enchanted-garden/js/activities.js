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
      "time-temple": {
        creature: "🕰️",
        messages: [
          "What time is it?",
          "You can read clocks!",
          "Time is flowing!",
          "Great timing!",
          "Keep going!",
        ],
        visualEmojis1: ["⏰", "⏱️", "⌚", "🕐", "🕑"],
        visualEmojis2: ["🕒", "🕓", "🕔", "🕕", "🕖"],
      },
      "measurement-market": {
        creature: "🦊",
        messages: [
          "Let's measure!",
          "Good work!",
          "You're learning!",
          "Try this one!",
          "Keep measuring!",
        ],
        visualEmojis1: ["📏", "📐", "⚖️", "🧪", "🧴"],
        visualEmojis2: ["📦", "🎁", "🍎", "🍊", "🥕"],
      },
      "pattern-path": {
        creature: "🦋",
        messages: [
          "Find the pattern!",
          "You see it!",
          "Keep going!",
          "Great pattern work!",
          "Smart thinking!",
        ],
        visualEmojis1: ["🔵", "🔴", "🟡", "🟢", "🟣"],
        visualEmojis2: ["⭐", "💠", "🔷", "🔶", "💎"],
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
      case "time-temple":
        activityType = "time"
        break
      case "measurement-market":
        activityType = "measurement"
        break
      case "pattern-path":
        activityType = "pattern"
        break
      default:
        activityType = "addition"
    }

    // Route to appropriate generator
    switch (activityType) {
      case "addition":
        return this.generateAddition(difficulty, areaId)
      case "subtraction":
        return this.generateSubtraction(difficulty, areaId)
      case "multiplication":
        return this.generateMultiplication(difficulty, areaId)
      case "time":
        return this.generateTime(difficulty, areaId)
      case "measurement":
        return this.generateMeasurement(difficulty, areaId)
      case "pattern":
        return this.generatePattern(difficulty, areaId)
      default:
        return this.generateAddition(difficulty, areaId)
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

  /**
   * Generate time-telling questions
   */
  generateTime(difficulty, areaId) {
    // Mix between clock reading and time word problems
    const questionType = Math.random() < 0.7 ? "clock" : "elapsed"

    if (questionType === "elapsed") {
      // Time elapsed questions
      return this.generateTimeElapsed(difficulty, areaId)
    }

    // Clock reading questions
    let hourOptions, minuteOptions

    switch (difficulty) {
      case "easy":
        // Hour and half-hour only
        hourOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
        minuteOptions = [0, 30]
        break
      case "medium":
        // Add quarter hours
        hourOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
        minuteOptions = [0, 15, 30, 45]
        break
      case "hard":
        // 5-minute intervals
        hourOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
        minuteOptions = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]
        break
    }

    const hour = hourOptions[Math.floor(Math.random() * hourOptions.length)]
    const minute = minuteOptions[Math.floor(Math.random() * minuteOptions.length)]

    // Create question
    const minuteStr = minute < 10 ? `0${minute}` : `${minute}`
    const question = `What time does the clock show?`

    // Create SVG clock visual
    const clockSvg = this.createClockSVG(hour, minute)
    const visual = [{ html: clockSvg }]

    // Format answer (e.g., "3:00", "4:30")
    const answer = `${hour}:${minuteStr}`

    // Generate wrong answer options
    const options = this.generateTimeOptions(hour, minute)

    return {
      type: "time",
      question: question,
      correctAnswer: answer,
      options: options,
      visual: visual,
      creature: this.areaThemes[areaId]?.creature || "🕰️",
      creatureMessage: this.getRandomMessage(areaId),
    }
  }

  generateTimeElapsed(difficulty, areaId) {
    const startHour = Math.floor(Math.random() * 11) + 1 // 1-11
    let startMinute = 0
    let hoursToAdd = 0
    let minutesToAdd = 0

    switch (difficulty) {
      case "easy":
        hoursToAdd = [1, 2][Math.floor(Math.random() * 2)]
        break
      case "medium":
        hoursToAdd = [2, 3][Math.floor(Math.random() * 2)]
        break
      case "hard": {
        // For hard mode, include half-hour intervals
        const useHalfHour = Math.random() < 0.5
        if (useHalfHour) {
          startMinute = [0, 30][Math.floor(Math.random() * 2)]
          minutesToAdd = 30
          hoursToAdd = [1, 2, 3][Math.floor(Math.random() * 3)]
        } else {
          hoursToAdd = [3, 4, 5][Math.floor(Math.random() * 3)]
        }
        break
      }
    }

    // Calculate end time
    let endMinute = startMinute + minutesToAdd
    let endHour = startHour + hoursToAdd

    if (endMinute >= 60) {
      endMinute -= 60
      endHour += 1
    }

    if (endHour > 12) {
      endHour -= 12
    }

    // Format time strings
    const startMinuteStr = startMinute < 10 ? `0${startMinute}` : `${startMinute}`
    const endMinuteStr = endMinute < 10 ? `0${endMinute}` : `${endMinute}`

    // Build question based on whether we have half hours
    let timeDescription
    if (hoursToAdd > 0 && minutesToAdd > 0) {
      timeDescription = `${hoursToAdd} hour${hoursToAdd > 1 ? 's' : ''} and ${minutesToAdd} minutes`
    } else if (minutesToAdd > 0) {
      timeDescription = `${minutesToAdd} minutes`
    } else {
      timeDescription = `${hoursToAdd} hour${hoursToAdd > 1 ? 's' : ''}`
    }

    const question = `It is ${startHour}:${startMinuteStr}. What time is it ${timeDescription} later?`
    const answer = `${endHour}:${endMinuteStr}`

    const options = this.generateTimeOptions(endHour, endMinute)

    return {
      type: "time",
      question: question,
      correctAnswer: answer,
      options: options,
      visual: [], // No visual for word problems
      creature: this.areaThemes[areaId]?.creature || "🕰️",
      creatureMessage: this.getRandomMessage(areaId),
    }
  }

  createClockSVG(hour, minute) {
    const hourAngle = ((hour % 12) * 30 + minute * 0.5) - 90
    const minuteAngle = minute * 6 - 90

    // Generate all 12 hour numbers
    const hourNumbers = Array.from({ length: 12 }, (_, i) => {
      const num = i === 0 ? 12 : i
      const angle = (i * 30 - 90) * Math.PI / 180
      const x = 60 + 40 * Math.cos(angle)
      const y = 60 + 40 * Math.sin(angle) + 5 // +5 to center text vertically
      return `<text x="${x}" y="${y}" text-anchor="middle" font-size="12" fill="#333" font-weight="bold">${num}</text>`
    }).join('')

    // Generate minute tick marks
    const tickMarks = Array.from({ length: 60 }, (_, i) => {
      const angle = (i * 6 - 90) * Math.PI / 180
      const isHourMark = i % 5 === 0
      const innerRadius = isHourMark ? 48 : 50
      const outerRadius = 52
      const x1 = 60 + innerRadius * Math.cos(angle)
      const y1 = 60 + innerRadius * Math.sin(angle)
      const x2 = 60 + outerRadius * Math.cos(angle)
      const y2 = 60 + outerRadius * Math.sin(angle)
      const width = isHourMark ? 2 : 1
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#333" stroke-width="${width}"/>`
    }).join('')

    return `
      <svg width="140" height="140" viewBox="0 0 120 120" style="display:inline-block">
        <circle cx="60" cy="60" r="55" fill="white" stroke="#333" stroke-width="3"/>
        ${tickMarks}
        ${hourNumbers}
        <!-- Hour hand -->
        <line x1="60" y1="60" x2="${60 + 30 * Math.cos(hourAngle * Math.PI / 180)}" y2="${60 + 30 * Math.sin(hourAngle * Math.PI / 180)}" stroke="#333" stroke-width="6" stroke-linecap="round"/>
        <!-- Minute hand -->
        <line x1="60" y1="60" x2="${60 + 45 * Math.cos(minuteAngle * Math.PI / 180)}" y2="${60 + 45 * Math.sin(minuteAngle * Math.PI / 180)}" stroke="#666" stroke-width="4" stroke-linecap="round"/>
        <!-- Center dot -->
        <circle cx="60" cy="60" r="4" fill="#333"/>
      </svg>
    `
  }

  generateTimeOptions(correctHour, correctMinute) {
    const minuteStr = correctMinute < 10 ? `0${correctMinute}` : `${correctMinute}`
    const correctAnswer = `${correctHour}:${minuteStr}`
    const options = new Set([correctAnswer])

    while (options.size < 4) {
      // Generate plausible wrong answers
      let wrongHour = correctHour
      let wrongMinute = correctMinute

      if (Math.random() < 0.5) {
        // Change hour
        wrongHour = correctHour + (Math.random() < 0.5 ? 1 : -1)
        if (wrongHour < 1) wrongHour = 12
        if (wrongHour > 12) wrongHour = 1
      } else {
        // Change minute
        const minuteOptions = [0, 15, 30, 45]
        wrongMinute = minuteOptions[Math.floor(Math.random() * minuteOptions.length)]
      }

      const wrongMinuteStr = wrongMinute < 10 ? `0${wrongMinute}` : `${wrongMinute}`
      const wrongAnswer = `${wrongHour}:${wrongMinuteStr}`

      if (wrongAnswer !== correctAnswer) {
        options.add(wrongAnswer)
      }
    }

    return this.shuffleArray(Array.from(options))
  }

  /**
   * Generate measurement questions
   */
  generateMeasurement(difficulty, areaId) {
    const measurementTypes = ["length", "weight"]
    const type = measurementTypes[Math.floor(Math.random() * measurementTypes.length)]

    let question, answer, options, visual

    switch (type) {
      case "length": {
        // Simple length comparison or addition/subtraction
        const length1 = Math.floor(Math.random() * 8) + 2 // 2-9 inches
        const length2 = Math.floor(Math.random() * 8) + 2 // 2-9 inches

        const opType = Math.floor(Math.random() * 3) // 0=single, 1=add, 2=subtract

        if (opType === 0) {
          // Single measurement
          question = `How many inches long is the line?`
          answer = length1
          visual = [{ html: this.createRulerSVG(length1) }]
        } else if (opType === 1) {
          // Addition
          question = `One stick is ${length1} inches. Another is ${length2} inches. Total length?`
          answer = length1 + length2
          visual = [
            { html: this.createRulerSVG(length1) },
            { html: this.createRulerSVG(length2) }
          ]
        } else {
          // Subtraction (difference)
          const longer = Math.max(length1, length2)
          const shorter = Math.min(length1, length2)
          question = `One rope is ${longer} inches. Another is ${shorter} inches. What's the difference?`
          answer = longer - shorter
          visual = [
            { html: this.createRulerSVG(longer) },
            { html: this.createRulerSVG(shorter) }
          ]
        }
        break
      }

      case "weight": {
        const numItems1 = Math.floor(Math.random() * 4) + 2 // 2-5 items
        const weightPer1 = difficulty === "easy" ? 1 : Math.floor(Math.random() * 2) + 1 // 1-2 pounds

        const weightOpType = Math.floor(Math.random() * 2) // 0=single, 1=add

        if (weightOpType === 0 || difficulty === "easy") {
          // Single weight multiplication
          const totalWeight = numItems1 * weightPer1
          question = `${numItems1} apples weigh ${weightPer1} pound${weightPer1 > 1 ? 's' : ''} each. Total pounds?`
          answer = totalWeight
          visual = [{ html: this.createScaleSVG(numItems1) }]
        } else {
          // Adding two weights
          const numItems2 = Math.floor(Math.random() * 4) + 2
          const totalWeight1 = numItems1 * weightPer1
          const totalWeight2 = numItems2 * weightPer1
          question = `${numItems1} apples weigh ${totalWeight1} pounds. ${numItems2} oranges weigh ${totalWeight2} pounds. Total?`
          answer = totalWeight1 + totalWeight2
          visual = []  // Too complex for visualization
        }
        break
      }
    }

    options = this.generateOptions(answer, 50)

    return {
      type: "measurement",
      question: question,
      correctAnswer: answer,
      options: options,
      visual: visual,
      creature: this.areaThemes[areaId]?.creature || "🦊",
      creatureMessage: this.getRandomMessage(areaId),
    }
  }

  createRulerSVG(length) {
    return `
      <svg width="300" height="60" viewBox="0 0 300 60" style="display:inline-block">
        <rect x="0" y="20" width="${length * 25}" height="30" fill="none" stroke="#333" stroke-width="2"/>
        ${Array.from({ length: length + 1 }, (_, i) => `
          <line x1="${i * 25}" y1="20" x2="${i * 25}" y2="50" stroke="#333" stroke-width="2"/>
          <text x="${i * 25}" y="15" text-anchor="middle" font-size="10">${i}</text>
        `).join('')}
      </svg>
    `
  }

  createScaleSVG(numItems) {
    const apples = Array.from({ length: numItems }, (_, i) =>
      `<text x="${20 + i * 25}" y="50" font-size="30">🍎</text>`
    ).join('')

    return `
      <svg width="200" height="80" viewBox="0 0 200 80" style="display:inline-block">
        <text x="10" y="30" font-size="24">⚖️</text>
        ${apples}
      </svg>
    `
  }

  createCupsSVG(numCups) {
    const cups = Array.from({ length: numCups }, (_, i) =>
      `<text x="${20 + i * 35}" y="40" font-size="35">🧪</text>`
    ).join('')

    return `
      <svg width="250" height="60" viewBox="0 0 250 60" style="display:inline-block">
        ${cups}
      </svg>
    `
  }

  /**
   * Generate pattern/sequence questions
   */
  generatePattern(difficulty, areaId) {
    const patternTypes = ["skipCount", "whatsMissing"]
    const type = patternTypes[Math.floor(Math.random() * patternTypes.length)]

    let question, answer, options, visual

    switch (type) {
      case "skipCount": {
        // Skip counting using actual multiples
        const skipBy = difficulty === "easy" ? [2, 5, 10][Math.floor(Math.random() * 3)] : [3, 4, 6][Math.floor(Math.random() * 3)]

        // Start from a multiple of skipBy (between 1x and 3x)
        const startMultiplier = Math.floor(Math.random() * 3) + 1
        const start = skipBy * startMultiplier

        const sequence = [start, start + skipBy, start + skipBy * 2]
        answer = start + skipBy * 3

        question = `What number comes next?`
        visual = [sequence.join("  ,  ") + "  ,  ?"]
        break
      }

      case "whatsMissing": {
        // What's missing - show a sequence with one number missing
        const diff = difficulty === "easy" ?
          [1, 2, 5, 10][Math.floor(Math.random() * 4)] :
          [3, 4, 6, 7][Math.floor(Math.random() * 4)]

        const firstNum = Math.floor(Math.random() * 10) + 1
        const fullSequence = [firstNum, firstNum + diff, firstNum + diff * 2, firstNum + diff * 3]

        // Pick which position is missing (1 or 2, not first or last)
        const missingIndex = Math.floor(Math.random() * 2) + 1
        answer = fullSequence[missingIndex]

        // Build the visual sequence with a blank
        const displaySequence = fullSequence.map((num, idx) =>
          idx === missingIndex ? "__" : num.toString()
        )

        question = `What number is missing?`
        visual = [displaySequence.join("  ,  ")]
        break
      }
    }

    options = this.generateOptions(answer, 100)

    return {
      type: "pattern",
      question: question,
      correctAnswer: answer,
      options: options,
      visual: visual,
      creature: this.areaThemes[areaId]?.creature || "🦋",
      creatureMessage: this.getRandomMessage(areaId),
    }
  }
}

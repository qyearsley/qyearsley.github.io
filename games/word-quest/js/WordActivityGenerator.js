/**
 * Activity generation system for Word Quest
 */
export class WordActivityGenerator {
  constructor(wordBank) {
    this.wordBank = wordBank

    // Quest themes and icons
    this.questThemes = {
      "sound-cipher": {
        icon: "🔑",
        name: "Sound Cipher",
        description: "Decode letter sounds",
      },
      "blending-workshop": {
        icon: "🧩",
        name: "Spelling Workshop",
        description: "Listen and spell words",
      },
      "speed-vault": {
        icon: "⚡",
        name: "Speed Vault",
        description: "Recognize words quickly",
      },
      "pattern-archive": {
        icon: "🗺️",
        name: "Pattern Archive",
        description: "Discover word patterns",
      },
      "spell-forge": {
        icon: "📜",
        name: "Spell Forge",
        description: "Build words from sounds",
      },
      "story-vault": {
        icon: "📖",
        name: "Story Vault",
        description: "Read and understand",
      },
    }
  }

  /**
   * Generate an activity based on quest, difficulty, and activity number
   * @param {number} activityNumber - The activity number (1-based)
   * @param {string} questId - The quest identifier
   * @param {string} difficulty - Difficulty level
   * @returns {Object} Activity object
   */
  generateActivity(activityNumber, questId, difficulty) {
    switch (questId) {
      case "sound-cipher":
        return this.generateSoundCipherActivity(activityNumber, difficulty)
      case "blending-workshop":
        return this.generateBlendingActivity(activityNumber, difficulty)
      case "speed-vault":
        return this.generateSpeedVaultActivity(activityNumber, difficulty)
      case "pattern-archive":
        return this.generatePatternActivity(activityNumber, difficulty)
      case "spell-forge":
        return this.generateSpellingActivity(activityNumber, difficulty)
      case "story-vault":
        return this.generateStoryActivity(activityNumber, difficulty)
      default:
        return this.generateSoundCipherActivity(activityNumber, difficulty)
    }
  }

  /**
   * SOUND CIPHER - Phonics and letter sound activities
   */
  generateSoundCipherActivity(activityNumber, difficulty) {
    if (difficulty === "explorer") {
      return this.generateBeginningSound(activityNumber)
    } else if (difficulty === "adventurer") {
      return this.generateVowelPattern(activityNumber)
    } else {
      return this.generateComplexSound(activityNumber)
    }
  }

  /**
   * Explorer level: Beginning sound identification
   */
  generateBeginningSound(activityNumber) {
    const words = this.wordBank.getWords("explorer", "cvc")
    const correctWord = words[activityNumber % words.length]
    const correctLetter = correctWord[0]

    // Get picture if available
    const picture = this.wordBank.getPictureForWord("explorer", correctWord)

    // Generate distractors (other beginning letters)
    const allLetters = "bcdfghijklmnpqrstvwxyz".split("")
    const distractors = this.getRandomItems(
      allLetters.filter((l) => l !== correctLetter),
      2,
    )

    const choices = this.shuffleArray([correctLetter, ...distractors])

    return {
      type: "beginning-sound",
      question: picture
        ? `What sound does this word start with?`
        : `What sound does "${correctWord}" start with?`,
      visual: picture || correctWord,
      showPicture: !!picture,
      word: correctWord,
      correctAnswer: correctLetter,
      choices: choices,
      audioWord: correctWord,
      hint: `Say the word slowly: ${correctWord}`,
    }
  }

  /**
   * Adventurer level: Vowel patterns and digraphs
   */
  generateVowelPattern(activityNumber) {
    const useMagicE = activityNumber % 3 === 0
    const useDigraph = activityNumber % 3 === 1

    if (useMagicE) {
      // Magic E activity
      const cvceWords = this.wordBank.getWords("adventurer", "cvce")
      const correctWord = cvceWords[activityNumber % cvceWords.length]

      return {
        type: "magic-e",
        question: `Which word do you hear?`,
        visual: `Listen carefully`,
        correctAnswer: correctWord,
        choices: this.generateSimilarWords(correctWord, "adventurer", 3),
        audioWord: correctWord,
        hint: `This word has a magic 'e' that makes the vowel say its name!`,
        word: correctWord,
      }
    } else if (useDigraph) {
      // Digraph identification
      const digraphWords = this.wordBank.getWords("adventurer", "digraphs")
      const correctWord = digraphWords[activityNumber % digraphWords.length]

      // Find the digraph
      const digraphs = ["ch", "sh", "th", "wh"]
      let digraph = ""
      for (const dg of digraphs) {
        if (correctWord.includes(dg)) {
          digraph = dg
          break
        }
      }

      // Get distractors that are different from the correct digraph
      const distractorDigraphs = digraphs.filter((d) => d !== digraph)
      const selectedDistractors = this.getRandomItems(distractorDigraphs, 2)

      return {
        type: "digraph",
        question: `What digraph is in "${correctWord}"?`,
        visual: correctWord,
        correctAnswer: digraph,
        choices: this.shuffleArray([digraph, ...selectedDistractors]),
        audioWord: correctWord,
        hint: `A digraph is two letters that make one sound!`,
        word: correctWord,
      }
    } else {
      // Short vs long vowel
      const cvcWords = this.wordBank.getWords("adventurer", "cvc")
      const cvceWords = this.wordBank.getWords("adventurer", "cvce")

      const useShort = activityNumber % 2 === 0
      const correctWord = useShort
        ? cvcWords[activityNumber % cvcWords.length]
        : cvceWords[activityNumber % cvceWords.length]

      return {
        type: "vowel-sound",
        question: `Does "${correctWord}" have a short or long vowel sound?`,
        visual: correctWord,
        correctAnswer: useShort ? "short" : "long",
        choices: ["short", "long"],
        audioWord: correctWord,
        hint: `Say it out loud and listen carefully!`,
        word: correctWord,
      }
    }
  }

  /**
   * Master level: Complex sounds and patterns
   */
  generateComplexSound(activityNumber) {
    const useRControlled = activityNumber % 3 === 0
    const useSilent = activityNumber % 3 === 1

    if (useRControlled) {
      const rWords = this.wordBank.getWords("master", "rControlled")
      const correctWord = rWords[activityNumber % rWords.length]

      // Identify the r-controlled pattern
      const patterns = ["ar", "er", "ir", "or", "ur"]
      let pattern = ""
      for (const p of patterns) {
        if (correctWord.includes(p)) {
          pattern = p
          break
        }
      }

      return {
        type: "r-controlled",
        question: `What r-controlled vowel pattern is in "${correctWord}"?`,
        visual: correctWord,
        correctAnswer: pattern,
        choices: this.shuffleArray([pattern, ...this.getRandomItems(patterns.filter((p) => p !== pattern), 2)]),
        audioWord: correctWord,
        hint: `The 'r' changes how the vowel sounds!`,
        word: correctWord,
      }
    } else if (useSilent) {
      const silentWords = this.wordBank.getWords("master", "silentLetters")
      const correctWord = silentWords[activityNumber % silentWords.length]

      // Find the silent letter
      let silentLetter = ""
      if (correctWord.includes("kn")) silentLetter = "k"
      else if (correctWord.includes("wr")) silentLetter = "w"
      else if (correctWord.includes("mb")) silentLetter = "b"

      return {
        type: "silent-letter",
        question: `Which letter is silent in "${correctWord}"?`,
        visual: correctWord,
        correctAnswer: silentLetter,
        choices: correctWord.split("").filter((l, i, arr) => arr.indexOf(l) === i).slice(0, 3),
        audioWord: correctWord,
        hint: `Some letters don't make a sound!`,
        word: correctWord,
      }
    } else {
      // Complex vowel teams
      const complexWords = this.wordBank.getWords("master", "complexPatterns")
      const correctWord = complexWords[activityNumber % complexWords.length]

      return {
        type: "vowel-team",
        question: `How do you spell the /sound/ you hear in "${correctWord}"?`,
        visual: `_${correctWord.substring(1)}`,
        correctAnswer: correctWord[0],
        choices: this.shuffleArray([correctWord[0], ...this.getRandomItems("aeiou".split(""), 2)]),
        audioWord: correctWord,
        hint: `Listen carefully to the vowel sound!`,
        word: correctWord,
      }
    }
  }

  /**
   * BLENDING WORKSHOP - Spelling from sounds
   */
  generateBlendingActivity(activityNumber, difficulty) {
    if (difficulty === "explorer") {
      // Simple CVC spelling - choose beginning sound
      const words = this.wordBank.getWords("explorer", "cvc")
      const correctWord = words[activityNumber % words.length]
      const firstLetter = correctWord[0]
      const restOfWord = correctWord.substring(1)

      // Generate distractor letters
      const allLetters = "bcdfghjklmnpqrstvwxyz".split("")
      const distractors = this.getRandomItems(
        allLetters.filter((l) => l !== firstLetter),
        2,
      )

      return {
        type: "spell-beginning",
        question: `What letter does this word start with?`,
        visual: `_ ${restOfWord}`,
        correctAnswer: firstLetter,
        choices: this.shuffleArray([firstLetter, ...distractors]),
        audioWord: correctWord,
        hint: `Listen to the first sound!`,
        word: correctWord,
      }
    } else if (difficulty === "adventurer") {
      // CVCe or digraph spelling - choose middle/vowel sound
      const useDigraph = activityNumber % 2 === 0
      const words = useDigraph
        ? this.wordBank.getWords("adventurer", "digraphs")
        : this.wordBank.getWords("adventurer", "cvce")
      const correctWord = words[activityNumber % words.length]

      // For digraphs, find the digraph position
      if (useDigraph) {
        const digraphs = ["ch", "sh", "th", "wh"]
        for (const digraph of digraphs) {
          const index = correctWord.indexOf(digraph)
          if (index !== -1) {
            const before = correctWord.substring(0, index)
            const after = correctWord.substring(index + 2)
            const distractors = digraphs.filter((d) => d !== digraph).slice(0, 2)

            return {
              type: "spell-digraph",
              question: `How do you spell this word?`,
              visual: `${before} __ ${after}`,
              correctAnswer: digraph,
              choices: this.shuffleArray([digraph, ...distractors]),
              audioWord: correctWord,
              hint: `Listen for the digraph sound!`,
              word: correctWord,
            }
          }
        }
      }

      // For CVCe, choose the vowel
      const vowelIndex = correctWord.search(/[aeiou]/)
      if (vowelIndex !== -1) {
        const vowel = correctWord[vowelIndex]
        const before = correctWord.substring(0, vowelIndex)
        const after = correctWord.substring(vowelIndex + 1)
        const distractors = "aeiou".split("").filter((v) => v !== vowel).slice(0, 2)

        return {
          type: "spell-vowel",
          question: `What vowel do you hear in this word?`,
          visual: `${before} __ ${after}`,
          correctAnswer: vowel,
          choices: this.shuffleArray([vowel, ...distractors]),
          audioWord: correctWord,
          hint: `Listen for the long vowel sound!`,
          word: correctWord,
        }
      }

      // Fallback
      return this.generateSpellingActivity(activityNumber, difficulty)
    } else {
      // Multi-syllable spelling - choose missing part
      const words = this.wordBank.getWords("master", "multiSyllable")
      const correctWord = words[activityNumber % words.length]
      const syllables = this.breakIntoSyllables(correctWord)

      if (syllables.length >= 2) {
        // Pick a syllable to blank out
        const blankIndex = activityNumber % syllables.length
        const correctSyllable = syllables[blankIndex]

        // Create visual with blank
        const visual = syllables
          .map((syl, i) => (i === blankIndex ? "___" : syl))
          .join("")

        // Generate distractors (other syllables from similar words)
        const allWords = this.wordBank.getWords("master", "multiSyllable")
        const allSyllables = []
        for (const w of allWords) {
          allSyllables.push(...this.breakIntoSyllables(w))
        }
        const distractors = this.getRandomItems(
          allSyllables.filter((s) => s !== correctSyllable && s.length === correctSyllable.length),
          2,
        )

        return {
          type: "spell-syllable",
          question: `What syllable is missing?`,
          visual: visual,
          correctAnswer: correctSyllable,
          choices: this.shuffleArray([correctSyllable, ...distractors]),
          audioWord: correctWord,
          hint: `Listen to the whole word!`,
          word: correctWord,
        }
      }

      // Fallback
      return this.generateSpellingActivity(activityNumber, difficulty)
    }
  }

  /**
   * SPEED VAULT - Sight word recognition
   */
  generateSpeedVaultActivity(activityNumber, difficulty) {
    const sightWords = this.wordBank.getSightWords(difficulty)
    const correctWord = sightWords[activityNumber % sightWords.length]

    // Generate distractors
    const distractors = this.getRandomItems(
      sightWords.filter((w) => w !== correctWord),
      3,
    )

    return {
      type: "sight-word",
      question: `Find the word: "${correctWord}"`,
      visual: null,
      correctAnswer: correctWord,
      choices: this.shuffleArray([correctWord, ...distractors]),
      audioWord: correctWord,
      hint: `Look carefully and find it quickly!`,
      word: correctWord,
      isTimed: difficulty !== "explorer", // Time pressure for higher levels
    }
  }

  /**
   * PATTERN ARCHIVE - Word families and patterns
   */
  generatePatternActivity(activityNumber, difficulty) {
    const families = this.wordBank.getAllWordFamilies(difficulty)
    const familyKeys = Object.keys(families)
    const familyKey = familyKeys[activityNumber % familyKeys.length]
    const familyWords = families[familyKey]

    const correctWord = familyWords[activityNumber % familyWords.length]

    return {
      type: "word-family",
      question: `Which word belongs to the "-${familyKey}" family?`,
      visual: `Pattern: -${familyKey}`,
      correctAnswer: correctWord,
      choices: [
        correctWord,
        ...this.getRandomItems(
          this.wordBank.getWords(difficulty, "cvc").filter((w) => !w.endsWith(familyKey)),
          2,
        ),
      ],
      audioWord: correctWord,
      hint: `Listen for the rhyme!`,
      word: correctWord,
      pattern: familyKey,
    }
  }

  /**
   * SPELL FORGE - Spelling activities
   */
  generateSpellingActivity(activityNumber, difficulty) {
    let wordType = "cvc"
    if (difficulty === "adventurer") {
      wordType = activityNumber % 2 === 0 ? "cvce" : "digraphs"
    } else if (difficulty === "master") {
      wordType = activityNumber % 2 === 0 ? "multiSyllable" : "complexPatterns"
    }

    const words = this.wordBank.getWords(difficulty, wordType)
    const correctWord = words[activityNumber % words.length]

    // Create fill-in-the-blank
    const blankPosition = Math.floor(correctWord.length / 2)
    const blanked = correctWord.split("").map((l, i) => (i === blankPosition ? "_" : l)).join("")

    const correctLetter = correctWord[blankPosition]
    const distractors = this.getRandomItems(
      "abcdefghijklmnopqrstuvwxyz".split("").filter((l) => l !== correctLetter),
      2,
    )

    return {
      type: "spelling",
      question: `Fill in the blank to spell the word:`,
      visual: blanked,
      correctAnswer: correctLetter,
      choices: this.shuffleArray([correctLetter, ...distractors]),
      audioWord: correctWord,
      hint: `Listen to the word and think about each sound!`,
      word: correctWord,
      fullWord: correctWord,
    }
  }

  /**
   * STORY VAULT - Reading comprehension
   */
  generateStoryActivity(activityNumber, difficulty) {
    // Simple decodable sentences
    const stories = this.getDecodableStories(difficulty)
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

  /**
   * Helper: Get decodable stories for each difficulty
   */
  getDecodableStories(difficulty) {
    if (difficulty === "explorer") {
      return [
        {
          text: "The cat sat. The cat ran.",
          question: "What did the cat do?",
          answer: "sat and ran",
          choices: ["sat and ran", "jumped", "slept"],
        },
        {
          text: "I see a red hat. I see a big hat.",
          question: "What color is the hat?",
          answer: "red",
          choices: ["red", "blue", "green"],
        },
        {
          text: "The dog can run. The dog can jump.",
          question: "What can the dog do?",
          answer: "run and jump",
          choices: ["run and jump", "swim", "fly"],
        },
      ]
    } else if (difficulty === "adventurer") {
      return [
        {
          text: "The boy rode his bike to the park. He played on the swings. Then he went home.",
          question: "Where did the boy go?",
          answer: "the park",
          choices: ["the park", "the store", "school"],
        },
        {
          text: "She made a cake for her friend. The cake was very good. They ate it together.",
          question: "Who was the cake for?",
          answer: "her friend",
          choices: ["her friend", "her mom", "herself"],
        },
      ]
    } else {
      return [
        {
          text: "The rabbit hopped quickly through the garden. It was looking for fresh carrots to eat. The farmer didn't see it.",
          question: "What was the rabbit looking for?",
          answer: "carrots",
          choices: ["carrots", "lettuce", "flowers"],
        },
        {
          text: "Before the storm came, the children played outside. They ran and laughed together. When the rain started, they hurried inside.",
          question: "What happened when the rain started?",
          answer: "they went inside",
          choices: ["they went inside", "they kept playing", "they cried"],
        },
      ]
    }
  }

  /**
   * Helper: Generate similar words for distractor choices
   */
  generateSimilarWords(word, difficulty, count) {
    const cvcWords = this.wordBank.getWords(difficulty, "cvc")
    const cvceWords = this.wordBank.getWords(difficulty, "cvce")

    const allWords = [...cvcWords, ...cvceWords]

    // Find words with similar length
    const similarLength = allWords.filter((w) => Math.abs(w.length - word.length) <= 1 && w !== word)

    const distractors = this.getRandomItems(similarLength, count - 1)
    return this.shuffleArray([word, ...distractors])
  }

  /**
   * Helper: Break word into phonemes (sounds)
   */
  breakIntoPhonemes(word) {
    // Simple phoneme splitting (could be more sophisticated)
    const digraphs = ["ch", "sh", "th", "wh", "ph", "ck"]

    const phonemes = []
    let i = 0
    while (i < word.length) {
      let foundDigraph = false
      for (const digraph of digraphs) {
        if (word.substring(i, i + 2) === digraph) {
          phonemes.push(digraph)
          i += 2
          foundDigraph = true
          break
        }
      }
      if (!foundDigraph) {
        phonemes.push(word[i])
        i++
      }
    }
    return phonemes
  }

  /**
   * Helper: Break word into syllables
   */
  breakIntoSyllables(word) {
    // Simple syllable splitting
    const vowels = "aeiou"
    const syllables = []
    let currentSyllable = ""

    for (let i = 0; i < word.length; i++) {
      currentSyllable += word[i]

      // Simple rule: split after consonant following a vowel
      if (
        i > 0 &&
        vowels.includes(word[i - 1]) &&
        !vowels.includes(word[i]) &&
        i < word.length - 1
      ) {
        syllables.push(currentSyllable)
        currentSyllable = ""
      }
    }

    if (currentSyllable) syllables.push(currentSyllable)
    return syllables.length > 0 ? syllables : [word]
  }

  /**
   * Helper: Get random items from array
   */
  getRandomItems(array, count) {
    const shuffled = [...array].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, Math.min(count, array.length))
  }

  /**
   * Helper: Shuffle array
   */
  shuffleArray(array) {
    return [...array].sort(() => Math.random() - 0.5)
  }

  /**
   * Get quest theme information
   */
  getQuestTheme(questId) {
    return this.questThemes[questId] || this.questThemes["sound-cipher"]
  }
}

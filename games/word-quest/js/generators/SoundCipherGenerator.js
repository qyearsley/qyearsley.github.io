/**
 * Sound Cipher (Phonics) Activity Generator
 * Focuses on letter sounds, vowel patterns, and phonological awareness
 */
import { BaseActivityGenerator } from "./BaseActivityGenerator.js"
import { CONSONANTS, R_CONTROLLED_PATTERNS, DIGRAPHS } from "../constants.js"

export class SoundCipherGenerator extends BaseActivityGenerator {
  /**
   * Generate a sound cipher activity based on difficulty
   * @param {number} activityNumber - Activity sequence number
   * @param {string} difficulty - Difficulty level
   * @returns {Object} Activity object
   */
  generateActivity(activityNumber, difficulty) {
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
   * Teaching goal: Letter-sound correspondence for initial consonants
   */
  generateBeginningSound(activityNumber) {
    const words = this.wordBank.getWords("explorer", "cvc")
    const correctWord = words[activityNumber % words.length]
    const correctLetter = correctWord[0]

    const picture = this.wordBank.getPictureForWord("explorer", correctWord)

    // Generate distractors (other beginning letters)
    const allLetters = CONSONANTS.split("")
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
   * Teaching goal: Magic E, digraph identification, short vs long vowels
   */
  generateVowelPattern(activityNumber) {
    // Rotate through activity types for variety
    const useMagicE = activityNumber % 3 === 0
    const useDigraph = activityNumber % 3 === 1

    if (useMagicE) {
      return this.generateMagicEActivity(activityNumber)
    } else if (useDigraph) {
      return this.generateDigraphActivity(activityNumber)
    } else {
      return this.generateVowelSoundActivity(activityNumber)
    }
  }

  /**
   * Generate magic E pattern activity
   * Teaching goal: Recognize how silent E changes vowel sound
   */
  generateMagicEActivity(activityNumber) {
    const cvceWords = this.wordBank.getWords("adventurer", "cvce")
    const correctWord = cvceWords[activityNumber % cvceWords.length]

    return {
      type: "magic-e",
      question: `Which word do you hear?`,
      visual: `Listen carefully`,
      correctAnswer: correctWord,
      choices: this.generateSimilarWords(correctWord, "adventurer", 3),
      audioWord: correctWord,
      autoPlayAudio: true, // Listening is integral to this question
      hint: `This word has a magic 'e' that makes the vowel say its name!`,
      word: correctWord,
    }
  }

  /**
   * Generate digraph identification activity
   * Teaching goal: Recognize two-letter sounds (ch, sh, th, wh)
   */
  generateDigraphActivity(activityNumber) {
    const digraphWords = this.wordBank.getWords("adventurer", "digraphs")
    const correctWord = digraphWords[activityNumber % digraphWords.length]

    // Find the digraph in the word
    let digraph = ""
    for (const dg of DIGRAPHS) {
      if (correctWord.includes(dg)) {
        digraph = dg
        break
      }
    }

    const distractorDigraphs = DIGRAPHS.filter((d) => d !== digraph)
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
  }

  /**
   * Generate short vs long vowel activity
   * Teaching goal: Distinguish vowel sounds
   */
  generateVowelSoundActivity(activityNumber) {
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

  /**
   * Master level: Complex sounds and patterns
   * Teaching goal: R-controlled vowels, silent letters, complex vowel teams
   */
  generateComplexSound(activityNumber) {
    // Rotate through complex sound types
    const useRControlled = activityNumber % 3 === 0
    const useSilent = activityNumber % 3 === 1

    if (useRControlled) {
      return this.generateRControlledActivity(activityNumber)
    } else if (useSilent) {
      return this.generateSilentLetterActivity(activityNumber)
    } else {
      return this.generateVowelTeamActivity(activityNumber)
    }
  }

  /**
   * Generate R-controlled vowel activity
   * Teaching goal: Recognize how R changes vowel sounds (ar, er, ir, or, ur)
   */
  generateRControlledActivity(activityNumber) {
    const rWords = this.wordBank.getWords("master", "rControlled")
    const correctWord = rWords[activityNumber % rWords.length]

    // Identify the r-controlled pattern
    let pattern = ""
    for (const p of R_CONTROLLED_PATTERNS) {
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
      choices: this.shuffleArray([
        pattern,
        ...this.getRandomItems(
          R_CONTROLLED_PATTERNS.filter((p) => p !== pattern),
          2,
        ),
      ]),
      audioWord: correctWord,
      hint: `The 'r' changes how the vowel sounds!`,
      word: correctWord,
    }
  }

  /**
   * Generate silent letter activity
   * Teaching goal: Recognize letters that don't make sounds (kn, wr, mb)
   */
  generateSilentLetterActivity(activityNumber) {
    const silentWords = this.wordBank.getWords("master", "silentLetters")
    const correctWord = silentWords[activityNumber % silentWords.length]

    // Identify the silent letter
    let silentLetter = ""
    if (correctWord.includes("kn")) silentLetter = "k"
    else if (correctWord.includes("wr")) silentLetter = "w"
    else if (correctWord.includes("mb")) silentLetter = "b"

    return {
      type: "silent-letter",
      question: `Which letter is silent in "${correctWord}"?`,
      visual: correctWord,
      correctAnswer: silentLetter,
      choices: correctWord
        .split("")
        .filter((l, i, arr) => arr.indexOf(l) === i)
        .slice(0, 3),
      audioWord: correctWord,
      hint: `Some letters don't make a sound!`,
      word: correctWord,
    }
  }

  /**
   * Generate vowel team activity
   * Teaching goal: Complex vowel combinations
   */
  generateVowelTeamActivity(activityNumber) {
    const complexWords = this.wordBank.getWords("master", "complexPatterns")
    const correctWord = complexWords[activityNumber % complexWords.length]

    return {
      type: "vowel-team",
      question: `How do you spell the /sound/ you hear in "${correctWord}"?`,
      visual: `_${correctWord.substring(1)}`,
      correctAnswer: correctWord[0],
      choices: this.shuffleArray([correctWord[0], ...this.getRandomItems("aeiou".split(""), 2)]),
      audioWord: correctWord,
      autoPlayAudio: true, // Listening is integral to this question
      hint: `Listen carefully to the vowel sound!`,
      word: correctWord,
    }
  }
}

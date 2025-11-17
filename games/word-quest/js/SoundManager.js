/**
 * Sound Manager for Word Quest
 * Handles audio playback for words and letter sounds
 */
export class SoundManager {
  constructor() {
    this.enabled = true
    this.audioCache = new Map()
  }

  /**
   * Enable or disable sounds
   * @param {boolean} enabled - Whether sounds are enabled
   */
  setEnabled(enabled) {
    this.enabled = enabled
  }

  /**
   * Play word pronunciation using Web Speech API
   * @param {string} word - Word to pronounce
   */
  playWord(word) {
    if (!this.enabled || !word) return

    try {
      // Use Web Speech API
      const utterance = new SpeechSynthesisUtterance(word)
      utterance.rate = 0.8 // Slower for learning
      utterance.pitch = 1.0
      utterance.volume = 1.0
      window.speechSynthesis.speak(utterance)
    } catch (error) {
      console.warn("Speech synthesis not supported:", error)
    }
  }

  /**
   * Play letter sound
   * @param {string} letter - Letter to pronounce
   */
  playLetterSound(letter) {
    if (!this.enabled || !letter) return

    // For letter sounds, we can use phonetic pronunciation
    // This is a simplified version
    this.playWord(letter)
  }

  /**
   * Play sounds for an array of phonemes
   * @param {Array<string>} sounds - Array of sounds to play
   */
  playSounds(sounds) {
    if (!this.enabled || !sounds) return

    let delay = 0
    sounds.forEach((sound) => {
      setTimeout(() => this.playWord(sound), delay)
      delay += 600 // Delay between sounds
    })
  }

  /**
   * Stop all currently playing sounds
   */
  stopAll() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
  }
}

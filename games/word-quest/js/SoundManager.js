/**
 * Sound Manager for Word Quest
 * Handles audio playback for words and letter sounds
 */
export class SoundManager {
  constructor() {
    this.enabled = true
    this.audioCache = new Map()
    this.speechSupported = this.checkSpeechSupport()
  }

  /**
   * Check if Web Speech API is supported
   * @returns {boolean} True if speech synthesis is available
   */
  checkSpeechSupport() {
    if (typeof window === "undefined") return false

    const supported = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window

    if (!supported) {
      console.warn("Web Speech API not supported in this browser")
    }

    return supported
  }

  /**
   * Get speech synthesis availability status
   * @returns {boolean} True if speech is available
   */
  isSpeechAvailable() {
    return this.speechSupported
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
   * @returns {boolean} True if successfully played, false otherwise
   */
  playWord(word) {
    if (!this.enabled || !word) return false

    if (!this.speechSupported) {
      console.warn("Speech synthesis not available. Cannot play word:", word)
      return false
    }

    try {
      // Cancel any ongoing speech
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel()
      }

      // Use Web Speech API
      // eslint-disable-next-line no-undef
      const utterance = new SpeechSynthesisUtterance(word)
      utterance.rate = 0.8 // Slower for learning
      utterance.pitch = 1.0
      utterance.volume = 1.0

      // Handle errors
      utterance.onerror = (event) => {
        console.error("Speech synthesis error:", event.error)
      }

      window.speechSynthesis.speak(utterance)
      return true
    } catch (error) {
      console.warn("Speech synthesis failed:", error)
      return false
    }
  }

  /**
   * Play letter sound
   * @param {string} letter - Letter to pronounce
   * @returns {boolean} True if successfully played
   */
  playLetterSound(letter) {
    if (!this.enabled || !letter) return false

    // For letter sounds, we can use phonetic pronunciation
    // This is a simplified version
    return this.playWord(letter)
  }

  /**
   * Play sounds for an array of phonemes
   * @param {Array<string>} sounds - Array of sounds to play
   */
  playSounds(sounds) {
    if (!this.enabled || !sounds || !this.speechSupported) return

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
    if (this.speechSupported && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
  }
}

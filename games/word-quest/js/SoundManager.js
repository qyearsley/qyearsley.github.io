/**
 * Sound Manager for Word Quest
 * Handles audio playback for words and letter sounds
 */
export class SoundManager {
  constructor() {
    this.audioContext = null
    this.enabled = true
    this.audioCache = new Map()
    this.speechSupported = this.checkSpeechSupport()
    this.volume = 0.3 // Keep sounds subtle
    this.isSupported = true
  }

  /**
   * Initialize audio context (must be called after user interaction)
   * @returns {boolean} Whether initialization was successful
   */
  initAudioContext() {
    if (this.audioContext) {
      return true
    }

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      if (!AudioContextClass) {
        this.isSupported = false
        console.warn("Web Audio API is not supported in this browser")
        return false
      }
      this.audioContext = new AudioContextClass()
      return true
    } catch (error) {
      this.isSupported = false
      console.warn("Failed to initialize audio context:", error)
      return false
    }
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
   * Play a correct answer sound (cheerful upward notes)
   */
  playCorrect() {
    if (!this.enabled || !this.isSupported) return
    if (!this.initAudioContext()) return

    // Play a pleasant ascending arpeggio
    const now = this.audioContext.currentTime
    this.playTone(523.25, now, 0.08, 0.15) // C5
    this.playTone(659.25, now + 0.08, 0.08, 0.15) // E5
    this.playTone(783.99, now + 0.16, 0.12, 0.2) // G5
  }

  /**
   * Play an incorrect answer sound (gentle low tone)
   */
  playIncorrect() {
    if (!this.enabled || !this.isSupported) return
    if (!this.initAudioContext()) return

    // Play a gentle low tone
    const now = this.audioContext.currentTime
    this.playTone(200, now, 0.15, 0.1)
  }

  /**
   * Play a tone at the specified frequency
   * @param {number} frequency - Frequency in Hz
   * @param {number} startTime - When to start the tone
   * @param {number} duration - How long to play the tone
   * @param {number} volume - Volume multiplier (0-1)
   */
  playTone(frequency, startTime, duration, volume = 0.2) {
    if (!this.audioContext) {
      return
    }

    try {
      const oscillator = this.audioContext.createOscillator()
      const gainNode = this.audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(this.audioContext.destination)

      oscillator.frequency.value = frequency
      oscillator.type = "sine"

      // Envelope for smoother sound
      gainNode.gain.setValueAtTime(0, startTime)
      gainNode.gain.linearRampToValueAtTime(volume * this.volume, startTime + 0.01)
      gainNode.gain.linearRampToValueAtTime(0, startTime + duration)

      oscillator.start(startTime)
      oscillator.stop(startTime + duration)

      // Clean up after the sound finishes to prevent memory leaks
      oscillator.addEventListener("ended", () => {
        gainNode.disconnect()
        oscillator.disconnect()
      })
    } catch (error) {
      console.warn("Failed to play sound:", error)
    }
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

  /**
   * Clean up resources when the sound manager is no longer needed
   */
  dispose() {
    if (this.audioContext) {
      try {
        this.audioContext.close()
      } catch (error) {
        console.warn("Error closing audio context:", error)
      }
      this.audioContext = null
    }
  }
}

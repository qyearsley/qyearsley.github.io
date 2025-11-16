/**
 * Simple sound effects manager using Web Audio API
 */
export class SoundManager {
  constructor() {
    this.audioContext = null
    this.enabled = true
    this.volume = 0.3 // Keep sounds subtle
    this.isSupported = true
  }

  /**
   * Initialize audio context (must be called after user interaction)
   * @returns {boolean} Whether initialization was successful
   */
  init() {
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
   * Set whether sounds are enabled
   * @param {boolean} enabled - Whether to enable sounds
   */
  setEnabled(enabled) {
    this.enabled = enabled
  }

  /**
   * Play a correct answer sound (cheerful upward notes)
   */
  playCorrect() {
    if (!this.enabled || !this.isSupported) return
    if (!this.init()) return

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
    if (!this.init()) return

    // Play a gentle low tone
    const now = this.audioContext.currentTime
    this.playTone(200, now, 0.15, 0.1)
  }

  /**
   * Play a click sound for button presses
   */
  playClick() {
    if (!this.enabled || !this.isSupported) return
    if (!this.init()) return

    const now = this.audioContext.currentTime
    this.playTone(800, now, 0.05, 0.05)
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
   * Play celebration sound for level complete
   */
  playCelebration() {
    if (!this.enabled || !this.isSupported) return
    if (!this.init()) return

    // Play a cheerful melody
    const now = this.audioContext.currentTime
    this.playTone(523.25, now, 0.1, 0.15) // C5
    this.playTone(659.25, now + 0.1, 0.1, 0.15) // E5
    this.playTone(783.99, now + 0.2, 0.1, 0.15) // G5
    this.playTone(1046.5, now + 0.3, 0.2, 0.2) // C6
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

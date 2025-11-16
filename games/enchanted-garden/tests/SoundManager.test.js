import { SoundManager } from "../js/SoundManager.js"

describe("SoundManager", () => {
  let soundManager
  let mockAudioContext
  let originalAudioContext
  let originalWebkitAudioContext
  let originalConsoleWarn

  beforeEach(() => {
    // Mock console.warn to avoid noisy test output
    originalConsoleWarn = console.warn
    console.warn = () => {}

    // Save original values
    originalAudioContext = global.AudioContext
    originalWebkitAudioContext = global.webkitAudioContext

    // Create a simple mock AudioContext
    const createMockOscillator = () => ({
      connect: () => {},
      disconnect: () => {},
      start: () => {},
      stop: () => {},
      addEventListener: () => {},
      frequency: { value: 0 },
      type: "sine",
    })

    const createMockGain = () => ({
      connect: () => {},
      disconnect: () => {},
      gain: {
        setValueAtTime: () => {},
        linearRampToValueAtTime: () => {},
      },
    })

    mockAudioContext = {
      currentTime: 0,
      destination: {},
      createOscillator: createMockOscillator,
      createGain: createMockGain,
      close: () => Promise.resolve(),
    }

    // Mock window.AudioContext
    global.AudioContext = function () {
      return mockAudioContext
    }

    soundManager = new SoundManager()
  })

  afterEach(() => {
    // Restore console.warn
    console.warn = originalConsoleWarn

    // Restore original values
    global.AudioContext = originalAudioContext
    global.webkitAudioContext = originalWebkitAudioContext
  })

  describe("constructor", () => {
    test("initializes with default values", () => {
      expect(soundManager.audioContext).toBeNull()
      expect(soundManager.enabled).toBe(true)
      expect(soundManager.volume).toBe(0.3)
      expect(soundManager.isSupported).toBe(true)
    })
  })

  describe("init", () => {
    test("creates audio context on first call", () => {
      const result = soundManager.init()

      expect(result).toBe(true)
      expect(soundManager.audioContext).not.toBeNull()
    })

    test("returns true if audio context already exists", () => {
      soundManager.init()
      const firstContext = soundManager.audioContext
      soundManager.init()

      expect(soundManager.audioContext).toBe(firstContext)
    })

    test("handles missing AudioContext gracefully", () => {
      global.AudioContext = undefined
      global.webkitAudioContext = undefined

      const result = soundManager.init()

      expect(result).toBe(false)
      expect(soundManager.isSupported).toBe(false)
      expect(soundManager.audioContext).toBeNull()
    })

    test("handles AudioContext initialization errors", () => {
      global.AudioContext = function () {
        throw new Error("Not allowed")
      }

      const result = soundManager.init()

      expect(result).toBe(false)
      expect(soundManager.isSupported).toBe(false)
    })

    test("tries webkitAudioContext if AudioContext is not available", () => {
      global.AudioContext = undefined
      global.webkitAudioContext = function () {
        return mockAudioContext
      }

      const result = soundManager.init()

      expect(result).toBe(true)
    })
  })

  describe("setEnabled", () => {
    test("enables sounds", () => {
      soundManager.setEnabled(true)
      expect(soundManager.enabled).toBe(true)
    })

    test("disables sounds", () => {
      soundManager.setEnabled(false)
      expect(soundManager.enabled).toBe(false)
    })
  })

  describe("playCorrect", () => {
    test("does not play if disabled", () => {
      soundManager.setEnabled(false)
      soundManager.playCorrect()

      // Should not have initialized context
      expect(soundManager.audioContext).toBeNull()
    })

    test("does not play if not supported", () => {
      soundManager.isSupported = false
      soundManager.playCorrect()

      expect(soundManager.audioContext).toBeNull()
    })

    test("plays correct sound when enabled", () => {
      soundManager.playCorrect()

      expect(soundManager.audioContext).not.toBeNull()
    })

    test("initializes audio context if not already initialized", () => {
      expect(soundManager.audioContext).toBeNull()
      soundManager.playCorrect()
      expect(soundManager.audioContext).not.toBeNull()
    })
  })

  describe("playIncorrect", () => {
    test("does not play if disabled", () => {
      soundManager.setEnabled(false)
      soundManager.playIncorrect()

      expect(soundManager.audioContext).toBeNull()
    })

    test("plays incorrect sound when enabled", () => {
      soundManager.playIncorrect()

      expect(soundManager.audioContext).not.toBeNull()
    })
  })

  describe("playCelebration", () => {
    test("does not play if disabled", () => {
      soundManager.setEnabled(false)
      soundManager.playCelebration()

      expect(soundManager.audioContext).toBeNull()
    })

    test("plays celebration sound when enabled", () => {
      soundManager.playCelebration()

      expect(soundManager.audioContext).not.toBeNull()
    })
  })

  describe("playTone", () => {
    test("does not play if audio context is null", () => {
      soundManager.audioContext = null
      // Should not throw
      expect(() => soundManager.playTone(440, 0, 0.5)).not.toThrow()
    })

    test("plays tone when audio context exists", () => {
      soundManager.init()
      // Should not throw
      expect(() => soundManager.playTone(440, 0, 0.5, 0.5)).not.toThrow()
    })

    test("handles errors gracefully", () => {
      soundManager.init()
      soundManager.audioContext.createOscillator = () => {
        throw new Error("Failed to create oscillator")
      }

      // Should not throw
      expect(() => soundManager.playTone(440, 0, 0.5)).not.toThrow()
    })
  })

  describe("dispose", () => {
    test("closes audio context", () => {
      soundManager.init()

      soundManager.dispose()

      expect(soundManager.audioContext).toBeNull()
    })

    test("handles null audio context", () => {
      soundManager.audioContext = null

      // Should not throw
      expect(() => soundManager.dispose()).not.toThrow()
    })

    test("handles close errors gracefully", () => {
      soundManager.init()
      soundManager.audioContext.close = () => {
        throw new Error("Cannot close")
      }

      // Should not throw
      expect(() => soundManager.dispose()).not.toThrow()
      expect(soundManager.audioContext).toBeNull()
    })
  })
})

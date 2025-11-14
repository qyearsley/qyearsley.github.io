/**
 * Tests for settings configuration and validation
 */
import { describe, test, expect } from '@jest/globals'
import {
  SETTINGS_CONFIG,
  getDefaultSettings,
  validateSetting,
  validateSettings,
  sanitizeSettings,
  getSettingConfig,
} from '../js/config/settingsConfig.js'

describe('Settings Configuration', () => {
  test('should have all required setting fields', () => {
    for (const [key, config] of Object.entries(SETTINGS_CONFIG)) {
      expect(config).toHaveProperty('default')
      expect(config).toHaveProperty('options')
      expect(config).toHaveProperty('label')
      expect(config).toHaveProperty('description')
      expect(config).toHaveProperty('validator')
      expect(typeof config.validator).toBe('function')
    }
  })

  test('getDefaultSettings should return all defaults', () => {
    const defaults = getDefaultSettings()
    expect(defaults).toEqual({
      inputMode: "multipleChoice",
      visualHints: "always",
      questionsPerLevel: 5,
    })
  })

  test('validateSetting should validate correct values', () => {
    expect(validateSetting('inputMode', 'multipleChoice')).toBe(true)
    expect(validateSetting('inputMode', 'keyboard')).toBe(true)
    expect(validateSetting('visualHints', 'always')).toBe(true)
    expect(validateSetting('questionsPerLevel', 5)).toBe(true)
    expect(validateSetting('questionsPerLevel', 10)).toBe(true)
  })

  test('validateSetting should reject invalid values', () => {
    expect(validateSetting('inputMode', 'invalid')).toBe(false)
    expect(validateSetting('visualHints', 'maybe')).toBe(false)
    expect(validateSetting('questionsPerLevel', 0)).toBe(false)
    expect(validateSetting('questionsPerLevel', 21)).toBe(false)
    expect(validateSetting('questionsPerLevel', 'five')).toBe(false)
  })

  test('validateSettings should validate full settings object', () => {
    const valid = validateSettings({
      inputMode: "keyboard",
      visualHints: "sometimes",
      questionsPerLevel: 8,
    })
    expect(valid.valid).toBe(true)
    expect(valid.errors).toEqual([])

    const invalid = validateSettings({
      inputMode: "invalid",
      visualHints: "always",
      unknownSetting: "value",
    })
    expect(invalid.valid).toBe(false)
    expect(invalid.errors.length).toBeGreaterThan(0)
  })

  test('sanitizeSettings should apply defaults for missing values', () => {
    const partial = { inputMode: "keyboard" }
    const sanitized = sanitizeSettings(partial)

    expect(sanitized.inputMode).toBe("keyboard")
    expect(sanitized.visualHints).toBe("always") // default
    expect(sanitized.questionsPerLevel).toBe(5) // default
  })

  test('sanitizeSettings should reject invalid values', () => {
    const invalid = {
      inputMode: "invalid",
      visualHints: "always",
    }
    const sanitized = sanitizeSettings(invalid)

    expect(sanitized.inputMode).toBe("multipleChoice") // default, not "invalid"
    expect(sanitized.visualHints).toBe("always")
  })

  test('getSettingConfig should return config for valid key', () => {
    const config = getSettingConfig('inputMode')
    expect(config).toBeDefined()
    expect(config.default).toBe("multipleChoice")
  })

  test('getSettingConfig should return null for invalid key', () => {
    const config = getSettingConfig('nonexistent')
    expect(config).toBeNull()
  })
})

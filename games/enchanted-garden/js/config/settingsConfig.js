/**
 * Settings configuration and validation
 * Provides defaults, options, and validation for all game settings
 */

export const SETTINGS_CONFIG = {
  inputMode: {
    default: "multipleChoice",
    options: ["multipleChoice", "keyboard"],
    label: "Answer Mode",
    description: "How to answer questions",
    validator: (value) => ["multipleChoice", "keyboard"].includes(value),
  },

  visualHints: {
    default: "always",
    options: ["always", "sometimes", "never"],
    label: "Visual Hints",
    description: "Control when pictures appear with questions",
    validator: (value) => ["always", "sometimes", "never"].includes(value),
  },

  questionsPerLevel: {
    default: 5,
    options: [3, 5, 6, 8, 10],
    label: "Questions Per Level",
    description: "How many questions to complete each level",
    validator: (value) =>  {
      const num = Number(value)
      return Number.isInteger(num) && num >= 1 && num <= 20
    },
  },
}

/**
 * Get default settings
 * @returns {Object} Default settings object
 */
export function getDefaultSettings() {
  const defaults = {}
  for (const [key, config] of Object.entries(SETTINGS_CONFIG)) {
    defaults[key] = config.default
  }
  return defaults
}

/**
 * Validate a setting value
 * @param {string} key - Setting key
 * @param {*} value - Value to validate
 * @returns {boolean} True if valid
 */
export function validateSetting(key, value) {
  const config = SETTINGS_CONFIG[key]
  if (!config) {
    console.warn(`Unknown setting: ${key}`)
    return false
  }
  return config.validator(value)
}

/**
 * Validate all settings
 * @param {Object} settings - Settings object to validate
 * @returns {{valid: boolean, errors: string[]}} Validation result
 */
export function validateSettings(settings) {
  const errors = []

  for (const [key, value] of Object.entries(settings)) {
    if (!SETTINGS_CONFIG[key]) {
      errors.push(`Unknown setting: ${key}`)
      continue
    }

    if (!validateSetting(key, value)) {
      errors.push(`Invalid value for ${key}: ${value}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Sanitize settings object - apply defaults for missing values
 * @param {Object} settings - Settings object (may be incomplete)
 * @returns {Object} Complete settings object with defaults
 */
export function sanitizeSettings(settings = {}) {
  const sanitized = getDefaultSettings()

  for (const [key, value] of Object.entries(settings)) {
    if (SETTINGS_CONFIG[key] && validateSetting(key, value)) {
      sanitized[key] = value
    } else if (SETTINGS_CONFIG[key]) {
      console.warn(`Invalid setting ${key}=${value}, using default`)
    }
  }

  return sanitized
}

/**
 * Get setting configuration
 * @param {string} key - Setting key
 * @returns {Object|null} Setting configuration or null
 */
export function getSettingConfig(key) {
  return SETTINGS_CONFIG[key] || null
}

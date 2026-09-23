// Pure helpers for reading shareable state out of the URL query string.
// Used by the tool pages in chinese/ to read their main input on load and
// keep the URL in sync as it changes (see chinese/README.md).
//
// Both functions fail silently: a missing or invalid value falls back to
// the caller's default rather than throwing or leaving the page blank.
"use strict"

/**
 * Resolves a query parameter to a non-empty string, falling back to
 * `fallback` when the raw value is missing or empty. There is nothing
 * further to validate for free-text params like `?text=`.
 *
 * @param {string | null} rawValue - Result of `URLSearchParams.get`.
 * @param {string} fallback - Used when rawValue is null or "".
 * @returns {string}
 */
export function resolveTextParam(rawValue, fallback) {
  return rawValue !== null && rawValue.length > 0 ? rawValue : fallback
}

/**
 * Resolves a query parameter to one of a fixed set of valid values,
 * falling back to `fallback` for anything else -- missing, empty, or a
 * value that isn't one of `validValues`.
 *
 * @param {string | null} rawValue - Result of `URLSearchParams.get`.
 * @param {readonly string[]} validValues - The allowed values.
 * @param {string} fallback - Used when rawValue isn't in validValues.
 * @returns {string}
 */
export function resolveEnumParam(rawValue, validValues, fallback) {
  return rawValue !== null && validValues.includes(rawValue) ? rawValue : fallback
}

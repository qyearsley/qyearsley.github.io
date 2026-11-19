// Checks for values read back from localStorage, which may be from an old
// version or hand-edited.

/** True for a non-null, non-array object. */
export function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

/** An untrusted counter as a non-negative integer, or 0. */
export function nonNegativeInt(value) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(/** @type {number} */ (value)))
}

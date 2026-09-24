/**
 * integer-explorer.js
 *
 * Two's complement arithmetic for fixed-width integers: parsing, formatting,
 * range checks, and the wraparound behavior of increment/decrement/negate.
 *
 * Everything here uses BigInt so 64-bit widths are exact.
 */

/** Widths the explorer supports. */
const WIDTHS = [8, 16, 32, 64]

/**
 * Parses a decimal, hex (`0x`/`0X`), or binary (`0b`/`0B`) integer literal,
 * with an optional leading `-`.
 *
 * @param {string} str - The text to parse, e.g. "-42", "0xFF", "0b1010".
 * @returns {bigint|null} The parsed value, or null if `str` isn't a
 *   recognized integer literal.
 */
function parseIntegerInput(str) {
  const trimmed = str.trim()
  if (!/^-?(0[xX][0-9a-fA-F]+|0[bB][01]+|[0-9]+)$/.test(trimmed)) return null
  const negative = trimmed.startsWith("-")
  const rest = negative ? trimmed.slice(1) : trimmed
  try {
    const magnitude = BigInt(rest)
    return negative ? -magnitude : magnitude
  } catch {
    return null
  }
}

/**
 * The representable range for a given width and signedness.
 *
 * @param {number} width - Bit width (8, 16, 32, or 64).
 * @param {boolean} signed - Whether the range is signed (two's complement)
 *   or unsigned.
 * @returns {{min: bigint, max: bigint}}
 */
function widthRange(width, signed) {
  const w = BigInt(width)
  if (signed) {
    const half = 2n ** (w - 1n)
    return { min: -half, max: half - 1n }
  }
  return { min: 0n, max: 2n ** w - 1n }
}

/**
 * Wraps an arbitrary integer into the unsigned bit pattern a fixed-width
 * two's complement register would hold, i.e. `value mod 2^width`, always
 * returned as a non-negative BigInt.
 *
 * @param {bigint} value
 * @param {number} width
 * @returns {bigint} A value in `[0, 2^width)`.
 */
function wrapToWidth(value, width) {
  const modulus = 2n ** BigInt(width)
  const remainder = value % modulus
  return remainder < 0n ? remainder + modulus : remainder
}

/**
 * Interprets a bit pattern (as returned by `wrapToWidth`) as a signed two's
 * complement value.
 *
 * @param {bigint} bits - A value in `[0, 2^width)`.
 * @param {number} width
 * @returns {bigint}
 */
function signedValue(bits, width) {
  const half = 2n ** BigInt(width - 1)
  return bits >= half ? bits - 2n ** BigInt(width) : bits
}

/**
 * Formats a bit pattern as a zero-padded binary string, most-significant
 * bit first.
 *
 * @param {bigint} bits
 * @param {number} width
 * @returns {string}
 */
function formatBinary(bits, width) {
  return bits.toString(2).padStart(width, "0")
}

/**
 * Formats a bit pattern as uppercase hex, zero-padded to the width.
 *
 * @param {bigint} bits
 * @param {number} width
 * @returns {string} Hex digits with no `0x` prefix.
 */
function formatHex(bits, width) {
  return bits
    .toString(16)
    .toUpperCase()
    .padStart(width / 4, "0")
}

/**
 * Builds the full display state for a bit pattern: its binary and hex
 * forms, its signed and unsigned readings, and the range for the current
 * mode.
 *
 * @param {bigint} bits
 * @param {number} width
 * @param {boolean} signed
 */
function describeState(bits, width, signed) {
  const range = widthRange(width, signed)
  return {
    bits,
    binary: formatBinary(bits, width),
    hex: formatHex(bits, width),
    unsignedValue: bits,
    signedValue: signedValue(bits, width),
    value: signed ? signedValue(bits, width) : bits,
    min: range.min,
    max: range.max,
  }
}

/**
 * Wraps an arbitrary logical value (e.g. freshly parsed user input) into a
 * bit pattern for the given width, and reports whether it fell outside the
 * range for the current signedness -- i.e. whether it overflowed.
 *
 * @param {bigint} value
 * @param {number} width
 * @param {boolean} signed
 * @returns {{bits: bigint, overflowed: boolean}}
 */
function evaluateValue(value, width, signed) {
  const { min, max } = widthRange(width, signed)
  return {
    bits: wrapToWidth(value, width),
    overflowed: value < min || value > max,
  }
}

/**
 * Adds 1 to a bit pattern, wrapping at the top of the range for the current
 * width. Reports overflow when the value was already at its max for the
 * current signedness.
 *
 * @param {bigint} bits
 * @param {number} width
 * @param {boolean} signed
 * @returns {{bits: bigint, overflowed: boolean}}
 */
function increment(bits, width, signed) {
  const { max } = widthRange(width, signed)
  const current = signed ? signedValue(bits, width) : bits
  return {
    bits: wrapToWidth(bits + 1n, width),
    overflowed: current + 1n > max,
  }
}

/**
 * Subtracts 1 from a bit pattern, wrapping at the bottom of the range for
 * the current width. Reports overflow when the value was already at its
 * min for the current signedness.
 *
 * @param {bigint} bits
 * @param {number} width
 * @param {boolean} signed
 * @returns {{bits: bigint, overflowed: boolean}}
 */
function decrement(bits, width, signed) {
  const { min } = widthRange(width, signed)
  const current = signed ? signedValue(bits, width) : bits
  return {
    bits: wrapToWidth(bits - 1n, width),
    overflowed: current - 1n < min,
  }
}

/**
 * Negates a bit pattern (two's complement: flip every bit, add 1), wrapping
 * as needed. Reports overflow -- this is how, in signed mode, negating the
 * minimum value overflows and produces the minimum value again.
 *
 * @param {bigint} bits
 * @param {number} width
 * @param {boolean} signed
 * @returns {{bits: bigint, overflowed: boolean}}
 */
function negateBits(bits, width, signed) {
  const { min, max } = widthRange(width, signed)
  const current = signed ? signedValue(bits, width) : bits
  const negated = -current
  return {
    bits: wrapToWidth(-bits, width),
    overflowed: negated < min || negated > max,
  }
}

/**
 * Flips one bit of a pattern.
 *
 * @param {bigint} bits
 * @param {number} width
 * @param {number} displayIndex - Position counting from the
 *   most-significant bit (0 = MSB), matching how bits are drawn left to
 *   right on screen.
 * @returns {bigint} The pattern with that bit flipped.
 */
function toggleBit(bits, width, displayIndex) {
  const bitPosition = BigInt(width - 1 - displayIndex)
  return bits ^ (1n << bitPosition)
}

export {
  WIDTHS,
  parseIntegerInput,
  widthRange,
  wrapToWidth,
  signedValue,
  formatBinary,
  formatHex,
  describeState,
  evaluateValue,
  increment,
  decrement,
  negateBits,
  toggleBit,
}

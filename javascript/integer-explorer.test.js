import * as ie from "./integer-explorer.js"

describe("parseIntegerInput", () => {
  test("decimal", () => {
    expect(ie.parseIntegerInput("42")).toEqual(42n)
    expect(ie.parseIntegerInput("-42")).toEqual(-42n)
    expect(ie.parseIntegerInput("0")).toEqual(0n)
  })

  test("hex", () => {
    expect(ie.parseIntegerInput("0xFF")).toEqual(255n)
    expect(ie.parseIntegerInput("0Xff")).toEqual(255n)
    expect(ie.parseIntegerInput("-0x10")).toEqual(-16n)
  })

  test("binary", () => {
    expect(ie.parseIntegerInput("0b1010")).toEqual(10n)
    expect(ie.parseIntegerInput("0B1010")).toEqual(10n)
    expect(ie.parseIntegerInput("-0b1")).toEqual(-1n)
  })

  test("whitespace is trimmed", () => {
    expect(ie.parseIntegerInput("  7  ")).toEqual(7n)
  })

  test("rejects invalid input", () => {
    expect(ie.parseIntegerInput("")).toBeNull()
    expect(ie.parseIntegerInput("abc")).toBeNull()
    expect(ie.parseIntegerInput("1.5")).toBeNull()
    expect(ie.parseIntegerInput("0x")).toBeNull()
    expect(ie.parseIntegerInput("0b2")).toBeNull()
    expect(ie.parseIntegerInput("--1")).toBeNull()
    expect(ie.parseIntegerInput("1e10")).toBeNull()
  })
})

describe("widthRange", () => {
  test("unsigned 8-bit", () => {
    expect(ie.widthRange(8, false)).toEqual({ min: 0n, max: 255n })
  })

  test("signed 8-bit", () => {
    expect(ie.widthRange(8, true)).toEqual({ min: -128n, max: 127n })
  })

  test("unsigned 64-bit", () => {
    expect(ie.widthRange(64, false)).toEqual({ min: 0n, max: 2n ** 64n - 1n })
  })

  test("signed 64-bit", () => {
    expect(ie.widthRange(64, true)).toEqual({
      min: -(2n ** 63n),
      max: 2n ** 63n - 1n,
    })
  })
})

describe("wrapToWidth", () => {
  test("in-range values pass through", () => {
    expect(ie.wrapToWidth(5n, 8)).toEqual(5n)
    expect(ie.wrapToWidth(0n, 8)).toEqual(0n)
    expect(ie.wrapToWidth(255n, 8)).toEqual(255n)
  })

  test("wraps values above the range", () => {
    expect(ie.wrapToWidth(256n, 8)).toEqual(0n)
    expect(ie.wrapToWidth(300n, 8)).toEqual(44n)
  })

  test("wraps negative values", () => {
    expect(ie.wrapToWidth(-1n, 8)).toEqual(255n)
    expect(ie.wrapToWidth(-128n, 8)).toEqual(128n)
    expect(ie.wrapToWidth(-256n, 8)).toEqual(0n)
  })
})

describe("signedValue", () => {
  test("values below the halfway point are unchanged", () => {
    expect(ie.signedValue(0n, 8)).toEqual(0n)
    expect(ie.signedValue(127n, 8)).toEqual(127n)
  })

  test("values at or above the halfway point become negative", () => {
    expect(ie.signedValue(128n, 8)).toEqual(-128n)
    expect(ie.signedValue(255n, 8)).toEqual(-1n)
  })
})

describe("formatBinary", () => {
  test("pads to the requested width", () => {
    expect(ie.formatBinary(5n, 8)).toEqual("00000101")
    expect(ie.formatBinary(255n, 8)).toEqual("11111111")
  })
})

describe("formatHex", () => {
  test("pads and uppercases", () => {
    expect(ie.formatHex(255n, 8)).toEqual("FF")
    expect(ie.formatHex(10n, 8)).toEqual("0A")
    expect(ie.formatHex(0n, 16)).toEqual("0000")
  })
})

describe("describeState", () => {
  test("unsigned 8-bit", () => {
    expect(ie.describeState(255n, 8, false)).toEqual({
      bits: 255n,
      binary: "11111111",
      hex: "FF",
      unsignedValue: 255n,
      signedValue: -1n,
      value: 255n,
      min: 0n,
      max: 255n,
    })
  })

  test("signed 8-bit reads the same bits as -1", () => {
    const state = ie.describeState(255n, 8, true)
    expect(state.value).toEqual(-1n)
    expect(state.min).toEqual(-128n)
    expect(state.max).toEqual(127n)
  })
})

describe("evaluateValue", () => {
  test("in-range value does not overflow", () => {
    expect(ie.evaluateValue(10n, 8, false)).toEqual({ bits: 10n, overflowed: false })
  })

  test("value above unsigned range overflows and wraps", () => {
    expect(ie.evaluateValue(300n, 8, false)).toEqual({ bits: 44n, overflowed: true })
  })

  test("negative value in unsigned mode overflows", () => {
    expect(ie.evaluateValue(-1n, 8, false)).toEqual({ bits: 255n, overflowed: true })
  })

  test("negative value in signed mode does not overflow", () => {
    expect(ie.evaluateValue(-1n, 8, true)).toEqual({ bits: 255n, overflowed: false })
  })

  test("value above signed range overflows", () => {
    expect(ie.evaluateValue(200n, 8, true)).toEqual({ bits: 200n, overflowed: true })
  })
})

describe("increment", () => {
  test("normal increment", () => {
    expect(ie.increment(5n, 8, false)).toEqual({ bits: 6n, overflowed: false })
  })

  test("unsigned max wraps to zero", () => {
    expect(ie.increment(255n, 8, false)).toEqual({ bits: 0n, overflowed: true })
  })

  test("signed max wraps to signed min", () => {
    // 127 (0x7F) is the signed 8-bit max; incrementing wraps the bit
    // pattern to 128 (0x80), which reads as -128.
    const result = ie.increment(127n, 8, true)
    expect(result.bits).toEqual(128n)
    expect(result.overflowed).toEqual(true)
  })
})

describe("decrement", () => {
  test("normal decrement", () => {
    expect(ie.decrement(5n, 8, false)).toEqual({ bits: 4n, overflowed: false })
  })

  test("unsigned zero wraps to max", () => {
    expect(ie.decrement(0n, 8, false)).toEqual({ bits: 255n, overflowed: true })
  })

  test("signed min wraps to signed max", () => {
    const result = ie.decrement(128n, 8, true)
    expect(result.bits).toEqual(127n)
    expect(result.overflowed).toEqual(true)
  })
})

describe("negateBits", () => {
  test("negates a positive value", () => {
    expect(ie.negateBits(5n, 8, true)).toEqual({ bits: 251n, overflowed: false })
  })

  test("negating signed min overflows and returns itself", () => {
    // -128 has no positive counterpart in 8-bit two's complement.
    const result = ie.negateBits(128n, 8, true)
    expect(result.bits).toEqual(128n)
    expect(result.overflowed).toEqual(true)
  })

  test("negating a nonzero value in unsigned mode overflows", () => {
    const result = ie.negateBits(5n, 8, false)
    expect(result.bits).toEqual(251n)
    expect(result.overflowed).toEqual(true)
  })

  test("negating zero never overflows", () => {
    expect(ie.negateBits(0n, 8, true)).toEqual({ bits: 0n, overflowed: false })
    expect(ie.negateBits(0n, 8, false)).toEqual({ bits: 0n, overflowed: false })
  })
})

describe("toggleBit", () => {
  test("toggles the most significant bit (display index 0)", () => {
    expect(ie.toggleBit(0n, 8, 0)).toEqual(128n)
    expect(ie.toggleBit(128n, 8, 0)).toEqual(0n)
  })

  test("toggles the least significant bit (last display index)", () => {
    expect(ie.toggleBit(0n, 8, 7)).toEqual(1n)
    expect(ie.toggleBit(1n, 8, 7)).toEqual(0n)
  })

  test("toggling twice is a no-op", () => {
    const once = ie.toggleBit(42n, 8, 3)
    expect(ie.toggleBit(once, 8, 3)).toEqual(42n)
  })
})

describe("WIDTHS", () => {
  test("supports 8, 16, 32, and 64 bits", () => {
    expect(ie.WIDTHS).toEqual([8, 16, 32, 64])
  })
})

/**
 * Tests for url-state.js -- shareable-URL query param helpers.
 */

import { resolveTextParam, resolveEnumParam } from "./url-state.js"

describe("resolveTextParam", () => {
  test("returns the raw value when present and non-empty", () => {
    expect(resolveTextParam("汉字", "中")).toBe("汉字")
  })

  test("falls back when the value is missing", () => {
    expect(resolveTextParam(null, "中")).toBe("中")
  })

  test("falls back when the value is an empty string", () => {
    expect(resolveTextParam("", "中")).toBe("中")
  })
})

describe("resolveEnumParam", () => {
  const directions = ["trad-to-simp", "simp-to-trad"]

  test("returns the raw value when it is one of the valid values", () => {
    expect(resolveEnumParam("simp-to-trad", directions, "trad-to-simp")).toBe("simp-to-trad")
  })

  test("falls back when the value is missing", () => {
    expect(resolveEnumParam(null, directions, "trad-to-simp")).toBe("trad-to-simp")
  })

  test("falls back when the value is not a valid option", () => {
    expect(resolveEnumParam("sideways", directions, "trad-to-simp")).toBe("trad-to-simp")
  })

  test("falls back when the value is an empty string", () => {
    expect(resolveEnumParam("", directions, "trad-to-simp")).toBe("trad-to-simp")
  })
})

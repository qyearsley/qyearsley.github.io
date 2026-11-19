/**
 * Tests for url-state.js -- shareable-URL query param helpers.
 */

import { jest } from "@jest/globals"
import { resolveTextParam, resolveEnumParam, syncTableFilterParam } from "./url-state.js"

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

describe("syncTableFilterParam", () => {
  beforeEach(() => {
    document.body.innerHTML = '<input id="table-filter">'
    window.history.replaceState(null, "", "/t.html?x=1&q=ma#top")
  })

  test("fills the box from ?q= and fires an input event", () => {
    const input = document.getElementById("table-filter")
    const onInput = jest.fn()
    input.addEventListener("input", onInput)
    syncTableFilterParam()
    expect(input.value).toBe("ma")
    expect(onInput).toHaveBeenCalledTimes(1)
  })

  test("typing updates q and keeps other params and the hash", () => {
    const input = document.getElementById("table-filter")
    syncTableFilterParam()
    input.value = "ba"
    input.dispatchEvent(new Event("input"))
    expect(window.location.search).toBe("?x=1&q=ba")
    expect(window.location.hash).toBe("#top")
  })

  test("clearing the box removes q", () => {
    const input = document.getElementById("table-filter")
    syncTableFilterParam()
    input.value = ""
    input.dispatchEvent(new Event("input"))
    expect(window.location.search).toBe("?x=1")
  })

  test("does nothing when the page has no filter box", () => {
    document.body.innerHTML = ""
    expect(() => syncTableFilterParam()).not.toThrow()
  })
})

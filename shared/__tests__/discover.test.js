import { jest } from "@jest/globals"

import "../../shared/discover.js"

function pages() {
  return [
    {
      path: "/chinese/tone-table.html",
      title: "Pinyin Tone Tables",
      zhTitle: "拼音声调表",
      zh: true,
    },
    { path: "/games/seasons/", title: "Seasons", zhTitle: null, zh: false },
    { path: "/javascript/coin-flipper.html", title: "Coin Flipper", zhTitle: "抛硬币", zh: true },
  ]
}

function jsonResponse(ok, payload) {
  return { ok: ok, json: () => Promise.resolve(payload) }
}

describe("window.__discover", () => {
  test("is exposed with the pure picking functions", () => {
    expect(typeof window.__discover.randomPick).toBe("function")
    expect(typeof window.__discover.pageLink).toBe("function")
    expect(typeof window.__discover.lifeStep).toBe("function")
  })
})

describe("randomPick", () => {
  const { randomPick } = window.__discover

  test("returns null for an empty list", () => {
    expect(randomPick([], "/x")).toBeNull()
  })

  test("never returns the excluded path when another page exists", () => {
    const list = pages()
    for (let i = 0; i < 20; i++) {
      const pick = randomPick(list, "/games/seasons/")
      expect(pick.path).not.toBe("/games/seasons/")
    }
  })

  test("falls back to the full list when the excluded path is the only page", () => {
    const list = [{ path: "/only.html", title: "Only", zhTitle: null, zh: false }]
    expect(randomPick(list, "/only.html")).toEqual(list[0])
  })
})

describe("pageLink", () => {
  const { pageLink } = window.__discover

  test("uses the English path and title off /zh/", () => {
    const page = pages()[0]
    expect(pageLink(page, false)).toEqual({ href: page.path, title: page.title })
  })

  test("uses the zh path and title on /zh/ when a zh version exists", () => {
    const page = pages()[0] // has zh: true
    expect(pageLink(page, true)).toEqual({ href: "/zh" + page.path, title: page.zhTitle })
  })

  test("falls back to the English path and title on /zh/ when no zh version exists", () => {
    const page = pages()[1] // zh: false
    expect(pageLink(page, true)).toEqual({ href: page.path, title: page.title })
  })
})

describe("lifeStep", () => {
  const { lifeStep } = window.__discover

  test("a block (2x2 square) is a still life", () => {
    const block = new Set(["1,1", "2,1", "1,2", "2,2"])
    expect(lifeStep(block, 5)).toEqual(block)
  })

  test("a blinker oscillates between horizontal and vertical", () => {
    const horizontal = new Set(["1,2", "2,2", "3,2"])
    const vertical = new Set(["2,1", "2,2", "2,3"])
    expect(lifeStep(horizontal, 5)).toEqual(vertical)
    expect(lifeStep(vertical, 5)).toEqual(horizontal)
  })

  test("a glider keeps 5 live cells after stepping (toroidal wraparound)", () => {
    const glider = new Set(["2,1", "3,2", "1,3", "2,3", "3,3"])
    const next = lifeStep(glider, 5)
    expect(next.size).toBe(5)
    expect(next).toEqual(new Set(["1,2", "2,3", "2,4", "3,2", "3,3"]))
  })
})

describe("random-page link", () => {
  afterEach(() => {
    delete global.fetch
  })

  test("stays hidden when the fetch fails (e.g. npm run dev, no build)", async () => {
    document.body.innerHTML = `<a id="discover-random" href="#" hidden>Random page</a>`
    global.fetch = jest.fn(() => Promise.reject(new Error("no dist/pages.json")))

    document.dispatchEvent(new Event("DOMContentLoaded"))
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(document.getElementById("discover-random").hidden).toBe(true)
  })

  test("unhides with a resolved href on a successful fetch", async () => {
    document.body.innerHTML = `<a id="discover-random" href="#" hidden>Random page</a>`
    global.fetch = jest.fn(() => Promise.resolve(jsonResponse(true, pages())))

    document.dispatchEvent(new Event("DOMContentLoaded"))
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 0))

    const link = document.getElementById("discover-random")
    expect(link.hidden).toBe(false)
    expect(link.getAttribute("href")).not.toBe("#")
  })
})

describe("glider avatar", () => {
  function setupAvatarDOM() {
    document.body.innerHTML = `
      <button type="button" class="profile-image-button">
        <svg class="profile-image" viewBox="0 0 100 100">
          <g class="qy-life" fill="var(--color-primary)" opacity="0.22">
            <rect x="40" y="20" width="20" height="20" />
            <rect x="60" y="40" width="20" height="20" />
            <rect x="20" y="60" width="20" height="20" />
            <rect x="40" y="60" width="20" height="20" />
            <rect x="60" y="60" width="20" height="20" />
          </g>
        </svg>
      </button>
    `
  }

  function cellsOf(group) {
    return Array.from(group.querySelectorAll("rect"))
      .map(
        (r) =>
          `${parseInt(r.getAttribute("x"), 10) / 20},${parseInt(r.getAttribute("y"), 10) / 20}`,
      )
      .sort()
  }

  test("does not change the pattern before any click (no autoplay)", () => {
    setupAvatarDOM()
    document.dispatchEvent(new Event("DOMContentLoaded"))
    const group = document.querySelector(".qy-life")
    const before = cellsOf(group)
    expect(before).toEqual(["1,3", "2,1", "2,3", "3,2", "3,3"])
  })

  test("clicking advances exactly one generation", () => {
    setupAvatarDOM()
    document.dispatchEvent(new Event("DOMContentLoaded"))
    const button = document.querySelector(".profile-image-button")
    const group = document.querySelector(".qy-life")

    button.click()

    expect(cellsOf(group)).toEqual(["1,2", "2,3", "2,4", "3,2", "3,3"])
  })

  test("still 5 live cells after several generations (toroidal, does not die out)", () => {
    setupAvatarDOM()
    document.dispatchEvent(new Event("DOMContentLoaded"))
    const button = document.querySelector(".profile-image-button")
    const group = document.querySelector(".qy-life")

    for (let i = 0; i < 6; i++) button.click()

    expect(group.querySelectorAll("rect").length).toBe(5)
  })
})

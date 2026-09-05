/**
 * The conventions every game's index.html is held to.
 *
 * Five games grew independently and drifted, and the drift was invisible
 * because each game's own suite only ever reads its own markup. This file reads
 * all five and asserts the things that are supposed to be the same. It is the
 * cheapest place to catch the sixth game getting one of them wrong.
 *
 * What is *not* here is as deliberate as what is. The two page shells differ on
 * purpose -- Seasons, Life Garden and Turing Tape use `.game-layout` with one
 * top bar, Times Trail and Number Garden use `#game-container` with a header
 * per screen -- and nothing below assumes either. Neither is a settings dialog
 * required: Life Garden and Turing Tape have no settings to offer. The rule is
 * conditional, and that is the useful shape: *if* a game has a dialog, it has
 * the whole of one.
 *
 * The markup is parsed with jsdom's own parser rather than a regex, so an
 * attribute written in a different order still matches.
 */

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "@jest/globals"

const GAMES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..")

/** Every game directory, which is also every row of the tables below. */
const GAMES = ["life-garden", "number-garden", "seasons", "times-trail", "turing-tape"]

/**
 * A game's index.html, parsed into a detached document.
 * @param {string} game - The game directory name
 * @returns {Document} The parsed page
 */
function page(game) {
  const html = readFileSync(join(GAMES_DIR, game, "index.html"), "utf-8")
  return new DOMParser().parseFromString(html, "text/html")
}

/** Every game's page, parsed once. */
const PAGES = Object.fromEntries(GAMES.map((game) => [game, page(game)]))

/** The games that offer a settings dialog. Derived, not listed. */
const WITH_SETTINGS = GAMES.filter((game) => PAGES[game].getElementById("settings-modal"))

describe("every game", () => {
  it.each(GAMES)("%s links the site stylesheet, so the theme toggle reaches it", (game) => {
    const hrefs = [...PAGES[game].querySelectorAll('link[rel="stylesheet"]')].map((link) =>
      link.getAttribute("href"),
    )
    expect(hrefs).toContain("/css/style.css")
  })

  // theme.js has to run before first paint or the page flashes light before the
  // saved dark theme lands, which is why it is a plain blocking script in the
  // head rather than a module.
  it.each(GAMES)("%s loads the shared theme script in the head", (game) => {
    const script = PAGES[game].querySelector('head script[src="/shared/theme.js"]')
    expect(script).not.toBeNull()
    expect(script.hasAttribute("defer")).toBe(false)
    expect(script.getAttribute("type")).not.toBe("module")
  })

  it.each(GAMES)("%s loads the shared nav script, which owns the ? overlay", (game) => {
    expect(PAGES[game].querySelector('script[src="/shared/nav.js"]')).not.toBeNull()
  })

  it.each(GAMES)("%s declares a theme colour for the browser chrome", (game) => {
    expect(PAGES[game].querySelector('meta[name="theme-color"]')).not.toBeNull()
  })

  // The games index and the site's own search results both read this.
  it.each(GAMES)("%s has a non-empty description", (game) => {
    const meta = PAGES[game].querySelector('meta[name="description"]')
    expect(meta).not.toBeNull()
    expect(meta.getAttribute("content").trim().length).toBeGreaterThan(20)
  })

  it.each(GAMES)("%s has a skip link pointing at a target that exists", (game) => {
    const skip = PAGES[game].querySelector(".skip-link, a[href^='#main']")
    if (!skip) return
    const target = skip.getAttribute("href").slice(1)
    expect(PAGES[game].getElementById(target)).not.toBeNull()
  })

  it.each(GAMES)("%s registers at least one keyboard shortcut", (game) => {
    const inline = [...PAGES[game].querySelectorAll("script:not([src])")]
      .map((script) => script.textContent)
      .join("")
    expect(inline).toContain("__registerShortcut")
  })
})

// Three of the five have one. The point of the block is that a fourth cannot
// arrive with half of it -- Number Garden shipped without an Escape handler for
// a long time, and the only thing that would have caught it is a rule written
// once, here, rather than five times in five suites.
describe("a game that has a settings dialog", () => {
  it("is the set we expect, so a new one has to opt in deliberately", () => {
    expect(WITH_SETTINGS).toEqual(["number-garden", "seasons", "times-trail"])
  })

  it.each(WITH_SETTINGS)("%s starts with the dialog hidden", (game) => {
    const modal = PAGES[game].getElementById("settings-modal")
    expect(modal.classList.contains("modal")).toBe(true)
    // `hidden` and not `show`: `BaseGameUI.showSettings` toggles this class, and
    // no stylesheet defines `.modal.show`.
    expect(modal.classList.contains("hidden")).toBe(true)
  })

  it.each(WITH_SETTINGS)("%s marks the dialog up as one", (game) => {
    const modal = PAGES[game].getElementById("settings-modal")
    expect(modal.getAttribute("role")).toBe("dialog")
    expect(modal.getAttribute("aria-modal")).toBe("true")
  })

  // `aria-labelledby` over `aria-label`, so the accessible name and the visible
  // heading cannot drift apart.
  it.each(WITH_SETTINGS)("%s names the dialog from its own heading", (game) => {
    const modal = PAGES[game].getElementById("settings-modal")
    const id = modal.getAttribute("aria-labelledby")
    expect(id).toBeTruthy()
    const heading = PAGES[game].getElementById(id)
    expect(heading).not.toBeNull()
    expect(heading.textContent.trim().length).toBeGreaterThan(0)
  })

  it.each(WITH_SETTINGS)("%s has a button to open it and one to close it", (game) => {
    expect(PAGES[game].getElementById("settings-button")).not.toBeNull()
    expect(PAGES[game].getElementById("close-settings")).not.toBeNull()
  })

  it.each(WITH_SETTINGS)("%s puts the close button inside the dialog", (game) => {
    const modal = PAGES[game].getElementById("settings-modal")
    expect(modal.contains(PAGES[game].getElementById("close-settings"))).toBe(true)
  })

  // Escape is the shortcut a keyboard user reaches for first, and a dialog
  // without it is a trap escapable only by tabbing to Done.
  it.each(WITH_SETTINGS)("%s advertises Escape as the way out", (game) => {
    const inline = [...PAGES[game].querySelectorAll("script:not([src])")]
      .map((script) => script.textContent)
      .join("")
    expect(inline).toContain('__registerShortcut("Escape"')
  })
})

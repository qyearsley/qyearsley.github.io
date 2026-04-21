import { jest } from "@jest/globals"

// Set up DOM before importing (IIFE runs immediately)
document.body.innerHTML = `
  <div class="breadcrumbs">
    <a href="/">Home</a> / <a href="/section/">Section</a>
  </div>
  <div class="internal-links">
    <a href="/page1">Page 1</a>
    <a href="/page2">Page 2</a>
    <a href="/page3">Page 3</a>
  </div>
`

import "../../shared/nav.js"

function pressKey(key, options = {}) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  })
  document.body.dispatchEvent(event)
  return event
}

describe("nav.js", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="breadcrumbs">
        <a href="/">Home</a> / <a href="/section/">Section</a>
      </div>
      <div class="internal-links">
        <a href="/page1">Page 1</a>
        <a href="/page2">Page 2</a>
        <a href="/page3">Page 3</a>
      </div>
    `
    if (window.__helpOverlayIsOpen && window.__helpOverlayIsOpen()) {
      pressKey("Escape")
    }
  })

  describe("__registerShortcut", () => {
    it("is exposed on window", () => {
      expect(typeof window.__registerShortcut).toBe("function")
    })

    it("registers a new shortcut with handler", () => {
      const handler = jest.fn()
      window.__registerShortcut("x", "Test shortcut", handler)
      pressKey("x")
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it("updates handler for existing key", () => {
      const handler1 = jest.fn()
      const handler2 = jest.fn()
      window.__registerShortcut("z", "Test 1", handler1)
      window.__registerShortcut("z", "Test 2", handler2)
      pressKey("z")
      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).toHaveBeenCalledTimes(1)
    })
  })

  describe("__helpOverlayIsOpen", () => {
    it("is exposed on window", () => {
      expect(typeof window.__helpOverlayIsOpen).toBe("function")
    })

    it("returns false initially", () => {
      expect(window.__helpOverlayIsOpen()).toBe(false)
    })
  })

  describe("help overlay", () => {
    it("opens on ? key", () => {
      pressKey("?")
      expect(window.__helpOverlayIsOpen()).toBe(true)
      expect(document.querySelector(".keyboard-help-backdrop")).not.toBeNull()
    })

    it("closes on ? key when already open", () => {
      pressKey("?")
      pressKey("?")
      expect(window.__helpOverlayIsOpen()).toBe(false)
      expect(document.querySelector(".keyboard-help-backdrop")).toBeNull()
    })

    it("closes on Escape key", () => {
      pressKey("?")
      pressKey("Escape")
      expect(window.__helpOverlayIsOpen()).toBe(false)
    })

    it("has dialog role and aria-modal", () => {
      pressKey("?")
      const backdrop = document.querySelector(".keyboard-help-backdrop")
      expect(backdrop.getAttribute("role")).toBe("dialog")
      expect(backdrop.getAttribute("aria-modal")).toBe("true")
    })

    it("closes on backdrop click", () => {
      pressKey("?")
      const backdrop = document.querySelector(".keyboard-help-backdrop")
      backdrop.click()
      expect(window.__helpOverlayIsOpen()).toBe(false)
    })

    it("does not close on panel click", () => {
      pressKey("?")
      const panel = document.querySelector(".keyboard-help-panel")
      panel.click()
      expect(window.__helpOverlayIsOpen()).toBe(true)
    })

    it("injects styles only once", () => {
      pressKey("?")
      pressKey("?") // close
      pressKey("?") // reopen
      expect(document.querySelectorAll("#nav-help-styles").length).toBe(1)
    })

    it("shows shortcut descriptions", () => {
      pressKey("?")
      const items = document.querySelectorAll(".shortcut-list dd")
      expect(items.length).toBeGreaterThan(0)
    })

    it("hides conditional shortcuts when context is missing", () => {
      pressKey("?")
      const descriptions = Array.from(
        document.querySelectorAll(".shortcut-list dd"),
      ).map((dd) => dd.textContent)
      // "Next page" should be hidden (no .prevnext-link.next in DOM)
      expect(descriptions).not.toContain("Next page")
      expect(descriptions).not.toContain("Previous page")
    })
  })

  describe("link navigation", () => {
    it("j focuses first link when nothing focused", () => {
      pressKey("j")
      const links = document.querySelectorAll(".internal-links a")
      expect(document.activeElement).toBe(links[0])
    })

    it("j moves focus to next link", () => {
      const links = document.querySelectorAll(".internal-links a")
      links[0].focus()
      pressKey("j")
      expect(document.activeElement).toBe(links[1])
    })

    it("k moves focus to previous link", () => {
      const links = document.querySelectorAll(".internal-links a")
      links[1].focus()
      pressKey("k")
      expect(document.activeElement).toBe(links[0])
    })

    it("j does not go past last link", () => {
      const links = document.querySelectorAll(".internal-links a")
      links[links.length - 1].focus()
      pressKey("j")
      expect(document.activeElement).toBe(links[links.length - 1])
    })

    it("k does not go before first link", () => {
      const links = document.querySelectorAll(".internal-links a")
      links[0].focus()
      pressKey("k")
      expect(document.activeElement).toBe(links[0])
    })

    it("also finds .game-list links", () => {
      document.body.innerHTML = `
        <div class="game-list">
          <a href="/g1">Game 1</a>
          <a href="/g2">Game 2</a>
        </div>
      `
      pressKey("j")
      const links = document.querySelectorAll(".game-list a")
      expect(document.activeElement).toBe(links[0])
    })
  })

  describe("input element filtering", () => {
    it("ignores keydown from input elements", () => {
      const input = document.createElement("input")
      document.body.appendChild(input)
      input.focus()

      const handler = jest.fn()
      window.__registerShortcut("q", "Test", handler)

      const event = new KeyboardEvent("keydown", { key: "q", bubbles: true })
      input.dispatchEvent(event)
      expect(handler).not.toHaveBeenCalled()
    })

    it("ignores keydown from textarea elements", () => {
      const textarea = document.createElement("textarea")
      document.body.appendChild(textarea)
      textarea.focus()

      const handler = jest.fn()
      window.__registerShortcut("w", "Test", handler)

      const event = new KeyboardEvent("keydown", { key: "w", bubbles: true })
      textarea.dispatchEvent(event)
      expect(handler).not.toHaveBeenCalled()
    })

    it("ignores keydown from select elements", () => {
      const select = document.createElement("select")
      document.body.appendChild(select)
      select.focus()

      const event = new KeyboardEvent("keydown", { key: "j", bubbles: true })
      select.dispatchEvent(event)
      // j would focus a link if not filtered; verify no link is focused
      expect(document.activeElement).toBe(select)
    })
  })

  describe("modifier keys", () => {
    it("ignores events with ctrlKey", () => {
      const event = pressKey("j", { ctrlKey: true })
      expect(event.defaultPrevented).toBe(false)
    })

    it("ignores events with altKey", () => {
      const event = pressKey("j", { altKey: true })
      expect(event.defaultPrevented).toBe(false)
    })

    it("ignores events with metaKey", () => {
      const event = pressKey("j", { metaKey: true })
      expect(event.defaultPrevented).toBe(false)
    })
  })

  describe("key suppression when help is open", () => {
    it("ignores navigation keys when help overlay is open", () => {
      pressKey("?")
      expect(window.__helpOverlayIsOpen()).toBe(true)

      const links = document.querySelectorAll(".internal-links a")
      pressKey("j")
      // j should not focus links when help is open
      expect(document.activeElement).not.toBe(links[0])
    })

    it("ignores custom handlers when help overlay is open", () => {
      const handler = jest.fn()
      window.__registerShortcut("m", "Test", handler)

      pressKey("?")
      pressKey("m")
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe("page navigation keys", () => {
    it("n links to next page when prevnext-link exists", () => {
      document.body.innerHTML += '<a class="prevnext-link next" href="/next">Next</a>'
      const event = pressKey("n")
      expect(event.defaultPrevented).toBe(true)
    })

    it("n does nothing without prevnext-link", () => {
      const event = pressKey("n")
      expect(event.defaultPrevented).toBe(false)
    })

    it("p links to previous page when prevnext-link exists", () => {
      document.body.innerHTML += '<a class="prevnext-link prev" href="/prev">Prev</a>'
      const event = pressKey("p")
      expect(event.defaultPrevented).toBe(true)
    })

    it("u navigates to parent breadcrumb", () => {
      const event = pressKey("u")
      expect(event.defaultPrevented).toBe(true)
    })
  })

  describe("theme key", () => {
    it("calls __themeToggle when available", () => {
      window.__themeToggle = jest.fn()
      pressKey("t")
      expect(window.__themeToggle).toHaveBeenCalled()
      delete window.__themeToggle
    })

    it("does nothing when __themeToggle is not set", () => {
      const saved = window.__themeToggle
      delete window.__themeToggle
      const event = pressKey("t")
      expect(event.defaultPrevented).toBe(false)
      if (saved) window.__themeToggle = saved
    })
  })
})

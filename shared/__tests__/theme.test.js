import { jest } from "@jest/globals"

localStorage.clear()

import "../../shared/theme.js"

document.dispatchEvent(new Event("DOMContentLoaded"))

describe("theme.js", () => {
  afterEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
    delete document.documentElement.dataset.accent
    // Close popover if open
    if (window.__themePopoverClose) window.__themePopoverClose()
  })

  describe("UI creation", () => {
    it("creates theme toggle button", () => {
      const btn = document.querySelector(".theme-toggle")
      expect(btn).not.toBeNull()
      expect(btn.getAttribute("aria-label")).toBe("Theme settings")
    })

    it("creates theme popover with dialog role", () => {
      const popover = document.querySelector(".theme-popover")
      expect(popover).not.toBeNull()
      expect(popover.getAttribute("role")).toBe("dialog")
    })

    it("creates theme option buttons", () => {
      const buttons = document.querySelectorAll("[data-set-theme]")
      expect(buttons.length).toBe(3) // light, dark, system
    })

    it("creates accent swatch buttons", () => {
      const swatches = document.querySelectorAll("[data-set-accent]")
      expect(swatches.length).toBe(4) // blue, green, amber, purple
    })

    it("injects theme styles", () => {
      const styles = document.querySelectorAll("style")
      const themeStyle = Array.from(styles).find((s) => s.textContent.includes(".theme-toggle"))
      expect(themeStyle).not.toBeUndefined()
    })
  })

  describe("theme cycling", () => {
    it("exposes __themeToggle on window", () => {
      expect(typeof window.__themeToggle).toBe("function")
    })

    it("cycles system -> light -> dark -> system", () => {
      // Default is system
      expect(localStorage.getItem("theme")).toBeNull()

      window.__themeToggle() // -> light
      expect(document.documentElement.dataset.theme).toBe("light")
      expect(localStorage.getItem("theme")).toBe("light")

      window.__themeToggle() // -> dark
      expect(document.documentElement.dataset.theme).toBe("dark")
      expect(localStorage.getItem("theme")).toBe("dark")

      window.__themeToggle() // -> system
      expect(document.documentElement.dataset.theme).toBeUndefined()
      expect(localStorage.getItem("theme")).toBeNull()
    })
  })

  describe("popover", () => {
    it("opens when toggle button is clicked", () => {
      document.querySelector(".theme-toggle").click()
      expect(document.querySelector(".theme-popover.open")).not.toBeNull()
    })

    it("sets aria-expanded when opened", () => {
      const btn = document.querySelector(".theme-toggle")
      btn.click()
      expect(btn.getAttribute("aria-expanded")).toBe("true")
    })

    it("closes when toggle button is clicked again", () => {
      const btn = document.querySelector(".theme-toggle")
      btn.click()
      btn.click()
      expect(document.querySelector(".theme-popover.open")).toBeNull()
      expect(btn.getAttribute("aria-expanded")).toBe("false")
    })

    it("closes on Escape key", () => {
      document.querySelector(".theme-toggle").click()
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
      expect(document.querySelector(".theme-popover.open")).toBeNull()
    })

    it("closes on outside click", () => {
      document.querySelector(".theme-toggle").click()
      document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      expect(document.querySelector(".theme-popover.open")).toBeNull()
    })

    it("stays open when clicking inside popover", () => {
      document.querySelector(".theme-toggle").click()
      const popover = document.querySelector(".theme-popover")
      popover.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      expect(document.querySelector(".theme-popover.open")).not.toBeNull()
    })

    it("exposes __themePopoverIsOpen", () => {
      expect(window.__themePopoverIsOpen()).toBe(false)
      document.querySelector(".theme-toggle").click()
      expect(window.__themePopoverIsOpen()).toBe(true)
    })
  })

  describe("theme selection", () => {
    it("applies light theme via button", () => {
      document.querySelector('[data-set-theme="light"]').click()
      expect(document.documentElement.dataset.theme).toBe("light")
      expect(localStorage.getItem("theme")).toBe("light")
    })

    it("applies dark theme via button", () => {
      document.querySelector('[data-set-theme="dark"]').click()
      expect(document.documentElement.dataset.theme).toBe("dark")
    })

    it("applies system theme (removes attribute)", () => {
      document.querySelector('[data-set-theme="light"]').click()
      document.querySelector('[data-set-theme="system"]').click()
      expect(document.documentElement.dataset.theme).toBeUndefined()
      expect(localStorage.getItem("theme")).toBeNull()
    })

    it("updates active state on theme buttons", () => {
      document.querySelector('[data-set-theme="dark"]').click()
      const darkBtn = document.querySelector('[data-set-theme="dark"]')
      const lightBtn = document.querySelector('[data-set-theme="light"]')
      expect(darkBtn.classList.contains("active")).toBe(true)
      expect(lightBtn.classList.contains("active")).toBe(false)
    })

    it("updates toggle button icon on theme change", () => {
      const btn = document.querySelector(".theme-toggle")
      const initialIcon = btn.innerHTML
      document.querySelector('[data-set-theme="light"]').click()
      expect(btn.innerHTML).not.toBe(initialIcon)
    })
  })

  describe("accent selection", () => {
    it("applies green accent", () => {
      document.querySelector('[data-set-accent="green"]').click()
      expect(document.documentElement.dataset.accent).toBe("green")
      expect(localStorage.getItem("accent")).toBe("green")
    })

    it("applies amber accent", () => {
      document.querySelector('[data-set-accent="amber"]').click()
      expect(document.documentElement.dataset.accent).toBe("amber")
    })

    it("removes accent with default (blue)", () => {
      document.querySelector('[data-set-accent="green"]').click()
      document.querySelector('[data-set-accent=""]').click()
      expect(document.documentElement.dataset.accent).toBeUndefined()
      expect(localStorage.getItem("accent")).toBeNull()
    })

    it("updates active state on accent swatches", () => {
      document.querySelector('[data-set-accent="purple"]').click()
      const purpleBtn = document.querySelector('[data-set-accent="purple"]')
      const blueBtn = document.querySelector('[data-set-accent=""]')
      expect(purpleBtn.classList.contains("active")).toBe(true)
      expect(blueBtn.classList.contains("active")).toBe(false)
    })
  })
})

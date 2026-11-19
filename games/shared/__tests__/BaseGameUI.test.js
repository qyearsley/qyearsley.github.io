import { describe, test, expect, beforeEach, jest } from "@jest/globals"
import { BaseGameUI } from "../BaseGameUI.js"

describe("BaseGameUI", () => {
  let baseGameUI

  beforeEach(() => {
    // Setup basic DOM structure
    document.body.innerHTML = `
      <div class="screen" id="screen1"></div>
      <div class="screen active" id="screen2"></div>
      <div class="screen" id="screen3"></div>
      <div id="settings-modal" class="hidden"></div>
      <div id="test-element" class="hidden">Test Content</div>
      <div id="text-element"></div>
      <div id="html-element"></div>
      <button id="test-button" class="disabled"></button>
      <div id="progress-bar"></div>
      <div id="progress-text"></div>
      <button id="start-button"></button>
      <button id="continue-button" class="hidden"></button>
      <button id="start-fresh-button" class="hidden"></button>
    `
    baseGameUI = new BaseGameUI()
  })

  describe("showScreen", () => {
    test("hides all screens and shows target screen", () => {
      baseGameUI.showScreen("screen1")

      expect(document.getElementById("screen1").classList.contains("active")).toBe(true)
      expect(document.getElementById("screen2").classList.contains("active")).toBe(false)
      expect(document.getElementById("screen3").classList.contains("active")).toBe(false)
    })

    test("handles switching between screens", () => {
      baseGameUI.showScreen("screen2")
      expect(document.getElementById("screen2").classList.contains("active")).toBe(true)

      baseGameUI.showScreen("screen3")
      expect(document.getElementById("screen2").classList.contains("active")).toBe(false)
      expect(document.getElementById("screen3").classList.contains("active")).toBe(true)
    })

    test("handles non-existent screen gracefully", () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation()

      baseGameUI.showScreen("non-existent")

      expect(consoleSpy).toHaveBeenCalledWith("Screen not found: non-existent")
      consoleSpy.mockRestore()
    })
  })

  describe("setVisible", () => {
    test("shows element by removing hidden class", () => {
      const element = document.getElementById("test-element")
      expect(element.classList.contains("hidden")).toBe(true)

      baseGameUI.setVisible(element, true)
      expect(element.classList.contains("hidden")).toBe(false)
    })

    test("hides element by adding hidden class", () => {
      const element = document.getElementById("test-element")
      element.classList.remove("hidden")

      baseGameUI.setVisible(element, false)
      expect(element.classList.contains("hidden")).toBe(true)
    })

    test("accepts element ID as string", () => {
      baseGameUI.setVisible("test-element", true)
      expect(document.getElementById("test-element").classList.contains("hidden")).toBe(false)

      baseGameUI.setVisible("test-element", false)
      expect(document.getElementById("test-element").classList.contains("hidden")).toBe(true)
    })
  })

  describe("setText", () => {
    test("sets text content of element", () => {
      baseGameUI.setText("text-element", "Hello World")
      expect(document.getElementById("text-element").textContent).toBe("Hello World")
    })

    test("handles non-existent element gracefully", () => {
      expect(() => {
        baseGameUI.setText("non-existent", "text")
      }).not.toThrow()
    })
  })

  describe("showSettings and hideSettings", () => {
    test("shows settings modal", () => {
      baseGameUI.showSettings()
      expect(document.getElementById("settings-modal").classList.contains("hidden")).toBe(false)
    })

    test("hides settings modal", () => {
      const modal = document.getElementById("settings-modal")
      modal.classList.remove("hidden")

      baseGameUI.hideSettings()
      expect(modal.classList.contains("hidden")).toBe(true)
    })
  })

  describe("updateTitleButtons", () => {
    test("shows continue and start fresh buttons when there is saved progress", () => {
      baseGameUI.updateTitleButtons(true)

      const continueButton = document.getElementById("continue-button")
      const startFreshButton = document.getElementById("start-fresh-button")

      expect(continueButton.classList.contains("hidden")).toBe(false)
      expect(startFreshButton.classList.contains("hidden")).toBe(false)
    })

    test("hides continue and start fresh buttons when there is no saved progress", () => {
      document.getElementById("continue-button").classList.remove("hidden")
      document.getElementById("start-fresh-button").classList.remove("hidden")

      baseGameUI.updateTitleButtons(false)

      const continueButton = document.getElementById("continue-button")
      const startFreshButton = document.getElementById("start-fresh-button")

      expect(continueButton.classList.contains("hidden")).toBe(true)
      expect(startFreshButton.classList.contains("hidden")).toBe(true)
    })
  })

  describe("cacheCommonElements", () => {
    test("returns object with common DOM elements", () => {
      const elements = baseGameUI.cacheCommonElements()

      expect(elements.screens).toBeDefined()
      expect(elements.settingsModal).toBe(document.getElementById("settings-modal"))
      expect(elements.startButton).toBe(document.getElementById("start-button"))
      expect(elements.continueButton).toBe(document.getElementById("continue-button"))
      expect(elements.startFreshButton).toBe(document.getElementById("start-fresh-button"))
    })
  })

  describe("updateProgressBar", () => {
    test("updates progress bar width and text", () => {
      baseGameUI.updateProgressBar(5, 10)

      const progressBar = document.getElementById("progress-bar")
      const progressText = document.getElementById("progress-text")

      expect(progressBar.style.width).toBe("50%")
      expect(progressText.textContent).toBe("5/10")
    })
  })

  describe("shakeElement", () => {
    test("adds and removes shake class", () => {
      jest.useFakeTimers()
      const element = document.getElementById("test-element")

      baseGameUI.shakeElement(element, 500)

      expect(element.classList.contains("shake")).toBe(true)

      jest.advanceTimersByTime(500)

      expect(element.classList.contains("shake")).toBe(false)

      jest.useRealTimers()
    })

    test("uses default duration", () => {
      jest.useFakeTimers()
      const element = document.getElementById("test-element")

      baseGameUI.shakeElement(element)

      expect(element.classList.contains("shake")).toBe(true)

      jest.advanceTimersByTime(500)

      expect(element.classList.contains("shake")).toBe(false)

      jest.useRealTimers()
    })
  })

  describe("markButtonCorrect", () => {
    test("marks button as correct", () => {
      const button = document.getElementById("test-button")
      baseGameUI.markButtonCorrect(button)
      expect(button.classList.contains("correct")).toBe(true)
    })
  })

  describe("shakeButton", () => {
    test("shakes button element", () => {
      jest.useFakeTimers()
      const button = document.getElementById("test-button")

      baseGameUI.shakeButton(button)

      expect(button.classList.contains("shake")).toBe(true)

      jest.advanceTimersByTime(500)

      expect(button.classList.contains("shake")).toBe(false)

      jest.useRealTimers()
    })
  })
})

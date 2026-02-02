import { describe, test, expect, beforeEach, jest } from "@jest/globals"
import { BaseGameUI } from "../js/BaseGameUI.js"

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
      <div id="feedback-area"></div>
      <div id="progress-bar"></div>
      <div id="progress-text"></div>
      <button id="start-button"></button>
      <button id="continue-button" class="hidden"></button>
      <button id="start-fresh-button" class="hidden"></button>
      <button class="answer-btn disabled"></button>
      <button class="answer-btn disabled"></button>
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

  describe("showModal and hideModal", () => {
    test("shows modal by adding show class", () => {
      const modal = document.getElementById("settings-modal")
      expect(modal.classList.contains("show")).toBe(false)

      baseGameUI.showModal(modal)
      expect(modal.classList.contains("show")).toBe(true)
    })

    test("hides modal by removing show class", () => {
      const modal = document.getElementById("settings-modal")
      modal.classList.add("show")

      baseGameUI.hideModal(modal)
      expect(modal.classList.contains("show")).toBe(false)
    })

    test("accepts element ID as string", () => {
      baseGameUI.showModal("settings-modal")
      expect(document.getElementById("settings-modal").classList.contains("show")).toBe(true)

      baseGameUI.hideModal("settings-modal")
      expect(document.getElementById("settings-modal").classList.contains("show")).toBe(false)
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

  describe("setHTML", () => {
    test("sets HTML content of element", () => {
      baseGameUI.setHTML("html-element", "<strong>Bold</strong>")
      expect(document.getElementById("html-element").innerHTML).toBe("<strong>Bold</strong>")
    })

    test("handles non-existent element gracefully", () => {
      expect(() => {
        baseGameUI.setHTML("non-existent", "<div>html</div>")
      }).not.toThrow()
    })
  })

  describe("addClass and removeClass", () => {
    test("adds class to element", () => {
      const element = document.getElementById("test-element")
      baseGameUI.addClass(element, "new-class")
      expect(element.classList.contains("new-class")).toBe(true)
    })

    test("removes class from element", () => {
      const element = document.getElementById("test-element")
      element.classList.add("remove-me")
      baseGameUI.removeClass(element, "remove-me")
      expect(element.classList.contains("remove-me")).toBe(false)
    })

    test("accepts element ID as string", () => {
      baseGameUI.addClass("test-element", "string-class")
      expect(document.getElementById("test-element").classList.contains("string-class")).toBe(true)

      baseGameUI.removeClass("test-element", "string-class")
      expect(document.getElementById("test-element").classList.contains("string-class")).toBe(false)
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

  describe("disableButton and enableButton", () => {
    test("disables button", () => {
      const button = document.getElementById("test-button")
      button.disabled = false
      button.classList.remove("disabled")

      baseGameUI.disableButton(button)

      expect(button.disabled).toBe(true)
      expect(button.classList.contains("disabled")).toBe(true)
    })

    test("enables button", () => {
      const button = document.getElementById("test-button")

      baseGameUI.enableButton(button)

      expect(button.disabled).toBe(false)
      expect(button.classList.contains("disabled")).toBe(false)
    })

    test("handles null button gracefully", () => {
      expect(() => {
        baseGameUI.disableButton(null)
        baseGameUI.enableButton(null)
      }).not.toThrow()
    })
  })

  describe("disableAnswerButtons and enableAnswerButtons", () => {
    test("disables all answer buttons", () => {
      const buttons = document.querySelectorAll(".answer-btn")
      buttons.forEach((btn) => {
        btn.disabled = false
        btn.classList.remove("disabled")
      })

      baseGameUI.disableAnswerButtons()

      buttons.forEach((btn) => {
        expect(btn.disabled).toBe(true)
        expect(btn.classList.contains("disabled")).toBe(true)
      })
    })

    test("enables all answer buttons", () => {
      baseGameUI.enableAnswerButtons()

      const buttons = document.querySelectorAll(".answer-btn")
      buttons.forEach((btn) => {
        expect(btn.disabled).toBe(false)
        expect(btn.classList.contains("disabled")).toBe(false)
      })
    })
  })

  describe("showFeedback and hideFeedback", () => {
    test("shows feedback with message and type", () => {
      baseGameUI.showFeedback("Great job!", "correct")

      const feedback = document.getElementById("feedback-area")
      expect(feedback.textContent).toBe("Great job!")
      expect(feedback.className).toBe("feedback correct")
      expect(feedback.style.opacity).toBe("1")
    })

    test("defaults to info type", () => {
      baseGameUI.showFeedback("Information")

      const feedback = document.getElementById("feedback-area")
      expect(feedback.className).toBe("feedback info")
    })

    test("hides feedback", () => {
      const feedback = document.getElementById("feedback-area")
      feedback.style.opacity = "1"

      baseGameUI.hideFeedback()

      expect(feedback.style.opacity).toBe("0")
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

    test("accepts custom percent multiplier", () => {
      baseGameUI.updateProgressBar(3, 10, 100)

      const progressBar = document.getElementById("progress-bar")
      expect(progressBar.style.width).toBe("30%")
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

  describe("markButtonCorrect and markButtonIncorrect", () => {
    test("marks button as correct", () => {
      const button = document.getElementById("test-button")
      baseGameUI.markButtonCorrect(button)
      expect(button.classList.contains("correct")).toBe(true)
    })

    test("marks button as incorrect", () => {
      const button = document.getElementById("test-button")
      baseGameUI.markButtonIncorrect(button)
      expect(button.classList.contains("incorrect")).toBe(true)
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

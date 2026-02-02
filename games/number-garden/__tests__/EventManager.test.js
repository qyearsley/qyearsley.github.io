import { describe, test, expect, beforeEach, jest } from "@jest/globals"
import { EventManager } from "../js/EventManager.js"

describe("EventManager", () => {
  let eventManager
  let callbacks
  let mockUI

  beforeEach(() => {
    // Setup DOM structure with all required elements
    document.body.innerHTML = `
      <button id="start-button"></button>
      <button id="continue-button"></button>
      <button id="start-fresh-button"></button>
      <button id="back-button"></button>
      <button id="home-button"></button>
      <div class="garden-area" data-area="area1"></div>
      <div class="garden-area locked" data-area="area2"></div>
      <div id="answer-options"></div>
      <button id="settings-button"></button>
      <button id="activity-settings-button"></button>
      <button id="close-settings"></button>
      <select id="difficulty-select"></select>
      <select id="input-mode-select"></select>
      <select id="visual-hints-select"></select>
      <select id="sound-effects-select"></select>
      <button id="castle-button"></button>
      <button id="activity-castle-button"></button>
      <button id="castle-back-button"></button>
      <div class="project-option" data-project="castle"></div>
      <button id="project-back-button"></button>
      <button id="continue-from-project"></button>
      <button id="continue-playing-button"></button>
      <button id="return-to-hub-button"></button>
      <div id="activity-screen"></div>
    `

    // Setup callbacks
    callbacks = {
      onStart: jest.fn(),
      onContinue: jest.fn(),
      onStartFresh: jest.fn(),
      onBack: jest.fn(),
      onHome: jest.fn(),
      onAreaEnter: jest.fn(),
      onAnswerSelected: jest.fn(),
      onSettingsOpen: jest.fn(),
      onSettingsClose: jest.fn(),
      onSettingChange: jest.fn(),
      onCastleView: jest.fn(),
      onCastleBack: jest.fn(),
      onProjectSelect: jest.fn(),
      onProjectBack: jest.fn(),
      onContinueFromProject: jest.fn(),
      onContinueFromLevelComplete: jest.fn(),
      onReturnToHub: jest.fn(),
    }

    // Setup mock UI
    mockUI = {
      elements: {
        startButton: document.getElementById("start-button"),
        continueButton: document.getElementById("continue-button"),
        startFreshButton: document.getElementById("start-fresh-button"),
        backButton: document.getElementById("back-button"),
        gardenAreas: document.querySelectorAll(".garden-area"),
        answerOptions: document.getElementById("answer-options"),
        settingsButton: document.getElementById("settings-button"),
        closeSettings: document.getElementById("close-settings"),
        difficultySelect: document.getElementById("difficulty-select"),
        inputModeSelect: document.getElementById("input-mode-select"),
        visualHintsSelect: document.getElementById("visual-hints-select"),
        soundEffectsSelect: document.getElementById("sound-effects-select"),
        castleButton: document.getElementById("castle-button"),
        castleBackButton: document.getElementById("castle-back-button"),
      },
    }

    eventManager = new EventManager(mockUI, callbacks)
  })

  describe("initialization", () => {
    test("creates event manager with UI and callbacks", () => {
      expect(eventManager.ui).toBe(mockUI)
      expect(eventManager.callbacks).toBe(callbacks)
      expect(eventManager.isProcessingAnswer).toBe(false)
    })
  })

  describe("button event listeners", () => {
    test("start button triggers onStart callback", () => {
      eventManager.setupStartButton()
      document.getElementById("start-button").click()
      expect(callbacks.onStart).toHaveBeenCalledTimes(1)
    })

    test("continue button triggers onContinue callback", () => {
      eventManager.setupContinueButton()
      document.getElementById("continue-button").click()
      expect(callbacks.onContinue).toHaveBeenCalledTimes(1)
    })

    test("start fresh button triggers onStartFresh callback", () => {
      eventManager.setupStartFreshButton()
      document.getElementById("start-fresh-button").click()
      expect(callbacks.onStartFresh).toHaveBeenCalledTimes(1)
    })

    test("back button triggers onBack callback", () => {
      eventManager.setupBackButton()
      document.getElementById("back-button").click()
      expect(callbacks.onBack).toHaveBeenCalledTimes(1)
    })

    test("home button triggers onHome callback", () => {
      eventManager.setupHomeButton()
      document.getElementById("home-button").click()
      expect(callbacks.onHome).toHaveBeenCalledTimes(1)
    })
  })

  describe("garden area listeners", () => {
    test("clicking unlocked area triggers onAreaEnter with area ID", () => {
      eventManager.setupGardenAreas()
      const area = document.querySelector(".garden-area[data-area='area1']")
      area.click()
      expect(callbacks.onAreaEnter).toHaveBeenCalledWith("area1")
    })

    test("clicking locked area does not trigger callback", () => {
      eventManager.setupGardenAreas()
      const area = document.querySelector(".garden-area[data-area='area2']")
      area.click()
      expect(callbacks.onAreaEnter).not.toHaveBeenCalled()
    })

    test("Enter key on unlocked area triggers onAreaEnter", () => {
      eventManager.setupGardenAreas()
      const area = document.querySelector(".garden-area[data-area='area1']")
      const event = new KeyboardEvent("keydown", { key: "Enter" })
      area.dispatchEvent(event)
      expect(callbacks.onAreaEnter).toHaveBeenCalledWith("area1")
    })

    test("Space key on unlocked area triggers onAreaEnter", () => {
      eventManager.setupGardenAreas()
      const area = document.querySelector(".garden-area[data-area='area1']")
      const event = new KeyboardEvent("keydown", { key: " " })
      area.dispatchEvent(event)
      expect(callbacks.onAreaEnter).toHaveBeenCalledWith("area1")
    })

    test("sets accessibility attributes on garden areas", () => {
      eventManager.setupGardenAreas()
      const areas = document.querySelectorAll(".garden-area")
      areas.forEach((area) => {
        expect(area.getAttribute("tabindex")).toBe("0")
        expect(area.getAttribute("role")).toBe("button")
      })
    })
  })

  describe("answer button listeners", () => {
    test("clicking answer button triggers onAnswerSelected with correct data", () => {
      const answerOptions = document.getElementById("answer-options")
      answerOptions.innerHTML = `
        <button class="answer-button" data-answer="42" data-correct="true">42</button>
        <button class="answer-button" data-answer="13" data-correct="false">13</button>
      `

      eventManager.setupAnswerButtons()

      const button = answerOptions.querySelector('[data-answer="42"]')
      button.click()

      expect(callbacks.onAnswerSelected).toHaveBeenCalledWith(42, true, button)
    })

    test("parses numeric answers correctly", () => {
      const answerOptions = document.getElementById("answer-options")
      answerOptions.innerHTML = `
        <button class="answer-button" data-answer="7" data-correct="false">7</button>
      `

      eventManager.setupAnswerButtons()
      const button = answerOptions.querySelector('[data-answer="7"]')
      button.click()

      expect(callbacks.onAnswerSelected).toHaveBeenCalledWith(7, false, button)
    })

    test("preserves string answers", () => {
      const answerOptions = document.getElementById("answer-options")
      answerOptions.innerHTML = `
        <button class="answer-button" data-answer="morning" data-correct="true">morning</button>
      `

      eventManager.setupAnswerButtons()
      const button = answerOptions.querySelector('[data-answer="morning"]')
      button.click()

      expect(callbacks.onAnswerSelected).toHaveBeenCalledWith("morning", true, button)
    })
  })

  describe("settings listeners", () => {
    test("settings button triggers onSettingsOpen", () => {
      eventManager.setupSettingsButton()
      document.getElementById("settings-button").click()
      expect(callbacks.onSettingsOpen).toHaveBeenCalledTimes(1)
    })

    test("activity settings button triggers onSettingsOpen", () => {
      eventManager.setupActivitySettingsButton()
      document.getElementById("activity-settings-button").click()
      expect(callbacks.onSettingsOpen).toHaveBeenCalledTimes(1)
    })

    test("close settings button triggers onSettingsClose", () => {
      eventManager.setupCloseSettingsButton()
      document.getElementById("close-settings").click()
      expect(callbacks.onSettingsClose).toHaveBeenCalledTimes(1)
    })

    test("difficulty select triggers onSettingChange", () => {
      eventManager.setupSettingsSelects()
      const select = document.getElementById("difficulty-select")
      select.innerHTML = '<option value="explorer">Explorer</option>'
      select.value = "explorer"
      select.dispatchEvent(new Event("change"))
      expect(callbacks.onSettingChange).toHaveBeenCalledWith("difficulty", "explorer")
    })

    test("input mode select triggers onSettingChange", () => {
      eventManager.setupSettingsSelects()
      const select = document.getElementById("input-mode-select")
      select.innerHTML = '<option value="keyboard">Keyboard</option>'
      select.value = "keyboard"
      select.dispatchEvent(new Event("change"))
      expect(callbacks.onSettingChange).toHaveBeenCalledWith("inputMode", "keyboard")
    })

    test("visual hints select triggers onSettingChange", () => {
      eventManager.setupSettingsSelects()
      const select = document.getElementById("visual-hints-select")
      select.innerHTML = '<option value="off">Off</option>'
      select.value = "off"
      select.dispatchEvent(new Event("change"))
      expect(callbacks.onSettingChange).toHaveBeenCalledWith("visualHints", "off")
    })

    test("sound effects select triggers onSettingChange", () => {
      eventManager.setupSettingsSelects()
      const select = document.getElementById("sound-effects-select")
      select.innerHTML = '<option value="off">Off</option>'
      select.value = "off"
      select.dispatchEvent(new Event("change"))
      expect(callbacks.onSettingChange).toHaveBeenCalledWith("soundEffects", "off")
    })
  })

  describe("castle and project listeners", () => {
    test("castle button triggers onCastleView", () => {
      eventManager.setupCastleButton()
      document.getElementById("castle-button").click()
      expect(callbacks.onCastleView).toHaveBeenCalledTimes(1)
    })

    test("activity castle button triggers onCastleView", () => {
      eventManager.setupActivityCastleButton()
      document.getElementById("activity-castle-button").click()
      expect(callbacks.onCastleView).toHaveBeenCalledTimes(1)
    })

    test("castle back button triggers onCastleBack", () => {
      eventManager.setupCastleBackButton()
      document.getElementById("castle-back-button").click()
      expect(callbacks.onCastleBack).toHaveBeenCalledTimes(1)
    })

    test("project option triggers onProjectSelect", () => {
      eventManager.setupProjectOptions()
      document.querySelector(".project-option").click()
      expect(callbacks.onProjectSelect).toHaveBeenCalledWith("castle")
    })

    test("project back button triggers onProjectBack", () => {
      eventManager.setupProjectBackButton()
      document.getElementById("project-back-button").click()
      expect(callbacks.onProjectBack).toHaveBeenCalledTimes(1)
    })

    test("continue from project button triggers callback", () => {
      eventManager.setupContinueFromProjectButton()
      document.getElementById("continue-from-project").click()
      expect(callbacks.onContinueFromProject).toHaveBeenCalledTimes(1)
    })

    test("continue from level complete button triggers callback", () => {
      eventManager.setupContinueFromLevelCompleteButton()
      document.getElementById("continue-playing-button").click()
      expect(callbacks.onContinueFromLevelComplete).toHaveBeenCalledTimes(1)
    })

    test("return to hub button triggers callback", () => {
      eventManager.setupReturnToHubButton()
      document.getElementById("return-to-hub-button").click()
      expect(callbacks.onReturnToHub).toHaveBeenCalledTimes(1)
    })
  })

  describe("keyboard input", () => {
    beforeEach(() => {
      const answerOptions = document.getElementById("answer-options")
      answerOptions.innerHTML = `
        <input id="answer-input-field" data-correct="42" value="42" />
        <button id="submit-answer-btn">Submit</button>
      `
    })

    test("submit button triggers answer submission", () => {
      eventManager.setupKeyboardInput()
      document.getElementById("submit-answer-btn").click()

      expect(callbacks.onAnswerSelected).toHaveBeenCalledWith("42", true, expect.any(HTMLInputElement))
    })

    test("Enter key in input field triggers submission", () => {
      eventManager.setupKeyboardInput()
      const input = document.getElementById("answer-input-field")
      const event = new KeyboardEvent("keypress", { key: "Enter", bubbles: true })
      Object.defineProperty(event, "target", { value: input, enumerable: true })
      document.getElementById("answer-options").dispatchEvent(event)

      expect(callbacks.onAnswerSelected).toHaveBeenCalledWith("42", true, expect.any(HTMLInputElement))
    })

    test("empty input does not trigger submission", () => {
      eventManager.setupKeyboardInput()
      const input = document.getElementById("answer-input-field")
      input.value = ""

      document.getElementById("submit-answer-btn").click()

      expect(callbacks.onAnswerSelected).not.toHaveBeenCalled()
    })

    test("compares numeric answers correctly", () => {
      eventManager.setupKeyboardInput()
      const input = document.getElementById("answer-input-field")
      input.value = "42"
      input.dataset.correct = "42"

      document.getElementById("submit-answer-btn").click()

      expect(callbacks.onAnswerSelected).toHaveBeenCalledWith("42", true, expect.any(HTMLInputElement))
    })

    test("compares string answers correctly", () => {
      const answerOptions = document.getElementById("answer-options")
      answerOptions.innerHTML = `
        <input id="answer-input-field" data-correct="hello" value="hello" />
        <button id="submit-answer-btn">Submit</button>
      `
      eventManager.setupKeyboardInput()
      document.getElementById("submit-answer-btn").click()

      expect(callbacks.onAnswerSelected).toHaveBeenCalledWith("hello", true, expect.any(HTMLInputElement))
    })

    test("prevents double submission with processing flag", () => {
      eventManager.setupKeyboardInput()

      // First submission
      document.getElementById("submit-answer-btn").click()
      expect(callbacks.onAnswerSelected).toHaveBeenCalledTimes(1)

      // Second submission while processing
      document.getElementById("submit-answer-btn").click()
      expect(callbacks.onAnswerSelected).toHaveBeenCalledTimes(1) // Still just once
    })

    test("disables input and button during processing", () => {
      eventManager.setupKeyboardInput()
      const input = document.getElementById("answer-input-field")
      const button = document.getElementById("submit-answer-btn")

      document.getElementById("submit-answer-btn").click()

      expect(input.disabled).toBe(true)
      expect(button.disabled).toBe(true)
    })
  })

  describe("keyboard shortcuts", () => {
    beforeEach(() => {
      const answerOptions = document.getElementById("answer-options")
      answerOptions.innerHTML = `
        <button class="answer-button" data-answer="1">1</button>
        <button class="answer-button" data-answer="2">2</button>
        <button class="answer-button" data-answer="3">3</button>
        <button class="answer-button" data-answer="4">4</button>
      `
      document.getElementById("activity-screen").classList.add("active")
      eventManager.setupAnswerButtons()
    })

    test("number keys 1-4 trigger answer button clicks", () => {
      eventManager.setupKeyboardShortcuts()

      const event = new KeyboardEvent("keydown", { key: "1" })
      document.dispatchEvent(event)

      expect(callbacks.onAnswerSelected).toHaveBeenCalledWith(1, expect.anything(), expect.anything())
    })

    test("does not trigger when typing in input field", () => {
      const input = document.createElement("input")
      document.body.appendChild(input)
      input.focus()

      eventManager.setupKeyboardShortcuts()

      const event = new KeyboardEvent("keydown", { key: "1", target: input })
      Object.defineProperty(event, "target", { value: input, enumerable: true })
      document.dispatchEvent(event)

      expect(callbacks.onAnswerSelected).not.toHaveBeenCalled()
    })

    test("does not trigger when activity screen is not active", () => {
      document.getElementById("activity-screen").classList.remove("active")
      eventManager.setupKeyboardShortcuts()

      const event = new KeyboardEvent("keydown", { key: "1" })
      document.dispatchEvent(event)

      expect(callbacks.onAnswerSelected).not.toHaveBeenCalled()
    })

    test("does not trigger on disabled buttons", () => {
      const buttons = document.querySelectorAll(".answer-button")
      buttons[0].classList.add("disabled")

      eventManager.setupKeyboardShortcuts()

      const event = new KeyboardEvent("keydown", { key: "1" })
      document.dispatchEvent(event)

      expect(callbacks.onAnswerSelected).not.toHaveBeenCalled()
    })
  })

  describe("resetAnswerProcessing", () => {
    test("resets answer processing flag", () => {
      eventManager.isProcessingAnswer = true
      eventManager.resetAnswerProcessing()
      expect(eventManager.isProcessingAnswer).toBe(false)
    })
  })

  describe("initializeEventListeners", () => {
    test("sets up all event listeners", () => {
      // Spy on all setup methods
      const setupMethods = [
        "setupStartButton",
        "setupContinueButton",
        "setupStartFreshButton",
        "setupBackButton",
        "setupHomeButton",
        "setupGardenAreas",
        "setupAnswerButtons",
        "setupSettingsButton",
        "setupActivitySettingsButton",
        "setupCloseSettingsButton",
        "setupSettingsSelects",
        "setupCastleButton",
        "setupActivityCastleButton",
        "setupCastleBackButton",
        "setupKeyboardInput",
        "setupKeyboardShortcuts",
        "setupProjectOptions",
        "setupProjectBackButton",
        "setupContinueFromProjectButton",
        "setupContinueFromLevelCompleteButton",
        "setupReturnToHubButton",
      ]

      setupMethods.forEach((method) => {
        jest.spyOn(eventManager, method).mockImplementation()
      })

      eventManager.initializeEventListeners()

      setupMethods.forEach((method) => {
        expect(eventManager[method]).toHaveBeenCalled()
      })
    })
  })

  describe("missing elements", () => {
    test("handles missing buttons gracefully", () => {
      document.body.innerHTML = ""
      mockUI.elements = {}

      const em = new EventManager(mockUI, callbacks)

      expect(() => {
        em.setupStartButton()
        em.setupContinueButton()
        em.setupSettingsButton()
      }).not.toThrow()
    })
  })
})

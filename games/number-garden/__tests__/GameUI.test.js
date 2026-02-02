import { describe, test, expect, beforeEach, jest } from "@jest/globals"
import { GameUI } from "../js/GameUI.js"

describe("GameUI", () => {
  let gameUI

  beforeEach(() => {
    // Setup comprehensive DOM structure
    document.body.innerHTML = `
      <div class="screen" id="title-screen"></div>
      <div id="settings-modal" class="hidden"></div>
      <button id="settings-button"></button>
      <button id="close-settings"></button>
      <button id="start-button"></button>
      <button id="continue-button"></button>
      <button id="start-fresh-button"></button>
      <button id="back-button"></button>
      <div class="garden-area" data-area="area1"></div>
      <div class="creature-image">🦋</div>
      <div id="creature-message">Hello!</div>
      <div id="question-text">What is 2+2?</div>
      <div id="visual-area"></div>
      <div id="answer-options"></div>
      <div id="feedback-area" class="hidden"></div>
      <div id="garden-canvas"></div>
      <span id="star-count">0</span>
      <span id="activity-star-count">0</span>
      <div id="level-display">Level 1</div>
      <div class="garden-preview"></div>
      <div id="particles-container"></div>
      <button id="castle-button"></button>
      <select id="difficulty-select"></select>
      <select id="input-mode-select"></select>
      <select id="visual-hints-select"></select>
      <select id="questions-per-level-select"></select>
      <select id="sound-effects-select"></select>
      <button id="castle-back-button"></button>
      <div id="castle-screen-title"></div>
      <div id="castle-description"></div>
      <div id="castle-progress-text"></div>
      <div id="castle-svg-container"></div>
      <div id="castle-pieces-display"></div>
      <div id="castle-notification"></div>
      <div id="project-progress-modal"></div>
      <div id="project-modal-title"></div>
      <div id="project-visual"></div>
      <div id="project-progress-text"></div>
      <button id="continue-from-project"></button>
      <div id="progress-bar"></div>
      <div id="progress-text"></div>
    `

    gameUI = new GameUI()
  })

  describe("initialization", () => {
    test("caches all required elements", () => {
      expect(gameUI.elements.gardenAreas).toBeDefined()
      expect(gameUI.elements.questionText).toBe(document.getElementById("question-text"))
      expect(gameUI.elements.visualArea).toBe(document.getElementById("visual-area"))
      expect(gameUI.elements.answerOptions).toBe(document.getElementById("answer-options"))
    })

    test("extends BaseGameUI", () => {
      expect(gameUI.showScreen).toBeDefined()
      expect(gameUI.showModal).toBeDefined()
      expect(gameUI.setVisible).toBeDefined()
    })
  })

  describe("updateStats", () => {
    test("updates star counts in all locations", () => {
      gameUI.updateStats({ stars: 42, currentLevel: 3 })

      expect(document.getElementById("star-count").textContent).toBe("42")
      expect(document.getElementById("activity-star-count").textContent).toBe("42")
    })

    test("updates level display", () => {
      gameUI.updateStats({ stars: 10, currentLevel: 5 })

      expect(document.getElementById("level-display").textContent).toBe("Level 5")
    })
  })

  describe("displayActivity", () => {
    const basicActivity = {
      question: "What is 2 + 2?",
      options: [2, 3, 4, 5],
      correctAnswer: 4,
      creature: "🦋",
      creatureMessage: "Try this!",
      visual: ["🌸", "🌸"],
      type: "addition",
    }

    test("displays question text", () => {
      gameUI.displayActivity(basicActivity)
      expect(document.getElementById("question-text").textContent).toBe("What is 2 + 2?")
    })

    test("displays creature image", () => {
      gameUI.displayActivity(basicActivity)
      expect(document.querySelector(".creature-image").textContent).toBe("🦋")
    })

    test("displays creature message", () => {
      gameUI.displayActivity(basicActivity)
      expect(document.getElementById("creature-message").textContent).toBe("Try this!")
    })

    test("displays visual items when hints are on", () => {
      jest.useFakeTimers()
      gameUI.displayActivity(basicActivity, "multipleChoice", "on")
      jest.runAllTimers()
      const visualItems = document.querySelectorAll(".visual-item")
      expect(visualItems.length).toBe(2)
      jest.useRealTimers()
    })

    test("hides non-essential visuals when hints are off", () => {
      gameUI.displayActivity(basicActivity, "multipleChoice", "off")
      const visualArea = document.getElementById("visual-area")
      expect(visualArea.innerHTML).toBe("")
    })

    test("always shows essential visuals (HTML content)", () => {
      jest.useFakeTimers()
      const activityWithEssentialVisual = {
        ...basicActivity,
        visual: [{ html: "<svg>clock</svg>" }],
      }
      gameUI.displayActivity(activityWithEssentialVisual, "multipleChoice", "off")
      jest.runAllTimers()
      const visualArea = document.getElementById("visual-area")
      expect(visualArea.innerHTML).toContain("svg")
      jest.useRealTimers()
    })

    test("always shows pattern visuals", () => {
      jest.useFakeTimers()
      const patternActivity = {
        ...basicActivity,
        type: "pattern",
        visual: ["🔴", "🔵", "🔴"],
      }
      gameUI.displayActivity(patternActivity, "multipleChoice", "off")
      jest.runAllTimers()
      const visualItems = document.querySelectorAll(".visual-item")
      expect(visualItems.length).toBe(3)
      jest.useRealTimers()
    })

    test("displays answer options in multiple choice mode", () => {
      gameUI.displayActivity(basicActivity, "multipleChoice")
      const buttons = document.querySelectorAll(".answer-button")
      expect(buttons.length).toBe(4)
      expect(buttons[0].textContent).toBe("2")
      expect(buttons[2].dataset.correct).toBe("true")
    })

    test("displays keyboard input in keyboard mode", () => {
      gameUI.displayActivity(basicActivity, "keyboard")
      const input = document.getElementById("answer-input-field")
      const submitButton = document.getElementById("submit-answer-btn")
      expect(input).toBeTruthy()
      expect(submitButton).toBeTruthy()
    })

    test("hides feedback area", () => {
      const feedbackArea = document.getElementById("feedback-area")
      feedbackArea.classList.remove("hidden")

      gameUI.displayActivity(basicActivity)

      expect(feedbackArea.classList.contains("hidden")).toBe(true)
    })
  })

  describe("displayVisualItems", () => {
    test("displays emoji visual items", () => {
      jest.useFakeTimers()
      gameUI.displayVisualItems(["🌸", "🌺", "🌻"])

      jest.runAllTimers()

      const visualItems = document.querySelectorAll(".visual-item")
      expect(visualItems.length).toBe(3)
      expect(visualItems[0].textContent).toBe("🌸")
      expect(visualItems[1].textContent).toBe("🌺")
      expect(visualItems[2].textContent).toBe("🌻")

      jest.useRealTimers()
    })

    test("displays HTML content in visual items", () => {
      jest.useFakeTimers()
      gameUI.displayVisualItems([{ html: "<svg>test</svg>" }])

      jest.runAllTimers()

      const visualItem = document.querySelector(".visual-item")
      expect(visualItem.innerHTML).toContain("svg")
      expect(visualItem.style.display).toBe("inline-block")

      jest.useRealTimers()
    })

    test("displays crossed out items", () => {
      jest.useFakeTimers()
      gameUI.displayVisualItems([{ emoji: "🌸", crossed: true }])

      jest.runAllTimers()

      const visualItem = document.querySelector(".visual-item")
      expect(visualItem.classList.contains("crossed-out")).toBe(true)
      expect(visualItem.textContent).toBe("🌸")

      jest.useRealTimers()
    })

    test("displays separator items", () => {
      jest.useFakeTimers()
      gameUI.displayVisualItems([{ emoji: "|", separator: true }])

      jest.runAllTimers()

      const visualItem = document.querySelector(".visual-item")
      expect(visualItem.classList.contains("separator")).toBe(true)

      jest.useRealTimers()
    })

    test("clears existing visual items before displaying new ones", () => {
      document.getElementById("visual-area").innerHTML = "<div>old</div>"
      jest.useFakeTimers()

      gameUI.displayVisualItems(["🌸"])
      jest.runAllTimers()

      const visualArea = document.getElementById("visual-area")
      expect(visualArea.innerHTML).not.toContain("old")

      jest.useRealTimers()
    })
  })

  describe("displayAnswerOptions", () => {
    test("creates button for each option", () => {
      gameUI.displayAnswerOptions([1, 2, 3, 4], 3)

      const buttons = document.querySelectorAll(".answer-button")
      expect(buttons.length).toBe(4)
    })

    test("sets correct data attributes", () => {
      gameUI.displayAnswerOptions([10, 20, 30], 20)

      const buttons = document.querySelectorAll(".answer-button")
      expect(buttons[0].dataset.answer).toBe("10")
      expect(buttons[0].dataset.correct).toBe("false")
      expect(buttons[1].dataset.answer).toBe("20")
      expect(buttons[1].dataset.correct).toBe("true")
    })

    test("sets keyboard hints", () => {
      gameUI.displayAnswerOptions([1, 2, 3], 1)

      const buttons = document.querySelectorAll(".answer-button")
      expect(buttons[0].dataset.keyboardHint).toBe("1")
      expect(buttons[1].dataset.keyboardHint).toBe("2")
      expect(buttons[2].dataset.keyboardHint).toBe("3")
    })

    test("sets accessibility attributes", () => {
      gameUI.displayAnswerOptions([5, 10], 5)

      const buttons = document.querySelectorAll(".answer-button")
      expect(buttons[0].getAttribute("aria-label")).toBe("Answer 1: 5")
      expect(buttons[0].getAttribute("tabindex")).toBe("0")
    })
  })

  describe("displayKeyboardInput", () => {
    test("creates input and submit button", () => {
      gameUI.displayKeyboardInput(42)

      const input = document.getElementById("answer-input-field")
      const button = document.getElementById("submit-answer-btn")

      expect(input).toBeTruthy()
      expect(button).toBeTruthy()
    })

    test("uses text input for time format", () => {
      gameUI.displayKeyboardInput("3:30")

      const input = document.getElementById("answer-input-field")
      expect(input.type).toBe("text")
      expect(input.placeholder).toBe("0:00")
    })

    test("uses number input for numeric answers", () => {
      gameUI.displayKeyboardInput(42)

      const input = document.getElementById("answer-input-field")
      expect(input.type).toBe("number")
      expect(input.placeholder).toBe("?")
    })

    test("sets correct answer in data attribute", () => {
      gameUI.displayKeyboardInput(99)

      const input = document.getElementById("answer-input-field")
      expect(input.dataset.correct).toBe("99")
    })
  })

  describe("showFeedback", () => {
    test("displays feedback with message and type", () => {
      gameUI.showFeedback("Great job!", "correct")

      const feedbackArea = document.getElementById("feedback-area")
      expect(feedbackArea.innerHTML).toContain("Great job!")
      expect(feedbackArea.innerHTML).toContain("✨")
      expect(feedbackArea.classList.contains("hidden")).toBe(false)
    })

    test("shows correct answer for incorrect responses", () => {
      gameUI.showFeedback("Try again", "incorrect", { correctAnswer: 42 })

      const feedbackArea = document.getElementById("feedback-area")
      expect(feedbackArea.innerHTML).toContain("The answer is")
      expect(feedbackArea.innerHTML).toContain("42")
    })

    test("shows explanation when provided", () => {
      gameUI.showFeedback("Correct!", "correct", { explanation: "5 + 5 = 10" })

      const feedbackArea = document.getElementById("feedback-area")
      expect(feedbackArea.innerHTML).toContain("5 + 5 = 10")
    })

    test("uses appropriate icon for each type", () => {
      gameUI.showFeedback("msg", "correct")
      expect(document.getElementById("feedback-area").innerHTML).toContain("✨")

      gameUI.showFeedback("msg", "incorrect")
      expect(document.getElementById("feedback-area").innerHTML).toContain("🔍")

      gameUI.showFeedback("msg", "encourage")
      expect(document.getElementById("feedback-area").innerHTML).toContain("💫")
    })
  })

  describe("renderGarden", () => {
    test("displays flowers with animation", () => {
      jest.useFakeTimers()
      const garden = [
        { color: "red", emoji: "🌹" },
        { color: "yellow", emoji: "🌻" },
      ]

      gameUI.renderGarden(garden)
      jest.runAllTimers()

      const flowers = document.querySelectorAll(".garden-item")
      expect(flowers.length).toBe(2)
      expect(flowers[0].textContent).toBe("🌹")
      expect(flowers[1].textContent).toBe("🌻")

      jest.useRealTimers()
    })

    test("clears existing garden before rendering", () => {
      document.getElementById("garden-canvas").innerHTML = "<div>old</div>"
      jest.useFakeTimers()

      gameUI.renderGarden([{ color: "red", emoji: "🌹" }])
      jest.runAllTimers()

      expect(document.getElementById("garden-canvas").innerHTML).not.toContain("old")

      jest.useRealTimers()
    })
  })

  describe("updateAreaLocks", () => {
    test("marks unlocked areas as unlocked", () => {
      const unlockedAreas = new Set(["area1"])
      gameUI.updateAreaLocks(unlockedAreas)

      const area = document.querySelector('[data-area="area1"]')
      expect(area.classList.contains("unlocked")).toBe(true)
      expect(area.classList.contains("locked")).toBe(false)
    })

    test("marks locked areas as locked", () => {
      const area = document.querySelector('[data-area="area1"]')
      area.classList.add("unlocked")

      gameUI.updateAreaLocks(new Set())

      expect(area.classList.contains("locked")).toBe(true)
      expect(area.classList.contains("unlocked")).toBe(false)
    })
  })

  describe("updateSettingsUI", () => {
    test("updates all setting selects with values", () => {
      const settings = {
        difficulty: "explorer",
        inputMode: "keyboard",
        visualHints: "off",
        soundEffects: "off",
      }

      // Add options to selects
      document.getElementById("difficulty-select").innerHTML = '<option value="explorer">Explorer</option>'
      document.getElementById("input-mode-select").innerHTML = '<option value="keyboard">Keyboard</option>'
      document.getElementById("visual-hints-select").innerHTML = '<option value="off">Off</option>'
      document.getElementById("sound-effects-select").innerHTML = '<option value="off">Off</option>'

      gameUI.updateSettingsUI(settings)

      expect(document.getElementById("difficulty-select").value).toBe("explorer")
      expect(document.getElementById("input-mode-select").value).toBe("keyboard")
      expect(document.getElementById("visual-hints-select").value).toBe("off")
      expect(document.getElementById("sound-effects-select").value).toBe("off")
    })

    test("uses default values when settings are missing", () => {
      // Add options to selects
      document.getElementById("difficulty-select").innerHTML = '<option value="adventurer">Adventurer</option>'
      document.getElementById("input-mode-select").innerHTML =
        '<option value="multipleChoice">Multiple Choice</option>'
      document.getElementById("visual-hints-select").innerHTML = '<option value="on">On</option>'
      document.getElementById("sound-effects-select").innerHTML = '<option value="on">On</option>'

      gameUI.updateSettingsUI({})

      expect(document.getElementById("difficulty-select").value).toBe("adventurer")
      expect(document.getElementById("input-mode-select").value).toBe("multipleChoice")
      expect(document.getElementById("visual-hints-select").value).toBe("on")
      expect(document.getElementById("sound-effects-select").value).toBe("on")
    })
  })

  describe("updateCastleScreen", () => {
    test("updates castle screen title", () => {
      gameUI.updateCastleScreen({ title: "Build a Castle" })

      expect(document.getElementById("castle-screen-title").textContent).toBe("Build a Castle")
    })
  })

  describe("getButtonCenter", () => {
    test("returns center coordinates of button", () => {
      const button = document.createElement("button")
      document.body.appendChild(button)

      // Mock getBoundingClientRect for jsdom
      button.getBoundingClientRect = jest.fn(() => ({
        left: 100,
        top: 50,
        width: 80,
        height: 40,
      }))

      const center = gameUI.getButtonCenter(button)

      expect(center.x).toBe(140) // 100 + 80/2
      expect(center.y).toBe(70) // 50 + 40/2

      button.remove()
    })
  })

  describe("getParticlesContainer", () => {
    test("returns particles container element", () => {
      const container = gameUI.getParticlesContainer()
      expect(container).toBe(document.getElementById("particles-container"))
    })
  })

  describe("button manipulation", () => {
    test("shakes button with animation", () => {
      jest.useFakeTimers()
      const button = document.createElement("button")

      gameUI.shakeButton(button)

      expect(button.style.animation).toBe("shake 0.5s")

      jest.advanceTimersByTime(500)

      expect(button.style.animation).toBe("")

      jest.useRealTimers()
    })

    test("disables all answer buttons", () => {
      document.getElementById("answer-options").innerHTML = `
        <button class="answer-button"></button>
        <button class="answer-button"></button>
      `

      gameUI.disableAnswerButtons()

      const buttons = document.querySelectorAll(".answer-button")
      buttons.forEach((btn) => {
        expect(btn.classList.contains("disabled")).toBe(true)
      })
    })

    test("enables all answer buttons", () => {
      document.getElementById("answer-options").innerHTML = `
        <button class="answer-button disabled"></button>
        <button class="answer-button disabled"></button>
      `

      gameUI.enableAnswerButtons()

      const buttons = document.querySelectorAll(".answer-button")
      buttons.forEach((btn) => {
        expect(btn.classList.contains("disabled")).toBe(false)
      })
    })
  })

  describe("updateProgressBar", () => {
    test("updates progress bar with MATH.PERCENT_MULTIPLIER", () => {
      gameUI.updateProgressBar(5, 10)

      const progressBar = document.getElementById("progress-bar")
      const progressText = document.getElementById("progress-text")

      // Should use MATH.PERCENT_MULTIPLIER (100) by default
      expect(progressBar.style.width).toBe("50%")
      expect(progressText.textContent).toBe("5/10")
    })
  })

  describe("updateVisualProgression", () => {
    const mockThemes = {
      forest: {
        primaryColor: "#228B22",
        accentColor: "#8FBC8F",
        decorations: ["🌳", "🌲", "🍄"],
        stages: [
          { percent: 0, background: "#f0f0f0" },
          { percent: 50, background: "#90EE90" },
        ],
      },
    }

    test("updates visual theme based on progress", () => {
      gameUI.updateVisualProgression("forest", mockThemes, 60)

      const preview = document.querySelector(".garden-preview")
      expect(preview.style.backgroundColor).toBe("rgb(144, 238, 144)")
    })

    test("sets CSS custom properties for theme colors", () => {
      gameUI.updateVisualProgression("forest", mockThemes, 0)

      const root = document.documentElement
      expect(root.style.getPropertyValue("--theme-primary")).toBe("#228B22")
      expect(root.style.getPropertyValue("--theme-accent")).toBe("#8FBC8F")
    })

    test("handles missing theme gracefully", () => {
      expect(() => {
        gameUI.updateVisualProgression("nonexistent", mockThemes, 50)
      }).not.toThrow()
    })
  })
})

/**
 * Tests for Times Trail's EventManager.
 *
 * The fixture is the real `games/times-trail/index.html`, read off disk and
 * spliced into `document.body`. A renamed or misspelled id therefore fails this
 * suite instead of surviving as a dead control in the browser.
 */
import { describe, test, expect, beforeEach, afterEach, jest } from "@jest/globals"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { EventManager } from "../js/EventManager.js"
import { Keypad } from "../js/Keypad.js"
import { ANSWER_KEYS } from "../js/constants.js"

const HERE = dirname(fileURLToPath(import.meta.url))
const INDEX_HTML = readFileSync(join(HERE, "..", "index.html"), "utf-8")
const BODY = INDEX_HTML.replace(/[\s\S]*<body[^>]*>/i, "").replace(/<\/body>[\s\S]*/i, "")
const MODULE_SOURCE = readFileSync(join(HERE, "..", "js", "EventManager.js"), "utf-8")

/** Every callback name in the § 17 contract, as a bag of spies. */
function makeCallbacks() {
  return {
    onStart: jest.fn(),
    onContinue: jest.fn(),
    onStartFresh: jest.fn(),
    onShowProgress: jest.fn(),
    onHome: jest.fn(),
    onBack: jest.fn(),
    onModeSelect: jest.fn(),
    onAnswerSelected: jest.fn(),
    onScaffoldContinue: jest.fn(),
    onShowTrail: jest.fn(),
    onShowMap: jest.fn(),
    onShowCollection: jest.fn(),
    onPlayAgain: jest.fn(),
    onSummaryHub: jest.fn(),
    onSettingsOpen: jest.fn(),
    onSettingsClose: jest.fn(),
    onSettingChange: jest.fn(),
    onTableToggle: jest.fn(),
  }
}

/** Real DOM nodes, keyed the way GameUI's element cache keys them. */
function makeMockUI() {
  const byId = (id) => document.getElementById(id)
  return {
    elements: {
      startButton: byId("start-button"),
      continueButton: byId("continue-button"),
      startFreshButton: byId("start-fresh-button"),
      homeButton: byId("home-button"),
      backButton: byId("back-button"),
      answerTiles: byId("answer-tiles"),
      scaffoldContinue: byId("scaffold-continue"),
      trailButton: byId("trail-button"),
      mapButton: byId("map-button"),
      collectionButton: byId("collection-button"),
      trailBackButton: byId("trail-back-button"),
      mapBackButton: byId("map-back-button"),
      collectionBackButton: byId("collection-back-button"),
      playAgainButton: byId("play-again-button"),
      summaryHubButton: byId("summary-hub-button"),
      settingsButton: byId("settings-button"),
      playSettingsButton: byId("play-settings-button"),
      closeSettings: byId("close-settings"),
      sessionLengthSelect: byId("session-length-select"),
    },
  }
}

/**
 * Render answer tiles the way GameUI.renderTiles does: `.answer-btn` buttons
 * with a `data-answer` value, the `ANSWER_KEYS` letter in `data-key`, a nested
 * label span, and deliberately no `data-correct` attribute.
 *
 * `data-key` is here for fidelity only. The shortcut resolves a tile by
 * position, not by reading the attribute back off the markup, so a tile with a
 * missing or wrong `data-key` is still selectable -- see the tests below.
 */
function renderTiles(values, { disabledIndex = -1, correctAttrs = false } = {}) {
  const container = document.getElementById("answer-tiles")
  container.textContent = ""
  values.forEach((value, index) => {
    const button = document.createElement("button")
    button.type = "button"
    button.className = index === disabledIndex ? "answer-btn disabled" : "answer-btn"
    button.dataset.answer = String(value)
    const key = ANSWER_KEYS[index]
    if (key) button.dataset.key = key.toUpperCase()
    if (correctAttrs) {
      // Deliberately lying attributes: nothing in EventManager may read them.
      button.dataset.correct = index === 0 ? "false" : "true"
    }
    const label = document.createElement("span")
    label.textContent = String(value)
    button.appendChild(label)
    container.appendChild(button)
  })
  return Array.from(container.querySelectorAll(".answer-btn"))
}

/** Put the play screen in the state a live question is asked in. */
function activatePlayScreen() {
  document.getElementById("title-screen").classList.remove("active")
  document.getElementById("play-screen").classList.add("active")
}

function pressKey(key, target = document, init = {}) {
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...init }))
}

function clickId(id) {
  document.getElementById(id).click()
}

describe("EventManager", () => {
  let manager
  let callbacks
  let mockUI
  let addListenerSpy

  beforeEach(() => {
    // setupKeyboardShortcuts listens on `document`, which survives a body swap,
    // so without this every test would inherit the previous tests' listeners.
    // The spy calls through, so listeners register normally and can be removed
    // by reference afterwards.
    addListenerSpy = jest.spyOn(document, "addEventListener")
    document.body.innerHTML = BODY
    callbacks = makeCallbacks()
    mockUI = makeMockUI()
    manager = new EventManager(mockUI, callbacks)
    manager.initializeEventListeners()
  })

  afterEach(() => {
    addListenerSpy.mock.calls.forEach(([type, handler, options]) => {
      document.removeEventListener(type, handler, options)
    })
    addListenerSpy.mockRestore()
  })

  describe("constructor", () => {
    test("keeps the ui and callbacks it was given", () => {
      expect(manager.ui).toBe(mockUI)
      expect(manager.callbacks).toBe(callbacks)
    })

    test("defaults callbacks to an empty object when omitted", () => {
      const bare = new EventManager(mockUI)
      expect(bare.callbacks).toEqual({})
    })

    test("does not throw when ui is null", () => {
      expect(() => new EventManager(null, {})).not.toThrow()
    })

    test("is stateless about answer processing", () => {
      expect(manager.resetAnswerProcessing).toBeUndefined()
      expect("isProcessingAnswer" in manager).toBe(false)
    })
  })

  describe("initializeEventListeners", () => {
    test("calls every setup method", () => {
      const fresh = new EventManager(mockUI, callbacks)
      const setupMethods = [
        "setupStartButton",
        "setupContinueButton",
        "setupStartFreshButton",
        "setupProgressButton",
        "setupHomeButton",
        "setupBackButton",
        "setupModeButtons",
        "setupAnswerTiles",
        "setupScaffoldContinue",
        "setupNavButtons",
        "setupSummaryButtons",
        "setupSettingsButtons",
        "setupSettingsControls",
        "setupSettingsDismiss",
        "setupKeyboardShortcuts",
      ]
      setupMethods.forEach((method) => {
        jest.spyOn(fresh, method).mockImplementation(() => {})
      })

      fresh.initializeEventListeners()

      setupMethods.forEach((method) => {
        expect(fresh[method]).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe("setupStartButton", () => {
    test("#start-button invokes onStart once", () => {
      clickId("start-button")
      expect(callbacks.onStart).toHaveBeenCalledTimes(1)
    })
  })

  describe("setupContinueButton", () => {
    test("#continue-button invokes onContinue once", () => {
      clickId("continue-button")
      expect(callbacks.onContinue).toHaveBeenCalledTimes(1)
    })
  })

  describe("setupProgressButton", () => {
    test("#progress-button invokes onShowProgress once", () => {
      clickId("progress-button")
      expect(callbacks.onShowProgress).toHaveBeenCalledTimes(1)
    })
  })

  describe("setupStartFreshButton", () => {
    test("#start-fresh-button invokes onStartFresh once", () => {
      clickId("start-fresh-button")
      expect(callbacks.onStartFresh).toHaveBeenCalledTimes(1)
    })
  })

  describe("setupHomeButton", () => {
    test("#home-button invokes onHome once", () => {
      clickId("home-button")
      expect(callbacks.onHome).toHaveBeenCalledTimes(1)
    })
  })

  describe("setupBackButton", () => {
    test("#back-button invokes onBack with its own screen id", () => {
      clickId("back-button")
      expect(callbacks.onBack).toHaveBeenCalledTimes(1)
      expect(callbacks.onBack).toHaveBeenCalledWith("play-screen")
    })
  })

  describe("setupModeButtons", () => {
    test("#mode-quick-recall invokes onModeSelect with its data-mode", () => {
      clickId("mode-quick-recall")
      expect(callbacks.onModeSelect).toHaveBeenCalledTimes(1)
      expect(callbacks.onModeSelect).toHaveBeenCalledWith("quick-recall")
    })
  })

  describe("setupAnswerTiles", () => {
    test("a tile click invokes onAnswerSelected with the value and the element", () => {
      const tiles = renderTiles([42, 36, 48, 49])
      tiles[0].click()
      expect(callbacks.onAnswerSelected).toHaveBeenCalledTimes(1)
      expect(callbacks.onAnswerSelected).toHaveBeenCalledWith(42, tiles[0])
    })

    test("passes exactly two arguments -- no correctness flag", () => {
      const tiles = renderTiles([42, 36, 48, 49])
      tiles[2].click()
      expect(callbacks.onAnswerSelected.mock.calls[0]).toHaveLength(2)
    })

    test("ignores a data-correct attribute entirely", () => {
      const tiles = renderTiles([42, 36], { correctAttrs: true })
      tiles[0].click()
      tiles[1].click()
      expect(callbacks.onAnswerSelected.mock.calls).toEqual([
        [42, tiles[0]],
        [36, tiles[1]],
      ])
    })

    test("the real markup ships no data-correct attribute", () => {
      expect(BODY).not.toContain("data-correct")
    })

    test("the module source never reads a correctness attribute", () => {
      expect(MODULE_SOURCE).not.toContain("dataset.correct")
      expect(MODULE_SOURCE).not.toContain('"data-correct"')
    })

    test("a non-numeric data-answer does not fire", () => {
      const tiles = renderTiles(["not-a-number"])
      tiles[0].click()
      expect(callbacks.onAnswerSelected).not.toHaveBeenCalled()
    })

    test("a click on the container background does not fire", () => {
      renderTiles([42, 36])
      document.getElementById("answer-tiles").click()
      expect(callbacks.onAnswerSelected).not.toHaveBeenCalled()
    })

    test("a click on a span nested inside a tile still fires with the tile", () => {
      const tiles = renderTiles([42, 36])
      tiles[1].querySelector("span").click()
      expect(callbacks.onAnswerSelected).toHaveBeenCalledWith(36, tiles[1])
    })

    test("tiles rendered after wiring still fire (delegation, not per-button binding)", () => {
      const first = renderTiles([42])
      first[0].click()
      const second = renderTiles([56])
      second[0].click()
      expect(callbacks.onAnswerSelected.mock.calls).toEqual([
        [42, first[0]],
        [56, second[0]],
      ])
    })

    test("two rapid clicks fire twice -- the double-submit guard lives in game.js", () => {
      const tiles = renderTiles([42, 36])
      tiles[0].click()
      tiles[0].click()
      expect(callbacks.onAnswerSelected).toHaveBeenCalledTimes(2)
    })
  })

  describe("setupScaffoldContinue", () => {
    test("#scaffold-continue invokes onScaffoldContinue once", () => {
      clickId("scaffold-continue")
      expect(callbacks.onScaffoldContinue).toHaveBeenCalledTimes(1)
    })
  })

  describe("setupNavButtons", () => {
    test("#trail-button invokes onShowTrail once", () => {
      clickId("trail-button")
      expect(callbacks.onShowTrail).toHaveBeenCalledTimes(1)
    })

    test("#map-button invokes onShowMap once", () => {
      clickId("map-button")
      expect(callbacks.onShowMap).toHaveBeenCalledTimes(1)
    })

    test("#collection-button invokes onShowCollection once", () => {
      clickId("collection-button")
      expect(callbacks.onShowCollection).toHaveBeenCalledTimes(1)
    })

    test("#trail-back-button invokes onBack with trail-screen", () => {
      clickId("trail-back-button")
      expect(callbacks.onBack).toHaveBeenCalledWith("trail-screen")
    })

    test("#map-back-button invokes onBack with map-screen", () => {
      clickId("map-back-button")
      expect(callbacks.onBack).toHaveBeenCalledWith("map-screen")
    })

    test("#collection-back-button invokes onBack with collection-screen", () => {
      clickId("collection-back-button")
      expect(callbacks.onBack).toHaveBeenCalledWith("collection-screen")
    })

    test("the four back buttons pass four distinguishable ids", () => {
      clickId("back-button")
      clickId("trail-back-button")
      clickId("map-back-button")
      clickId("collection-back-button")
      expect(callbacks.onBack.mock.calls).toEqual([
        ["play-screen"],
        ["trail-screen"],
        ["map-screen"],
        ["collection-screen"],
      ])
    })
  })

  describe("setupSummaryButtons", () => {
    test("#play-again-button invokes onPlayAgain once", () => {
      clickId("play-again-button")
      expect(callbacks.onPlayAgain).toHaveBeenCalledTimes(1)
    })

    test("#summary-hub-button invokes onSummaryHub once, not onBack", () => {
      clickId("summary-hub-button")
      expect(callbacks.onSummaryHub).toHaveBeenCalledTimes(1)
      expect(callbacks.onBack).not.toHaveBeenCalled()
    })
  })

  describe("setupSettingsButtons", () => {
    test("#settings-button invokes onSettingsOpen once", () => {
      clickId("settings-button")
      expect(callbacks.onSettingsOpen).toHaveBeenCalledTimes(1)
    })

    test("#play-settings-button invokes onSettingsOpen once", () => {
      clickId("play-settings-button")
      expect(callbacks.onSettingsOpen).toHaveBeenCalledTimes(1)
    })

    test("#close-settings invokes onSettingsClose once", () => {
      clickId("close-settings")
      expect(callbacks.onSettingsClose).toHaveBeenCalledTimes(1)
    })
  })

  describe("setupSettingsDismiss", () => {
    /** Open the settings dialog the way GameUI.showSettings does. */
    function openSettings() {
      document.getElementById("settings-modal").classList.remove("hidden")
    }

    test("Escape closes an open dialog", () => {
      openSettings()
      pressKey("Escape")
      expect(callbacks.onSettingsClose).toHaveBeenCalledTimes(1)
    })

    test("Escape does nothing while the dialog is closed", () => {
      // Keypad owns Escape as clear-all in this state, so EventManager must
      // stay out of the way or a stray Escape would "close" a dialog that is
      // not open and resume timers that were never paused.
      pressKey("Escape")
      expect(callbacks.onSettingsClose).not.toHaveBeenCalled()
    })

    test("other keys never close the dialog", () => {
      openSettings()
      for (const key of ["Enter", "Esc", "escape", "Backspace", "7"]) {
        pressKey(key)
      }
      expect(callbacks.onSettingsClose).not.toHaveBeenCalled()
    })

    test("Escape from inside the dialog closes it", () => {
      // The listener is on `document` rather than the dialog precisely because
      // focus can sit on the <select>, which swallows keys before an element
      // listener on the dialog would see them.
      openSettings()
      pressKey("Escape", document.getElementById("session-length-select"))
      expect(callbacks.onSettingsClose).toHaveBeenCalledTimes(1)
    })
  })

  describe("setupSettingsControls", () => {
    // Parsed to a NUMBER here: a <select> always yields a string, and
    // Settings.validate compares against the numbers in SESSION.LENGTH_OPTIONS,
    // so passing "30" through would be silently rejected.
    test("#session-length-select change invokes onSettingChange with a number", () => {
      const select = document.getElementById("session-length-select")
      select.value = "30"
      select.dispatchEvent(new Event("change"))
      expect(callbacks.onSettingChange).toHaveBeenCalledTimes(1)
      expect(callbacks.onSettingChange).toHaveBeenCalledWith("sessionLength", 30)
    })

    test("an unparseable session length invokes nothing", () => {
      const select = document.getElementById("session-length-select")
      const option = document.createElement("option")
      option.value = "lots"
      select.appendChild(option)
      select.value = "lots"
      select.dispatchEvent(new Event("change"))
      expect(callbacks.onSettingChange).not.toHaveBeenCalled()
    })

    test("the deleted selects are absent from the fixture", () => {
      expect(document.getElementById("input-mode-select")).toBeNull()
      expect(document.getElementById("scaffolds-select")).toBeNull()
      expect(document.getElementById("sound-select")).toBeNull()
      expect(document.getElementById("reduced-motion-select")).toBeNull()
      // Retired with the difficulty presets.
      expect(document.getElementById("difficulty-select")).toBeNull()
    })

    test("checking a table checkbox invokes onTableToggle with the number and true", () => {
      const checkbox = document.getElementById("table-7")
      checkbox.checked = true
      checkbox.dispatchEvent(new Event("change"))
      expect(callbacks.onTableToggle).toHaveBeenCalledTimes(1)
      expect(callbacks.onTableToggle).toHaveBeenCalledWith(7, true)
    })

    test("unchecking a table checkbox invokes onTableToggle with false", () => {
      const checkbox = document.getElementById("table-7")
      checkbox.checked = false
      checkbox.dispatchEvent(new Event("change"))
      expect(callbacks.onTableToggle).toHaveBeenCalledWith(7, false)
    })

    test("clicking the wrapping label produces the same call", () => {
      const label = document.querySelector('label.table-toggle[for="table-3"]')
      label.click()
      expect(callbacks.onTableToggle).toHaveBeenCalledTimes(1)
      expect(callbacks.onTableToggle).toHaveBeenCalledWith(3, true)
    })

    test("all eight table checkboxes are wired", () => {
      for (let table = 2; table <= 9; table += 1) {
        const checkbox = document.getElementById(`table-${table}`)
        checkbox.checked = true
        checkbox.dispatchEvent(new Event("change"))
      }
      expect(callbacks.onTableToggle.mock.calls).toEqual([
        [2, true],
        [3, true],
        [4, true],
        [5, true],
        [6, true],
        [7, true],
        [8, true],
        [9, true],
      ])
    })
  })

  describe("setupKeyboardShortcuts", () => {
    beforeEach(() => {
      activatePlayScreen()
    })

    test("pressing b clicks the second tile", () => {
      const tiles = renderTiles([42, 36, 48, 49])
      pressKey("b")
      expect(callbacks.onAnswerSelected).toHaveBeenCalledTimes(1)
      expect(callbacks.onAnswerSelected).toHaveBeenCalledWith(36, tiles[1])
    })

    test("a and d map to the first and last tiles", () => {
      const tiles = renderTiles([42, 36, 48, 49])
      pressKey("a")
      pressKey("d")
      expect(callbacks.onAnswerSelected.mock.calls).toEqual([
        [42, tiles[0]],
        [49, tiles[3]],
      ])
    })

    test("every ANSWER_KEYS letter maps to its own tile, in order", () => {
      const tiles = renderTiles([42, 36, 48, 49])
      ANSWER_KEYS.forEach((key) => pressKey(key))
      expect(callbacks.onAnswerSelected.mock.calls).toEqual(
        tiles.map((tile) => [Number(tile.dataset.answer), tile]),
      )
    })

    test("uppercase letters work too, so Shift or caps lock is not a trap", () => {
      const tiles = renderTiles([42, 36, 48, 49])
      pressKey("C", document, { shiftKey: true })
      expect(callbacks.onAnswerSelected).toHaveBeenCalledWith(48, tiles[2])
    })

    test("pressing e does nothing", () => {
      renderTiles([42, 36, 48, 49])
      pressKey("e")
      expect(callbacks.onAnswerSelected).not.toHaveBeenCalled()
    })

    // The whole point of the move off `1`-`4`: on a screen where every tile face
    // is a number, a digit has to mean a digit.
    test.each(["1", "2", "3", "4", "7", "0"])("pressing the digit %s clicks no tile", (digit) => {
      renderTiles([42, 36, 48, 49])
      pressKey(digit)
      expect(callbacks.onAnswerSelected).not.toHaveBeenCalled()
    })

    test.each([
      ["meta", { metaKey: true }],
      ["ctrl", { ctrlKey: true }],
      ["alt", { altKey: true }],
    ])("a %s-modified letter is left to the browser", (_name, init) => {
      renderTiles([42, 36, 48, 49])
      pressKey("a", document, init)
      expect(callbacks.onAnswerSelected).not.toHaveBeenCalled()
    })

    test("a fifth tile has no letter, so no key reaches it", () => {
      // generateOptions clamps `count` to [2, 8], so more tiles than letters is
      // reachable; the extra tiles are tap-only rather than mislabelled.
      const tiles = renderTiles([42, 36, 48, 49, 54])
      expect(tiles[4].dataset.key).toBeUndefined()
      ANSWER_KEYS.forEach((key) => pressKey(key))
      expect(callbacks.onAnswerSelected).toHaveBeenCalledTimes(ANSWER_KEYS.length)
      expect(callbacks.onAnswerSelected).not.toHaveBeenCalledWith(54, tiles[4])
    })

    test("two tiles: the letters past the end select nothing", () => {
      const tiles = renderTiles([42, 36])
      pressKey("c")
      pressKey("d")
      expect(callbacks.onAnswerSelected).not.toHaveBeenCalled()
      pressKey("a")
      expect(callbacks.onAnswerSelected).toHaveBeenCalledWith(42, tiles[0])
    })

    test("does nothing when #play-screen is not active", () => {
      renderTiles([42, 36, 48, 49])
      document.getElementById("play-screen").classList.remove("active")
      pressKey("b")
      expect(callbacks.onAnswerSelected).not.toHaveBeenCalled()
    })

    test("does nothing when #settings-modal is open over the play screen", () => {
      renderTiles([42, 36, 48, 49])
      document.getElementById("settings-modal").classList.remove("hidden")
      pressKey("b")
      expect(callbacks.onAnswerSelected).not.toHaveBeenCalled()
    })

    test("does nothing when the keypad is the active affordance", () => {
      renderTiles([42, 36, 48, 49])
      document.getElementById("answer-tiles").classList.add("hidden")
      document.getElementById("keypad").classList.remove("hidden")
      pressKey("b")
      expect(callbacks.onAnswerSelected).not.toHaveBeenCalled()
    })

    test("works again once the tiles are the visible affordance", () => {
      const tiles = renderTiles([42, 36, 48, 49])
      const tileContainer = document.getElementById("answer-tiles")
      tileContainer.classList.add("hidden")
      pressKey("b")
      expect(callbacks.onAnswerSelected).not.toHaveBeenCalled()

      tileContainer.classList.remove("hidden")
      pressKey("b")
      expect(callbacks.onAnswerSelected).toHaveBeenCalledWith(36, tiles[1])
    })

    test("does nothing when the event target is an input", () => {
      renderTiles([42, 36, 48, 49])
      const input = document.createElement("input")
      document.getElementById("play-screen").appendChild(input)
      pressKey("b", input)
      expect(callbacks.onAnswerSelected).not.toHaveBeenCalled()
    })

    test("does nothing when the event target is a select", () => {
      renderTiles([42, 36, 48, 49])
      pressKey("b", document.getElementById("session-length-select"))
      expect(callbacks.onAnswerSelected).not.toHaveBeenCalled()
    })

    test("does not click a .disabled tile", () => {
      renderTiles([42, 36, 48, 49], { disabledIndex: 1 })
      pressKey("b")
      expect(callbacks.onAnswerSelected).not.toHaveBeenCalled()
    })

    test("does nothing when no tiles are rendered", () => {
      expect(() => pressKey("b")).not.toThrow()
      expect(callbacks.onAnswerSelected).not.toHaveBeenCalled()
    })
  })

  /**
   * The two `document` keydown listeners in the game, exercised together.
   *
   * They used to share the digits: this class took `1`-`4` for the tiles and
   * `Keypad` takes `0`-`9` for the entry buffer, kept apart only by which
   * affordance was visible. The letters make them disjoint, which leaves one
   * question worth pinning down -- where a digit goes on a tile question now
   * that nothing here consumes it.
   */
  describe("coexistence with the keypad", () => {
    let keypad

    beforeEach(() => {
      activatePlayScreen()
      keypad = new Keypad(document.getElementById("keypad"))
      keypad.render()
      keypad.attach()
      // What game.js does on every render of a tile question:
      // `keypad.setEnabled(challenge.entry === INPUT_MODE.KEYPAD)`.
      keypad.setEnabled(false)
      renderTiles([42, 36, 48, 49])
    })

    afterEach(() => {
      keypad.destroy()
    })

    test("a digit on a tile question is inert -- no tile, and no entry either", () => {
      pressKey("4")
      pressKey("2")
      expect(callbacks.onAnswerSelected).not.toHaveBeenCalled()
      expect(keypad.value).toBe("")
    })

    test("a letter on a tile question reaches the tile and types nothing", () => {
      pressKey("b")
      expect(callbacks.onAnswerSelected).toHaveBeenCalledTimes(1)
      expect(keypad.value).toBe("")
    })

    test("a letter on a keypad question types nothing and clicks nothing", () => {
      document.getElementById("answer-tiles").classList.add("hidden")
      document.getElementById("keypad").classList.remove("hidden")
      keypad.setEnabled(true)
      pressKey("b")
      expect(callbacks.onAnswerSelected).not.toHaveBeenCalled()
      expect(keypad.value).toBe("")
    })

    test("a digit on a keypad question still builds the entry", () => {
      document.getElementById("answer-tiles").classList.add("hidden")
      document.getElementById("keypad").classList.remove("hidden")
      keypad.setEnabled(true)
      pressKey("4")
      pressKey("2")
      expect(keypad.value).toBe("42")
      expect(callbacks.onAnswerSelected).not.toHaveBeenCalled()
    })
  })

  describe("missing elements", () => {
    test("wiring an empty document does not throw", () => {
      document.body.innerHTML = ""
      const bare = new EventManager({ elements: {} }, callbacks)
      expect(() => bare.initializeEventListeners()).not.toThrow()
    })

    test("a keydown against an empty document does not throw", () => {
      document.body.innerHTML = ""
      const bare = new EventManager({ elements: {} }, callbacks)
      bare.initializeEventListeners()
      expect(() => pressKey("2")).not.toThrow()
      expect(callbacks.onAnswerSelected).not.toHaveBeenCalled()
    })

    test("a null ui does not throw while wiring", () => {
      const bare = new EventManager(null, callbacks)
      expect(() => bare.initializeEventListeners()).not.toThrow()
    })
  })

  describe("missing callbacks", () => {
    const controlIds = [
      "start-button",
      "continue-button",
      "start-fresh-button",
      "progress-button",
      "home-button",
      "back-button",
      "mode-quick-recall",
      "scaffold-continue",
      "trail-button",
      "map-button",
      "collection-button",
      "trail-back-button",
      "map-back-button",
      "collection-back-button",
      "play-again-button",
      "summary-hub-button",
      "settings-button",
      "play-settings-button",
      "close-settings",
    ]

    /** Exercise every wired affordance on a manager built without callbacks. */
    function interactWithEverything() {
      controlIds.forEach(clickId)
      const select = document.getElementById("session-length-select")
      select.value = "10"
      select.dispatchEvent(new Event("change"))
      const checkbox = document.getElementById("table-6")
      checkbox.checked = true
      checkbox.dispatchEvent(new Event("change"))
      const tiles = renderTiles([42, 36, 48, 49])
      tiles[0].click()
      activatePlayScreen()
      pressKey("c")
    }

    test("no second argument at all: every interaction is a silent no-op", () => {
      document.body.innerHTML = BODY
      const bare = new EventManager(makeMockUI())
      bare.initializeEventListeners()
      expect(() => interactWithEverything()).not.toThrow()
    })

    test("an empty callbacks object: every interaction is a silent no-op", () => {
      document.body.innerHTML = BODY
      const bare = new EventManager(makeMockUI(), {})
      bare.initializeEventListeners()
      expect(() => interactWithEverything()).not.toThrow()
    })
  })
})

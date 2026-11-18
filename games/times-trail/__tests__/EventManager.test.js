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

const HERE = dirname(fileURLToPath(import.meta.url))
const INDEX_HTML = readFileSync(join(HERE, "..", "index.html"), "utf-8")
const BODY = INDEX_HTML.replace(/[\s\S]*<body[^>]*>/i, "").replace(/<\/body>[\s\S]*/i, "")

/** Every callback name in the § 17 contract, as a bag of spies. */
function makeCallbacks() {
  return {
    onStart: jest.fn(),
    onContinue: jest.fn(),
    onStartFresh: jest.fn(),
    onShowProgress: jest.fn(),
    onHome: jest.fn(),
    onBack: jest.fn(),
    onScaffoldContinue: jest.fn(),
    onStartTrail: jest.fn(),
    onShowMap: jest.fn(),
    onShowCollection: jest.fn(),
    onPlayAgain: jest.fn(),
    onSummaryHub: jest.fn(),
    onSettingsOpen: jest.fn(),
    onSettingsClose: jest.fn(),
    onSettingChange: jest.fn(),
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
      scaffoldContinue: byId("scaffold-continue"),
      mapButton: byId("map-button"),
      collectionButton: byId("collection-button"),
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
    // setupSettingsDismiss listens on `document`, which survives a body swap,
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
        "setupScaffoldContinue",
        "setupNavButtons",
        "setupTrailPicker",
        "setupSummaryButtons",
        "setupSettingsButtons",
        "setupSettingsControls",
        "setupSettingsDismiss",
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

  describe("setupScaffoldContinue", () => {
    test("#scaffold-continue invokes onScaffoldContinue once", () => {
      clickId("scaffold-continue")
      expect(callbacks.onScaffoldContinue).toHaveBeenCalledTimes(1)
    })
  })

  describe("setupNavButtons", () => {
    test("#map-button invokes onShowMap once", () => {
      clickId("map-button")
      expect(callbacks.onShowMap).toHaveBeenCalledTimes(1)
    })

    test("#collection-button invokes onShowCollection once", () => {
      clickId("collection-button")
      expect(callbacks.onShowCollection).toHaveBeenCalledTimes(1)
    })

    test("#map-back-button invokes onBack with map-screen", () => {
      clickId("map-back-button")
      expect(callbacks.onBack).toHaveBeenCalledWith("map-screen")
    })

    test("#collection-back-button invokes onBack with collection-screen", () => {
      clickId("collection-back-button")
      expect(callbacks.onBack).toHaveBeenCalledWith("collection-screen")
    })

    test("the three back buttons pass three distinguishable ids", () => {
      clickId("back-button")
      clickId("map-back-button")
      clickId("collection-back-button")
      expect(callbacks.onBack.mock.calls).toEqual([
        ["play-screen"],
        ["map-screen"],
        ["collection-screen"],
      ])
    })
  })

  describe("setupTrailPicker", () => {
    /** Rows are rebuilt on every render, so add them after wiring, as GameUI does. */
    function addRow(id) {
      const row = document.createElement("button")
      row.dataset.trailId = id
      const label = document.createElement("span")
      row.appendChild(label)
      document.getElementById("trail-spaces").appendChild(row)
      return { row, label }
    }

    test("clicking a trail row, or anything inside it, invokes onStartTrail with its id", () => {
      const squares = addRow("squares")
      squares.row.click()
      squares.label.click()
      expect(callbacks.onStartTrail.mock.calls).toEqual([["squares"], ["squares"]])
    })

    test("a click on the container outside any row starts nothing", () => {
      document.getElementById("trail-spaces").click()
      expect(callbacks.onStartTrail).not.toHaveBeenCalled()
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

    // Escape with a modifier belongs to the browser or OS.
    test.each(["metaKey", "ctrlKey", "altKey"])("Escape with %s held does not close it", (mod) => {
      openSettings()
      pressKey("Escape", document, { [mod]: true })
      expect(callbacks.onSettingsClose).not.toHaveBeenCalled()
    })

    // The help overlay sits on top of the dialog and shared/nav.js does not stop
    // propagation, so one Escape would otherwise dismiss both layers.
    test("Escape leaves the dialog alone while the help overlay is open", () => {
      openSettings()
      window.__helpOverlayIsOpen = () => true
      try {
        pressKey("Escape")
        expect(callbacks.onSettingsClose).not.toHaveBeenCalled()
      } finally {
        delete window.__helpOverlayIsOpen
      }
      pressKey("Escape")
      expect(callbacks.onSettingsClose).toHaveBeenCalledTimes(1)
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
      expect(() => pressKey("Escape")).not.toThrow()
      expect(callbacks.onSettingsClose).not.toHaveBeenCalled()
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
      "scaffold-continue",
      "map-button",
      "collection-button",
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
      pressKey("Escape")
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

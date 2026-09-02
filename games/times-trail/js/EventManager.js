/**
 * Event wiring for Times Trail.
 *
 * Purpose: attach every DOM listener the game needs and translate each event
 * into a call on a callback supplied by `game.js`. There is no game logic here
 * and no state at all -- this class reads the DOM, never the model.
 *
 * Architecture: one `setupXButton()` method per control, each null-guarding both
 * its element and its callback before invoking, all driven from a single
 * `initializeEventListeners()`. Elements are looked up through `ui.elements`
 * when the cache has them and `document.getElementById` otherwise, so the class
 * works against a bare `{ elements: {} }` stub as well as a real `GameUI`.
 *
 * Statelessness: this class holds no `isProcessingAnswer` flag and exposes no
 * `resetAnswerProcessing()`. The double-submit guard lives in `game.js`, at the
 * single point where the answer paths converge.
 * Guarding only the tile path here left the other two unguarded, so the same
 * question could be answered twice while feedback was on screen.
 *
 * Correctness: `EventManager` never decides whether an answer is right. It
 * reports the tapped value and the tapped element; `game.js` asks
 * `challenge.check()`. Nothing here reads a `data-correct` attribute -- the
 * markup does not carry one, and an answer key in the page is both a second
 * source of truth and readable by anyone who opens the inspector.
 */

import { ANSWER_KEYS } from "./constants.js"

/**
 * @typedef {Object} EventCallbacks
 * @property {() => void} [onStart]
 * @property {() => void} [onContinue]
 * @property {() => void} [onShowProgress]
 * @property {() => void} [onStartFresh]
 * @property {() => void} [onHome]
 * @property {(sourceScreenId: string) => void} [onBack]
 * @property {(modeId: string) => void} [onModeSelect]
 * @property {(answer: number, buttonEl: HTMLElement) => void} [onAnswerSelected]
 * @property {() => void} [onScaffoldContinue]
 * @property {() => void} [onShowTrail]
 * @property {() => void} [onShowMap]
 * @property {() => void} [onShowCollection]
 * @property {() => void} [onPlayAgain]
 * @property {() => void} [onSummaryHub]
 * @property {() => void} [onSettingsOpen]
 * @property {() => void} [onSettingsClose]
 * @property {(key: string, value: string) => void} [onSettingChange]
 * @property {(table: number, checked: boolean) => void} [onTableToggle]
 */

/** Tags whose own keyboard behavior must never be hijacked. */
const TEXT_ENTRY_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"])

export class EventManager {
  /**
   * @param {Object|null} ui - GameUI instance (or any object with an `elements` map)
   * @param {EventCallbacks} [callbacks] - Defaults to `{}`; every callback is optional
   */
  constructor(ui, callbacks = {}) {
    /** @type {Object|null} The UI whose `elements` cache is consulted first. */
    this.ui = ui
    /** @type {EventCallbacks} Never undefined, so every `this.callbacks.x` guard is safe. */
    this.callbacks = callbacks || {}
  }

  /**
   * Attach every listener. Safe to call against an empty document: each setup
   * method returns early when its element is missing.
   *
   * @returns {void}
   */
  initializeEventListeners() {
    this.setupStartButton()
    this.setupContinueButton()
    this.setupStartFreshButton()
    this.setupProgressButton()
    this.setupHomeButton()
    this.setupBackButton()
    this.setupModeButtons()
    this.setupAnswerTiles()
    this.setupScaffoldContinue()
    this.setupNavButtons()
    this.setupSummaryButtons()
    this.setupSettingsButtons()
    this.setupSettingsControls()
    this.setupSettingsDismiss()
    this.setupKeyboardShortcuts()
  }

  /**
   * Resolve an element from the UI's cache, falling back to the document.
   *
   * @private
   * @param {string} cacheKey - Property name on `ui.elements`
   * @param {string} elementId - DOM id to fall back to
   * @returns {HTMLElement|null}
   */
  _element(cacheKey, elementId) {
    const elements = this.ui && this.ui.elements ? this.ui.elements : null
    const cached = elements ? elements[cacheKey] : null
    return cached || document.getElementById(elementId)
  }

  /**
   * Invoke a callback if it was supplied. A missing callback is a silent no-op.
   *
   * @private
   * @param {string} name - Callback name on `this.callbacks`
   * @param {...*} args - Arguments to forward
   * @returns {void}
   */
  _invoke(name, ...args) {
    if (this.callbacks[name]) {
      this.callbacks[name](...args)
    }
  }

  /**
   * Wire one element's `click` to one argument-less callback.
   *
   * @private
   * @param {string} cacheKey - Property name on `ui.elements`
   * @param {string} elementId - DOM id
   * @param {string} callbackName - Callback to invoke on click
   * @returns {void}
   */
  _wireClick(cacheKey, elementId, callbackName) {
    const element = this._element(cacheKey, elementId)
    if (!element) return
    element.addEventListener("click", () => {
      this._invoke(callbackName)
    })
  }

  /**
   * Wire one back button to `onBack`, passing the id of the screen it leaves.
   * The id is read from the button's own `.screen` ancestor so `game.js` can
   * route without inspecting which screen happens to be active.
   *
   * @private
   * @param {string} cacheKey - Property name on `ui.elements`
   * @param {string} elementId - DOM id of the back button
   * @param {string} fallbackScreenId - Used when the button has no `.screen` ancestor
   * @returns {void}
   */
  _wireBackButton(cacheKey, elementId, fallbackScreenId) {
    const button = this._element(cacheKey, elementId)
    if (!button) return
    button.addEventListener("click", (event) => {
      const screen = event.currentTarget.closest(".screen")
      this._invoke("onBack", screen && screen.id ? screen.id : fallbackScreenId)
    })
  }

  /** Wires `#start-button` to `onStart`. @returns {void} */
  setupStartButton() {
    this._wireClick("startButton", "start-button", "onStart")
  }

  /** Wires `#progress-button` to `onShowProgress`. @returns {void} */
  setupProgressButton() {
    this._wireClick("progressButton", "progress-button", "onShowProgress")
  }

  /** Wires `#continue-button` to `onContinue`. @returns {void} */
  setupContinueButton() {
    this._wireClick("continueButton", "continue-button", "onContinue")
  }

  /** Wires `#start-fresh-button` to `onStartFresh`. @returns {void} */
  setupStartFreshButton() {
    this._wireClick("startFreshButton", "start-fresh-button", "onStartFresh")
  }

  /** Wires `#home-button` to `onHome`. @returns {void} */
  setupHomeButton() {
    this._wireClick("homeButton", "home-button", "onHome")
  }

  /** Wires the play screen's `#back-button` to `onBack("play-screen")`. @returns {void} */
  setupBackButton() {
    this._wireBackButton("backButton", "back-button", "play-screen")
  }

  /**
   * Wires each `.mode-button` to `onModeSelect(dataset.mode)`. The mode buttons
   * are static markup with no writer -- there is one today -- so a single
   * listener each is enough, and a nested element inside a button still resolves
   * via `currentTarget`.
   *
   * @returns {void}
   */
  setupModeButtons() {
    const buttons = document.querySelectorAll(".mode-button")
    buttons.forEach((button) => {
      button.addEventListener("click", (event) => {
        const modeId = event.currentTarget.dataset.mode
        if (!modeId) return
        this._invoke("onModeSelect", modeId)
      })
    })
  }

  /**
   * Wires `#answer-tiles` to `onAnswerSelected(answer, buttonEl)` by delegation.
   * Tiles are re-rendered every question, so per-button listeners would leak.
   * The tapped value comes from `data-answer`; a non-numeric value does not
   * fire. Correctness is `game.js`'s call, so no third argument is passed.
   *
   * @returns {void}
   */
  setupAnswerTiles() {
    const container = this._element("answerTiles", "answer-tiles")
    if (!container) return
    container.addEventListener("click", (event) => {
      const tile = event.target.closest(".answer-btn")
      if (!tile || !container.contains(tile)) return
      const answer = parseInt(tile.dataset.answer, 10)
      if (Number.isNaN(answer)) return
      this._invoke("onAnswerSelected", answer, tile)
    })
  }

  /** Wires `#scaffold-continue` ("Got it") to `onScaffoldContinue`. @returns {void} */
  setupScaffoldContinue() {
    this._wireClick("scaffoldContinue", "scaffold-continue", "onScaffoldContinue")
  }

  /**
   * Wires the three hub nav buttons to their show callbacks and the three list
   * screens' back buttons to `onBack`, each carrying its own screen id.
   *
   * @returns {void}
   */
  setupNavButtons() {
    this._wireClick("trailButton", "trail-button", "onShowTrail")
    this._wireClick("mapButton", "map-button", "onShowMap")
    this._wireClick("collectionButton", "collection-button", "onShowCollection")
    this._wireBackButton("trailBackButton", "trail-back-button", "trail-screen")
    this._wireBackButton("mapBackButton", "map-back-button", "map-screen")
    this._wireBackButton("collectionBackButton", "collection-back-button", "collection-screen")
  }

  /**
   * Wires `#play-again-button` to `onPlayAgain` and `#summary-hub-button` to
   * `onSummaryHub` -- its own named callback, not a reuse of `onBack`.
   *
   * @returns {void}
   */
  setupSummaryButtons() {
    this._wireClick("playAgainButton", "play-again-button", "onPlayAgain")
    this._wireClick("summaryHubButton", "summary-hub-button", "onSummaryHub")
  }

  /**
   * Wires both settings entry points (`#settings-button` on the hub,
   * `#play-settings-button` on the play screen) to `onSettingsOpen`, and
   * `#close-settings` to `onSettingsClose`.
   *
   * @returns {void}
   */
  setupSettingsButtons() {
    this._wireClick("settingsButton", "settings-button", "onSettingsOpen")
    this._wireClick("playSettingsButton", "play-settings-button", "onSettingsOpen")
    this._wireClick("closeSettings", "close-settings", "onSettingsClose")
  }

  /**
   * Wires the only two kinds of settings control that exist: each `[data-table]`
   * checkbox to `onTableToggle(table, checked)` and `#session-length-select` to
   * `onSettingChange("sessionLength", value)`. The visible toggle is a `<label>`
   * wrapping the checkbox, so a tap on its 68px face produces a normal `change`
   * event on the input and needs no extra click handling.
   *
   * The select's value is parsed here rather than in `Settings`, because a
   * `<select>` always yields a string and `Settings.validate` compares against
   * the numbers in `SESSION.LENGTH_OPTIONS`.
   *
   * @returns {void}
   */
  setupSettingsControls() {
    const checkboxes = document.querySelectorAll('input[type="checkbox"][data-table]')
    checkboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", (event) => {
        const table = parseInt(event.target.dataset.table, 10)
        if (Number.isNaN(table)) return
        this._invoke("onTableToggle", table, event.target.checked)
      })
    })

    const sessionLengthSelect = this._element("sessionLengthSelect", "session-length-select")
    if (sessionLengthSelect) {
      sessionLengthSelect.addEventListener("change", (event) => {
        const length = parseInt(event.target.value, 10)
        if (Number.isNaN(length)) return
        this._invoke("onSettingChange", "sessionLength", length)
      })
    }
  }

  /**
   * Wires `Escape` to `onSettingsClose` while the settings dialog is open.
   *
   * `#settings-modal` is a real `aria-modal` dialog with a focus trap, and
   * Escape is what closes one of those everywhere else; without this the Done
   * button was the only way out, which is a trap for a keyboard user and a
   * surprise for everyone else. The listener is on `document` rather than the
   * dialog because focus can sit on the dialog's `<select>`, whose own key
   * handling swallows the event before it reaches an element listener.
   *
   * There is no conflict with `Keypad`, which owns Escape as clear-all: its
   * `handleKeyDown` bails while the modal is open, so exactly one of the two
   * acts on any given press. `game.js` resumes the paused scaffold countdown
   * from `closeSettings`, so this exit is the same exit the Done button takes.
   *
   * @returns {void}
   */
  setupSettingsDismiss() {
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return
      const modal = document.getElementById("settings-modal")
      if (!modal || modal.classList.contains("hidden")) return
      event.preventDefault()
      this._invoke("onSettingsClose")
    })
  }

  /**
   * Report whether answer tiles are the affordance the player is currently
   * looking at. This is the guard shared with `Keypad.handleKeyDown` (the
   * `#play-screen` active / `#settings-modal` hidden pair) plus one extra term:
   * `#answer-tiles` must itself be visible.
   *
   * The extra term still matters now that the two `document` keydown listeners
   * no longer share a key space. `renderQuestion` shows exactly one affordance,
   * and a tile left in the DOM from an earlier question is only hidden, not
   * removed, until the next render clears it -- so without this term an `A`
   * pressed on a keypad question could click a tile that is not on screen.
   *
   * @private
   * @returns {boolean} True when A-D should select a tile
   */
  _isTileEntryActive() {
    const playScreen = document.getElementById("play-screen")
    const modal = document.getElementById("settings-modal")
    const tiles = document.getElementById("answer-tiles")
    const active = Boolean(playScreen && playScreen.classList.contains("active"))
    const modalOpen = Boolean(modal && !modal.classList.contains("hidden"))
    const tilesShowing = Boolean(tiles && !tiles.classList.contains("hidden"))
    return active && !modalOpen && tilesShowing
  }

  /**
   * Wires one `document` `keydown` listener so the `ANSWER_KEYS` letters (`a` to
   * `d`, either case) click the matching answer tile. Gated by
   * `_isTileEntryActive()`, skipped when the event target is a text-entry
   * element, and skipped when a modifier is held so browser and OS shortcuts
   * (⌘D, ⌃A) still work.
   *
   * Letters rather than digits: see `ANSWER_KEYS`. The two keyboards are now
   * disjoint, which is the point -- digits mean digits and letters mean tiles,
   * so neither listener has to reason about what the other one is doing.
   * Digit/Enter/Backspace handling for the keypad belongs to
   * `Keypad.handleKeyDown` and is deliberately not duplicated. A digit pressed
   * on a tile question reaches that handler and stops there: `game.js` calls
   * `keypad.setEnabled(challenge.entry === INPUT_MODE.KEYPAD)` on every render,
   * so on a tile question the pad is disabled and `handleKeyDown` bails before
   * it touches the buffer. Nothing is typed into an entry that has no submit.
   *
   * @returns {void}
   */
  setupKeyboardShortcuts() {
    document.addEventListener("keydown", (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const index = ANSWER_KEYS.indexOf(String(event.key).toLowerCase())
      if (index === -1) return
      if (!this._isTileEntryActive()) return
      const target = event.target
      if (target && TEXT_ENTRY_TAGS.has(target.tagName)) return

      event.preventDefault()
      const tiles = document.querySelectorAll("#answer-tiles .answer-btn")
      const tile = tiles[index]
      if (!tile || tile.classList.contains("disabled")) return
      tile.click()
    })
  }
}

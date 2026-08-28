/**
 * Times Trail's in-page numeric keypad.
 *
 * Why this exists at all: on an iPad the system keyboard covers roughly half the
 * screen and scrolls the page to keep the focused field visible, so a question
 * that was centred a moment ago jumps out from under the child's finger. The
 * only reliable way to avoid that is to never give iOS anything to focus -- so
 * the game contains no `<input>`, no `<textarea>`, and no `contenteditable`
 * anywhere. Answers are typed on this drawn-in-page pad instead: twelve large
 * `<button>` elements (digits 1-9, backspace, 0, enter) laid out 3x4 by CSS, with
 * the current entry echoed into `#answer-display` by whoever supplies the
 * `onChange` callback.
 *
 * Architecture: the class owns a digit buffer (a string) and reports it two
 * ways -- `value` (raw, `""` when empty) and `display` (`KEYPAD.EMPTY_DISPLAY`
 * when empty). It never reads game state and has no opinion about whether it
 * *should* be usable: `game.js` calls `setEnabled(challenge.entry === "keypad")`
 * on every question render and `setEnabled(false)` the moment an answer is
 * accepted, which is what stops a hidden or already-answered question from
 * taking a second answer. The buffer transitions are reachable without the DOM
 * (`handleKeyDown`, the getters, `clear`), so the logic is testable directly.
 *
 * The `⌫` key deletes ONE digit. It has to: that glyph means backspace
 * everywhere else a child has seen it, and a two-digit answer typed with the
 * second digit wrong is the common mistake -- clearing both then made her retype
 * a digit she had got right. `Escape` on a physical keyboard is the only
 * clear-all, because it is the only key with nothing equivalent on the pad.
 *
 * Timing: `onChange` fires on every accepted digit press and every backspace or
 * clear press, and that is the hook `game.js` uses to stamp thinking time -- the
 * *first* `onChange` after a question renders is the first interaction. The
 * mastery clock therefore stops at the first keypress, not at the enter tap, so
 * typing two digits costs no more measured time than a single tile tap. An enter
 * press on an empty buffer is ignored entirely and fires nothing, so tapping the
 * check mark before typing does not start the clock.
 *
 * Enter does NOT clear the buffer. Her digits stay on screen until `game.js`
 * calls `clear()` from the next question render, so a correct answer can be
 * painted green where she typed it instead of vanishing into a "?" the instant
 * she is told she was right. Note that `clear()` fires `onChange`; `game.js`
 * calls it during render and resets its own first-interaction stamp afterwards
 * (see the render order in the spec's § 18).
 *
 * Security Note: builds its DOM with `document.createElement` and `textContent`
 * only -- no `innerHTML`, so nothing typed can be interpreted as markup.
 */

import { KEYPAD } from "./constants.js"

/**
 * Glyph shown on the two non-digit keys. Digits use their own key string.
 *
 * @type {Readonly<Object<string, string>>}
 */
const KEY_FACES = Object.freeze({
  [KEYPAD.BACKSPACE_KEY]: "⌫",
  [KEYPAD.ENTER_KEY]: "✓",
})

/**
 * Accessible name for the two non-digit keys. Digits are their own name.
 *
 * @type {Readonly<Object<string, string>>}
 */
const KEY_LABELS = Object.freeze({
  [KEYPAD.BACKSPACE_KEY]: "Backspace",
  [KEYPAD.ENTER_KEY]: "Enter",
})

/**
 * Extra class applied to the two non-digit keys, so CSS can size and colour
 * them differently from the digits.
 *
 * The backspace key's class is still `keypad-key-clear`, which is what
 * `styles/main.css` styles. The class name is stale rather than wrong -- it
 * only sets a colour -- and renaming it is a stylesheet change, not a behaviour
 * one, so it is left for the styles pass.
 *
 * @type {Readonly<Object<string, string>>}
 */
const KEY_MODIFIERS = Object.freeze({
  [KEYPAD.BACKSPACE_KEY]: "keypad-key-clear",
  [KEYPAD.ENTER_KEY]: "keypad-key-enter",
})

/** Elements whose native keyboard behaviour must not be hijacked. */
const PASSTHROUGH_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"])

/** Matches a single digit character. */
const DIGIT = /^[0-9]$/

/** Physical keys that mean "delete the last digit", matching the `⌫` face. */
const BACKSPACE_KEYS = new Set(["Backspace", "Delete"])

/**
 * Physical keys that mean "drop the whole entry". Escape only: it is the one
 * key with no equivalent on the pad, so it is where clear-all lives.
 */
const CLEAR_KEYS = new Set(["Escape"])

export class Keypad {
  /**
   * @param {HTMLElement|null} container - Element the keypad is rendered into; its
   *   contents are replaced by `render()`. A missing container is tolerated: the
   *   DOM methods become no-ops and only the keyboard fallback stays live.
   * @param {Object} [options] - Optional callbacks and limits.
   * @param {(value: number) => void} [options.onSubmit] - Fired on enter with a
   *   non-empty entry, as a Number. Missing is a no-op, never a throw.
   * @param {(display: string) => void} [options.onChange] - Fired after every
   *   accepted digit press and every clear, with `display` (so
   *   `KEYPAD.EMPTY_DISPLAY` when the buffer is empty). Missing is a no-op.
   * @param {number} [options.maxDigits] - Longest entry accepted. Defaults to
   *   `KEYPAD.MAX_DIGITS` (2 -- the largest product in the game is 81).
   */
  constructor(container, options = {}) {
    /** @private @type {HTMLElement|null} */
    this._container = container || null

    /** @private @type {((value: number) => void)|null} */
    this._onSubmit = typeof options.onSubmit === "function" ? options.onSubmit : null

    /** @private @type {((display: string) => void)|null} */
    this._onChange = typeof options.onChange === "function" ? options.onChange : null

    /** @private @type {number} */
    this._maxDigits =
      Number.isInteger(options.maxDigits) && options.maxDigits > 0
        ? options.maxDigits
        : KEYPAD.MAX_DIGITS

    /** @private @type {string} Digits entered so far; "" when empty. */
    this._buffer = ""

    /** @private @type {boolean} Set externally on every question render. */
    this._enabled = true

    /** @private @type {boolean} Guards against double-registering listeners. */
    this._attached = false

    // Bound once and kept, so detach() can remove the same function references.
    /** @private @type {(event: MouseEvent) => void} */
    this._clickHandler = (event) => {
      this._handleClick(event)
    }

    /** @private @type {(event: KeyboardEvent) => void} */
    this._keyHandler = (event) => {
      this.handleKeyDown(event)
    }
  }

  /**
   * The raw entry buffer.
   *
   * @returns {string} The digits entered so far, `""` when empty.
   */
  get value() {
    return this._buffer
  }

  /**
   * What the on-screen readout should show.
   *
   * @returns {string} The digits, or `KEYPAD.EMPTY_DISPLAY` when empty.
   */
  get display() {
    return this._buffer === "" ? KEYPAD.EMPTY_DISPLAY : this._buffer
  }

  /**
   * Whether presses are currently accepted.
   *
   * @returns {boolean} True when the pad is live.
   */
  get isEnabled() {
    return this._enabled
  }

  /**
   * Builds the key grid, replacing whatever was in the container. Idempotent --
   * calling it twice yields the same twelve keys, not twenty-four. The 3x4
   * layout is CSS (`grid-template-columns: repeat(3, 1fr)`), not markup.
   *
   * @returns {void}
   */
  render() {
    if (!this._container) return
    this._container.textContent = ""
    for (const key of KEYPAD.KEYS) {
      this._container.appendChild(this._createKey(key))
    }
    // A pad rendered while disabled must look and behave disabled.
    this.setEnabled(this._enabled)
  }

  /**
   * Adds the delegated `click` listener on the container and the `keydown`
   * listener on `document`. Calling it twice does not double-register.
   *
   * @returns {void}
   */
  attach() {
    if (this._attached) return
    if (this._container) this._container.addEventListener("click", this._clickHandler)
    document.addEventListener("keydown", this._keyHandler)
    this._attached = true
  }

  /**
   * Removes both listeners added by `attach()`, using the same function
   * references. Safe to call when not attached.
   *
   * @returns {void}
   */
  detach() {
    if (!this._attached) return
    if (this._container) this._container.removeEventListener("click", this._clickHandler)
    document.removeEventListener("keydown", this._keyHandler)
    this._attached = false
  }

  /**
   * Detaches the listeners and empties the container.
   *
   * @returns {void}
   */
  destroy() {
    this.detach()
    if (this._container) this._container.textContent = ""
  }

  /**
   * Resets the entry buffer and fires `onChange` with the empty display, so the
   * readout follows. Works whether or not the pad is enabled -- `game.js` clears
   * between questions while the pad is still disabled.
   *
   * @returns {void}
   */
  clear() {
    this._buffer = ""
    this._emitChange()
  }

  /**
   * Toggles whether presses are accepted, and reflects that on every key
   * (`disabled` plus the `disabled` class). `game.js` calls this on every
   * question render and again the moment an answer is accepted, which is what
   * keeps a hidden, mid-feedback, or already-answered question inert.
   *
   * @param {boolean} enabled - True to accept presses.
   * @returns {void}
   */
  setEnabled(enabled) {
    this._enabled = Boolean(enabled)
    if (!this._container) return
    for (const key of this._container.querySelectorAll(".keypad-key")) {
      key.disabled = !this._enabled
      key.classList.toggle("disabled", !this._enabled)
    }
  }

  /**
   * Physical-keyboard fallback for accessibility; the taps are the primary path.
   * Bails unless the pad is enabled and the play screen is the active screen with
   * the settings modal hidden, and leaves form controls alone.
   *
   * Key mapping: `0`-`9` type a digit, `Backspace` and `Delete` remove one digit
   * (the same thing the `⌫` key does), `Escape` drops the whole entry, and
   * `Enter` submits.
   *
   * @param {KeyboardEvent} event - The keydown event.
   * @returns {boolean} True when the event was consumed (and `preventDefault`
   *   called), false when it was left for another handler.
   */
  handleKeyDown(event) {
    if (!this._enabled) return false
    if (!this._isPlayScreenReady()) return false
    if (event.target && PASSTHROUGH_TAGS.has(event.target.tagName)) return false

    const key = event.key
    if (DIGIT.test(key)) {
      this._press(key)
      event.preventDefault()
      return true
    }
    if (BACKSPACE_KEYS.has(key)) {
      this._press(KEYPAD.BACKSPACE_KEY)
      event.preventDefault()
      return true
    }
    if (CLEAR_KEYS.has(key)) {
      this.clear()
      event.preventDefault()
      return true
    }
    if (key === "Enter") {
      this._press(KEYPAD.ENTER_KEY)
      event.preventDefault()
      return true
    }
    return false
  }

  /**
   * Builds one key button. Text and label go through `textContent` /
   * `setAttribute`, never `innerHTML`.
   *
   * @private
   * @param {string} key - A `KEYPAD.KEYS` entry.
   * @returns {HTMLElement} The button element.
   */
  _createKey(key) {
    const button = document.createElement("button")
    button.type = "button"
    button.className = KEY_MODIFIERS[key] ? `keypad-key ${KEY_MODIFIERS[key]}` : "keypad-key"
    button.dataset.key = key
    button.textContent = KEY_FACES[key] || key
    button.setAttribute("aria-label", KEY_LABELS[key] || key)
    return button
  }

  /**
   * Delegated click handler: finds the key that was hit, including when the tap
   * landed on an element nested inside the button.
   *
   * @private
   * @param {MouseEvent} event - The click event.
   * @returns {void}
   */
  _handleClick(event) {
    const target = event.target
    if (!target || typeof target.closest !== "function") return
    const button = target.closest(".keypad-key")
    if (!button) return
    const key = button.dataset.key
    if (key) this._press(key)
  }

  /**
   * Applies one key, whichever way it arrived. Ignored entirely when disabled.
   *
   * Two ordering notes:
   *
   *   - **Backspace deletes one digit**, it does not empty the buffer. `onChange`
   *     fires even when the buffer was already empty, because that press is still
   *     the player's first touch of the question and `game.js` stamps the
   *     response clock off the first `onChange`.
   *   - **Enter leaves the buffer alone.** `onSubmit` is called and nothing is
   *     cleared, so the digits she typed stay on `#answer-display` through the
   *     feedback beat instead of snapping back to "?" at the moment she is told
   *     she was right. `game.js` calls `clear()` from its next question render,
   *     which is what empties the buffer and resets the readout. A second enter
   *     press cannot resubmit: `game.js` disables the pad inside `onSubmit`, and
   *     the guard at the top of this method is what makes that stick.
   *
   * @private
   * @param {string} key - A `KEYPAD.KEYS` entry.
   * @returns {void}
   */
  _press(key) {
    if (!this._enabled) return

    if (key === KEYPAD.BACKSPACE_KEY) {
      this._buffer = this._buffer.slice(0, -1)
      this._emitChange()
      return
    }

    if (key === KEYPAD.ENTER_KEY) {
      // An empty entry is not an answer: no submit, and no onChange either, so
      // it cannot be mistaken for the first interaction.
      if (this._buffer === "") return
      if (this._onSubmit) this._onSubmit(Number(this._buffer))
      return
    }

    if (!DIGIT.test(key)) return
    if (this._buffer.length >= this._maxDigits) return
    // A lone leading zero is replaced, not extended: 0 then 7 reads "7".
    this._buffer = this._buffer === "0" ? key : this._buffer + key
    this._emitChange()
  }

  /**
   * Notifies the readout, if anyone is listening.
   *
   * @private
   * @returns {void}
   */
  _emitChange() {
    if (this._onChange) this._onChange(this.display)
  }

  /**
   * The screen guard, evaluated on every key event (never cached at `attach()`
   * time). `EventManager` implements the same three lines privately: both
   * classes listen on `document`, so both must bail in exactly the same
   * conditions or one acts on a screen it does not own. Without the active
   * check, typing `7` on the summary screen answers a question that is gone;
   * without the modal check, keys pressed while the settings dialog is open fall
   * through to the question underneath, because the play screen keeps its
   * `active` class while the modal is over it.
   *
   * @private
   * @returns {boolean} True when the play screen is active and the settings
   *   modal is hidden.
   */
  _isPlayScreenReady() {
    const play = document.getElementById("play-screen")
    const modal = document.getElementById("settings-modal")
    const active = Boolean(play && play.classList.contains("active"))
    const modalOpen = Boolean(modal && !modal.classList.contains("hidden"))
    return active && !modalOpen
  }
}

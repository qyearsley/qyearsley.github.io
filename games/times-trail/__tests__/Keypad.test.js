/**
 * Tests for the in-page numeric keypad.
 *
 * The DOM fixture is read from `games/times-trail/index.html` on disk rather
 * than hand-written, so a renamed or misspelled id fails here instead of
 * surviving to manual play. `#play-screen` ships without the `active` class, so
 * the fixture adds it -- the screen guard needs an active play screen and a
 * hidden settings modal or every keyboard test would (correctly) bail.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from "@jest/globals"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Keypad } from "../js/Keypad.js"
import { KEYPAD } from "../js/constants.js"

// Resolved relative to this file rather than with `process.cwd()`: eslint's
// `__tests__/**/*.js` override (which declares `process`) only matches the
// repo-root `__tests__/`, so `process` is undefined for lint purposes here.
const INDEX_HTML = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "index.html"),
  "utf-8",
)
const BODY = INDEX_HTML.replace(/[\s\S]*<body[^>]*>/i, "").replace(/<\/body>[\s\S]*/i, "")

let keypad
let container
let onSubmit
let onChange

/**
 * @param {string} key - `event.key` value.
 * @param {EventTarget} [target] - Event target; defaults to `document.body`.
 * @returns {Object} A KeyboardEvent-shaped plain object with a spy on preventDefault.
 */
function keyEvent(key, target = document.body) {
  return { key, target, preventDefault: jest.fn() }
}

/**
 * @param {string} key - A `KEYPAD.KEYS` value.
 * @returns {HTMLElement} The matching key button.
 */
function keyButton(key) {
  return container.querySelector(`[data-key="${key}"]`)
}

/**
 * @param {...string} keys - `KEYPAD.KEYS` values to click in order.
 * @returns {void}
 */
function clickKeys(...keys) {
  for (const key of keys) keyButton(key).click()
}

beforeEach(() => {
  document.body.innerHTML = BODY
  document.getElementById("play-screen").classList.add("active")
  container = document.getElementById("keypad")
  onSubmit = jest.fn()
  onChange = jest.fn()
  keypad = new Keypad(container, { onSubmit, onChange })
  keypad.render()
  keypad.attach()
})

afterEach(() => {
  keypad.destroy()
})

describe("Keypad", () => {
  describe("fixture", () => {
    test("the page supplies #keypad and #answer-display exactly once each", () => {
      expect(document.querySelectorAll("#keypad")).toHaveLength(1)
      expect(document.querySelectorAll("#answer-display")).toHaveLength(1)
      expect(document.querySelectorAll("#play-screen")).toHaveLength(1)
      expect(document.querySelectorAll("#settings-modal")).toHaveLength(1)
    })

    test("#answer-display is a paragraph, not a text field", () => {
      const display = document.getElementById("answer-display")
      expect(display.tagName).toBe("P")
      expect(display.querySelector("input")).toBeNull()
    })
  })

  describe("render", () => {
    test("creates one button per KEYPAD.KEYS entry, in order", () => {
      const buttons = [...container.querySelectorAll(".keypad-key")]
      expect(buttons).toHaveLength(12)
      expect(buttons.map((button) => button.dataset.key)).toEqual([...KEYPAD.KEYS])
    })

    test("every key is a real button with an accessible name", () => {
      for (const button of container.querySelectorAll(".keypad-key")) {
        expect(button.tagName).toBe("BUTTON")
        expect(button.type).toBe("button")
        expect(button.getAttribute("aria-label")).toBeTruthy()
      }
    })

    test("marks the backspace and enter keys with their own classes and glyphs", () => {
      expect(keyButton(KEYPAD.BACKSPACE_KEY).classList.contains("keypad-key-clear")).toBe(true)
      expect(keyButton(KEYPAD.ENTER_KEY).classList.contains("keypad-key-enter")).toBe(true)
      expect(keyButton(KEYPAD.BACKSPACE_KEY).textContent).toBe("⌫")
      expect(keyButton(KEYPAD.ENTER_KEY).textContent).toBe("✓")
      expect(keyButton("7").textContent).toBe("7")
    })

    test("the ⌫ key is named for what it does", () => {
      // The glyph promises a single-digit delete, so the accessible name has to
      // say the same thing -- it used to read "Clear" while wiping the entry.
      expect(keyButton(KEYPAD.BACKSPACE_KEY).getAttribute("aria-label")).toBe("Backspace")
    })

    test("is idempotent", () => {
      keypad.render()
      expect(container.querySelectorAll(".keypad-key")).toHaveLength(12)
    })

    test("creates no input or textarea, so iOS has nothing to focus", () => {
      expect(container.querySelector("input")).toBeNull()
      expect(container.querySelector("textarea")).toBeNull()
      expect(container.querySelector("[contenteditable]")).toBeNull()
    })

    test("is a no-op with no container", () => {
      const orphan = new Keypad(null)
      expect(() => orphan.render()).not.toThrow()
      expect(orphan.value).toBe("")
    })
  })

  describe("digit presses", () => {
    test("appends digits and reports each change", () => {
      clickKeys("7", "2")
      expect(keypad.value).toBe("72")
      expect(onChange).toHaveBeenCalledTimes(2)
      expect(onChange.mock.calls).toEqual([["7"], ["72"]])
    })

    test("ignores a digit past maxDigits", () => {
      clickKeys("7", "2", "5")
      expect(keypad.value).toBe("72")
      expect(onChange).toHaveBeenCalledTimes(2)
    })

    test("honors a maxDigits option", () => {
      keypad.detach()
      const wide = new Keypad(container, { onChange, maxDigits: 3 })
      wide.render()
      wide.attach()
      clickKeys("1", "2", "3", "4")
      expect(wide.value).toBe("123")
      wide.destroy()
    })

    test("replaces a lone leading zero instead of extending it", () => {
      clickKeys("0", "7")
      expect(keypad.value).toBe("7")
      expect(onChange.mock.calls).toEqual([["0"], ["7"]])
    })

    test("registers a tap that landed inside a key button", () => {
      const inner = document.createElement("span")
      keyButton("4").appendChild(inner)
      inner.click()
      expect(keypad.value).toBe("4")
    })

    test("ignores a click on the container background", () => {
      container.click()
      expect(keypad.value).toBe("")
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe("backspace", () => {
    test("removes ONE digit, keeping the ones she got right", () => {
      // The whole point of the key: mistyping the second digit of 42 must not
      // cost her the 4. It used to clear the entry outright.
      clickKeys("4", "3", KEYPAD.BACKSPACE_KEY)
      expect(keypad.value).toBe("4")
      expect(onChange).toHaveBeenCalledTimes(3)
      expect(onChange).toHaveBeenLastCalledWith("4")
      clickKeys("2")
      expect(keypad.value).toBe("42")
    })

    test("empties a one-digit buffer and reports the empty display", () => {
      clickKeys("7", KEYPAD.BACKSPACE_KEY)
      expect(keypad.value).toBe("")
      expect(onChange).toHaveBeenLastCalledWith(KEYPAD.EMPTY_DISPLAY)
    })

    test("reports the change on an already-empty buffer, so the clock still stamps", () => {
      clickKeys(KEYPAD.BACKSPACE_KEY)
      expect(keypad.value).toBe("")
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenLastCalledWith(KEYPAD.EMPTY_DISPLAY)
    })

    test("repeated presses walk the buffer down and then stop", () => {
      clickKeys("8", "1", KEYPAD.BACKSPACE_KEY, KEYPAD.BACKSPACE_KEY, KEYPAD.BACKSPACE_KEY)
      expect(keypad.value).toBe("")
    })
  })

  describe("clear", () => {
    test("clear() empties the whole buffer and reports the empty display", () => {
      clickKeys("7", "2")
      keypad.clear()
      expect(keypad.value).toBe("")
      expect(onChange).toHaveBeenLastCalledWith(KEYPAD.EMPTY_DISPLAY)
    })

    test("clear() reports the change even with an already-empty buffer", () => {
      keypad.clear()
      expect(onChange).toHaveBeenCalledWith("?")
    })

    test("there is no clear-all key on the pad", () => {
      expect(keyButton("clear")).toBeNull()
      expect(
        [...container.querySelectorAll(".keypad-key")].map((b) => b.dataset.key),
      ).not.toContain("clear")
    })
  })

  describe("submit", () => {
    test("enter submits the entry as a number and LEAVES her digits on screen", () => {
      // Clearing on submit wiped the readout back to "?" in the same turn she was
      // told she was right, so the answer she typed simply vanished. game.js
      // calls clear() from the next question render instead.
      clickKeys("7", "2", KEYPAD.ENTER_KEY)
      expect(onSubmit).toHaveBeenCalledTimes(1)
      expect(onSubmit).toHaveBeenCalledWith(72)
      expect(keypad.value).toBe("72")
      expect(keypad.display).toBe("72")
      expect(onChange).toHaveBeenCalledTimes(2)
      expect(onChange).toHaveBeenLastCalledWith("72")
    })

    test("a second enter cannot resubmit once the pad is disabled in onSubmit", () => {
      // This is how game.js is wired: the pad goes inert inside onSubmit, which is
      // what makes keeping the buffer safe.
      keypad.detach()
      const pad = new Keypad(container, {
        onSubmit: () => {
          pad.setEnabled(false)
        },
        onChange,
      })
      pad.render()
      pad.attach()
      clickKeys("9", KEYPAD.ENTER_KEY)
      expect(pad.value).toBe("9")
      keyButton(KEYPAD.ENTER_KEY).dispatchEvent(new MouseEvent("click", { bubbles: true }))
      expect(pad.value).toBe("9")
      pad.destroy()
    })

    test("the next render's clear() is what resets the readout", () => {
      clickKeys("7", "2", KEYPAD.ENTER_KEY)
      keypad.clear()
      expect(keypad.value).toBe("")
      expect(onChange).toHaveBeenLastCalledWith(KEYPAD.EMPTY_DISPLAY)
    })

    test("the buffer is still readable from a synchronous onSubmit handler", () => {
      keypad.detach()
      let seen = null
      const pad = new Keypad(container, {
        onSubmit: () => {
          seen = pad.value
        },
      })
      pad.render()
      pad.attach()
      clickKeys("8", KEYPAD.ENTER_KEY)
      expect(seen).toBe("8")
      pad.destroy()
    })

    test("enter on an empty buffer submits nothing and reports nothing", () => {
      clickKeys(KEYPAD.ENTER_KEY)
      expect(onSubmit).not.toHaveBeenCalled()
      expect(onChange).not.toHaveBeenCalled()
    })

    test("missing callbacks are a no-op, not a throw", () => {
      keypad.detach()
      const bare = new Keypad(container)
      bare.render()
      bare.attach()
      expect(() => clickKeys("5", KEYPAD.ENTER_KEY, KEYPAD.BACKSPACE_KEY)).not.toThrow()
      bare.destroy()
    })
  })

  describe("display", () => {
    test("is the empty marker when nothing is entered and the digits otherwise", () => {
      expect(keypad.display).toBe(KEYPAD.EMPTY_DISPLAY)
      clickKeys("4")
      expect(keypad.display).toBe("4")
      clickKeys("2")
      expect(keypad.display).toBe("42")
      keypad.clear()
      expect(keypad.display).toBe(KEYPAD.EMPTY_DISPLAY)
    })

    test("onChange drives the on-screen readout, which is how game.js wires it", () => {
      keypad.detach()
      const readout = document.getElementById("answer-display")
      const wired = new Keypad(container, {
        onChange: (display) => {
          readout.textContent = display
        },
      })
      wired.render()
      wired.attach()
      clickKeys("6")
      expect(readout.textContent).toBe("6")
      clickKeys("3")
      expect(readout.textContent).toBe("63")
      clickKeys(KEYPAD.BACKSPACE_KEY)
      expect(readout.textContent).toBe("6")
      clickKeys(KEYPAD.BACKSPACE_KEY)
      expect(readout.textContent).toBe("?")
      wired.destroy()
    })
  })

  describe("setEnabled", () => {
    test("disables every key and makes taps inert", () => {
      keypad.setEnabled(false)
      expect(keypad.isEnabled).toBe(false)
      for (const button of container.querySelectorAll(".keypad-key")) {
        expect(button.disabled).toBe(true)
        expect(button.classList.contains("disabled")).toBe(true)
      }
      clickKeys("7")
      expect(keypad.value).toBe("")
      expect(onChange).not.toHaveBeenCalled()
    })

    test("a tap that still reaches the handler is refused at the buffer", () => {
      // Browsers suppress clicks on a disabled button, so the disabled attribute
      // alone could make the test above pass without the guard in _press. This
      // dispatches the click anyway, which is the case that matters when
      // setEnabled(false) lands between a touch starting and the click firing.
      keypad.setEnabled(false)
      keyButton("7").dispatchEvent(new MouseEvent("click", { bubbles: true }))
      keyButton(KEYPAD.BACKSPACE_KEY).dispatchEvent(new MouseEvent("click", { bubbles: true }))
      expect(keypad.value).toBe("")
      expect(onChange).not.toHaveBeenCalled()
    })

    test("re-enabling restores the keys and the taps", () => {
      keypad.setEnabled(false)
      keypad.setEnabled(true)
      expect(keypad.isEnabled).toBe(true)
      for (const button of container.querySelectorAll(".keypad-key")) {
        expect(button.disabled).toBe(false)
        expect(button.classList.contains("disabled")).toBe(false)
      }
      clickKeys("7")
      expect(keypad.value).toBe("7")
    })

    test("a disabled pad ignores keystrokes too", () => {
      keypad.setEnabled(false)
      expect(keypad.handleKeyDown(keyEvent("5"))).toBe(false)
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "5", bubbles: true }))
      expect(keypad.value).toBe("")
      expect(onChange).not.toHaveBeenCalled()
    })

    test("a pad rendered while disabled renders disabled keys", () => {
      keypad.setEnabled(false)
      keypad.render()
      expect(keyButton("7").disabled).toBe(true)
    })
  })

  describe("handleKeyDown", () => {
    test("a digit key appends and is consumed", () => {
      const event = keyEvent("5")
      expect(keypad.handleKeyDown(event)).toBe(true)
      expect(keypad.value).toBe("5")
      expect(event.preventDefault).toHaveBeenCalled()
      expect(onChange).toHaveBeenCalledWith("5")
    })

    test("Enter submits the current entry, is consumed, and keeps the digits", () => {
      keypad.handleKeyDown(keyEvent("4"))
      const event = keyEvent("Enter")
      expect(keypad.handleKeyDown(event)).toBe(true)
      expect(onSubmit).toHaveBeenCalledWith(4)
      expect(keypad.value).toBe("4")
      expect(event.preventDefault).toHaveBeenCalled()
    })

    test("Backspace and Delete remove one digit, matching the ⌫ key", () => {
      for (const key of ["Backspace", "Delete"]) {
        keypad.clear()
        keypad.handleKeyDown(keyEvent("9"))
        keypad.handleKeyDown(keyEvent("6"))
        const event = keyEvent(key)
        expect(keypad.handleKeyDown(event)).toBe(true)
        expect(keypad.value).toBe("9")
        expect(event.preventDefault).toHaveBeenCalled()
      }
    })

    test("Escape drops the whole entry, which no key on the pad does", () => {
      keypad.handleKeyDown(keyEvent("9"))
      keypad.handleKeyDown(keyEvent("6"))
      const event = keyEvent("Escape")
      expect(keypad.handleKeyDown(event)).toBe(true)
      expect(keypad.value).toBe("")
      expect(event.preventDefault).toHaveBeenCalled()
    })

    test("an unrelated key is left alone", () => {
      keypad.handleKeyDown(keyEvent("3"))
      const event = keyEvent("a")
      expect(keypad.handleKeyDown(event)).toBe(false)
      expect(keypad.value).toBe("3")
      expect(event.preventDefault).not.toHaveBeenCalled()
    })

    test("form controls keep their native keyboard behavior", () => {
      const select = document.getElementById("difficulty-select")
      const checkbox = document.getElementById("table-2")
      expect(keypad.handleKeyDown(keyEvent("5", select))).toBe(false)
      expect(keypad.handleKeyDown(keyEvent("5", checkbox))).toBe(false)
      expect(keypad.value).toBe("")
    })
  })

  describe("screen guard", () => {
    test("bails when the play screen is not the active screen", () => {
      document.getElementById("play-screen").classList.remove("active")
      expect(keypad.handleKeyDown(keyEvent("5"))).toBe(false)
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "5", bubbles: true }))
      expect(keypad.value).toBe("")
      expect(onChange).not.toHaveBeenCalled()
    })

    test("bails when the settings modal is open over the active play screen", () => {
      document.getElementById("settings-modal").classList.remove("hidden")
      expect(document.getElementById("play-screen").classList.contains("active")).toBe(true)
      expect(keypad.handleKeyDown(keyEvent("5"))).toBe(false)
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "5", bubbles: true }))
      expect(keypad.value).toBe("")
    })

    test("bails without throwing when the play screen is absent entirely", () => {
      document.getElementById("play-screen").remove()
      expect(() => keypad.handleKeyDown(keyEvent("5"))).not.toThrow()
      expect(keypad.handleKeyDown(keyEvent("5"))).toBe(false)
      expect(keypad.value).toBe("")
    })

    test("is evaluated per event, not cached at attach time", () => {
      const modal = document.getElementById("settings-modal")
      const play = document.getElementById("play-screen")
      modal.classList.remove("hidden")
      play.classList.remove("active")
      expect(keypad.handleKeyDown(keyEvent("5"))).toBe(false)

      play.classList.add("active")
      modal.classList.add("hidden")
      expect(keypad.handleKeyDown(keyEvent("5"))).toBe(true)
      expect(keypad.value).toBe("5")
    })
  })

  describe("attach", () => {
    test("a real keydown event on document reaches the keypad", () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "8", bubbles: true }))
      expect(keypad.value).toBe("8")
      expect(onChange).toHaveBeenCalledWith("8")
    })

    test("attaching twice does not double-register", () => {
      keypad.attach()
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "8", bubbles: true }))
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(keypad.value).toBe("8")
    })
  })

  describe("detach", () => {
    test("removes both listeners, and a re-attach does not double-fire", () => {
      keypad.detach()
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "8", bubbles: true }))
      clickKeys("8")
      expect(keypad.value).toBe("")
      expect(onChange).not.toHaveBeenCalled()

      keypad.attach()
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "8", bubbles: true }))
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(keypad.value).toBe("8")
    })

    test("is safe to call when not attached", () => {
      keypad.detach()
      expect(() => keypad.detach()).not.toThrow()
    })

    test("attach and detach tolerate a missing container", () => {
      const orphan = new Keypad(null, { onChange })
      expect(() => {
        orphan.attach()
        orphan.detach()
        orphan.destroy()
      }).not.toThrow()
    })
  })

  describe("destroy", () => {
    test("empties the container and stops responding to events", () => {
      keypad.destroy()
      expect(container.querySelectorAll(".keypad-key")).toHaveLength(0)
      expect(container.textContent).toBe("")
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "8", bubbles: true }))
      expect(keypad.value).toBe("")
      expect(onChange).not.toHaveBeenCalled()
    })
  })
})

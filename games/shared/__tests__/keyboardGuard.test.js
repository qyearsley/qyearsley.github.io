import { describe, expect, jest, test, afterEach } from "@jest/globals"
import { keyIsNotForGame, closeSettingsOnEscape } from "../keyboardGuard.js"

function key(name, init = {}) {
  return new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true, ...init })
}

/** Dispatch a key on a real element, so `event.target` is set the way it is in a page. */
function keyOn(element, name, init = {}) {
  document.body.append(element)
  let seen
  element.addEventListener("keydown", (event) => (seen = event))
  element.dispatchEvent(key(name, init))
  element.remove()
  return seen
}

afterEach(() => {
  delete window.__helpOverlayIsOpen
})

describe("keyIsNotForGame", () => {
  test("a plain key on the page is for the game", () => {
    expect(keyIsNotForGame(keyOn(document.createElement("div"), "a"))).toBe(false)
  })

  test("an event with no target is for the game", () => {
    expect(keyIsNotForGame(key("a"))).toBe(false)
  })

  test.each(["metaKey", "ctrlKey", "altKey"])("%s hands the key to the browser", (modifier) => {
    expect(keyIsNotForGame(key("a", { [modifier]: true }))).toBe(true)
  })

  test("the help overlay being open hands the key to the overlay", () => {
    window.__helpOverlayIsOpen = () => true
    expect(keyIsNotForGame(key("a"))).toBe(true)
    window.__helpOverlayIsOpen = () => false
    expect(keyIsNotForGame(key("a"))).toBe(false)
  })

  test.each(["input", "textarea", "select"])("a %s keeps its own keys", (tag) => {
    expect(keyIsNotForGame(keyOn(document.createElement(tag), "a"))).toBe(true)
  })

  test("a button does not", () => {
    expect(keyIsNotForGame(keyOn(document.createElement("button"), "a"))).toBe(false)
  })
})

describe("closeSettingsOnEscape", () => {
  function setup(open = true) {
    return { isOpen: () => open, close: jest.fn() }
  }

  test("closes an open dialog and stops the key", () => {
    const settings = setup()
    const event = key("Escape")
    expect(closeSettingsOnEscape(event, settings)).toBe(true)
    expect(settings.close).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  test("closes it from inside a select", () => {
    const settings = setup()
    const event = keyOn(document.createElement("select"), "Escape")
    expect(closeSettingsOnEscape(event, settings)).toBe(true)
    expect(settings.close).toHaveBeenCalled()
  })

  test("leaves a closed dialog alone", () => {
    const settings = setup(false)
    expect(closeSettingsOnEscape(key("Escape"), settings)).toBe(false)
    expect(settings.close).not.toHaveBeenCalled()
  })

  test("ignores other keys", () => {
    const settings = setup()
    expect(closeSettingsOnEscape(key("a"), settings)).toBe(false)
    expect(settings.close).not.toHaveBeenCalled()
  })

  test.each(["metaKey", "ctrlKey", "altKey"])("ignores Escape with %s held", (modifier) => {
    const settings = setup()
    expect(closeSettingsOnEscape(key("Escape", { [modifier]: true }), settings)).toBe(false)
    expect(settings.close).not.toHaveBeenCalled()
  })

  test("leaves the dialog for the help overlay's own Escape", () => {
    window.__helpOverlayIsOpen = () => true
    const settings = setup()
    expect(closeSettingsOnEscape(key("Escape"), settings)).toBe(false)
    expect(settings.close).not.toHaveBeenCalled()
  })
})

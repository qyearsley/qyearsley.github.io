/**
 * Keyboard checks that Times Trail, Seasons and Number Garden share.
 *
 * Each game has its own letter or digit shortcuts. Before any of them acts, it
 * asks two questions: "is this key meant for the page, or for something else?"
 * and "should Escape close the settings dialog?" The answers used to be copied
 * into each game, and the copies drifted. They live here so a check added once
 * reaches all three.
 */

/** Tags that take their own keystrokes. SELECT is here: the settings dialog is full of them. */
const TEXT_ENTRY_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"])

/** Whether a browser or OS shortcut is held, such as Cmd-R or Ctrl-1. */
function hasModifier(event) {
  return event.metaKey || event.ctrlKey || event.altKey
}

/**
 * Whether the site's `?` help overlay (from `shared/nav.js`) is on screen. It
 * covers the whole page, and `nav.js` does not stop propagation, so every key
 * pressed while it is open also reaches the game.
 */
function helpOverlayOpen() {
  return window.__helpOverlayIsOpen?.() === true
}

/**
 * True when the key is not for the game's shortcuts: a modifier is held, the
 * help overlay is open, or the target is a text field or select.
 * @param {KeyboardEvent} event
 * @returns {boolean}
 */
export function keyIsNotForGame(event) {
  if (hasModifier(event)) return true
  if (helpOverlayOpen()) return true
  return Boolean(event.target && TEXT_ENTRY_TAGS.has(event.target.tagName))
}

/**
 * Close the settings dialog on Escape. Returns true when it did, so the caller
 * stops there.
 *
 * It does nothing while the help overlay is open: the overlay sits on top of the
 * dialog, and one Escape would otherwise dismiss both. It does not check the
 * target, because focus can be on one of the dialog's selects and Escape must
 * still close it.
 * @param {KeyboardEvent} event
 * @param {{isOpen: () => boolean, close: () => void}} settings
 * @returns {boolean}
 */
export function closeSettingsOnEscape(event, { isOpen, close }) {
  if (event.key !== "Escape") return false
  if (hasModifier(event) || helpOverlayOpen()) return false
  if (!isOpen()) return false
  event.preventDefault()
  close()
  return true
}

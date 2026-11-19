/**
 * The SVG namespace. Elements created with `createElement` instead of
 * `createElementNS` render as nothing at all, silently, so every SVG node in
 * this game goes through `svg` below.
 * @type {string}
 */
export const SVG_NS = "http://www.w3.org/2000/svg"

/**
 * Build an SVG element.
 *
 * Attributes are set with `setAttribute`, and children may be elements or
 * strings; a string becomes a text node, never markup. The game never uses
 * `innerHTML`, so no content can become markup.
 *
 * @param {string} tag - SVG tag name, e.g. "circle"
 * @param {Object<string, string|number>} [attrs] - Attributes to set
 * @param {Array<Element|string>} [children] - Child elements or text
 * @returns {SVGElement} The new element
 */
export function svg(tag, attrs = {}, children = []) {
  const element = document.createElementNS(SVG_NS, tag)
  for (const [name, value] of Object.entries(attrs)) {
    if (value !== null && value !== undefined) element.setAttribute(name, String(value))
  }
  for (const child of children) {
    element.append(typeof child === "string" ? document.createTextNode(child) : child)
  }
  return element
}

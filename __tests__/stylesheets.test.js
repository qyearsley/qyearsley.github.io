/**
 * Dark-theme wiring across every stylesheet in the source tree.
 *
 * The site theme picker (shared/theme.js) writes `data-theme` onto `<html>`. A
 * stylesheet that only listens to `@media (prefers-color-scheme: dark)` ignores
 * it, which produces two wrong states rather than one: picking "Dark" on a
 * light machine gives that sheet's light colours on the site sheet's dark page
 * background, and picking "Light" on a dark machine gives the reverse.
 *
 * Three of the five games and css/components.css all shipped that way. These
 * checks are cheap, and the mistake is invisible unless you happen to test the
 * crossed combination.
 *
 * A sheet that names no dark colours at all is fine and is simply not checked
 * -- the tokens in style.css already resolve for both forms, so drawing from
 * them is the preferred way to support dark mode.
 */
import { describe, expect, test } from "@jest/globals"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const ROOT = process.cwd()
const SEARCH_DIRS = ["css", "games", "resume"]
const SKIP_DIRS = new Set(["node_modules", "dist", "coverage"])
const DARK_QUERY = "prefers-color-scheme: dark"

function findCssFiles(dir, prefix) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue
    if (SKIP_DIRS.has(entry.name)) continue
    if (entry.isDirectory()) {
      files.push(...findCssFiles(join(dir, entry.name), prefix + entry.name + "/"))
    } else if (entry.name.endsWith(".css")) {
      files.push(prefix + entry.name)
    }
  }
  return files
}

/**
 * A sheet's source with comments stripped.
 *
 * Both checks below search for literal fragments, and a comment explaining the
 * convention would otherwise read as an instance of it -- the note at the top
 * of components.css names the media query it no longer contains.
 *
 * @param {string} relPath - Path relative to the repository root.
 * @returns {string} The stylesheet source, comments replaced by a space.
 */
function readRules(relPath) {
  return readFileSync(join(ROOT, relPath), "utf-8").replace(/\/\*[\s\S]*?\*\//g, " ")
}

/**
 * The source of each `@media (prefers-color-scheme: dark)` block in a sheet,
 * from the query's opening brace to its matching close.
 *
 * @param {string} css - Stylesheet source, comments already stripped.
 * @returns {string[]} One entry per dark media query, body included.
 */
function darkMediaBlocks(css) {
  const blocks = []
  let from = 0
  for (;;) {
    const found = css.indexOf(DARK_QUERY, from)
    if (found === -1) return blocks
    const open = css.indexOf("{", found)
    if (open === -1) return blocks

    let depth = 0
    let i = open
    for (; i < css.length; i++) {
      if (css[i] === "{") depth++
      else if (css[i] === "}" && --depth === 0) break
    }
    blocks.push(css.slice(open + 1, i))
    from = i
  }
}

const cssFiles = SEARCH_DIRS.flatMap((dir) => findCssFiles(join(ROOT, dir), dir + "/"))
const darkFiles = cssFiles.filter((f) => readRules(f).includes(DARK_QUERY))

describe("stylesheets", () => {
  test("the search finds sheets, and some of them style a dark theme", () => {
    expect(cssFiles.length).toBeGreaterThan(0)
    expect(darkFiles.length).toBeGreaterThan(0)
  })

  test.each(darkFiles)("%s also handles an explicit data-theme choice", (relPath) => {
    expect(readRules(relPath)).toContain('[data-theme="dark"]')
  })

  test.each(darkFiles)("%s lets an explicit light choice beat the OS preference", (relPath) => {
    for (const block of darkMediaBlocks(readRules(relPath))) {
      // Every selector inside the query needs the guard; without it the OS
      // preference still wins after the visitor has asked for light.
      expect(block).toContain(':not([data-theme="light"])')
    }
  })
})

/**
 * Dark-theme wiring across the game stylesheets.
 *
 * The site theme picker (shared/theme.js) writes `data-theme` onto `<html>`. A
 * stylesheet that only listens to `@media (prefers-color-scheme: dark)` ignores
 * it, which produces two wrong states rather than one: picking "Dark" on a
 * light machine gives that sheet's light colours on the site sheet's dark page
 * background, and picking "Light" on a dark machine gives the reverse.
 *
 * Three of the five games shipped that way. These checks are cheap, and the
 * mistake is invisible unless you happen to test the crossed combination.
 */
import { describe, expect, test } from "@jest/globals"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const GAMES_DIR = join(process.cwd(), "games")
const DARK_QUERY = "prefers-color-scheme: dark"

function findCssFiles(dir, prefix = "") {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue
    if (entry.isDirectory()) {
      files.push(...findCssFiles(join(dir, entry.name), prefix + entry.name + "/"))
    } else if (entry.name.endsWith(".css")) {
      files.push(prefix + entry.name)
    }
  }
  return files
}

/**
 * The source of each `@media (prefers-color-scheme: dark)` block in a sheet,
 * from the query's opening brace to its matching close.
 *
 * @param {string} css - Stylesheet source.
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

const cssFiles = findCssFiles(GAMES_DIR)
const darkFiles = cssFiles.filter((f) =>
  readFileSync(join(GAMES_DIR, f), "utf-8").includes(DARK_QUERY),
)

describe("game stylesheets", () => {
  test("some of them style a dark theme", () => {
    expect(darkFiles.length).toBeGreaterThan(0)
  })

  test.each(darkFiles)("%s also handles an explicit data-theme choice", (relPath) => {
    const css = readFileSync(join(GAMES_DIR, relPath), "utf-8")
    expect(css).toContain('[data-theme="dark"]')
  })

  test.each(darkFiles)("%s lets an explicit light choice beat the OS preference", (relPath) => {
    const css = readFileSync(join(GAMES_DIR, relPath), "utf-8")
    for (const block of darkMediaBlocks(css)) {
      // Every selector inside the query needs the guard; without it the OS
      // preference still wins after the player has asked for light.
      expect(block).toContain(':not([data-theme="light"])')
    }
  })
})

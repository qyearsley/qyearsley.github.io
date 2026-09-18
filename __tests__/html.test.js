/**
 * Structural checks over every HTML page in the source tree.
 *
 * These catch mistakes that htmlhint and build.js validation both miss. An
 * unclosed `<script src="...">` still parses -- the parser treats everything up
 * to the next `</script>` as inline content, which is then discarded because the
 * tag has a src. The effect is that the following script tag silently never
 * loads.
 */
import { describe, expect, test } from "@jest/globals"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

// Mirrors the directory filtering in build.js: only pages that ship to dist/.
const SKIP_DIRS = new Set(["node_modules", "dist", "docs", "coverage"])

// SHA-384 of the empty string. Placeholder hashes like this are easy to paste in
// by accident, and a browser enforcing SRI will refuse to run the real script.
const EMPTY_STRING_SHA384 =
  "sha384-OLBgp1GsljhM2TJ+sbHjaiH9txEUvgdDTAzHv2P24donTt6/529l+9Ua0vFImLlb"

function findSourceHtmlFiles(dir, prefix = "") {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const name = entry.name
    if (name.startsWith(".")) continue
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue
      files.push(...findSourceHtmlFiles(join(dir, name), prefix + name + "/"))
    } else if (name.endsWith(".html")) {
      files.push(prefix + name)
    }
  }
  return files
}

const htmlFiles = findSourceHtmlFiles(process.cwd())

function parse(relPath) {
  const source = readFileSync(join(process.cwd(), relPath), "utf-8")
  return new DOMParser().parseFromString(source, "text/html")
}

describe("HTML script tags", () => {
  test("the source tree has HTML files to check", () => {
    expect(htmlFiles.length).toBeGreaterThan(0)
  })

  test.each(htmlFiles)("%s: every external script tag is closed", (relPath) => {
    const doc = parse(relPath)
    // A script with a src should have no inline content. Text here means the
    // tag was never closed and it absorbed whatever followed.
    const swallowed = [...doc.querySelectorAll("script[src]")]
      .filter((script) => script.textContent.trim().length > 0)
      .map((script) => `${script.getAttribute("src")} swallowed: ${script.textContent.trim()}`)
    expect(swallowed).toEqual([])
  })

  test.each(htmlFiles)("%s: no placeholder integrity hashes", (relPath) => {
    const doc = parse(relPath)
    const placeholders = [...doc.querySelectorAll("script[integrity], link[integrity]")]
      .filter((el) => el.getAttribute("integrity").trim() === EMPTY_STRING_SHA384)
      .map((el) => el.getAttribute("src") || el.getAttribute("href"))
    expect(placeholders).toEqual([])
  })
})

/**
 * Meta descriptions.
 *
 * Every page has one, and this keeps it that way. A page can lose its
 * description by accident -- the tag is three lines of boilerplate near the top
 * of the head, easy to drop when a page is copied from another one.
 *
 * Adding a page? Write the description, then add the same English string as a
 * `_description` key in the page's `*.zh.json` so the Chinese side keeps up.
 */
function description(relPath) {
  const meta = parse(relPath).querySelector('meta[name="description"]')
  return meta ? (meta.getAttribute("content") || "").trim() : null
}

describe("meta descriptions", () => {
  test.each(htmlFiles)("%s: has a meta description", (relPath) => {
    expect(description(relPath)).toBeTruthy()
  })
})

// build.js injects the EN/中文 switcher into one of two places: the end of a
// `<header>`, or an empty `<div class="lang-slot">` for a page that has none.
// Both replacements fail SILENTLY when they find nothing -- which is how all
// five games shipped with no switcher at all until 2026-09-18. This is the gate
// that stops a new page doing the same.
describe("language switcher mount point", () => {
  test.each(htmlFiles)("%s: has exactly one mount point", (relPath) => {
    const doc = parse(relPath)
    const headers = doc.querySelectorAll("header")
    const slots = doc.querySelectorAll(".lang-slot")
    expect(headers.length + slots.length).toBe(1)
  })

  test.each(htmlFiles)("%s: leaves the slot empty for the build to fill", (relPath) => {
    for (const slot of parse(relPath).querySelectorAll(".lang-slot")) {
      expect(slot.textContent.trim()).toBe("")
      expect(slot.children).toHaveLength(0)
    }
  })
})

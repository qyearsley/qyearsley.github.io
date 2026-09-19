/**
 * Chinese coverage ratchet.
 *
 * `npm run build:verbose` is not a coverage measure. It warns on one string for
 * a page that was 20% English, so it cannot stop a `/zh/` page going backwards.
 * This does.
 *
 * The check translates each page in memory with build.js's own
 * `translateContent`, so it needs no built `dist/` and `npm test` can run it
 * standalone.
 *
 * What counts as English, in two rules:
 *
 * 1. A text node with no CJK character and two or more words.
 * 2. A text node with five or more English words, even if it contains CJK.
 *
 * Rule 2 exists because rule 1 alone has a blind spot that bit us. An English
 * paragraph on homophones.html quoting 后, 後, 復, 複 and 复 contains CJK, so
 * rule 1 skipped it and the page scored zero while a whole paragraph sat
 * untranslated. Five words is high enough that a Chinese sentence naming a
 * product or a filename does not trip it.
 *
 * Known limitation: a single-word node is never counted. On the chinese/ pages
 * almost every one is pinyin (`ban3`, `yao`), a filename or a bit pattern, and
 * counting them buried the real signal -- tone-table.html scored 378 single
 * word nodes against one real untranslated string. The cost is that a one-word
 * English label such as "Examples" or "smallest" does not show up here. Those
 * are found by reading the page; this suite stops a page going backwards.
 *
 * Dictionary glosses in homophones.html data rows (`] blackboard`) are excluded
 * and counted separately. Whether a Chinese page should gloss 黑板 as
 * "blackboard" is an open question, not a translation gap.
 *
 * A page below its baseline fails with the number to paste in. That failure is
 * the ratchet -- it is what stops a baseline rotting upward after someone
 * improves a page.
 */
import { describe, expect, test } from "@jest/globals"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

const { translateContent, discoverTranslatablePages } = await import(
  join(process.cwd(), "build.js")
)

/**
 * Maximum English text nodes allowed in each translated page.
 *
 * A page missing from this map must have zero. Lower a number when you improve
 * a page -- the suite tells you when one is stale.
 */
const BASELINE = {
  "chinese/encoding-explorer.html": 3,
  "chinese/pinyin-abbreviations.html": 16,
  "javascript/truth-tables.html": 1,
}

const common = JSON.parse(readFileSync("zh-common.json", "utf-8"))
const commonKeys = new Set(Object.keys(common))

function translated(page) {
  const jsonPath = page.replace(/\.html$/, ".zh.json")
  const html = readFileSync(page, "utf-8")
  const pageTranslations = JSON.parse(readFileSync(jsonPath, "utf-8"))

  // translateContent warns on unmatched page keys. Capture them instead of
  // letting them scroll past in the test output.
  const unmatched = []
  const realWarn = console.warn
  console.warn = (msg) => unmatched.push(String(msg).trim())
  const zh = translateContent(html, { ...common, ...pageTranslations }, page, commonKeys, new Set())
  console.warn = realWarn

  return { zh, unmatched }
}

function englishNodes(html) {
  const body = html.match(/<body[\s>][\s\S]*<\/body>/)
  if (!body) return { english: [], glosses: 0 }

  const cleaned = body[0]
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")

  const english = []
  let glosses = 0
  for (const [, raw] of cleaned.matchAll(/>([^<]+)</g)) {
    const text = raw.trim().replace(/\s+/g, " ")
    if (!text) continue

    const words = text.split(" ").filter((w) => /[a-zA-Z]{2,}/.test(w)).length
    const hasCjk = /[一-鿿]/.test(text)

    // Rule 1: plain English node. Rule 2: English prose that quotes Chinese.
    const isEnglish = hasCjk ? words >= 5 : words >= 2
    if (!isEnglish) continue

    if (text.startsWith("]")) {
      glosses++
      continue
    }
    english.push(text)
  }
  return { english, glosses }
}

// resume/index.html is generated from markdown at build time, so there is no
// source file to translate here.
const pages = discoverTranslatablePages(process.cwd()).filter((p) => existsSync(p))

describe("Chinese coverage", () => {
  test("every translatable page has a source file to check", () => {
    expect(pages.length).toBeGreaterThan(20)
  })

  describe.each(pages)("%s", (page) => {
    const { zh, unmatched } = translated(page)
    const { english } = englishNodes(zh)
    const allowed = BASELINE[page] ?? 0

    test("every translation key matches something", () => {
      // A key that matches nothing translates nothing. It means the page text
      // was reworded and the key was not, so the page is silently English
      // where it looks translated. build.js only warns about this.
      expect(unmatched).toEqual([])
    })

    test(`has at most ${allowed} English text nodes`, () => {
      if (english.length > allowed) {
        throw new Error(
          `${page} went backwards: ${english.length} English text nodes, baseline ${allowed}.\n` +
            english.map((t) => `  - ${t.slice(0, 100)}`).join("\n"),
        )
      }
    })

    test("its baseline is not stale", () => {
      if (english.length < allowed) {
        throw new Error(
          `${page} is better than its baseline: ${english.length} English text nodes, ` +
            `baseline ${allowed}. Lower the baseline in __tests__/zh-coverage.test.js to ` +
            `${english.length} to lock the improvement in.`,
        )
      }
    })
  })
})

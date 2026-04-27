#!/usr/bin/env node
//
// Build script for qyearsley.github.io
//
// Pipeline:
//   1. Copy static files to dist/ (skip dev-only files)
//   2. Render resume from markdown
//   3. Generate Chinese (/zh/) translations via text-matching
//   4. Inject translated-paths data for client-side language persistence
//   5. Generate sitemap.xml
//   6. Validate internal links
//

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { marked } from "marked"

const ROOT = dirname(fileURLToPath(import.meta.url))
const DIST = join(ROOT, "dist")

const SKIP_DIRS = new Set(["node_modules", "dist", "docs", "coverage", "i18n"])

const SKIP_FILES = new Set([
  "package.json",
  "package-lock.json",
  "eslint.config.js",
  ".htmlhintrc",
  "CLAUDE.md",
  "build.js",
  "build.test.js",
])

// Output paths (in dist/) that have Chinese translations.
// Used for link rewriting on zh pages and for client-side language persistence.
const TRANSLATABLE_PAGES = [
  "index.html",
  "resume/index.html",
  "games/index.html",
  "games/number-garden/index.html",
  "games/life-garden/index.html",
  "games/turing-tape/index.html",
  "javascript/index.html",
  "javascript/logic-engine/index.html",
  "javascript/markov/index.html",
  "javascript/truth-tables.html",
  "javascript/coin-flipper.html",
  "javascript/series-tester.html",
  "javascript/password-generator.html",
  "javascript/floating-point.html",
  "javascript/hash-collision-lab.html",
  "javascript/cellular-automata.html",
  "javascript/life-calculator.html",
  "chinese/index.html",
  "chinese/syllabary.html",
  "chinese/tone-table.html",
  "chinese/pinyin-abbreviations.html",
  "chinese/homophones.html",
  "chinese/character-converter.html",
  "chinese/encoding-explorer.html",
  "404.html",
]

// Build URL set including directory aliases (/games/ for /games/index.html)
const TRANSLATED_URLS = new Set()
for (const page of TRANSLATABLE_PAGES) {
  TRANSLATED_URLS.add("/" + page)
  if (page.endsWith("/index.html")) {
    TRANSLATED_URLS.add("/" + page.replace(/index\.html$/, ""))
  }
  if (page === "index.html") {
    TRANSLATED_URLS.add("/")
  }
}

// ── File copying ────────────────────────────────────────────────

function clean() {
  if (existsSync(DIST)) rmSync(DIST, { recursive: true })
}

function copyTree(src, dest) {
  mkdirSync(dest, { recursive: true })
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const name = entry.name
    if (name.startsWith(".")) continue
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue
      copyTree(join(src, name), join(dest, name))
    } else {
      if (SKIP_FILES.has(name)) continue
      copyFileSync(join(src, name), join(dest, name))
    }
  }
}

// ── Resume rendering ────────────────────────────────────────────

function generateResume() {
  const mdPath = join(ROOT, "resume", "resume.md")
  const templatePath = join(ROOT, "resume", "template.html")
  if (!existsSync(mdPath) || !existsSync(templatePath)) {
    console.log("  Skipped (missing resume.md or template.html)")
    return
  }
  const md = readFileSync(mdPath, "utf-8")
  const template = readFileSync(templatePath, "utf-8")
  const html = marked.parse(md)
  const page = template.replace("{{CONTENT}}", html)
  const outPath = join(DIST, "resume", "index.html")
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, page)
}

// ── Translation (Chinese) ───────────────────────────────────────

function loadTranslations() {
  const zhDir = join(ROOT, "i18n", "zh")
  if (!existsSync(zhDir)) return null
  const result = loadDir(zhDir, "")
  return Object.keys(result).length > 0 ? result : null
}

function loadDir(dir, prefix) {
  const result = {}
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      Object.assign(result, loadDir(join(dir, entry.name), prefix + entry.name + "/"))
    } else if (entry.name.endsWith(".json")) {
      const key = prefix + entry.name.replace(/\.json$/, "")
      result[key] = JSON.parse(readFileSync(join(dir, entry.name), "utf-8"))
    }
  }
  return result
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// Builds a regex pattern that matches English text in HTML.
// Handles: whitespace normalization (spaces -> \s+), HTML entity ambiguity
// (& matches both & and &amp;).
function buildTextPattern(english) {
  const normalized = english.trim().replace(/\s+/g, " ")
  let escaped = escapeRegex(normalized)
  escaped = escaped.replace(/&/g, "&(?:amp;)?")
  escaped = escaped.replace(/ /g, "\\s+")
  return escaped
}

// Heuristic check for English text that may have been missed by translation.
// Only flags text that looks like natural language (2+ lowercase content words).
function checkUntranslated(html, pagePath) {
  const bodyMatch = html.match(/<body[\s>][\s\S]*<\/body>/)
  if (!bodyMatch) return
  const body = bodyMatch[0]

  const cleaned = body
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")

  const warnings = []
  const textRegex = />([^<]+)</g
  let match
  while ((match = textRegex.exec(cleaned)) !== null) {
    const text = match[1].trim()
    if (text.length < 8) continue
    if (/[\u4e00-\u9fff]/.test(text)) continue
    const asciiLetters = (text.match(/[a-zA-Z]/g) || []).length
    if (asciiLetters / text.length < 0.6) continue
    if (/^https?:|^mailto:/.test(text)) continue
    if (/^[\w.@]+$/.test(text)) continue
    if (/^\([\w, ]+\)$/.test(text)) continue
    if (!/\s/.test(text)) continue
    const lowercaseWords = text.match(/\b[a-z]{3,}\b/g) || []
    if (lowercaseWords.length < 2) continue
    warnings.push(text)
  }

  if (warnings.length > 0) {
    console.warn(`  Possibly untranslated in zh/${pagePath}:`)
    for (const text of warnings) {
      const preview = text.length > 70 ? text.substring(0, 70) + "..." : text
      console.warn(`    "${preview}"`)
    }
  }
}

// Replaces English text content between HTML tags with Chinese translations.
// Entries are sorted longest-first to prevent partial matches.
function translateContent(html, translations, pagePath, commonKeys) {
  let result = html

  if (translations._title) {
    result = result.replace(/(<title>)([\s\S]*?)(<\/title>)/, `$1${translations._title}$3`)
  }

  if (translations._description) {
    result = result.replace(
      /(<meta\s+name="description"\s+content=")([^"]*)(")/,
      `$1${translations._description}$3`,
    )
  }

  const entries = Object.entries(translations)
    .filter(([key]) => !key.startsWith("_"))
    .sort(([a], [b]) => b.length - a.length)

  for (const [english, chinese] of entries) {
    if (english === chinese) continue
    const pattern = buildTextPattern(english)
    const regex = new RegExp(`(>\\s*)(${pattern})(\\s*<)`, "g")

    const before = result
    result = result.replace(regex, `$1${chinese}$3`)

    if (result === before && !commonKeys.has(english)) {
      const preview = english.length > 60 ? english.substring(0, 60) + "..." : english
      console.warn(`  Warning: no match for "${preview}" in ${pagePath}`)
    }
  }

  return result
}

// Adds hreflang <link> tags and a language switcher link to an HTML page.
function injectLangMeta(html, pagePath, targetLang) {
  let result = html

  const enUrl = "/" + pagePath
  const zhUrl = "/zh/" + pagePath

  const hreflang = [
    `    <link rel="alternate" hreflang="en" href="${enUrl}" />`,
    `    <link rel="alternate" hreflang="zh" href="${zhUrl}" />`,
    `    <link rel="alternate" hreflang="x-default" href="${enUrl}" />`,
  ].join("\n")
  result = result.replace("</head>", `${hreflang}\n  </head>`)

  const isZh = targetLang === "zh"
  const switchHref = isZh ? enUrl : zhUrl
  const switchLang = isZh ? "en" : "zh"
  const switchLabel = isZh ? "English" : "中文"
  const switchHtml = `\n        <div class="header-controls">\n          <a href="${switchHref}" class="lang-switch" lang="${switchLang}">${switchLabel}</a>\n        </div>`
  result = result.replace("</header>", `${switchHtml}\n      </header>`)

  return result
}

// Generates a full Chinese translation of an HTML page.
function translateHtml(html, translations, pagePath, commonKeys) {
  let result = html

  result = result.replace('<html lang="en"', '<html lang="zh"')
  result = translateContent(result, translations, pagePath, commonKeys)

  result = result.replace(/href="(\/[^"]*?)"/g, (match, href) => {
    return TRANSLATED_URLS.has(href) ? `href="/zh${href}"` : match
  })

  result = injectLangMeta(result, pagePath, "zh")
  return result
}

function injectEnglishMeta(html, pagePath) {
  return injectLangMeta(html, pagePath, "en")
}

// ── Sitemap and link validation ─────────────────────────────────

function findHtmlFiles(dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      files.push(...findHtmlFiles(join(dir, entry.name)))
    } else if (entry.name.endsWith(".html")) {
      files.push(join(dir, entry.name))
    }
  }
  return files
}

function generateSitemap() {
  const baseUrl = "https://qyearsley.github.io"
  const htmlFiles = findHtmlFiles(DIST)
  const urls = []

  for (const file of htmlFiles) {
    let urlPath = file.slice(DIST.length).replace(/\\/g, "/")
    if (urlPath.endsWith("/index.html")) {
      urlPath = urlPath.replace(/index\.html$/, "")
    }
    urls.push(baseUrl + urlPath)
  }

  urls.sort()
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((url) => `  <url><loc>${url}</loc></url>`),
    "</urlset>",
    "",
  ].join("\n")

  writeFileSync(join(DIST, "sitemap.xml"), xml)
  console.log(`  Generated sitemap.xml (${urls.length} URLs)`)
}

function validateLinks() {
  const htmlFiles = findHtmlFiles(DIST)
  const existingPaths = new Set()

  for (const file of htmlFiles) {
    const relPath = file.slice(DIST.length).replace(/\\/g, "/")
    existingPaths.add(relPath)
    if (relPath.endsWith("/index.html")) {
      existingPaths.add(relPath.replace(/index\.html$/, ""))
    }
  }

  for (const file of readdirSync(DIST, { recursive: true })) {
    existingPaths.add("/" + file.replace(/\\/g, "/"))
  }

  let brokenCount = 0
  for (const file of htmlFiles) {
    const html = readFileSync(file, "utf-8")
    const linkRegex = /href="(\/[^"#]*?)"/g
    let match
    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1]
      if (!existingPaths.has(href)) {
        const relFile = file.slice(DIST.length + 1)
        console.warn(`  Broken link in ${relFile}: ${href}`)
        brokenCount++
      }
    }
  }

  if (brokenCount > 0) {
    console.warn(`  ${brokenCount} broken link(s) found.`)
  } else {
    console.log("  All internal links valid.")
  }
}

// Injects the TRANSLATED_URLS set as a <script> tag into every HTML file
// so nav.js can rewrite links client-side for language persistence.
function injectTranslatedPaths() {
  const pathsJson = JSON.stringify([...TRANSLATED_URLS])
  const script = `<script>window.__translatedPaths=${pathsJson}</script>`
  for (const file of findHtmlFiles(DIST)) {
    let html = readFileSync(file, "utf-8")
    if (html.includes("/shared/nav.js")) {
      html = html.replace(
        '<script src="/shared/nav.js">',
        `${script}\n    <script src="/shared/nav.js">`,
      )
      writeFileSync(file, html)
    }
  }
}

// ── Build pipeline ──────────────────────────────────────────────

function build() {
  console.log("Cleaning dist/...")
  clean()

  console.log("Copying files...")
  copyTree(ROOT, DIST)

  console.log("Generating resume from markdown...")
  generateResume()

  const allTranslations = loadTranslations()
  if (!allTranslations) {
    console.log("No i18n/zh/ directory found. Skipping translations.")
    console.log("Done.")
    return
  }

  const common = allTranslations._common || {}
  const commonKeys = new Set(Object.keys(common).filter((k) => !k.startsWith("_")))

  console.log("Generating translations...")
  for (const page of TRANSLATABLE_PAGES) {
    const pageKey =
      page === "index.html" ? "index" : page.replace(/\/index\.html$/, "").replace(/\.html$/, "")

    const pageOnly = allTranslations[pageKey]
    if (!pageOnly) {
      console.warn(`  Warning: no translations for "${pageKey}" (${page})`)
      continue
    }

    const translations = { ...common, ...pageOnly }

    const srcPath = join(DIST, page)
    if (!existsSync(srcPath)) {
      console.warn(`  Warning: page not found: ${page}`)
      continue
    }

    const html = readFileSync(srcPath, "utf-8")

    const zhHtml = translateHtml(html, translations, page, commonKeys)
    const zhPath = join(DIST, "zh", page)
    mkdirSync(dirname(zhPath), { recursive: true })
    writeFileSync(zhPath, zhHtml)
    checkUntranslated(zhHtml, page)
    console.log(`  zh/${page}`)

    const enHtml = injectEnglishMeta(html, page)
    writeFileSync(srcPath, enHtml)
  }

  console.log("Injecting translated paths...")
  injectTranslatedPaths()

  console.log("Generating sitemap...")
  generateSitemap()

  console.log("Validating links...")
  validateLinks()

  console.log("Done.")
}

export { escapeRegex, buildTextPattern, translateHtml, injectEnglishMeta, TRANSLATED_URLS }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  build()
}

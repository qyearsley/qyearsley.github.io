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
// `--verbose` enables the untranslated-text heuristic, which scans each
// generated /zh/ page and warns about English that looks like it was missed.
const VERBOSE = process.argv.includes("--verbose")

const SKIP_DIRS = new Set(["node_modules", "dist", "docs", "coverage"])

const SKIP_FILES = new Set([
  "package.json",
  "package-lock.json",
  "eslint.config.js",
  ".htmlhintrc",
  "CLAUDE.md",
  "build.js",
  "build.test.js",
  "zh-common.json",
])

// Output paths (in dist/) that have Chinese translations.
// Discovered from `*.zh.json` files co-located with HTML pages.
// Used for link rewriting on zh pages and for client-side language persistence.
function discoverTranslatablePages(rootDir = ROOT) {
  const pages = []
  function walk(dir, prefix) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const name = entry.name
      if (name.startsWith(".")) continue
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(name)) continue
        walk(join(dir, name), prefix + name + "/")
      } else if (name.endsWith(".zh.json")) {
        pages.push(prefix + name.replace(/\.zh\.json$/, ".html"))
      }
    }
  }
  walk(rootDir, "")
  return pages.sort()
}

const TRANSLATABLE_PAGES = discoverTranslatablePages()

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

function clean(dir = DIST) {
  if (existsSync(dir)) rmSync(dir, { recursive: true })
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
      if (name.endsWith(".zh.json")) continue
      copyFileSync(join(src, name), join(dest, name))
    }
  }
}

// ── Resume rendering ────────────────────────────────────────────

function generateResume() {
  const mdPath = join(ROOT, "resume", "resume.md")
  const templatePath = join(ROOT, "resume", "template.html")
  if (!existsSync(mdPath) || !existsSync(templatePath)) {
    console.log("  Skipped: resume.md or template.html not found")
    return
  }
  const md = readFileSync(mdPath, "utf-8")
  const template = readFileSync(templatePath, "utf-8")
  const html = marked.parse(md)
  const page = template.replace("{{CONTENT}}", html)
  const outPath = join(DIST, "resume", "index.html")
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, page)
  console.log("  Wrote resume/index.html")
}

// ── Translation (Chinese) ───────────────────────────────────────

// JSON.parse silently keeps the last of any repeated key, so a duplicate is
// invisible at runtime but leaves a dead line in the file. Scan the raw text
// for top-level keys and warn on repeats.
function findDuplicateKeys(json) {
  const seen = new Set()
  const duplicates = []
  for (const [, key] of json.matchAll(/^\s*"((?:[^"\\]|\\.)*)"\s*:/gm)) {
    if (seen.has(key)) duplicates.push(key)
    else seen.add(key)
  }
  return duplicates
}

function parseTranslationFile(path, label) {
  const raw = readFileSync(path, "utf-8")
  for (const key of findDuplicateKeys(raw)) {
    console.warn(`  Warning: duplicate key "${key}" in ${label}`)
  }
  return JSON.parse(raw)
}

function loadTranslations(rootDir = ROOT) {
  const commonPath = join(rootDir, "zh-common.json")
  if (!existsSync(commonPath)) return null
  const common = parseTranslationFile(commonPath, "zh-common.json")

  const pages = {}
  for (const page of discoverTranslatablePages(rootDir)) {
    const relPath = page.replace(/\.html$/, ".zh.json")
    pages[page] = parseTranslationFile(join(rootDir, relPath), relPath)
  }

  return { common, pages }
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
// Only flags text that looks like natural language (multiple lowercase content words).
// The thresholds below are deliberately loose to avoid false positives on code,
// URLs, and short labels; tune them up if real misses slip through.
const MIN_TEXT_LENGTH = 8 // ignore snippets shorter than this many characters
const MIN_ASCII_RATIO = 0.6 // fraction of chars that must be ASCII letters (filters mostly-symbol text)
const MIN_LOWERCASE_WORDS = 2 // require at least this many lowercase words (a sentence, not a label)
const MIN_WORD_LENGTH = 3 // a "word" must be at least this many letters to count

function checkUntranslated(html, pagePath) {
  const bodyMatch = html.match(/<body[\s>][\s\S]*<\/body>/)
  if (!bodyMatch) return []
  const body = bodyMatch[0]

  const cleaned = body
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")

  const warnings = []
  const textRegex = />([^<]+)</g
  let match
  while ((match = textRegex.exec(cleaned)) !== null) {
    const text = match[1].trim()
    if (text.length < MIN_TEXT_LENGTH) continue
    if (/[\u4e00-\u9fff]/.test(text)) continue
    const asciiLetters = (text.match(/[a-zA-Z]/g) || []).length
    if (asciiLetters / text.length < MIN_ASCII_RATIO) continue
    if (/^https?:|^mailto:/.test(text)) continue
    if (/^[\w.@]+$/.test(text)) continue
    if (/^\([\w, ]+\)$/.test(text)) continue
    if (!/\s/.test(text)) continue
    const lowercaseWords = text.match(new RegExp(`\\b[a-z]{${MIN_WORD_LENGTH},}\\b`, "g")) || []
    if (lowercaseWords.length < MIN_LOWERCASE_WORDS) continue
    warnings.push(text)
  }

  if (warnings.length > 0 && pagePath) {
    console.warn(`  Possibly untranslated in zh/${pagePath}:`)
    for (const text of warnings) {
      const preview = text.length > 70 ? text.substring(0, 70) + "..." : text
      console.warn(`    "${preview}"`)
    }
  }

  return warnings
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

    // Page-specific keys that don't match suggest stale translations
    // (renamed or deleted source text). Common keys often won't match on a
    // given page, so we skip the warning for those.
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

// Rewrites relative asset paths (href, src, ES module imports) to absolute
// paths so that /zh/ pages can resolve them from the original location.
function rewriteRelativePaths(html, pagePath) {
  const baseDir = "/" + pagePath.replace(/[^/]*$/, "")

  // Rewrite href="relative" and src="relative" (skip absolute, fragment, protocol)
  html = html.replace(/((?:href|src)=")([^/"#\s][^"]*")/g, (match, prefix, relPath) => {
    if (/^(https?:|mailto:|data:)/.test(relPath)) return match
    return prefix + baseDir + relPath
  })

  // Rewrite from "./relative" and from './relative'
  html = html.replace(/(\bfrom\s+["'])(\.\/)([^"']+["'])/g, (match, prefix, dot, rest) => {
    return prefix + baseDir + rest
  })

  return html
}

// Generates a full Chinese translation of an HTML page.
function translateHtml(html, translations, pagePath, commonKeys) {
  let result = html

  result = result.replace('<html lang="en"', '<html lang="zh"')
  result = translateContent(result, translations, pagePath, commonKeys)

  result = result.replace(/href="(\/[^"]*?)"/g, (match, href) => {
    return TRANSLATED_URLS.has(href) ? `href="/zh${href}"` : match
  })

  result = rewriteRelativePaths(result, pagePath)
  result = injectLangMeta(result, pagePath, "zh")
  return result
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

function generateSitemap(distDir = DIST) {
  const baseUrl = "https://qyearsley.github.io"
  const htmlFiles = findHtmlFiles(distDir)
  const zhPaths = new Set()
  for (const page of TRANSLATABLE_PAGES) {
    zhPaths.add("/zh/" + page)
    if (page.endsWith("/index.html")) {
      zhPaths.add("/zh/" + page.replace(/index\.html$/, ""))
    }
    if (page === "index.html") {
      zhPaths.add("/zh/")
    }
  }

  const urls = []
  for (const file of htmlFiles) {
    let urlPath = file.slice(distDir.length).replace(/\\/g, "/")
    if (urlPath.endsWith("/index.html")) {
      urlPath = urlPath.replace(/index\.html$/, "")
    }
    if (zhPaths.has(urlPath)) continue
    urls.push(urlPath)
  }

  urls.sort()
  const xmlns =
    'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ' +
    'xmlns:xhtml="http://www.w3.org/1999/xhtml"'
  const entries = urls.map((urlPath) => {
    const loc = `    <loc>${baseUrl}${urlPath}</loc>`
    const zhUrlPath = urlPath === "/" ? "/zh/" : "/zh" + urlPath
    if (zhPaths.has(zhUrlPath) || zhPaths.has("/zh" + urlPath + "index.html")) {
      const enAlt = `    <xhtml:link rel="alternate" hreflang="en" href="${baseUrl}${urlPath}" />`
      const zhAlt = `    <xhtml:link rel="alternate" hreflang="zh" href="${baseUrl}${zhUrlPath}" />`
      return `  <url>\n${loc}\n${enAlt}\n${zhAlt}\n  </url>`
    }
    return `  <url>\n${loc}\n  </url>`
  })

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<urlset ${xmlns}>`,
    ...entries,
    "</urlset>",
    "",
  ].join("\n")

  writeFileSync(join(distDir, "sitemap.xml"), xml)
  console.log(`  Generated sitemap.xml (${urls.length} URLs)`)
}

function validateLinks(distDir = DIST) {
  const htmlFiles = findHtmlFiles(distDir)
  const existingPaths = new Set()

  for (const file of htmlFiles) {
    const relPath = file.slice(distDir.length).replace(/\\/g, "/")
    existingPaths.add(relPath)
    if (relPath.endsWith("/index.html")) {
      existingPaths.add(relPath.replace(/index\.html$/, ""))
    }
  }

  for (const file of readdirSync(distDir, { recursive: true })) {
    existingPaths.add("/" + file.replace(/\\/g, "/"))
  }

  let brokenCount = 0
  for (const file of htmlFiles) {
    const html = readFileSync(file, "utf-8")
    // Match absolute internal links (starting with /), ignoring fragments
    const linkRegex = /href="(\/[^"#]*?)"/g
    let match
    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1]
      if (!existingPaths.has(href)) {
        const relFile = file.slice(distDir.length + 1)
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
  return brokenCount
}

// Injects the TRANSLATED_URLS set as a <script> tag into every HTML file
// so nav.js can rewrite links client-side for language persistence.
function injectTranslatedPaths(distDir = DIST) {
  const pathsJson = JSON.stringify([...TRANSLATED_URLS])
  const script = `<script>window.__translatedPaths=${pathsJson}</script>`
  // Match the nav.js script tag tolerating attribute order, extra attributes,
  // and whitespace variations.
  const navScriptRegex = /<script\b[^>]*\bsrc="\/shared\/nav\.js"[^>]*><\/script>/
  let injected = 0
  for (const file of findHtmlFiles(distDir)) {
    let html = readFileSync(file, "utf-8")
    const match = html.match(navScriptRegex)
    if (match) {
      html = html.replace(match[0], `${script}\n    ${match[0]}`)
      writeFileSync(file, html)
      injected++
    }
  }
  if (injected === 0) {
    console.warn("  Warning: no files reference nav.js — translated paths not injected")
  }
  return injected
}

// ── Build pipeline ──────────────────────────────────────────────

function build() {
  console.log("Cleaning dist/...")
  clean()

  console.log("Copying files...")
  copyTree(ROOT, DIST)

  console.log("Generating resume from markdown...")
  generateResume()

  const data = loadTranslations()
  if (!data) {
    console.log("No zh-common.json found. Skipping translations.")
    console.log("Done.")
    return
  }

  const common = data.common
  const commonKeys = new Set(Object.keys(common).filter((k) => !k.startsWith("_")))

  console.log("Generating translations...")
  for (const page of TRANSLATABLE_PAGES) {
    const pageOnly = data.pages[page]

    const translations = pageOnly ? { ...common, ...pageOnly } : { ...common }

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
    if (VERBOSE) checkUntranslated(zhHtml, page)
    console.log(`  zh/${page}`)

    const enHtml = injectLangMeta(html, page, "en")
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

export {
  escapeRegex,
  buildTextPattern,
  findDuplicateKeys,
  translateContent,
  translateHtml,
  rewriteRelativePaths,
  injectLangMeta,
  checkUntranslated,
  clean,
  copyTree,
  findHtmlFiles,
  loadTranslations,
  discoverTranslatablePages,
  generateSitemap,
  validateLinks,
  injectTranslatedPaths,
  TRANSLATABLE_PAGES,
  TRANSLATED_URLS,
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  build()
}

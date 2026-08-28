/**
 * @jest-environment node
 */
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import {
  escapeRegex,
  buildTextPattern,
  clean,
  copyTree,
  discoverTranslatablePages,
  findDuplicateKeys,
  findHtmlFiles,
  generateSitemap,
  injectLangMeta,
  injectTranslatedPaths,
  loadTranslations,
  rewriteRelativePaths,
  translateContent,
  translateHtml,
  validateLinks,
  checkUntranslated,
  TRANSLATABLE_PAGES,
  TRANSLATED_URLS,
} from "./build.js"

// Helper: write a file under a base dir, creating parents as needed.
function writeFile(base, relPath, content) {
  const full = join(base, relPath)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
  return full
}

describe("escapeRegex", () => {
  test("escapes special regex characters", () => {
    expect(escapeRegex("a.b")).toBe("a\\.b")
    expect(escapeRegex("a+b")).toBe("a\\+b")
    expect(escapeRegex("(a|b)")).toBe("\\(a\\|b\\)")
    expect(escapeRegex("a[0]")).toBe("a\\[0\\]")
  })

  test("leaves plain text unchanged", () => {
    expect(escapeRegex("hello world")).toBe("hello world")
    expect(escapeRegex("About")).toBe("About")
  })
})

describe("buildTextPattern", () => {
  test("normalizes whitespace to flexible pattern", () => {
    const pattern = buildTextPattern("hello  world")
    expect("hello world").toMatch(new RegExp(pattern))
    expect("hello  world").toMatch(new RegExp(pattern))
    expect("hello\nworld").toMatch(new RegExp(pattern))
  })

  test("trims leading/trailing whitespace", () => {
    const pattern = buildTextPattern("  About  ")
    expect("About").toMatch(new RegExp(pattern))
  })

  test("handles ampersand ambiguity", () => {
    const pattern = buildTextPattern("Projects & Experiments")
    expect("Projects & Experiments").toMatch(new RegExp(pattern))
    expect("Projects &amp; Experiments").toMatch(new RegExp(pattern))
  })

  test("escapes special characters in text", () => {
    const pattern = buildTextPattern("0.1 + 0.2")
    expect("0.1 + 0.2").toMatch(new RegExp(pattern))
    expect("0X1 + 0X2").not.toMatch(new RegExp(pattern))
  })

  test("handles multiline text", () => {
    const pattern = buildTextPattern("I am a software engineer.\n    I enjoy building tools.")
    expect("I am a software engineer. I enjoy building tools.").toMatch(new RegExp(pattern))
  })

  test("matches across long whitespace runs and mixed whitespace types", () => {
    const pattern = buildTextPattern("hello world")
    expect("hello\t\tworld").toMatch(new RegExp(pattern))
    expect("hello          world").toMatch(new RegExp(pattern))
    expect("hello\n\n  \t  world").toMatch(new RegExp(pattern))
  })
})

describe("findDuplicateKeys", () => {
  test("returns nothing for a file with unique keys", () => {
    const json = '{\n  "a": "1",\n  "b": "2"\n}'
    expect(findDuplicateKeys(json)).toEqual([])
  })

  test("finds a repeated key", () => {
    const json = '{\n  "Generate": "生成",\n  "Other": "其他",\n  "Generate": "生成"\n}'
    expect(findDuplicateKeys(json)).toEqual(["Generate"])
  })

  test("finds several repeated keys", () => {
    const json = '{\n  "a": "1",\n  "b": "2",\n  "a": "1",\n  "b": "2"\n}'
    expect(findDuplicateKeys(json)).toEqual(["a", "b"])
  })

  test("ignores keys appearing in values", () => {
    const json = '{\n  "a": "see \\"a\\" above",\n  "b": "2"\n}'
    expect(findDuplicateKeys(json)).toEqual([])
  })

  test("handles keys containing escaped quotes", () => {
    const json = '{\n  "say \\"hi\\"": "1",\n  "say \\"hi\\"": "1"\n}'
    expect(findDuplicateKeys(json)).toEqual(['say \\"hi\\"'])
  })
})

describe("translateHtml", () => {
  const emptyCommon = new Set()

  test("replaces lang attribute", () => {
    const html = '<html lang="en"><head></head><body><header></header></body></html>'
    const result = translateHtml(html, {}, "test.html", emptyCommon)
    expect(result).toContain('lang="zh"')
  })

  test("replaces title when _title is provided", () => {
    const html =
      '<html lang="en"><head><title>My Page</title></head><body><header></header></body></html>'
    const result = translateHtml(html, { _title: "我的页面" }, "test.html", emptyCommon)
    expect(result).toContain("<title>我的页面</title>")
  })

  test("replaces meta description", () => {
    const html =
      '<html lang="en"><head><meta name="description" content="English desc" /></head><body><header></header></body></html>'
    const result = translateHtml(html, { _description: "中文描述" }, "test.html", emptyCommon)
    expect(result).toContain('content="中文描述"')
  })

  test("replaces text content between tags", () => {
    const html = '<html lang="en"><head></head><body><header></header><h2>About</h2></body></html>'
    const result = translateHtml(html, { About: "关于" }, "test.html", emptyCommon)
    expect(result).toContain(">关于<")
  })

  test("handles multiline text content", () => {
    const html =
      '<html lang="en"><head></head><body><header></header><p>\n    Hello world\n  </p></body></html>'
    const result = translateHtml(html, { "Hello world": "你好世界" }, "test.html", emptyCommon)
    expect(result).toContain("你好世界")
    expect(result).not.toContain("Hello world")
  })

  test("replaces longer matches before shorter ones", () => {
    const html =
      '<html lang="en"><head></head><body><header></header>' +
      "<h2>Experiments and Tools</h2>" +
      "<span>Experiments</span></body></html>"
    const result = translateHtml(
      html,
      { "Experiments and Tools": "实验与工具", Experiments: "实验" },
      "test.html",
      emptyCommon,
    )
    expect(result).toContain(">实验与工具<")
    expect(result).toContain(">实验<")
  })

  test("rewrites internal links to /zh/ equivalents", () => {
    const html =
      '<html lang="en"><head></head><body><header></header>' +
      '<a href="/games/index.html">Games</a></body></html>'
    const result = translateHtml(html, {}, "test.html", emptyCommon)
    expect(result).toContain('href="/zh/games/index.html"')
  })

  test("does not rewrite external or untranslated links", () => {
    const html =
      '<html lang="en"><head></head><body><header></header>' +
      '<a href="https://github.com">GH</a>' +
      '<a href="/some/random/page.html">X</a></body></html>'
    const result = translateHtml(html, {}, "test.html", emptyCommon)
    expect(result).toContain('href="https://github.com"')
    expect(result).toContain('href="/some/random/page.html"')
  })

  test("adds hreflang tags", () => {
    const html = '<html lang="en"><head></head><body><header></header></body></html>'
    const result = translateHtml(html, {}, "index.html", emptyCommon)
    expect(result).toContain('hreflang="en"')
    expect(result).toContain('hreflang="zh"')
    expect(result).toContain('hreflang="x-default"')
  })

  test("injects language switcher", () => {
    const html = '<html lang="en"><head></head><body><header></header></body></html>'
    const result = translateHtml(html, {}, "index.html", emptyCommon)
    expect(result).toContain("lang-switch")
    expect(result).toContain("English")
  })

  test("wraps language switcher in header-controls div", () => {
    const html = '<html lang="en"><head></head><body><header></header></body></html>'
    const result = translateHtml(html, {}, "index.html", emptyCommon)
    expect(result).toContain('class="header-controls"')
    expect(result).toMatch(/header-controls[\s\S]*lang-switch/)
  })

  test("handles &amp; in HTML content", () => {
    const html =
      '<html lang="en"><head></head><body><header></header>' +
      "<h2>Projects &amp; Experiments</h2></body></html>"
    const result = translateHtml(
      html,
      { "Projects & Experiments": "项目与实验" },
      "test.html",
      emptyCommon,
    )
    expect(result).toContain("项目与实验")
  })

  test("skips entries where english equals chinese", () => {
    const html =
      '<html lang="en"><head></head><body><header></header>' +
      "<span>JavaScript</span></body></html>"
    const result = translateHtml(html, { JavaScript: "JavaScript" }, "test.html", emptyCommon)
    expect(result).toContain(">JavaScript<")
  })
})

describe("TRANSLATED_URLS", () => {
  test("includes root URL", () => {
    expect(TRANSLATED_URLS.has("/")).toBe(true)
  })

  test("includes both /dir/ and /dir/index.html forms", () => {
    expect(TRANSLATED_URLS.has("/games/")).toBe(true)
    expect(TRANSLATED_URLS.has("/games/index.html")).toBe(true)
  })

  test("includes non-index HTML pages", () => {
    expect(TRANSLATED_URLS.has("/javascript/truth-tables.html")).toBe(true)
    expect(TRANSLATED_URLS.has("/404.html")).toBe(true)
  })

  test("does not include non-existent pages", () => {
    expect(TRANSLATED_URLS.has("/nonexistent.html")).toBe(false)
  })
})

describe("checkUntranslated", () => {
  test("returns empty for fully Chinese content", () => {
    const html = "<body><p>这是中文内容</p></body>"
    expect(checkUntranslated(html)).toEqual([])
  })

  test("flags English sentences in body", () => {
    const html = "<body><p>This is clearly untranslated English text here</p></body>"
    const warnings = checkUntranslated(html)
    expect(warnings.length).toBe(1)
    expect(warnings[0]).toContain("untranslated English")
  })

  test("ignores short text fragments", () => {
    const html = "<body><span>OK fine</span></body>"
    expect(checkUntranslated(html)).toEqual([])
  })

  test("ignores URLs", () => {
    const html = "<body><a>https://example.com/some/long/path/here</a></body>"
    expect(checkUntranslated(html)).toEqual([])
  })

  test("ignores identifiers and email-like text", () => {
    const html = "<body><code>some.module.function.name</code></body>"
    expect(checkUntranslated(html)).toEqual([])
  })

  test("ignores text inside script and style tags", () => {
    const html =
      "<body><script>const message = 'this should not be flagged at all'</script><p>中文</p></body>"
    expect(checkUntranslated(html)).toEqual([])
  })

  test("ignores single-word text even if long", () => {
    const html = "<body><span>Internationalization</span></body>"
    expect(checkUntranslated(html)).toEqual([])
  })

  test("returns empty when no body tag exists", () => {
    const html = "<div>some random text that is english</div>"
    expect(checkUntranslated(html)).toEqual([])
  })

  test("ignores parenthesized word lists", () => {
    const html = "<body><span>(width, height, depth)</span></body>"
    expect(checkUntranslated(html)).toEqual([])
  })
})

describe("rewriteRelativePaths", () => {
  test("rewrites relative href to absolute", () => {
    const html = '<a href="page.html">Link</a>'
    const result = rewriteRelativePaths(html, "games/index.html")
    expect(result).toContain('href="/games/page.html"')
  })

  test("rewrites relative src to absolute", () => {
    const html = '<img src="logo.png" />'
    const result = rewriteRelativePaths(html, "javascript/app/index.html")
    expect(result).toContain('src="/javascript/app/logo.png"')
  })

  test("does not rewrite absolute paths", () => {
    const html = '<a href="/games/index.html">Games</a>'
    const result = rewriteRelativePaths(html, "index.html")
    expect(result).toContain('href="/games/index.html"')
  })

  test("does not rewrite protocol URLs", () => {
    const html = '<a href="https://example.com">External</a>'
    const result = rewriteRelativePaths(html, "games/index.html")
    expect(result).toContain('href="https://example.com"')
  })

  test("does not rewrite fragment-only hrefs", () => {
    const html = '<a href="#section">Jump</a>'
    const result = rewriteRelativePaths(html, "games/index.html")
    expect(result).toContain('href="#section"')
  })

  test("rewrites ES module from './' imports", () => {
    const html = `<script type="module">import { foo } from "./utils.js"</script>`
    const result = rewriteRelativePaths(html, "javascript/app/index.html")
    expect(result).toContain('from "/javascript/app/utils.js"')
  })

  test("does not rewrite non-relative module imports", () => {
    const html = `<script type="module">import { foo } from "/shared/utils.js"</script>`
    const result = rewriteRelativePaths(html, "games/index.html")
    expect(result).toContain('from "/shared/utils.js"')
  })
})

describe("injectLangMeta", () => {
  const baseHtml = "<head></head><body><header></header></body>"

  test("adds hreflang tags for en target", () => {
    const result = injectLangMeta(baseHtml, "games/index.html", "en")
    expect(result).toContain('hreflang="en" href="/games/index.html"')
    expect(result).toContain('hreflang="zh" href="/zh/games/index.html"')
    expect(result).toContain('hreflang="x-default" href="/games/index.html"')
  })

  test("adds hreflang tags for zh target", () => {
    const result = injectLangMeta(baseHtml, "index.html", "zh")
    expect(result).toContain('hreflang="en" href="/index.html"')
    expect(result).toContain('hreflang="zh" href="/zh/index.html"')
  })

  test("injects English switcher on zh pages", () => {
    const result = injectLangMeta(baseHtml, "index.html", "zh")
    expect(result).toContain("English")
    expect(result).toContain('lang="en"')
    expect(result).toContain('href="/index.html"')
  })

  test("injects Chinese switcher on en pages", () => {
    const result = injectLangMeta(baseHtml, "index.html", "en")
    expect(result).toContain("中文")
    expect(result).toContain('lang="zh"')
    expect(result).toContain('href="/zh/index.html"')
  })

  test("places hreflang before closing head tag", () => {
    const result = injectLangMeta(baseHtml, "index.html", "en")
    const headEnd = result.indexOf("</head>")
    const hreflang = result.indexOf("hreflang")
    expect(hreflang).toBeLessThan(headEnd)
  })

  test("places switcher before closing header tag", () => {
    const result = injectLangMeta(baseHtml, "index.html", "en")
    const headerEnd = result.indexOf("</header>")
    const switcher = result.indexOf("lang-switch")
    expect(switcher).toBeLessThan(headerEnd)
  })
})

// ── File-system tests ─────────────────────────────────────────────
// Each suite gets a fresh temp directory so tests are isolated and
// safely runnable in parallel.

describe("clean", () => {
  let tmp

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "build-clean-"))
  })

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  test("removes the target directory and its contents recursively", () => {
    const target = join(tmp, "out")
    writeFile(target, "a.html", "<p>1</p>")
    writeFile(target, "nested/deep/b.html", "<p>2</p>")
    expect(existsSync(target)).toBe(true)

    clean(target)

    expect(existsSync(target)).toBe(false)
  })

  test("is a no-op when the directory does not exist", () => {
    const target = join(tmp, "does-not-exist")
    expect(() => clean(target)).not.toThrow()
    expect(existsSync(target)).toBe(false)
  })
})

describe("copyTree", () => {
  let tmp, src, dest

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "build-copy-"))
    src = join(tmp, "src")
    dest = join(tmp, "dest")
  })

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  test("copies regular files and nested directories", () => {
    writeFile(src, "index.html", "<p>root</p>")
    writeFile(src, "nested/page.html", "<p>nested</p>")
    writeFile(src, "css/style.css", "body{}")

    copyTree(src, dest)

    expect(readFileSync(join(dest, "index.html"), "utf-8")).toBe("<p>root</p>")
    expect(readFileSync(join(dest, "nested/page.html"), "utf-8")).toBe("<p>nested</p>")
    expect(readFileSync(join(dest, "css/style.css"), "utf-8")).toBe("body{}")
  })

  test("skips dotfiles and dotdirectories", () => {
    writeFile(src, ".env", "SECRET=1")
    writeFile(src, ".git/HEAD", "ref")
    writeFile(src, "keep.html", "<p>ok</p>")

    copyTree(src, dest)

    expect(existsSync(join(dest, ".env"))).toBe(false)
    expect(existsSync(join(dest, ".git"))).toBe(false)
    expect(existsSync(join(dest, "keep.html"))).toBe(true)
  })

  test("skips dev-only directories (node_modules, dist, docs, coverage)", () => {
    writeFile(src, "node_modules/foo/package.json", "{}")
    writeFile(src, "dist/old.html", "stale")
    writeFile(src, "docs/development.md", "# Dev")
    writeFile(src, "coverage/index.html", "report")
    writeFile(src, "site.html", "<p>ok</p>")

    copyTree(src, dest)

    expect(existsSync(join(dest, "node_modules"))).toBe(false)
    expect(existsSync(join(dest, "dist"))).toBe(false)
    expect(existsSync(join(dest, "docs"))).toBe(false)
    expect(existsSync(join(dest, "coverage"))).toBe(false)
    expect(existsSync(join(dest, "site.html"))).toBe(true)
  })

  test("skips build configuration files at any depth", () => {
    writeFile(src, "package.json", "{}")
    writeFile(src, "package-lock.json", "{}")
    writeFile(src, "eslint.config.js", "export default []")
    writeFile(src, "build.js", "// build")
    writeFile(src, "build.test.js", "// tests")
    writeFile(src, "CLAUDE.md", "# Notes")
    writeFile(src, ".htmlhintrc", "{}")
    writeFile(src, "index.html", "<p>ok</p>")

    copyTree(src, dest)

    for (const f of [
      "package.json",
      "package-lock.json",
      "eslint.config.js",
      "build.js",
      "build.test.js",
      "CLAUDE.md",
      ".htmlhintrc",
    ]) {
      expect(existsSync(join(dest, f))).toBe(false)
    }
    expect(existsSync(join(dest, "index.html"))).toBe(true)
  })

  test("skips translation source files (*.zh.json, zh-common.json)", () => {
    writeFile(src, "zh-common.json", '{"a":"b"}')
    writeFile(src, "page.zh.json", '{"_title":"中文"}')
    writeFile(src, "nested/sub.zh.json", "{}")
    writeFile(src, "page.html", "<p>ok</p>")

    copyTree(src, dest)

    expect(existsSync(join(dest, "zh-common.json"))).toBe(false)
    expect(existsSync(join(dest, "page.zh.json"))).toBe(false)
    expect(existsSync(join(dest, "nested/sub.zh.json"))).toBe(false)
    expect(existsSync(join(dest, "page.html"))).toBe(true)
  })

  test("creates the destination directory if it does not exist", () => {
    writeFile(src, "a.html", "1")
    expect(existsSync(dest)).toBe(false)

    copyTree(src, dest)

    expect(existsSync(dest)).toBe(true)
  })
})

describe("findHtmlFiles", () => {
  let tmp

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "build-find-"))
  })

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  test("returns all .html files in nested directories", () => {
    writeFile(tmp, "index.html", "")
    writeFile(tmp, "a/b.html", "")
    writeFile(tmp, "a/c/d.html", "")

    const files = findHtmlFiles(tmp)
      .map((f) => f.slice(tmp.length).replace(/\\/g, "/"))
      .sort()

    expect(files).toEqual(["/a/b.html", "/a/c/d.html", "/index.html"])
  })

  test("ignores non-html files", () => {
    writeFile(tmp, "page.html", "")
    writeFile(tmp, "style.css", "")
    writeFile(tmp, "data.json", "")
    writeFile(tmp, "README.md", "")

    const files = findHtmlFiles(tmp)

    expect(files).toHaveLength(1)
    expect(files[0]).toMatch(/page\.html$/)
  })

  test("returns empty array for an empty directory", () => {
    expect(findHtmlFiles(tmp)).toEqual([])
  })
})

describe("loadTranslations", () => {
  let tmp

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "build-load-"))
  })

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  test("returns null when zh-common.json is absent", () => {
    expect(loadTranslations(tmp)).toBeNull()
  })

  test("loads zh-common.json into common", () => {
    writeFile(tmp, "zh-common.json", JSON.stringify({ Home: "首页", _title: "标题" }))

    const data = loadTranslations(tmp)

    expect(data.common).toEqual({ Home: "首页", _title: "标题" })
    expect(data.pages).toEqual({})
  })

  test("loads per-page translations co-located with HTML output paths", () => {
    writeFile(tmp, "zh-common.json", "{}")
    writeFile(tmp, "index.zh.json", JSON.stringify({ _title: "首页" }))
    writeFile(tmp, "games/index.zh.json", JSON.stringify({ _title: "游戏" }))

    const data = loadTranslations(tmp)

    expect(data.pages["index.html"]).toEqual({ _title: "首页" })
    expect(data.pages["games/index.html"]).toEqual({ _title: "游戏" })
  })

  test("only includes pages that have a .zh.json (auto-discovered)", () => {
    writeFile(tmp, "zh-common.json", "{}")
    writeFile(tmp, "index.zh.json", "{}")

    const data = loadTranslations(tmp)

    expect(Object.keys(data.pages)).toEqual(["index.html"])
  })

  test("propagates JSON parse errors with a useful message", () => {
    writeFile(tmp, "zh-common.json", "{ not valid json")

    expect(() => loadTranslations(tmp)).toThrow(SyntaxError)
  })
})

describe("translateContent", () => {
  const noCommon = new Set()

  test("replaces title content", () => {
    const html = "<title>Hello</title>"
    const result = translateContent(html, { _title: "你好" }, "test.html", noCommon)
    expect(result).toBe("<title>你好</title>")
  })

  test("replaces meta description content attribute", () => {
    const html = '<meta name="description" content="A site" />'
    const result = translateContent(html, { _description: "网站" }, "test.html", noCommon)
    expect(result).toContain('content="网站"')
  })

  test("does not warn on missing common keys", () => {
    const html = "<h1>Header</h1>"
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {})

    const commonKeys = new Set(["Home"]) // present in common but not in html
    translateContent(html, { Home: "首页" }, "page.html", commonKeys)

    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  test("warns on missing page-specific keys", () => {
    const html = "<h1>Header</h1>"
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {})

    translateContent(html, { Missing: "缺失" }, "page.html", new Set())

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"Missing"'))
    warn.mockRestore()
  })

  test("sorts entries longest-first to prevent partial replacements", () => {
    const html = "<p>Tools</p><p>Tools and Games</p>"
    const result = translateContent(
      html,
      { Tools: "工具", "Tools and Games": "工具与游戏" },
      "p.html",
      noCommon,
    )
    expect(result).toContain(">工具<")
    expect(result).toContain(">工具与游戏<")
    expect(result).not.toContain("Tools")
  })

  test("skips entries where english equals chinese (preserves identical strings)", () => {
    const html = "<code>JavaScript</code>"
    const result = translateContent(html, { JavaScript: "JavaScript" }, "p.html", noCommon)
    expect(result).toBe(html)
  })
})

describe("generateSitemap", () => {
  let tmp

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "build-sitemap-"))
  })

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  test("writes sitemap.xml with valid XML structure", () => {
    writeFile(tmp, "index.html", "<p/>")
    writeFile(tmp, "404.html", "<p/>")

    generateSitemap(tmp)

    const xml = readFileSync(join(tmp, "sitemap.xml"), "utf-8")
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain("<urlset")
    expect(xml).toContain("</urlset>")
    expect(xml.endsWith("\n")).toBe(true)
  })

  test("normalizes /foo/index.html to /foo/", () => {
    writeFile(tmp, "games/index.html", "<p/>")

    generateSitemap(tmp)

    const xml = readFileSync(join(tmp, "sitemap.xml"), "utf-8")
    expect(xml).toContain("<loc>https://qyearsley.github.io/games/</loc>")
    expect(xml).not.toContain("/games/index.html")
  })

  test("excludes /zh/ pages from the urls listed (they appear only as alternates)", () => {
    writeFile(tmp, "index.html", "<p/>")
    writeFile(tmp, "zh/index.html", "<p/>")

    generateSitemap(tmp)

    const xml = readFileSync(join(tmp, "sitemap.xml"), "utf-8")
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
    expect(locs).toEqual(["https://qyearsley.github.io/"])
  })

  test("emits hreflang alternates for pages that have a /zh/ counterpart", () => {
    writeFile(tmp, "index.html", "<p/>")
    writeFile(tmp, "zh/index.html", "<p/>")

    generateSitemap(tmp)

    const xml = readFileSync(join(tmp, "sitemap.xml"), "utf-8")
    expect(xml).toContain('hreflang="en" href="https://qyearsley.github.io/"')
    expect(xml).toContain('hreflang="zh" href="https://qyearsley.github.io/zh/"')
  })

  test("emits a plain entry (no alternates) when no /zh/ counterpart exists", () => {
    writeFile(tmp, "private.html", "<p/>")

    generateSitemap(tmp)

    const xml = readFileSync(join(tmp, "sitemap.xml"), "utf-8")
    expect(xml).toContain("<loc>https://qyearsley.github.io/private.html</loc>")
    expect(xml).not.toMatch(/hreflang/)
  })

  test("urls are sorted alphabetically", () => {
    writeFile(tmp, "z.html", "<p/>")
    writeFile(tmp, "a.html", "<p/>")
    writeFile(tmp, "m.html", "<p/>")

    generateSitemap(tmp)

    const xml = readFileSync(join(tmp, "sitemap.xml"), "utf-8")
    const indexA = xml.indexOf("/a.html")
    const indexM = xml.indexOf("/m.html")
    const indexZ = xml.indexOf("/z.html")
    expect(indexA).toBeLessThan(indexM)
    expect(indexM).toBeLessThan(indexZ)
  })
})

describe("validateLinks", () => {
  let tmp, warnSpy, logSpy

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "build-validate-"))
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {})
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {})
  })

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
    warnSpy.mockRestore()
    logSpy.mockRestore()
  })

  test("returns 0 broken links when all are valid", () => {
    writeFile(tmp, "index.html", '<a href="/about.html">About</a>')
    writeFile(tmp, "about.html", "<p>About</p>")

    const broken = validateLinks(tmp)

    expect(broken).toBe(0)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  test("treats /dir/ as valid when /dir/index.html exists", () => {
    writeFile(tmp, "index.html", '<a href="/games/">Games</a>')
    writeFile(tmp, "games/index.html", "<p/>")

    expect(validateLinks(tmp)).toBe(0)
  })

  test("flags links to non-existent files", () => {
    writeFile(tmp, "index.html", '<a href="/missing.html">X</a>')

    const broken = validateLinks(tmp)

    expect(broken).toBe(1)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("/missing.html"))
  })

  test("counts multiple broken links across files", () => {
    writeFile(tmp, "a.html", '<a href="/x">X</a><a href="/y">Y</a>')
    writeFile(tmp, "b.html", '<a href="/z">Z</a>')

    expect(validateLinks(tmp)).toBe(3)
  })

  test("treats non-HTML assets as valid when they exist on disk", () => {
    writeFile(tmp, "index.html", '<link href="/style.css" rel="stylesheet" />')
    writeFile(tmp, "style.css", "body{}")

    expect(validateLinks(tmp)).toBe(0)
  })

  test("ignores fragment-only and external links", () => {
    writeFile(
      tmp,
      "index.html",
      '<a href="#top">Top</a><a href="https://example.com">Ext</a><a href="mailto:a@b.c">Mail</a>',
    )

    expect(validateLinks(tmp)).toBe(0)
  })
})

describe("injectTranslatedPaths", () => {
  let tmp

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "build-inject-"))
  })

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  test("injects __translatedPaths script before nav.js script tag", () => {
    writeFile(
      tmp,
      "index.html",
      '<html><head><script src="/shared/nav.js"></script></head><body/></html>',
    )

    const count = injectTranslatedPaths(tmp)
    const html = readFileSync(join(tmp, "index.html"), "utf-8")

    expect(count).toBe(1)
    expect(html).toContain("window.__translatedPaths=")
    const injectedAt = html.indexOf("window.__translatedPaths")
    const navAt = html.indexOf('<script src="/shared/nav.js">')
    expect(injectedAt).toBeLessThan(navAt)
  })

  test("the injected paths array contains all known TRANSLATED_URLS", () => {
    writeFile(tmp, "index.html", '<script src="/shared/nav.js"></script>')

    injectTranslatedPaths(tmp)
    const html = readFileSync(join(tmp, "index.html"), "utf-8")
    const match = html.match(/window\.__translatedPaths=(\[[^\]]*\])/)

    expect(match).not.toBeNull()
    const paths = JSON.parse(match[1])
    for (const url of TRANSLATED_URLS) {
      expect(paths).toContain(url)
    }
  })

  test("tolerates extra attributes and whitespace in the nav.js script tag", () => {
    writeFile(
      tmp,
      "page.html",
      '<script defer  src="/shared/nav.js"  type="text/javascript"></script>',
    )

    const count = injectTranslatedPaths(tmp)
    const html = readFileSync(join(tmp, "page.html"), "utf-8")

    expect(count).toBe(1)
    expect(html).toContain("window.__translatedPaths=")
    // Original tag (with attributes intact) is still present
    expect(html).toContain('<script defer  src="/shared/nav.js"  type="text/javascript">')
  })

  test("only modifies files that reference nav.js", () => {
    writeFile(tmp, "with-nav.html", '<script src="/shared/nav.js"></script>')
    writeFile(tmp, "no-nav.html", "<p>plain</p>")
    const before = readFileSync(join(tmp, "no-nav.html"), "utf-8")

    const count = injectTranslatedPaths(tmp)

    expect(count).toBe(1)
    expect(readFileSync(join(tmp, "no-nav.html"), "utf-8")).toBe(before)
  })

  test("warns and returns 0 when no file references nav.js", () => {
    writeFile(tmp, "page.html", "<p>plain</p>")
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {})

    expect(injectTranslatedPaths(tmp)).toBe(0)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("no files reference nav.js"))
    warn.mockRestore()
  })
})

describe("discoverTranslatablePages", () => {
  let tmp

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "build-discover-"))
  })

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  test("returns the html path corresponding to each .zh.json", () => {
    writeFile(tmp, "index.zh.json", "{}")
    writeFile(tmp, "games/index.zh.json", "{}")
    writeFile(tmp, "javascript/coin-flipper.zh.json", "{}")

    expect(discoverTranslatablePages(tmp)).toEqual([
      "games/index.html",
      "index.html",
      "javascript/coin-flipper.html",
    ])
  })

  test("does not pick up zh-common.json (different naming)", () => {
    writeFile(tmp, "zh-common.json", "{}")
    writeFile(tmp, "page.zh.json", "{}")

    expect(discoverTranslatablePages(tmp)).toEqual(["page.html"])
  })

  test("skips dev-only directories (node_modules, dist, docs, coverage)", () => {
    writeFile(tmp, "node_modules/foo/x.zh.json", "{}")
    writeFile(tmp, "dist/old.zh.json", "{}")
    writeFile(tmp, "docs/x.zh.json", "{}")
    writeFile(tmp, "coverage/x.zh.json", "{}")
    writeFile(tmp, "real.zh.json", "{}")

    expect(discoverTranslatablePages(tmp)).toEqual(["real.html"])
  })

  test("ignores dotfiles and dotdirs", () => {
    writeFile(tmp, ".hidden.zh.json", "{}")
    writeFile(tmp, ".cache/x.zh.json", "{}")
    writeFile(tmp, "real.zh.json", "{}")

    expect(discoverTranslatablePages(tmp)).toEqual(["real.html"])
  })

  test("returns sorted output (deterministic)", () => {
    writeFile(tmp, "z.zh.json", "{}")
    writeFile(tmp, "a.zh.json", "{}")
    writeFile(tmp, "m.zh.json", "{}")

    expect(discoverTranslatablePages(tmp)).toEqual(["a.html", "m.html", "z.html"])
  })

  test("returns empty array when no .zh.json files exist", () => {
    writeFile(tmp, "page.html", "<p/>")
    expect(discoverTranslatablePages(tmp)).toEqual([])
  })
})

describe("TRANSLATABLE_PAGES integrity", () => {
  test("entries are unique", () => {
    const set = new Set(TRANSLATABLE_PAGES)
    expect(set.size).toBe(TRANSLATABLE_PAGES.length)
  })

  test("every entry has a corresponding .zh.json source file", () => {
    const missing = TRANSLATABLE_PAGES.filter(
      (page) => !existsSync(join(process.cwd(), page.replace(/\.html$/, ".zh.json"))),
    )
    expect(missing).toEqual([])
  })
})

/**
 * @jest-environment node
 */
import { describe, expect, test } from "@jest/globals"
import {
  escapeRegex,
  buildTextPattern,
  translateHtml,
  injectEnglishMeta,
  TRANSLATED_URLS,
} from "./build.js"

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
      "<h2>JavaScript Experiments</h2>" +
      "<span>JavaScript</span></body></html>"
    const result = translateHtml(
      html,
      { "JavaScript Experiments": "JS实验", JavaScript: "JS" },
      "test.html",
      emptyCommon,
    )
    expect(result).toContain(">JS实验<")
    expect(result).toContain(">JS<")
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

describe("injectEnglishMeta", () => {
  test("adds hreflang tags to English page", () => {
    const html = "<head></head><body><header></header></body>"
    const result = injectEnglishMeta(html, "games/index.html")
    expect(result).toContain('hreflang="en" href="/games/index.html"')
    expect(result).toContain('hreflang="zh" href="/zh/games/index.html"')
  })

  test("injects Chinese language switcher", () => {
    const html = "<head></head><body><header></header></body>"
    const result = injectEnglishMeta(html, "index.html")
    expect(result).toContain("中文")
    expect(result).toContain('lang="zh"')
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
    expect(TRANSLATED_URLS.has("/javascript/truthtable.html")).toBe(true)
    expect(TRANSLATED_URLS.has("/404.html")).toBe(true)
  })

  test("does not include non-existent pages", () => {
    expect(TRANSLATED_URLS.has("/nonexistent.html")).toBe(false)
  })
})

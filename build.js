#!/usr/bin/env node

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, "dist");

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "docs",
  "notes",
  "coverage",
  "i18n",
]);

const SKIP_FILES = new Set([
  "package.json",
  "package-lock.json",
  "eslint.config.js",
  "jest.config.cjs",
  "CLAUDE.md",
  "build.js",
  "build.test.js",
  "todo.md",
]);

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
  "javascript/truthtable.html",
  "javascript/coinflip.html",
  "javascript/seriestest.html",
  "javascript/passgen.html",
  "javascript/float.html",
  "javascript/hashlab.html",
  "javascript/automata.html",
  "javascript/date.html",
  "chinese/index.html",
  "chinese/syllabary.html",
  "chinese/tonetable.html",
  "chinese/pinyin_abbrev.html",
  "chinese/homophone_subs.html",
  "chinese/tradsimp.html",
  "chinese/encoding.html",
  "404.html",
];

const TRANSLATED_URLS = new Set();
for (const page of TRANSLATABLE_PAGES) {
  TRANSLATED_URLS.add("/" + page);
  if (page.endsWith("/index.html")) {
    TRANSLATED_URLS.add("/" + page.replace(/index\.html$/, ""));
  }
  if (page === "index.html") {
    TRANSLATED_URLS.add("/");
  }
}

function clean() {
  if (existsSync(DIST)) rmSync(DIST, { recursive: true });
}

function copyTree(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const name = entry.name;
    if (name.startsWith(".")) continue;
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      copyTree(join(src, name), join(dest, name));
    } else {
      if (SKIP_FILES.has(name)) continue;
      copyFileSync(join(src, name), join(dest, name));
    }
  }
}

function loadTranslations() {
  const zhDir = join(ROOT, "i18n", "zh");
  if (!existsSync(zhDir)) return null;
  const result = loadDir(zhDir, "");
  return Object.keys(result).length > 0 ? result : null;
}

function loadDir(dir, prefix) {
  const result = {};
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      Object.assign(result, loadDir(join(dir, entry.name), prefix + entry.name + "/"));
    } else if (entry.name.endsWith(".json")) {
      const key = prefix + entry.name.replace(/\.json$/, "");
      result[key] = JSON.parse(readFileSync(join(dir, entry.name), "utf-8"));
    }
  }
  return result;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildTextPattern(english) {
  const normalized = english.trim().replace(/\s+/g, " ");
  let escaped = escapeRegex(normalized);
  escaped = escaped.replace(/&/g, "&(?:amp;)?");
  escaped = escaped.replace(/ /g, "\\s+");
  return escaped;
}

function checkUntranslated(html, pagePath) {
  const bodyMatch = html.match(/<body[\s>][\s\S]*<\/body>/);
  if (!bodyMatch) return;
  const body = bodyMatch[0];

  const cleaned = body
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "");

  const warnings = [];
  const textRegex = />([^<]+)</g;
  let match;
  while ((match = textRegex.exec(cleaned)) !== null) {
    const text = match[1].trim();
    if (text.length < 8) continue;
    // Skip text containing CJK characters (already translated)
    if (/[\u4e00-\u9fff]/.test(text)) continue;
    const asciiLetters = (text.match(/[a-zA-Z]/g) || []).length;
    if (asciiLetters / text.length < 0.6) continue;
    // Skip URLs, emails, single technical terms
    if (/^https?:|^mailto:/.test(text)) continue;
    if (/^[\w.@]+$/.test(text)) continue;
    if (/^\([\w, ]+\)$/.test(text)) continue;
    // Must have spaces (looks like a phrase/sentence, not a single term)
    if (!/\s/.test(text)) continue;
    // Only flag text with 2+ lowercase content words (natural language).
    // This skips proper nouns, product names, tech lists, and titles.
    const lowercaseWords = text.match(/\b[a-z]{3,}\b/g) || [];
    if (lowercaseWords.length < 2) continue;
    if (!/\s/.test(text)) continue;
    warnings.push(text);
  }

  if (warnings.length > 0) {
    console.warn(`  Possibly untranslated in zh/${pagePath}:`);
    for (const text of warnings) {
      const preview = text.length > 70 ? text.substring(0, 70) + "..." : text;
      console.warn(`    "${preview}"`);
    }
  }
}

function translateHtml(html, translations, pagePath, isCommon) {
  let result = html;

  result = result.replace('<html lang="en"', '<html lang="zh"');

  if (translations._title) {
    result = result.replace(
      /(<title>)([\s\S]*?)(<\/title>)/,
      `$1${translations._title}$3`,
    );
  }

  if (translations._description) {
    result = result.replace(
      /(<meta\s+name="description"\s+content=")([^"]*)(")/,
      `$1${translations._description}$3`,
    );
  }

  const entries = Object.entries(translations)
    .filter(([key]) => !key.startsWith("_"))
    .sort(([a], [b]) => b.length - a.length);

  for (const [english, chinese] of entries) {
    if (english === chinese) continue;
    const pattern = buildTextPattern(english);
    const regex = new RegExp(`(>\\s*)(${pattern})(\\s*<)`, "g");

    const before = result;
    result = result.replace(regex, `$1${chinese}$3`);

    if (result === before && !isCommon.has(english)) {
      const preview = english.length > 60 ? english.substring(0, 60) + "..." : english;
      console.warn(`  Warning: no match for "${preview}" in ${pagePath}`);
    }
  }

  result = result.replace(/href="(\/[^"]*?)"/g, (match, href) => {
    return TRANSLATED_URLS.has(href) ? `href="/zh${href}"` : match;
  });

  const enUrl = "/" + pagePath;
  const zhUrl = "/zh/" + pagePath;
  const hreflang = [
    `    <link rel="alternate" hreflang="en" href="${enUrl}" />`,
    `    <link rel="alternate" hreflang="zh" href="${zhUrl}" />`,
    `    <link rel="alternate" hreflang="x-default" href="${enUrl}" />`,
  ].join("\n");
  result = result.replace("</head>", `${hreflang}\n  </head>`);

  const switchHtml = `\n        <a href="${enUrl}" class="lang-switch" lang="en">English</a>`;
  result = result.replace("</header>", `${switchHtml}\n      </header>`);

  return result;
}

function injectEnglishMeta(html, pagePath) {
  let result = html;

  const enUrl = "/" + pagePath;
  const zhUrl = "/zh/" + pagePath;

  const hreflang = [
    `    <link rel="alternate" hreflang="en" href="${enUrl}" />`,
    `    <link rel="alternate" hreflang="zh" href="${zhUrl}" />`,
    `    <link rel="alternate" hreflang="x-default" href="${enUrl}" />`,
  ].join("\n");
  result = result.replace("</head>", `${hreflang}\n  </head>`);

  const switchHtml = `\n        <a href="${zhUrl}" class="lang-switch" lang="zh">中文</a>`;
  result = result.replace("</header>", `${switchHtml}\n      </header>`);

  return result;
}

function generateResume() {
  const mdPath = join(ROOT, "resume", "resume.md");
  const templatePath = join(ROOT, "resume", "template.html");
  if (!existsSync(mdPath) || !existsSync(templatePath)) {
    console.log("  Skipped (missing resume.md or template.html)");
    return;
  }
  const md = readFileSync(mdPath, "utf-8");
  const template = readFileSync(templatePath, "utf-8");
  const html = marked.parse(md);
  const page = template.replace("{{CONTENT}}", html);
  const outPath = join(DIST, "resume", "index.html");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, page);
}

function build() {
  console.log("Cleaning dist/...");
  clean();

  console.log("Copying files...");
  copyTree(ROOT, DIST);

  console.log("Generating resume from markdown...");
  generateResume();

  const allTranslations = loadTranslations();
  if (!allTranslations) {
    console.log("No i18n/zh/ directory found. Skipping translations.");
    console.log("Done.");
    return;
  }

  const common = allTranslations._common || {};
  const commonKeys = new Set(Object.keys(common).filter((k) => !k.startsWith("_")));

  console.log("Generating translations...");
  for (const page of TRANSLATABLE_PAGES) {
    const pageKey =
      page === "index.html"
        ? "index"
        : page.replace(/\/index\.html$/, "").replace(/\.html$/, "");

    const pageOnly = allTranslations[pageKey];
    if (!pageOnly) {
      console.warn(`  Warning: no translations for "${pageKey}" (${page})`);
      continue;
    }

    const translations = { ...common, ...pageOnly };

    const srcPath = join(DIST, page);
    if (!existsSync(srcPath)) {
      console.warn(`  Warning: page not found: ${page}`);
      continue;
    }

    const html = readFileSync(srcPath, "utf-8");

    const zhHtml = translateHtml(html, translations, page, commonKeys);
    const zhPath = join(DIST, "zh", page);
    mkdirSync(dirname(zhPath), { recursive: true });
    writeFileSync(zhPath, zhHtml);
    checkUntranslated(zhHtml, page);
    console.log(`  zh/${page}`);

    const enHtml = injectEnglishMeta(html, page);
    writeFileSync(srcPath, enHtml);
  }

  console.log("Done.");
}

export { escapeRegex, buildTextPattern, translateHtml, injectEnglishMeta, TRANSLATED_URLS };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  build();
}

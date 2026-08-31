# Decision: Plain HTML Pages, No Site Generator

**Decided 2026-08-31. Closed.** `CLAUDE.md` already states the preference
("prefer self-contained HTML files over complex build abstractions"); this file
records why, and what would reopen it.

## What we decided

Every page stays a complete, standalone HTML file. `build.js` does only what a
static host can't: copy the tree to `dist/`, render `resume/resume.md` into
`resume/template.html`, generate the `/zh/` pages from co-located `*.zh.json`
files, inject `window.__translatedPaths`, write `sitemap.xml`, and check
internal links. No layouts, no partials, no page templating -- the resume's
single `{{CONTENT}}` placeholder is the only template in the repo.

## Why

There are ~29 pages and they change slowly, so duplicated `<head>` and
`<header>` markup is cheap to maintain. In exchange, every file is valid HTML
that tools understand on its own, and `npm run dev` serves the source unbuilt.

What the alternatives cost:

| Option                                                  | Ruled out because                                                                                                                                                                                                                                                      |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Custom `.page` templates (YAML frontmatter + HTML body) | Would roughly halve each page, but pages stop being HTML: no linting, no formatting, no editor support, unreadable without a build, and ~200 more lines in `build.js`. The earlier version of this doc records it as tried and reverted; no trace of it landed in git. |
| Static site generator (11ty, Hugo, Jekyll)              | Mature and well documented, but heavy for a site this size, and Hugo or Jekyll drag in a non-JS toolchain.                                                                                                                                                             |
| Client-side includes / web components                   | No build step, but shared markup then needs JavaScript to exist -- bad for `<title>` and meta tags, bad for crawlers, and it flashes on load.                                                                                                                          |

## What would change our mind

- Page count past roughly 50, or shared header/nav markup changing often enough
  that editing every file starts to hurt.
- Wanting real content pages -- a blog, or anything better written in Markdown
  than in HTML.
- `build.js` growing page-templating logic anyway, one special case at a time.
  That is the signal that a real generator would do the job better.

If we do move, try 11ty first: it's JavaScript, handles i18n, and can take pages
over gradually rather than all at once.

# Development Guide

## Site Overview

Personal website with educational games, JavaScript experiments, and Chinese
language tools. Served as a static site via GitHub Pages with a build step
that handles translations, the resume, and validation.

## Directory Structure

```
index.html                  Homepage
404.html                    Error page (Game of Life background)
build.js                    Build script
build.test.js               Build function tests

css/
  style.css                 Core layout, typography, design tokens (all pages)
  components.css            Specialized styles for tool pages

games/
  index.html                Games section index
  number-garden/            Game (own layout)
  life-garden/              Game (own layout)
  turing-tape/              Game (own layout)

javascript/
  index.html                JS experiments section index
  coinflip.html             Individual experiments...
  logic-engine/index.html

chinese/
  index.html                Chinese tools section index
  syllabary.html            Individual tools...

resume/
  resume.md                 Resume content (markdown)
  template.html             Resume-specific template
  resume.css                Resume styles

shared/
  nav.js                    Keyboard shortcuts + language persistence
  theme.js                  Dark/light mode + accent colors
  table-filter.js           Searchable table filtering
  life-background.js        Game of Life animation (404 page)

zh-common.json              Shared translations (see docs/translations.md)
*.zh.json                   Per-page translations (co-located with HTML)
docs/                       Development documentation
dist/                       Build output (gitignored)
```

## Build Pipeline

`npm run build` runs `build.js`, which:

1. **Clean** -- delete `dist/`
2. **Copy** -- copy all static files to `dist/` (skips config files, dev-only dirs)
3. **Render resume** -- convert `resume/resume.md` to HTML via `marked`, inject into `resume/template.html`
4. **Translate** -- for each translatable page, generate a Chinese version at `/zh/` using text-matching against co-located `*.zh.json` files
5. **Inject paths** -- write `window.__translatedPaths` into every HTML file so `nav.js` can persist language preference client-side
6. **Sitemap** -- generate `dist/sitemap.xml` from all HTML files
7. **Validate** -- check all internal `href="/..."` links point to existing files

## Commands

```bash
npm run build   # Full build to dist/
npm start       # Build + serve dist/ on port 8000
npm run dev     # Serve source directly (no build, like before)
npm test        # Run all tests (Jest)
npm run lint    # ESLint + HTMLHint + Stylelint
npm run format  # Prettier
```

## Testing

Tests use Jest with `--experimental-vm-modules` for ESM support.

- `build.test.js` -- unit tests for build functions (text matching, translation, link rewriting, hreflang)
- `shared/__tests__/` -- tests for nav.js and theme.js
- `javascript/*.test.js` -- tests for experiment logic
- `games/*/__tests__/` -- tests for game logic

Run a specific test file:

```bash
npm test -- --testPathPatterns build.test
```

## Adding a New Page

1. Create `section/page-name.html` as a self-contained HTML file
2. Add the output path to `TRANSLATABLE_PAGES` in `build.js`
3. Create `section/page-name.zh.json` with translations
4. Run `npm run build` -- warnings show unmatched translation keys

See `docs/translations.md` for translation details.

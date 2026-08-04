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
  coin-flipper.html         Individual experiments...
  logic-engine/index.html

chinese/
  index.html                Chinese tools section index
  syllabary.html            Individual tools...

contact/
  index.html                Contact form (see "Contact Form" below)

resume/
  resume.md                 Resume content (markdown)
  template.html             Resume-specific template
  resume.css                Resume styles

shared/
  nav.js                    Keyboard shortcuts + language persistence
  theme.js                  Dark/light mode + accent colors
  table-filter.js           Searchable table filtering
  contact-form.js           Contact form submission
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
- `games/*/__tests__/` -- tests for game logic and level/preset data

Game `game.js` orchestrators are intentionally untested -- they're DOM-and-canvas-coupled glue. Tests target the underlying components (Grid, GameState, TuringMachine, etc.) and the static data they consume.

Run a specific test file:

```bash
npm test -- --testPathPatterns build.test
```

Jest's `moduleNameMapper` in `package.json` strips `.js` extensions from relative imports so the same source files work both as native ESM (in the browser, where extensions are required) and under Jest (which resolves without them).

## Lint Configuration

`npm run lint` runs three linters; their notable settings:

- **ESLint** (`eslint.config.js`): `no-console` allows `warn`/`error` -- the build script and shared modules use them for surfacing real problems. `jestGlobals` is included in the browser config because `*.test.js` files live alongside source under `shared/`, `javascript/`, and `games/` rather than in a separate test directory.
- **Stylelint** (`package.json`): several rules are disabled because the codebase mixes hand-written CSS conventions with design-token patterns that the standard config rejects.
  - `selector-class-pattern` / `selector-id-pattern` / `custom-property-pattern`: allow descriptive names like `.game-list` and `--color-bg-card` instead of forcing strict BEM.
  - `no-descending-specificity`: silenced because component CSS frequently overrides base styles in a deliberate cascade order.
  - `color-function-notation: legacy` and `alpha-value-notation: number`: pin to one notation since both are valid CSS and mixing them is noisier than picking either.

## Adding a New Page

1. Create `section/page-name.html` as a self-contained HTML file
2. Create `section/page-name.zh.json` with translations -- this opts the page into the Chinese translation pipeline
3. Run `npm run build` -- warnings show unmatched translation keys

`build.js` discovers translatable pages by walking the source tree for
`*.zh.json` files; there is no manual list to update.

See `docs/translations.md` for translation details.

## Contact Form

`contact/index.html` posts to [Formspree](https://formspree.io), which forwards
submissions by email. This keeps the site static and publishes no email address:
the form ID in the `action` attribute is public by design, but the destination
address lives in the Formspree dashboard rather than in this repo.

Notes:

- Submission is progressive enhancement. Without JavaScript the browser POSTs
  directly and Formspree renders its own confirmation page; with JavaScript the
  visitor stays on the page and gets inline status.
- The hidden `_gotcha` field is Formspree's spam honeypot -- bots fill it in,
  Formspree drops those submissions. It is hidden via `.honeypot` in
  `css/style.css`.
- `shared/contact-form.js` refuses to submit if the action still contains the
  `YOUR_FORM_ID` placeholder, showing "this form isn't connected yet" rather
  than POSTing to a URL that 404s. This guards a fresh copy of the page; the
  live form is configured.
- Status messages live in `shared/contact-form.js`, not in the HTML, so they are
  **not** translated on the `/zh/` page. Translating them would need a
  JS-side string table.

## Shared Module Contract

The `shared/` scripts are plain `<script>` includes (no bundler), so they
coordinate through a few `window.__*` globals rather than imports. There is no
guaranteed load order: each module exposes its API immediately and guards every
cross-module call, so `nav.js` and `theme.js` work in either order.

| Global                                          | Set by                               | Read by    | Purpose                                                                          |
| ----------------------------------------------- | ------------------------------------ | ---------- | -------------------------------------------------------------------------------- |
| `__translatedPaths`                             | `build.js` (injected into each page) | `nav.js`   | List of paths that have a `/zh/` version, for language-preference link rewriting |
| `__registerShortcut(key, description, handler)` | `nav.js`                             | `theme.js` | Register/override a keyboard shortcut shown in the help overlay                  |
| `__helpOverlayIsOpen()`                         | `nav.js`                             | tests      | Whether the shortcuts overlay is currently open                                  |
| `__themeToggle()`                               | `theme.js`                           | `nav.js`   | Cycle light/dark/system; also gates the "t" shortcut's visibility                |
| `__themePopoverIsOpen()`                        | `theme.js`                           | `nav.js`   | Whether the theme popover is open (so `Escape` closes it first)                  |
| `__themePopoverClose()`                         | `theme.js`                           | tests      | Close the theme popover                                                          |

When adding a cross-module global, prefix it with `__`, expose it as soon as the
module initializes, and guard every read (`if (window.__foo)`) so load order
never matters.

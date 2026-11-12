# Development Guide

## Site Overview

Personal website with educational games, JavaScript experiments, and Chinese
language tools. Served as a static site via GitHub Pages with a build step
that handles translations, the resume, and validation.

## Resume Page

The resume page has no source `index.html`. `npm run build` renders `resume.md`
into `template.html` and writes the result straight to `dist/resume/index.html`.
Edit the markdown.

Because the page only exists after a build, `npm run dev` does not serve
`/resume/`. Use `npm start` to see it.

## Build Pipeline

`npm run build` runs `build.js`, which:

1. **Clean** -- delete `dist/`
2. **Copy** -- copy all static files to `dist/` (skips config files, dev-only dirs)
3. **Render resume** -- convert `resume/resume.md` to HTML via `marked`, inject into `resume/template.html`
4. **Footer** -- add Source and History links to GitHub after `</main>` on every page with a `<header>`, except the homepage and 404. A folder's `index.html` links to the folder. Runs before translation, so `/zh/` pages get it too, pointing at the English source.
5. **Translate** -- for each translatable page, generate a Chinese version at `/zh/` using text-matching against co-located `*.zh.json` files. Both the `/zh/` and the English copy also get `hreflang` links and a language-switch link in the header.
6. **Page registry** -- write `dist/pages.json`: every tool/game page under `games/`, `javascript/`, and `chinese/` (excluding each section's own index), with its English and (if translated) Chinese title. `shared/discover.js` fetches this for the random-page link in the homepage footer and on the 404 page, and `nav.js` for the `r` keyboard shortcut.
7. **Inject paths** -- write `window.__translatedPaths` into every HTML file so `nav.js` can persist language preference client-side
8. **Sitemap** -- generate `dist/sitemap.xml` from all HTML files, excluding `/404.html` and the `/zh/` pages (those appear as `hreflang` alternates)
9. **Cache-bust** -- append `?v=<buildId>` to every local `<script src>` in `dist/` and to every relative import/export specifier inside `dist/`'s own JS files. See "Cache busting" below.
10. **Validate** -- check every internal `href` and `src`, and every relative JS import specifier, against the files in `dist/`. A broken link or import fails the build, which is what keeps it off the live site: the deploy workflow uploads `dist/` only after build, test and lint all pass.

Why this rather than a site generator, and what would change our mind:
[`build-system-options.md`](build-system-options.md).

## Cache Busting

GitHub Pages serves this site with a short cache lifetime and no custom
headers. Right after a deploy, a browser can be left holding a mix of an old
page and new JS modules (or the reverse) until every cached file expires --
and a page's module graph fails to load if two files in it come from
different deploys.

To avoid that, the build computes one `buildId` per run: a short hash of the
path and contents of every JS file copied to `dist/`. Same sources always
produce the same id, so a rebuild with no JS changes doesn't churn any URL.
It then appends `?v=<buildId>` to:

- every local `<script src="...js">` in `dist/`'s HTML, module or classic
  (an external URL, like the Chart.js CDN script on the coin flipper page, is
  left alone)
- every relative `import`/`export ... from` specifier and dynamic `import()`
  call inside `dist/`'s own JS files

The same id everywhere matters: a module fetched under two different URLs is
instantiated twice by the browser (two `StorageManager` copies, two sets of
state), so every reference to a given file has to produce the identical URL.
Number Garden's `js/game.js?v=7` used to be hand-maintained and only covered
the entry file; the build now owns versioning for every script and import.

This only versions script URLs and JS imports -- it can't do anything about
the HTML page itself being served stale, since GitHub Pages doesn't let this
site set cache headers on it.

`validateLinks` (in `build.js`) also checks that every relative JS import
specifier in `dist/` resolves to a real file, the same way it already checked
HTML `href`/`src`. That catches a renamed-but-still-imported module, a break
that would otherwise only surface at runtime in a browser.

## Commands

```bash
npm run build   # Full build to dist/
npm run build:verbose  # Build, plus warnings about possibly-untranslated text
npm start       # Build + serve dist/ on port 8000
npm run dev     # Serve source directly on port 8000 (no build)
npm test        # Run all tests (Jest)
npm run lint    # ESLint + HTMLHint + Stylelint + Prettier
npm run format  # Prettier
```

## Git Hooks

`.husky/pre-commit` formats and lints the staged files. `.husky/pre-push` runs
the tests. The comments in those files say why each check sits where it does.
To skip one, use `--no-verify`. CI still runs everything.

## Testing

Tests use Jest with `--experimental-vm-modules` for ESM support.

- `build.test.js` -- unit tests for build functions (text matching, translation, link rewriting, hreflang)
- `__tests__/html.test.js` -- structural checks across every source HTML page (unclosed script tags, placeholder SRI hashes, etc.)
- `__tests__/stylesheets.test.js` -- dark-theme wiring across every stylesheet (the `prefers-color-scheme` and `[data-theme="dark"]` blocks described in "Stylesheets" below)
- `__tests__/zh-coverage.test.js` -- the translation gate: counts English text nodes in each translated page and fails if a page regresses against its recorded baseline
- `shared/__tests__/` -- tests for `nav.js`, `theme.js`, `table-filter.js`, `contact-form.js`, and `discover.js`; `theme-placement.test.js` covers where `theme.js` places its toggle when a page has more than one `.header`
- `javascript/*.test.js`, `chinese/*.test.js` -- tests for experiment and tool logic
- `games/*/__tests__/` -- tests for game logic and level/preset data

Most game logic is tested through its underlying components (Grid, GameState, TuringMachine, etc.) and the static data they consume. Seasons and Times Trail additionally drive their `game.js` orchestrators black-box, loading the real `index.html` into jsdom and clicking through it. Number Garden and Life Garden have boot tests that do the same for their startup wiring. Turing Tape's `game.js` and Logic Engine's `ui.js` remain untested DOM glue.

Run a specific test file:

```bash
npm test -- --testPathPatterns build.test
```

Jest's `moduleNameMapper` in `package.json` strips `.js` extensions from relative imports so the same source files work both as native ESM (in the browser, where extensions are required) and under Jest (which resolves without them).

## Lint Configuration

Settings are in `eslint.config.js`, `.htmlhintrc` and `package.json`. Notes on
the non-obvious ones:

- ESLint's `ignores` block alone decides what is skipped, so a new top-level
  directory is linted without touching `package.json`.
- `jestGlobals` is in the browser config because `*.test.js` files live beside
  the source, not in a separate test directory.
- Stylelint disables the class, id and custom-property pattern rules (names like
  `.game-list` and `--color-bg-card`) and `no-descending-specificity` (component
  CSS overrides base styles on purpose).
- `eslint-config-prettier` turns off ESLint rules that clash with Prettier, so
  formatting has one owner.

## Adding a New Page

1. Create `section/page-name.html` as a self-contained HTML file
2. Give it a `<meta name="description">`. `__tests__/html.test.js` requires one on every page.
3. Create `section/page-name.zh.json` with translations -- this opts the page into the Chinese translation pipeline
4. Run `npm run build` -- warnings show unmatched translation keys

`build.js` discovers translatable pages by walking the source tree for
`*.zh.json` files; there is no manual list to update.

Step 3 is optional, and a game should think twice about it. The pipeline
translates static HTML only, so a page that writes its text at runtime gets a
Chinese shell around English content. Three of the five games have no `*.zh.json`
for that reason. See
[`translations.md`](translations.md#which-pages-have-a-chinese-version-and-why).

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
| `__prefersDark()`                               | `theme.js`                           | games      | Whether dark applies right now, honouring an explicit choice over the OS         |
| `__discover`                                    | `discover.js`                        | tests      | `{ randomPick, pageLink, lifeStep }` -- the random-page link's pure logic        |

`theme.js` also dispatches a `themechange` event on `window` when the picker
changes the theme. Stylesheets re-resolve themselves; anything painted into a
canvas does not, so a game that draws its own colours needs both `__prefersDark`
and that event (see `games/life-garden/js/Renderer.js`).

When adding a cross-module global, prefix it with `__`, expose it as soon as the
module initializes, and guard every read (`if (window.__foo)`) so load order
never matters.

`nav.js`'s `r` shortcut ("Go to a random page") duplicates `discover.js`'s
`randomPick` rather than reading it off `window.__discover`: both files have no
imports, and the pick logic is a handful of lines, so a global for it would be
more ceremony than the duplication it avoids.

## Stylesheets

`css/style.css` holds the design tokens and loads on every page.
`css/components.css` adds tool-page components and draws only from those tokens.
Each game then owns its own sheet and its own `--prefix-*` variables; there is no
shared game CSS layer.

Two conventions are enforced by `__tests__/stylesheets.test.js`:

- A sheet that styles a dark theme must write the dark values **twice** -- once
  under `@media (prefers-color-scheme: dark)` and once under
  `[data-theme="dark"]`. A custom property cannot be aliased across two
  selectors, so there is no way to share them. Without the second block the site
  theme picker has no effect on that sheet.
- Selectors inside the media query need the `:not([data-theme="light"])` guard,
  so an explicit light choice beats the OS preference.

Drawing from the tokens in `style.css` avoids both, since they already resolve
for either form. Prefer that to a second dark block: it is why
`components.css` has none. Where a colour depends on the theme in a way the
existing tokens do not cover, add a token rather than a rule -- see
`--color-on-primary` (text on a primary fill, which is light in dark mode) and
`--color-badge-*`.

Three things in `style.css` to know about when writing a page:

- `.header` is the site's page-header class. Number Garden and Times Trail reuse
  the name for an in-screen HUD and have to reset it.
- Its focus ring fires on `:focus` rather than `:focus-visible`, so it leaves a
  ring around whatever was last clicked or tapped. Every game overrides this;
  the tool pages do not.
- `.form-input` and `.form-textarea` are monospace, which suits an expression or
  a code point. A form of prose puts `form-prose` on the `<form>` to opt out.

# Improvements

> **Status: audited 2026-09-18 against `main` @ `e955e81`.** Migrated from the
> unversioned `~/hobby/IMPROVEMENTS.md`, which covered seven repos at once and
> had drifted; every claim below was re-checked on this date.

This file is the maintenance backlog: defects, debt, test gaps and doc drift.
Blog post ideas live in [`blog-ideas.md`](blog-ideas.md). Per-feature design
docs are the `*-plan.md` files in this directory.

## At a glance

1. `js/README.md` is missing for two of the five games — S · open

## Working on these

- Tests: `npm test` · Lint: `npx eslint .` · Build: `node build.js`
- Git hooks run the tests; see [`development.md`](development.md#git-hooks).
- Public repo. Never commit a work hostname, address, tool name or ticket ID.

## 1. `js/README.md` is missing for two of the five games

**S · open**

`times-trail`, `number-garden` and `seasons` each have a `js/README.md`
explaining their module layout. `life-garden` and `turing-tape` do not. All five
have a top-level `README.md`.

_Checked 2026-09-18: `find games -name README.md` — six game-level files, three
`js/` files._

## Settled

### Decided 2026-09-18, no change

- **Turing Tape cannot un-complete a level, and stays that way.**
  `games/turing-tape/js/game.js:420` writes `completedLevels` to `localStorage`
  under `STORAGE_KEY = "turingTape"` with no version key, and nothing in the UI
  clears it — `doReset()` at `:368` resets the tape, not the progress set. Once a
  level is green it is green forever, which is an asymmetry with every other game
  on the site. It cannot brick anything; the load at `:410` is inside a `try`.
  Known and accepted rather than missed.
- **`apple-touch-icon` keeps pointing at `icon.svg`.** iOS ignores SVG there, so
  Add to Home Screen falls back to a page snapshot for `number-garden`, `seasons`
  and `times-trail`. A worse home-screen icon is a smaller cost than three binary
  files in a repo that has none, and the comment in each `index.html` already
  records the trade.

### Landed 2026-09-18

- **Number Garden no longer loads Google Fonts.** Quicksand came from
  `fonts.googleapis.com` — the only third-party request any page on the site
  made, and a render-blocking one on the game most likely to be opened on an
  iPad. Replaced with `ui-rounded`, the rounded system face, which is SF Pro
  Rounded on the target device and costs nothing.
- **Number Garden's dark mode covers the whole game.** It used to be three
  selectors, so a dark settings panel floated over a white game. Two things made
  it more than a second palette: the per-area colours are inline styles written
  by `GameUI`, so they are re-derived with `color-mix` rather than replaced; and
  the stage background moved from an inline `background-color` onto a
  `--ng-stage-bg` custom property, because an inline colour beats every rule in
  the stylesheet and every stage colour is a light one.
- **`stylesheets.test.js` now compares the two dark forms.** Every sheet on the
  site writes its dark tokens out twice — once under the OS media query, once
  under an explicit `[data-theme="dark"]` — with a comment asking whoever edits
  one to edit the other. A comment is not a gate; the test is. Verified by
  deleting a token from one block and watching it fail.
- **`games/number-garden/styles/garden.css` deleted.** Every rule in it was
  dead: `.grass`, `.sky` and `.sparkle` name SVG gradient ids in
  `ProjectVisuals.js` rather than elements, and nothing renders `.flower-*`,
  `.butterfly`, `.garden-grid` or `.garden-slot` — flowers are emoji.

### Landed 2026-09-05

- Seasons: optional countdown behind a gear, animated weather driven by
  `AIR_ART` motion tags, and a focus trap in the new dialog.
- Number Garden: a wrong answer in "Type Answer" mode left the field and Submit
  dead; timeouts fired after navigating away; `d` on a settings `<select>`
  answered the question behind the modal; two fast Enters scored one question
  twice; the activity screen's body colour tinted every other screen; a corrupt
  save bricked the game permanently. All fixed.
- Life Garden: `5` selected a species the palette does not offer; ⌘R reset the
  grid; controls were ~24px on a drag-driven game; the whole persistence layer
  was dead code and `showGrid` existed twice.
- Turing Tape: ⌘R reset the machine; the nav highlighted by label rather than id.
- All three answer games: the site's `?` help overlay let answer keys through.
  `shared/nav.js` had published `__helpOverlayIsOpen` all along.
- Number Garden gained the manifest, icon and iOS meta tags it never had;
  Seasons gained its `apple-touch-icon` link.
- A markup-contract test over all five games' `index.html`, which found a
  divergence on each of the two occasions it was extended.
- Turing Tape's "(solved)" marker rendered as visible text, because
  `.visually-hidden` was used in a game whose stylesheets never defined it —
  introduced and caught within the same 2026-09-05 pass.

## Not looked at

**Nothing in this repo has been rendered in a browser.** Tests and linters pass,
but the visual work — the Seasons settings dialog, the roughly one hundred
CSS-animated SVG groups of falling weather on the winter trail, and now the
Number Garden theme refactor — has never been looked at on a real screen. The
weather and the refactor both want one look on an actual iPad. There is no
headless browser in the dev dependencies, so nothing in the toolchain can check
this; it needs a person.

One pre-existing commit, `0f300d7` (2025-02-20), carries the work email address.
Rewriting it means rewriting every commit after it and force-pushing a public
repo, and would not remove anything — GitHub keeps orphaned commits reachable by
SHA. Left alone deliberately.

---

`S` under an hour · `M` half a day · `L` more, or needs a decision. State is
`open`, `decision owed`, or `blocked on <thing>`. Every claim carries its
evidence and a date; say so when something was not verified.

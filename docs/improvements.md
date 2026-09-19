# Improvements

> **Status: audited 2026-09-18 against `main` @ `b9881fc`.** Migrated from the
> unversioned `~/hobby/IMPROVEMENTS.md`, which covered seven repos at once and
> had drifted; every claim below was re-checked on this date. Items 1-3 were
> closed on 2026-09-19.

This file is the maintenance backlog: defects, debt, test gaps and doc drift.
Blog post ideas live in [`blog-ideas.md`](blog-ideas.md). Per-feature design
docs are the `*-plan.md` files in this directory.

## At a glance

1. No coverage check stops a `/zh/` page going backwards — M · open
2. An unused variable warning in `times-trail/__tests__/GameUI.test.js` — S · open

## Working on these

- Tests: `npm test` · Lint: `npx eslint .` · Build: `node build.js`
- Git hooks run the tests; see [`development.md`](development.md#git-hooks).
- Public repo. Never commit a work hostname, address, tool name or ticket ID.

## 1. No coverage check stops a `/zh/` page going backwards

**M · open**

Phase 4 of [`game-translation-plan.md`](game-translation-plan.md), and the only
phase still open. `build:verbose` is not a ratchet: it warned on 1 string for a
page that was 20% English. Nothing fails when a `/zh/` page regresses.

The measure that works is counting English text nodes in the built page —
skipping `<script>` and `<style>`, counting a node as English when it has no CJK
character and at least two ASCII letters. That is the measure the 2026-09-19
pass used, and it tracked reality where `build:verbose` did not.

Two things to settle first. The check needs a built `dist/`, which `npm test`
does not guarantee — so either build inside the test or run it as a separate
script after `npm run build` in the deploy workflow. And it needs an allowlist:
Turing Tape legitimately keeps `HALT`, and a bare count would fail on it.

Now guards two pages instead of five, which makes it cheaper and less valuable
at the same time.

_Checked 2026-09-19: `/zh/games/turing-tape/` is at 1 English node,
`/zh/games/life-garden/` at 0._

## 2. An unused variable warning in `times-trail/__tests__/GameUI.test.js`

**S · open**

`npm run lint` exits clean but reports `'TRAIL' is defined but never used` at
`games/times-trail/__tests__/GameUI.test.js:48`. Pre-existing, and the only lint
warning in the repo.

Either the test meant to assert something about `TRAIL` and does not, or the
binding is left over. Read it before deleting it — a dead binding in a test
sometimes marks a missing assertion rather than clutter.

_Checked 2026-09-19: one warning, zero errors, across all four linters._

## Settled

### Decided 2026-09-19

- **Three games lost their `/zh/` page: Number Garden, Seasons, Times Trail.**
  Option C of [`game-translation-plan.md`](game-translation-plan.md), applied per
  game. Their `*.zh.json` files are deleted, so the build generates no Chinese
  page, injects no hreflang, and lists no sitemap alternate. `.lang-slot:empty`
  collapses the switcher, so the English page shows no gap.

  The reason is structural. The build translates static HTML; a game writes most
  of its text at runtime; so a `/zh/` game page is Chinese chrome around English
  gameplay. Seasons and Times Trail were the clearest case — both scored zero
  English text nodes and both were entirely English in play. A page that
  declares `lang="zh"` and then speaks English is worse for a screen reader than
  an English page.

  Turing Tape and Life Garden keep theirs, because their chrome carries most of
  their text. Their gameplay is still English, which is the known remaining gap.
  Why is written up in
  [`translations.md`](translations.md#which-pages-have-a-chinese-version-and-why),
  in `games/README.md`, and in the plan.

- **`maxSteps` deleted rather than enforced.** Every level and demo declared it;
  nothing that ran one read it, because `TuringMachine` caps at its own
  `MAX_STEPS = 500`. Enforcing the declared figures would have been a behaviour
  change, and the honest fix was to stop implying the field did something.

  The demo halting test used `demo.maxSteps` as its loop bound. It now uses
  `DEMO_STEP_BOUND = 100` and also asserts the halt reason is not `"max-steps"`.
  That second assertion matters: at a bound of 500 or more the machine halts
  itself, so the test would have passed for a demo that never halts. Verified by
  breaking a demo and watching it fail both ways.

  Note for anyone reopening this: all five puzzle levels do have reference
  solutions, under `describe("level solutions")` in
  `__tests__/TuringMachine.test.js`. They hardcode the tape and rules instead of
  importing from `levels.js`, which is why a grep for `maxSteps` readers misses
  them.

### Landed 2026-09-19

- **Phase 1 of the game translation plan is done.** Turing Tape 41 English text
  nodes to 1, Life Garden 66 to 0, Number Garden 59 to 0. The one left is
  `HALT`, a state name the player types into the rule table — data, not prose.
  Number Garden's keys landed in `856a4bd` and were deleted the same day with
  its page; they are recoverable from git.

  **The Chinese is machine-written and unreviewed.** No native speaker has read
  it. Treat the wording on both remaining `/zh/` game pages as a first draft.

- **Two lines of stray tool-call markup removed from
  `games/turing-tape/README.md`.** The file ended with a literal `</content>`
  and `</invoke>`, introduced in `123d4e0` and rendering as visible garbage at
  the bottom of the page on GitHub. A repo-wide grep found no other instance.

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

- **`js/README.md` for Life Garden and Turing Tape.** The other three games had
  one; these two did not. Life Garden's covers the two-layer board, the seeded
  generator that makes the preset ecology tests possible, and three invariants
  that read like working code when broken -- the species numbering the digit keys
  depend on, the "is this cell taken" layer rule, and the per-gesture painted-cell
  set. Turing Tape's covers the shared `contentRange` alignment behind
  `matchesTape` and `matchMask`, and why that game has no
  `GameState`/`GameUI`/`EventManager` split, and it is what prompted item 3 --
  which was already a documented gap, just one nobody had decided about.
- **Every game page has a language switcher.** `build.js` injected the EN/中文
  link by replacing `</header>`, and no game page has a `<header>` -- so the
  replacement found nothing, failed silently, and all five games shipped without
  one. Games now mark a `<div class="lang-slot">` in their own top bar, and
  `html.test.js` asserts every page in the source tree has exactly one mount
  point.
- **Chinese titles for all five games.** 图灵纸带, 生命花园, 数字花园, 乘法小径,
  四季. A Chinese visitor used to get an English browser tab and an English
  search result.
- **`js/README.md` for `life-garden` and `turing-tape`**, which were the two of
  five without one.
- **Times Trail is five themed trails.** Doubles, Fives, Squares, Nines and the
  Tough Ten replace one 40-space board through eight table-named regions, and
  eight per-region gates collapse to one formula. See
  [`times-trail-plan.md`](times-trail-plan.md).
- **Seasons: the countdown is off by default**, and the trail moves -- idle
  motion on the animal and the snake woman through an optional thirteenth
  art-pack export, river shimmer, thicket sway, and item pips that pop in. See
  [`seasons-plan.md`](seasons-plan.md).
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
but nothing in the toolchain can check what a page looks like -- there is no
headless browser in the dev dependencies -- so this needs a person, on the
actual iPad. In rough order of how much is unverified:

- **Times Trail's trail picker.** A whole new screen, and the largest single
  piece of unlooked-at work: five rows of 16 to 20 spaces each, three space
  states, and a `grid-auto-flow: column` row that has to hold a 20-space trail
  and a 2-space one without the spaces stretching into bars.
- **Number Garden's dark theme.** Every colour in the game moved onto a token
  and the per-area colours are now `color-mix` derivations, so every one of the
  six areas wants a glance in both themes. The feedback fills stay light in dark
  mode on purpose; that is the pairing most likely to look wrong.
- **Seasons' motion** -- roughly a hundred CSS-animated SVG groups of falling
  weather on the winter trail, plus the new idle, shimmer and sway.
- **The language switcher, now on two game top bars.** Turing Tape and Life
  Garden. The other three lost their `/zh/` page on 2026-09-19, so their slot
  stays empty and `.lang-slot:empty` collapses it — that collapse is itself
  unverified in a browser, though the CSS predates the change and was written
  for `npm run dev`.
- **The two remaining `/zh/` game pages, read as Chinese.** The chrome is
  machine-written and no native speaker has read it. Chinese is also wider than
  English in some labels and narrower in others, so the game top bars want a
  look in both languages, not just one.

**Two `js/README.md` files were committed without a line-by-line read.**
`games/life-garden/js/README.md` and `games/turing-tape/js/README.md`, 546 lines
between them, landed in the working tree during the 2026-09-18 session from
outside it. Their file references were checked and are accurate, and the Turing
Tape one has been edited since; the Life Garden one has had no second pass.
Worth a read before anything relies on it.

One pre-existing commit, `0f300d7` (2025-02-20), carries the work email address.
Rewriting it means rewriting every commit after it and force-pushing a public
repo, and would not remove anything — GitHub keeps orphaned commits reachable by
SHA. Left alone deliberately.

---

`S` under an hour · `M` half a day · `L` more, or needs a decision. State is
`open`, `decision owed`, or `blocked on <thing>`. Every claim carries its
evidence and a date; say so when something was not verified.

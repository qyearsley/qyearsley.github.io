# Improvements

> **Status: audited 2026-09-18 against `main` @ `e955e81`.** Migrated from the
> unversioned `~/hobby/IMPROVEMENTS.md`, which covered seven repos at once and
> had drifted; every claim below was re-checked on this date.

This file is the maintenance backlog: defects, debt, test gaps and doc drift.
Blog post ideas live in [`blog-ideas.md`](blog-ideas.md). Per-feature design
docs are the `*-plan.md` files in this directory.

## At a glance

1. Three games have English chrome on their `/zh/` page — M · open
2. Game gameplay is English on every `/zh/` page — L · decision owed
3. Turing Tape's per-level `maxSteps` is never read — S · open

## Working on these

- Tests: `npm test` · Lint: `npx eslint .` · Build: `node build.js`
- Git hooks run the tests; see [`development.md`](development.md#git-hooks).
- Public repo. Never commit a work hostname, address, tool name or ticket ID.

## 1. Three games have English chrome on their `/zh/` page

**M · open**

Phase 1 of [`game-translation-plan.md`](game-translation-plan.md) — keys for the
text that lives in each game's `index.html`. Phase 0 (Chinese `<title>`) is done
for all five.

English text nodes left in the built `/zh/` page, counted by walking the body,
skipping `<script>` and `<style>`, and counting a node as English when it has no
CJK character and at least two ASCII letters:

| Game          | Nodes | What is left                                                 |
| ------------- | ----- | ------------------------------------------------------------ |
| Seasons       | 0     | Done                                                         |
| Times Trail   | 1     | Only the switcher's own "English" label, which is correct    |
| Life Garden   | 21    | The control bar and the keyboard legend                      |
| Turing Tape   | 42    | The whole UI, plus a "How it works" list split by `<strong>` |
| Number Garden | 47    | Menus, settings labels, area names, level-complete copy      |

Turing Tape's list needs the inline-markup convention in
[`translations.md`](translations.md): the whole `<li>` is one key, tags included.
Do not key the fragments separately — Chinese word order differs and they
reassemble wrongly.

_Checked 2026-09-18 against the built `dist/`, after the phase-0 titles landed._

## 2. Game gameplay is English on every `/zh/` page

**L · decision owed**

The blocker is structural, not effort: `build.js` translates by matching text
between tags in the HTML source, and a string a game writes into the DOM at
runtime never appears there. Every game keeps its questions, feedback, level
names and dialogs in JavaScript, so no key can reach them. Seasons scores zero
English nodes above and is still entirely English once you press Play.

Phase 2 of the plan is the decision, and it is not made. Option A is a shared
`shared/i18n.js` exporting `t()` with a per-game catalog; the plan recommends
proving it on Turing Tape first, which is the smallest game and the most factual
copy. Option B is to leave the gameplay in English and write that down as
deliberate. Option C is to drop the `/zh/` page for a game whose audience is one
English-speaking child.

Worth deciding alongside the plan's own open question: a page that declares
`lang="zh"` and then speaks English is worse for a screen reader than an English
page, which argues against a long-lived option B.

_Checked 2026-09-18: `grep -c "t(" games/*/js/*.js` is not a useful measure --
the real number needs the inventory pass the plan calls step one of phase 3._

## 3. Turing Tape's per-level `maxSteps` is never read

**S · open, and already a documented gap**

Not a new finding: `games/turing-tape/README.md` lists it under **Known gaps**
and mentions it twice more. This entry exists because the gap has a decision
attached that has never been made, and a known gap with no decision is how it
stays known forever.

Every level and demo in `js/levels.js` declares a `maxSteps`, but nothing that
runs one reads it -- `TuringMachine` caps at its own module constant,
`MAX_STEPS = 500` (`TuringMachine.js:1`). "Write One" declares `maxSteps: 10` and
runs 500 steps before reporting `max-steps`, with the message quoting 500.

Two ways to close it, and either is fine:

- **Pass `level.maxSteps` in as the cap.** The declared figures are the useful
  ones -- they hint at the intended solution length, and the tightest is 10
  against a cap fifty times larger. This is a behaviour change, not a fix:
  puzzles fail faster, which is the point, but a player midway through a long
  wrong attempt sees the error sooner than today.
- **Delete the field** and stop implying it does something. Cheaper, and honest.
  The demo bound in the tests would need a literal instead.

_Checked 2026-09-18: `grep -rn maxSteps games/turing-tape/` -- eight declarations
in `levels.js`; the only reader is `__tests__/levels.test.js`, which uses the demo
figures as a test bound at `:88-92` and type-checks the field at `:24` and `:67`.
`TuringMachine.js` never mentions it. The README records the gap at `:92`,
`:109-110` and `:174-176`._

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

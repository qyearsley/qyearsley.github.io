# Improvements

> **Status: audited 2026-09-18 against `main` @ `b9881fc`.** Migrated from the
> unversioned `~/hobby/IMPROVEMENTS.md`, which covered seven repos at once and
> had drifted; every claim below was re-checked on this date. The original items
> 1-3 were closed on 2026-09-19, and a second pass the same day closed the two
> that replaced them.

This file is the maintenance backlog: defects, debt, test gaps and doc drift.
Blog post ideas live in [`blog-ideas.md`](blog-ideas.md). Per-feature design
docs are the `*-plan.md` files in this directory.

## At a glance

1. The Chinese across the whole site is machine-written and unreviewed — M · needs a person
2. `homophones.html` glosses 211 characters in English on its `/zh/` page — S · decision owed
3. Floating Point's `2^53 (max safe int)` button is loose — S · decision owed
4. `buddhist-vocabulary.html` writes 義譯 where the standard term is 意譯 — S · decision owed

## Working on these

- Tests: `npm test` · Lint: `npx eslint .` · Build: `node build.js`
- Git hooks run the tests; see [`development.md`](development.md#git-hooks).
- Public repo. Never commit a work hostname, address, tool name or ticket ID.

## 1. The Chinese across the whole site is machine-written and unreviewed

**M · needs a person**

No native speaker has read any of it. This is now the largest quality risk on
the site, because the 2026-09-19 pass took coverage from partial to near-total:
every page but one is at zero English text nodes, so nothing looks unfinished
any more.

Where to look first, in order — these are the renderings the writing pass itself
flagged as weakest:

|     | String                         | Rendering  | Doubt                                                                           |
| --- | ------------------------------ | ---------- | ------------------------------------------------------------------------------- |
| 1   | "diacritic"                    | 变音符号   | Correct but bookish. Replaced 声调符号, which was wrong — ê and ü carry no tone |
| 2   | "diphthong"                    | 复元音     | Chinese pedagogy usually says 复韵母                                            |
| 3   | Cellular automaton             | 细胞自动机 | 元胞自动机 is the more standard term in Chinese CA literature                   |
| 4   | "smallest" (the 5e-324 button) | 最小正数   | Says more than the English, deliberately                                        |
| 5   | Number Garden's whole voice    | —          | A children's game translated flat; the copy is a cheer in English               |

Spacing around Latin text is also inconsistent: the files mostly run Chinese and
Latin together (`把ü改写成u`) but use spaces around filenames. Introduced
knowingly, worth one decision.

_Checked 2026-09-19. There is no way to verify this from inside the repo._

## 2. `homophones.html` glosses 211 characters in English on its `/zh/` page

**S · decision owed**

Each data row reads `黑板 [ban3] blackboard`. On the `/zh/` page the gloss stays
English, so a Chinese reader gets an English definition of a word they already
know.

Three ways out, and the cheapest may be the right one:

- **Leave them.** The gloss is for an English speaker learning which traditional
  character to use. On a Chinese page it is noise, but harmless noise.
- **Translate them.** 211 keys, each containing the hanzi and pinyin that never
  change. Fragile and dull.
- **Hide them on the `/zh/` page.** No mechanism exists for this today.

The coverage ratchet excludes them, so they do not distort the count either way.

_Checked 2026-09-19: 211 gloss nodes, against 5 real content strings on the same
page, all 5 now translated._

## 3. Floating Point's `2^53 (max safe int)` button is loose

**S · decision owed**

The button loads `9007199254740992`, which is 2^53.
`Number.MAX_SAFE_INTEGER` is 2^53 − 1 = `9007199254740991`. So the label names
one number and the button loads another.

The value is probably the deliberate one — 2^53 and 2^53+1 have identical bits,
which is the whole demonstration — and the label is the wrong part. Fixing it
means picking which to change, so it wants a decision rather than an edit. The
Chinese inherits the same looseness.

_Checked 2026-09-19 in `javascript/floating-point.html`._

## 4. `buddhist-vocabulary.html` writes 義譯 where the standard term is 意譯

**S · decision owed**

The essay opens by pairing the two translation strategies: `音譯 yīnyì` for
borrowing the sound, and `義譯 yìyì` for translating the meaning. The standard
pair in Chinese translation studies is 音譯 / **意譯**. 義譯 does occur in
Buddhist translation writing, so this may be deliberate.

The pinyin does not settle it: 義譯 and 意譯 are both `yìyì`.

This is a factual claim in someone's essay, so it was left alone rather than
corrected. If it is a typo, the Chinese key for that sentence changes with it.

_Checked 2026-09-19: `chinese/buddhist-vocabulary.html:39`. The page uses 義譯
once and never uses 意譯._

## Settled

### Decided 2026-09-19, no change

- **Attribute values stay English on `/zh/` pages.** The matcher only replaces
  text between tags, so `aria-label`, `title`, `alt` and `placeholder` are out
  of its reach — about 264 of them site-wide, including `aria-label`s that a
  screen reader announces in English on a page declaring `lang="zh"`. Closing it
  needs a mechanism in `build.js`, not more keys. Judged not worth it. Recorded
  in [`translations.md`](translations.md#attribute-values-are-never-translated)
  so it is not rediscovered as a bug.

### Landed 2026-09-19, second pass

- **The site is translated: 64 untranslated strings to 1.** The one left is the
  truth-table input syntax `(a and b) or (not a and not b)`, which is what that
  parser accepts.

  Most of it was cross-links. Every tool page already carried a Chinese name in
  its own `_title`, but the links between pages used the English one, so a
  Chinese reader saw "Truth Tables" and landed on 真值表. Those names now live in
  `zh-common.json`. They use the short in-body form each page already used, not
  the longer `_title` form — 15 name conflicts were created and then resolved
  that way, because `_title` is descriptive and link text is short.

- **A coverage ratchet, `__tests__/zh-coverage.test.js`.** Phase 4 of the game
  translation plan. It fails when a page goes backwards, fails when a page beats
  its baseline, and makes an unmatched key a hard failure rather than a build
  warning. It translates in memory, so `npm test` needs no built `dist/` — that
  was the plan's open question. Rules and reasons in
  [`translations.md`](translations.md#the-coverage-ratchet).

  It earned its keep immediately: it found four `chinese/` pages with
  untranslated prose, and its first counting rule was wrong in a way the work
  exposed — an English paragraph quoting 后 and 後 scored zero because the rule
  skipped any node containing CJK.

- **Two fragment-key bugs, both rendering visibly wrong.** Splitting a sentence
  around inline markup is what `translations.md` warns against. One left a
  Chinese paragraph opening with a bare English "A"; the other left a half-width
  `)` closing a full-width `（`. Both are now whole-element keys.

- **Three factual errors found by proofreading**, none of them wording: the tone
  table credited a perl script that is `make_tone_table.py`; the character
  converter described one-way conversion on a two-way tool; and the coin flipper
  said it simulates 1 to N trials when it plots the running frequency at every
  trial. Also a stacked relative clause with no noun after it, and a
  subject-verb disagreement, both on `homophones.html`.

- **`chinese/buddhist-vocabulary.html` has a Chinese page**, 76 English text
  nodes to 0 across 80 keys. It was the only page on the site without one, for
  no recorded reason. Nine table cells glossed Chinese characters in English
  (`覺者 "awakened one"`); those glosses are circular in Chinese and were
  dropped, keeping the term and its pinyin. Quoted traditional forms (音譯,
  五種不翻) stay traditional because they are the subject matter, so the page
  mixes simplified prose with traditional data on purpose.

- **`GameUI.test.js`'s unused `TRAIL` import removed**, which was the only lint
  warning in the repo. `TRAIL` is asserted in three other suites, so it was a
  stray import rather than a missing assertion. `npx eslint .` is now clean.

- **The Busy Beaver demo says 13 steps**, which is what the counter shows. It
  said 14.

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
- **Every other `/zh/` page, for the same reason.** The 2026-09-19 pass took the
  whole site to near-total coverage, so there is far more unreviewed Chinese
  than there was, and none of it has been seen rendered. The `chinese/` pages
  matter most: they are dense tables where a longer Chinese label can change a
  column width.

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

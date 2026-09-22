# Improvements

> **Status: audited 2026-09-18 against `main` @ `b9881fc`, re-checked
> 2026-09-20.** Migrated from the unversioned `~/hobby/IMPROVEMENTS.md`, which
> covered seven repos at once and had drifted. The original items 1-3 closed on
> 2026-09-19; the two that replaced them closed the same day; a five-agent
> Chinese review on 2026-09-20 closed nine translation errors and opened the
> items below. Chinese conventions and rulings now live in
> [`zh-translation.md`](zh-translation.md).

This file is the maintenance backlog: defects, debt, test gaps and doc drift.
Blog post ideas live in [`blog-ideas.md`](blog-ideas.md). Per-feature design
docs are the `*-plan.md` files in this directory.

## At a glance

1. No native speaker has read the Chinese — M · needs a person
2. 13 simplified characters still convert to the wrong traditional form — M · open
3. Runtime-rendered English on `/zh/` pages — M · open
4. The coverage ratchet cannot see inside `<script>` blocks — S · open
5. `homophones.html` glosses 211 characters in English on its `/zh/` page — S · decision owed
6. Floating Point's `2^53 (max safe int)` button is loose — S · decision owed
7. `buddhist-vocabulary.html` writes 義譯 where the standard term is 意譯 — S · decision owed
8. `叶昆廷` in every page body, `Quinten Yearsley` in every page title — S · decision owed

## Working on these

- Tests: `npm test` · Lint: `npx eslint .` · Build: `node build.js`
- Git hooks run the tests; see [`development.md`](development.md#git-hooks).
- Public repo. Never commit a work hostname, address, tool name or ticket ID.

## 1. No native speaker has read the Chinese

**M · needs a person**

Five model reviews ran on 2026-09-20 and found nine real errors, including one
sentence that called GB2312 a Traditional-Chinese encoding and then said it maps
simplified characters. Those are fixed. A model review is worth having and is not
a native reader.

What the reviews settled — the script, the typography and seven terms — is now
recorded in [`zh-translation.md`](zh-translation.md), along with the rulings, so a
second pass does not re-litigate them. Read that first.

What a native reader should still judge, since a model cannot:

|     | Where                 | The question                                                                 |
| --- | --------------------- | ---------------------------------------------------------------------------- |
| 1   | `life-garden`         | It is the most literary page on the site, and a child's game page            |
| 2   | `buddhist-vocabulary` | Culturally loaded vocabulary; `比附义理`, `咒力` and the five category names |
| 3   | `resume`              | Whether the compression reads as terse-professional or as thin               |
| 4   | Whole site            | Whether it reads as Chinese or as translated English                         |

_Checked 2026-09-20. There is no way to verify this from inside the repo._

## 2. 13 simplified characters still convert to the wrong traditional form

**M · open**

`traditionalize` in `chinese/tradsimp.js` inverts the forward character map, and
23 simplified characters receive two traditional characters each. The inverted
map can only pick one, so the other is always wrong.

Ten were fixed on 2026-09-20 — 后, 钟, 咨, 干, plus 了 and 余 which now have no
default at all. These thirteen are measured and left:

|     | Simplified | Converts to | Should sometimes be |
| --- | ---------- | ----------- | ------------------- |
| 1   | 系统       | 係統        | 系統                |
| 2   | 心脏       | 心髒        | 心臟                |
| 3   | 复杂       | 復雜        | 複雜                |
| 4   | 词汇       | 詞匯        | 詞彙                |
| 5   | 头发       | 頭發        | 頭髮                |
| 6   | 面对       | 麵對        | 面對                |
| 7   | 尽管       | 盡管        | 儘管                |
| 8   | 日历       | 日歷        | 日曆                |
| 9   | 收获       | 收獲        | 收穫                |
| 10  | 赞美       | 贊美        | 讚美                |
| 11  | 书签       | 書簽        | 書籤                |
| 12  | 冲水       | 衝水        | 沖水                |
| 13  | 台风       | 臺風        | 颱風                |

Each needs its own word list, the same shape as the ones already there. Doing
four and calling it done is the failure this repo keeps warning about, so they
were measured rather than half-fixed. 系统 and 心脏 are the two to take first.

Separately, the forward map is a top-1000 list and simply lacks a long tail —
糧, 紗, 綢, 纜, 艙, 薑, 蟬, 軀, 顱, 騾, 鹼, 黴 and many more pass through
unconverted. Expanding that is mechanical and should come from an OpenCC table,
not by hand.

_Checked 2026-09-20 by enumerating every many-to-one merge in the map._

## 3. Runtime-rendered English on `/zh/` pages

**M · open**

The same structural limit that cost three games their Chinese page, on pages that
kept theirs. `build.js` matches text in static HTML, so a string JavaScript writes
into the DOM stays English.

The worst case was `javascript/floating-point.html`, whose output panel showed
`Sign (1 bit)` / `Exponent (11 bits)` / `Mantissa (52 bits)` above prose calling
them 符号位 / 指数 / 尾数. **That one is fixed**, along with 14 more, by keying
into the inline script — see the note below.

**113 strings in `javascript/` are still English**, in two buckets that need
different answers:

|     | Bucket                                 | Count | Why                                 |
| --- | -------------------------------------- | ----- | ----------------------------------- |
| 1   | Bare literals, or runs broken by `${}` | 56    | No `>text<` for the matcher to find |
| 2   | External `.js` files                   | 57    | `build.js` only reads `.html`       |

Bucket 2 is concentrated: `logic-engine` alone holds 53 across four files, so
`/zh/javascript/logic-engine/` is an English app in a Chinese shell. The rest is
`truthtable.js`.

**Site-wide, and not counted above:** `shared/nav.js` renders the whole
keyboard-shortcuts dialog and `shared/theme.js` the theme popover, in English, on
every one of the 25 `/zh/` pages. Both are bucket 2.

Two game counters are worse than untranslated, because they translate and then
undo it: `life-garden`'s `第 0 代` flips to `Gen 1` on the first step
(`js/GameUI.js:93`), and `turing-tape`'s `步数：0` does the same
(`js/game.js:201`). A page that visibly reverts is worse than one that never
claimed to be translated. The password generator's Copy button had exactly this
shape and was fixed by having it restore its own label rather than a hardcoded
string — the same trick works for both counters.

**The reachable technique, for whoever picks this up.** `build.js` matches
`>text<` in the raw file bytes, so it reaches inside inline `<script>` blocks —
ordinary quoted strings, not just template literals. Anything a script injects as
markup can be keyed. Two limits: a key cannot contain a `${}`, and the coverage
test cannot see script blocks at all, so verification is build-and-grep. That is
item 4.

_Checked 2026-09-20 against the built `dist/zh/javascript/`._

## 4. The coverage ratchet cannot see inside `<script>` blocks

**S · open**

`__tests__/zh-coverage.test.js` strips `<script>` before counting English, so it
cannot check the 15 runtime strings now translated through script-block keys.

It still catches the loud failure: if such a key stops matching, the unmatched-key
assertion fails. What it cannot catch is a key that matches the _wrong_ `>…<`
somewhere else in the same file and passes silently. Today the only proof is to
build and grep by hand.

Two ways to close it. Count `>…<` runs inside script blocks as well, which is
noisy because code is full of them. Or assert that a named set of script-block
keys appears, translated, in the built page — narrower, and enough.

This matters more than it looks, because the technique is new. Before
2026-09-20 exactly one key reached into a script block, by accident.

_Checked 2026-09-20: the strip happens in `englishNodes`._

## 5. `homophones.html` glosses 211 characters in English on its `/zh/` page

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

## 6. Floating Point's `2^53 (max safe int)` button is loose

**S · decision owed**

The button loads `9007199254740992`, which is 2^53.
`Number.MAX_SAFE_INTEGER` is 2^53 − 1 = `9007199254740991`. So the label names
one number and the button loads another.

The value is probably the deliberate one — 2^53 and 2^53+1 have identical bits,
which is the whole demonstration — and the label is the wrong part. Fixing it
means picking which to change, so it wants a decision rather than an edit. The
Chinese inherits the same looseness.

_Checked 2026-09-19 in `javascript/floating-point.html`._

## 7. `buddhist-vocabulary.html` writes 義譯 where the standard term is 意譯

**S · decision owed**

The essay opens by pairing the two translation strategies: `音譯 yīnyì` for
borrowing the sound, and `義譯 yìyì` for translating the meaning. The standard
pair in Chinese translation studies is 音譯 / **意譯**. 義譯 does occur in
Buddhist translation writing, so this may be deliberate.

The pinyin does not settle it: 義譯 and 意譯 are both `yìyì`.

A reviewer added the point that decides it, if you want it decided: the classical
framing of Xuanzang's rules is 翻 against 不翻, not 音譯 against 意譯 at all. Both
labels in that sentence are modern, so there is no reason to prefer the rare one.
Note also that 義 simplifies to 义, not 意 — these are different words, not script
variants.

This is a factual claim in someone's essay, so the English was left alone. **The
Chinese now uses 意译 consistently**, because that is the mainland-standard term
and the page already used it eight times for the same concept. So the two
language versions disagree on this one word until the English is settled.

_Checked 2026-09-20: `chinese/buddhist-vocabulary.html:39` uses 義譯 twice and
never 意譯._

## 8. `叶昆廷` in every page body, `Quinten Yearsley` in every page title

**S · decision owed**

`zh-common.json` renders your name as 叶昆廷, so every `/zh/` page header and
footer says 叶昆廷 — while all 26 `_title` values keep `Quinten Yearsley`. A
reader sees one name on the page and a different one in the browser tab and in
search results.

The transliteration itself is fine: 叶 is a real surname and a conventional
phonetic fit, and 昆廷 is a standard rendering of Quentin/Quinten. Giving
yourself a Chinese name on a Chinese-language site reads as friendly.

Three ways to close it:

- **Use 叶昆廷 in the titles too.** Most consistent. Loses the Latin name from
  Chinese search results.
- **Write titles as `简历 - 叶昆廷 (Quinten Yearsley)`.** Keeps both, at the cost
  of a longer tab.
- **Drop 叶昆廷.** Also consistent, and reverses a choice already made.

_Checked 2026-09-20: 叶昆廷 appears 3 times, `Quinten Yearsley` 27 times. The
`_description` values split down the middle — `resume` says
`Quinten Yearsley的简历`, `contact` says `给叶昆廷发消息`. Those two do the same
job on adjacent pages and were the clearest symptom._

## Settled

### Landed 2026-09-21

- **Seasons: a wrong answer costs a question, not an item.** A miss keeps the
  question up until she finds the answer, shows the fact with a picture of it, and
  asks one more at the same space. Trails are roughly 40% shorter and each demand
  is now exactly what a season pays, so the snake woman's question is the one that
  fills the jar. New roster of perks built from time and hints, since a perk that
  changed an item count would break that. `WRONG_ANSWER`, `BOSS_FAILURE`,
  `BOSS_TRIES` and the lost-season screen are all gone. See
  [`seasons-plan.md`](seasons-plan.md).

  It also fixed a real bug nobody had hit yet: the question key was
  `seed:seasonId:attempt:questionsAsked`, so a reload part-way through a retry
  handed back a different question from the one on screen. The key is now keyed on
  the space instead.

### Landed 2026-09-20, third pass

- **`tradsimp.js` was wrong in both directions, and the reverse was worse.**
  Forward, a character map cannot decide 著 — as the aspect particle it is 着
  (看著), in the zhù sense it stays 著 — so 著名 came out 着名. Same for 乾, and
  麼 mapped to the variant 麽 rather than 么. 後, 餘, 諮 and 鍾 were missing or
  mapped to variants, so `以後` passed through untouched.

  Reverse, `traditionalize` inverts the forward map, so every merge picks one
  winner. `瞭: 了` meant **`traditionalize("好了")` returned `好瞭`** — the most
  common character in the language, corrupted since the map was written, and on
  nobody's list until the sweep found it.

  Both directions now scan word-first then character, in three shapes: a safe
  default with a closed exception list (后, 钟, 咨, 干); no default where none is
  safe (余, 了); and forward exceptions where the forward side is ambiguous
  (項鍊, 瞭望). Tests went 8 → 46, each fix with a test that fails without it.

  Correction to the entry this replaces: it said 麼 was _absent_ from the map. It
  was present, mapped to a variant. Different bug, same symptom.

- **The shadow-key trap is a gate.** One assertion per page in
  `__tests__/zh-coverage.test.js`, 26 in total. An identical value fails too,
  because it is the trap with the pin still in. Verified by adding both a
  duplicate and a conflicting key and watching each fail with its own message.

- **`npm test` runs in 5.2s, down from 10.9s.** A jest suite runs in one worker,
  so on 12 cores the wall clock was set by `Presets.test.js` alone at 9.9s.
  Splitting it and `seasons/game.test.js` is the whole win.

  `Presets` splits by preset rather than by subject, because all the simulation
  sits in the seven rows of one describe — splitting by subject leaves that whole
  and moves nothing. Test names are unchanged, zero simulation is duplicated, and
  a guard test asserts the ownership list covers `PRESETS`, since the split
  created a way for a new preset to have no coverage silently.

  149 tests before, 150 after, verified by diffing full test names rather than
  trusting a total. `Grid.countAll` also landed but is worth about 5%, not the
  20% first estimated from a single noisy 100ms sample.

- **15 runtime strings translated**, including all of `floating-point`'s bit
  panel. The password generator's Copy button needed a code change, not a key: it
  translated to 复制 and then reset itself to English permanently on first click.

### Decided 2026-09-19, no change

- **Attribute values stay English on `/zh/` pages.** The matcher only replaces
  text between tags, so `aria-label`, `title`, `alt` and `placeholder` are out
  of its reach — about 264 of them site-wide, including `aria-label`s that a
  screen reader announces in English on a page declaring `lang="zh"`. Closing it
  needs a mechanism in `build.js`, not more keys. Judged not worth it. Recorded
  in [`translations.md`](translations.md#attribute-values-are-never-translated)
  so it is not rediscovered as a bug.

### Landed 2026-09-19, second pass

- **The site is translated: 64 untranslated strings to 20, and all 20 are
  data.** Sixteen are pinyin spelling equations (`ia = ya`) on
  `pinyin-abbreviations.html`, three are UTF-8 bit patterns on
  `encoding-explorer.html`, and one is the truth-table input syntax
  `(a and b) or (not a and not b)`, which is what that parser accepts. No
  English prose is left on any page.

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

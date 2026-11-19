# Improvements

The maintenance backlog: defects, debt, test gaps and doc drift. Feature ideas
are in [`ideas.md`](ideas.md).
Chinese conventions and rulings are in [`zh-translation.md`](zh-translation.md).

Simplified on 2026-09-24. The detailed history of landed work is in git; the
last long version of this file is `git show 3ceed17:docs/improvements.md`.

- Tests: `npm test` · Lint: `npm run lint` · Build: `npm run build`
- Public repo. Never commit a work hostname, address, tool name or ticket ID.

## Open

Nothing open. Add new items here.

## Deferred

These are known and accepted for now. Do not re-propose them unless something
changes.

- **No native speaker has read the Chinese.** Five model reviews ran on
  2026-09-20. A native reader should still judge `life-garden`,
  `buddhist-vocabulary`, `resume`, and whether the site reads as translated
  English. Needs a person.
- **Runtime-rendered English on `/zh/` pages.** `build.js` translates static
  HTML only, so text that JavaScript writes stays English: about 113 strings in
  `javascript/` (53 in `logic-engine`), plus the `shared/nav.js` shortcuts dialog
  and the `shared/theme.js` popover on every `/zh/` page. `life-garden`'s
  `第 0 代` reverts to English on the first step. Turing Tape reads its
  runtime text from `js/strings.js` by `<html lang>`, so it stays Chinese.
- **Tokenizer Comparison keeps its own UTF-8 code** (2026-11-19).
  `TextEncoder` and `TextDecoder` could replace about 120 lines in
  `tokenizer-comparison.js`, but `bytesToText` is used by the page, not only by
  tests. Owner: keep for now.
- **The coverage test cannot see inside `<script>` blocks.**
  `__tests__/zh-coverage.test.js` strips them, so a script-block key that
  matches the wrong `>…<` passes silently. Build and grep to check.

## Settled

Decided with no change, so these are not re-proposed:

- **The maze keeps its seed and `?seed=` URL sync, and the Coin Flipper keeps
  its weighted and d6 modes** (2026-11-19). Both were proposed as cuts.

- **Chart.js has an SRI hash** (2026-11-18): `integrity="sha384-..."` on the
  Coin Flipper's `chart.js@4.4.7` script. The owner computed the hash in a normal
  terminal; the agent sandbox cannot reach jsDelivr. A version bump needs a new
  hash.
- **Times Trail, Seasons and Number Garden share one keyboard guard** (2026-11-18): `games/shared/keyboardGuard.js`. Times Trail's Escape-closes-settings gained the modifier and help-overlay checks the other two had.
- **DOM-wiring modules are now tested** (2026-11-18): Turing Tape `game.js` (via `init(doc)`), Logic Engine `ui.js`, and the answer and timer paths of Times Trail and Number Garden. `shared/life-background.js` stays untested on purpose.
- **The Chinese generator scripts are published on purpose.** `syllabary.html`
  and `tone-table.html` link to their `.py` generators as source, so skipping
  `*.py` in `build.js` breaks the link check (2026-10-19).
- **Seasons keeps `challengeTypes()`.** Only tests call it, but one of them
  checks that every season names a registered challenge type (2026-10-19).
- **`homophones.html` keeps its 211 English glosses on the `/zh/` page.** Not
  important (2026-09-24).
- **`buddhist-vocabulary.html` keeps 義譯 in the English.** The Chinese uses 意译.
  No change needed (2026-09-24).
- **Page titles keep `Quinten Yearsley` while `/zh/` page bodies say 叶昆廷.** No
  change needed (2026-09-24).
- **Attribute values stay English on `/zh/` pages.** `aria-label`, `title`,
  `alt` and `placeholder` need a `build.js` mechanism; judged not worth it. See
  [`translations.md`](translations.md#attribute-values-are-never-translated).
- **Number Garden, Seasons and Times Trail have no `/zh/` page.** Their text is
  written at runtime. See
  [`translations.md`](translations.md#which-pages-have-a-chinese-version-and-why).
- **Turing Tape cannot un-complete a level.** Progress in `localStorage` is never
  cleared. It cannot break anything.
- **`apple-touch-icon` points at `icon.svg`.** iOS ignores it, but that is better
  than adding binary files to the repo.
- **Life Garden's mouse drag cannot get stuck.** `mouseleave` ends the drag.
- **Seasons' `_choices` loop has no hang guard for answers above 2^53.** No
  season can produce one.
- **`generateMathOptions` can loop forever if `maxRange` is tiny.** The only
  caller passes 40 or more.
- **`tradsimp.js` keeps its top-1000 character map.** It is not meant to be
  complete, so rare characters such as 糧 and 纜 pass through (2026-09-25).
- **Commit `0f300d7` carries the work email address.** Rewriting public history
  would not remove it, because GitHub keeps orphaned commits reachable.

Landed 2026-11-19: the Syllogism preset-name note moved under How It Works;
the number, encoding and hash tool pages share `.tool-input`, `.placeholder` and
`.result-card` from `components.css` (their look is unchanged; `.lab-btn` stays
page-local because no shared button matches it); the FactSelector tests check
what is served instead of reading the private retry queue, and one of them
now pins the queue's sort, which only matters when two retries are due at once.

Landed 2026-11-19: ESLint 10, with `eslint-plugin-import-x` in place of
`eslint-plugin-import` (which accepts only eslint 9). The flaky Times Trail
Squares test is fixed: its second miss could land on the first missed fact,
which rightly moves that fact's retry later (0 of 100 runs fail; was 5 of 40).
The Seasons README's difficulty table matches `seasons.js`.

Landed 2026-11-19 (readability audit): Truth Tables applied `and` and `or`
last and left to right, so `a or b and c` meant `(a or b) and c`; it now uses
the Logic Engine's order, with `implies` right-associative. The Logic Engine
parser uses one precedence table, and `inferNextSteps` is synchronous.
`BaseGameUI` lost seven methods every game overrode; `isPlainObject` and
`nonNegativeInt` live in `games/shared/validate.js`; Seasons has no art-pack
registry. History comments are cut across the games (including Times Trail's
headers and the test files' `§` references), `build.js` and the CSS. The
theme picker CSS is in `style.css`. The character converter's direction
buttons use `.preset-btn`.

Landed 2026-10-21: the password generator uses `crypto`; the converter
escapes `?text=`; the Life Calculator parses dates as local and rejects future
ones; Logic Engine, Syllogism, Series Tester, Hash Collision Lab and Life
Garden open on an example; the maze runs about 7x faster by default; Number
Garden's Continue goes to the next area and strikes off wrong choices; Life
Garden's R asks first; Turing Tape's new rule row starts blank and a solve
offers "Next puzzle"; the games index says who each kid game is for; the skip
link hides fully and prose links take the theme color.

Landed 2026-11-18 (simplification audit): about 3,100 fewer lines. Unused
CSS in `components.css` and `style.css`; the dead theme globals and the second
`t` shortcut path; `StorageManager` export and import; the Seasons dead code and
history comments; Times Trail's one-mode registry and `sound` setting; Number
Garden's pasted SVG themes, 16 setup methods and `common.css`; the `?q=` script,
bit-grid CSS, doubled dark colors and `.controls-row` on the tool pages.
Homophones and Tone Table dark colors now honor the site toggle, and Life
Calculator uses `--color-primary`. Not checked in a browser: dark mode on the
tool pages and Chinese tables, Number Garden buttons and modals.

Landed 2026-11-18: form controls inherit the page font and size (`style.css`), controls inherit the page font size, 16px by default, so iOS does not zoom (Turing Tape's rule selects are 0.9rem on desktop and 16px on touch), and the 1.1 to 1.5rem input sizes on four tool pages are gone. Games: 44px tap targets on touch screens in Life Garden and Turing Tape, `100vh` fallback before `100dvh` in Seasons. The games share no CSS, only JS, so there was nothing to move onto; their palettes and top bars stay separate.

Landed 2026-11-18: Times Trail is simpler. The hub is the list of trails and a tap starts one; a round asks all of that trail's facts and ignores the tables setting, which is gone; every correct answer moves the token one space along a 20-space trail, with no strength gate; the default round is 10 questions; the play screen has one bar. (Was "Times Trail is confusing.")

Landed 2026-11-18: Life Garden is now a small grass, rabbit and fox model (about 300 lines of JS, down from 2700). Grass alone fills the board, rabbits alone become common, and rabbits with foxes cycle and usually last 500 generations.

Landed 2026-11-18: Turing Tape is simpler. The explanation is one sentence plus a Wikipedia link (a Chinese Wikipedia link on `/zh/`), the three demos and their read-only mode are gone, and runtime text (level names, messages, labels) is Chinese on `/zh/`.

Landed 2026-11-18: Seasons trails are shorter, 6, 6, 7 and 8 spaces. (Was "Seasons rounds are a little long.")

Landed 2026-11-18: Number Garden shows progress while you play: a strip under the level bar lists the six project pieces (earned, current, not yet) with a count. "View project" stays as the detailed view. Celebrations are smaller and shorter: 3 particles for 1s (was 5 for 2s), no idle bouncing, no spinning or tilting.

Landed 2026-11-18: Syllabary search no longer matches frequency counts (cells carry `data-search` with the pinyin only; the hover title still shows the count). Matching cells are outlined and the rest dimmed.

Landed 2026-10-19: lint skips `.claude/` (ESLint ignore, and `.gitignore` for
Prettier); the two READMEs and `development.md` match the pages and tests;
Seasons' unused `packNames()` is gone.

Landed 2026-10-05: removed Times Trail's tiles path, Life Garden's puzzle
scaffolding and dead Number Garden code; fixed the "golden leafs" plural, the
Times Trail keypad shortcut guard and Life Garden's Space-after-click.

Landed 2026-09-25: Floating Point's 2^53 button now says `first unsafe int`, and
its bits keep focus when toggled.

Landed 2026-09-24: `traditionalize` now converts the 13 merged pairs by word
(系統, 心臟, 複雜, 詞彙, 頭髮, 面對, 儘管, 日曆, 收穫, 讚美, 書籤, 沖水, 颱風).

Removed 2026-11-12: `game-translation-plan.md` (closed; the restore note is in
`translations.md`) and the landed entries in `ideas.md`.

Simplified 2026-11-12: the command lists in `CLAUDE.md` and `README.md` (kept in
`development.md`), `development.md`'s directory tree, hook rationale and lint
prose (the `.husky/` comments and config files hold them), the unused `atob` and
`btoa` ESLint globals, `make_tone_table.pl`, and the `AREA_THEMES` export.

## Not looked at in a browser

Tests and linters pass, but nothing in the toolchain renders a page. These need
a person to look, on an iPad where it matters:

- Times Trail's hub (the trail list) and the play screen's round counter.
- Number Garden's dark theme, in all six areas.
- Seasons' weather and idle motion.
- The language switcher on the Turing Tape and Life Garden top bars.
- Turing Tape on `/zh/`: the Chinese level text, messages and Pause label.
- The `/zh/` pages, especially the dense `chinese/` tables.
- The syllogism checker's Venn diagram: region shading and where the X marks land.
- Five Readings' tables on a narrow screen.
- Life Garden: click a preset, then press Space; it should play.
- Seasons' leaderboard and name field on the end screen (`?phase=end`).
- The Source and History footer on document pages, in both themes and on a phone.
- Prose links in the theme color, especially in the dark theme and the games'
  green.
- Form fields on the tool pages (floating point, integer explorer, encoding
  explorer, cellular automata, hash lab): inputs are now 16px, smaller than
  before. Buttons now inherit 16px where they had the browser's 13px.
- Life Garden and Turing Tape on an iPad: the larger buttons should still fit
  their rows. Seasons and Number Garden at 768x1024 and 1024x768 (no scrolling
  where a round should fit), not checked from CSS.
- Turing Tape's blank rule row and "Next puzzle" button; Number Garden's
  struck-off choices.
- The maze's new speed range, at both ends of the slider.
- The tool-page inputs after the move to `.tool-input` (floating point,
  integer explorer, hash lab, encoding explorer): they should look as before.
- The theme picker popover, now styled from `style.css`, on a tool page, a
  `/zh/` page and each game; and the character converter's direction buttons,
  which now have the preset-button hover.
- The tokenizer comparison's mix slider and the integer explorer's bit layout.
- Five Readings' readings are from memory (the page says so). Check them
  against Unihan; the least certain are the Cantonese tones for 骨, 立, 音 and
  北, and Korean 六 and 立.

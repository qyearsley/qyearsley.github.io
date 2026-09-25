# Improvements

The maintenance backlog: defects, debt, test gaps and doc drift. Feature ideas
are in [`ideas.md`](ideas.md), blog ideas in [`blog-ideas.md`](blog-ideas.md).
Chinese conventions and rulings are in [`zh-translation.md`](zh-translation.md).

Simplified on 2026-09-24. The detailed history of landed work is in git; the
last long version of this file is `git show 3ceed17:docs/improvements.md`.

- Tests: `npm test` · Lint: `npm run lint` · Build: `npm run build`
- Public repo. Never commit a work hostname, address, tool name or ticket ID.

## Open

Nothing open.

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
  `第 0 代` and `turing-tape`'s `步数：0` revert to English on the first step.
- **The coverage test cannot see inside `<script>` blocks.**
  `__tests__/zh-coverage.test.js` strips them, so a script-block key that
  matches the wrong `>…<` passes silently. Build and grep to check.

## Settled

Decided with no change, so these are not re-proposed:

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
  [`game-translation-plan.md`](game-translation-plan.md).
- **Turing Tape cannot un-complete a level.** Progress in `localStorage` is never
  cleared. It cannot break anything.
- **`apple-touch-icon` points at `icon.svg`.** iOS ignores it, but that is better
  than adding binary files to the repo.
- **Life Garden's mouse drag cannot get stuck.** `mouseleave` ends the drag.
- **`generateMathOptions` can loop forever if `maxRange` is tiny.** The only
  caller passes 40 or more.
- **`tradsimp.js` keeps its top-1000 character map.** It is not meant to be
  complete, so rare characters such as 糧 and 纜 pass through (2026-09-25).
- **Commit `0f300d7` carries the work email address.** Rewriting public history
  would not remove it, because GitHub keeps orphaned commits reachable.

Landed 2026-09-25: Floating Point's 2^53 button now says `first unsafe int`, and
its bits keep focus when toggled.

Landed 2026-09-24: `traditionalize` now converts the 13 merged pairs by word
(系統, 心臟, 複雜, 詞彙, 頭髮, 面對, 儘管, 日曆, 收穫, 讚美, 書籤, 沖水, 颱風).

## Not looked at in a browser

Tests and linters pass, but nothing in the toolchain renders a page. These need
a person to look, on an iPad where it matters:

- Times Trail's trail picker layout.
- Number Garden's dark theme, in all six areas.
- Seasons' weather and idle motion.
- The language switcher on the Turing Tape and Life Garden top bars.
- The `/zh/` pages, especially the dense `chinese/` tables.

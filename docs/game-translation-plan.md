# Game Translation Plan

Status: **phases 0 and 1 done, phase 2 decided 2026-09-19.** Phases 3 and 4 are
closed unless a game gets its Chinese page back. Updated 2026-09-19.

Leaving the games in English was a deliberate choice, not an oversight. The
translation pipeline matches text in static HTML, and a game keeps most of its
text in JavaScript, so a game page can never be finished the way a tool page
can. This plan says what it would take to finish one properly, and in what
order.

## The decision

**Two games keep a Chinese page. Three do not.** Turing Tape and Life Garden
keep theirs. Number Garden, Seasons and Times Trail lost theirs on 2026-09-19,
by deleting their `*.zh.json`.

This is option C below, applied per game. The reason is in
[`translations.md`](translations.md#which-pages-have-a-chinese-version-and-why),
which is the doc to read first.

The short version: a page that declares `lang="zh"` and then speaks English once
the player presses Play is worse than an English page. Seasons and Times Trail
were the clearest case. Both scored zero English text nodes, and both were
entirely English in play.

Turing Tape and Life Garden keep their pages because their chrome carries most
of their text. Their gameplay strings are still English, which is the known
remaining gap.

## Purpose

Five games had a `/zh/` page. Three of those pages were mostly English, and the
two that looked finished were finished only until you pressed Play. The plan
closed that gap in phases, cheapest first, and stopped at a decision point
before the expensive part. The decision is above.

## Current state

Measured 2026-09-19 against `main`, after phase 1 finished and three games lost
their Chinese page. English text nodes are counted in the built
`dist/zh/games/*/index.html`, skipping `<script>` and `<style>`, counting a node
as English when it has no CJK character and at least two ASCII letters.

|     | Game          | Chinese page | English nodes | Game JS        |
| --- | ------------- | ------------ | ------------- | -------------- |
| 1   | Turing Tape   | yes          | 1 of 41       | 3 files, 769   |
| 2   | Life Garden   | yes          | 0 of 66       | 13 files, 2.6k |
| 3   | Number Garden | no           | --            | 14 files, 3.7k |
| 4   | Seasons       | no           | --            | 10 files, 3.9k |
| 5   | Times Trail   | no           | --            | 13 files, 7.5k |

Turing Tape's one remaining node is `HALT`, a state name the player types into
the rule table. It is data, not prose, and translating it would tell the reader
to enter a word the machine rejects.

The counts measure chrome only. Both remaining pages are still English in play.

Two things the table does not show, and both matter more than the counts:

**A low English count does not mean a translated game.** Seasons scored zero
because almost all of its text is written by JavaScript at runtime. Its JS holds
strings like `"Play again"`, `"Best streak"` and
`"Start over? This erases your journey."`, and none of them go through the
translator. Times Trail is the same shape.

**`npm run build:verbose` is a hint, not a coverage measure.** It flags 1 string
on Life Garden, a page that is 20% English nodes. Count text nodes instead.

## The blocker: runtime strings

`build.js` translates by matching text between tags in the HTML source. A string
that a game writes into the DOM at runtime never appears there, so no key can
reach it. Every game keeps its questions, feedback, level names and dialogs in
JavaScript.

Sizing this is awkward. A grep for quoted multi-word literals gives 33 (Life
Garden) to 127 (Times Trail) per game, but that count is inflated by comments,
CSS selectors and internal error messages. The real number needs an inventory
pass per game, which is step one of phase 3.

## Phase 0: Chinese titles -- **done, 2026-09-18**

Every game page carried an English `_title`, so a Chinese visitor got an English
browser tab and an English search result. Five one-line edits. Three of the
names were already written elsewhere in the same file -- 乘法小径, 四季,
数字花园 -- and two were coined: **图灵纸带** for Turing Tape and **生命花园**
for Life Garden.

Verified by reading `<title>` out of each `dist/zh/games/*/index.html` after a
build.

## Phase 1: static HTML -- **done, 2026-09-19**

This is the part the existing pipeline does well. Every game's chrome is keyed.

|     | Game          | Before | After | Notes                                 |
| --- | ------------- | ------ | ----- | ------------------------------------- |
| 1   | Turing Tape   | 41     | 1     | The 1 is `HALT`, a state name         |
| 2   | Life Garden   | 66     | 0     | Control bar and keyboard legend       |
| 3   | Number Garden | 59     | 0     | Keys deleted with the page, see above |
| 4   | Times Trail   | 1      | 0     | `Streak 0`, added 2026-09-18          |
| 5   | Seasons       | 0      | 0     | Already finished                      |

Number Garden's keys landed in commit `856a4bd` and were deleted the same day
with its `*.zh.json`. They are recoverable from git if the page comes back.

Turing Tape's "How it works" list is the case that needs the inline-markup
convention in [translations.md](translations.md): the sentence
`The machine reads the symbol under the <strong>head</strong> (highlighted
cell).` is one key, tags and all. Do not key the fragments separately. Chinese
word order differs from English, and the fragments reassemble wrongly.

**The Chinese is machine-written and unreviewed.** No native speaker has read
it. The translating agents flagged their own weakest choices; those notes are in
the session that produced `856a4bd`, not in this repo. Treat the wording as a
first draft.

## Phase 2: the runtime mechanism -- **decided 2026-09-19, option C**

Three options were on the table.

**Option A -- a shared `t()` helper.** Add `shared/i18n.js` exporting a lookup
that reads `document.documentElement.lang`. Each game gets a catalog at
`games/<name>/i18n/zh.js`. Each user-facing literal in the game's JS becomes
`t("key")`. Cost: touches every game module. Benefit: the only option that makes
a game actually playable in Chinese, and it holds for any future game.

**Option B -- leave the JS in English.** Accept a game whose chrome is Chinese
and whose gameplay is English. Cost: nothing. Rejected, because the `lang="zh"`
problem in the open questions below does not go away by writing it down.

**Option C -- drop the `/zh/` page for a game.** Delete the game's `*.zh.json`
and no Chinese page is generated, no hreflang is injected, and no sitemap
alternate is listed. Honest, and cheaper than a half-translated page.

**Chosen: option C for Number Garden, Seasons and Times Trail.** Option B stands
for Turing Tape and Life Garden, whose chrome carries most of their text.
Option A is not ruled out for those two; it is simply not started.

## Phase 3: convert the games -- **not started, and mostly moot**

Only Turing Tape and Life Garden could still use this. The other three have no
Chinese page to improve.

1. **Turing Tape** -- 769 lines over 3 files, and the UI is a fixed set of
   labels. If `t()` is awkward here, it will be worse everywhere else.
2. **Life Garden** -- 2,583 lines, and the HTML side is done.

Each game starts with an inventory: list every literal that reaches the DOM,
separate it from the comments and selectors the grep picks up, and count it.
Stop and re-judge if the inventory is much larger than the estimate above.

Sizes for the three dropped games, if one ever comes back: Number Garden 3,665
lines, Seasons 3,904, Times Trail 7,450.

## Phase 4: a coverage check that does not lie -- **open**

Add a test that counts English text nodes in each built `/zh/` page and fails
when a page goes backwards. The current signal, `build:verbose`, warns on 1
string for a page that was 20% English, so it cannot be the ratchet.

The check needs the built `dist/`, which `npm test` does not currently
guarantee. Either build in the test, or run it as a separate script in the
deploy workflow after `npm run build`.

This now guards two pages instead of five, which makes it cheaper and less
valuable at the same time. It is still the only thing that would catch a
`/zh/` page regressing.

## Open questions

- Who reviews the Chinese? Nobody has. The chrome on both remaining pages is
  machine-written.
  Suggest: read the two pages before trusting the wording.
- Does anyone read these pages in Chinese? There is no analytics on the site, so
  the honest answer is unknown.
  Suggest: decide on the merits of a complete site rather than on traffic.
- Turing Tape and Life Garden still declare `lang="zh"` on a page whose gameplay
  is English. Option C fixed this for three games and left it for two.
  Suggest: revisit if either game grows more runtime text.

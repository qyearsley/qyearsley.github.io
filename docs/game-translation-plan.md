# Game Translation Plan

Status: **not started.** This is the plan, not a record of work done. Nothing in
`games/` has changed for it.

Leaving the games in English was a deliberate choice, not an oversight. The
translation pipeline matches text in static HTML, and a game keeps most of its
text in JavaScript, so a game page can never be finished the way a tool page
can. This plan says what it would take to finish one properly, and in what
order.

## Purpose

Five games have a `/zh/` page. Three of those pages are mostly English, and the
two that look finished are finished only until you press Play. The plan closes
that gap in four phases, cheapest first, and stops at a decision point before
the expensive part.

The recommendation: do phases 0 and 1 for every game, then do the runtime work
for Turing Tape only, and judge the rest from that.

## Current state

Measured 2026-09-13 against `main`. English text nodes are counted in the built
`dist/zh/games/*/index.html`, skipping `<script>` and `<style>`, counting a node
as English when it has no CJK character and at least two ASCII letters. The
`<title>` is excluded from the count and listed separately.

|     | Game          | zh keys | English nodes | Chinese `_title` | Game JS        |
| --- | ------------- | ------- | ------------- | ---------------- | -------------- |
| 1   | Turing Tape   | 2       | 40 of 47      | no               | 3 files, 769   |
| 2   | Number Garden | 2       | 52 of 84      | no               | 14 files, 3.7k |
| 3   | Life Garden   | 50      | 17 of 87      | no               | 13 files, 2.6k |
| 4   | Times Trail   | 33      | 1 of 71       | no               | 13 files, 7.5k |
| 5   | Seasons       | 11      | 0 of 15       | no               | 10 files, 3.9k |

Two things the table does not show, and both matter more than the counts:

**A low English count does not mean a translated game.** Seasons scores zero
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

## Phase 0: Chinese titles

Every game page carries an English `_title`, so a Chinese visitor gets an
English browser tab and an English search result. Five one-line edits in the
`*.zh.json` files. Three of the names are already written elsewhere in the same
file -- 乘法小径, 四季, 数字花园. Life Garden and Turing Tape need a name coined.

Verify: `npm run build`, then read `<title>` out of each
`dist/zh/games/*/index.html`.

## Phase 1: static HTML

This is the part the existing pipeline already does well. Add keys to each
game's `*.zh.json` for the text in `index.html`.

|     | Game          | What is left in the HTML                                     |
| --- | ------------- | ------------------------------------------------------------ |
| 1   | Turing Tape   | The whole UI, plus a "How it works" list split by `<strong>` |
| 2   | Number Garden | Menus, settings labels, area names, level-complete copy      |
| 3   | Life Garden   | The control bar and the keyboard legend                      |
| 4   | Times Trail   | One label, `Streak 0`                                        |
| 5   | Seasons       | Nothing                                                      |

Turing Tape's "How it works" list is the case that needs the inline-markup
convention in [translations.md](translations.md): the sentence
`The machine reads the symbol under the <strong>head</strong> (highlighted
cell).` is one key, tags and all. Do not key the fragments separately. Chinese
word order differs from English, and the fragments reassemble wrongly.

## Phase 2: decide the runtime mechanism

Three options. This is the decision point, and nothing in phase 3 starts until
it is made.

**Option A -- a shared `t()` helper.** Add `shared/i18n.js` exporting a lookup
that reads `document.documentElement.lang`. Each game gets a catalog at
`games/<name>/i18n/zh.js`. Each user-facing literal in the game's JS becomes
`t("key")`. Cost: touches every game module. Benefit: the only option that makes
a game actually playable in Chinese, and it holds for any future game.

**Option B -- leave the JS in English.** Finish phases 0 and 1, accept a game
whose chrome is Chinese and whose gameplay is English. Cost: nothing. This is
today's behavior, made deliberate and written down.

**Option C -- drop the `/zh/` page for a game.** Delete the game's `*.zh.json`
and no Chinese page is generated, no hreflang is injected, and no sitemap
alternate is listed. Honest, and cheaper than a half-translated page. Worth
considering for Number Garden, whose audience is a specific English-speaking
child.

Option A for Turing Tape, and a per-game call for the rest.

## Phase 3: convert the games

Order is smallest-first, so the mechanism gets proved on the cheapest game.

1. **Turing Tape** -- 769 lines over 3 files, and the UI is a fixed set of
   labels. If `t()` is awkward here, it will be worse everywhere else.
2. **Life Garden** -- 2,583 lines, and the HTML side is nearly done already.
3. **Number Garden** -- 3,665 lines, and the most runtime copy per line.
4. **Seasons** -- 3,904 lines. Nearly all the work is runtime strings.
5. **Times Trail** -- 7,450 lines, the largest, and the one with the most
   generated feedback text.

Each game starts with an inventory: list every literal that reaches the DOM,
separate it from the comments and selectors the grep picks up, and count it.
Stop and re-judge if the inventory is much larger than the estimate above.

## Phase 4: a coverage check that does not lie

Add a test that counts English text nodes in each built `/zh/` page and fails
when a page goes backwards. The current signal, `build:verbose`, warns on 1
string for a page that is 20% English, so it cannot be the ratchet.

The check needs the built `dist/`, which `npm test` does not currently
guarantee. Either build in the test, or run it as a separate script in the
deploy workflow after `npm run build`.

## Open questions

- Who writes and reviews the Chinese for a children's game? The tool pages are
  short and factual. Number Garden's copy is a voice ("Help the magic garden
  grow!"), and a literal translation will read badly.
  Suggest: translate Turing Tape first, which is factual, and see how the voice
  problem looks on Number Garden afterwards.
- Does anyone read these pages in Chinese? There is no analytics on the site, so
  the honest answer is unknown.
  Suggest: decide on the merits of a complete site rather than on traffic.
- Should the games keep `lang="zh"` on a page whose gameplay is English? A page
  that declares Chinese and then speaks English is worse for a screen reader
  than an English page. This argues for option C over a long-lived option B.

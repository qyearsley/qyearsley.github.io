# Translation System

## Overview

The build script generates a Chinese version of every page that has a
co-located `*.zh.json` file. `build.js` finds them by walking the source tree,
so there is no list to maintain. Translation is text-matching: each English
string in the JSON file is matched against the HTML and replaced with its
Chinese equivalent.

This file covers the pipeline. For the Chinese itself -- which script, which
terms, and what a review already found -- see
[`zh-translation.md`](zh-translation.md).

## Translation Files

Translation files live next to the HTML pages they translate, using the
naming convention `<name>.zh.json`:

```
zh-common.json                       Shared strings + homepage translations
index.zh.json                        Opts the homepage in (may be empty)
404.zh.json                          404 page translations
resume/index.zh.json                 Resume translations
contact/index.zh.json                Contact page translations
chinese/index.zh.json                Chinese section index
chinese/syllabary.zh.json            Per-page translations
chinese/tone-table.zh.json
...
javascript/index.zh.json             JS section index
javascript/coin-flipper.zh.json      Per-page translations
...
games/index.zh.json                  Games section index
games/turing-tape/index.zh.json      Per-game translations (only two games have one)
...
```

A page needs its own `*.zh.json` to be translated at all, even when every string
it uses already lives in `zh-common.json` -- the homepage's `index.zh.json` is
`{}` for exactly that reason.

Run `npm run translations` to list all translation files.

## Which pages have a Chinese version, and why

Deleting a page's `*.zh.json` removes its Chinese version completely. The build
generates no `/zh/` page, injects no `hreflang` tags, lists no sitemap
alternate, and leaves the language switcher out. `.lang-slot:empty` in
`css/style.css` collapses the empty switcher slot, so the page shows no gap.

Every tool and writing page has a Chinese version. Only two of the five games
do, and the reason is the pipeline itself.

**The build translates static HTML. A game writes most of its text at runtime.**
The matcher replaces text between tags in the HTML source. A string that
JavaScript puts into the DOM never appears there, so no key can reach it. This
is a limit of the approach, not a gap in the keys.

A game page therefore has two kinds of text:

|     | Kind     | Lives in     | Translatable |
| --- | -------- | ------------ | ------------ |
| 1   | Chrome   | `index.html` | Yes          |
| 2   | Gameplay | `js/*.js`    | No           |

A game whose gameplay text is small keeps its Chinese page. A game whose
gameplay text is large does not, because the page would claim `lang="zh"` and
then speak English as soon as the player presses Play. That is worse for a
screen reader than an English page, and it misleads a Chinese visitor who
follows the switcher.

|     | Game          | Chinese page | Why                                               |
| --- | ------------- | ------------ | ------------------------------------------------- |
| 1   | Turing Tape   | Yes          | Fixed labels, factual copy, 761 lines of JS       |
| 2   | Life Garden   | Yes          | Chrome carries most of the text                   |
| 3   | Number Garden | No           | 3.7k lines of JS, and one English-speaking player |
| 4   | Seasons       | No           | Almost all text is written at runtime             |
| 5   | Times Trail   | No           | 7.5k lines of JS, and generated feedback text     |

Seasons and Times Trail are the case the counts hide. Both scored zero English
text nodes while their gameplay stayed entirely English, so both looked finished
and were not.

The Chinese games index at `/zh/games/` still lists all five games. It links to
the English page for the three that have no Chinese version. The index keeps its
Chinese descriptions, so a Chinese visitor can still read what each game does.

To give a game a Chinese page again, add back its `*.zh.json` and translate the
gameplay strings too. [`game-translation-plan.md`](game-translation-plan.md)
records what that costs.

## JSON Format

Each file maps English text to Chinese:

```json
{
  "_title": "页面标题",
  "_description": "页面描述",
  "English text in page": "Chinese translation"
}
```

- Keys starting with `_` are special: `_title` replaces `<title>`, `_description` replaces the meta description.
- All other keys match text content between HTML tags (`>text<`).
- Common strings in `zh-common.json` are merged into every page.

## Text Split by Inline Markup

A key matches one run of text between two tags. A sentence broken by a
`<strong>`, a `<code>` or an `<a>` is more than one run, so a plain-text key
cannot match it.

Write the markup into the key, and into the Chinese value:

```json
{
  "The machine reads the symbol under the <strong>head</strong> (highlighted cell).": "机器读取<strong>读写头</strong>下方的符号（高亮格）。"
}
```

Rules for these keys:

- The key must cover the whole contents of its element, from the opening tag to
  the closing tag. A key that starts in the middle of a sentence does not match.
- Copy the tags exactly, attributes included. If you change an `href` or a
  `style` in the page, change it in the key too. The build warns when a key
  stops matching.
- Write the tags as plain HTML (`</a>`). The matcher allows whitespace before
  the closing `>` of a tag, so Prettier wrapping a long tag onto its own line
  does not break the key.
- Keep the `href` as it appears in the source page. Link rewriting for `/zh/`
  runs after translation.

Do not split a sentence into several small keys instead. Chinese word order
differs from English, so the fragments reassemble in the wrong order.

## How Matching Works

1. Entries are sorted longest-first to prevent partial matches
2. Whitespace is normalized (spaces match newlines/indentation)
3. `&` matches both `&` and `&amp;`
4. A tag in a key may have whitespace before its closing `>`
5. Matching starts and ends at a tag boundary. An attribute value is never
   translated, though a key may contain one as part of its inline markup.

## Adding Translations

1. Create a `<name>.zh.json` file next to the HTML page -- this alone opts the
   page into the pipeline
2. Run `npm run build` -- warnings about unmatched keys appear by default
3. Run `npm test` -- the coverage ratchet tells you what is still English

A new page starts with a baseline of zero, so the suite fails until the page is
fully translated. That is deliberate.

## The coverage ratchet

`__tests__/zh-coverage.test.js` is the gate. It counts English text nodes in
each translated page and fails when a page goes backwards. It also fails when a
page beats its baseline, and prints the number to paste in, so an improvement
gets locked in instead of leaving slack.

It translates in memory with `translateContent`, so it needs no built `dist/`
and `npm test` runs it on its own.

It makes an unmatched key a hard failure. `build.js` only warns, and a key that
matches nothing leaves a page silently English where it looks translated. This
is the usual way a page rots: someone rewords a sentence and the key stops
matching.

**If you edit English prose on a translated page, re-run the suite.** Your edit
almost certainly broke that page's keys.

What counts as English:

|     | Rule                                           | Why                               |
| --- | ---------------------------------------------- | --------------------------------- |
| 1   | No CJK character, and two or more words        | The ordinary case                 |
| 2   | Five or more English words, even if it has CJK | English prose that quotes Chinese |

Rule 2 exists because rule 1 alone missed a whole untranslated paragraph on
`homophones.html`. The paragraph quotes 后, 後, 復, 複 and 复, so it contained
CJK and was skipped, and the page scored zero.

A single-word node is never counted. On the `chinese/` pages almost every one is
pinyin (`ban3`, `yao`), a filename or a bit pattern, and counting them buried
the signal -- `tone-table.html` scored 378 of them against one real miss. The
cost is that a one-word English label does not show up here. Find those by
reading the page.

Three baselines are not zero, and all three are data rather than gaps: the UTF-8
bit patterns on `encoding-explorer.html`, the pinyin spelling equations on
`pinyin-abbreviations.html`, and the truth-table input syntax
`(a and b) or (not a and not b)`, which is what that parser accepts.

The ~211 English dictionary glosses in the `homophones.html` data rows
(`] blackboard`) are excluded and counted separately. Whether a Chinese page
should gloss 黑板 as "blackboard" for a reader who already knows is an open
question, not a translation gap.

## Attribute values are never translated

The matcher only replaces text between tags, so `aria-label`, `title`, `alt` and
`placeholder` stay English on every `/zh/` page -- about 264 of them site-wide.
A screen reader announces those in English on a page that declares `lang="zh"`.

Known and accepted. Closing it needs a mechanism in `build.js`, not more keys.

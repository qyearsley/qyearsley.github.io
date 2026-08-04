# Translation System

## Overview

The build script generates a Chinese version of every page that has a
co-located `*.zh.json` file. `build.js` finds them by walking the source tree,
so there is no list to maintain. Translation is text-matching: each English
string in the JSON file is matched against the HTML and replaced with its
Chinese equivalent.

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
games/number-garden/index.zh.json    Per-game translations
...
```

A page needs its own `*.zh.json` to be translated at all, even when every string
it uses already lives in `zh-common.json` -- the homepage's `index.zh.json` is
`{}` for exactly that reason.

Run `npm run translations` to list all translation files.

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

## How Matching Works

1. Entries are sorted longest-first to prevent partial matches
2. Whitespace is normalized (spaces match newlines/indentation)
3. `&` matches both `&` and `&amp;`
4. Only text between `>` and `<` is matched (not attributes)

## Adding Translations

1. Create a `<name>.zh.json` file next to the HTML page -- this alone opts the
   page into the pipeline
2. Run `npm run build` -- warnings about unmatched keys appear by default
3. Run `npm run build:verbose` to also see possibly-untranslated English text

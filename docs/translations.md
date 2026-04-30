# Translation System

## Overview

The build script generates Chinese translations for every page listed in
`TRANSLATABLE_PAGES` (in `build.js`). Translations use text-matching:
each English string in a JSON file is matched against the HTML and replaced
with its Chinese equivalent.

## Translation Files

Translation files live next to the HTML pages they translate, using the
naming convention `<name>.zh.json`:

```
zh-common.json                       Shared strings + homepage translations
404.zh.json                          404 page translations
resume/index.zh.json                 Resume translations
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

1. Add the page to `TRANSLATABLE_PAGES` in `build.js`
2. Create a `<name>.zh.json` file next to the HTML page
3. Run `npm run build` -- warnings about unmatched keys appear by default
4. Run `npm run build:verbose` to also see possibly-untranslated English text

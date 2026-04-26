# Translation System

## Overview

The build script generates Chinese translations for every page listed in
`TRANSLATABLE_PAGES` (in `build.js`). Translations use text-matching:
each English string in a JSON file is matched against the HTML and replaced
with its Chinese equivalent.

## Translation Files

Translation JSON files live in `i18n/zh/`. The directory structure mirrors
the site:

```
i18n/zh/
  _common.json          Shared strings (Home, Skip to content, etc.)
  index.json            Homepage translations
  404.json              404 page translations
  resume.json           Resume translations
  chinese.json          Chinese section index
  chinese/
    syllabary.json      Per-page translations
    tonetable.json
    ...
  javascript.json       JS section index
  javascript/
    coinflip.json       Per-page translations
    ...
  games.json            Games section index
  games/
    number-garden.json  Per-game translations
    ...
```

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
- Common strings in `_common.json` are merged into every page.

## How Matching Works

1. Entries are sorted longest-first to prevent partial matches
2. Whitespace is normalized (spaces match newlines/indentation)
3. `&` matches both `&` and `&amp;`
4. Only text between `>` and `<` is matched (not attributes)

## Adding Translations

1. Add the page to `TRANSLATABLE_PAGES` in `build.js`
2. Create a JSON file at the matching path under `i18n/zh/`
3. Run `npm run build` -- the build warns about:
   - Unmatched keys (no English text found for a translation)
   - Untranslated text (English that looks like it should be translated)

# Chinese Language Tools

Interactive tools for studying Chinese language and transliteration.

## Available Tools

- **[Syllabary](syllabary.html)** - Transliteration syllabary showing Chinese characters commonly used for foreign words, organized by pronunciation
- **[Tone Table](tone-table.html)** - Interactive table for practicing and visualizing Mandarin tones
- **[Homophones](homophones.html)** - Simplified-traditional character relationships via homophone substitutions
- **[Character Converter](character-converter.html)** - Convert between traditional and simplified Chinese characters
- **[Pinyin Abbreviations](pinyin-abbreviations.html)** - Common pinyin abbreviation patterns
- **[Encoding Explorer](encoding-explorer.html)** - Explore how Chinese characters are encoded in Unicode
- **[Buddhist Vocabulary](buddhist-vocabulary.html)** - How Indian Buddhist vocabulary was rendered into Chinese, and why

## Regenerating Pages

The generator scripts produce an HTML `<table>` fragment, not a full page. None
of them edit the pages in `chinese/` -- you paste the new table into the
corresponding `.html` file by hand.

```bash
# Syllabary table -- written to stdout, after three progress lines.
# The table itself starts at the first "<table>" line.
cd chinese/syllabary
python3 make_syllabary.py

# Homophone substitution table -- written to stdout, progress to stderr,
# so redirecting stdout gives a clean fragment.
cd chinese/homophone_subs
python3 make_homophone_subs_html.py

# Tone table -- written to tone_table.html in the current directory.
cd chinese/tonetable
python3 make_tone_table.py
```

Each script reads the `.txt` data files sitting next to it.
`chinese/tonetable/make_tone_table.pl` is an older Perl version of the tone
table generator, kept for reference; use the Python one.

## Shared Logic

`tradsimp.js` holds the traditional/simplified conversion mapping used by
`character-converter.html`. It has unit tests in `tradsimp.test.js`, run by
`npm test` from the repository root.

`url-state.js` holds pure helpers (`resolveTextParam`, `resolveEnumParam`) for
reading a query parameter with a silent fallback. Tests live in
`url-state.test.js`.

## URL parameters

Several tool pages read their main input from the query string on load, and
keep the URL in sync via `history.replaceState` as it changes, so the current
state can be shared with a link. An invalid or missing value falls back to
the page's default without an error.

- `encoding-explorer.html`: `?text=` -- the characters to analyze, e.g.
  `?text=%E6%B1%89%E5%AD%97`.
- `character-converter.html`: `?text=` -- the text to convert, and `?dir=` --
  `trad-to-simp` (default, omitted from the URL) or `simp-to-trad`.
- `syllabary.html`, `homophones.html`, `tone-table.html`: `?q=` -- the filter
  box's search term. This reads and writes the existing `#table-filter` input
  rather than changing `shared/table-filter.js`, which owns the filtering
  itself.

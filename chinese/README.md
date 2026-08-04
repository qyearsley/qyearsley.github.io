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

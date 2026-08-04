# Syllabary Generation Script

This directory contains the script and data files for generating the Chinese transliteration syllabary table.

## Files

- `make_syllabary.py` - Python script that generates the HTML table
- `generate_frequencies.py` - Script that analyzes transliteration data to produce frequency tables
- `translit_char_freqs_pronunciation.txt` - Data file with character frequencies and pronunciations
- `country_translit.txt` - Country transliterations used for analysis
- `name_translit.txt` - Name transliterations used for analysis

## Usage

To regenerate the syllabary table:

```bash
python3 make_syllabary.py
```

The script writes the HTML table to **stdout**; it does not modify
`../syllabary.html`. Three progress lines are printed to stdout ahead of the
table, and parse warnings go to stderr, so the fragment you want begins at the
first `<table>` line. Paste it over the existing table in `../syllabary.html`.

## Data Format

The data file `translit_char_freqs_pronunciation.txt` contains lines in the format:

```
character<tab>frequency<tab>pinyin-with-tone
```

For example:

```
尔	744	er3
阿	456	a1
巴	87	ba1
```

## Output

The script generates an HTML table with:

- Character cells with `title` tooltips showing pinyin and frequency
- `frequent` / `infrequent` CSS classes on each character
- Table structure matching the layout `../syllabary.html` expects

Styling for those classes lives in `css/components.css`, using the site's design
tokens so the table follows light and dark mode.

## Frequency Threshold

`FREQUENT_THRESHOLD` in `make_syllabary.py` is 10. Characters with frequency > 10
get the `frequent` class (`--color-text`, semibold); frequency ≤ 10 gets
`infrequent` (`--color-text-muted`, normal weight).

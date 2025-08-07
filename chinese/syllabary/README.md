# Syllabary Generation Script

This directory contains the script and data files for generating the Chinese transliteration syllabary table.

## Files

- `make_syllabary.py` - Python script that generates the HTML table
- `translit_char_freqs_pronunciation.txt` - Data file with character frequencies and pronunciations
- `borrowed_words.txt` - List of borrowed words used for analysis
- `city_translit.txt` - City transliterations used for analysis
- `country_translit.txt` - Country transliterations used for analysis
- `name_translit.txt` - Name transliterations used for analysis

## Usage

To generate the syllabary table:

```bash
python3 make_syllabary.py
```

This will output HTML table markup to stdout that can be embedded in the syllabary.html page.

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

- Character cells with tooltips showing pinyin and frequency
- CSS classes for frequent vs. infrequent characters
- Proper table structure for the syllabary layout
- Responsive design compatible with the modernized syllabary.html page

## Frequency Threshold

Characters with frequency > 10 are marked as "frequent" and displayed in bold black text.
Characters with frequency ≤ 10 are marked as "infrequent" and displayed in gray text.

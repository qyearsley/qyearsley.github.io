# Chinese Language Tools

Interactive tools for studying Chinese language and transliteration.

## Available Tools

- **[Syllabary](syllabary.html)** - Transliteration syllabary showing Chinese characters commonly used for foreign words, organized by pronunciation
- **[Tone Table](tone-table.html)** - Interactive table for practicing and visualizing Mandarin tones
- **[Homophones](homophones.html)** - Simplified-traditional character relationships via homophone substitutions
- **[Character Converter](character-converter.html)** - Convert between traditional and simplified Chinese characters
- **[Pinyin Abbreviations](pinyin-abbreviations.html)** - Common pinyin abbreviation patterns
- **[Encoding Explorer](encoding-explorer.html)** - Explore how Chinese characters are encoded in Unicode

## Regenerating Pages

When updating Chinese language resources, run the appropriate Python script:

```bash
# Regenerate syllabary
cd chinese/syllabary
python3 make_syllabary.py

# Regenerate tone table
cd chinese/tonetable
python3 make_tone_table.py

# Regenerate homophone substitutions
cd chinese/homophone_subs
python3 make_homophone_subs_html.py
```

These scripts read from `.txt` data files in their directories and output HTML files to the parent `chinese/` directory.

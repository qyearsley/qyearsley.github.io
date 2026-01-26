# Chinese Language Tools

Interactive tools for studying Chinese language and transliteration.

## Available Tools

- **[Syllabary](syllabary.html)** - Transliteration syllabary showing Chinese characters commonly used for foreign words, organized by pronunciation
- **[Tone Table](tonetable.html)** - Interactive table for practicing and visualizing Mandarin tones
- **[Homophone Substitutions](homophone_subs.html)** - Common homophone substitutions in Chinese
- **[Traditional/Simplified Converter](tradsimp.html)** - Convert between traditional and simplified Chinese characters
- **[Pinyin Abbreviations](pinyin_abbreviations.html)** - Common pinyin abbreviation patterns

## Regenerating Pages

When updating Chinese language resources, run the appropriate Python script:

```bash
# Regenerate syllabary
cd chinese/syllabary
python make_syllabary.py

# Regenerate tone table
cd chinese/tonetable
python make_tone_table.py

# Regenerate homophone substitutions
cd chinese/homophone_subs
python make_homophone_subs_html.py
```

These scripts read from `.txt` data files in their directories and output HTML files to the parent `chinese/` directory.

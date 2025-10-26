# chinese

Chinese language resources (syllabary for transliteration, tone tables, homophone substitutions, pinyin abbreviations)

## Regenerating Chinese Language Pages

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

These scripts read from `.txt` data files in their directories and output HTML
files to the parent `chinese/` directory.

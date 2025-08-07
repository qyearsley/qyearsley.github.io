#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Generate character frequency data for the transliteration syllabary.

This script analyzes the transliteration data files (name_translit.txt,
country_translit.txt) and generates a frequency table of Chinese characters
used in transliterations. All pinyin input is converted to lowercase.

The output file translit_char_freqs_pronunciation.txt contains:
character<tab>frequency<tab>pinyin-with-tone
"""

import sys
from collections import defaultdict


def parse_pinyin_with_tones(pinyin_text):
    """
    Parse pinyin text and extract individual syllables with tone numbers.

    Args:
        pinyin_text (str): Pinyin text with tone marks or numbers

    Returns:
        list: List of syllables with tone numbers
    """
    # Split by spaces first to get individual syllables
    syllables = []
    for syllable in pinyin_text.split():
        if not syllable:
            continue

        # Convert tone marks to numbers
        tone_mark_to_number = {
            "ā": "a1",
            "á": "a2",
            "ǎ": "a3",
            "à": "a4",
            "ē": "e1",
            "é": "e2",
            "ě": "e3",
            "è": "e4",
            "ī": "i1",
            "í": "i2",
            "ǐ": "i3",
            "ì": "i4",
            "ō": "o1",
            "ó": "o2",
            "ǒ": "o3",
            "ò": "o4",
            "ū": "u1",
            "ú": "u2",
            "ǔ": "u3",
            "ù": "u4",
            "ǖ": "v1",
            "ǘ": "v2",
            "ǚ": "v3",
            "ǜ": "v4",
            "Ā": "a1",
            "Á": "a2",
            "Ǎ": "a3",
            "À": "a4",
            "Ē": "e1",
            "É": "e2",
            "Ě": "e3",
            "È": "e4",
            "Ī": "i1",
            "Í": "i2",
            "Ǐ": "i3",
            "Ì": "i4",
            "Ō": "o1",
            "Ó": "o2",
            "Ŏ": "o3",
            "Ò": "o4",
            "Ū": "u1",
            "Ú": "u2",
            "Ŭ": "u3",
            "Ù": "u4",
            "Ǖ": "v1",
            "Ǘ": "v2",
            "Ǚ": "v3",
            "Ǜ": "v4",
        }

        # Find which tone mark is in this syllable
        tone_number = "1"  # default
        for mark, replacement in tone_mark_to_number.items():
            if mark in syllable:
                tone_number = replacement[-1]  # Get the tone number
                # Replace the tone mark with the base letter
                base_letter = replacement[:-1]  # Get the base letter
                syllable = syllable.replace(mark, base_letter)
                break

        # Add tone number if not already present
        if not syllable[-1].isdigit():
            syllable += tone_number

        syllables.append(syllable)

    return syllables


def extract_characters_and_pinyin(chinese_text, pinyin_text):
    """
    Extract individual characters and their corresponding pinyin.

    Args:
        chinese_text (str): Chinese character text
        pinyin_text (str): Corresponding pinyin text

    Returns:
        list: List of (character, pinyin) tuples
    """
    # Parse pinyin into syllables
    pinyin_syllables = parse_pinyin_with_tones(pinyin_text)

    # Extract individual Chinese characters
    characters = list(chinese_text)

    # Match characters to pinyin syllables
    char_pinyin_pairs = []

    # Handle cases where we have more characters than pinyin syllables
    # This can happen with punctuation or special characters
    for i, char in enumerate(characters):
        if i < len(pinyin_syllables):
            char_pinyin_pairs.append((char, pinyin_syllables[i]))
        else:
            # Skip characters without pinyin (punctuation, etc.)
            continue

    return char_pinyin_pairs


def process_data_file(filename, char_frequencies):
    """
    Process a data file and update character frequencies.

    Args:
        filename (str): Path to the data file
        char_frequencies (defaultdict): Dictionary to store character frequencies
    """
    try:
        with open(filename, "r", encoding="utf-8") as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()

                # Skip comments and empty lines
                if not line or line.startswith("#"):
                    continue

                # Split by tabs
                parts = line.split("\t")
                if len(parts) < 3:
                    print(
                        f"Warning: Line {line_num} in {filename} has insufficient data: {line}",
                        file=sys.stderr,
                    )
                    continue

                _, chinese, pinyin = parts[:3]

                # Convert pinyin to lowercase to ignore capitalization
                pinyin = pinyin.lower()

                # Extract character-pinyin pairs
                char_pinyin_pairs = extract_characters_and_pinyin(chinese, pinyin)

                # Update frequencies
                for char, pinyin_syllable in char_pinyin_pairs:
                    char_frequencies[(char, pinyin_syllable)] += 1

    except FileNotFoundError:
        print(f"Error: File '{filename}' not found.", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error processing {filename}: {e}", file=sys.stderr)
        sys.exit(1)


def main():
    """Main function to process all data files and generate frequency output."""
    data_files = ["name_translit.txt", "country_translit.txt"]

    print("Processing transliteration data files...")

    # Dictionary to store character frequencies: (char, pinyin) -> frequency
    char_frequencies = defaultdict(int)

    # Process each data file
    for filename in data_files:
        print(f"Processing {filename}...")
        process_data_file(filename, char_frequencies)

    # Convert to the required format and sort by frequency
    output_data = []
    for (char, pinyin), frequency in char_frequencies.items():
        output_data.append((char, frequency, pinyin))

    # Sort by frequency (descending), then by character
    output_data.sort(key=lambda x: (-x[1], x[0]))

    # Write output file
    output_filename = "translit_char_freqs_pronunciation.txt"
    print(f"Writing {len(output_data)} character entries to {output_filename}...")

    with open(output_filename, "w", encoding="utf-8") as f:
        for char, frequency, pinyin in output_data:
            f.write(f"{char}\t{frequency}\t{pinyin}\n")

    print(f"Successfully generated {output_filename}")
    print(f"Total unique character-pinyin combinations: {len(output_data)}")

    # Print some statistics
    total_frequency = sum(freq for _, freq, _ in output_data)
    print(f"Total character occurrences: {total_frequency}")

    # Show top 10 most frequent characters
    print("\nTop 10 most frequent characters:")
    for i, (char, freq, pinyin) in enumerate(output_data[:10], 1):
        print(f"{i:2d}. {char} ({pinyin}): {freq}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Reads a data file and outputs HTML for the transliteration syllabary.

Lines in the data file are in the format:
char<tab>freq<tab>pinyin-with-tone-number

This script generates an HTML table showing Chinese characters used for
transliterating foreign names and words, organized by pinyin syllables.
"""

import sys
from pathlib import Path

DATA_FILE = "translit_char_freqs_pronunciation.txt"
FREQUENT_THRESHOLD = 10


def read_data_file(filename):
    """Read and parse the data file, returning processed data."""
    char_to_numbered_pinyin = {}  # char -> pinyin (e.g., 尔 -> er3)
    char_to_frequency = {}  # char -> frequency (e.g., 尔 -> 232)
    toneless_pinyin_to_char = {}  # toneless pinyin -> char (e.g., er -> 尔)
    toneless_pinyin_to_html = {}  # toneless pinyin -> HTML span

    try:
        with open(filename, "r", encoding="utf-8") as datafile:
            for line_num, line in enumerate(datafile, 1):
                line = line.strip()
                if not line or line.startswith("#"):
                    continue

                values = line.split()
                if len(values) < 3:
                    print(
                        f"Warning: Line {line_num} has insufficient data: {line}",
                        file=sys.stderr,
                    )
                    continue

                char, freq_str, pinyin = values
                try:
                    freq = int(freq_str)
                except ValueError:
                    print(
                        f"Warning: Invalid frequency on line {line_num}: {freq_str}",
                        file=sys.stderr,
                    )
                    continue

                # Remove tone number to get toneless pinyin
                toneless_pinyin = pinyin[:-1] if pinyin[-1].isdigit() else pinyin

                char_to_numbered_pinyin[char] = pinyin
                char_to_frequency[char] = freq

                # Create HTML span with tooltip
                html = f'<span title="{pinyin}; {freq}" class="{"frequent" if freq > FREQUENT_THRESHOLD else "infrequent"}">{char}</span>'

                # Keep the character with highest frequency for each toneless pinyin
                if (
                    toneless_pinyin not in toneless_pinyin_to_char
                    or freq
                    > char_to_frequency[toneless_pinyin_to_char[toneless_pinyin]]
                ):
                    toneless_pinyin_to_char[toneless_pinyin] = char
                    toneless_pinyin_to_html[toneless_pinyin] = html

    except FileNotFoundError:
        print(f"Error: Data file '{filename}' not found.", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error reading data file: {e}", file=sys.stderr)
        sys.exit(1)

    return toneless_pinyin_to_html


def generate_spellings():
    """Generate a 2D list of pinyin spellings.

    Returns a 2D list where rows are finals and columns are initials.
    Some combinations will be impossible syllables, which is fine since
    only syllables with actual data will be displayed.
    """
    zero_initial_finals = [
        "er",
        "a",
        "o",
        "e",
        "ai",
        "ei",
        "ao",
        "ou",
        "an",
        "en",
        "ang",
        "eng",
        "ong",
        "yi",
        "ya",
        "yao",
        "ye",
        "you",
        "yan",
        "yin",
        "yang",
        "ying",
        "yong",
        "wu",
        "wa",
        "wo",
        "wai",
        "wei",
        "wan",
        "wen",
        "wang",
        "weng",
        "yu",
        "yue",
        "yuan",
        "yun",
        "x",
    ]

    normal_finals_spellings = [
        "er",
        "a",
        "o",
        "e",
        "ai",
        "ei",
        "ao",
        "ou",
        "an",
        "en",
        "ang",
        "eng",
        "ong",
        "i",
        "ia",
        "iao",
        "ie",
        "iu",
        "ian",
        "in",
        "iang",
        "ing",
        "iong",
        "u",
        "ua",
        "uo",
        "uai",
        "ui",
        "uan",
        "uen",
        "uang",
        "ueng",
        "v",
        "ve",
        "ve",
        "van",
        "vn",
        "x",
    ]

    jqx_finals_spellings = [
        "er",
        "a",
        "o",
        "e",
        "ai",
        "ei",
        "ao",
        "ou",
        "an",
        "en",
        "ang",
        "eng",
        "ong",
        "i",
        "ia",
        "iao",
        "ie",
        "iu",
        "ian",
        "in",
        "iang",
        "ing",
        "iong",
        "x",
        "ua",
        "uo",
        "uai",
        "ui",
        "uan",
        "uen",
        "uang",
        "ueng",
        "u",
        "ue",
        "ue",
        "uan",
        "un",
        "x",
    ]

    syllables = [zero_initial_finals]

    # Add normal initials (b, p, m, f, d, t, n, l, g, k, h, z, c, s, zh, ch, sh, r)
    for initial in [
        "b",
        "p",
        "m",
        "f",
        "d",
        "t",
        "n",
        "l",
        "g",
        "k",
        "h",
        "z",
        "c",
        "s",
        "zh",
        "ch",
        "sh",
        "r",
    ]:
        this_initial_list = [initial + final for final in normal_finals_spellings]
        syllables.append(this_initial_list)

    # Add j, q, x initials (which have special rules)
    for initial in ["j", "q", "x"]:
        this_initial_list = [initial + final for final in jqx_finals_spellings]
        syllables.append(this_initial_list)

    return syllables


def print_pinyin_table(syllable_to_html):
    """Print the HTML table with the given dictionary of syllables to HTML."""
    spellings = generate_spellings()

    final_names = [
        "er",
        "a",
        "o",
        "e",
        "ai",
        "ei",
        "ao",
        "ou",
        "an",
        "en",
        "ang",
        "eng",
        "ong",
        "i",
        "ia",
        "iao",
        "ie",
        "iou",
        "ian",
        "in",
        "iang",
        "ing",
        "iong",
        "u",
        "ua",
        "uo",
        "uai",
        "uei",
        "uan",
        "uen",
        "uang",
        "ueng",
        "v",
        "ve",
        "ve",
        "van",
        "vn",
    ]

    initial_names = [
        "-",
        "b",
        "p",
        "m",
        "f",
        "d",
        "t",
        "n",
        "l",
        "g",
        "k",
        "h",
        "z",
        "c",
        "s",
        "zh",
        "ch",
        "sh",
        "r",
        "j",
        "q",
        "x",
    ]

    print("<table>")
    print("<tr><th></th>")
    for initial in initial_names:
        print(f"<th>{initial}</th>", end="")
    print("</tr>")

    for final_index, final_name in enumerate(final_names):
        print(f"<tr><th>{final_name}</th>")
        for initial_index in range(len(initial_names)):
            spelling = spellings[initial_index][final_index]
            if spelling in syllable_to_html:
                print(f"\t<td>{syllable_to_html[spelling]}</td>")
            else:
                print("\t<td></td>")
        print("</tr>")
    print("</table>")


def main():
    """Main function to process data and generate HTML table."""
    print(f"Processing data file: {DATA_FILE}")
    print(f"Frequent threshold: {FREQUENT_THRESHOLD}")

    syllable_to_html = read_data_file(DATA_FILE)
    print(f"Found {len(syllable_to_html)} unique syllables")

    print_pinyin_table(syllable_to_html)


if __name__ == "__main__":
    main()

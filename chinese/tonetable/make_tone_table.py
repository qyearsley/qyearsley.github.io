#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Generate a HTML tone table from frequency_pinyin_table.txt
Mimics the behavior of make_tone_table.pl
"""

import re
from collections import defaultdict


def frequency_level(rank):
    """Assign a frequency level based on rank."""
    rank = int(rank)
    if rank < 250:
        return 0
    elif rank < 500:
        return 1
    elif rank < 1000:
        return 2
    elif rank < 1500:
        return 3
    elif rank < 2000:
        return 4
    elif rank < 2500:
        return 5
    else:
        return 6


def join_initial_final(initial, final):
    """Given initial and final, return the standard way of writing in pinyin."""
    if initial == "-":
        if final == "u":
            final = "wu"
        elif final == "i":
            final = "yi"
        elif final == "ui":
            final = "wei"
        elif final.startswith("v"):
            final = "yu" + final[1:]
        elif final.startswith("i"):
            final = "y" + final[1:]
        elif final.startswith("u"):
            final = "w" + final[1:]
        initial = ""
    else:
        if final == "iou":
            final = "iu"
        elif final == "uen":
            final = "un"

    if initial in ["j", "q", "x"]:
        if final.startswith("u"):
            final = "X" + final[1:]
        final = final.replace("v", "u")

    return initial + final


def parse_data_file(filename):
    """Parse the frequency_pinyin_table.txt file."""
    syllables = defaultdict(lambda: defaultdict(lambda: defaultdict(str)))

    with open(filename, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue

            # Parse: char\trank\tpinyin
            match = re.match(r"^(\S+)\s+(\d+)\s+(\S+)$", line)
            if not match:
                continue

            zi, rank, pinyin = match.groups()
            rank = int(rank)
            is_primary = not pinyin.endswith("*")
            freq = frequency_level(rank)
            is_frequent = freq < 6

            if is_primary and is_frequent:
                # Extract syllable and tone
                tone_match = re.match(r"^(.+?)(\d)$", pinyin)
                if tone_match:
                    syll, tone = tone_match.groups()
                    tone = int(tone)
                    if tone == 5:  # Convert tone 5 to 0 (neutral tone)
                        tone = 0
                    syllables[syll][tone][freq] += zi

    return syllables


def generate_html_table(syllables):
    """Generate the HTML table."""
    # Define the syllable patterns to generate
    initials = [
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

    finals = [
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
        "ui",
        "uan",
        "uen",
        "uang",
        "ueng",
        "v",
        "ve",
        "van",
        "vn",
    ]

    html_lines = []
    html_lines.append("<table>")
    html_lines.append(
        "<tr><th></th><th>0</th><th>1</th><th>2</th><th>3</th><th>4</th></tr>"
    )

    # Print "er" first
    print_row("er", syllables, html_lines)

    # Print other syllables
    for final in finals:
        for initial in initials:
            syllable = join_initial_final(initial, final)
            if syllable in syllables:
                print_row(syllable, syllables, html_lines)

    html_lines.append("</table>")
    return "\n".join(html_lines)


def print_row(syllable, syllables, html_lines):
    """Print a table row for a syllable."""
    html_lines.append(f"<tr><th class='syllable'>{syllable}</th>")

    for tone in range(5):  # 0-4
        if not syllables[syllable][tone]:
            html_lines.append(f"\t<td class='tone{tone}' class='empty'></td>")
        else:
            html_lines.append(f"\t<td class='tone{tone}'>")
            for freq in range(6):  # 0-5
                hanzi = syllables[syllable][tone][freq]
                if hanzi:
                    html_lines.append(f"<span class='freq{freq}'>{hanzi}</span>")
            html_lines.append("</td>")

    html_lines.append("</tr>")


def main():
    """Main function."""
    input_file = "frequency_pinyin_table.txt"
    output_file = "tone_table.html"

    print(f"Reading data from {input_file}...")
    syllables = parse_data_file(input_file)

    print("Generating HTML table...")
    html_table = generate_html_table(syllables)

    print(f"Writing HTML to {output_file}...")
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(html_table)

    print("Done!")


if __name__ == "__main__":
    main()

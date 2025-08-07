#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script to generate HTML table for simplified-traditional character relationships.

This script reads homophone_subs.txt and generates an HTML table showing
one-to-many relationships between simplified and traditional Chinese characters.
"""

import sys
from typing import Dict, List, Tuple, Any


DATA_FILE = "homophone_subs.txt"


class HomophoneData:
    """Container for homophone substitution data."""

    def __init__(self):
        self.lookup: Dict[Tuple[str, str], Dict[str, List[Tuple[str, str]]]] = {}

    def add_simplified_char(self, pinyin: str, simplified: str):
        """Add a simplified character entry."""
        self.lookup[(pinyin, simplified)] = {}

    def add_traditional_char(
        self, pinyin: str, simplified: str, traditional: str, meaning: str
    ):
        """Add a traditional character entry."""
        self.lookup[(pinyin, simplified)][traditional] = []

    def add_example(
        self, pinyin: str, simplified: str, traditional: str, example: str, meaning: str
    ):
        """Add an example word/phrase."""
        self.lookup[(pinyin, simplified)][traditional].append((example, meaning))


def read_data(filename: str) -> HomophoneData:
    """
    Read input data into a structured format.

    Args:
        filename: Path to the input data file

    Returns:
        HomophoneData object containing the parsed data

    Raises:
        FileNotFoundError: If the input file doesn't exist
        ValueError: If the data format is invalid
    """
    data = HomophoneData()

    try:
        with open(filename, "r", encoding="utf-8") as f:
            current_simp = None
            current_trad = None

            for line_num, original_line in enumerate(f, 1):
                line = original_line.rstrip("\n\r")

                if not line:
                    continue

                # Skip lines that don't follow the expected pattern
                if (
                    line.startswith("'")
                    or line.startswith("赞")
                    or line.startswith("熏")
                    or line.startswith("腌")
                    or line.startswith("曲")
                ):
                    continue

                # Count leading tabs to determine indentation level
                leading_tabs = 0
                for char in line:
                    if char == "\t":
                        leading_tabs += 1
                    else:
                        break

                if leading_tabs == 0:
                    # This is a line like "g-031 发 fa1" or "u-005 板 ban3"
                    try:
                        parts = line.split()
                        if len(parts) >= 3:
                            # Format: "g-031 发 fa1" where first part is code, second is char, third is pinyin
                            code, simp, pinyin = parts[:3]

                            # Validate that we have a proper code format (letter-number)
                            if (
                                code[0].isalpha()
                                and code[1] == "-"
                                and code[2:].isdigit()
                            ):
                                current_simp = (
                                    pinyin,
                                    simp,
                                )  # Store the raw character, not HTML
                                data.add_simplified_char(pinyin, simp)

                    except (ValueError, IndexError) as e:
                        # Skip problematic lines
                        continue

                elif leading_tabs == 1:
                    # This is a line like "\t發 [fā] launch, start." (single tab)
                    try:
                        if current_simp is None:
                            continue  # Skip if no simplified character is set

                        stripped_line = line.lstrip("\t")
                        if " [" not in stripped_line or "]" not in stripped_line:
                            continue

                        trad, rest = stripped_line.split(" [", 1)
                        if "]" not in rest:
                            continue

                        trad_pinyin, meaning = rest.split("] ", 1)
                        current_trad = trad
                        # Use the simplified character's pinyin for consistency
                        data.add_traditional_char(
                            current_simp[0], current_simp[1], trad, meaning
                        )

                    except (ValueError, IndexError) as e:
                        # Skip problematic lines
                        continue

                elif leading_tabs == 2:
                    # This is a line like "\t\t出發 [chūfā] to head off" (double tab)
                    try:
                        if current_simp is None or current_trad is None:
                            continue  # Skip if no simplified or traditional character is set

                        stripped_line = line.lstrip("\t")
                        if " [" not in stripped_line or "]" not in stripped_line:
                            continue

                        example, rest = stripped_line.split(" [", 1)
                        if "]" not in rest:
                            continue

                        example_pinyin, meaning = rest.split("] ", 1)
                        # Use the simplified character's pinyin for consistency
                        data.add_example(
                            current_simp[0],
                            current_simp[1],
                            current_trad,
                            example,
                            meaning,
                        )

                    except (ValueError, IndexError) as e:
                        # Skip problematic lines
                        continue

    except FileNotFoundError:
        print(f"Error: Input file '{filename}' not found.", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error reading file: {e}", file=sys.stderr)
        import traceback

        traceback.print_exc()
        sys.exit(1)

    return data


def generate_html_table(data: HomophoneData) -> str:
    """
    Generate the HTML table from the parsed data.

    Args:
        data: HomophoneData object containing the parsed data

    Returns:
        HTML string containing the complete table
    """
    html_lines = []

    # Table header
    html_lines.append(
        """<table>
  <thead>
    <tr>
      <th width="10%">Simplified Character</th>
      <th width="30%">Traditional Character</th>
      <th>Examples</th>
    </tr>
  </thead>
  <tbody>"""
    )

    # Generate table rows
    for pinyin, simp in sorted(data.lookup.keys()):
        # Count total rows for this simplified character
        total_rows = sum(
            len(examples) for examples in data.lookup[(pinyin, simp)].values()
        )

        if total_rows == 0:
            continue  # Skip entries with no examples

        # Print simplified character header
        html_lines.append(
            f'    <tr><th rowspan={total_rows}><span class="simp char">{simp}</span></th>'
        )

        # Print traditional characters and examples
        first_trad = True
        for trad in sorted(data.lookup[(pinyin, simp)].keys()):
            examples = data.lookup[(pinyin, simp)][trad]

            if not examples:
                continue  # Skip traditional characters with no examples

            if not first_trad:
                html_lines.append("    <tr>")

            # Create the traditional character entry with HTML formatting
            trad_entry = f'<span class="trad char">{trad}</span> [<span class="pinyin">{pinyin}</span>]'
            html_lines.append(f"      <td rowspan={len(examples)}>{trad_entry}</td>")

            for i, (example, meaning) in enumerate(examples):
                if i > 0:
                    html_lines.append("    <tr>")
                example_entry = f'<span class="trad">{example}</span> [<span class="pinyin">{pinyin}</span>] {meaning}'
                html_lines.append(f"       <td>{example_entry}</td></tr>")

            first_trad = False

    # Close table
    html_lines.append("  </tbody>\n</table>")

    return "\n".join(html_lines)


def main():
    """Main function to process the data and generate HTML."""
    print("Reading data from", DATA_FILE, "...", file=sys.stderr)

    try:
        data = read_data(DATA_FILE)
        print(f"Processed {len(data.lookup)} simplified characters", file=sys.stderr)

        print("Generating HTML table...", file=sys.stderr)
        html_table = generate_html_table(data)

        print(html_table)

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

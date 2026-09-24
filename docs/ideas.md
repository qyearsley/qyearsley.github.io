# Ideas

Feature ideas that nobody has committed to yet. Defects and debt go in
`improvements.md`.

## Ningbo tone sandhi machine

A tool in `chinese/`. The user types a word as syllables with their citation
tones. The tool shows how each tone changes in context, one rule at a time, as a
state machine over the syllable sequence.

- It follows the 2015 blog post on Ningbonese tones.
- It can be a tool without a blog post. The steps it shows are the explanation.

A proof of concept landed on 2026-09-24 as `chinese/ningbo-sandhi.html`. It has
four generic Wu rules (the first syllable's tone spreads over the word), and its
tone contours and example syllables are placeholders. The page says so in a
draft notice, and `chinese/index.html` does not link to it yet.

**Still blocked on a native speaker.** Replace the rules and contours with the
ones from the 2015 post, then have a Ningbo speaker check them against real
words. A wrong rule looks right to anyone who does not speak the dialect.

## Tokenizer comparison

Train a tiny BPE tokenizer in the browser on a short English text and a short
Chinese text. Then show the token count for the same sentence in both
languages.

Not now (2026-09-23).

## Integer explorer

A companion to `floating-point.html`. It shows two's complement, the value
range of each width, and what overflow does to the bits.

A proof of concept landed on 2026-09-24 as `javascript/integer-explorer.html`.
It has not been looked at in a browser yet.

## Maze generator

Generate a random maze on a grid and draw it. Pick the size, then step through
the generator (for example, depth-first backtracking) or show the result at
once. It could also solve the maze and draw the path.

Added 2026-09-24.

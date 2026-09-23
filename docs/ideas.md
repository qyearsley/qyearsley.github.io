# Ideas

Feature ideas that nobody has committed to yet. Defects and debt go in
`improvements.md`.

## Ningbo tone sandhi machine

A tool in `chinese/`. The user types a word as syllables with their citation
tones. The tool shows how each tone changes in context, one rule at a time, as a
state machine over the syllable sequence.

- It follows the 2015 blog post on Ningbonese tones.
- It can be a tool without a blog post. The steps it shows are the explanation.

**Blocked on a native speaker.** Do not publish the rules until a Ningbo speaker
has checked them against real words. A wrong rule looks right to anyone who
does not speak the dialect.

## Tokenizer comparison

Train a tiny BPE tokenizer in the browser on a short English text and a short
Chinese text. Then show the token count for the same sentence in both
languages.

Not now (2026-09-23).

## Integer explorer

A companion to `floating-point.html`. It shows two's complement, the value
range of each width, and what overflow does to the bits.

Not now (2026-09-23).

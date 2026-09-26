# Ideas

Feature ideas that nobody has committed to yet. Defects and debt go in
`improvements.md`.

## Ningbo tone sandhi machine

A tool in `chinese/`. The user types a word as syllables with their citation
tones. The tool shows how each tone changes in context, one rule at a time, as a
state machine over the syllable sequence.

**Dropped on 2026-09-24.** The 2015 post gives the eight citation tones but no
sandhi rules, and there is no checked source for them. A proof of concept with
guessed rules was built and removed before it was pushed. Reopen this only with
a source for the rules, or a Ningbo speaker to check them.

## Tokenizer comparison

Train a tiny BPE tokenizer in the browser on a short English text and a short
Chinese text. Then show the token count for the same sentence in both
languages.

A proof of concept landed on 2026-09-24 as
`javascript/tokenizer-comparison.html`. A slider sets the English/Chinese mix of
the training text, which decides which language needs more tokens. It has not
been looked at in a browser yet.

## Integer explorer

A companion to `floating-point.html`. It shows two's complement, the value
range of each width, and what overflow does to the bits.

A proof of concept landed on 2026-09-24 as `javascript/integer-explorer.html`.
It has not been looked at in a browser yet.

## Maze generator

Generate a random maze on a grid and draw it. Pick the size, then step through
the generator (for example, depth-first backtracking) or show the result at
once. It could also solve the maze and draw the path.

A proof of concept landed on 2026-09-24 as `javascript/maze-generator.html`,
with all of the above and a `?seed=` link. It has not been looked at in a
browser yet.

## One character, five readings

A page in `chinese/`. Pick a character, such as 學, and see its reading in
Mandarin, Cantonese, Japanese, Korean and Vietnamese (xué, hok, gaku, hak,
học). The readings show what Mandarin lost, such as the old -p, -t and -k
endings. The section could then be renamed from "Chinese Language Notes" to
something wider. The readings need a checked source, not memory.

## Knights and knaves solver

A page in the Logic and Proof section. The user types what each islander says.
Knights always tell the truth and knaves always lie. The solver builds the
truth table and shows which assignments survive. It could reuse
`truthtable.js`.

## Syllogism checker

A page in the Logic and Proof section. The user picks a syllogism, such as "All
A are B; some C are A; so some C are B". The page draws it as a three-circle
Venn diagram and shades the premises, so the reader can see whether the
conclusion follows.

## View-source links on experiments

A small, quiet link from each experiment to its source on GitHub. One place to
add it would be `shared/nav.js`, so no page needs its own copy.

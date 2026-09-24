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

## How embeddings work

Build word vectors in the browser from a small made-up corpus: co-occurrence
counts, PPMI, then SVD. Plot them in 2D, list nearest neighbors, and try
analogies.

A proof of concept landed on 2026-09-24 as `javascript/embeddings.html`. The
corpus gives each word its own contexts, and king − man + woman comes out as
queen from he/she contexts rather than from sentences that state it. It has not
been looked at in a browser yet. It could pair with the blog post idea in
[`blog-ideas.md`](blog-ideas.md).

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

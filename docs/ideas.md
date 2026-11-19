# Ideas

Feature ideas that nobody has committed to yet. Defects and debt go in
`improvements.md`.

## Dropped

- Ningbo tone sandhi machine (2026-09-24): no checked source for the rules.
  Reopen only with a source or a Ningbo speaker.
- Knights and knaves solver (2026-09-26): built and removed; see
  `git show 6a51ded`.

## A playful Chinese page

`chinese/` has two interactive tools, three reference tables and four notes,
but nothing to practice with. A small tone quiz or "guess the reading" page
could reuse the tone-table data, in the size and style of `truth-tables.html`.
Noted on 2026-10-21 from a review of page balance.

## Times Trail: optional speed scoring

An opt-in mode that scores how fast a correct answer is, for a player who wants
a challenge. The game already measures thinking time per answer but never shows
it. Keep it off by default and keep it out of the mastery model, so a slow
answer never costs progress. Owner idea, 2026-11-18.

## Traditional Chinese

A Traditional version of the `/zh/` pages. Two options, not decided:

- Keep the files in Simplified, and convert to Traditional in the browser for a
  visitor who picks 繁體. Needs a Simplified-to-Traditional converter (the hard,
  one-to-many direction), likely OpenCC.
- Write the files in Traditional, and convert to Simplified in the browser with
  `chinese/tradsimp.js`. Simplified readers see a flash of Traditional, and
  the pages keep mainland words.

Either way, the URLs stay the same, passages about a glyph (homophones) need a
skip marker, and text written at runtime needs its own conversion. Owner idea,
2026-11-19.

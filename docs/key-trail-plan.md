# Key Trail -- Design Plan

A typing tutor at `games/key-trail/`. Prototyped on 2026-11-18. The code is the
source of truth for behavior; this doc explains why it works this way.

## Purpose

Teach touch typing to a young child, and give an adult a reason to come back.
It needs a physical keyboard. There is no on-screen typing mode.

## Decisions

- **Lessons add two keys at a time, from the home row out.** `f j` first, then
  `d k`, `s l`, `a ;`, `g h`, and then out to the top and bottom rows. Lessons
  are all open; the stars show which ones are done.
- **A trail, not a timer.** Each right key moves the turtle one step toward the
  house. A wrong key shakes it but never moves it back and never costs points.
  Falling-letter games were considered and set aside: time pressure is hard on
  beginners.
- **Text uses only taught keys.** A lesson with fewer than 8 usable words
  drills letter groups (`fjf jj`); later lessons use real words. Punctuation
  goes after a word (`sad;`), since no word contains it.
- **Stars for accuracy, not speed.** Finishing earns one star; 90% and 97%
  right on the first try earn the second and third.
- **Weak keys come back.** Each miss adds to a per-key count, and a key typed
  cleanly in a later line earns one back. Practice text favors words with those
  keys, capped so one bad key does not take over.
- **Speed run for adults.** One minute of sentences, scored in words per minute
  from the correct characters only, with a saved best.

## Not done yet

- Capital letters and Shift.
- Numbers and most punctuation.
- Play-testing with a child.

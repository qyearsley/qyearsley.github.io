# Seasons -- Design Notes

Cut on 2026-09-26. The full history is in git: `git show 1c19957:docs/seasons-plan.md`

Living notes for `games/seasons/`. The README describes what the game **is**;
this file explains why some of its rules are shaped the way they are.

## Where it stands

Playable end to end. Four seasons, four characters, a trail of obstacles with a
crossing animation, collectibles shown as items, and a snake woman who is
making a potion. A season ends the moment she has enough. Every rule Ella has
asked about is settled and built, and there are no open questions right now.

## Why seasons are short, and why there is no losing

A wrong answer never costs an item. It costs at most one extra question: the
choice you picked is struck off, the same question stays up, and once you get
it right a reinforcement card shows the fact worked out, then one more
question at the same obstacle before you move on. A timeout counts as a wrong
answer and takes the same path -- this is why the retry itself is untimed. A
clock on the retry would time out the same question forever, for exactly the
child who couldn't answer it in time.

Because a wrong answer never removes an item, a finished trail always yields
the same total: every glowing space is worth 3 items to every character,
ordinary spaces are worth 1. Demand is set to that total plus the boss's
rescue, so the boss's question is always what fills the jar. That exact
alignment is what lets each trail be short:

|        | Spaces | Glowing | Trail items | Rescue | Demand | Questions |
| ------ | ------ | ------- | ----------- | ------ | ------ | --------- |
| Spring | 8      | 2       | 12          | +3     | 15     | 9         |
| Summer | 9      | 2       | 13          | +4     | 17     | 10        |
| Autumn | 10     | 3       | 16          | +5     | 21     | 11        |
| Winter | 11     | 3       | 17          | +6     | 23     | 12        |

A clean run is 42 questions, not the 72 an earlier build asked.
`seasons.test.js` checks that the trail never shortens, the glowing count never
falls, demand rises strictly season to season, and each rescue stays under its
own demand.

Three other ways to penalize a wrong answer were tried and rejected: doing
nothing but changing the question, having an item wilt and come back, and
stepping back a space and losing an item outright. The retry rule replaced all
three -- the answer isn't stated, she has to find it, then the card shows her
why.

## The roster

Every perk is free. There's no cost left to charge it against, since the
demand is met exactly by a complete trail.

|             | Perk                                                                         |
| ----------- | ---------------------------------------------------------------------------- |
| Banana Slug | Slow and Steady -- no countdown, ever                                        |
| Sloth       | Takes His Time -- 10 extra seconds on every timed question                   |
| Phoenix     | Rising Again -- once a season, a mistake hides two of the four wrong choices |
| Porcupine   | Bounce Back -- after a mistake, no extra question                            |

The countdown is off by default, so the Slug and the Sloth only matter once a
player turns it on. They sit on the same axis: one with no clock, one with
more of it.

## How difficulty is tuned

Pitched at third grade, and tuned by **mental steps**, not digit count or
answer size: one fact, then a fact plus regrouping, then a fact scaled by ten,
then two chained operations. No column operation goes past two digits, and
every individual fact stays inside 100 -- `9 x 80` is fine, three-digit
subtraction and written column work are not.

Three rules that aren't visible from the numbers alone:

- Division only shows up in glowing and boss questions, never in an ordinary
  space.
- A boss question can be a different shape than the season's glowing
  questions.
- Three-digit subtraction is out of scope for the whole game.

The current per-season numbers are in the README's
[Difficulty](../games/seasons/README.md#difficulty) table.

## Art

Hand-coded SVG, with PNG sprite sheets deliberately left possible:
`traversal()` and `layout()` live in the art pack, so a sprite pack could swap
in frames without any other module knowing how the art is drawn. Binary sprite
assets would break a repo convention -- `favicon.ico` is currently the only
non-text file in the whole repo -- so adding one would be a deliberate call,
not an incidental one.

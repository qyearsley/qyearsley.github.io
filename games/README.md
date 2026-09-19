# Games

Educational web games built with JavaScript.

## For Younger Players

- **[Number Garden](number-garden/)** - Math game for elementary students (addition, subtraction, multiplication, time-telling, measurement, patterns)
- **[Times Trail](times-trail/)** - Multiplication facts practice (2x2 through 9x9) with a mastery engine
- **[Seasons](seasons/)** - A journey through spring, summer, autumn, and winter; choose an animal and collect what the snake woman demands

## Sandboxes and Puzzles

- **[Life Garden](life-garden/)** - A garden ecosystem: plants follow a cellular automaton, animals move and eat
- **[Turing Tape](turing-tape/)** - Interactive Turing machine simulator

## Chinese pages

Turing Tape and Life Garden have a `/zh/` page. Number Garden, Seasons and Times
Trail do not.

The build translates static HTML, and a game writes most of its text at runtime,
so a `/zh/` game page is Chinese chrome around English gameplay. The three games
with the most runtime text lost their page rather than claim a language they do
not speak. See
[`docs/translations.md`](../docs/translations.md#which-pages-have-a-chinese-version-and-why).

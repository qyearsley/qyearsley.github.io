# Turing Tape

A Turing machine you program by filling in a table of rules. Five small puzzles
each give you a starting tape and a goal tape; you add rules until the machine
turns one into the other and halts. Three read-only demos run famous machines so
you can watch them work.

It is for anyone meeting the idea of a Turing machine for the first time --
older children, or an adult curious about where "computation" bottoms out. No
maths beyond reading 0s and 1s is needed.

## The concept, as far as you need it

The machine has a **tape** of cells, a **head** sitting over one cell, and a
**state** (a letter). One step is: read the symbol under the head, find the rule
for _this state and this symbol_, then write a symbol, move the head left (`L`),
right (`R`), or stay (`S`), and switch to the next state. That is the whole
machine. Everything else in the game is presentation.

Three details of this implementation, all in
[`js/TuringMachine.js`](js/TuringMachine.js):

- Rules live in a `Map` keyed by `"<state>,<read>"`, so a state/symbol pair can
  have at most one rule. Two table rows with the same **State** and **Read**
  silently collapse into one, and the lower row wins.
- A rule whose next state is `HALT` writes, but does not move. `step()` returns
  as soon as the state becomes `HALT`.
- The tape grows on demand: moving right past the end appends a blank, and
  moving left from cell 0 prepends one while the head stays at 0. `_` is the
  blank symbol (`BLANK`).

## How it plays

- **Puzzles** show a dashed **Goal** tape above the live tape, and an editable
  rule table with **+ Add Rule** and a `×` on each row. Every field is a
  dropdown -- State and Next State from the level's `states`, Read and Write
  from its `symbols`, Move from a fixed `L`/`R`/`S`. There is nothing to type
  and nothing to mistype. A new row defaults to the first option in each list.
- **Step** runs one step, **Play** runs a step every 400 ms
  (`PLAY_INTERVAL_MS`), and **Reset** restores the starting tape, state, head
  and step count, clears the result message, and re-reads the rules off the
  table. Edits to the table take effect immediately, mid-run included.
- The machine halts three ways: it enters the **HALT** state, it finds no rule
  for the current state and symbol, or it reaches 500 steps (`MAX_STEPS`, the
  loop guard -- not a per-level budget).
- **You win** when the tape matches the goal _and_ the machine halted by
  entering HALT. Running out of rules with the right tape on screen does not
  count. Leading and trailing blanks are ignored on both sides when comparing.
- On halt, each cell turns green or red. The colours come from
  `TuringMachine.matchMask()`, which aligns the tape the same way
  `matchesTape()` does, so a solved puzzle can never show a red cell. The
  converse is not guaranteed: a tape _shorter_ than the goal has no cell to
  flag, so it stays green while the message says it did not match.
- Solved level ids go into a `Set` saved to `localStorage` under `turingTape`,
  and a solved level gets a green ✓ in the nav (`.level-btn.completed`). There
  is no in-page way to clear this.
- **Demos** hide the goal, disable every dropdown, hide **+ Add Rule** and the
  row delete buttons, and report `Halted after N steps. State: X` instead of
  checking a win.

The five puzzles are Write One, Flip It, Move Right, Fill, and Binary +1
(`101` → `110`). The demos are the 3-state busy beaver, unary addition, and a
palindrome checker that ends in state `Y` or `N`. Worked solutions for all eight
live in [`__tests__/TuringMachine.test.js`](__tests__/TuringMachine.test.js).

## Keyboard

- **Space** -- one step
- **Enter** -- play / pause
- **r** -- reset (upper case works too)
- **j/k** -- move between page links (site-wide; press **?** for the full list)

The three game keys are ignored while focus is inside a button, select, input,
or textarea, so Space and Enter still activate whatever is focused.

## How to change things

### Add or change a puzzle

Append to `levels` in [`js/levels.js`](js/levels.js). Every field is required by
[`__tests__/levels.test.js`](__tests__/levels.test.js): `id` (unique), `name`,
`description`, `tape`, `target`, `headStart` (a valid index into `tape`),
`states` (must include `HALT`), `symbols` (must include `_`), and `maxSteps`.
Every symbol in `tape` and `target` must appear in `symbols`. Nothing else needs
editing -- the nav, the dropdowns, and the goal tape are all built from the
entry.

Two things the tests do not enforce:

- The start state is hardcoded to `"A"` in `loadLevel()`, so `states` must
  include `"A"` or the level halts on its first step.
- `maxSteps` is checked for type but nothing reads it at runtime for puzzles;
  see [Known gaps](#known-gaps).

The convention is to add a matching case under `describe("level solutions")` in
`__tests__/TuringMachine.test.js`, proving the puzzle is solvable with the
states you gave it.

Because blanks are trimmed before comparing, a goal that differs from the
starting tape only in _position_ is not really enforced. Design goals around
which symbols are present, or pad them so the content differs.

### Add a demo

Append to `demos` in the same file. Same fields minus `target`, plus `rules` as
an array of `[state, read, write, move, nextState]` tuples --
`parseRules()` in [`js/game.js`](js/game.js) turns those into the `Map`. The
tests require every rule to name a declared state and symbol, a move of
`L`/`R`/`S`, and the demo to halt within its own `maxSteps` (this is the one
place `maxSteps` is used).

Demos also start in state `A`, hardcoded in `loadDemo()`. They do not need a
`HALT` state: the palindrome demo ends by having no rule for `Y` or `N`, which
halts with reason `no-rule` and leaves the answer visible in the state readout.

### Change the speed or the step ceiling

`PLAY_INTERVAL_MS` in `js/game.js` for playback speed; `MAX_STEPS` in
`js/TuringMachine.js` for the loop guard. The `stops at max steps to prevent
infinite loop` test pins 500, so change both.

### Add a symbol beyond `0`, `1`, and `_`

Add it to that level's `symbols` array. The Read and Write dropdowns are built
from it, so nothing else is needed. Keep `_` in the list: it is the fill for new
cells and the symbol trimmed before comparing, and both are hardcoded as
`BLANK`.

### Restyle

Everything is in [`styles/main.css`](styles/main.css); the only other stylesheet
is the site-wide `/css/style.css`. The classes that carry meaning are
`.tape-cell.head`, `.tape-cell.match`, `.tape-cell.mismatch`,
`.level-btn.completed`, `.rule-table .active-rule` (the rule that just fired),
and `.result-msg.success` / `.error`.

## For developers

```
index.html            # The whole page: nav, tapes, controls, rule table, "How it works"
index.zh.json         # Chinese title and meta description only; the body is not translated
js/
├── TuringMachine.js  # The machine: step, run, reset, matchesTape, matchMask
├── levels.js         # The five puzzles and three demos, as data
└── game.js           # Everything DOM: nav, rendering, the rule table, keys, localStorage
styles/
└── main.css          # The whole stylesheet, light and dark
```

`TuringMachine.js` and `levels.js` are pure data and logic with no DOM; `game.js`
is a module with no exports that runs on load, which is why the tests cover the
first two only. This game does not use the `games/shared/` base classes.

### Testing

Tests run from the repository root with the shared toolchain:

```bash
npm install                                     # from repo root
npm test                                        # all tests, including this game
npm test -- --testPathPatterns turing-tape      # just this game
```

Two suites, 47 tests: `TuringMachine.test.js` (stepping, tape growth, halting,
both match functions, plus a solution for every level and demo) and
`levels.test.js` (the shape of the level and demo data).

The game reads nothing from the URL -- there are no debug or unlock parameters.

## Known gaps

- Each level declares `maxSteps`, but the machine only enforces the global
  500-step `MAX_STEPS`. The per-level number is validated by the tests and
  otherwise inert for puzzles.
- Because blanks are trimmed before comparing, **Move Right** can be "solved"
  without moving anything: one rule that writes `1` and halts leaves
  `["1", "_"]`, which trims to the same content as the goal `["_", "1"]`.
- The "How it works" list in `index.html` says you win when the tape matches the
  goal after halting, without mentioning that only a HALT-state halt counts.
- Dark mode is a plain `prefers-color-scheme` block, so this game's colours
  follow the OS and ignore the site's theme toggle. The page chrome around it
  does follow the toggle.
- The stylesheet has no media queries and tape cells are a fixed 3rem in a
  non-wrapping flex row, so a long or grown tape overflows on a narrow screen.
- Progress can only be cleared through the browser's storage settings.

## Browser support and accessibility

Works in current Chrome, Firefox, Safari, and Edge. Uses ES modules, so it must
be served over HTTP rather than opened from the filesystem.

Every dropdown has an `aria-label` (Current state, Read symbol, Write symbol,
Move direction, Next state). The result message is the page's only live region
(`role="status"`); the step counter and state readout are deliberately not live,
because Play would otherwise announce up to 500 updates over the result. Head
position, matches, and mismatches are shown by border and background alone, so
colour is currently the only signal for them.

## Security and privacy

- All dynamic content is created with `createElement` and written with
  `textContent`. `innerHTML` is used only to empty containers (`= ""`) and for
  the two static Play/Pause button labels, neither of which interpolates
  anything.
- The only input is clicks, dropdown choices from fixed lists, and three keys.
  No text field exists on the page.
- Progress is a list of solved level ids in `localStorage` under `turingTape`,
  and never leaves the device. A corrupt value is caught and treated as no
  progress.
- No personal information, no cookies, no tracking, no external requests beyond
  the site's own stylesheet and scripts.
  </content>
  </invoke>

# Turing Tape Module Architecture

## Overview

Turing Tape is the smallest game on the site: three modules, no classes beyond
one, and no shared base classes. The split is machine, data, page.

`TuringMachine.js` is the simulator and the only place tape semantics live. It
has no DOM, no timers and no storage. `levels.js` is frozen data — five puzzles
and three read-only demos. `game.js` is everything else: DOM references, the
rule table, the play timer, persistence, and the keyboard.

**There is no `GameState.js`, `GameUI.js` or `EventManager.js`**, and nothing
here extends `games/shared/BaseGameUI.js`. The other four games separate those
layers; this one does not, and the reason is size. The whole page is one machine,
one rule table and four buttons, so the state that a `GameState` would own is
five module-level variables and the view models a `GameUI` would take would each
have one caller. Worth revisiting only if a second puzzle type appears.

`game.js` exports nothing and runs on load, so it is driven through the real
page rather than constructed. That is also why it has no test file — see
**Testing**.

## Dependency graph

Arrows point from importer to import. There are only two edges.

```
  levels.js          TuringMachine.js
  (no imports)       (no imports)
        │                   │
        └─────────┬─────────┘
                  ▼
               game.js
      the only module that touches
      document, localStorage, timers
```

One edge is forbidden on purpose: **`TuringMachine` never imports `levels`.** It
takes a tape, a rule `Map`, a start state and a head position, and knows nothing
about puzzles, goals or progress. A level's `target` is passed _in_ to
`matchesTape` and `matchMask` rather than held by the machine, which is what lets
the demos run with no target at all.

## Key modules

### TuringMachine.js

The simulator. `step()` reads `rules.get("<state>,<symbol>")`, writes, transitions,
then moves; `run()` steps until halted. Every public call returns a snapshot
(`tape`, `head`, `state`, `halted`, `haltReason`, `stepCount`) rather than
exposing internals to mutate.

Three halt reasons, and the caller distinguishes them: `halt-state` when the
machine reaches `HALT`, `no-rule` when nothing matches the current
state-and-symbol, `max-steps` at the cap. Only `halt-state` can win a puzzle.

The tape grows as the head runs off either end — `R` past the last cell pushes a
blank, `L` at index 0 unshifts one and leaves the head at 0. Nothing shrinks it,
so a tape can end up padded with blanks on both sides, which is the whole reason
the matching functions trim.

### The alignment rule

`contentRange` trims leading and trailing blanks and returns `[start, end)`.
**Both `matchesTape` and `matchMask` align on it**, and that sharing is
deliberate: they are the win test and the cell colouring, and if they disagreed
the tape would show a red cell on a puzzle the game just called solved.

`matchMask` returns one boolean per cell of the current tape:

| cell                        | reports         | why                                                                          |
| --------------------------- | --------------- | ---------------------------------------------------------------------------- |
| trimmed-off blank           | `true`          | padding `matchesTape` ignores, so it can never be the reason a tape is wrong |
| content past the goal's end | `false`         | there is no target symbol for it, so it is extra                             |
| content within the goal     | symbol equality | the ordinary case                                                            |

A tape _shorter_ than the goal has no cell to mark, so every entry can be `true`
while `matchesTape` is `false`. The result message reports the missing symbols;
the colours cannot.

### levels.js

Two frozen arrays. `levels` holds the five puzzles, each with a starting `tape`,
a `target`, the `states` and `symbols` its dropdowns offer, and a description.
`demos` holds three read-only programs with their `rules` pre-filled as
`[state, read, write, move, nextState]` tuples — the 3-state busy beaver, unary
addition, and a palindrome checker.

`states` and `symbols` are what populate the rule-table dropdowns, so a level
cannot offer a state its puzzle does not need. The palindrome demo is the one
that exercises this: it declares eight states, and halts in `Y` or `N` rather
than `HALT`, which means its halt reason is `no-rule`. Demos never call
`checkWin`, so that is reported as a plain "Halted after N steps" either way.

### game.js

The page. Module-level state is five variables — `machine`, `currentLevel`,
`isDemo`, `playTimer`, and `completedLevels` — plus the DOM references, all
resolved once at load. Boots inside a `try/catch` that logs rather than leaving a
half-built page.

Four responsibilities worth naming:

- **The rule table is the source of truth for rules.** `syncRules` reads every
  row out of the DOM and replaces `machine.rules` wholesale, on every dropdown
  change and every row add or delete. There is no rule model behind it. Editing a
  rule mid-run therefore takes effect on the next step, which is intended.
- **Read-only demos are enforced at build time**, not checked later. `addRuleRow`
  takes a `readonly` flag that disables each `<select>`, attaches no `change`
  listener, and omits the delete button. `addRuleBtn` is hidden too.
- **Nav highlighting matches on `dataset.navId`, not the label.** Two entries can
  share a name — a demo of a level, say — and matching on text would light both.
- **The head is nudged into view, not centred.** `scrollHeadIntoView` scrolls only
  when the head cell is outside the strip, because centring makes the whole tape
  jitter as the head moves back and forth. It measures `offsetLeft` against
  `.tape-scroll`, which does not move as that element scrolls; a bounding rect
  would.

## Data flow

```
loadLevel(level)                         loadDemo(demo)
   │  rules = empty Map                     │  rules = parseRules(demo.rules)
   │  show target, editable table           │  hide target, read-only table
   └──────────────────┬─────────────────────┘
                      ▼
          new TuringMachine(tape, rules, "A", headStart)
                      │
      ┌───────────────┴───────────────┐
      │                               │
  dropdown change                Step / Play / Space / Enter
      │                               │
   syncRules()                     doStep()
      │                               │
  machine.rules = readRulesFromDOM()   ├─ capture prevState, prevSymbol
                                       ├─ machine.step()
                                       ├─ highlightActiveRule(prev…)
                                       └─ updateDisplay()
                                              │
                                        halted?  ──no──► (Play re-fires in 400ms)
                                              │ yes
                                              ├─ stopPlay()
                                              └─ isDemo ? "Halted after N steps"
                                                        : checkWin()
                                                             │
                                    matchesTape && haltReason === "halt-state"
                                          ┌──────────┴──────────┐
                                        win                    lose
                                          │                     │
                            completedLevels.add(id)    message by haltReason:
                            saveProgress()             max-steps / no-rule /
                            buildLevelNav()            "doesn't match the goal"
```

`highlightActiveRule` is called with the state and symbol read _before_ the step,
so the row it lights is the rule that just fired rather than the one about to.

## Keyboard

`Space` steps, `Enter` toggles play, `R` resets. The `document` listener bails in
two cases, both of which were real bugs:

- **A focused control keeps its keys.** Space and Enter activate a focused
  button, and the rule-table `<select>`s handle both themselves. `e.target` can
  be the document, which has no `closest()`, so the check is guarded.
- **Modifier chords belong to the browser.** Without the `metaKey`/`ctrlKey`/
  `altKey` guard, ⌘R reset the machine on its way to reloading the page and
  ⌘-Enter started it running.

`togglePlay` also returns early on a halted machine. The button is disabled by
then, but `Enter` reaches the handler anyway, and a timer started there would
tick uselessly with the button stuck reading "Pause".

## Persistence

One key, `turingTape`, holding an array of solved level ids. Both `loadProgress`
and `saveProgress` swallow their exceptions, so a disabled or full `localStorage`
costs the progress ring and nothing else.

**Solved levels cannot be un-solved from the UI.** `doReset` resets the machine,
not the progress set, and there is no clear control. The asymmetry with the other
games is deliberate — see `docs/improvements.md`. There is no version key on the
stored shape either, which is worth knowing before the format changes.

## Testing

Tests live in the parent `__tests__/` directory. Two suites, covering the two
modules that can be tested without a page:

- `TuringMachine.test.js` — stepping, the three halt reasons, tape growth at both
  ends, and the alignment shared by `matchesTape` and `matchMask`
- `levels.test.js` — the shape of every level and demo, and that each demo halts
  on its own within `DEMO_STEP_BOUND` steps, without hitting the `max-steps` cap

**`game.js` has no test file.** It exports nothing and runs on import, so it can
only be driven black-box through the real `index.html` — which is what
`times-trail` does in `game.test.js`, and what this game could do too. The
site-wide markup-contract test in the root `__tests__/` covers this page's ids;
nothing covers its behaviour.

Run from the repository root:

```bash
npm test                                     # all tests
npm test -- --testPathPatterns turing-tape   # just this game
```

## Design principles

- **One alignment authority.** `contentRange` decides what counts as content, and
  the win test and the cell colouring both read it. Neither re-derives it.
- **The machine knows nothing about puzzles.** No target, no progress, no
  levels — those are arguments and callers.
- **Snapshots out, not internals.** Every machine call returns a copy, so a
  caller cannot mutate the tape it was handed.
- **The DOM is the rule model.** There is deliberately no second copy of the rule
  set to keep in step with the table.
- **Failures degrade to a message.** Boot, stepping, and both storage paths catch
  and continue rather than leaving a blank or half-built page.

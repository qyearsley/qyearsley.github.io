# Life Garden 🌿

A cellular-automata sandbox with a gardening theme. Paint grass, bees, rabbits
and foxes onto a 20×20 grid, press play, and watch what the rules do to them.
A line chart under the grid plots each species' population, so a rabbit boom and
the crash that follows it are visible rather than something you have to catch on
the grid.

It is a toy rather than a lesson: there is no score, no goal, and nothing to
finish. The point is that a few small rule sets, run against each other, produce
behaviour nobody typed in. Grass on its own is Conway's Game of Life, so the
classic patterns work — the **Glider** preset is the ordinary glider, in grass.

## How it plays

Pick a species in the sidebar, click an empty cell to place it, and click a
filled one to clear it. The mode is decided by the **first** cell of a drag: if
that cell was occupied the whole gesture erases, otherwise the whole gesture
plants. Then **Play**, or **Step** one generation at a time. **Back** rewinds,
up to `MAX_HISTORY` (200) generations. **Clear** empties the grid and resets the
counter.

Every cell looks at its 8 surrounding neighbours, but each species counts a
different set of them:

| Species            | Counts as neighbours  | Survives on | Born on | Dies of age after |
| ------------------ | --------------------- | ----------- | ------- | ----------------- |
| 🌿 Grass           | grass, bloom          | 2–3         | 3       | never             |
| 🌸 Flowering grass | grass, bloom          | 2–3         | —       | never             |
| 🐝 Bee             | bloom, bees           | 1–3         | 3       | 20 gens           |
| 🐇 Rabbit          | grass, bloom, rabbits | 2–3         | 3       | 25 gens           |
| 🦊 Fox             | rabbits, foxes        | 1–3         | 4       | 45 gens           |

Four rules reach across the table:

- **Grass blooms.** Grass that has survived `bloomAge` (8) generations becomes
  flowering grass (`bloomsInto` / `bloomAge`). It is a life stage, not a
  different plant: the rules either side of the transition are identical, and
  each stage counts the other as a neighbour, so a meadow does not change
  behaviour the moment it flowers. Flowering grass never reverts, and is never
  placed or born — it can only be reached by ageing.
- **Bees pollinate.** Grass with a bee adjacent can be born on 2 neighbours
  instead of 3 (`pollinates` / `pollinateBirth`). Bees feed on the bloom that
  grass then grows into.
- **Rabbits eat.** Grass at either stage with 2 or more adjacent rabbits dies
  regardless of its own rule (`killTargets` / `killThreshold`).
- **Foxes eat.** A rabbit with 3 adjacent foxes dies the same way.

Killing is resolved before survival, so nothing saves what gets eaten.

Bees, rabbits and foxes set `birthRequiresOwn`, so they can only appear next to
their own kind — otherwise a meadow would spontaneously grow bees. When two
species both want the same empty cell, the higher `priority` wins: fox (5) >
rabbit (4) > bee (3) > flowering grass (2) > grass (1).

Cells fade from `color` toward `colorAlt` as they age, so a fox near 45 looks
visibly older than a fresh one. Grass and its bloom are immortal, so they do not
fade.

### Why the fox is tuned the way it is

A top predator only means anything if it is scarcer and slower than its prey,
and in a Life-style automaton that is harder than it sounds: a predator that
counts its own kind as neighbours can sustain itself with no prey at all, and
one that counts only prey dies within a few generations as the prey moves.

Birth on exactly 4 is what keeps foxes rare — it takes a real concentration of
rabbits before another fox appears, so foxes sit at a few percent of the board
while rabbits can reach a third of it. `maxAge: 45` is the other brake: without
it a fox pair would sit in an empty field forever. The consequence is that foxes
seldom breed at all on small hand-made boards; on the **Food Chain** preset the
three you start with simply live out their lifespan.

### The population chart

`js/PopulationChart.js` keeps a rolling 200-generation window of counts, one
series per species drawn in that species' own `color`, with the counts also
written out underneath — the lines are told apart by colour alone, which is not
a distinction everyone can make.

`game.js` feeds it: `record()` after every step, `truncate()` after every
rewind, `reset()` when the grid is cleared or a preset is loaded. The window
matches `MAX_HISTORY`, so the chart can always show every generation **Back**
can still reach, and rewinding drops the samples the player just rewound out of
rather than leaving stale future data on screen.

### Presets

Seven starting arrangements in the sidebar, from `js/Presets.js`. Loading one
clears the grid first.

| Preset          | What it shows                                                        |
| --------------- | -------------------------------------------------------------------- |
| **Meadow**      | Grass blocks settle down and come into bloom around generation 8     |
| **Pollinator**  | Bees push a 20-cell meadow out to 60-odd; without them it sits still |
| **Rabbit Run**  | Rabbits work through a field of grass and then starve                |
| **Ecosystem**   | All four placeable species on one board                              |
| **Food Chain**  | Grass, rabbits, three foxes                                          |
| **No Predator** | The same field with the foxes removed                                |
| **Glider**      | The ordinary glider, in grass                                        |

**Food Chain** and **No Predator** are the same board except for three cells, so
running both shows what removing the predator does. Watch the chart: without the
foxes the rabbits climb from 4 to about 90 by generation 50, take the grass to
zero by generation 60, and then dwindle away with nothing left to eat. With the
foxes they never get past about 20, and the grass is still there — around 40
cells — at generation 200.

The Glider needs no special case: its cells are recreated every cycle and never
get older than 3, well short of the bloom age of 8.

### Controls

- **Space** — play / pause
- **→** — step forward one generation
- **←** — step back one generation
- **R** — clear the grid
- **1**–**4** — select a species
- Click to place, click again to erase, drag to paint

Shortcuts are ignored while a button or field has focus, so Space still
activates a focused button.

## For developers

### Structure

```
js/
├── game.js             # LifeGarden: wires everything together, owns the timer and undo history
├── constants.js        # SPECIES ids, GRID sizes, SPEED intervals, PHASE names
├── Species.js          # SPECIES_DEFS (the rules) and SpeciesRegistry
├── Grid.js             # The cell array and step() -- the whole simulation
├── Presets.js          # PRESETS: named starting arrangements, written as maps
├── PuzzleData.js       # PUZZLES: one sandbox entry, source of the grid size
├── GameState.js        # Phase, generation count, settings, budget/star bookkeeping
├── GameUI.js           # Species palette and generation display (extends BaseGameUI)
├── Renderer.js         # Canvas drawing and pixel↔cell coordinate maths
├── PopulationChart.js  # The line chart under the grid
├── EventManager.js     # Mouse, touch and keyboard listeners to callbacks
└── storage.js          # LifeGardenStorage over games/shared/StorageManager.js

styles/
├── main.css        # Layout, sidebar, controls, dark mode
└── canvas.css      # Canvas sizing and the chart
```

`BaseGameUI.js` and `StorageManager.js` are shared with the other games and live
in `games/shared/`.

The engine is generic: `Grid.step()` reads `registry.placeable()` and applies
whatever fields the definitions carry. It knows nothing about grass or foxes.
`PopulationChart` iterates the registry the same way, so a new species gets a
series with no change to that file.

### Scaffolding that is not wired up

`GameState` and `PuzzleData` carry a whole puzzle mode — budgets, goals, locked
cells, goal zones, star thresholds, `unlockAfter` — that nothing in `game.js`
uses. The single `sandbox` puzzle sets every budget to `Infinity` and every list
to empty. It is tested, so it works; it is just not reachable from the UI.
Nothing is saved either: `game.js` never calls `state.loadProgress()` or
`state.saveProgress()`, so the `lifeGardenProgress` key is never written.

### Recipes

**Change a species' rules.** Edit its entry in `SPECIES_DEFS` in
`js/Species.js`. Every field is data — `survive`, `birth`, `neighbors`,
`maxAge`, `priority` — and the engine picks it up with no other change. The
sidebar's "How it works" table is hand-written in `index.html`, so update it and
`index.zh.json` too.

**Add a species.** Add an id to `SPECIES` in `js/constants.js`, add a definition
to `SPECIES_DEFS`, and add a `case` for its `texture` in `Renderer._drawTexture`
(a missing case draws a plain coloured square, not an error — `Renderer.test.js`
checks every registered texture reaches a draw method). Keep the placeable ids
sequential from 1 and in palette order: the palette labels its keyboard hints
`i + 1` by position, while `EventManager` passes the pressed digit straight
through as a species id, so the two only agree while position and id line up.
Ids that are not placeable go after them.

**Add a life stage.** Give the parent species `bloomsInto` and `bloomAge`, and
give the stage `placeable: false` so it stays out of the palette and out of the
birth loop. Everything else — neighbour lists, priority, kill targets — keeps
working, because those are plain id lists and the stage has an ordinary id.

**Add a preset.** Append `{ name, description, cells: fromMap([...]) }` to
`PRESETS` in `js/Presets.js`. Each map row is one grid row, one character per
cell: `.` empty, `g` grass, `b` bee, `r` rabbit, `f` fox. Rows may be short and
there may be fewer of them than the grid has rows. Buttons are generated from
the array.

**Change the grid size.** `gridWidth` / `gridHeight` on the sandbox entry in
`js/PuzzleData.js`. `GRID.DEFAULT_WIDTH` and `DEFAULT_HEIGHT` in `constants.js`
are not what the game reads. The renderer fits square cells to the 640×640
canvas and centres them, so any size works.

**Change the speeds.** `SPEED` in `js/constants.js` (milliseconds per
generation). The three buttons in `index.html` carry `data-speed` values that
are uppercased into keys of that object, so adding a fourth speed means one
entry and one button.

### Testing

Tests run from the repository root with the shared toolchain:

```bash
npm install                                    # from repo root
npm test                                       # all tests, including this game
npm test -- --testPathPatterns life-garden     # just this game
```

Nine suites. Every module has one except the three that are pure data or pure
wiring: `constants.js`, `PuzzleData.js`, and `game.js` (which exports nothing).
`Grid.test.js` is the one to read first: it pins the ecosystem rules with small
explicit boards, including a plants-only registry for checking the Conway
patterns without the animals interfering. `Presets.test.js` goes further and
asserts the behaviour the two food-chain presets are there to demonstrate, so a
rule change that flattens the contrast fails the build rather than quietly
making the presets pointless.

There are no debug or unlock query parameters; the game reads nothing from the
URL.

## Browser support

Current Chrome, Firefox, Safari, and Edge. Uses ES modules, so it must be served
over HTTP rather than opened from the filesystem. Touch is supported on the
canvas (`touchstart` / `touchmove` place and paint), and the sidebar stacks
above the canvas below 768px.

Both canvases follow the site theme picker first and `prefers-color-scheme`
second, through `window.__prefersDark` — see `Renderer._isDark` and
`PopulationChart._isDark`, which have to agree.

## Privacy

Nothing is saved and nothing leaves the page. The only input is clicks, taps and
keys, and no text is ever entered.

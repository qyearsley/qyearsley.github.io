# Life Garden 🌿

A cellular-automata sandbox with a gardening theme. Paint grass, flowers, bees
and rabbits onto a 20×20 grid, press play, and watch what the rules do to them.

It is a toy rather than a lesson: there is no score, no goal, and nothing to
finish. The point is that four small rule sets, run against each other, produce
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

| Species   | Counts as neighbours | Survives on | Born on | Dies of age after |
| --------- | -------------------- | ----------- | ------- | ----------------- |
| 🌿 Grass  | grass, flowers       | 2–3         | 3       | never             |
| 🌸 Flower | flowers              | 2–4         | 3       | 30 gens           |
| 🐝 Bee    | flowers, bees        | 1–3         | 2       | 20 gens           |
| 🐇 Rabbit | grass, rabbits       | 2–3         | 3       | 25 gens           |

Two species also reach across the table:

- **Bees pollinate.** Any cell with a bee adjacent lets a flower be born on 2
  neighbours instead of 3 (`pollinates` / `pollinateBirth`).
- **Rabbits eat.** Grass with 2 or more adjacent rabbits dies regardless of its
  own rule (`killTargets` / `killThreshold`). Killing is resolved before
  survival, so nothing saves that grass.

Bees and rabbits set `birthRequiresOwn`, so they can only appear next to their
own kind — otherwise a field of flowers would spontaneously grow bees. When two
species both want the same empty cell, the higher `priority` wins: rabbit (4) >
bee (3) > flower (2) > grass (1).

Cells fade from `color` toward `colorAlt` as they age, so a flower about to hit
30 looks visibly older than a fresh one.

### Presets

Five starting arrangements in the sidebar, from `js/Presets.js`: **Meadow**,
**Pollinator**, **Rabbit Run**, **Ecosystem**, and **Glider**. Loading one
clears the grid first.

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
├── game.js         # LifeGarden: wires everything together, owns the timer and undo history
├── constants.js    # SPECIES ids, GRID sizes, SPEED intervals, PHASE names
├── Species.js      # SPECIES_DEFS (the rules) and SpeciesRegistry
├── Grid.js         # The cell array and step() -- the whole simulation
├── Presets.js      # PRESETS: named starting arrangements
├── PuzzleData.js   # PUZZLES: one sandbox entry, source of the grid size
├── GameState.js    # Phase, generation count, settings, budget/star bookkeeping
├── GameUI.js       # Species palette and generation display (extends BaseGameUI)
├── Renderer.js     # Canvas drawing and pixel↔cell coordinate maths
├── EventManager.js # Mouse, touch and keyboard listeners to callbacks
└── storage.js      # LifeGardenStorage over games/shared/StorageManager.js

styles/
├── main.css        # Layout, sidebar, controls, dark mode
└── canvas.css      # Canvas sizing
```

`BaseGameUI.js` and `StorageManager.js` are shared with the other games and live
in `games/shared/`.

The engine is generic: `Grid.step()` reads `registry.placeable()` and applies
whatever fields the definitions carry. It knows nothing about grass or bees.

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
sidebar's "How it works" list is hand-written prose in `index.html`, so update
it too.

**Add a species.** Add an id to `SPECIES` in `js/constants.js`, add a definition
to `SPECIES_DEFS`, and add a `case` for its `texture` in `Renderer._drawTexture`
(a missing case draws a plain coloured square, not an error). Keep the ids
sequential and in palette order: the palette labels its keyboard hints `i + 1`
by position, while `EventManager` passes the pressed digit straight through as a
species id, so the two only agree while position and id line up.

**Add a preset.** Append `{ name, description, cells }` to `PRESETS` in
`js/Presets.js`, where each cell is `{ x, y, species }`. Buttons are generated
from the array. Keep coordinates inside the real grid — `Presets.test.js` only
checks them against `GRID.MAX_SIZE` (64), not the 20 the game actually uses, and
out-of-range cells are silently dropped by `Grid.setCell`.

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

Eight suites. Every module has one except the three that are pure data or pure
wiring: `constants.js`, `PuzzleData.js`, and `game.js` (which exports nothing).
`Grid.test.js` is the one to read first: it pins the ecosystem rules with small
explicit boards, including a plants-only registry for checking the Conway
patterns without bees and rabbits interfering.

There are no debug or unlock query parameters; the game reads nothing from the
URL.

## Browser support

Current Chrome, Firefox, Safari, and Edge. Uses ES modules, so it must be served
over HTTP rather than opened from the filesystem. Touch is supported on the
canvas (`touchstart` / `touchmove` place and paint), and the sidebar stacks
above the canvas below 768px.

Dark mode follows `prefers-color-scheme` only — both the stylesheet and the
canvas colours in `Renderer._bgColor` read the OS setting, so the site's own
theme toggle does not reach them.

## Privacy

Nothing is saved and nothing leaves the page. The only input is clicks, taps and
keys, and no text is ever entered.

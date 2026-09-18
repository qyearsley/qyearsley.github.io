# Life Garden Module Architecture

## Overview

Life Garden started as Conway's Game of Life and grew a food chain on top of it.
The architecture follows that history: there is a pure simulation core that knows
nothing about the page, a rendering layer that holds every canvas and DOM call,
and one orchestrator (`game.js`) that owns the timer and wires the two together.

The core is deterministic. Every random decision comes from a seeded generator
that each grid carries its own copy of, so the same preset replays the same run
and stepping back and forward again reproduces it exactly. Nothing in the
simulation calls `Math.random`, `Date.now`, or touches the DOM.

**The board is two layers, not one.** Plants live on the ground and are a
cellular automaton; animals stand on top and are individuals with an energy
counter. That split is the single most important thing to know about this
codebase — it is what lets a rabbit stand in grass rather than replace it, and
it removed an entire birth-priority system that existed only to arbitrate
between them.

## Dependency graph

Arrows point from importer to import. `constants.js` imports nothing and is the
root; `game.js` is the only module that knows about all of them.

```
                          constants.js
                               │
   ┌──────────┬────────────┬───┴────┬──────────┬───────────┐
   ▼          ▼            ▼        ▼          ▼           ▼
Species.js  Random.js  PuzzleData  Presets  GameState  Renderer.js
   │          │            │                    │
   └────┬─────┘            │                    │
        ▼                  │                    │
     Grid.js               │              storage.js ──► shared/StorageManager.js
        │                  │
        │            PopulationChart.js
        │                  │
        │            GameUI.js ──► shared/BaseGameUI.js
        │                  │
        │            EventManager.js
        │                  │
        └──────────────────┴──► game.js
                     imports every module above
```

Two edges are forbidden on purpose:

- **The simulation never imports the UI.** Nothing in `Grid`, `Species`,
  `Random`, `GameState`, `PuzzleData` or `Presets` touches `document`, `window`,
  `localStorage`, a canvas, or a timer.
- **`Grid` never imports `Presets` or `PuzzleData`.** It takes a width, a height,
  a registry and a generator. Starting arrangements are applied by `game.js`
  calling `setCell`, so the engine has no notion of a "level".

## Key modules

### Grid.js

The simulation, and over a quarter of the game's code. Holds `plants[y][x]`
(`{species, age}`, with `EMPTY` for bare ground) and `animals[y][x]`
(`{species, energy, age, full}`, or `null`).

`step()` returns a **new** `Grid` and leaves this one untouched, which is what
makes the undo history a plain array of old grids. The order inside it matters
and is fixed:

```
_growPlants(source)   plants grow first, so a rabbit can eat grass born this turn
_copyAnimalsFrom(source)
_moveAnimals()        each animal acts in turn, on the live board
_arrivals()           seeds and animals from outside the garden
```

Growing plants before moving animals is deliberate. The other order would let
grass reappear underneath an animal that had just grazed it.

`_moveAnimals` acts on the live board one animal at a time rather than into a
copy, because two animals must not land in the same cell. That makes order
significant, so the actor list is shuffled from the grid's own generator —
reading order would give the top-left animal first refusal on every meal, which
shows up as a population drifting up and left. Animals eaten before their own
turn are tracked by **identity, not position**, because a victim may have moved
since the list was built.

One animal's turn is always the same four steps: spend a point of energy, move,
eat what it landed on, split if full. Flight overrides everything — an animal
that can see something it fears runs instead of grazing, and will not eat on the
way.

### Species.js

Every species is a plain data object and the engine reads whatever fields it
carries; `SpeciesRegistry` is the lookup, with `placeable()`, `plants()` and
`animals()` views over it.

Two numbers in here carry most of the game's behaviour, and both are commented at
length in the source because both look like typos:

- **Grass survives on 0-3 neighbours, not Conway's 2-3.** The rule is B3/S0123.
  Under S23 a grazed meadow unravels faster than anything can regrow, and the
  measured result was that no combination of the other numbers kept grass,
  rabbits and foxes alive together for 600 generations. The cost is the Conway
  patterns: a glider grows into a blob and a blinker does not blink.
- **`digest` is the brake on the whole food chain.** Without it an animal eats
  every cell it stands on, grazing scales with population rather than need, and
  the rabbits strip the board and starve together.

Prey always notices a predator from closer than the predator notices it
(`fearSight` < the hunter's `sight`). Two animals of the same speed can never
close a gap, so prey that saw as far as the fox would never be caught at all.

### Random.js

Mulberry32, seeded. The whole state is one 32-bit integer, which is what makes
`clone()` cheap enough to put on every generation. `shuffle` is Fisher-Yates and
exists for the actor ordering above.

### game.js

The orchestrator and the only module holding the timer. Owns the live grid, the
undo history (capped at `MAX_HISTORY = 200` grids), the selected species, and the
per-gesture painted-cell set. Boots on `DOMContentLoaded` inside a `try/catch`
and assigns `window.game`.

`_simulationTick` pushes the current grid onto the history, steps, and records a
chart sample — wrapped in a `try/catch` that pauses the simulation rather than
leaving a dead timer spinning on a thrown error.

### Renderer.js

Every canvas call. Owns the cell geometry (`fitToGrid`, `canvasToGrid`), the
hover preview, and the hand-drawn per-species textures — blades, bloom, dot,
ears, snout — plus the age fade from `color` to `colorAlt`. Reads the page theme
through `_isDark()` rather than being told, and holds no simulation state.

### PopulationChart.js

A line per living species against generation, over a rolling window. Owns no
simulation state: `game.js` calls `record()` after every step and `truncate()`
on Back, because a chart still showing the future you just rewound out of is
worse than no chart. Has a text legend, because lines told apart by colour alone
are not enough.

### GameState.js

Persisted progress and settings, and the puzzle/budget bookkeeping. **Settings
are coerced on load, never merged** — a spread would carry a hand-edited
`speed: 7` straight into `speed.toUpperCase()` in the simulation loop. `SPEED_NAMES`
is derived from the `SPEED` constant so a fourth speed cannot be added and
forgotten here, which would make it selectable but not loadable.

### storage.js

Extends `shared/StorageManager.js`, version `"2.0"`. Saves **completed puzzles
and settings only** — no species ids and no grid contents — so a save written
before the species list changed cannot put a removed species back on the board.
The version is the belt to that braces: species ids were renumbered when flowers
became a life stage and the fox was added.

### EventManager.js

Every DOM listener, translated into callbacks. Owns the drag state machine:
`mousedown` probes one cell to decide whether the gesture places or erases, and
every subsequent `mousemove` repeats that mode. Touch mirrors it.

The keyboard handler bails on a focused control and on modifier chords — without
the latter, ⌘R reset the grid on its way to reloading the page and ⌘-Space
toggled the simulation while the OS opened a search field over it.

### Presets.js

Seven starting arrangements, written as **character maps rather than coordinate
lists** — one string per row, one character per cell, so the shape is visible in
the source. `fromMap` turns them into cells. "Food Chain" and "No Predator" share
one `FIELD` and differ only in whether the foxes are added, which is the point of
having both.

### PuzzleData.js

One sandbox puzzle. The budget, goals, locked-cell and star machinery is all
present and all set to unlimited or empty — scaffolding for challenge modes that
do not exist yet. `Renderer` and `GameState` both honour it, so it is wired, not
dead.

## Three invariants

All three read like working code when broken, which is why they are here.

1. **The placeable species must stay sequential from 1, in palette order.**
   `EventManager` passes a pressed digit straight through as a species id, and
   the palette labels its key hints by position. Renumber `SPECIES` and the
   number keys select the wrong thing silently. `FLOWERING_GRASS` sits _after_
   the placeable ones because it is a life stage, not a palette entry.
2. **"Is this cell taken" depends on what you are holding.** `_layerTaken` asks
   about the layer the selected species would land on, not whether anything is
   there. Probing both layers made the first click of a gesture disagree with the
   rest of it: clicking grass onto a cell holding a rabbit deleted the rabbit,
   while dragging the same grass in from next door planted it underneath.
3. **One touch per cell per gesture, remembered as a set.** `mousedown` and every
   `mousemove` after it both paint, so a click that drifts one pixel called
   `clearCell` twice on the same cell — taking the rabbit and then the grass it
   stood in. Dragging back across a cell does the same, which is why it is a set
   and not just the last cell.

## Data flow

### One generation

```
_simulationTick()
   │
   ├─ history.push(grid)          ← the old grid IS the undo entry
   │    └─ shift() past MAX_HISTORY
   │
   ├─ grid = grid.step()  ─────────────────────────────┐
   │                                                   │
   │    new Grid(w, h, registry, rng.clone())          │
   │      │                                            │
   │      ├─ _growPlants(source)                       │
   │      │    per cell: Conway survive/birth from      │
   │      │    species data, then life-stage change,    │
   │      │    then _sproutChance on bare ground        │
   │      │                                            │
   │      ├─ _copyAnimalsFrom(source)                  │
   │      │                                            │
   │      ├─ _moveAnimals()                            │
   │      │    shuffle actors, then per animal:         │
   │      │      age++, energy--                        │
   │      │      energy <= 0 ─► remove                  │
   │      │      digesting = full > 0; full--           │
   │      │      threat in fearSight?  ─► flee, done    │
   │      │      digesting ? no food : _findFood        │
   │      │      move / eat / graze                     │
   │      │      energy >= breedAt ─► split             │
   │      │                                            │
   │      └─ _arrivals()                               │
   │           per species with arriveChance:           │
   │             animal: must be a resident AND          │
   │                     food on board >= arriveNeeds    │
   │                     lands on a free EDGE cell       │
   │             plant:  lands on ANY bare cell          │
   │                                                   │
   ├─ generation++                                     │
   ├─ chart.record(generation, grid)                   │
   ├─ ui.updateGeneration()                            │
   └─ renderer.render(grid) ◄──────────────────────────┘
```

### Why arrivals exist

A twenty-by-twenty board cannot hold a food chain up on its own. Every
arrangement that cycles nicely for a few hundred generations still dies out — a
run of bad luck takes the last rabbits and nothing on the board can bring them
back. A stripped board is worse: grass only sprouts beside grass, so once the
last blade goes the ground stays bare permanently.

Two brakes keep it from being a cheat. An animal only arrives if the board
already holds enough of its food, so a fox never walks into an empty field. And
**only a species that has lived on this board comes back** (`residents`), so a
board loaded without foxes never grows foxes — which is the whole point of having
"Food Chain" and "No Predator" as separate presets.

Seeds land on any bare cell rather than the edge, because wind does not respect a
fence. While seeds were edge-only, the border filled with grass the animals never
reached and every board grew a visible green frame within about forty
generations.

### Sequence: placing a species

1. `mousedown` reaches `EventManager`, which calls `onCanvasProbe` once.
2. `game.js` clears `paintedThisDrag`, converts pixels to a cell, and returns
   whether that layer is taken — which fixes the gesture as place or erase.
3. Every `mousemove` calls `onCanvasDrag` with that mode.
4. `game.js` skips locked cells and cells already painted this gesture, then
   calls `grid.setCell` or `grid.clearCell`.
5. The renderer redraws and the chart re-records the current generation.

## Testing

Tests live in the parent `__tests__/` directory — ten suites:

- `Grid.test.js` — the automaton, animal turns, arrivals, the two layers
- `Species.test.js` — the registry views and the species data
- `GameState.test.js` — settings coercion, budgets, stars
- `storage.test.js` — save shape and version rejection
- `Presets.test.js` — the character maps, and the ecology. This is the
  unusual one: it runs each preset for hundreds of generations and asserts the
  behaviour the numbers are tuned for — that no board ends dead, that the foxes
  hold the rabbits to a fraction of what they reach alone, that the foxes peak
  _after_ their prey rather than with them, that bees fill a board faster than
  the same board without them, and that Meadow never grows animals because none
  have ever lived there. Only possible because the generator is seeded.
- `Renderer.test.js` — geometry and cell hit-testing
- `PopulationChart.test.js` — record, truncate, window
- `GameUI.test.js` — palette and info-card rendering
- `EventManager.test.js` — drag modes and key routing
- `boot.test.js` — that the page comes up

`Random.js` has no suite of its own; it is asserted through the preset runs,
which are only pinnable because the generator is seeded.

Run from the repository root:

```bash
npm test                                     # all tests
npm test -- --testPathPatterns life-garden   # just this game
```

## Design principles

- **Deterministic simulation.** Every random decision comes from a seeded
  generator the grid owns. `Math.random` appears nowhere in the core.
- **`step()` returns a new grid.** Immutability is what makes undo a plain array
  and what makes rewinding restore the randomness with the board.
- **Two layers, never merged.** A plant and an animal can share a cell, and
  neither competes with the other for it.
- **Behaviour lives in species data, not in the engine.** `Grid` reads `survive`,
  `birth`, `eats`, `sight`, `digest` and the rest off whatever the registry
  hands it. Adding a species should not mean editing `Grid`.
- **The simulation never imports the UI.** No DOM, no canvas, no timer, no
  storage outside `game.js`, `GameUI`, `Renderer`, `PopulationChart` and
  `EventManager`.
- **Persisted data is coerced, not trusted.** Settings are rebuilt field by field
  and the save carries a version that discards an incompatible shape.

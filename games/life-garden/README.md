# Life Garden 🌿

A garden simulation on a 20×20 grid. Paint grass, bees, rabbits and foxes, press
play, and watch the food chain run. A line chart under the grid plots each
species' population, so a rabbit boom and the fox wave behind it are visible
rather than something you have to catch on the grid.

It is a toy rather than a lesson: there is no score, no goal, and nothing to
finish. The point is that a few small rules, run against each other, produce
behaviour nobody typed in.

## How it plays

Pick a species in the sidebar, click an empty cell to place it, and click a
filled one to clear it. The mode is decided by the **first** cell of a drag: if
that cell was occupied the whole gesture erases, otherwise the whole gesture
plants. Then **Play**, or **Step** one generation at a time. **Back** rewinds,
up to `MAX_HISTORY` (200) generations. **Clear** empties the grid.

The sidebar shows a card for whichever species is selected — its own numbers,
and how many are on the board right now. For an animal that is what it eats,
how far it sees, what a meal is worth and when it splits; for grass it is the
neighbour counts and the bloom age. The full rules are the section under the
game.

## The two layers

The board is two grids, not one.

**Plants** live on the ground and never move. They are a cellular automaton,
which is what this game started as. **Animals** stand on top of them and are not
an automaton at all: each one is an individual carrying a single number, its
energy, and it spends every generation moving, eating and breeding.

Two layers is what lets a rabbit stand in the grass instead of replacing it. It
also removed a whole birth-priority system, because nothing competes for a cell
with something on the other layer.

### The plant rules

| Rule            | What happens                                                      |
| --------------- | ----------------------------------------------------------------- |
| **Spreads**     | Bare ground with exactly 3 plants beside it grows grass           |
| **Crowded out** | A plant with 4 or more neighbours dies                            |
| **Creeps**      | Bare ground beside grass may sprout; a bloom seeds it 4× as often |
| **Blooms**      | Grass flowers at age 8, and the bloom ends 6 generations later    |

Grass and its bloom count each other as neighbours, so a meadow does not change
behaviour the moment it flowers.

### The animal rules

Every generation, each animal in turn spends 1 energy and dies at 0. Then it
runs if it can see something that eats it; otherwise it steps one cell towards
the nearest food it can see and eats what it lands on. After a meal it digests
for some generations and will not eat again until it has. Once its energy
reaches `breedAt` it splits in two, sharing its energy with the young.

| Animal    | Eats    | Sees | Runs from   | Meal | Digests | Splits at |
| --------- | ------- | ---- | ----------- | ---- | ------- | --------- |
| 🐝 Bee    | nectar  | 5    | —           | +12  | 4       | 26        |
| 🐇 Rabbit | grass   | 4    | foxes, at 3 | +16  | 9       | 88        |
| 🦊 Fox    | rabbits | 4    | —           | +40  | 14      | 80        |

Energy stops at `breedAt`. An animal hemmed in with nowhere to put its young
would otherwise bank energy forever and become effectively immortal.

Three rules reach across the two layers:

- **Eating sets a plant back one stage.** A grazed bloom drops to plain grass;
  plain grass is grazed to bare ground.
- **A bee takes nectar and leaves the flower.** It is the only animal that does
  not graze, and grass beside a working bee sprouts six times as fast.
- **Life arrives from outside.** Seeds blow in and land on any bare ground, and
  now and then an animal turns up at the edge — but only a kind that has lived
  on this board before, and only if there is already food for it.

## Why the rules are these rules

Every one of the departures below was forced by a measurement. The tuning
scripts are not in the repo, but the numbers are reproducible: build a grid,
load a preset, step it, and count.

### Grass does not die of loneliness

Conway's Game of Life is B3/S23. This is **B3/S0123**. The birth rule is
untouched and four neighbours still crowd a plant out, but a lone blade lives.

That single change is what makes a food chain possible, and it was the last
thing tried rather than the first. Under S23 a grazed meadow unravels: taking
one cell drops its neighbours' counts, the cells left on a single neighbour die
too, and the collapse runs ahead of anything that could grow back. Four separate
attempts to patch around it all failed for the same reason — whatever grew into
the gap was isolated, and died the next generation:

| Attempt                                           | Result                                    |
| ------------------------------------------------- | ----------------------------------------- |
| Blooms scatter a seed when they go over           | Seed lands alone, dies next generation    |
| Faster sprouting into bare ground beside grass    | Same                                      |
| Grazed ground keeps roots and regrows on a timer  | Regrown blade is isolated, dies           |
| Roots that only push up beside 2 surviving plants | Meadow becomes either immortal or a cliff |

Across roughly 3,000 parameter combinations swept over 3 to 6 seeds each, **no
combination kept grass, rabbits and foxes alive together for 600 generations
while S23 was in force.** Every combination that passed used S0123.

The cost is the Conway patterns. A glider under S0123 grows into a blob instead
of gliding, and a blinker does not blink. That is a real loss, and it is the one
thing this rewrite traded away.

### Animals have energy instead of neighbour counts

The old animals were cellular automata too. Each needed `survive`, `birth`,
`priority`, `maxAge`, a kill target and a kill threshold, plus `birthRequiresOwn`
to stop meadows spontaneously growing rabbits — and the fox needed a page of
justification on top, because a neighbour count was being asked to mean hunger.

One energy counter replaced all of it. A fox is rare because rabbits are rare,
not because its birth rule was tuned to be hard to satisfy.

### Digesting is the brake on the whole chain

Without a cooldown an animal eats every cell it stands on, so grazing scales
with how many animals there are rather than with what they need. Rabbits
stripped the board and starved as one, every time, at every energy setting
tried. `digest` caps the intake rate directly, and it is the reason a meadow can
carry a herd.

### Rabbits run, and see a fox later than it sees them

A fox that hunts on sight and never misses wipes out the rabbits and then
starves — that happened in every combination swept before flight existed.
Flight gives prey a refuge.

The asymmetry matters: `fearSight` (3) is shorter than the fox's `sight` (4).
Both animals move one cell a generation, so prey that spotted a hunter as soon
as it was spotted could never be caught, and the fox would starve beside a full
field.

### The board has a lush border, and that is the edges' doing

Measured at generation 250 on **Meadow**, the outermost ring of cells is about
67% grass against 31% in the middle. It reads as a green frame around the board.

That is not the arrivals — seeds land on any bare cell, precisely so they do not
pile up at the rim. It is the crowding rule meeting a bounded board. A plant
dies on 4 or more neighbours, an edge cell has at most 5 and a corner at most 3,
so the one thing that thins the meadow barely reaches the border.

Wrapping the board into a torus would remove it completely and is the usual fix
in a cellular automaton. It is not done here because "the edge" is a real place
in this game: animals walk in at it, and a fleeing rabbit can be cornered
against it. Both would have to be rethought, and the balance retuned. Filed as a
known artefact rather than a bug.

### The garden is not the whole world

A 20×20 board cannot hold a food chain up on its own. Every arrangement that
cycles nicely for a few hundred generations still dies out eventually — a run of
bad luck takes the last few rabbits, and nothing on the board can bring them
back. A stripped board is worse: grass only sprouts beside grass, so once the
last blade goes the ground stays bare.

Arrivals fix both, with two brakes. An animal only arrives if the board already
holds enough of its food. And only a kind that has lived on this board before
comes back — `Grid.residents` tracks that — so a board loaded without foxes
never grows foxes, which is what keeps **Food Chain** and **No Predator** worth
comparing.

## Does it oscillate?

Yes. Measured over 8 seeds on **Food Chain**, 600 generations each:

| Measurement                      | With foxes | Without foxes |
| -------------------------------- | ---------- | ------------- |
| Rabbit peak, median seed         | ~33        | ~211          |
| Rabbit peak, full range          | 20–176     | 165–248       |
| Plants, average of last 150 gens | 58–165     | 15–132        |

The fox peak comes **after** the rabbit peak on all 8 seeds, by 60 to 130
generations. That lag is what a predator-prey cycle is: the fox can only climb
once there is something to eat, and it is still climbing as the rabbits fall
away.

Read the ranges rather than the averages. On seven of these eight seeds the
foxes hold the rabbits somewhere between 20 and 52; on the eighth they lose
control late and the rabbits reach 176, taking the meadow down with them. That
spread is the simulation working, not a tuning failure, and `Presets.test.js`
asserts the population-level claim rather than a per-seed one for exactly that
reason.

Plants are still alive at generation 600 on every preset on every seed, never
below 125. That was the original complaint — boards used to settle into a
handful of frozen flowers — and it is the thing most likely to break, so the
test covers all seven presets across all eight seeds.

## Presets

| Preset          | What it shows                                                      |
| --------------- | ------------------------------------------------------------------ |
| **Meadow**      | Grass blocks that bloom, fade and bloom again. No animals ever     |
| **Pollinator**  | Lone blades and a few bees — the bees fill the board faster        |
| **Rabbit Run**  | Rabbits boom along strips, strip them, and the meadow comes back   |
| **Ecosystem**   | All four placeable species on one board                            |
| **Food Chain**  | Grass, rabbits, three foxes                                        |
| **No Predator** | The same field with the foxes removed                              |
| **Glider**      | The classic glider shape, which no longer glides — see S0123 above |

**Food Chain** and **No Predator** are the same board except for three cells, so
running both shows what removing the predator does.

**Pollinator** is lone blades rather than blocks on purpose. Three neighbours is
what the birth rule needs and nothing on that board has any, so every new blade
comes from grass creeping — the one thing a bee speeds up. On blocks the birth
rule does the work and the bees barely show. Even so, the claim is speed, not
size: both boards reach much the same place by generation 60, because the
meadow's ceiling is set by crowding. Measured at generation 30 over 8 seeds, the
bees are ahead on 6 of them, averaging 166 plants against 157.

## Reproducibility

The simulation is stochastic — sprouting, wandering, arrivals and the order the
animals act in all draw from a generator. Every grid carries its own `Random`,
seeded from `DEFAULT_SEED`, and `step()` hands a copy to the next generation.

That is what makes **Back** honest. `game.js` keeps old grids for undo, so
stepping an old one again has to replay the same run. It does, because the
generator went back with the grid. It is also what lets the preset tests assert
anything at all.

## The population chart

`js/PopulationChart.js` keeps a rolling 200-generation window of counts, one
series per species drawn in that species' own `color`, with the counts written
out underneath — the lines are told apart by colour alone, which is not a
distinction everyone can make.

`game.js` feeds it: `record()` after every step, `truncate()` after every
rewind, `reset()` when the grid is cleared or a preset is loaded. The window
matches `MAX_HISTORY`, so the chart can always show every generation **Back**
can still reach.

## Controls

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
├── constants.js        # SPECIES ids, KIND, GRID sizes, SPEED intervals, PHASE names, DEFAULT_SEED
├── Species.js          # SPECIES_DEFS (the rules) and SpeciesRegistry
├── Grid.js             # Both layers and step() -- the whole simulation
├── Random.js           # Seeded generator, copied onto every generation
├── Presets.js          # PRESETS: named starting arrangements, written as maps
├── PuzzleData.js       # PUZZLES: one sandbox entry, source of the grid size
├── GameState.js        # Phase, generation count, saved settings, budget/star bookkeeping
├── GameUI.js           # Species palette, species card and generation display
├── Renderer.js         # Canvas drawing and pixel↔cell coordinate maths
├── PopulationChart.js  # The line chart under the grid
├── EventManager.js     # Mouse, touch and keyboard listeners to callbacks
└── storage.js          # LifeGardenStorage over games/shared/StorageManager.js

styles/
├── main.css        # Layout, sidebar, species card, rules section, dark mode
└── canvas.css      # Canvas sizing and the chart
```

`BaseGameUI.js` and `StorageManager.js` are shared with the other games and live
in `games/shared/`.

The engine is generic: `Grid.step()` reads the registry and applies whatever
fields the definitions carry. It knows nothing about grass or foxes.

### Where the rules live on the page

The rules are hand-written in `index.html`, in the full-width section under the
game, and translated in `index.zh.json`. Generating that table from
`SPECIES_DEFS` would remove the duplication but would also make it
untranslatable: `build.js` translates by matching English text in the static
HTML, so anything JavaScript writes at runtime stays in English. The species
palette and the sidebar card already have that limitation.

If you change a number in `SPECIES_DEFS`, update the table in `index.html` too.

### What is saved

One thing: the speed you picked, in `localStorage` under `lifeGardenProgress`.
The grid is not saved — reload and the garden is empty, which is deliberate,
since a saved board would break the moment the species list changed.
`StorageManager`'s version stamp is the second line of defence there.

`showGrid` is saved and honoured, but no control sets it, so today it only ever
holds its default.

### Scaffolding that is not wired up

`GameState` and `PuzzleData` carry a whole puzzle mode — budgets, goals, locked
cells, goal zones, star thresholds, `unlockAfter` — that nothing in `game.js`
uses. The single `sandbox` puzzle sets every budget to `Infinity` and every list
to empty. It is tested, so it works; it is just not reachable from the UI.

### Recipes

**Change a species' rules.** Edit its entry in `SPECIES_DEFS` in
`js/Species.js`. Every field is data and the engine picks it up with no other
change. Then update the table in `index.html` and `index.zh.json`.

**Add a species.** Add an id to `SPECIES` in `js/constants.js`, add a definition
with a `kind`, and add a `case` for its `texture` in `Renderer._drawTexture` (a
missing case draws a plain coloured square, not an error — `Renderer.test.js`
checks every registered texture reaches a draw method). Keep the placeable ids
sequential from 1 and in palette order: the palette labels its keyboard hints by
position while `EventManager` passes the pressed digit straight through as a
species id, so the two only agree while position and id line up.

**Add a life stage.** Give the parent `bloomsInto` and `bloomAge`, give the stage
`revertsTo` and `bloomDuration`, and set `placeable: false` so it stays out of
the palette and out of the birth loop.

**Add a preset.** Append `{ name, description, cells: fromMap([...]) }` to
`PRESETS` in `js/Presets.js`. Each map row is one grid row, one character per
cell: `.` empty, `g` grass, `b` bee, `r` rabbit, `f` fox. Rows may be short and
there may be fewer of them than the grid has rows.

**Change the grid size.** `gridWidth` / `gridHeight` on the sandbox entry in
`js/PuzzleData.js`. `GRID.DEFAULT_WIDTH` and `DEFAULT_HEIGHT` in `constants.js`
are not what the game reads. Note that the balance is tuned for 20×20; a much
bigger board would want retuning.

### Testing

```bash
npm install                                    # from repo root
npm test                                       # all tests, including this game
npm test -- --testPathPatterns life-garden     # just this game
```

Ten suites. `Grid.test.js` is the one to read first: it pins the rules on small
explicit boards, using a generator with the randomness taken out so the certain
rules can be checked one at a time. `Presets.test.js` goes further and asserts
the behaviour the presets exist to demonstrate, across 8 seeds, so a rule change
that flattens the contrast fails the build rather than quietly making the
presets pointless. `boot.test.js` loads the real `index.html` and runs the real
entry point, which is what catches wiring that every unit test passes and a
browser does not.

There are no debug or unlock query parameters; the game reads nothing from the
URL.

## Browser support

Current Chrome, Firefox, Safari, and Edge. Uses ES modules, so it must be served
over HTTP rather than opened from the filesystem. Touch is supported on the
canvas, and the sidebar stacks above the canvas below 768px.

Both canvases follow the site theme picker first and `prefers-color-scheme`
second, through `window.__prefersDark` — see `Renderer._isDark` and
`PopulationChart._isDark`, which have to agree.

## Privacy

Nothing leaves the page. The one thing saved is the simulation speed, in
`localStorage`; the garden itself is not stored. The only input is clicks, taps
and keys, and no text is ever entered.

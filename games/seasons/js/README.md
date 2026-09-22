# Seasons module architecture

How the modules fit together, and why the boundaries sit where they do. This
file is canonical for the dependency graph, the purity rules, the three seams,
and how a question is derived; [`../README.md`](../README.md) owns what the game
_is_, the player-facing rules, and the recipes for changing it; file headers own
whatever only a reader of that file needs.

## If you are picking this up cold

Read four files, in this order: [`../README.md`](../README.md) for what the
game is, then `constants.js` (every shared value), `seasons.js` (the four
levels and all of the difficulty), and `GameState.js` (every rule, as pure
functions). That is just over 1,000 lines of code and it is the whole design.

Everything here beyond the rules exists to keep three unsettled decisions out of
them — what the game looks like (`art/`), what it asks the player to do
(`challenges/`), and what choosing an animal changes (`characters.js`). Those are
the three seams below, shaped that way because Ella keeps changing her mind,
which is the design premise rather than a problem.

**Terminology.** Every space on a trail holds an **obstacle**; `obstacles.js`
names the six kinds and says which are `hard`. A space that pays extra is a
**glowing space** — the phrase used throughout the code (`glowingAt`,
`glowingForms`, `isGlowingAt`, `ITEMS_PER_GLOWING_SPACE`) — and it is derived, not
authored: "glowing" means "a hard obstacle stands here", and the mountain is the
only hard kind. The [route model](../README.md#difficulty) is canonical. The
label the player sees is **"Glowing challenge"** — the only place the other
wording is correct.

## Dependency direction

Almost everything flows one way. No module imports anything below it in this
list, with one documented exception inside `art/`.

```
constants.js            imports nothing
  ↑
rng.js                  imports nothing
obstacles.js            imports nothing
characters.js           constants
seasons.js              constants, obstacles
  ↑
challenges/arithmetic.js    constants
challenges/index.js         challenges/arithmetic
Journey.js                  obstacles, seasons
art/index.js                constants, art/placeholder   ⟷ cycle
art/placeholder.js          art/index                    ⟷ cycle
  ↑
GameState.js            characters, constants, Journey, challenges, rng, seasons
storage.js              shared/StorageManager, characters, constants
  ↑
GameUI.js               shared/BaseGameUI, art, characters, constants, Journey,
                        obstacles
  ↑
game.js                 characters, constants, GameState, GameUI, Journey,
                        seasons, storage
```

Five consequences worth knowing:

- **`obstacles.js` imports nothing.** It is the vocabulary of what stands on a
  trail, and it sits at the bottom on purpose: `seasons.js` asks it which kinds
  are `hard` to derive `glowingAt`, `Journey.js` asks it to turn a route entry
  into a `Space`, and `GameUI.js` asks it for a display name. None of them
  decides what a kind means.
- **`art/index.js` and `art/placeholder.js` import each other.** The only cycle
  in the game: the registry needs the pack for `PACKS`, the pack needs the
  registry's `svg` helper. It works only because `svg` is a hoisted function
  declaration and `placeholder.js` never calls it at module scope. Making `svg`
  a `const` arrow, or building a drawing at module scope, turns this into a
  `ReferenceError` at load. A second pack is the moment to move `svg` out.
- **`game.js` does not import "everything".** Seven of the other thirteen
  modules, and deliberately not `rng.js`, `challenges/*`, `obstacles.js`, or
  `art/*` — randomness, question generation, the obstacle vocabulary, and drawing
  are reached through GameState, Journey, and GameUI.
- **`GameUI.js` does not import `GameState.js`.** It reads a state and draws it;
  it never advances one. (It names GameState and `seasons.js` in JSDoc types,
  which is a comment, not an import.) If a UI change seems to need a rule, the
  rule belongs in GameState and the UI should be handed the answer —
  `renderQuestion(state, {tag, lit}, onAnswer)` is the pattern: `game.js`
  composes the label, because the boss's tries and worth are rules the UI has no
  way to know.
- **`storage.js` does not import `Journey.js`.** Not a cycle — layering. Storage
  normalizes `position` only structurally; the semantic bound needs the season,
  so `GameState.rehydrate` applies `Journey.normalizePosition` on load.

## Purity

Three modules are allowed to be impure: `game.js` and `GameUI.js` touch the DOM
(GameUI owns the countdown; game reads `Date.now()` once, for a run seed), and
`storage.js` reaches `localStorage` through the base class, which stamps
`lastPlayed`. Everything else is a pure function of its arguments, except
`art/*`, which builds detached DOM nodes and attaches none.

`Math.random()` is never called. Every random value comes from `rng.js`, seeded
from the run's seed, which is what makes a season reproducible and the rules
testable without stubbing globals. `rng.js` seeds question generation and
distractor choice; the trail is not random at all — the art pack's `layout()` is
fixed deterministic geometry, computed from the season's route.

`game.js` also calls `start()` at the bottom of the module, so importing it
starts the game. The `game.*.test.js` suites work around that: each writes the
real
`index.html` into the document first, then imports `../js/game.js?load=N` with
a fresh query string each time so the module is re-evaluated rather than served
from the ESM cache.

## Where a question comes from

Worth tracing once, because it explains why the save file is so small.
`GameState` holds `seed`, `seasonId`, `attempt`, `position` and `extrasDone`;
`_questionRng` builds a generator from
`` `${seed}:${seasonId}:${attempt}:${position}:${extrasDone}` ``; `_makeQuestion`
picks the form list, **phase first** — in `PHASE.BOSS` always `boss.forms`,
wherever the position happens to be, otherwise `glowingForms` on a glowing space
and `forms` everywhere else; `challenges/index.js` resolves the season's
challenge type to a module; and that module's `generate(forms, rng)` returns the
question.

The key is where the player is standing, not how many questions have been asked.
That is what makes a retry recoverable: a wrong answer keeps the question and
still counts against `questionsAsked`, so a key built from that counter would
hand a reloading page a different question from the one she is working on. Every
space is visited once and asks at most two questions — its own, and the extra one
a miss owes — so `position` plus `extrasDone` names a question uniquely.
`attempt` is in there so that a replayed season asks different questions.

So a question is a pure function of the state, and `storage.js` deliberately
does not persist it — persisting it would store a value that could contradict
the fields it derives from. `GameState.rehydrate` regenerates it on load.

## The three seams

### Art — `art/`

A pack exports twelve required names plus one optional one, and
`art/placeholder.js` is the reference implementation of every one.

- `id`, `name` — identity, for the registry and any future art-style picker.
- `palette(seasonId)` → CSS custom properties, `--season-*` only; the game's
  chrome (`--sn-*`) is hard-coded in `styles/main.css` and out of a pack's reach.
- `character(id, onTrail)`, `item(seasonId, rare)`, `obstacle(kind, seasonId)`,
  `villain(happy)` → a `Drawing`, `{element, viewBox}`. An obstacle is drawn with
  its origin on the ground so `layout` can place it by translation alone, and takes
  a season so one drawing recolours for all four. `villain(true)` is the same
  character pleased rather than a second drawing — a wider grin, closed eyes, and
  the flask raised — which the end-of-run screen uses. `onTrail` picks a **pose**,
  not a subset of shapes — the sloth hangs from a branch on its card and walks on
  the trail. It used to strip out anything tagged `data-hangs-from`, which got
  the branch off the trail but left the sloth walking with its arms above its
  head, and a subtractive flag means nothing to a pack backed by images, where a
  pose is a different frame. A character with one pose ignores the flag.
- `backdrop(seasonId, width)` → `{layers, viewBox}`, **not** a `Drawing`. Each
  layer carries an `element`, a `span`, and a `parallax` factor saying how fast
  it pans relative to the ground: the sky is pinned at 0, the ridges drift, and
  the ground the character walks on is 1. That is what gives the trail depth —
  the whole backdrop used to sit inside the camera group, so distant hills panned
  at exactly the speed of the earth underfoot. Every layer is generated at the
  trail's real width, which is what stops a slower plane running out of scenery
  at the end of a long trail; a fixed-size vignette stretched across a 5000-unit
  trail also flattened its hills into bands.
- `layout(season)` → the trail's geometry: `width`, `height`, `viewportWidth`,
  `viewBox`, `groundSegments`, `stops`, `obstacles`. `stops[i]` is where the
  character stands facing obstacle `i`, `stops[route.length]` is the boss, and
  obstacle `i` sits between stops `i` and `i + 1` — so crossing it is a move from
  one stop to the next. `groundSegments` is a list of path `d` strings rather
  than one, because a gap genuinely removes the ground. It also returns
  `tokenScale`, `bossOffset`, `bossTransform` and `glow`: how this pack wants the
  shared pieces placed in its own coordinates. GameUI used to hard-code those
  four, which made it a second place that knew how the art was drawn and meant a
  replacement pack could not be dropped in without editing the UI.
- `traversal(kind, from, to)` → `{keyframes, options}` for `Element.animate`.
  Every crossing ends on a squash and then a clean final frame. The clean frame
  matters: crossings play with `fill: "forwards"`, so any deformation left on the
  last keyframe is what the character wears for the whole of the next question.
  The squash pivots on the bottom of the token, which `.trail-token` sets in CSS
  with `transform-box: fill-box` — an SVG group scales about the centre of the
  whole trail viewBox otherwise, which lifts the character rather than
  compressing it.
- `standing(stop)` → a CSS transform, for placing the token with no animation.
- `reducedTraversal(kind, from, to)` → the same shape as `traversal`, for a
  player who has asked for less motion: a plain slide between the two stops, no
  arc, hang or squash, and the kind deliberately ignored. It exists because the
  reduced-motion path used to _delete_ the crossing rather than reduce it — the
  character teleported and the camera did not pan, so the game's main piece of
  feedback simply did not happen, and it read as broken rather than as
  considerate. A pack that omits this one degrades to instant placement.
- `idle(subjectId)` → a motion name, or null. **The one optional export.** It
  says how a drawing moves while it is standing still: the placeholder pack
  returns `"breathe"`, `"bob"` or `"sway"`, and `styles/main.css` animates
  whatever carries the matching `idle-<motion>` class. Naming a behaviour rather
  than returning a transform is the same convention `AIR_ART` uses for the
  weather, and it is what keeps the stylesheet from having to know what an
  animal looks like. `subjectId` is a character id, or the reserved `"villain"`
  for the snake woman. GameUI wraps the drawing in a third nested `<g>` for
  this, and has to: it owns `.trail-token`'s transform for walking, the group
  inside carries the pack's `scale`, and a CSS transform replaces an element's
  transform attribute rather than composing with it. A pack that omits `idle`
  gets a trail where nothing but the walk and the weather moves.

Obstacles can move too, and that needs no export at all: `obstacle()` wraps
whatever should move in `obs-mark obs-<motion>` itself, exactly as `backdrop()`
already writes `air-mark air-<motion>`. The river's highlights shimmer and the
thicket's canopies sway that way.

The pack owning `traversal` as well as the drawings is the point of the seam: a
sprite pack could swap frames where this one arcs a transform, and return
`<image>` elements from the drawing functions.

Recipes: [Replace the art](../README.md#replace-the-art) for a whole pack,
[Add or change an obstacle](../README.md#add-or-change-an-obstacle) for one kind.

### Challenge type — `challenges/`

A module exports two required functions and one optional one:

```js
generate(forms: Array<Object>, rng: Rng) -> Question
check(question: Question, given: unknown) -> boolean
explain(question: Question) -> {equation: string, model: Object|null}|null
```

A `Question` must carry `prompt` (a string to show) and `choices` (values to
render as buttons). Anything else on it belongs to the challenge module —
`arithmetic.js` adds `answer`, `kind` and `parts`. That is what lets a new
challenge type reuse the whole play screen. `forms` is opaque to everything
except the challenge module and the seasons that use it; `challenges/index.js`
never inspects it.

`explain` feeds the reinforcement card, which comes up once a missed question is
finally answered right. `equation` is the fact in full ("4 + 7 = 11"); `model`
describes a picture of it by `kind`, and `GameUI._renderModel` draws the kinds it
knows (`array`, `groups`, `tenFrames`, `steps`) and nothing for a kind it does
not. A module without `explain`, or one returning `null`, simply gets no card.
The module decides _what_ explains a fact; `GameUI` decides how it looks.

**Known leak.** `game.js` reads `state.question?.answer` in `_onAnswer`, to hand
`GameUI.flashAnswer` the value to highlight and to work out which wrong choices
the Phoenix's hint may remove. That is the one place outside `arithmetic.js` that
depends on a field the seam calls private, so a challenge type whose answer is
not a renderable scalar would need this fixed — most likely by having the
challenge module expose a `describeAnswer(question)`, or by moving the highlight
decision behind it.

Recipe: [Add a new kind of challenge](../README.md#add-a-new-kind-of-challenge).

### Character perks — `characters.js`

Perks are values in an `effects` object, merged over `DEFAULT_EFFECTS`. There
is no function on a character and no `if (character.id === ...)` in GameState.
One field per animal, which is not a coincidence: with no penalty left to scale,
the roster was rebuilt around the four things a perk can still touch.

| Field            | Read by                           | Meaning                                            |
| ---------------- | --------------------------------- | -------------------------------------------------- |
| `extraSeconds`   | `GameState.questionSeconds`       | Added to a timed question                          |
| `noTimer`        | `GameState.questionSeconds`       | Never runs a countdown, whatever the setting says  |
| `hintsPerSeason` | `GameState.startSeason`, `answer` | Misses per season that take two wrong choices away |
| `skipsExtra`     | `GameState.answer`                | A miss goes straight on, with no extra question    |

**No perk may touch an item count.** The demand is met exactly — see
[Reachability](#reachability) below — and that only holds while every space pays
the same to everyone. `characters.test.js` asserts it.

Recipe: [Add or change an animal](../README.md#add-or-change-an-animal).

## The trail on screen

Four decisions in `GameUI`'s trail code are load-bearing.

The scene is built **once per season and character** and afterwards only moved.
Everything sits inside a `.trail-camera` group and scrolling is a transform on
that group, because a `viewBox` cannot be animated and a transform can;
rebuilding per question would make the character teleport and the landscape jump.

A crossing is `GameUI.crossObstacle(from, kind)`, which plays the keyframes
`traversal()` handed back while panning the camera. `skipTraversal()` finishes
both, which is what a `pointerdown` anywhere on the document does; under
`prefers-reduced-motion` the token is placed instantly and nothing animates.
`game.js` captures the position and the obstacle **before** applying the answer —
the crossing is _from_ where the character stood, _over_ what was in the way —
and keeps `answering` true for its whole duration, so a fast tapper cannot answer
mid-leap.

`_placeToken` cancels lingering animations before writing the token's transform,
and that order matters: crossings play with `fill: "forwards"`, a filling
animation outranks inline style, so the write was silently ignored and the
character stayed stranded beside the snake woman after a retry.

No SVG geometry is measured: every coordinate comes from `layout()`, which is
arithmetic. That is why `GameUI` needs no test-only branch under jsdom, which
implements no SVG geometry at all.

## The retry rule

A wrong answer costs nothing. It keeps the question on screen with the choice
just taken struck off, and the player goes again until she has it. Four fields
carry that, and they are easy to confuse:

- **`retrying`** — this question has already been missed once. Set by a wrong
  answer, cleared when the question is finally answered. While it is set,
  `questionSeconds` returns `null`: the retry is **untimed**.
- **`owed`** — 0 or 1. A miss owes one more question at this space before it
  pays out.
- **`extrasDone`** — 0 or 1. The extra question has been asked, so another miss
  owes nothing. This is the cap: at most two distinct questions per space.
- **`hintsLeft`** — the Phoenix's hints, banked per season.

`_freshSpace()` clears the first three whenever the character moves, so a debt
cannot follow her onto the next obstacle.

The untimed retry is not a courtesy — it is what guarantees a season makes
progress. A timeout is a wrong answer, and a wrong answer keeps the question, so
a clock on the retry would time the same question out again forever for exactly
the child who could not answer it.

### Reachability

Every space pays `PLAY.ITEMS_PER_SPACE`, every glowing space
`PLAY.ITEMS_PER_GLOWING_SPACE`, and the snake woman's own question pays
`boss.rescue`. A season's `demand` is the sum of all three, exactly:

```
demand === maxItems(season) + season.boss.rescue
```

`seasons.test.js` asserts it for every season. So the last answer of a season is
always the one that completes the count, which is the whole point of the 2026-09-21
retune. Two things follow, and both are held by tests: no perk may change what a
space pays, and nothing may take an item away.

## State shape

`GameState` is a flat object of serializable values. `items` is banked and safe,
and it is the only item counter — there used to be a `wilting` pool and a `lost`
tally beside it, both of which went with the wrong-answer penalties.
`GameUI.renderItemTrack` fills `#item-track` with one pip per slot: the art
pack's `item()` drawing when earned, a dashed outline when still owed.

## Testing

`__tests__/` holds 14 Jest suites for 14 modules. The mapping is not
one-to-one: `art.test.js` covers both files in `art/`, `obstacles.js` is checked
through the suites that consume it, and `constants.js` has no suite of its own —
it is data with no behaviour, and every other suite reads it. Three of them guard
things a normal unit test would miss: `seasons.test.js` asserts every demand is
met exactly by a perfect run; `arithmetic.test.js` parses each generated prompt
and recomputes it, over hundreds of seeds and every form list the real seasons
use; and `art.test.js` holds the pack contract test.

The `game.*.test.js` suites drive `game.js` black-box through the real
`index.html` — see [Purity](#purity) for why they have to. They are split by
subject only so Jest can run them in parallel; everything they share lives in
`game-harness.js`. See [Seeing your change](../README.md#seeing-your-change) for
how to run them.

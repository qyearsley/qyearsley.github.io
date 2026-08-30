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
starts the game. `game.test.js` works around that: it writes the real
`index.html` into the document first, then imports `../js/game.js?load=N` with
a fresh query string each time so the module is re-evaluated rather than served
from the ESM cache.

## Where a question comes from

Worth tracing once, because it explains why the save file is so small.
`GameState` holds `seed`, `seasonId`, `attempt`, and `questionsAsked`;
`_questionRng` builds a generator from
`` `${seed}:${seasonId}:${attempt}:${questionsAsked}` `` (`attempt` is in there
so replaying a lost season asks different questions); `_makeQuestion` picks the
form list, **phase first** — in `PHASE.BOSS` always `boss.forms`, wherever the
position happens to be, otherwise `glowingForms` on a glowing space and `forms`
everywhere else; `challenges/index.js` resolves the season's challenge type to a
module; and that module's `generate(forms, rng)` returns the question.

So a question is a pure function of the state, and `storage.js` deliberately
does not persist it — persisting it would store a value that could contradict
the fields it derives from. `GameState.rehydrate` regenerates it on load.

## The three seams

### Art — `art/`

A pack exports eleven names, and `art/placeholder.js` is the reference
implementation of every one.

- `id`, `name` — identity, for the registry and any future art-style picker.
- `palette(seasonId)` → CSS custom properties, `--season-*` only; the game's
  chrome (`--sn-*`) is hard-coded in `styles/main.css` and out of a pack's reach.
- `character(id, onTrail)`, `item(seasonId, rare)`, `obstacle(kind, seasonId)`,
  `villain()`, `backdrop(seasonId, width)` → a `Drawing`, `{element, viewBox}`.
  An obstacle is drawn with its origin on the ground so `layout` can place it by
  translation alone, and takes a season so one drawing recolours for all four;
  `backdrop` is generated at the trail's real width. `onTrail` drops any shape
  carrying `data-hangs-from` — the sloth's branch otherwise travelled onto the
  trail as a stick floating in mid-air.
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
- `standing(stop)` → a CSS transform, for placing the token with no animation.

The pack owning `traversal` as well as the drawings is the point of the seam: a
sprite pack could swap frames where this one arcs a transform, and return
`<image>` elements from the drawing functions.

Recipes: [Replace the art](../README.md#replace-the-art) for a whole pack,
[Add or change an obstacle](../README.md#add-or-change-an-obstacle) for one kind.

### Challenge type — `challenges/`

A module exports exactly two functions:

```js
generate(forms: Array<Object>, rng: Rng) -> Question
check(question: Question, given: unknown) -> boolean
```

A `Question` must carry `prompt` (a string to show) and `choices` (values to
render as buttons). Anything else on it belongs to the challenge module —
`arithmetic.js` adds `answer` and `kind`. That is what lets a new challenge type
reuse the whole play screen. `forms` is opaque to everything except the
challenge module and the seasons that use it; `challenges/index.js` never
inspects it.

**Known leak.** `game.js` reads `state.question?.answer` in `_onAnswer`, to hand
`GameUI.flashAnswer` the value to highlight and to write "The answer was 42"
into the feedback line. That is the one place outside `arithmetic.js` that
depends on a field the seam calls private, so a challenge type whose answer is
not a renderable scalar would need this fixed — most likely by having the
challenge module expose a `describeAnswer(question)`, or by moving the highlight
decision behind it.

Recipe: [Add a new kind of challenge](../README.md#add-a-new-kind-of-challenge).

### Character perks — `characters.js`

Perks are values in an `effects` object, merged over `DEFAULT_EFFECTS`. There
is no function on a character and no `if (character.id === ...)` in GameState.
The current fields:

| Field                  | Read by                           | Meaning                                                                 |
| ---------------------- | --------------------------------- | ----------------------------------------------------------------------- |
| `penaltyScale`         | `GameState._applyPenalty`         | Multiplier on whatever the active wrong-answer rule costs. 0 is immune. |
| `glowingItems`         | `GameState.answer`                | Items from a glowing space                                              |
| `extraSeconds`         | `GameState.questionSeconds`       | Added to a timed question                                               |
| `forgivenessPerSeason` | `GameState.startSeason`, `answer` | Wrong answers waved away                                                |
| `comebackBonus`        | `GameState.answer`                | Doubles the first correct answer after a wrong one                      |

`penaltyScale` deliberately does not name a punishment. The active
`RULES.WRONG_ANSWER` decides _what_ a wrong answer costs; the scale decides how
much of it this character takes. That keeps every character meaningful under
all three rules, so playtesting the rules cannot invalidate the roster.

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

## The rule switches

`RULES.WRONG_ANSWER` and `RULES.BOSS_FAILURE` in `constants.js` are the two
design questions Ella has not settled;
[`../README.md`](../README.md#two-rules-that-are-not-decided-yet) describes what
each option does and
[the recipe](../README.md#change-what-a-wrong-answer-costs-or-what-a-missed-boss-costs)
covers switching one. `RULES` is deliberately **not** frozen: `GameState.test.js`
flips it in `beforeEach` and restores it in `afterEach` to cover every option,
which is far simpler than module mocking under ESM. Nothing in the running game
ever writes to it.

`BOSS_TRIES` (currently 2) sits alongside them but is not one of the open
questions — it is Ella's decided rule, and `RULES.BOSS_FAILURE` only applies once
the tries run out. `_applyPenalty` is skipped on the boss branch, which is the
mechanism behind a boss that [never opens a gap](../README.md#how-it-plays).

## State shape

`GameState` is a flat object of serializable values. Three fields carry the
wilt rule and are easy to confuse:

- **`items`** — banked and safe. This is what counts toward the demand.
- **`wilting`** — at risk. Does not count. The next correct answer moves it back
  into `items`; the next _wrong_ answer moves it into `lost`.
- **`lost`** — gone for good. Shown in the season summary and nowhere else.

Keeping `wilting` separate from both is what makes a wilt visible on screen and
one mistake recoverable where two in a row are not. `GameUI.renderItemTrack`
fills `#item-track` with one pip per slot to show it: the art pack's `item()`
drawing when earned, greyed and tilted when wilting, a dashed outline when owed.

## Testing

`__tests__/` holds 11 Jest suites for 14 modules. The mapping is not
one-to-one: `art.test.js` covers both files in `art/`, `obstacles.js` is checked
through the suites that consume it, and `constants.js` has no suite of its own —
it is data with no behaviour, and every other suite reads it. Three of them guard
things a normal unit test would miss: `seasons.test.js` asserts every demand is
reachable by every character with headroom; `arithmetic.test.js` parses each
generated prompt and recomputes it, over hundreds of seeds and every form list
the real seasons use; and `art.test.js` holds the pack contract test.

`game.test.js` drives `game.js` black-box through the real `index.html` — see
[Purity](#purity) for why it has to. It and `GameUI.test.js` run at the current
`RULES` defaults and assert the exact copy those produce, which is why flipping a
switch makes a handful of them fail. See
[Seeing your change](../README.md#seeing-your-change) for how to run them.

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
functions). That is about 950 lines of code and it is the whole design.

A season is a trail of questions; each correct answer collects an item, meeting
the season's quota wins it, and a boss question at the end can close a small
gap. Everything else here exists to keep three unsettled decisions out of the
rules — what the game looks like (`art/`), what it asks the player to do
(`challenges/`), and what choosing an animal changes (`characters.js`). Those
are the three seams below. They are shaped that way because Ella keeps changing
her mind, which is the design premise rather than a problem.

**Terminology.** A trail position that pays extra is a **glowing space**, and
that is the phrase used throughout the code (`glowingAt`, `glowingForms`,
`isGlowingAt`, `ITEMS_PER_GLOWING_SPACE`). The label the player sees on the
question is **"Glowing challenge"** — the only place the other wording is
correct.

## Dependency direction

Almost everything flows one way. No module imports anything below it in this
list, with one documented exception inside `art/`.

```
constants.js            imports nothing
  ↑
rng.js                  imports nothing
characters.js           constants
seasons.js              constants
  ↑
challenges/arithmetic.js    constants
challenges/index.js         challenges/arithmetic
Journey.js                  constants, seasons
art/index.js                constants, art/placeholder   ⟷ cycle
art/placeholder.js          art/index                    ⟷ cycle
  ↑
GameState.js            characters, constants, Journey, challenges, rng, seasons
storage.js              shared/StorageManager, characters, constants
  ↑
GameUI.js               shared/BaseGameUI, art, characters, constants, Journey
  ↑
game.js                 characters, constants, GameState, GameUI, Journey,
                        seasons, storage
```

Four consequences worth knowing:

- **`art/index.js` and `art/placeholder.js` import each other.** The only cycle
  in the game: the registry needs the pack for `PACKS`, the pack needs the
  registry's `svg` helper. It works only because `svg` is a hoisted function
  declaration and `placeholder.js` never calls it at module scope. Making `svg`
  a `const` arrow, or building a drawing at module scope, turns this into a
  `ReferenceError` at load. A second pack is the moment to move `svg` out.
- **`game.js` does not import "everything".** Seven of the other twelve modules,
  and deliberately not `rng.js`, `challenges/*`, or `art/*` — randomness,
  question generation, and drawing are reached through GameState and GameUI.
- **`GameUI.js` does not import `GameState.js`.** It reads a state and draws it;
  it never advances one. (It names GameState and `seasons.js` in JSDoc types,
  which is a comment, not an import.) If a UI change seems to need a rule, the
  rule belongs in GameState and the UI should be handed the answer.
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
distractor choice; the trail's shape is not random at all — `trailPath()` is
fixed deterministic geometry.

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

Each one isolates a decision that is not yet made.

### Art — `art/`

A pack exports eight names: `id`, `name`, `palette`, `character`, `item`,
`scenery`, `villain`, `trailPath`. `character`, `item`, `scenery`, and
`villain` return a `Drawing` — `{element, viewBox}`. `palette` returns CSS
custom properties, `--season-*` only; the game's chrome (`--sn-*`) is hard-coded
in `styles/main.css` and out of a pack's reach. `trailPath` returns
`{d, viewBox, width, height}`, and `GameUI` places trail markers by walking that
path with `getPointAtLength`, so a pack can hand back a spiral instead of a wave
and the layout follows. A pack backed by image files would return `<image>`
elements from the same functions; nothing assumes the art is drawn rather than
loaded.

Recipe: [Replace the art](../README.md#replace-the-art).

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
questions — it is Ella's decided rule that a missed boss question earns a fresh
one, and `RULES.BOSS_FAILURE` only applies once the tries run out. A missed boss
question applies no penalty at all: `_applyPenalty` is skipped on the boss
branch, so the boss can close a shortfall but never create one.

## State shape

`GameState` is a flat object of serializable values. Three fields carry the
wilt rule and are easy to confuse:

- **`items`** — banked and safe. This is what counts toward the demand.
- **`wilting`** — at risk. Does not count. The next correct answer moves it back
  into `items`; the next _wrong_ answer moves it into `lost`.
- **`lost`** — gone for good. Shown in the season summary and nowhere else.

Keeping `wilting` separate from `items` is what makes a wilt visible in the
number on screen, and keeping it separate from `lost` is what makes one mistake
recoverable and two in a row not. `GameUI.renderItemTrack` fills `#item-track`
with one pip per slot to show it: the art pack's `item()` drawing when earned,
greyed and tilted when wilting, a dashed outline when still owed.

## Testing

`__tests__/` holds 11 Jest suites for 13 modules. The mapping is not
one-to-one: `art.test.js` covers both files in `art/`, and `constants.js` has no
suite of its own — it is data with no behaviour, and every other suite reads it.
Three of them guard things a normal unit test would miss: `seasons.test.js`
asserts every demand is reachable by every character with headroom;
`arithmetic.test.js` parses each generated prompt and recomputes it, over
hundreds of seeds and every form list the real seasons use; and `art.test.js`
holds the pack contract test, written against the contract rather than the
placeholder's shapes so it can be pointed at a new pack.

`game.js` exports nothing and self-starts on import, so `game.test.js` drives it
black-box through the real `index.html`, re-importing with a fresh `?load=N`
query string per case. It and `GameUI.test.js` run at the current `RULES`
defaults and assert the exact copy those produce, which is why flipping a switch
makes a handful of them fail. See
[Seeing your change](../README.md#seeing-your-change) for how to run them.

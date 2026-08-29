# Seasons module architecture

How the modules fit together, and why the boundaries sit where they do. For
what the game _is_, see [`../README.md`](../README.md).

## Dependency direction

Everything flows one way. No module imports anything below it in this list.

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
art/index.js                constants, art/placeholder
art/placeholder.js          art/index (for the svg helper only)
  ↑
GameState.js            characters, constants, Journey, challenges, rng, seasons
storage.js              shared/StorageManager, characters, constants
  ↑
GameUI.js               shared/BaseGameUI, art, characters, constants, Journey
  ↑
game.js                 everything
```

Two consequences worth knowing:

- **`GameUI.js` does not import `GameState.js`.** It reads a state and draws it;
  it never advances one. If a UI change ever seems to need a rule, the rule
  belongs in GameState and the UI should be handed the answer.
- **`storage.js` does not import `Journey.js`.** It would be a cycle through
  `seasons.js`. Storage therefore normalizes `position` only structurally
  (non-negative integer); `GameState.rehydrate` applies the semantic bound.

## Purity

`game.js` is the only file allowed to be impure. Everything else is either a
pure function of its arguments or a DOM writer:

| Module                                                                              | Touches the DOM                   | Reads a clock                     | Random      |
| ----------------------------------------------------------------------------------- | --------------------------------- | --------------------------------- | ----------- |
| `constants`, `rng`, `characters`, `seasons`, `Journey`, `GameState`, `challenges/*` | no                                | no                                | seeded only |
| `art/*`                                                                             | creates nodes, attaches none      | no                                | no          |
| `storage`                                                                           | `localStorage` via the base class | base class stamps `lastPlayed`    | no          |
| `GameUI`                                                                            | yes                               | owns the countdown                | no          |
| `game`                                                                              | yes                               | `Date.now()` once, for a run seed | no          |

`Math.random()` is never called. Every random value comes from `rng.js`, seeded
from the run's seed, which is what makes a season reproducible and the rules
testable without stubbing globals.

## Where a question comes from

Worth tracing once, because it explains why the save file is so small.

1. `GameState` holds `seed`, `seasonId`, and `questionsAsked`.
2. `_questionRng(state)` builds a generator from `` `${seed}:${seasonId}:${questionsAsked}` ``.
3. The player's position decides which form list to draw from: `boss.forms` at
   the boss, `glowingForms` on a glowing space, `forms` otherwise.
4. `challenges/index.js` resolves the season's challenge type to a module.
5. That module's `generate(forms, rng)` returns the question.

So a question is a pure function of the state, and `storage.js` deliberately
does not persist it — persisting it would store a value that could contradict
the fields it derives from. `GameState.rehydrate` regenerates it on load.

## The three seams

These are the reason the module list is shaped this way. Each one isolates a
decision that is not yet made.

### Art — `art/`

A pack exports eight names: `id`, `name`, `palette`, `character`, `item`,
`scenery`, `villain`, `trailPath`. `character`, `item`, `scenery`, and
`villain` return a `Drawing` — `{element, viewBox}`. `palette` returns CSS
custom properties. `trailPath` returns `{d, viewBox, width, height}`.

`GameUI` places trail markers by walking the returned path with
`getPointAtLength`, so a pack can hand back a spiral instead of a wave and the
layout follows. `art.test.js` holds the contract test a new pack must satisfy.

To add a pack: new file in `art/`, add it to `PACKS` in `art/index.js`, point
`constants.ART.PACK` at it.

### Challenge type — `challenges/`

A module exports exactly two functions:

```js
generate(forms: Array<Object>, rng: Rng) -> Question
check(question: Question, given: unknown) -> boolean
```

A `Question` must carry `prompt` (a string to show) and `choices` (values to
render as buttons). Anything else on it belongs to the challenge module —
`arithmetic.js` adds `answer` and `kind`, and only `arithmetic.js` reads them.
That is what lets a new challenge type reuse the whole play screen.

`forms` is opaque to everything except the challenge module and the seasons
that use it. `challenges/index.js` never inspects it.

To add a type: new file in `challenges/`, add it to `CHALLENGES` in
`challenges/index.js`, set `challenge: "<name>"` on a season.

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

To add an animal: one entry in `ROSTER`. To add a new _kind_ of effect: a field
in `DEFAULT_EFFECTS` plus the code in GameState that honours it.
`characters.test.js` asserts every character has every `DEFAULT_EFFECTS` key,
so adding a field without merging it fails there.

## The two rule switches

`RULES.WRONG_ANSWER` and `RULES.BOSS_FAILURE` in `constants.js` are the two
design questions Ella has not settled. Both are implemented in full.

`RULES` is deliberately **not** frozen. Tests flip it in `beforeEach` and
restore it in `afterEach` to cover every option, which is far simpler than
module mocking under ESM. Nothing in the running game ever writes to it.

Every option is exercised by `GameState.test.js`. Changing a default is a
one-line edit with no other consequence.

## State shape

`GameState` is a flat object of serializable values. Three fields carry the
wilt rule and are easy to confuse:

- **`items`** — banked and safe. This is what counts toward the demand.
- **`wilting`** — at risk. Does not count. The next correct answer moves it back
  into `items`; the next _wrong_ answer moves it into `lost`.
- **`lost`** — gone for good. Shown in the season summary and nowhere else.

Keeping `wilting` separate from `items` is what makes a wilt visible in the
number on screen, and keeping it separate from `lost` is what makes one mistake
recoverable and two in a row not.

## Testing

One suite per module in `__tests__/`. Two are worth calling out because they
guard things a normal unit test would miss:

- **`seasons.test.js`** asserts every season's demand is reachable by every
  character, with headroom. A retune that makes a season impossible fails here
  rather than in play.
- **`arithmetic.test.js`** parses each generated prompt and recomputes it, over
  hundreds of seeds and every form list the real seasons use. A generator that
  produces a prompt not matching its own answer fails here.

`game.js` exports nothing, so `game.test.js` drives it black-box through the
real `index.html`.

```bash
npm test -- --testPathPatterns seasons
```

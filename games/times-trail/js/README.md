# Times Trail Module Architecture

## Overview

Times Trail splits into a layer of pure logic modules that hold the game's rules,
a rendering layer that holds every DOM call, and one orchestrator (`game.js`) that
wires them together and decides when things happen. The pure modules take an
injected `rng` and `now`, so their behaviour is fully determined by their
arguments and testable without a browser or a fake clock.

**There is no `GameState.js.`** Number Garden has one; this game does not. The
live state is a plain object held by `game.js` (`this.progress`), and every
transition on it happens in a tested pure module -- `MasteryModel` for records,
`Scoring` for stars and the daily goal, `Journey` for the token, `Settings` for
the fact pool. A `GameState` class in the middle would only forward calls, and
the save shape it would own already lives in `storage.js` next to the
normalization that guards it.

**The tiles path is currently off.** `KEYPAD_MIN_STRENGTH` is 0 as a trial, so
every question routes to the keypad and `INPUT_MODE.TILES` is never produced.
Everything below still describes the tiles path, because reverting the trial is
a one-line change to that constant and nothing else -- see "Keypad only, no
multiple choice" in `docs/times-trail-plan.md`.

## Dependency graph

Arrows point from importer to import. `constants.js` imports nothing and is the
root; `game.js` is the only module that knows about all of them.

```
                            constants.js
                                 │
      ┌──────────┬───────────┬───┴────┬───────────┬──────────┐
      ▼          ▼           ▼        ▼           ▼          ▼
  facts.js  MasteryModel  Scoring  distractors  Keypad  (EventManager
      │          │                     │                 imports nothing)
      │          │                     │
      ├──────────┼──► FactSelector.js  │
      ├──────────┼──► Journey.js       │
      ├──────────┼──► storage.js ──► games/shared/StorageManager.js
      ├──────────┴──► Settings.js      │
      │                                │
      ├──► modes/quickRecall.js ◄───────┘
      │         │
      │         ├──► modes/shared.js  (the one scaffold builder; imports nothing)
      │         └──► modes/index.js   (registry and dispatcher)
      │
      └──► GameUI.js ──► games/shared/BaseGameUI.js

                              game.js
                    imports every module above
```

Two edges are forbidden on purpose:

- **Core logic never imports the UI.** Nothing in `facts`, `MasteryModel`,
  `FactSelector`, `Journey`, `Scoring`, `Settings`, `distractors`, `storage`, or
  `modes/` touches `document`, `window`, `localStorage`, or a timer.
- **`GameUI` never imports a mode.** It imports only `BaseGameUI`,
  `constants.js`, and `facts.js`, so it cannot recompute -- and therefore cannot
  disagree with -- anything a mode or a core module decided. `GameUI` is handed
  already-decided numbers and renders them.

## Key Modules

### game.js

The page entry point and session orchestrator. Owns the live state, injects every
collaborator, runs the session loop, and stamps the response clock. Boots on
`DOMContentLoaded` inside a `try/catch` that puts a readable message on the page
instead of leaving it blank. It exports nothing, so `game.test.js` drives it
black-box through the real `index.html` rather than constructing anything.

### constants.js

Every value more than one module needs: operand bounds, strength boundaries and
intervals, decay and selection tuning, the default tables and session lengths,
the eight regions,
star and gem tables, flame stages, card tiers, timings, the storage key, and the
keypad layout. Imports nothing and exports only frozen literals, so importing it
can never be order-dependent.

### facts.js

Builds the 36-fact set once at module load and owns the canonical id form
(`"<min>x<max>"`). Provides lookup, table-family and region filtering, and
`randomOrientation`, which decides whether a fact is shown as `3 × 8` or `8 × 3`.
Functions taking operands throw `RangeError` on bad input, because that is a
programming mistake; functions taking an id or a table list never throw, because
that input can come from a save file.

### MasteryModel.js

All per-fact record math: promotion and demotion, due dates, decay, mastery
tiers, card art tiers, and selection weight. A fact's memory is one integer
(a Leitner box, 0-5) and everything else in the game reads off it. Decay is
computed on read and never written back, so there is no background job.
`MasteryStore` wraps a record map and is the one deliberate mutator here -- see
the invariants below.

### FactSelector.js

Turns the per-fact numbers into an order: a re-ask queue for facts just missed,
then a 70/30 draw between a weak-or-due bucket and a strong bucket, then a
weighted pick inside the chosen bucket. Holds session state (last fact, question
index, retry queue) and nothing else. The rng-call count per path is documented
and fixed, which is what makes the selection testable.

### distractors.js

Builds the wrong answers on the tiles. `nearMissCandidates` is the pedagogy: a
deterministic list of plausible wrong answers, most confusable first -- adjacent
multiples, two steps out, digit slips, then adding instead of multiplying.
`generateOptions` shuffles the top of that list and drops the answer in at a
random position.

### Journey.js

The trail: 40 spaces, 8 regions, and the gates between them. Region ownership is
structural (a region owns the facts whose larger operand is its table), but
gating is scoped to the active fact pool, so a region with no facts in play is
skipped instead of blocking the way. Gates open on mastery, never on answer
count. The token never moves backwards, even though the unlock cap can shrink as
strength decays.

### Scoring.js

Stars, gems, the daily goal, and the streak calendar. Stars pay most for weak
facts and add a bonus for typed answers, then scale by the session streak.
Nothing in this module can lower a total: a wrong answer scores 0 rather than a
penalty, and gems are only ever added. The daily goal counts facts, not minutes.

### Settings.js

The three persisted settings (`tables`, `sessionLength`, `sound`) and everything
derived from them: the active fact pool, memoized, and `inputModeFor(strength)`,
which decides tiles versus keypad. Persisted input is
untrusted, so nothing throws -- a rejected update returns `false` and changes
nothing.

### storage.js

Extends `games/shared/StorageManager.js` and owns the persisted save shape.
`defaultProgress()` and `normalizeProgress()` are exported pure functions, so the
shape can be tested on its own and `game.js` can normalize an in-memory state
without a round trip. Every field is coerced rather than trusted and unknown keys
are dropped, which is how fields cut from the design disappear on load.

### modes/index.js

The registry that maps a mode id to the function behind it, so `game.js` can ask
for a challenge without importing a mode or branching on which one is active.
Adds nothing to a challenge and validates nothing -- the mode's own module is the
only authority on what it returns. An unknown mode id throws rather than falling
back.

### modes/quickRecall.js

`createChallenge(fact, settings, rng)` for the default mode: a prompt string, the
entry affordance, the tile options when there are any, the post-miss scaffold, and
a `check` closure. No DOM at all.

### modes/shared.js

`buildScaffold(a, b)`, the post-miss teaching array every mode returns. Rows are
always `min(a, b)` regardless of how the question was displayed, so the same fact
always teaches the same picture. Built from the displayed orientation instead,
`9 × 2` produced a nine-row array, the sentence "9 rows of 2 makes 18", and a
5450 ms wait instead of 2300 ms -- the worse explanation and the longer sit,
half the time at random. Imports nothing, so it sits beside `constants.js` at the
root of the graph and cannot create a cycle between modes. It has no test file of
its own: `quickRecall.test.js` and `modes.test.js` each assert the scaffold
contract through the mode that produced it, which is where a regression would
actually show up.

### GameUI.js

Extends `games/shared/BaseGameUI.js` and holds every DOM read and write in the
game. Takes plain view models built from already-decided numbers and contains no
game rules. Five base-class methods are overridden because the base behaviour is
wrong for this page: `showFeedback` and `hideFeedback` (the base destroys class
names and leaves stale text in an `aria-live` region), `showScreen` (the base
loses focus to `<body>`), `updateProgressBar` (the base leaves `aria-valuenow`
frozen), and `updateTitleButtons` (the base knows only Continue and Start Fresh,
and this game has a third save-dependent title button).

### Keypad.js

The twelve-key in-page numeric pad -- digits, clear, enter -- rendered with
`createElement` and `textContent`. It exists so iOS never has an input to focus
and never raises the system keyboard over the question. Owns a digit buffer,
reports it through `value` and `display`, and fires `onChange` on every accepted
press, which is the hook `game.js` uses to stamp thinking time. Also handles a
physical keyboard as an accessibility fallback.

### EventManager.js

Attaches every DOM listener and translates each event into a callback supplied by
`game.js`. Holds no state and no game logic, and never decides whether an answer
is right -- it reports the tapped value and the tapped element. It owns two
`document` key listeners: the `1`-`4` tile shortcuts, and `Escape` to close the
settings dialog. Digit, Enter, and Backspace handling belongs to `Keypad` and is
deliberately not duplicated; `Keypad` also owns `Escape` as clear-all, and the
two never collide because each bails in exactly the state the other acts in.

## Challenge contract

Every mode returns the same eleven keys, so `game.js` has no mode-specific branch
in its answer path:

| key        | meaning                                                   |
| ---------- | --------------------------------------------------------- |
| `modeId`   | The `MODE_IDS` value of the mode that built it            |
| `factId`   | Canonical fact id, e.g. `"6x7"`                           |
| `left`     | Left operand as displayed                                 |
| `right`    | Right operand as displayed                                |
| `answer`   | `left * right`                                            |
| `prompt`   | The question, ready to render                             |
| `entry`    | `"tiles" \| "keypad"` -- the one entry authority          |
| `options`  | `number[]` when `entry === "tiles"`, else `null`          |
| `visual`   | Mode-specific render data, discriminated by `visual.kind` |
| `check`    | `(input) => boolean` -- the one correctness authority     |
| `scaffold` | The post-miss teaching array                              |

`game.js` renders by `entry`, scores by `entry`, and decides correctness with
`check`. It never recomputes the entry mode and never compares an input to
`answer` itself -- the entry paths can deliver different types and only `check`
knows the difference. `Keypad` submits a `Number`, and so does a tile tap;
`check` also accepts a digit string, so a mode or a future entry path that
reports raw digits needs no special case at the call site.

## Data Flow

### The question loop

```
startSession(modeId)
   │  resets session state, selector.reset(), rebuilds Journey for the pool
   ▼
_askNextQuestion()
   │
   ├─► Settings.factPool ─────────► FactSelector.selectNext(pool, records)
   │                                        │
   │                                        ▼
   │                                    a factId
   │                                        │
   ├─► MasteryStore.strengthOf(factId) ─────┤  captured BEFORE the answer
   │                                        ▼
   ├─► modes/index.createChallenge(modeId, fact, {strength, inputModeFor}, rng)
   │                                        │
   │                                        ▼
   │                                   a Challenge
   │                                        │
   ├─► GameUI.renderQuestion(challenge) ────┤
   ├─► Keypad.setEnabled(entry === keypad)   │
   └─► session.askedAt = now()   ← stamped LAST, after the DOM is written
                                            │
                first tap / first digit
                                            │
                                            ▼
                            session.firstInteractionAt   (once)
                                            │
                                      tile tap or
                                      keypad enter
                                            ▼
                                   _handleAnswer(input)
                                            │
                                 challenge.check(input)
                            ┌───────────────┴───────────────┐
                       correct                            wrong
                            │                               │
        MasteryStore.apply(correct)          MasteryStore.apply(wrong)
        Scoring.starsForCorrect              FactSelector.recordMiss
        Journey.advance  ──► trail           reveal the product
        GameUI.flyStars                      GameUI.showScaffold
                            │                     + skip-count ticks
                            └───────────────┬───────────────┘
                                            ▼
                            Scoring.applyAnswer  ──► daily
                            Scoring.checkMilestones ──► gems
                            storage.saveProgress
                                            │
                                            ▼
                     20 answers?  ──no──►  _askNextQuestion()
                            │ yes
                            ▼
                     _finishSession()
             sessionsCompleted += 1, milestones, save,
             then build and render the summary view
```

### Sequence: user interaction

1. A tap or key reaches `EventManager` or `Keypad`.
2. That calls a callback defined in `game.js`.
3. `game.js` asks a pure module for the new value and assigns the result.
4. `game.js` calls `GameUI` methods with plain view models.
5. `GameUI` writes the DOM and reads nothing back.

## Two invariants

Both of these read exactly like working code when broken, which is why they are
recorded here.

1. **`progress.facts` and `store.records` are the same object.**
   `MasteryStore` aliases the map it is constructed with rather than copying it,
   so `store.apply()` is immediately visible to whatever gets saved. Nothing ever
   reassigns `this.progress.facts`; "start fresh" rebuilds the progress object and
   the store together, as a pair. Break the alias and spaced repetition, region
   unlocking, and persistence all read an empty map while the screen still looks
   correct.
2. **Every non-mutating call's return value must be assigned.**
   `Journey.advance`, `Journey.normalizeTrail`, `Scoring.applyAnswer`,
   `Scoring.rollDaily`, and `Scoring.checkMilestones` all return new values and
   touch nothing. A dropped return silently kills the feature:
   every answer still scores, and the token simply never moves.
   `store.apply()` is the one call that needs no assignment, per invariant 1.

## Testing

Tests live in the parent `__tests__/` directory -- 15 suites covering every
module except `modes/shared.js`, which is asserted through the two mode suites:

- `constants.test.js` -- the shared tables and their cross-checks
- `facts.test.js` -- the fact set, canonicalization, filtering
- `MasteryModel.test.js` -- strength, decay, due dates, `MasteryStore`
- `FactSelector.test.js` -- bucket draw, retry queue, rng-call contract
- `distractors.test.js` -- near-miss candidates and option generation
- `Journey.test.js` -- regions, gates, pool scoping, the advance cap
- `Scoring.test.js` -- stars, gems, daily goal, streak calendar
- `Settings.test.js` -- table toggles, fact pool, session length, entry mode
- `storage.test.js` -- save shape, normalization, load failures
- `quickRecall.test.js` -- the Quick Recall challenge
- `modes.test.js` -- the registry and dispatcher
- `Keypad.test.js` -- buffer transitions, rendering, keyboard fallback
- `GameUI.test.js` -- rendering, against the real `index.html`
- `EventManager.test.js` -- event routing, against the real `index.html`
- `game.test.js` -- the settings path and the session loop's entry points,
  driven black-box through the real `index.html`

`GameUI.test.js`, `EventManager.test.js`, and `game.test.js` read
`games/times-trail/index.html` from disk rather than hardcoding markup, so a
renamed id fails the tests instead of surfacing during manual play.

The shared base classes are tested separately in `games/shared/__tests__/`.

Run from the repository root:

```bash
npm test                                    # all tests
npm test -- --testPathPatterns times-trail  # just this game
```

## Design Principles

- **Injected `rng` and `now`, everywhere.** No pure module calls `Math.random` or
  `Date.now()` except as a default argument. Randomness and time come in through
  the constructor or the call, and each module documents how many `rng()` calls
  each path consumes, so a test can script an exact sequence.
- **Core logic never imports the UI.** No `document`, `window`, `localStorage`, or
  timer outside `game.js`, `GameUI.js`, and `Keypad.js`.
- **`GameUI` never imports a mode.** The UI layer cannot reach `Journey`,
  `Scoring`, `MasteryModel`, or `modes/`, so it cannot recompute what they
  decided.
- **One authority per decision.** `challenge.entry` decides the entry affordance
  and `challenge.check` decides correctness. Neither is ever recomputed at a call
  site, and no answer key is written into the markup.
- **One writer per DOM id.** The hub HUD and the play HUD, for instance, never
  write each other's counters.
- **Untrusted persisted data.** Every loaded field is coerced back into range and
  unknown keys are dropped, rather than trusted or rejected.
- **Nothing is ever taken away.** No score is subtracted, no currency is spent,
  and the trail token never moves backwards.

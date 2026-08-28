# Times Trail -- Design Plan

Status: **Phase 1 built.** The game lives at `games/times-trail/`. This document
is the design rationale behind it; the code is the source of truth for behavior.
Phase 2 (below) is not built.

Name is a placeholder. Alternatives considered: Factor Forest, Times Tower,
Product Park. Avoiding a third "Garden" after Number Garden and Life Garden.

## Purpose

Practice the core multiplication facts, **2x2 through 9x9**. That is the whole
scope -- not general math, and not tables 10 through 12.

Target learner: a 3rd grader who understands what multiplication means and has
2s through 5s solid, working through 6s to 9s. Difficulty must be configurable
so the same game works either side of that.

Primary device is an **iPad**. That is a design constraint, not a nice-to-have;
see [iPad constraints](#ipad-constraints).

Number Garden already has a multiplication area, but it is one stop on a
six-topic tour with deliberately small operands (2-5 times 1-10, rendered as
emoji groups). It teaches the concept. It does not build fact fluency, and it
has no idea which facts the player actually knows. That gap is what this game
fills.

## Core idea: one mastery engine, several modes

Every mode draws from the **same fact set** and **writes mastery back to the
same store**. A mode that cannot do both is decoration, and gets cut.

The modes are therefore not separate games -- they are different routes to the
same facts. Practicing 7x8 in the array builder makes it come up less often in
quick recall.

### Fact set

Operands 2-9 only: 64 ordered pairs. Canonicalize to `min x max`, so 7x8 and 8x7
share one mastery record, leaving **36 facts**. Both orientations are still
_shown_ (randomized), so commutativity gets exercised without doubling the
practice load.

36 is small enough to be **completable**, which is the point. A 78-fact set
(tables 1-12) is a slog with no visible end; 36 facts map onto an 8x8 grid a kid
can actually fill in.

x1 and x10 are rules, not facts, and are excluded rather than diluting the
grid with 17 gimmes.

Canonicalization is the one non-obvious modeling decision, and it is reversible
-- tracking the two orientations separately is defensible if she turns out to
know one direction and not the other.

### The facts that actually matter

Remove the pattern-based ones (x2 doubling, x5, the x9 trick, the squares) and
what is left is the real work:

**3x7, 3x8, 4x6, 4x7, 4x8, 6x7, 6x8, 7x8, 6x6, 7x7**

The journey is ordered to end in this neighborhood, and boss stops draw only
from this pool.

### Mastery model

Per-fact record: strength 0-5 (Leitner-style boxes), plus `lastSeen`, `streak`,
`totalSeen`, `totalCorrect`, and response time.

Response time is used, but not shown: correct-but-slow means she is counting up
rather than recalling, so it caps strength below mastered.

Response time is measured from when the question becomes interactive to her
**first** touch -- the first tile tap or the first keypad digit -- not to submit.
Measuring to submit would charge her for the motor time of typing, which made
mastery unreachable on the keypad path. Under 5 seconds is recall; over 9 is
counting.

Fact selection draws roughly 70% from due or weak facts and 30% from strong
ones, and never repeats a fact twice in a row. The 30% is a motivation
concession -- a session made only of what she cannot do is a session she will
not want to repeat.

Selection and mastery are pure functions over the saved record, so they are
straightforward to test without touching the DOM.

### Misses are where the teaching happens

On a wrong answer: no red buzz-and-move-on, and **no point loss**. Show the
scaffold for that specific fact -- the array lights up as 6 rows of 7 while the
skip-count ticks `7, 14, 21...` -- then re-ask the same fact three or four
questions later.

Skip-counting is therefore the built-in help system rather than a separate mode,
which is a better use of it.

## The question loop

Plain quick recall: `7 x 6 = ?`, one fact at a time, chosen by the engine. No
dice or card draw generating the question -- the fact selection is direct.

Answer entry adapts per fact:

- **Weak fact (strength 0-2)** -- four large multiple-choice tiles. Faster and
  kinder while a fact is new.
- **Strengthening fact (strength 3+)** -- typed on a **custom on-screen keypad**.
  Typing is the only honest signal of recall; multiple choice has a 25% guessing
  floor that muddies the mastery data.

The keypad is a 3x4 grid of big digit keys plus clear and enter, drawn in-page.
The iOS system keyboard is never invoked -- it eats half an iPad screen and
shifts the layout.

Distractors for multiple choice are chosen deliberately: near-misses in the same
table (`6x7` -> 36, 42, 48, 49), not random numbers. Random distractors make
wrong answers obvious without knowing the fact.

## Journey, points, and collection

These wrap the question loop; they are the reason to open the game again
tomorrow.

**The trail.** A winding path of 40 spaces across 8 regions, each region themed
on a table family. Your token advances one space per correct answer within a
session. Regions unlock on **mastery**, not on answer count, so the trail cannot
be walked by grinding 2x2 -- but the unlock only counts facts that are actually
in the current difficulty's pool, or a narrow custom setting would wall the token
off at space 4 forever.

A compact strip showing the current region and the token sits on the play screen
itself, so movement is visible where she is actually looking rather than only on
the trail screen. When the token is held at a gate, the game says what is needed
to open it ("master 2 more facts in Doubling Meadow") instead of silently
refusing to move.

**Stars** accumulate per session: a base amount per correct answer, more for
facts the engine considered weak, with a streak multiplier. Weighting by
weakness is what stops point-farming the easy facts.

**Gems** come from milestones and are permanent trophies -- they are never
spent, and **neither currency is ever subtracted**. Losing visible progress is
where kids quit. Spendable cosmetics (trail themes, token characters, card
backs) move to Phase 2: an unspendable currency next to a shop screen that does
nothing would be worse than shipping neither.

**The card collection** is the completion goal: 36 cards, one per canonical
fact, whose art strengthens as the fact does (grey -> colored -> foiled).
"Collect all 36" is a clearer finish line than a percentage.

**Daily goal** is 20 facts, with a lenient streak calendar. A missed day shrinks
the flame; it does not reset anything. The goal counts facts rather than minutes
because a minutes-based goal is satisfied by walking away from an open tab.

**Session shape:** 3-5 minutes, about 20 facts, ending at a trail stop with a
star tally and a card unlock. A visible finish line matters more than an
endless mode.

The mastery map -- an 8x8 grid, rows and columns 2-9, each cell lighting up as
that fact strengthens -- is the at-a-glance progress view, with the diagonal
(the squares) as its own small collection. Deliberately thinner than Number
Garden's project-piece and SVG-completion system; no reason to rebuild that
here.

## Modes

| Mode                | What she does                                              | What it builds                                    |
| ------------------- | ---------------------------------------------------------- | ------------------------------------------------- |
| **Quick Recall**    | `7 x 6 = ?`, tiles or keypad                               | Direct recall; the default loop                   |
| **Array Builder**   | Tap or step a rectangle of items to hit a target product   | The area model -- how to _derive_ an unknown fact |
| **Card Match**      | Tap to pair 6 fact cards with 6 product cards              | Recall backwards (given 42, find 6x7)             |
| **Story Problems**  | "6 baskets, 7 apples each" plus a picture                  | Recognizing when multiplication is the tool       |
| **Card Duel**       | Both sides flip a fact card; larger product wins the trick | The tough-dozen facts, under mild pressure        |
| **Product Grid**    | Slide two factor markers, claim the product, four in a row | Factor pairs, worked backwards from the product   |
| **Lightning Round** | Opt-in timed streak                                        | Speed, once she is already confident              |

**Mixed Practice** rotates modes every few questions inside one session, all
feeding one fact queue. Individual modes stay selectable from the hub, because
letting her pick matters for a kid who is being asked to practice.

Card Match is the best fit for touch of any mode here -- pure tapping, no
precision, and it drills the reverse direction that division readiness needs.

## Difficulty

Follows the Number Garden convention (`explorer` / `adventurer` / `master` in
`GameState`) plus a custom option:

- **Explorer** -- 2s through 5s; multiple choice throughout; array and
  skip-count scaffolds weighted up
- **Adventurer** -- 2s through 7s; the 3rd-grade default
- **Master** -- all 36 facts; keypad entry sooner
- **Custom** -- per-table checkboxes, to match whatever her class is on this
  week. Likely the most-used setting in practice.

<a id="ipad-constraints"></a>

## iPad constraints

Touch drives the design. Keyboard support stays as an accessibility fallback,
not the primary target.

- **Tap targets 64-72px** with 16px gaps. Apple's floor is 44pt; a kid on a
  moving iPad needs more.
- **No scrolling during a round.** Size the play area with `100dvh` -- iPad
  Safari's toolbars change the viewport height -- and lay out for both portrait
  and landscape from 1024x768 up.
- **Suppress browser gestures:** `touch-action: manipulation` (kills double-tap
  zoom), `-webkit-tap-highlight-color: transparent`, `user-select: none`,
  `overscroll-behavior: none` (kills rubber-band scroll).
- **No hover-only affordances.** Every control needs a visible `:active` press
  state; a tap that looks dead reads as broken.
- **Every drag has a tap alternative.** Array Builder resizes by tapping the
  far corner or using +/- steppers, never drag-only.
- **Never invoke the system keyboard.** Custom keypad only, as above.
- **Add to Home Screen:** a minimal `manifest.json` plus `apple-touch-icon` so
  it launches full-screen with no address bar. No game in the repo does this
  yet; it is cheap and makes it feel like an app.
- **Audio needs a first user gesture** to unlock on iOS. The "start" button is
  the unlock point, following Number Garden's `SoundManager` pattern.

## Structure

Mirrors `games/number-garden/`, reusing `games/shared/BaseGameUI` and
`games/shared/StorageManager`.

```
games/times-trail/
  index.html
  index.zh.json          Opts the page into the translation pipeline
  manifest.json          Add-to-home-screen
  README.md
  js/
    game.js              Orchestrator (untested -- DOM glue, per repo convention)
    facts.js             Fact set + canonicalization
    MasteryModel.js      Strength, decay, due calculation      <- core
    FactSelector.js      Picks the next fact                   <- core
    distractors.js       Near-miss wrong answers for tiles     <- core
    Journey.js           Trail spaces, regions, unlock gating  <- core
    Scoring.js           Stars, gems, streaks, daily goal      <- core
    Settings.js          Presets + custom table picker
    storage.js           Extends shared StorageManager
    GameUI.js            Extends shared BaseGameUI
    Keypad.js            On-screen numeric entry
    EventManager.js
    modes/               One file per mode; pure challenge generation
    constants.js
  styles/
    main.css
  __tests__/             One per module above
```

Each mode exposes `createChallenge(fact, settings, rng)` returning a plain
object with the prompt, visual data, and an answer check -- **no DOM**. Same
split that makes Number Garden's generators testable while its `game.js` is not.

Product Grid and Card Duel are where this abstraction bends: they are whole
board or match sessions rather than one fact at a time, so each runs its own
loop and reports mastery for the facts it happened to exercise.

## Phasing

**Phase 1** -- mastery engine over the 36-fact set, Quick Recall with adaptive
tiles-then-keypad entry, scaffolded miss handling, Array Builder, the trail with
region gating, stars and gems, the 36-card collection, the 8x8 mastery map, and
settings. A complete and enjoyable game on its own.

**Phase 2** -- Card Match, Card Duel boss stops, Product Grid, Story Problems,
Lightning Round.

Phase 1 is roughly Number Garden's scale minus the project-visuals system. It is
larger than a bare flashcard app on purpose: the trail and the collection are
the reason the game gets opened twice.

## Registration checklist

Root `index.html` links to `/games/` generically, so a new game needs entries
in:

- `games/index.html` -- add to the Available Games list
- `games/index.zh.json` -- add the tagline translation
- `games/README.md` -- add to the Available Games list
- `docs/development.md` -- add to the directory structure listing

## Open questions

1. **Pacing.** Working assumption: no timer anywhere by default, Lightning Round
   as the only opt-in timed mode, response time measured silently to inform
   mastery. Rationale is that timers tend to backfire on kids still building
   confidence. Not yet confirmed.

2. **Pass-and-play two-player** for Product Grid. A shared iPad is the ideal
   device for it, and it is the mode most likely to get opened for fun, but it
   is also the most engineering. Undecided; currently not in either phase.

3. **Parent progress view** -- the same 8x8 grid as a strong/shaky heatmap,
   showing which facts lag. Useful to an adult, invisible to the player.
   Undecided.

4. **Multiple profiles** on one device. Undecided; a single profile is assumed
   throughout.

5. **Sound and haptics.** Sound is planned. The Vibration API is not supported
   in iOS Safari, so haptics would be a no-op on the target device and are
   assumed out.

6. **Name.** Placeholder, see top. "Trail" now fits, since the journey stayed.

## Possible changes after first play

Notes from playing the built game on 2026-08-27. Anything marked **done** is in
the code; everything else is a proposal with its tradeoffs, not a commitment.

### Keypad only, no multiple choice -- **done, as a trial**

Every preset now has `keypadMinStrength: 0`, so the tiles never appear. Revert by
restoring 3 / 2 / 3 and `null` on Explorer; nothing else needs changing.

- **For:** typing is the only honest signal of recall, and the plan already said
  so -- tiles carry a 25% guessing floor that muddies the mastery data. One entry
  affordance instead of two, and the input no longer changes under the player
  mid-session. It also removes the keyboard ambiguity where `1`-`4` sometimes
  select and sometimes type, which is unfixable while tiles exist because the
  tile faces are themselves numbers.
- **Against:** a blank keypad on a brand-new fact has nothing to grab, where four
  tiles at least offer recognition. The counter-argument is that the miss path
  already handles not-knowing: wrong answer, then the array and skip-count teach
  that fact, then it returns a few questions later.
- **Still to delete if the trial sticks:** `distractors.js` and its tests, tile
  rendering and the freeze-and-reveal miss choreography in `GameUI`, the tile
  keyboard listener in `EventManager`, `SCORING.KEYPAD_BONUS` (a meaningless
  constant offset once every answer is typed), and `INPUT_MODE.TILES` itself.
  These are deliberately still in place so a revert stays a one-line change.
  Explorer's label lost "tiles only" but the preset still needs a new meaning.
- **Cost already paid:** two `Settings` tests lost their observable. Rounding and
  non-finite-to-0 in `inputModeFor` used to be visible through the tiles/keypad
  boundary; with every preset at 0 the return value cannot distinguish sanitised
  input from unsanitised. Marked `COVERAGE LOSS` in `Settings.test.js`.

### Cut Array Builder -- **done**

- **For:** the array scaffold in the miss path already teaches the area model, on
  the exact fact just missed, at the moment it is wanted. Array Builder does it
  on a random fact and takes about eleven stepper taps to build 6x7 before the
  Check button. The mastery it writes back is weak evidence -- stepping to a
  rectangle is not recall. By this plan's own rule that a mode earns its place by
  feeding the mastery engine meaningfully, it is the weakest thing in Phase 1.
- **Against:** deriving an unknown fact is the actual escape route for a kid
  stuck on 7x8, and no other mode practises it deliberately.
- **Knock-on:** with one mode left, the hub's "Choose a mode" screen has nothing
  to choose, so Start should go straight to practice. That is a simplification
  for a 3rd grader, not a loss. The mode registry stays -- Phase 2 has five modes
  queued behind it.

### Start straight into practice -- **done**

Play and Keep Going now start a session directly. The hub survives as the
progress and navigation screen -- stars, gems, streak, and the buttons for Trail,
Fact Map, and Cards -- rather than as a toll gate on the way in. Its heading
changed from "Choose a mode" to "Your progress" and it keeps one Practise button,
so it is still a place you can start from.

It also needed a third title-screen button, `#progress-button`. Without one the
only routes to the hub were finishing a session or tapping Back mid-round, and
Back always raises the "Leave this round?" confirm, because a session counts as
in progress from the moment question 1 renders. Looking at your own card
collection should not require abandoning a round. Like Continue and Start Fresh
it is hidden until a save exists.

### Themed trails instead of one trail with themed regions -- **open, and the most promising**

The region names promise something the game does not deliver. `REGIONS` gives a
region every canonical fact whose **larger** operand equals its table, so
Doubling Meadow owns exactly one fact, 2x2, and Dragon Peak owns eight. Worse,
fact selection ignores the token's position completely: standing in Doubling
Meadow you get asked 6x7. The names imply themed practice; the engine does
whole-pool practice. That is the incoherence, and renaming would only paper over
it.

Better: several short trails, each themed on a **pattern** rather than a table.
Doubles, Fives, Squares, Nines, and a final trail of what is left. The
decomposition is exact -- 36 facts, no gaps:

| Trail   | Facts | New | Notes                                            |
| ------- | ----- | --- | ------------------------------------------------ |
| Doubles | 8     | 8   | everything containing a 2                        |
| Fives   | 8     | 7   | 2x5 already a double                             |
| Squares | 8     | 6   | 2x2, 5x5 already counted                         |
| Nines   | 8     | 5   | 2x9, 5x9, 9x9 already counted                    |
| Tough   | 10    | 10  | 3x4, 3x6, 3x7, 3x8, 4x6, 4x7, 4x8, 6x7, 6x8, 7x8 |

- **For:** every name is true, and fact selection can be restricted to the
  trail's own set so the theme is real. Picking "Squares" is a meaningful, kid-legible
  choice in a way that picking "Quick Recall" over "Array Builder" never was, so
  this replaces the mode chooser rather than adding a screen. Trails of 8-10
  facts finish in a session or two instead of grinding 40 spaces. The overlap is
  a feature: mastering 5x5 advances both Fives and Squares, because the mastery
  record is per canonical fact and shared. And it structurally kills the
  token-frozen class of bug, since a gate over 8 facts is always reachable.
- **Against:** this is the largest change discussed and it lands on `Journey.js`,
  the core module with the subtlest logic and the most tests -- currently built
  around one 40-space trail with eight gated regions. Restricting selection to a
  trail also cuts against interleaving, which is what spaced repetition wants;
  the fix is to weight toward the current trail rather than restrict to it. A kid
  whose class is on "the 7 times table" still cannot pick that, though Custom
  difficulty covers it and table trails could be added later.
- **Unaffected:** the 8x8 fact map and the 36-card collection stay as the global
  completion view. Trails become routes through the set; the collection is the
  total.
- **Noticed while working this out:** `PATTERN_FREE_IDS` claims to be what is
  left after doubles, fives, the x9 trick and squares are removed, but it lists
  6x6 and 7x7, which are squares, and omits 3x4 and 3x6. The genuine leftover set
  is the ten in the table above. Either the name or the list is wrong.

### Centre the play area in landscape -- **done**

Landscape was a two-column grid with entry bottom-right ("under the right
thumb") and the left column reserved for the scaffold, so the keypad sat off to
the right during normal play and the "Yes!" rendered in the column opposite the
one being looked at. Portrait already centred.

Landscape is now a single centred column in every state, including while the
post-miss scaffold teaches. A first attempt gave the scaffold its own column, on
the theory that it was too tall to sit under the question; measuring the
stylesheet showed that was the wrong trade. The scaffold's widest row is its
skip-count strip -- nine chips at `min-width: 44px` plus eight 8px gaps, about
460px -- against a half-width column of roughly 480px on a 1024px-wide landscape
iPad, and less than 400px on a landscape phone. Wrapping that strip makes the
scaffold _taller_, which is the opposite of the goal.

What the height actually needed was less furniture, so `GameUI` now marks
`#play-area` with `.teaching` while the scaffold is up and the stylesheet uses it
to tighten row gaps and, below 820px of viewport height, shrink the array dots
and count chips. `showScaffold` also hides the keypad readout, which was still
displaying the digits of the miss -- a second, wrong answer sitting in the
player's eyeline beside an array teaching the right one.

Still worth a look on a real iPad: every number above is computed from the
stylesheet, not measured. jsdom has no layout, so no test in the repo can check
this.

### More reward for a correct answer -- **partly done**

`CORRECT_FEEDBACK_MS` was 450ms against a 600ms star animation, so the reward
outlived the window meant to show it. Now 700ms, with `WRONG_FEEDBACK_MS` raised
to 900ms to stay longer than a correct answer as intended.

Still open, in rough value order: make the trail token visibly hop on the
play-screen strip, since advancing is currently silent and the trail is the whole
progress metaphor; scale-pulse the correct answer; escalate the message at streak
milestones instead of always "Yes!".

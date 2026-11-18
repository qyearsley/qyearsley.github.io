# Times Trail -- Design Plan

Cut on 2026-09-26. The full history is in git:
`git show 1c19957:docs/times-trail-plan.md`.

Phase 1 shipped. Phase 2 (more modes) is not planned. The game lives at
`games/times-trail/`. The code is the source of truth for behavior; this doc
explains why it works this way.

## Purpose

Practice the core multiplication facts, 2x2 through 9x9 -- not general math,
and not tables 10 through 12. Target learner: a 3rd grader who understands
what multiplication means and has 2s through 5s solid, working through 6s to
9s. The primary device is an iPad; see [iPad constraints](#ipad-constraints).

Number Garden already has a multiplication area, but it's one stop on a
six-topic tour with small operands. It teaches the concept, but doesn't build
fact fluency or track which facts a player actually knows. This game fills
that gap.

## Core idea: one mastery engine

Every mode draws from the same fact set and writes mastery back to the same
store. A mode that can't do both is decoration and gets cut -- Array Builder
was cut for this reason: stepping to a rectangle isn't recall, so it fed the
mastery engine weak evidence.

**Fact set.** Operands 2-9 only, canonicalized to `min x max` so 7x8 and 8x7
share one record: 36 facts. Both orientations are still shown, so
commutativity gets exercised without doubling the practice load. x1 and x10
are excluded; they're rules, not facts.

**Mastery model.** Each fact has a strength from 0-5 (a Leitner box) and a due
date. A correct answer promotes one box; a miss demotes it, two boxes if the
fact was already mastered. Thinking time -- from the question appearing to the
first tap or keypress, not to submit -- caps how high a correct answer can
promote: correct-but-slow stays below "mastered," because counting up isn't
recall. Strength decays by one point per 14 days a fact stays overdue,
computed on read so there's no background job. Selection draws roughly 70%
from due or weak facts and 30% from strong ones, and never repeats a fact
twice in a row -- the 30% keeps a session from being only what the player
can't do.

**Misses teach.** A wrong answer shows the product, then the fact as an array
with the skip-count ticking through it, then re-asks the same fact a few
questions later. No points are ever lost on a miss.

## The question loop

One fact at a time: `7 x 6 = ?`. Answers are typed on a custom on-screen
keypad; there's no multiple-choice tile mode. Typing is the only entry mode
because it's the only honest signal of recall -- multiple choice has a 25%
guessing floor that would muddy the mastery data. The tile code and its
distractor logic were removed on 2026-10-05; git history has them.

The iOS system keyboard is never invoked; it eats half the screen and shifts
the layout.

## Journey, points, and collection

**Five themed trails**, each themed on a pattern rather than a table: Doubles,
Fives, Squares, Nines, and the Tough Ten (`3x4, 3x6, 3x7, 3x8, 4x6, 4x7, 4x8,
6x7, 6x8, 7x8` -- the ten facts with no shortcut). The sets overlap on purpose
(2x5 is a double and a five); mastery is tracked per fact and shared, so
progress on one trail can advance another. The hub is the list of trails;
tapping a row starts a round on it. A round asks all of that trail's facts
and only those, so every correct answer moves the token. The play screen has one
bar, the trail strip, plus a "Question 3 of 10" counter.

Every trail is 20 spaces long, so reaching the last space takes 19 correct
answers: two rounds of 10 if every answer is right, and a few if some are not.
The length is fixed rather than proportional to the fact count, so the 8-fact
and 10-fact trails take about as long, and 20 is what the strip has always
fitted. The token moves one space per correct answer and nothing gates it. The
hub shows each trail's strong facts ("3 of 8 strong") and the strength model
still picks which fact comes next, but strength never blocks movement, and the
round summary says "Trail finished" when the last space is reached.

History, because the same mistake is easy to repeat. The 40-space board with
eight table-named regions was cut on 2026-09-18: its names promised themed
practice that fact selection, which ignored the token's position, didn't
deliver. Its replacement capped the token at
`FREE_SPACES + SPACES_PER_STRONG_FACT * (strong facts)`, so grinding one easy
fact could not finish a trail. That cap was removed on 2026-11-18: strong needs
days of spaced repetition, so a new player stalled after about three correct
answers, and the token not moving was the original complaint. The same change
dropped the tables setting. A trail intersected with a narrowed table list could
shrink to one fact (Squares with only the 7s is just 7x7), asked ten times in a
round. A trail now always uses all of its own facts.

**Stars** pay more for facts the engine considers weak, with a streak
multiplier, so easy facts can't be farmed for points. **Gems** come from
milestones and are permanent; neither currency is ever spent or subtracted,
because losing visible progress is where kids quit.

**36 fact cards**, one per canonical fact, go grey -> colored -> foiled as the
fact strengthens. "Collect all 36" is the completion goal. An 8x8 mastery grid
(rows and columns 2-9) is the at-a-glance progress view.

**Daily goal** is 20 facts a day, with a lenient streak: one missed day dims
it, two or more resets it. **Sessions** are 10 (default), 20, or 30 questions,
ending with a summary of that session's stars, gems, and any new cards or
milestones.

## Modes and difficulty

Only **Quick Recall** (`7 x 6 = ?`) is built. Card Match, Story Problems, Card
Duel, Product Grid, and Lightning Round were designed for a Phase 2 that isn't
currently planned; see the game's README for what each would have done. The
mode registry (`js/modes/index.js`) still has just the one entry, so adding a
mode later doesn't require restructuring.

There are no difficulty presets and no table picker. Four presets used to exist
(Explorer, Adventurer, Master, Custom), retired because once every preset shared
the same keypad threshold, the only thing a preset changed was which tables were
in play. Eight table toggles replaced them, and those went on 2026-11-18, once a
trail began to use all of its own facts and nothing read the list. A `tables`
value in an old save is ignored on load. What's left is a questions-per-session
choice. Spaced repetition, not a difficulty knob, is what makes practice easier
or harder question by question.

<a id="ipad-constraints"></a>

## iPad constraints

Touch drives the design; keyboard support is an accessibility fallback, not
the primary target.

- Tap targets are 64-72px with 16px gaps -- bigger than Apple's 44pt floor,
  because a kid on a moving iPad needs more.
- The play area is sized with `100dvh` so Safari's toolbars can't cause
  scrolling mid-round.
- Double-tap zoom, tap highlight, text selection, and rubber-band scroll are
  all suppressed, and every control has a visible pressed state.
- The system keyboard is never invoked; see
  [The question loop](#the-question-loop).
- The page ships a `manifest.json` for Add to Home Screen. Its
  `apple-touch-icon` is an SVG, which iOS ignores, so the home-screen icon is a
  page snapshot, not a designed one.
- Audio needs a first user gesture to unlock on iOS. There's no sound yet, but
  a `sound` setting is persisted so a future sound pass needs no migration.

## Structure

Mirrors `games/number-garden/`, reusing `games/shared/BaseGameUI` and
`games/shared/StorageManager`. See `js/README.md` for the module-by-module
breakdown. Core modules: `facts.js` (fact set), `MasteryModel.js`
(strength/decay/due dates), `FactSelector.js` (picks the next fact),
`Journey.js` (a trail's facts and the token's steps), `Scoring.js` (stars/gems/streaks), and
`Settings.js` (session length and sound). `GameUI.js` and `EventManager.js`
handle the DOM; `game.js` is the untested orchestrator, by repo convention.
Each mode under `js/modes/` exposes `createChallenge(fact, settings, rng)` --
a plain object with no DOM -- which is what keeps the challenge logic
testable.

**Known gaps:** the trail token doesn't visibly hop when it advances, and
player profiles with per-player reaction-time stats are wanted but not
started -- both need a storage schema change, so they'd land together.

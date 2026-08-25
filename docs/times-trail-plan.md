# Times Trail -- Design Plan

Status: **planned, not built.** This is a design doc for a times-table practice
game to live at `games/times-trail/`, alongside Number Garden.

Name is a placeholder. Alternatives considered: Factor Forest, Times Tower,
Product Park. Avoiding a third "Garden" after Number Garden and Life Garden.

## Purpose

Practice multiplication facts. That is the whole scope -- not general math.

Target learner: a 3rd grader who understands what multiplication means and has
2s through 5s solid, working through 6s to 9s. Difficulty must be configurable
so the same game works either side of that.

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

Canonicalize to `min x max`, so 7x8 and 8x7 share one mastery record: 78 facts
for tables 1-12 rather than 144. Both orientations are still _shown_
(randomized), so commutativity gets exercised without doubling the practice
load.

This is the one non-obvious modeling decision, and it is reversible -- tracking
the two orientations separately is defensible if she turns out to know one
direction and not the other.

### Mastery model

Per-fact record: strength 0-5 (Leitner-style boxes), plus `lastSeen`, `streak`,
`totalSeen`, `totalCorrect`, and response time.

Response time is used, but not shown: correct-but-slow means she is counting up
rather than recalling, so it caps strength below mastered.

Fact selection draws roughly 70% from due or weak facts and 30% from strong
ones, and never repeats a fact twice in a row. The 30% is a motivation
concession -- a session made only of what she cannot do is a session she will
not want to repeat.

Selection and mastery are pure functions over the saved record, so they are
straightforward to test without touching the DOM.

## Modes

| Mode                  | What she does                                                                                 | What it builds                                     |
| --------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Quick Recall**      | `7 x 6 = ?`, multiple choice or typed                                                         | Direct recall; the engine's bread and butter       |
| **Array Builder**     | Resize a rectangle of items to hit a target product                                           | The area model -- how to _derive_ an unknown fact  |
| **Skip-Count Stones** | Fill the gap in `7, 14, __, 28`                                                               | The counting scaffold that makes facts retrievable |
| **Story Problems**    | "6 baskets, 7 apples each" plus a picture                                                     | Recognizing when multiplication is the tool        |
| **Product Grid**      | Slide two factor markers, claim the product, four in a row wins. Vs. computer or vs. a person | Factor pairs, worked backwards from the product    |
| **Lightning Round**   | Opt-in timed streak                                                                           | Speed, once she is already confident               |

**Mixed Practice** is the default and the point: it rotates modes every few
questions inside one session, all feeding one fact queue. Individual modes stay
selectable from the hub, because letting her pick matters for a kid who is being
asked to practice.

## Difficulty

Follows the Number Garden convention (`explorer` / `adventurer` / `master` in
`GameState`) plus a custom option:

- **Explorer** -- tables 1-5 and 10; multiple choice; array and skip-count
  weighted up
- **Adventurer** -- tables 1-10; the 3rd-grade default
- **Master** -- tables 1-12; typed answers
- **Custom** -- per-table checkboxes, to match whatever her class is on this
  week. Likely the most-used setting in practice.

## Progress and reward

The mastery map is the reward: a 12x12 grid where each fact lights up as it
strengthens, plus a badge per completed table.

Deliberately thinner than Number Garden's project-piece and SVG-completion
system -- no reason to rebuild that here.

A parent view shows the same grid as a strong/shaky heatmap. That is the part
that is useful to an adult rather than to the player.

## Structure

Mirrors `games/number-garden/`, reusing `games/shared/BaseGameUI` and
`games/shared/StorageManager`.

```
games/times-trail/
  index.html
  index.zh.json          Opts the page into the translation pipeline
  README.md
  js/
    game.js              Orchestrator (untested -- DOM glue, per repo convention)
    facts.js             Fact set + canonicalization
    MasteryModel.js      Strength, decay, due calculation      <- core
    FactSelector.js      Picks the next fact                   <- core
    Settings.js          Presets + custom table picker
    storage.js           Extends shared StorageManager
    GameUI.js            Extends shared BaseGameUI
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

Product Grid is the one place this abstraction bends: it is a whole board
session rather than one fact at a time, so it runs its own loop and reports
mastery for the facts it happened to exercise.

Keyboard operation throughout, including Array Builder -- arrow keys resize, not
drag-only. Drag-only would miss the accessibility bar the other pages hold.

## Phasing

**Phase 1** -- mastery engine, Quick Recall, Array Builder, Skip-Count, mastery
map, settings. A complete and useful game on its own.

**Phase 2** -- Product Grid, Story Problems, Lightning Round, parent heatmap
view. Mostly additive once the mode contract exists.

Phase 1 is the larger chunk: roughly Number Garden's scale minus the
project-visuals system.

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

2. **Phase 1 scope.** Three modes as listed, or cut Skip-Count and pull Product
   Grid forward? Product Grid is the mode most likely to make her want to open
   the game unprompted, but it is also the most engineering (opponent logic,
   board state, win detection) and the loosest fit for the mode contract.

3. **Name.** Placeholder, see top.

# Seasons -- Design Notes

Living notes for `games/seasons/`. The README describes what the game **is** and
how to change it; this file holds what is **not settled**: the decisions that are
Ella's to make, the direction the next phase is heading, work that is designed but
not yet built, and the polish that was consciously deferred rather than missed.

Kept out of the README on purpose. That file is documentation and should stay
true; this one is allowed to speculate.

## Where it stands

Playable end to end. Four seasons, four characters, a trail of obstacles with a
crossing animation, collectibles shown as items, a snake woman who is making a
potion, and a season that ends the moment she has been answered.

Every rule Ella has decided is implemented. Nothing is behind a switch any more:
the two undecided rule switches were settled on 2026-09-21 and deleted along with
every option behind them.

## Redesign of 2026-09-21: retry, shorter seasons, no losing

**Built.** This section is the design record for what shipped, kept because the
reasoning is worth more than the diff. It came from Ella playing the previous
build and saying two things: you keep walking after the jar is already full, and a
level takes too long. Four changes follow from that, and they settled both open
rule switches.

One thing came out of building it that the design did not foresee. The question
key was `seed:seasonId:attempt:questionsAsked`, and a wrong answer still counts
against `questionsAsked` — so a reload part-way through a retry handed back a
different question from the one on screen. The key is now
`seed:seasonId:attempt:position:extrasDone`: keyed on _where she is standing_,
which does not move during a retry. See
[`js/README.md`](../games/seasons/js/README.md#where-a-question-comes-from).

The four are one change, not four. Removing the item penalty makes a finished
trail yield a fixed number of items, which is what lets the demand line up
exactly, which is what makes the trail safe to shorten.

A whole run went from 72 questions to 42.

### 1. A wrong answer costs questions, not items

The per-space loop, replacing `RULES.WRONG_ANSWER` and every option of it:

| Step                           | What the player sees                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| Wrong answer                   | "Not quite — have another look." That choice is struck off. The same question stays. |
| The answer is **not** revealed | Ella's rule: make the student find it.                                               |
| Right at last                  | A reinforcement card, then a "Got it" button.                                        |
| One more question              | Same obstacle, worth no items.                                                       |
| Right                          | The item, and the crossing.                                                          |

A mistake costs about two extra questions. Cap it at one extra question per
obstacle, however many tries the first question took, so a bad space cannot
spiral. If the extra question is also missed, it retries and reinforces but adds
no second extra.

Three consequences worth knowing before building it:

- **Three wrong taps leave one choice, which is the answer.** Accepted. It is
  the Phoenix's hint, earned the hard way.
- **The reinforcement card takes over the teaching the wrong-answer flash does
  today.** That flash is the only reason a tap cannot skip ahead after a wrong
  answer, so that rule in `js/game.js` can go.
- **A timeout is still a wrong answer** and takes the same path, which is the
  property worth keeping from the current design. **This is why the retry is
  untimed.** Caught while critiquing the plan rather than while playing it: a
  clock on the retry would time the same question out again, forever, for exactly
  the child who could not answer it in time. `questionSeconds` returns `null`
  while `retrying`, which is also the only thing in the design that guarantees a
  season makes progress.

### 2. The reinforcement card

Shown once the missed question is answered right. The equation in full, large,
and a picture under it when one fits:

| Question          | Picture                                           |
| ----------------- | ------------------------------------------------- |
| `6 × 7`           | a 6 × 7 grid of dots                              |
| `56 ÷ 8`          | 56 dots in 8 groups                               |
| `8 + 7`, `15 − 9` | two ten-frames                                    |
| `6 × 80`          | the related fact: `6 × 8 = 48`, so `6 × 80 = 480` |
| `8 × 7 + 9`       | the two steps written out                         |

**Built as a third export on the challenge module**, `explain(question)`,
returning a described model rather than a drawing. `GameUI` draws the model
kinds it knows and falls back to the bare equation for anything else. The
alternative — `GameUI` reading `question.parts` — widens the leak that
`js/README.md` already documents at `state.question?.answer`.

The card is an outcome payload, not a phase: `outcome.reinforce` carries the
explanation and nothing UI-shaped lands in the save file. It waits for its button
rather than a timer, which is the one screen in the game that does.

### 3. Seasons lined up, and about 40% shorter

Every glowing space is worth 3 to every character, so a finished trail always
yields the same total. Demand is that total plus the boss's rescue, which makes
her question the one that fills the jar.

|        | Spaces | Glowing | Trail items | Rescue | Demand | Questions |
| ------ | ------ | ------- | ----------- | ------ | ------ | --------- |
| Spring | 8      | 2       | 12          | +3     | 15     | 9         |
| Summer | 9      | 2       | 13          | +4     | 17     | 10        |
| Autumn | 10     | 3       | 16          | +5     | 21     | 11        |
| Winter | 11     | 3       | 17          | +6     | 23     | 12        |

42 questions for a clean run, against 72 today. Every escalation invariant in
`seasons.test.js` still holds: the trail does not shorten, the glowing count does
not fall, the demand rises strictly, and each rescue stays under its demand.

The reachability test inverts. `demand ≤ 0.75 × maxItems` for every character
becomes `demand === maxItems(season) + season.boss.rescue`, and `maxItems` loses
its `glowingItems` parameter because no character varies it any more.

Move `demandText` with the demand — it spells the number out.

### 4. The roster

Every perk is free now. There is no economy left to charge a cost against.

|             | Perk                                                                |
| ----------- | ------------------------------------------------------------------- |
| Banana Slug | **Slow and Steady** — no countdown, ever, even with the timer on    |
| Sloth       | **Takes His Time** — 10 extra seconds on every timed question       |
| Phoenix     | **Rising Again** — once a season, a mistake hides two wrong choices |
| Porcupine   | **Bounce Back** — after a mistake, no extra question                |

The Phoenix's hint fires on the first retry of the season, so it needs no button.
`hintsPerSeason` is the new field; `penaltyScale`, `forgivenessPerSeason`,
`comebackBonus` and `glowingItems` all went.

"Two wrong choices disappear" needed one adjustment to survive contact with the
screen. Read literally against four buttons it leaves the answer standing alone —
the player has already struck one off by pressing it. So the perk is expressed as
`HINT_CHOICES_LEFT = 2` and `GameUI.hintTargets` works out the removals from what
is still live, which leaves a straight fifty-fifty and still asks her to choose.

**Open, and Ella's.** The countdown is off by default, so the Slug and the Sloth
both do nothing unless a player turns it on, and they sit on the same axis. The
alternative is to give the Slug a second always-on perk — two hints a season
against the Phoenix's one.

### 5. Finishing a season, and finishing the game

Ella asked for a small bursting effect and a character that jumps.

- **Season complete.** A burst of the season's items scattering outward, the
  character drawn mid-jump beside the jar, and the haul arcing in. CSS keyframes,
  so `prefers-reduced-motion` covers it for free — the same split the weather and
  the item pips already use.
- **The finale.** A large drawing of the snake woman looking happy beside the
  finished flask. `villain()` takes a `happy` argument; the current drawing is
  already pleased rather than threatening, so this is a wider smile and a raised
  arm rather than a new character.

### What got deleted

The run can no longer be lost, because her question retries like any other. That
removed more code than it added:

| Gone                                                         | Where                                   |
| ------------------------------------------------------------ | --------------------------------------- |
| `WRONG_ANSWER`, all three options, and `_applyPenalty`       | `constants.js`, `GameState.js`          |
| `BOSS_FAILURE`, all three options, and `BOSS_TRIES`          | `constants.js`, `GameState.js`          |
| `wilting`, `lost`, `runOver`, `retry()`, `PHASE.SEASON_LOST` | `GameState.js`, `storage.js`, `game.js` |
| The "Not quite enough" screen and `?phase=lost`              | `game.js`                               |
| Wilt pips and the wilt note                                  | `GameUI.js`, `main.css`                 |

Nine source files and nine test suites. Git keeps anything that turns out to be
wanted.

One thing survived the cull that looks like it should not have: `attempt`, in the
question key. It is always 0, because nothing replays a season. It stays because a
season picker is the one feature that would need it, and
`GameState.test.js › startSeason's attempt counter` covers the capability so it
cannot rot.

### What this decides against

The 2026-09-18 note below recommends the **early finish** over the shorter trail,
on the grounds that cutting spaces takes the recovery margin away from everybody.
That reasoning depended on a wrong answer costing an item. It no longer does, so
there is no margin to protect and no reason to keep walking after the jar is
full. Read that section as a record of the measurement, not as the current plan.

## Open questions for Ella

Roughly in order of how much each would change the game. Questions 1 and 3 are
answered by the redesign above and are kept here for the reasoning only.

1. ~~**What is the Porcupine's power?**~~ **Answered 2026-09-21, and built:**
   after a mistake, no extra question. The whole roster was rebuilt around time
   and hints at the same time, because with no penalty left to scale there was
   nothing for the old perks to act on — and because a perk that changes an item
   count cannot exist once the demand is met exactly.

2. **What is the snake woman called?** She has a personality, a witch's hat, a
   potion in her hand, and no name.

3. ~~**What should a wrong answer cost?**~~ **Answered 2026-09-21, and built:**
   nothing. You retry the question, then answer one more. The three options that
   were on the table are gone from the code along with the switch:
   - `GENTLE` -- nothing happens, the question just changes
   - `WILT` -- your last item wilts and comes back if the next answer is right;
     two wrong in a row and the first is gone
   - `STEP_BACK` -- you move back a space and lose an item outright

   None was played. The retry rule answers the question all three were asking —
   what a mistake should teach — in a way none of them did: the answer is not
   stated, she has to find it, and then the card shows her why.

4. **Does she ever give anything back?** Right now she only collects. This is the
   hook for the next phase -- see below.

5. **What other obstacles are there?** Six exist (hill, river, thicket, boulder,
   gap, mountain). "Add or change an obstacle" in the README is a followable
   recipe. Kinds she has mentioned that do not exist yet: forest as distinct from
   thicket, and anything weather-shaped.

## How long a season is, and whether it can end early

**Superseded 2026-09-21** by the redesign above, which shortens the trail
instead. Kept for the measurement.

Asked 2026-09-18: should a season be shorter, or should it be possible to go to
the snake woman as soon as the demand is met? Measured before answering, against
`main`, by walking each route and adding one item per ordinary space and three
per glowing one:

| Season | Spaces | Demand | Max items | Demand met at | Spaces after |
| ------ | ------ | ------ | --------- | ------------- | ------------ |
| Spring | 14     | 11     | 18        | space 9       | 5            |
| Summer | 16     | 13     | 22        | space 9       | 7            |
| Autumn | 18     | 15     | 26        | space 11      | 7            |
| Winter | 20     | 17     | 30        | space 12      | 8            |

So a full run is 72 questions plus four boss questions, and on a perfect run the
jar is full about 60% of the way along every trail. The remaining spaces are not
decoration — they are the margin that lets a wrong answer cost an item without
losing the season — but a player who is not making mistakes spends a third of
every season collecting things she demonstrably does not need.

**The recommendation is the early finish, not the shorter trail**, and the
difference matters. Cutting spaces takes the margin away from everybody,
including the player who needs it, and it means retuning `demand` for all four
seasons. An early finish takes length away only from the player who has earned
it: answer accurately and the season is 9 questions, make mistakes and you get
the whole trail to recover on. Accuracy becomes the lever on length, which is
the right thing for a practice game to reward.

Shape, if it goes ahead:

- Offer it, never force it. When `countingItems(state) >= season.demand` on the
  trail, the demand bar gets a "She has enough — go to her?" button. Walking on
  stays available, because more items are still a buffer against the boss.
- Judge it on **counting** items, not `items`. Wilting items are written off at
  `_resolveSeason`, so offering the finish to a player holding two wilting items
  would offer her a season she then loses.
- It needs one new phase transition in `GameState.js` and a button in the trail
  HUD. `bossPosition(season)` already exists and `_resolveSeason` already judges
  the demand independently of where the token stopped, so the state machine is
  mostly ready for this.

What it costs: the boss stops being a real test. A player who skips forward with
the demand already met cannot fail — a missed boss question costs nothing beyond
the rescue it did not award. That is close to true today for anyone who reaches
the boss with a full jar, so this makes an existing softness visible rather than
introducing one. If the boss should be able to bite, that is a separate rule
question and it is Ella's.

**Still Ella's call**, like the season picker below: it changes what finishing a
season means.

## Difficulty: retuned 2026-08-31

Implemented. Kept here because the reasoning is a design record rather than
documentation, and because what is still open at the end of it is Ella's to
decide. The README's [Difficulty](../games/seasons/README.md#difficulty) table
describes the result from the outside.

**The problem, from sampling 4,000 generated questions per form list.** Three
findings, all now fixed:

1. **Every glowing space and every boss was the easiest question in the game.**
   Division quotients ran at a median of 6 in all four seasons, so autumn's
   ordinary space asked `311 - 195` while its lit mountain — the special
   challenge, worth three items — asked `14 ÷ 7`.
2. **The curve was not monotonic.** Autumn was the hardest season, not winter:
   autumn's ordinary answers ran to a median of 111, winter's to 57. Nothing
   caught it because `seasons.test.js` pinned the route, demand, glowing count,
   timer and `boss.rescue` — but never the maths.
3. **Two forms were above grade level.** `4 × 17` is 4.NBT.B.5, and three-digit
   addition with carrying is column work. Meanwhile one grade-3 standard went
   unused: one-digit × a multiple of ten.

**What the retune did.** Escalate by **number of mental steps**, not by digit
count. No column operation past two digits, every individual fact inside 100, and
the ladder climbs from one fact, to a fact plus a regrouping, to a fact scaled by
ten, to two chained operations. `9 × 80` is fine — what is banned is column work,
not large answers.

`seasons.test.js` now holds the ladder two ways, and the split matters. A
**structural score** over the form declarations catches a season losing a mental
step; it deliberately ignores answer size, so it would _not_ have caught finding 2
— by step count, old winter did out-score old autumn. That class of fault is
prevented by the `max: 100` cap instead. Finding 1 is caught by a second set of
tests that **sample what the generator actually emits**, because the fault lived in
the generator rather than the declaration.

Three things Ella's rules did not settle, now decided:

- **Division is a one-directional rule.** It must not appear in ordinary `forms`;
  a hard slot is free to ask something else. Winter's does.
- **A boss may be structurally different** from the glowing spaces.
- **Three-digit subtraction is out of scope**, along with anything wanting
  written column work. The game is for third grade and assumes mental
  computation.

**Two ideas that were tried and rejected**, both worth not re-deriving:

- **A new `mulTen` form kind.** Unnecessary — `mul` already means "one operand
  from `tables`, the other 2..upTo", so `{tables: [10, 20, ...90], upTo: 9}`
  produces exactly the same distribution. Measured identical over 20,000 seeds.
- **A two-step ending in division, `7 × 6 ÷ 3`**, as winter's climax. It looked
  like the answer to finding 1, and it is not grade 3. Enumerating all 141
  possible questions for the 6–9 tables: **39% need a grade-4 division step**
  (`6 × 7 ÷ 3` is `42 ÷ 3 = 14`, a two-digit quotient, which is 4.NBT.B.6).
  Constrain the answer to a single digit so both steps are facts and only **18 of
  the 86 survivors are genuinely two-step** — the rest are cancellations like
  `7 × 7 ÷ 7`, solved in one step. Eighteen questions is a set a child memorises.
  The existing `twoStep` (`8 × 7 + 9`) does the same job, is already implemented,
  and is grade 3's own two-step standard.

**Also fixed, in `arithmetic.js`.** All found by measurement, all independent of
the season numbers:

- **The hard slots were still asking easy questions after the retune.** Narrowing
  a season's `tables` looked like a difficulty rise but did nothing to the answer:
  `_div` drew its quotient from 2 upward whatever the tables said, so a third of
  every draw was a ÷2 or ÷3 fact and autumn's boss asked `12 ÷ 6 = 2`. `div` and
  `twoStep` now take a `from` floor, and every hard slot sets one. This was
  finding 1 surviving its own fix, and it is the reason the difficulty tests
  sample generated output as well as scoring the declarations — a structural score
  reads the form's shape, and `from` does not change the shape.
- **The last question of the game could be `8 × 2 + 3`.** `twoStep`'s second
  operand had no floor either, and its second step could wipe the multiplication
  out entirely: `6 × 3 - 17 = 1`. The addend is now capped at half the product.
- **The answer was always the second-smallest of the four buttons.** In 100% of
  questions in the game, so tapping the second-smallest won every one without
  doing any arithmetic. Every slip distance is believable in both directions, so
  filling the choice list in order of temptingness always gave one value below the
  answer and two above; `rng.shuffle` hid it, because shuffling changes where a
  button sits on screen and not how the four values sort. `_choices` now draws how
  many distractors sit below the answer, which spreads the rank evenly. This was
  the worst defect found, it predates the retune, and no test came close to it —
  the existing one checked shuffled _position_, never sorted _rank_.
- **The distractors gave the game away in two smaller ways too.** Above
  `BIG_ANSWER` the candidate list offered `answer × 2`, always the largest button;
  and the answer's digits reversed was offered as a last resort, which put 61 among
  the multiples of forty for `40 × 4`. Generators now hand back their operands and
  the distractors come from slipping one of them by one step, so every button is
  reachable: `4 × 80` offers 240 and 400 (the 4 misremembered) and 280 and 360
  (the 80 misremembered). The digit reversal is gone entirely — transposing digits
  is a slip you make while writing, and nothing is written in this game.
- **`_add`'s tens split was asymmetric**, so all the leftover magnitude landed in
  the second operand. Both branches draw a total and divide it now. Note this
  fixed the lopsidedness, not the ability of a large `max` to put a three-digit
  number in one slot — that is within what `max` promises, and no season asks for
  `max` above 100 any more.
- **A form with a very large finite `max` hung.** Above 2^53 the gap between
  representable numbers exceeds the padding step, so `pad + 1 === pad` and the
  choice-filling loop spun forever. Unreachable from any real season, but a hang
  is not an acceptable failure mode, so the step grows until it moves.

**The cost of the `from` floors is pool size.** Division within 100 has only so
many hard facts, so autumn's boss is down to 20 distinct questions and spring's
glowing spaces to 21. With `RETRY_SEASON` as the default a child who fails a season repeatedly will
see repeats. Judged acceptable — a boss is met once per attempt — and pinned at 15
by `draws from a pool worth replaying` so it cannot quietly shrink further. Widen
`tables` before lowering `from` if a slot starts feeling stale.

### Eased after the first real play, 2026-09-01

The retune above was tuned on measurements; this is what changed once someone
actually played it. Both are worth keeping separate — the numbers were right
about the _shape_ of the ladder and wrong about its absolute level.

- **The clock was the thing making questions fail**, not the arithmetic. 20/18/16s
  has to cover reading the question, working it out and reading four options.
  Now 30/28/25s. It still tightens across the year; it is just no longer the
  binding constraint.
- **Winter was too hard.** Its ordinary spaces were the 6–9 facts with no easy
  ones at all, so there was never a breather, and its tens ran to `9 × 80`. Now
  the 4 table is back on the trail and the tens stop at 70. Autumn gets the 2
  table back and gentler hard slots; summer only loses a notch on its boss.
- **The structural score did not catch any of this**, and could not: it measures
  the shape of the ladder, not whether the whole thing sits too high. Worth
  remembering before trusting it over a play session.

### Still open, and Ella's to decide

- **Is a lit mountain still "the division one"?** Winter's now asks `8 × 7 + 9`
  half the time, because by winter a single division fact within 100 is easier
  than its ordinary spaces. Consistent with the decision above, but it changes
  what reaching a mountain means, which is her rule rather than a tuning number.
- **Should spring stay untimed** now the ladder is gentler? Keeping it untimed is
  the zero-churn option — `seasons.test.js` names spring as the one season allowed
  to be untimed. Less pressing since the countdown became a setting: a player who
  finds spring's clock unfair can switch every clock off.
- **The autumn→winter step is the thinnest one.** Both seasons ask hard facts,
  regrouping subtraction and a multiple of ten; winter differs by narrowing the
  facts to 6–9 and widening the tens to 90. The rest of its escalation is carried
  by the clock, the demand and the hard slots. That is coherent with "escalate on
  every axis at once", but it is the place to look first if winter does not feel
  like a step up.
- **`mul`'s `twoDigit` option is now unused** by every season. It is a real
  capability rather than dead code, but nothing exercises it in the game.

## Next direction: NPCs, items and trading

The idea, in Ella's words: some obstacles may be people rather than terrain, and
some of those may trade things or talk.

**Why this fits.** The collectibles already have a cost -- the snake woman's
quota -- so an NPC who trades creates a real decision rather than a new currency:
spend two roses on something now, or keep them for her. That makes the quota
matter more instead of diluting it, and it is built from parts that already work.

**What the route model already allows.** A route entry is a bare kind string
today, and `js/Journey.js` normalises it. An entry like
`{ kind: "npc", who: "badger" }` extends that without touching the save format,
because the trail is always derived from the season rather than stored. What
would have to learn the new shape: `js/obstacles.js`, and the art pack.

**What it would genuinely add**, and why it is the largest piece so far:

- An inventory, which is new state -- currently a run holds counts, not a list of
  things
- NPC memory: have I met this one, have I already traded with it
- Dialogue, which is the first text in the game that is neither a question nor a
  one-line verdict
- A reason for each item to exist beyond the quota

**Open design questions**, all Ella's:

- Is an NPC an obstacle you must get past, or a choice you can walk by?
- Does trading cost collectibles, or something else?
- What is worth buying? A hint, a shield against one wrong answer, a shortcut
  past an obstacle, or something with no mechanical effect at all
- Can an NPC be unfriendly, now that the snake woman is not?

## Art

Hand-coded SVG for now, with PNG sprite sheets left open. The seam is built for
it: `traversal()` lives in the art pack alongside the drawings, so a sprite pack
can swap frames where this one arcs a transform, and `layout()` hands over the
token scale and boss placement so nothing outside the pack knows how the art is
drawn. `art.test.js` holds the contract a replacement must satisfy.

Sources under consideration: AI-generated SVG, CC0 vector packs
(game-icons.net is SVG), and hand-coding. The placeholder pack is deliberately
geometric -- the bar it clears is "clearly a porcupine and not embarrassing".

Note the repo convention this would break: `favicon.ico` is currently the only
non-text file in the whole repository, and there are no runtime dependencies.
Binary sprite assets would be the first exception, so it is a deliberate call
rather than an incidental one.

## Deferred polish

Judged not to stand between Ella and a good first play, in rough value order.
Most of this list was cleared on 2026-08-31; what is left is below the done ones.

- ~~**The countdown cannot be switched off.**~~ **Done**, 2026-09-05, and
  **turned off by default** on 2026-09-18. A gear in the top bar opens a dialog
  with one checkbox. It came from a real play session: the countdown was
  intimidating, which is a different complaint from "the questions are too
  hard" and wanted a different answer. The maths is unchanged; only the race is
  gone. Two details cost more
  thought than the switch did — the dialog stops the clock while it is open, so
  a question cannot expire behind the thing you opened to stop it; and "start
  over" keeps the preference, because erasing a journey is not the same as
  overruling a player. Flipping the default cost one thing, knowingly: a save
  written before the key existed now loads untimed, where it used to load
  timed. A save that had ticked the box carries a literal `true` and keeps it.
  Written up in the game's own README, since it is a feature rather than a plan.
- **A season picker.** Still open, and the half of "nothing frames four seasons"
  that was not done: the character screen now shows which seasons are open, but
  there is no way to _choose_ one. Whether she can replay a finished season, or
  jump to one she has unlocked, is a rule question rather than a display one —
  it is Ella's call, and it changes what a run means. The `?season=` URL added
  for debugging is deliberately **not** this: it skips the rule question by not
  saving, which is fine for an adult checking the art and wrong as a game
  mechanic.
- ~~**Little on the trail moves except the character and the weather.**~~
  **Done**, 2026-09-18. The animal, the snake woman, the river and the thicket
  all move now, and the predicted shapes were right:
  - ~~**An idle bob or breathe on the character and on the snake woman.**~~
    **Done.** It is an **optional** thirteenth export, `idle(subjectId)`, and it
    did need the third nested `<g>` — JS owns `.trail-token`'s transform, the
    group inside carries the pack's `scale`, and a CSS transform replaces a
    transform attribute rather than composing with it. The return value is a
    motion name rather than a transform, matching `AIR_ART`: the pack says
    `"breathe"`, `"bob"` or `"sway"` and main.css supplies it, so no rule in the
    stylesheet names an animal. A pack that omits `idle` renders exactly as
    before, which is what keeps the required contract at twelve names. The snake
    woman comes through the same call under the reserved id `"villain"`.
  - ~~**Falling snow, and autumn leaves to match.**~~ **Done**, 2026-09-05, and
    the predicted shape is what it turned out to be: `AIR_ART` tags each mark
    with a `motion`, `backdrop` writes it out as `air-fall` or `air-drift`, and
    `main.css` animates whatever carries the class. Both halves of the earlier
    note were slightly wrong. Autumn was never without weather — it has had
    leaves in the air layer all along; what neither season had was motion. And
    the tag names the _behaviour_ rather than the thing, which is what keeps the
    stylesheet's "no rule names a season" rule intact. Two details worth
    keeping: each mark is wrapped in its own group, because spring's petals and
    autumn's leaves already carry a `transform` for their tilt and a CSS
    transform on the same element would replace it; and both ends of the fall
    keyframe are transparent, which is what makes the loop seamless.
  - ~~**Water shimmer on the river, and a slight thicket sway.**~~ **Done**, and
    it was the same mechanism as the flakes — so much so that it needed no
    GameUI change at all. `backdrop` already writes its own `air-mark
air-<motion>` class, so `obstacle` does the same with `obs-mark
obs-<motion>` through a small `_moving` helper. Two details worth keeping:
    only the river's two white highlights shimmer, not the water body, because
    the body carries the outline and an animated edge reads as the bank moving;
    and the thicket's three canopies each get their own phase, because in
    lockstep they read as one bush sliding sideways.
- ~~**Item pips do not pop in when earned.**~~ **Done**, 2026-09-18, and the
  earlier note was wrong about the cost. It said this needed a state change to
  tell the UI which pip is new. It does not: what is new is a fact about the
  previous _render_, not about the game, so `renderItemTrack` remembers the
  count it last drew and which season it drew it for. Only pips past that count
  carry `is-new`. Nothing pops on the first draw of a season, so a reloaded save
  does not fire seven at once; nothing pops when the count falls; and a revived
  wilting item does pop, which is the moment the wilt rule pays off.
- ~~**Two characters did not stand on the ground.**~~ **Done**, 2026-08-31. The
  token is placed so that drawing y=91 lands on the trail. The banana slug
  stopped at y=78, so the one animal in the roster that is nothing but underside
  floated nine units above it; the phoenix's tail plumes reached y=96 and were
  buried five units into the earth. Both were shifted in their own boxes rather
  than rescaled, since `tokenScale` is shared by all four. The phoenix now clears
  the ground by two units, which is the one character that should.
- ~~**The snake woman had a snake's head.**~~ **Done**, 2026-08-31. She is a
  witch from the waist up now: human face, pointed hat, violet robe, and the
  potion she is making held out in one hand. The coils stayed, because they are
  what make her a snake woman rather than a generic witch. Her head is
  deliberately oversized — the demand-bar portrait is 62px, which puts the face
  at about 18px, and at that size the brows do more work than the eyes.
- ~~**The sloth walked with its arms in the air.**~~ **Done**, 2026-08-31, and it
  changed the contract: `character(id, onTrail)` picks a pose now rather than
  filtering out shapes tagged `data-hangs-from`. A subtractive flag was never
  going to survive a pack backed by images, where a pose is a different frame.
- ~~**The porcupine's quills started in mid-air.**~~ **Done**, 2026-08-31. The
  fan was generated from a circle and the body is a much flatter ellipse, so a
  radius short enough to bury the quills over the flanks cleared the spine. Both
  ends of each quill come off the body's own ellipse now.
- ~~**Crossings cornered at the apex.**~~ **Done**, 2026-09-01. Each crossing was
  three to six keyframes, and the browser joins keyframes with straight lines —
  so a jump traced a triangle rather than an arc and turned through 73 degrees in
  a single step at the top. The single `ease-in-out` across the whole animation
  made it worse by running the character _fastest_ at the apex, which is
  backwards. The path is now described as a function — a projectile arc, with an
  optional dwell at the top and per-kind squash — and sampled into 24 keyframes,
  with `easing: "linear"` because the timing lives in the samples. Largest turn
  drops from 73 degrees to 9. The two sharp corners left are the river's
  touchdown between hops and the mountain's summit, both intended and both across
  steps of a few pixels.
- ~~**Crossings ended flat.**~~ **Done**, 2026-08-31. Every traversal lands on a
  squash sized to how far the animal fell, then a clean final frame. The clean
  frame was a bug as much as a polish item: crossings play with
  `fill: "forwards"`, and the gap used to finish on `scaleY(0.9)`, so the
  character stood 10% short for the whole of the next question.
- ~~**The result screen is a table.**~~ **Done.** The season screen now draws the
  haul going into the snake woman's jar: one collectible per item delivered,
  dropped in on a stagger, captioned "11 roses into her jar". The jar is CSS and
  the items come from the art pack, so a new pack changes what is inside without
  owning the container. Deliberately not shown on the end-of-run screen — every
  per-season counter on the state belongs to the last season played, and there is
  no lifetime item count to draw instead.
- ~~**Nothing frames that there are four seasons.**~~ **Partly done**, see the
  picker above. The top bar now reads "Autumn — 3 of 4", and the character screen
  carries a "Your journey" panel listing all four with the unlocked ones marked.
- ~~**Item pips are small.**~~ **Done.** 19px to 26px, via a `--sn-pip` variable
  so the short-viewport rule can drop it back to 22px — seventeen slots at the
  full size wrapped to a third row and pushed the keypad off a short iPad.
- ~~**Lifetime totals are recorded and never shown.**~~ **Done.** They read as a
  sentence at the foot of the character screen, and are left off entirely until a
  question has been answered, since four zeros on a first run read as a report
  card rather than a start.
- ~~**~2s between questions.**~~ **Done, for correct answers only.** A tap now
  cuts the flash short as well as the crossing. It deliberately does not skip the
  flash after a _wrong_ answer: that flash is carrying the line saying what the
  answer actually was, which is the one part of the loop that teaches.
- ~~**Winter is the least distinctive season.**~~ **Done.** Rebuilt on value
  rather than hue — a saturated sky, ridges darker than it, and snow as the
  lightest ground of the four — plus snow on all six obstacle kinds and falling
  flakes in the backdrop. The warm glow stayed warm: white was invisible on the
  old near-white sky and would be lost in the snow now.
- ~~**`obstacles.verb`** is defined and unread.~~ **Done.** The trail's
  accessible label now reads "a thicket to push through" rather than "a thicket
  to cross". The field moved from third person to the infinitive, since the label
  describes what is still ahead; third person is derivable from that and not the
  other way round.

## Known gaps

Honest limitations rather than things to fix soon.

- **Screen readers are out of scope**, by decision. The countdown is
  `aria-hidden`, so a screen-reader user gets no warning that time is running
  out. It can now be switched off entirely — see the settings section of the
  README — which makes the timed seasons playable, but the announcement is
  still missing. The contrast work, the answer glyphs and the focus handling
  were kept because they help everyone -- colour-blindness is a real bet on a
  shared classroom iPad.
- **`min-height: 100dvh` is a floor, not a ceiling.** The play screen fits an iPad
  in landscape, which is the case that matters, but a short enough viewport can
  still overflow.
- ~~**Two ceilings are conventions, not tests.**~~ **Closed**, 2026-08-31. Two
  untested conventions — a two-digit product within 100, and addition and
  subtraction within a few hundred — were replaced by one rule that is now a test:
  no column operation past two digits, and every individual fact inside 100. See
  `seasons.test.js › keeps every individual fact inside 100`.

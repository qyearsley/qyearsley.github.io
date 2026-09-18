# Seasons -- Design Notes

Living notes for `games/seasons/`. The README describes what the game **is** and
how to change it; this file holds what is **not settled**: the decisions that are
Ella's to make, the direction the next phase is heading, work that is designed but
not yet built, and the polish that was consciously deferred rather than missed.

Kept out of the README on purpose. That file is documentation and should stay
true; this one is allowed to speculate.

## Where it stands

Playable end to end. Four seasons, four characters, a trail of obstacles with a
crossing animation, collectibles shown as items, a boss with two tries, and a
snake woman who is making a potion.

Every rule Ella has decided is implemented. The two she has not are switches in
`js/constants.js` with every option built and tested.

## Open questions for Ella

Roughly in order of how much each would change the game.

1. **What is the Porcupine's power?** The other three animals each change a rule:
   the Banana Slug is immune to wrong answers but collects less from a glowing
   space, the Sloth gets more time, the Phoenix gets one free mistake a season.
   The Porcupine's "next right answer after a wrong one is worth double" is a
   placeholder to keep the slot playable. Replacing it is one entry in
   `js/characters.js` as long as it reuses an existing effect field.

2. **What is the snake woman called?** She has a personality, a witch's hat, a
   potion in her hand, and no name.

3. **What should a wrong answer cost?** `RULES.WRONG_ANSWER`, currently `WILT`.
   - `GENTLE` -- nothing happens, the question just changes
   - `WILT` -- your last item wilts and comes back if the next answer is right;
     two wrong in a row and the first is gone
   - `STEP_BACK` -- you move back a space and lose an item outright

   Worth playing all three before deciding. Flipping one is a one-line edit; a
   handful of tests pin copy specific to the active rule and would need a look.

4. **Does she ever give anything back?** Right now she only collects. This is the
   hook for the next phase -- see below.

5. **What other obstacles are there?** Six exist (hill, river, thicket, boulder,
   gap, mountain). "Add or change an obstacle" in the README is a followable
   recipe. Kinds she has mentioned that do not exist yet: forest as distinct from
   thicket, and anything weather-shaped.

## How long a season is, and whether it can end early

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

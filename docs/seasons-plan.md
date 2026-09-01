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
many hard facts, so autumn's boss is down to 16 distinct questions and summer's to 20. With `RETRY_SEASON` as the default a child who fails a season repeatedly will
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
  to be untimed.
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

- **A season picker.** Still open, and the half of "nothing frames four seasons"
  that was not done: the character screen now shows which seasons are open, but
  there is no way to _choose_ one. Whether she can replay a finished season, or
  jump to one she has unlocked, is a rule question rather than a display one —
  it is Ella's call, and it changes what a run means. The `?season=` URL added
  for debugging is deliberately **not** this: it skips the rule question by not
  saving, which is fine for an adult checking the art and wrong as a game
  mechanic.
- **Nothing on the trail moves except the character.** Between questions the
  scene is completely still: the animal is a static shape, the river does not
  run, the thicket does not stir, and winter's snow is drawn as a field of
  circles that never fall. Reviewed 2026-08-31 and deliberately left, because
  each piece needs a decision about _where_ the motion lives rather than just
  some keyframes:
  - **An idle bob or breathe on the character and on the snake woman.** Not
    simply a CSS rule: JS owns `.trail-token`'s transform and the group inside it
    already carries the pack's `scale`, so this needs a third nested `<g>`. And
    ownership is the real question — motion belongs to the art pack, which owns
    `traversal()` for exactly this reason, so the shape is probably an
    **optional** twelfth export, `idle(characterId)`, that GameUI uses if the
    pack offers one. Optional keeps the required contract at eleven names, and a
    sprite pack returns frame swaps where this one returns a transform.
  - **Falling snow, and autumn leaves to match.** Winter has weather and autumn
    has none. The per-flake stagger can come from index arithmetic exactly as the
    positions already do, so [the no-randomness rule](../games/seasons/js/README.md#purity)
    holds. A pack cannot ship CSS, so the likely shape is that the pack tags its
    own shapes (`class="snow-flake"`) and the stylesheet animates whatever
    carries the tag. That is a mild widening of the seam — a class-name
    convention between pack and stylesheet — but it means the universal
    `prefers-reduced-motion` rule covers all of it for free. SMIL inside the
    drawing would be self-contained and needs no convention, but it ignores
    reduced motion entirely, which is the wrong trade for this game.
  - **Water shimmer on the river, and a slight thicket sway.** Same mechanism as
    the flakes, so same decision.
- **Item pips do not pop in when earned.** `renderItemTrack` rebuilds every pip
  on every render, so a CSS animation replays across the whole row each time.
  Doing it properly means telling the UI which pip is new, which is a state
  change rather than a display one.
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
  `aria-hidden` and there is no way to extend or switch off a time limit, so
  three of the four seasons are effectively unplayable that way. The contrast
  work, the answer glyphs and the focus handling were kept because they help
  everyone -- colour-blindness is a real bet on a shared classroom iPad.
- **`min-height: 100dvh` is a floor, not a ceiling.** The play screen fits an iPad
  in landscape, which is the case that matters, but a short enough viewport can
  still overflow.
- ~~**Two ceilings are conventions, not tests.**~~ **Closed**, 2026-08-31. Two
  untested conventions — a two-digit product within 100, and addition and
  subtraction within a few hundred — were replaced by one rule that is now a test:
  no column operation past two digits, and every individual fact inside 100. See
  `seasons.test.js › keeps every individual fact inside 100`.

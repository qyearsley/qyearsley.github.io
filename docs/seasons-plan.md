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

## Difficulty: a retune that is planned but not done

Reviewed 2026-08-31 by sampling 4,000 generated questions per form list per
season. Nothing here is implemented; the numbers below describe the game as it
ships today. The README's [Difficulty](../games/seasons/README.md#difficulty)
table describes the same thing from the outside and will need rewriting with it.

**Three things Ella's rules did not settle, now decided.**

- **Division only appears in the hard slots.** It does not have to _be_ the hard
  question. Ella's rule was "division as the hardest one in a level", which the
  code reads as "glowing spaces and bosses ask division"; the constraint is
  really one-directional — division must not appear in ordinary `forms`, which
  `seasons.test.js` already enforces — and a hard slot may ask something else.
- **A boss may be structurally different** from the glowing spaces if there is a
  good question idea for it; otherwise the same kind of question at higher stakes
  is fine.
- **Three-digit subtraction is out of scope.** So is anything else that wants
  written column work: the game is for third grade, assumes mental computation
  with no pen and paper, and exists to solidify what is taught in school rather
  than to stretch past it.

### What the sampling found

1. **Every glowing space and every boss is the easiest question in the game.**
   Division quotients run at a median of 6 and a maximum of 12 in all four
   seasons. So autumn's ordinary space asks `311 - 195` and its lit mountain —
   the special challenge, worth three items — asks `14 ÷ 7`. Reserving division
   for the hard slots inverted the intent, because small-fact division is not
   hard.
2. **The boss asks nothing new.** Spring's `boss.forms` is identical to its
   `glowingForms`; autumn's and winter's differ by one table. Only summer narrows
   meaningfully, to the 6–9 facts.
3. **The curve is not monotonic — autumn is the hardest season, not winter.**
   Ordinary answers: autumn median 112, p90 323, 66% regrouping, 18s. Winter
   median 57, p90 299, 33% regrouping, 16s. Winter swapped autumn's `add: 400`
   for `twoStep` (small products) and caps `mul` at 5×20, so the season whose
   demand line is "This is the hard part" is arithmetically lighter than the one
   before it. Nothing caught this because `seasons.test.js`'s
   `difficulty escalation` block pins the route, demand, glowing count, timer and
   `boss.rescue` — but never the maths.
4. **Two current forms are above grade level**, on the Common Core grade-3
   standards (3.OA.C.7 multiply and divide within 100, 3.NBT.A.3 multiply
   one-digit by multiples of 10, 3.OA.D.8 two-step problems). Autumn's and
   winter's `mul` with `twoDigit: true` gives `4 × 17`, which is 4.NBT.B.5 —
   grade **4**. Three-digit addition with carrying (`145 + 129`) is column work
   for the same reason three-digit subtraction is.
5. **One grade-3 standard is unused**: one-digit × a multiple of ten (`6 × 40`).
   It is on-grade, purely mental, drills place value, and produces large answers
   with no column arithmetic — which is exactly the job `4 × 17` was doing
   illegitimately.
6. **Fact fluency is a minority of the questions**, at roughly a third of
   ordinary spaces. For a game whose purpose is consolidating grade 3, × and ÷
   facts within 100 should be the bulk of it.

### The principle to retune on

Escalate by **number of mental steps**, not by digit count. No single column
operation goes past two digits; every individual fact stays inside 100; the
ladder climbs from one fact, to a fact plus a regrouping, to a fact scaled by
ten, to two chained operations.

| Season       | Ordinary spaces                                                             | Measured median / p90 / max |
| ------------ | --------------------------------------------------------------------------- | --------------------------- |
| Spring, none | 2-digit ± within 100, no forced regrouping; ×2 ×3 ×4 ×5 ×10                 | 36 / 94 / 100               |
| Summer, 20s  | all facts to 10×10; 2-digit ± within 100 with regrouping                    | 42 / 82 / 100               |
| Autumn, 18s  | the harder facts (3 4 6 7 8 9); 2-digit − with regrouping; × multiple of 10 | 49 / 360 / 810              |
| Winter, 16s  | two-step (`8 × 7 + 9`); the 6–9 facts; × multiple of 10                     | 56 / 360 / 810              |

Zero three-digit operands anywhere in that table. The proposed form lists, which
produced those figures:

```js
spring:  [{ kind: "add", max: 100 },
          { kind: "sub", max: 100 },
          { kind: "mul", tables: [2, 3, 4, 5, 10], upTo: 10 }]
summer:  [{ kind: "mul", tables: [2,3,4,5,6,7,8,9,10], upTo: 10 },
          { kind: "add", max: 100, borrow: true },
          { kind: "sub", max: 100, borrow: true }]
autumn:  [{ kind: "mul", tables: [3, 4, 6, 7, 8, 9], upTo: 10 },
          { kind: "sub", max: 100, borrow: true },
          { kind: "mulTen", tables: [2..9], tensUpTo: 9 }]        // new kind
winter:  [{ kind: "twoStep", tables: [3, 4, 6, 7, 8, 9], upTo: 10, max: 100 },
          { kind: "mul", tables: [6, 7, 8, 9], upTo: 10 },
          { kind: "mulTen", tables: [2..9], tensUpTo: 9 }]        // new kind
```

Note that subtraction stops escalating after summer, on purpose: two-digit
regrouping is the mental ceiling, so once a season has it there is nowhere
on-grade left to go, and the escalation moves to multiplication and then to
chaining. Spring's demand line and the `demandText` numbers do not move — none of
this touches `route`, `demand`, `timerSeconds` or `boss.rescue`, so the whole
`difficulty escalation` suite should still pass unchanged.

### The glowing slots and the boss

Division stays within 100, so plain division cannot carry a season's peak — which
is finding 1 restated. The idea that works is a **two-step ending in division**,
`7 × 6 ÷ 3`: it is grade 3's two-step standard, every fact stays inside 100, and
it is a real climax rather than a rerun of the spaces leading up to it. That is
the structurally-different boss the decision above allows.

Careful with the generator: the divisor has to be drawn from the **factors of the
product**, not from a fixed list. A first sketch of this drew from `[2,3,4,6,8]`
and emitted `5 × 5 ÷ 2 = 13`, which is not an exact division — and `_div`'s whole
approach is to build from the product so a remainder is impossible.

### Two bugs in `arithmetic.js`, worth fixing first

Both are self-contained in that file, need no season retune, and are verified.

- **`_add`'s tens split is asymmetric.** `tensA` is capped at half the available
  room and `tensB` gets whatever is left, so all the leftover magnitude lands in
  the second operand. Summer's `{kind: "add", max: 200, borrow: true}` produces a
  three-digit operand in **28.8%** of questions, `5 + 195` among them. The sum
  respects `max`, so this is not a bound violation — it is a shape the form did
  not ask for, and the README describes it as "addition within 200 with
  regrouping".
- **The distractor floor tracks answer magnitude, not difficulty.** Above
  `BIG_ANSWER` (100), `_candidates` puts `answer * 2` third, and `_choices` takes
  the first three — so `574 - 38 = 536` offers `[526, 546, 1072, 536]` and nobody
  picks 1072. That question is effectively one-in-three. Meanwhile `313 - 268 =
45`, one of the hardest questions the game can ask, gets tight near-miss
  distractors because its _answer_ is small. Replacing the scaled candidates with
  slips that are believable in column arithmetic — off by 100, off by 20, one
  digit transposed — makes the hard questions honestly one-in-four without
  touching a single season number. Measured share of distractors close enough
  that estimating cannot eliminate them, today: spring 84%, summer 71%, autumn
  58%, winter 50%.

### Order of work

1. The two `arithmetic.js` bugs. Independent of everything else. Expect
   `arithmetic.test.js` to need a look — it parses every generated prompt and
   recomputes it, and separately checks each generator against its form's `max`.
2. The two new form kinds, `mulTen` and the two-step-ending-in-division. Each
   needs an entry in `GENERATORS`, a line in the `arithmetic.js` header's kind
   list, and prompt-parsing support in `arithmetic.test.js`.
3. The season retune above, plus the README's difficulty table and the ceiling
   note in `seasons.js`'s header, which currently cites "autumn's 400 and
   winter's 600".
4. A coarse per-season difficulty score asserted to rise spring→winter, and
   "a season's glowing forms are at least as hard as its ordinary forms".
   Deliberately coarse: it should catch an inversion like finding 3 without
   freezing the tuning.

Still open: whether spring should stay untimed once the ladder is gentler, and
whether the two-step-ending-in-division belongs in the glowing spaces as well as
the boss or only at the boss.

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
  it is Ella's call, and it changes what a run means.
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
- **Two ceilings are conventions, not tests.** Two-digit multiplication stays
  within a product of 100, and addition and subtraction within a few hundred.
  Nothing enforces either; a retune could quietly cross both. Both ceilings are
  superseded by the retune above, which replaces them with a single rule — no
  column operation past two digits — and proposes the test that would hold it.

# Seasons

A journey through four seasons. You choose an animal, walk a trail, and answer
maths questions to gather what a snake woman needs for her potion — roses in
spring, diamonds in summer, leaves in autumn, icicles in winter. She is not a
threat; the snake lady is actually nice and is using the things to help making a
potion, and she gives you a quest to test you. Get a question right and you
collect something and move on; get one wrong and the active wrong-answer rule
decides what it costs, which by default is recoverable.

The game is Ella's idea, and this is the foundation for it rather than the
finished thing — so the docs are organised around
[how to change it](#how-to-change-things).
[`js/README.md`](js/README.md) covers how the code is put together.

## How it plays

**Choose an animal.** Four of them, and the choice matters — each one changes a
rule rather than just the picture:

|             | Perk                                                     | Cost                                         |
| ----------- | -------------------------------------------------------- | -------------------------------------------- |
| Banana Slug | Wrong answers never take anything away                   | Glowing challenges give 2 instead of 3       |
| Sloth       | 10 extra seconds on every timed question                 | —                                            |
| Phoenix     | Once a season, a wrong answer costs nothing              | Every other wrong answer hurts twice as much |
| Porcupine   | The first right answer after a wrong one is worth double | —                                            |

**Walk the trail.** Every space is an **obstacle** — a hill, a river, a thicket,
a boulder, a gap, or a mountain — and the question is how you get past it. A
correct answer collects an item and plays the crossing: the character climbs,
hops the stones, or leaps, and the camera pans along, because the trail is drawn
much wider than the screen. Tap anywhere to cut a crossing short. The
**mountains** are the **glowing spaces** — the season's hardest question, lit up,
worth three items instead of one, tagged "Glowing challenge" on screen.

**Face the boss.** At the end of the trail the snake woman is waiting with one
last question — the hardest thing the season asks, which is division in spring
through autumn and a two-step by winter — worth a block of items (3 in spring,
rising to 6 in winter), which is how a run that fell a little short can still make
the demand. The label says what it is worth before
you answer it. Missing it is not the end: `BOSS_TRIES` in
[`js/constants.js`](js/constants.js) is 2, so a wrong boss answer says "One more
go!", draws a fresh question, and lets you try again — Ella's rule, "if you miss
the boss question you get a chance to go back and try again." A miss also costs
nothing at all, so it can close a gap but never open one. Only running out of
tries _and_ still being short hands over to `RULES.BOSS_FAILURE` below.

Replaying a lost season gives different questions rather than the same twenty
again: the attempt number is folded into the question seed. Seasons get harder
in both directions at once — the maths steps up _and_ the clock tightens, the
demand rises, and more of the trail glows.

## Two rules that are not decided yet

Ella has not settled these, so the game implements every option and each is one
constant away in `RULES` in [`js/constants.js`](js/constants.js). This section
is the canonical description of what each option does; the code comments point
back here, and
[the recipe](#change-what-a-wrong-answer-costs-or-what-a-missed-boss-costs)
covers switching one.

**`RULES.WRONG_ANSWER`** — what a wrong answer costs:

- `GENTLE` — nothing. You stay put and the question changes. Good for a bad
  day, or a younger player.
- `WILT` — **the current default.** Your most recent item wilts: it stops
  counting toward the demand, but the _next_ correct answer revives it. Two
  wrong answers in a row and the first one is gone for good. Visible,
  recoverable, and it still stings.
- `STEP_BACK` — you move back a space and lose an item outright.

**`RULES.BOSS_FAILURE`** — what happens when the demand is missed, and every
boss try has been used up too:

- `RETRY_SEASON` — **the current default.** The season restarts, with fresh
  questions.
- `ALWAYS_PASS` — you continue with fewer items banked and an unbothered snake
  woman. No frustration, and no tension either.
- `END_RUN` — the whole run ends and you start from spring.

## Difficulty

Pitched at third grade. If it is wrong, [`js/seasons.js`](js/seasons.js) is the
only file to change — it holds every difficulty number in the game.

**One rule keeps it mental.** No single column operation goes past two digits,
and every individual fact stays inside 100. The answer has to be found _and_ four
choices read before the countdown ends, so anything wanting written vertical
maths is not something this format can fairly ask.

**Addition and subtraction are recall, not calculation.** Every add and sub form
stays inside 18 — the addition-facts table and its inverses, `8 + 7` and
`15 − 9`. They used to run to `max: 100`, which let even spring ask `47 + 45`,
and from summer on the `borrow` flag made two-digit regrouping a third of every
ordinary space. That was column work in your head against a clock, and it was
the hardest thing in the game, in the one operation meant to be the breather
between the times tables. A `min` floor keeps the easy end honest: without it,
"inside 18" would offer `2 + 3` as readily as `9 + 8`.

Escalation therefore lives entirely in **multiplication and division**: one
fact, then the whole table, then a fact scaled by ten, then two chained
operations. Answers still get large — `9 × 80` is on grade and purely mental —
because what is banned is column work, not size.

**The route model.** A season's trail is one array: `route`, holding one obstacle
kind per space, in order. Its length _is_ the trail length, and the mountains in
it _are_ the glowing spaces — `spaces` and `glowingAt` are derived from the route
when the module loads, never written by hand. So the **Trail** and **Glowing**
columns below are two readings of the same array, and tuning how many hard spaces
a season has means placing that many mountains. The kinds are listed in
[`js/obstacles.js`](js/obstacles.js), where `hard` is a property of the _kind_
rather than of the space; the mountain is the only kind that carries it.

|        | Ordinary spaces                        | Glowing spaces           | Boss         | Timer | Trail | Glowing | Demand |
| ------ | -------------------------------------- | ------------------------ | ------------ | ----- | ----- | ------- | ------ |
| Spring | + and − facts 6–18, ×2 ×3 ×4 ×5 ×10    | `40 ÷ 5`                 | `35 ÷ 5`     | none  | 14    | 2       | 11     |
| Summer | × facts to 10×10, + and − facts 11–18  | `48 ÷ 6`                 | `72 ÷ 9`     | 30s   | 16    | 3       | 13     |
| Autumn | ×2 3 4 6 7 8 9, − facts 11–18, × 10–50 | `54 ÷ 9`                 | `56 ÷ 8`     | 28s   | 18    | 4       | 15     |
| Winter | ×4 6 7 8 9, − facts 11–18, × 10–70     | `8 × 7 + 9`, or `63 ÷ 9` | `8 × 9 - 17` | 25s   | 20    | 5       | 17     |

**The clock is deliberately loose.** It was 20/18/16s, and played that way the
countdown rather than the arithmetic was what made a question fail — a timer has
to cover reading the question, working it out, _and_ reading four options. It
still tightens across the year, because that is part of the escalation, but it is
now slack enough that running out means the fact was not known.

Every hard slot carries a `from` floor on its quotient, which is what stops it
asking `12 ÷ 6`; see [Change the maths](#change-the-maths). Subtraction stops
escalating after summer on purpose: the regrouping fact — `15 − 8` — is the
mental ceiling for a single subtraction, so once a season has it there is nowhere
on-grade left to go, and the escalation moves to multiplication and then to
chaining. Winter is the one season whose lit mountains are not simply division —
by then a single division fact within 100 is easier than its ordinary spaces, so
its climax is the two-step.

Demands are tuned against the **Banana Slug**, who collects 2 from a glowing
space rather than 3, because her handicap grows with the number of glowing spaces
and that number grows every season. Each demand sits near 68% of a perfect run
for her and 57–61% for everyone else, so the ratio eases slightly across the year
while the demand _number_ rises — escalation should come from harder maths and a
tighter clock, not from needing a higher hit rate as well.
[Retuning](#retune-a-seasons-difficulty) has the invariant the tests hold this to.

## Graphics

Undecided, and deliberately isolated rather than deferred. Everything visible —
the season palettes, the trail's geometry, the motion of each crossing — comes from
an **art pack** in [`js/art/`](js/art/), and no other module knows what anything
looks like. The current pack draws flat vector shapes in code: clearly a
porcupine, not meant to be final. Contract in
[`js/README.md`](js/README.md#art--art), recipe at
[Replace the art](#replace-the-art).

Three things about the landscape are worth knowing before touching it, because
each is a place where a change that looks harmless is not:

- **The backdrop is four layers, not one picture.** `backdrop()` returns a stack
  — sky, far ridge, near ridge, and the air the weather falls through — and each
  says how fast it pans as a fraction of the ground's own scroll: 0, 0.25, 0.55,
  0.85. `GameUI` moves each by `offset × factor`, so the horizon falls behind
  the trail instead of sliding along with it. Every layer is generated at the
  trail's full width, which is what guarantees no gap opens at either end; the
  arithmetic is on `backdrop` in
  [`js/art/placeholder.js`](js/art/placeholder.js) and `art.test.js` checks it
  at both ends of winter's twenty-space trail.
- **The ground has a top edge made of something.** `layout()` returns
  `groundEdges` beside `groundSegments`: a band of grass, fallen leaves or snow
  crust whose underside is the ground line sample for sample, so it follows a
  river basin down and stops at the lip of a gap rather than floating over
  either.
- **Nothing is scattered at random.** The snow, blossom, leaves and heat haze
  are all placed by arithmetic with coprime moduli, because the scene is rebuilt
  whenever the season or character changes and a backdrop dealt afresh each time
  would flicker. Nothing in this game calls `Math.random`.

Motion is the pack's too, including what to do about it. `traversal()` is the
full crossing and `reducedTraversal()` is the plain slide a player who has asked
for less motion gets instead — 240ms, straight line, no arc and no squash. That
used to be no crossing at all, which meant the trail's main piece of feedback
silently stopped happening for anyone with the system setting on.

## Answer input

Four choice buttons, not a keypad. Times Trail rejected multiple choice because a
one-in-four guess corrupts its per-fact mastery data — but Seasons has no mastery
model, it is an adventure, and large tap targets suit a shared iPad. Revisit this
if Seasons ever grows one.

Distractors are near misses rather than random numbers, because a random
distractor is trivially eliminated and teaches nothing. Each generator hands back
the operands it used, and the distractors come from **slipping one of them by one
step** — so `4 × 80` offers 240 and 400 (the 4 misremembered) and 280 and 360 (the
80 misremembered), and every button is a number a child could actually arrive at.
Addition and subtraction slip by a whole ten, which is what a dropped carry looks
like; small answers get the plain near misses, `± 1` to `± 3`, since an
operand-sized slip means nothing at that size. Both thresholds (`SLIP_FROM` at 20,
`BIG_ANSWER` at 100) exist because the alternative gave the question away — "6 ÷ 2"
offering 13 and 1 beside the answer 3.

**How many distractors sit below the answer is drawn at random, and that matters
more than any of the above.** Every distance is believable in both directions, so
filling the list in order of temptingness produced `answer + d`, `answer − d`,
`answer + d2` — one below and two above, in **every question in the game**. The
answer was always the second-smallest of the four buttons, so tapping the
second-smallest won every question without doing any arithmetic. `rng.shuffle` hid
it, because shuffling moves a choice on screen but does not change how the four
values sort. Two earlier flaws had the same shape: `answer × 2` was offered above
`BIG_ANSWER` and was always the largest button, and the answer's digits reversed
was offered as a last resort and could put 61 among the multiples of forty for
`40 × 4`. Both are gone.

[`js/challenges/arithmetic.js`](js/challenges/arithmetic.js) carries the
reasoning, and `arithmetic.test.js › distractors are numbers a child could
actually reach` holds all of it — including a check on the answer's rank in the
sorted choice list, which is the assertion whose absence let the giveaway survive.

## Keyboard

Touch is the primary input; the keyboard is an accessibility fallback.

- **A–D** — choose the corresponding answer. Case is ignored. Ignored while the
  focus is in a text field, and when Cmd, Ctrl, or Alt is held, so browser
  shortcuts still work. Letters rather than digits because every answer in the
  game is a number, and a small digit in the corner of a button reading "34"
  reads as part of the answer.
- **Tab** — move between controls; **Enter/Space** activates
- **j/k** — move between page links (site-wide; press **?** for the full list)

## How to change things

Ella redesigns this game as she has new ideas, so these are the paths meant to
stay cheap. Each recipe lists the files in order and names the tests that fail on
purpose. Keep the game open while you work — see [below](#seeing-your-change).

### Retune a season's difficulty

Everything is in [`js/seasons.js`](js/seasons.js): `route`, `demand`,
`timerSeconds`, `forms`, `glowingForms`, `boss`. No other file carries a
difficulty number.

`route` is the trail: add or remove entries to change its length, and swap a
`mountain` in or out to change the glowing count — see
[the route model](#difficulty).

Move `demandText` with the demand — it spells the number out — and move the
demand with the route length, because both bounds are fractions of `maxItems`
(one item per ordinary space, plus the character's `glowingItems` per glowing
one). `seasons.test.js` requires `demand ≤ 0.75 × maxItems` for **every**
character, which is the 25% headroom, and `demand > 0.5 × maxItems` so the trail
still matters; the Banana Slug is the binding case, as [above](#difficulty).
Update the [Difficulty](#difficulty) table too.

Expected failures depend on which number moved. A **route** change fails
`seasons.test.js › maxItems › counts <season> at N items…` for that season, plus
`adds one per ordinary space…` if it was spring — hand-written literals,
recomputed as `(spaces − glowing) + glowing × 3`, and `× 2` for the Slug. Raising
**spring's demand** starts failing the
`GameUI.test.js › renderItemTrack › grows to N earned plus M wilting = K slots`
rows, whose slot count is `max(demand, earned + wilting)` — the first at a demand
of 13, all three by 16. Changing **summer's timer** fails
`game.test.js › stops the clock while hidden and restarts it on return`, which
counts down from a literal 20. Nothing pins `demandText` or `boss.rescue`
anywhere, and `Journey.test.js › bossPosition`, `art.test.js`'s layout checks and
the HUD count sentence all derive from the season. Genuine breakage looks
different: `reachability` or `difficulty escalation` in `seasons.test.js`, which
also require the demand to rise strictly spring→winter, the trail not to shorten,
the timer not to loosen, the glowing count not to fall, and `boss.rescue` to stay
under the demand.

Changing **the maths** has its own set. `difficulty escalation` scores each form
list structurally — mental steps, not answer size — and requires the ordinary
spaces to get strictly harder each season, the hard slots never to get easier, and
every season's glowing spaces to beat its own ordinary ones. That last one is the
check that was missing while every lit mountain in the game asked an easier
question than the trail leading to it. The score is in `seasons.test.js`'s
`formScore`, deliberately coarse so it catches an inversion without freezing the
tuning; if a change is right and the score disagrees, the score is what to edit.

### Add or change an obstacle

1. [`js/obstacles.js`](js/obstacles.js) — one entry in `OBSTACLES`, keyed by id:
   `kind` (the same id again), `name`, `verb`, and `hard`. Leave `hard` false
   unless you mean a second kind of hard question: it is what makes a space
   glowing, and adding one is a difficulty retune for every season that uses the
   kind.
2. [`js/art/placeholder.js`](js/art/placeholder.js) — a key with the same id in
   `OBSTACLE_ART`, returning shapes drawn around an origin of `(0, 0)` sitting on
   the ground, so `layout` can place it by translation alone. Use the material
   colours it is handed (`earth`, `rock`, `leaf`, `trunk`, `water`, `far`, `ink`)
   rather than fixed hexes, so one drawing serves all four seasons. Skip this
   step and the kind silently draws a hill.
3. A `case` in `traversal()` in the same file, unless the default rolling hop
   suits it — the pack owns the motion as well as the shape.
4. `GROUND_PROFILE` in the same file — **only** if the obstacle is a hole in the
   ground rather than something standing on it. `dip` and `halfWidth` sink it into
   a basin, which is how the river gets water to sit in; `breakHalfWidth` removes
   it outright and splits `groundSegments` in two, which makes the gap's leap
   legible. Anything sitting on top of the ground needs no entry.
5. [`js/seasons.js`](js/seasons.js) — put the id in one or more seasons' `route`,
   or nothing will ever draw it.

Expected failures: `art.test.js`'s pack-contract block sweeps every kind in
`obstacles.js`, so a new kind fails there until step 2 exists — and it fails on
_distinctness_, not on structure, because the unknown-kind fallback is a
perfectly valid hill drawing. `Journey.test.js` holds every space's kind to
`isObstacleKind`, so a route naming a kind that `obstacles.js` does not define
fails there too. If the new kind is `hard`, expect the
[retune failures](#retune-a-seasons-difficulty) above as well.

### Add or change an animal

1. [`js/characters.js`](js/characters.js) — one entry in `ROSTER`: `id`, `name`,
   `perkName`, `perkText`, `costText` (`""` when the perk is free), `effects`.
2. [`js/art/placeholder.js`](js/art/placeholder.js) — a key with the same id in
   its `CHARACTERS` map, returning `svg(...)` shapes in the `0 0 100 100` box.
   Skip it and the animal renders as a grey disc.

The five effect fields, and which function reads each, are tabulated in
[`js/README.md`](js/README.md#character-perks--charactersjs). A perk built from
those is pure data: no code to write, and no `if (character.id === …)` anywhere.
A genuinely new _kind_ of effect needs two more edits — a field in
`DEFAULT_EFFECTS` in [`js/constants.js`](js/constants.js), and the code in
[`js/GameState.js`](js/GameState.js) that honours it. `characters.test.js`
requires every character to carry every `DEFAULT_EFFECTS` key and at least one
character to differ from the default on each, so a field nothing uses fails.

Expected failures when the roster grows: exactly two. One in `characters.test.js`
— `has exactly the expected characters, in display order`, the deliberate
`EXPECTED_IDS` pin and the only test there that names the roster — and
`art.test.js › draws the character <id>`, which fails on _distinctness_ until step
2 exists, because the fallback grey disc is what an unknown id gets too. The three
card counts in `game.test.js` are all `CHARACTERS.length`, so they pass.
Invariant: `seasons.test.js` pairs every season with every character, and
`glowingItems: 1` still _reaches_ every demand — winter's 17 against 15 + 5 × 1 = 20. What it fails is the 25% headroom ceiling, in all four seasons (winter:
0.75 × 20 = 15). Express a penalty perk as `penaltyScale`, never as a named
punishment — the active rule below decides what a wrong answer actually costs.

### Change what a wrong answer costs, or what a missed boss costs

One line each, all in [`js/constants.js`](js/constants.js):

- `RULES.WRONG_ANSWER` → `WRONG_ANSWER.GENTLE`, `.WILT`, or `.STEP_BACK`
- `RULES.BOSS_FAILURE` → `BOSS_FAILURE.RETRY_SEASON`, `.ALWAYS_PASS`, `.END_RUN`
- `BOSS_TRIES` (2) — set to 1 for a single-shot boss

[Two rules that are not decided yet](#two-rules-that-are-not-decided-yet) says
what each option does to a player. All of them are already implemented in
`GameState.js` and covered by `GameState.test.js`, which flips `RULES` per case,
so there is no rule to write and no other file to touch.

The tests are not quite free: `GameUI.test.js` and `game.test.js` run at whatever
the defaults are and assert the copy those produce. Measured once — `GENTLE` five
failures, `STEP_BACK` four, `ALWAYS_PASS` four, `END_RUN` one, `BOSS_TRIES = 1`
twelve — so treat those as orders of magnitude; every one names the old default
rather than a broken rule. Move the "**the current default**" markers above too.

### Change the maths

Forms live in [`js/seasons.js`](js/seasons.js) — `forms` for ordinary spaces,
`glowingForms` for glowing ones, `boss.forms` for the boss — and
[`js/challenges/arithmetic.js`](js/challenges/arithmetic.js) owns what a form
_means_. The five kinds:

| Kind      | Parameters                      | Question                                                                      |
| --------- | ------------------------------- | ----------------------------------------------------------------------------- |
| `add`     | `min`, `max`, `borrow`          | a + b, sum `min`..`max`; `borrow` forces a carry                              |
| `sub`     | `min`, `max`, `borrow`          | a − b, never negative, minuend `min`..`max`; `borrow` forces regrouping       |
| `mul`     | `tables`, `upTo`, `twoDigit`    | one operand from `tables`, the other 2..`upTo`, or 10..`upTo` with `twoDigit` |
| `div`     | `tables`, `upTo`, `from`        | exact only; the quotient is `from`..`upTo`, defaulting to 2                   |
| `twoStep` | `tables`, `upTo`, `max`, `from` | a × b then + or − c, result 0..`max`, with b from `from`..`upTo`              |

**`from` is what makes a hard slot hard**, and it is the least obvious field here.
Narrowing `tables` does nothing to the _answer_: `div` drew its quotient from 2
upward whatever the tables said, so a third of every draw landed on the ÷2 and ÷3
facts and autumn's boss — the climax of the third season — asked `12 ÷ 6 = 2`.
Raising the floor raises the dividend with it, so `from: 7` on the 6–9 tables asks
`56 ÷ 8`. `seasons.test.js › … never asks a question a younger child could do`
samples what the generator actually emits and holds this; the structural score
cannot, because it reads the form declaration and `from` does not change a form's
shape.

The trade-off is pool size: division within 100 has only so many hard facts, so a
high floor with narrow tables leaves few questions — autumn's boss has 16, which
`draws from a pool worth replaying` pins as the floor. Widen `tables` before
lowering `from` if a slot starts feeling repetitive.

Two rules to keep. **Division never goes in `forms`** — Ella's rule is that it is
the hardest thing in a level, so it belongs to the glowing spaces and the boss,
and `seasons.test.js › keeps division off the ordinary spaces, per Ella's rule`
enforces that direction. The converse is not required: a hard slot may ask
something else, and winter's does, because a single division fact within 100 is
easier than winter's ordinary spaces — its climax is `twoStep` instead, which is
grade 3's own two-step standard. What a hard slot may _not_ do is drop to a bare
fact or a two-digit sum; `asks nothing but a hard kind at a hard space` holds
that. **Every ordinary question stays mental**: no column operation past two
digits, and every individual fact inside 100. That means `div` caps at
`upTo: 10` — a quotient of 12 on the 9 table is `108 ÷ 9`, outside the grade-3
tables — and `add`/`sub` cap much tighter still, at `max: 18`, because they are
meant to be recalled rather than worked out. `keeps every individual fact inside
100` and `asks addition and subtraction only as facts inside 18` enforce both,
so they are tests now rather than conventions.

For questions bigger than a bare fact without breaking that rule, put the
multiples of ten in `tables`: `{kind: "mul", tables: [10, 20, ...90], upTo: 9}`
gives `7 × 40`, which is grade 3's 3.NBT.A.3 — large answers, place-value
practice, no column arithmetic, and no new form kind needed.

`arithmetic.test.js` sweeps every form list the real seasons use, parsing each
prompt and recomputing it, and separately checks that no generator exceeds the
`max` its own form declares and that every distractor is a number a slip could
actually land on.

### Replace the art

A pack exports twelve names: `id` and `name`; `palette`; the drawings
`character`, `item`, `obstacle`, `villain`, and `backdrop`; and the
trail's geometry and motion, `layout`, `traversal`, `reducedTraversal`, and
`standing`. Signatures and return shapes are in
[`js/README.md`](js/README.md#art--art), with the two that have changed since —
`backdrop`, which returns parallax layers rather than one drawing, and
`reducedTraversal` — documented on
[`js/art/index.js`](js/art/index.js); and
[`js/art/placeholder.js`](js/art/placeholder.js) is the reference.

1. A new file in [`js/art/`](js/art/).
2. Two lines in [`js/art/index.js`](js/art/index.js): the `import`, and an entry
   in `PACKS`.
3. One string: `ART.PACK` in [`js/constants.js`](js/constants.js).

Nothing else moves; no other module knows what anything looks like.
`art.test.js`'s "fulfils the art-pack contract" block is written against the
contract rather than the placeholder's shapes, so pointing its `pack` constant at
the new module is the whole test plan: it sweeps every character id, every season
and every obstacle kind for a distinct drawing, and holds `palette` to
`--season-*` keys, the same set for every season. `layout` is checked for internal
consistency rather than against the placeholder's numbers — one stop per space
plus the boss, one obstacle per route entry and of the kind the route named, left
to right, no NaN — because a pack chooses its own spacing. Its four placement
values (`tokenScale`, `bossOffset`, `bossTransform`, `glow`) are not checked at
all. Two numbers do carry meaning and are pinned: the trail has to come out wider
than the viewport or nothing scrolls, and a route containing a `gap` has to break
the ground into more than one segment. A third is pinned on the backdrop: every
layer has to declare a `span` wide enough to cover the visible window at both
ends of the longest trail, which is the one way a layer panning slower than the
ground can go wrong — it runs out, and the end of the trail is blank canvas. One
caveat: a second pack is the moment to
move the `svg` helper out of the
[registry cycle](js/README.md#dependency-direction).

### Add a new kind of challenge

A matching game or a word puzzle is a new module in
[`js/challenges/`](js/challenges/) exporting exactly two functions, `generate`
and `check` — [contract](js/README.md#challenge-type--challenges). Then: one entry
in `CHALLENGES` in [`js/challenges/index.js`](js/challenges/index.js), and on a
season in [`js/seasons.js`](js/seasons.js) set `challenge: "<name>"` and give it
`forms`, `glowingForms` and `boss.forms` in your shape — `forms` is opaque to
everything but your module, so it can be any shape you like.

**The one known leak.** `_onAnswer` in [`js/game.js`](js/game.js) reads
`state.question?.answer`, a field the seam calls private, so a challenge whose
answer is not a renderable scalar has to fix that first —
[details](js/README.md#challenge-type--challenges).

Expected failures: `seasons.test.js` asserts `challenge === "arithmetic"` for
every season, so the first non-arithmetic season breaks it, and
`arithmetic.test.js` sweeps every season's form lists through the arithmetic
generator regardless of what the season names, so scope its `FORM_LISTS`.
`challenges.test.js` already checks that every season names a registered type.

### Rewrite the snake woman's dialogue, or any player-facing copy

There is no strings file; copy sits beside the code that shows it.

| What the player reads                                                    | Where                                                                     |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Her opening line each season, and the item names                         | `demandText`, `itemName`, `itemPlural`, `rareItemName` in `js/seasons.js` |
| The one-line verdict after each answer                                   | `_feedbackFor` in `js/game.js`                                            |
| Result titles, her verdicts, the buttons, the two "are you sure" prompts | `_renderResult` and its neighbours in `js/game.js`                        |
| Animal names, perk names, perk and cost text                             | `ROSTER` in `js/characters.js`                                            |
| The count sentence, wilt note, perk note, trail label                    | `renderHud` and `_describeTrail` in `js/GameUI.js`                        |
| The question label — "Glowing challenge", and the boss's worth and tries | `_questionTag` in `js/game.js`                                            |
| Summary-row labels on the result screen                                  | `renderResult` in `js/GameUI.js`                                          |
| The jar caption on the result screen — "11 roses into her jar"           | `_renderHaul` in `js/GameUI.js`                                           |
| The "Your journey" panel and its lifetime-totals sentence                | `renderJourneySoFar` in `js/GameUI.js`                                    |
| The top-bar season title — "Autumn"                                      | `name` in `js/seasons.js`                                                 |
| Headings, the intro paragraph, top-bar titles                            | `index.html`                                                              |

Two suites pin copy, and both are meant to be updated with it: `game.test.js`
holds the exact feedback lines ("+1 rose", "3 everlasting roses!", "One more
go!"), the boss label (`the boss says what is at stake`), the result titles
("Spring complete", "Not quite enough", "The potion is finished") and substrings
of her paragraphs; `GameUI.test.js` holds the count sentence, the wilt note, and
the perk and cost text on the cards — a question tag reaches it as an argument,
so it pins the rendering rather than the words. `seasons.test.js` and `characters.test.js` only check the fields are
non-empty strings. If you touch `index.html`, `index.zh.json` holds Chinese for
five of its strings, matched by exact text — a stale key makes `npm run build`
warn `no match for "…"`.

## Seeing your change

```bash
npm run dev     # from the repo root; serves the source, no build step
```

Then open <http://localhost:8000/games/seasons/> and reload after each edit.

**Jump to a season from the URL.** The quickest way to look at one without
playing three to get there:

| URL                              | What it does                                                 |
| -------------------------------- | ------------------------------------------------------------ |
| `?season=winter`                 | Starts winter immediately, with the first animal             |
| `?season=summer&character=sloth` | Picks the animal too                                         |
| `?phase=end`                     | The last screen in the game, four seasons of haul already in |
| `?season=autumn&phase=boss`      | Straight to that season's boss, three items short            |
| `?phase=won` / `?phase=lost`     | The end-of-season screens                                    |
| `?debug=1`                       | Character screen, with all four seasons shown open           |

`?phase=` also takes the raw `PHASE` values. The run it builds is handed to
`rehydrate`, the same path a reload takes, so a jump gets the same coercion and
the same promotion a real save does — which is how `?phase=boss` arrives with a
boss question already drawn.

**Nothing is saved while any of those are set**, so checking the art cannot write
over a real half-finished run — which is the whole reason the switch exists
rather than a console paste being good enough. A small "debug — not saving" badge
sits in the corner so the session cannot be mistaken for broken saving. An
unknown season or character id is ignored and the game starts normally.

**Jump straight to any state.** For anything the URL does not cover — mid-boss,
a specific item count, a lost season — the game restores whatever is in
`localStorage` under `seasonsProgress`, so any screen is one paste into the
browser console and a reload away:

```js
localStorage.setItem(
  "seasonsProgress",
  JSON.stringify({
    version: "1.0",
    run: {
      phase: "boss",
      seasonId: "winter",
      characterId: "phoenix",
      position: 20,
      items: 15,
      wilting: 0,
      bossTriesLeft: 2,
    },
  }),
)
```

`version` has to match `STORAGE.VERSION` (`"1.0"`) or the save is discarded, and
the payload needs a `run`. Everything inside it is coerced into range on load,
so only the fields you care about have to be there:

- **`phase`** — `characterSelect`, `trail`, `boss`, `seasonWon`, `seasonLost`,
  `runComplete`
- **`seasonId`** — `spring`, `summer`, `autumn`, `winter`
- **`position`** — 0 up to that season's `spaces`. The last value is the boss,
  and a `trail` phase that has already reached it is promoted to `boss` on load.
  Land on a space whose `route` entry is `mountain` to get a glowing challenge.
- **`items`** — what counts toward the demand; set it just short to see a loss
- **`wilting`** — at risk, and what makes the wilt note appear
- **`bossTriesLeft`** — set it to 1 so the next boss miss resolves the season.
  Not 0: that is coerced back to the full `BOSS_TRIES`, a deliberate fallback
  for saves written before the field existed.

Unknown keys are dropped, counters clamp to non-negative, and an unrecognised
`characterId` becomes the Banana Slug. The question is never saved: it is
regenerated from `seed:seasonId:attempt:questionsAsked`, so a fixed `seed`
replays a run exactly.

```bash
npm test -- --roots="<rootDir>/games/seasons"   # this game, 11 suites
```

`npm test -- --testPathPatterns seasons` works too, but matches twice as many
files — the pattern also picks up any checkout of the game under
`.claude/worktrees/`. Bare `npx jest` fails outright: the `test` script supplies
the `--experimental-vm-modules` flag that ESM needs.

## For developers

```
index.html      # The whole markup: three screens, no templating
manifest.json   # PWA manifest, display: standalone
icon.svg        # The only icon; see the note on apple-touch-icon below
index.zh.json   # Chinese strings, used by the site build
styles/main.css # The whole stylesheet, light and dark
js/             # 14 modules; the dependency graph is in js/README.md
__tests__/      # 11 Jest suites
```

[`js/README.md`](js/README.md) is the canonical reference: what to read first,
the dependency graph, which modules are allowed to be impure, where a question
comes from, the three extension seams, and how the tests are organised. Two
things worth knowing before you open anything: importing `js/game.js` starts the
game, so `index.html` needs no bootstrap call; and nothing calls `Math.random()`,
so a run is reproducible from its seed. `BaseGameUI.js` and `StorageManager.js`
are shared with Number Garden, Life Garden, and Times Trail, and live in
`games/shared/`.

## Browser support and accessibility

Current Chrome, Firefox, Safari, and Edge. Uses ES modules, so it must be served
over HTTP rather than opened from the filesystem.

Fully keyboard navigable; focus moves to each screen's heading on navigation but
not between questions on the same screen, which would interrupt a screen reader
mid-sentence. `aria-live` covers the question and the feedback line, and
`#item-count` is a single `role="status"` sentence ("9 of 13 diamonds — 4 to
go") rather than separate nodes that announce as disconnected words. Answer
buttons carry `aria-label="Answer A: 42"`, which makes the A–D shortcut
discoverable, and lock with `aria-disabled` rather than `disabled` — disabling
the focused element drops focus to `<body>`. Colour is never the only signal:
the correct and wrong buttons get ✓ and ✗ glyphs, and each season carries a
text-safe accent separate from the one that paints the trail, because six of the
eight original accent-on-surface pairs failed 4.5:1. All animation is disabled
under `prefers-reduced-motion`.

Built for a shared iPad: 64px tap targets, iOS web-app meta tags, and suppressed
double-tap zoom, tap highlight, and text selection. Switching away from the tab
stops the countdown and switching back restarts it rather than resuming — better
than handing back a question with two seconds left because the iPad was locked.
Follows the OS dark-mode preference unless the site theme toggle overrides it.
`manifest.json` sets `"display": "standalone"`, so the home screen opens it
without browser chrome, but there is no `apple-touch-icon`: iOS ignores SVG
icons and this repo adds no binary assets, so the home-screen icon is a snapshot
of the page. To fix that, add a 180×180 PNG at
`games/seasons/apple-touch-icon.png` and one line to `<head>`.

## Security and privacy

Every node is built with `createElement` or `createElementNS` and every string
written with `textContent`; `innerHTML` is not used anywhere in this game, and
`BaseGameUI.setHTML` is deliberately never called. Progress is saved in
`localStorage` under `seasonsProgress`, never leaves the device, and is erased
by the restart button after a confirmation. Saved data is treated as untrusted:
every field is coerced back into range on load and unknown keys are dropped. No
personal information, no cookies, no tracking, no external requests beyond the
site's own stylesheet and scripts.

## Known gaps

Real, and not yet fixed. **The countdown is not announced** — the number carries
`aria-hidden`, so a screen-reader user gets no warning that time is running out,
and there is no setting to extend or turn off the limit; three of the four
seasons are timed, and the Sloth's +10 seconds is the only lever, buried in a
choice made before the first question. **The page can still scroll mid-question
on a small phone**, because `min-height: 100dvh` sets a floor rather than a
ceiling; the target device is a shared iPad, where it fits. **`save.unlocked` and
`save.totals` are written but never surfaced** — there is no season picker and no
stats screen.

**What is planned next** is NPCs, items, and trading, and the route model was
shaped to take them: a route entry is a value in a list, so a
`{kind: "npc", who: "badger"}` beside today's strings needs `obstacles.js` and
the art pack to learn the new shape but no save migration at all — a save records
a position, and the trail is always derived from the route.

## Still to decide

Ella's, not mine:

- The two rules above.
- The Porcupine's perk. The comeback bonus is a placeholder so the slot is
  playable; it is hers to replace.
- The snake woman's name.
- Whether there is anything to spend collected items on, or whether the snake
  woman simply keeps them for the potion.

These, the planned NPC and trading phase, and the polish that was deferred
rather than missed, are written up in
[`docs/seasons-plan.md`](../../docs/seasons-plan.md). This file documents what
the game does; that one is allowed to speculate.

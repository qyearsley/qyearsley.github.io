# Seasons

A journey through four seasons. You choose an animal, walk a trail, and answer
maths questions to gather what a snake woman needs for her potion — roses in
spring, diamonds in summer, leaves in autumn, icicles in winter. She is not a
threat; the snake lady is actually nice and is using the things to help making a
potion, and she gives you a quest to test you. Get a question right and you
collect something and move on; get one wrong and nothing is taken away — the
question stays up until you find the answer.

The game is Ella's idea, and this is the foundation for it rather than the
finished thing, so the docs are organised around
[how to change it](#how-to-change-things).
[`js/README.md`](js/README.md) covers how the code is put together.

## How it plays

**Choose an animal.** Four of them, and the choice matters — each one changes a
rule rather than just the picture. None of them costs anything: the demand is met
exactly by a complete season, so a perk that changed an item count would break
the arithmetic. They change time and hints instead.

|             | Perk            | What it does                                                  |
| ----------- | --------------- | ------------------------------------------------------------- |
| Banana Slug | Slow and Steady | No countdown, ever. Take as long as you like.                 |
| Sloth       | Takes His Time  | 10 extra seconds on every timed question.                     |
| Phoenix     | Rising Again    | The first slip each season makes two wrong answers disappear. |
| Porcupine   | Bounce Back     | Get one wrong and you go straight on, with no extra question. |

**Walk the trail.** Every space is an **obstacle** — a hill, a river, a thicket,
a boulder, a gap, or a mountain — and the question is how you get past it. A
correct answer collects an item and plays the crossing: the character climbs,
hops the stones, or leaps, and the camera pans along, because the trail is drawn
much wider than the screen. Tap anywhere to cut a crossing short. The
**mountains** are the **glowing spaces** — the season's hardest question, lit up,
worth three items instead of one, tagged "Glowing challenge" on screen.

**Get one wrong and try again.** Nothing is taken. The choice you pressed is
struck off, the question stays up, and the clock goes away for good on that
question — the retry is never a race. Once you find the answer, a card comes up
showing the fact in full with a picture of it (a dot array for a times fact, ten
frames for an add) and waits for "Got it". Then one more question at the same
space before you move on, so a slip costs a question rather than an item. That is
the whole cost, and it caps there: a second slip at the same space owes nothing
more.

**Face the boss.** At the end of the trail the snake woman waits with one last
question: the hardest thing the season asks, which is division in spring through
autumn and a two-step in winter. It is worth a block of items (3 in spring,
rising to 6 in winter), and the label says so before you answer. **Her question
is the one that completes the count.** A season's demand is exactly what the
trail pays plus what she rescues. Missing it changes nothing except that she asks
one more. A season that has started cannot be lost.

**Get on the board.** A finished journey is ranked by slips — wrong answers,
timeouts included — on a top-five board kept on the device. A run that makes it
asks for a name. Ties go to whoever got there first. The board has its own
localStorage key, so "Start over" does not erase it.

Seasons get harder in both directions at once: the maths steps up, the clock
tightens, the demand rises, and more of the trail glows. A whole run is 31
questions when nothing is missed: 27 trail spaces and four boss questions.

## Difficulty

Pitched at third grade. If it is wrong, [`js/seasons.js`](js/seasons.js) is the
only file to change — it holds every difficulty number in the game.

**One rule keeps it mental.** No column operation goes past two digits, and every
fact stays inside 100, because the player must find the answer and read four
choices before the countdown ends. Add and sub stay inside 18 (`8 + 7`,
`15 − 9`): recall, not calculation. A `min` floor stops "inside 18" offering
`2 + 3` as readily as `9 + 8`. Escalation lives in multiplication and division:
one fact, the whole table, a fact scaled by ten, then two chained operations.
`9 × 80` is on grade because what is banned is column work, not size.

**The route model.** A season's trail is one array, `route`, with one obstacle
kind per space. Its length is the trail length, and the mountains in it are the
glowing spaces: `spaces` and `glowingAt` are derived when the module loads. To
change how many hard spaces a season has, place that many mountains. `hard` is a
property of the kind in [`js/obstacles.js`](js/obstacles.js), and only the
mountain has it.

|        | Ordinary spaces                        | Glowing spaces           | Boss         | Timer | Trail | Glowing | Rescue | Demand |
| ------ | -------------------------------------- | ------------------------ | ------------ | ----- | ----- | ------- | ------ | ------ |
| Spring | + and − facts 6–18, ×2 ×3 ×4 ×5 ×10    | `40 ÷ 5`                 | `35 ÷ 5`     | none  | 6     | 2       | 3      | 13     |
| Summer | × facts to 10×10, + and − facts 11–18  | `48 ÷ 6`                 | `72 ÷ 9`     | 30s   | 6     | 2       | 4      | 14     |
| Autumn | ×2 3 4 6 7 8 9, − facts 11–18, × 10–50 | `54 ÷ 9`                 | `56 ÷ 8`     | 28s   | 7     | 2       | 5      | 16     |
| Winter | ×4 6 7 8 9, − facts 11–18, × 10–70     | `8 × 7 + 9`, or `63 ÷ 9` | `8 × 9 - 17` | 25s   | 8     | 3       | 6      | 20     |

**The clock is deliberately loose**, when it runs at all. It is off unless a
player turns it on; see [Settings](#settings). A timer has to cover reading the
question, working it out, and reading four options, so it is slack enough that
running out means the fact was not known. It still tightens across the year.

Every hard slot carries a `from` floor on its quotient, which stops it asking
`12 ÷ 6`; see [Change the maths](#change-the-maths). Subtraction stops escalating
after summer, since `15 − 8` is the mental ceiling for a single subtraction.
Winter's lit mountains are the two-step, because a single division fact within
100 is easier than its ordinary spaces.

**The demand is met exactly.** Ordinary spaces pay 1, glowing spaces pay 3, and
the snake woman's own question pays the rescue, so:

```
demand === (spaces − glowing) + glowing × 3 + rescue
```

Spring is 4 + 6 + 3 = 13, and so on. `seasons.test.js` asserts this for every
season. Two consequences: **no perk may change an item count**, and **nothing may
take an item away**. Tests hold both.
[Retuning](#retune-a-seasons-difficulty) has the arithmetic to redo when you move
a number.

## Graphics

Undecided, and deliberately isolated rather than deferred. Everything visible —
the season palettes, the trail's geometry, the motion of each crossing — comes from
an **art pack** in [`js/art/`](js/art/), and no other module knows what anything
looks like. The current pack draws flat vector shapes in code: clearly a
porcupine, not meant to be final. Contract in
[`js/README.md`](js/README.md#art--art), recipe at
[Replace the art](#replace-the-art).

Four things about the landscape are worth knowing before touching it:

- **The backdrop is four layers, not one picture.** `backdrop()` returns a stack
  (sky, far ridge, near ridge, and the air the weather falls through), and each
  says how fast it pans as a fraction of the ground's scroll: 0, 0.25, 0.55,
  0.85. `GameUI` moves each by `offset × factor`. Every layer is generated at the
  trail's full width, so no gap opens at either end; `art.test.js` checks this at
  both ends of winter's trail.
- **The ground has a top edge made of something.** `layout()` returns
  `groundEdges` beside `groundSegments`: a band of grass, leaves or snow whose
  underside is the ground line sample for sample, so it follows a river basin
  down and stops at the lip of a gap.
- **Nothing is scattered at random.** Snow, blossom, leaves and heat haze are
  placed by arithmetic with coprime moduli. The scene is rebuilt whenever the
  season or character changes, and a backdrop dealt afresh each time would
  flicker. Nothing in this game calls `Math.random`.
- **The stylesheet moves the weather.** A pack cannot ship CSS, so `AIR_ART` tags
  each mark with a `motion` (`fall` or `drift`) and `backdrop` writes it as the
  class `air-fall` or `air-drift`. `main.css` animates whatever carries the
  class. The tag names a behaviour, never a season, so a replacement pack
  re-themes the game without touching CSS. This also gets
  `prefers-reduced-motion` for free, which SMIL inside the drawing would not.

Motion is the pack's too. `traversal()` is the full crossing, and
`reducedTraversal()` is the plain slide (240ms, straight line, no arc or squash)
for a player who has asked for less motion.

**Finishing is drawn, not just written.** Clearing a season bursts twelve of its
collectibles out of the jar and makes the animal jump. Finishing the run draws
the filled flask beside a larger snake woman who is visibly pleased
(`villain(true)`). Both are CSS animations on shapes the pack builds, so
`prefers-reduced-motion` covers them without a second code path.

## Answer input

Four choice buttons, not a keypad. Times Trail rejected multiple choice because
a one-in-four guess corrupts its per-fact mastery data, but Seasons has no
mastery model, and large tap targets suit a shared iPad. Revisit this if Seasons
ever grows one.

Distractors are near misses, because a random distractor is eliminated at a
glance. Each generator hands back its operands, and the distractors come from
slipping one of them by one step: `4 × 80` offers 240 and 400 (the 4
misremembered) and 280 and 360 (the 80 misremembered). Addition and subtraction
slip by a whole ten (a dropped carry). Small answers get plain near misses,
`± 1` to `± 3`. Two thresholds, `SLIP_FROM` (20) and `BIG_ANSWER` (100), exist
because otherwise "6 ÷ 2" offered 13 and 1 beside the answer 3.

**How many distractors sit below the answer is drawn at random.** Filling the
list in order of temptingness always gave one below and two above, so the answer
was the second-smallest button in every question and tapping it won without
arithmetic. `rng.shuffle` hid this, because it moves a choice on screen but not
how the values sort.

[`js/challenges/arithmetic.js`](js/challenges/arithmetic.js) carries the
reasoning. The "distractors" tests in `arithmetic.test.js` hold it, including a
check on the answer's rank in the sorted choice list.

## Settings

One control, behind the gear in the top bar: **Countdown timer**, off by default.

Turning it on makes summer, autumn and winter run their clocks. Nothing else
changes. It is a setting because the clock, not the arithmetic, is the part a
nervous player finds hardest.

- **Opening the dialog stops the clock**, and closing it restarts the question's
  full allowance rather than handing back the remainder. Timing a player out
  behind the dialog she opened to switch the clock off would be the game at its
  worst.
- **The preference survives "start over".** That button erases the journey, and
  quietly changing the countdown is not what it says it does.
- **Only a literal `true` turns the clock on.** A save written before the setting
  existed loads untimed. See `_normalizeSettings` in
  [`js/storage.js`](js/storage.js).

## Keyboard

Touch is the primary input; the keyboard is an accessibility fallback.

- **A–D** — choose the corresponding answer. Case is ignored. Ignored while focus
  is in a text field, and when Cmd, Ctrl, or Alt is held. Letters, not digits,
  because a small digit in the corner of a button reading "34" reads as part of
  the answer.
- **Tab** — move between controls; **Enter/Space** activates
- **Escape** — close the settings dialog
- **j/k** — move between page links (site-wide; press **?** for the full list)

The answer keys are ignored while the settings dialog or the reinforcement card
is up. The card has no Escape: its "Got it" button takes focus and is the only
way past, because rushing the card is what it exists to prevent.

## How to change things

Ella redesigns this game as she has new ideas, so these paths are meant to stay
cheap. Each recipe lists the files in order and names the tests that fail on
purpose. Keep the game open while you work; see
[Seeing your change](#seeing-your-change).

### Retune a season's difficulty

Everything is in [`js/seasons.js`](js/seasons.js): `route`, `demand`,
`timerSeconds`, `forms`, `glowingForms`, `boss`. No other file carries a
difficulty number.

`route` is the trail: add or remove entries to change its length, and swap a
`mountain` in or out to change the glowing count — see
[the route model](#difficulty).

Move `demandText` with the demand (it spells the number out), and move the
demand with the route, because the demand is not a target to tune independently:
it is what the season pays.

```
demand = (spaces − glowing) + glowing × 3 + boss.rescue
```

Redo that sum every time you touch `route` or `boss.rescue`, and update the
[Difficulty](#difficulty) table. `seasons.test.js › demand alignment` fails
otherwise.

Which tests fail depends on what moved. A route change fails the `maxItems`
literals in `seasons.test.js` for that season, and `demand alignment` until the
demand follows. Changing summer's timer fails a pause check in
`game.boot.test.js`. Nothing pins `demandText`. `difficulty escalation` in
`seasons.test.js` also requires the demand to rise strictly from spring to
winter, the trail not to shorten, the timer not to loosen, the glowing count not
to fall, and `boss.rescue` to stay under the demand.

Changing the maths has its own check. `difficulty escalation` scores each form
list structurally (mental steps, not answer size), and requires ordinary spaces
to get harder each season, hard slots never to get easier, and each season's
glowing spaces to beat its own ordinary ones. The score is `formScore` in
`seasons.test.js`, deliberately coarse. If a change is right and the score
disagrees, edit the score.

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

Expected failures: the pack-contract block in `art.test.js` sweeps every kind in
`obstacles.js`, so a new kind fails there until step 2 exists. It fails on
distinctness, because the unknown-kind fallback is a valid hill drawing.
`Journey.test.js` fails if a route names a kind `obstacles.js` does not define.
If the new kind is `hard`, expect the
[retune failures](#retune-a-seasons-difficulty) too.

### Add or change an animal

1. [`js/characters.js`](js/characters.js) — one entry in `ROSTER`: `id`, `name`,
   `perkName`, `perkText`, `effects`.
2. [`js/art/placeholder.js`](js/art/placeholder.js) — a key with the same id in
   its `CHARACTERS` map, returning `svg(...)` shapes in the `0 0 100 100` box.
   Skip it and the animal renders as a grey disc.

The four effect fields, and which function reads each, are tabulated in
[`js/README.md`](js/README.md#character-perks--charactersjs). A perk built from
those is pure data: no code to write, and no `if (character.id === …)` anywhere.
A new kind of effect needs two more edits: a field in `DEFAULT_EFFECTS` in
[`js/constants.js`](js/constants.js), and the code in
[`js/GameState.js`](js/GameState.js) that honours it. `characters.test.js`
requires every character to carry every `DEFAULT_EFFECTS` key and at least one
character to differ from the default on each, so a field nothing uses fails.

**A perk may not touch an item count, and may not cost anything.** The demand is
exactly what a season pays, so an animal who collected 2 from a glowing space
could never finish one. `characters.test.js › balance` holds this. Spend the
design budget on time, hints, and the extra question.

Expected failures when the roster grows: the `EXPECTED_IDS` pin in
`characters.test.js`, and `art.test.js › draws the character <id>`, which fails
on distinctness until step 2 exists.

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

**`from` is what makes a hard slot hard.** Narrowing `tables` does nothing to the
answer: `div` would still draw its quotient from 2 upward, so a third of draws
land on the ÷2 and ÷3 facts. Raising the floor raises the dividend with it, so
`from: 7` on the 6–9 tables asks `56 ÷ 8`. A test in `seasons.test.js` samples
what the generator emits and holds this; the structural score cannot, because
`from` does not change a form's shape.

The trade-off is pool size. Division within 100 has only so many hard facts, so a
high floor with narrow tables leaves few questions (autumn's boss has 20). A
`seasons.test.js` check holds each hard slot's pool above 15. Widen `tables`
before lowering `from` if a slot feels repetitive.

Rules to keep:

- **Division never goes in `forms`.** It is the hardest thing in a level, so it
  belongs to the glowing spaces and the boss. The converse is not required:
  winter's hard slot is `twoStep`, because one division fact within 100 is easier
  than winter's ordinary spaces. A hard slot may not drop to a bare fact or a
  two-digit sum.
- **Every ordinary question stays mental.** No column operation past two digits,
  and every fact inside 100. So `div` caps at `upTo: 10`, and `add`/`sub` cap at
  `max: 18`. Tests in `seasons.test.js` enforce both.

For questions bigger than a bare fact, put multiples of ten in `tables`:
`{kind: "mul", tables: [10, 20, ...90], upTo: 9}` gives `7 × 40`. That is large
answers and place-value practice with no column arithmetic and no new form kind.

`arithmetic.test.js` sweeps every form list the real seasons use, parsing each
prompt and recomputing it. It also checks that no generator exceeds its form's
`max`.

### Replace the art

A pack exports ten required names: `palette`; the drawings `character`, `item`,
`obstacle`, `villain`, and `backdrop`; and the trail's geometry and motion,
`layout`, `traversal`, `reducedTraversal`, and `standing`. An eleventh, `idle`,
is optional: it says how a drawing moves while standing still. Signatures and return shapes are in
[`js/README.md`](js/README.md#art--art);
[`js/art/placeholder.js`](js/art/placeholder.js) is the reference.

There is one pack and no registry. To replace it, write a new file in
[`js/art/`](js/art/) that exports the same names, and change the one import in
[`js/GameUI.js`](js/GameUI.js). The new file builds its elements with `svg` from
[`js/art/svg.js`](js/art/svg.js). Nothing else moves.

The "fulfils the art-pack contract" block in `art.test.js` is written against the contract, not the placeholder's shapes, so pointing its
`pack` constant at the new module is the whole test plan. It checks distinct
drawings for every character, season and obstacle, and `--season-*` palette keys
that match across seasons. `layout` is checked for internal consistency, not
against the placeholder's numbers. Three values carry meaning and are pinned: the
trail must be wider than the viewport, a route with a `gap` must break the ground
into more than one segment, and every backdrop layer's `span` must cover the
visible window at both ends of the longest trail.

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
every season, and `arithmetic.test.js` sweeps every season's form lists through
the arithmetic generator, so scope its `FORM_LISTS`. `challenges.test.js` checks
that every season names a registered type.

### Rewrite the snake woman's dialogue, or any player-facing copy

There is no strings file; copy sits beside the code that shows it.

| What the player reads                                                           | Where                                                                                                |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Her opening line, the item names, the top-bar title                             | `demandText`, `itemName`, `itemPlural`, `rare*`, `name` in `js/seasons.js`                           |
| The verdict after each answer                                                   | `_feedbackFor` in `js/game.js`                                                                       |
| The question label (glowing, boss worth)                                        | `_questionTag` in `js/game.js`                                                                       |
| Result titles, verdicts, buttons, "are you sure" text                           | `_renderResult` and neighbours in `js/game.js`                                                       |
| Animal names, perk names, perk text                                             | `ROSTER` in `js/characters.js`                                                                       |
| Count sentence, perk note, trail label, result rows, jar caption, journey panel | `renderHud`, `_describeTrail`, `renderResult`, `_renderHaul`, `renderJourneySoFar` in `js/GameUI.js` |
| The reinforcement card's equation and notes                                     | `explain` in `js/challenges/arithmetic.js`                                                           |
| Headings, intro paragraph                                                       | `index.html`                                                                                         |

Some suites pin copy, and are meant to be updated with it: `game.feedback.test.js`
(verdict lines), `game.journey.test.js` (boss label, result titles, parts of her
paragraphs) and `GameUI.test.js` (count sentence, perk note, perk text on the
cards).

**One line is a rule, not copy.** A miss must not state the answer. The card
afterwards teaches the fact, and saying it in the verdict skips both.
`game.feedback.test.js` asserts the answer is absent from the line. If you touch
`index.html`, `index.zh.json` holds Chinese for five of its strings, matched by
exact text; a stale key makes `npm run build` warn `no match for "…"`.

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
| `?phase=won`                     | The end-of-season screen                                     |
| `?debug=1`                       | Character screen, with all four seasons shown open           |

`?phase=` also takes the raw `PHASE` values. The run it builds is handed to
`rehydrate`, the same path a reload takes, so a jump gets the same coercion and
the same promotion a real save does — which is how `?phase=boss` arrives with a
boss question already drawn.

**Nothing is saved while any of those are set**, so checking the art cannot
overwrite a real half-finished run. A "debug — not saving" badge sits in the
corner. An unknown season or character id is ignored.

**Jump straight to any state.** For anything the URL does not cover, the game
restores whatever is in `localStorage` under `seasonsProgress`. Paste this into
the browser console and reload:

```js
localStorage.setItem(
  "seasonsProgress",
  JSON.stringify({
    version: "2.0",
    run: { phase: "boss", seasonId: "winter", characterId: "phoenix", position: 11, items: 17 },
  }),
)
```

`version` must match `STORAGE.VERSION` or the save is discarded, and the payload
needs a `run`. Everything in it is coerced into range on load, so include only
the fields you care about. The fields are listed in `_normalizeRun` in
[`js/storage.js`](js/storage.js): `phase`, `seasonId`, `position` (the last value
is the boss), `items`, `retrying`, `owed`, `extrasDone` and `hintsLeft`. The
question is never saved. It is regenerated from
`seed:seasonId:attempt:position:extrasDone`, so a fixed `seed` replays a run.

```bash
npm test -- --roots="<rootDir>/games/seasons"   # this game's suites
```

`npm test -- --testPathPatterns seasons` also works, but it picks up any checkout
of the game under `.claude/worktrees/`. Bare `npx jest` fails: the `test` script
supplies the `--experimental-vm-modules` flag that ESM needs.

## For developers

```
index.html      # The whole markup: three screens, no templating
manifest.json   # PWA manifest, display: standalone
icon.svg        # The only icon: manifest and apple-touch-icon both point here
index.zh.json   # Chinese strings, used by the site build
styles/main.css # The whole stylesheet, light and dark
js/             # 15 modules; the dependency graph is in js/README.md
__tests__/      # 16 Jest suites
```

[`js/README.md`](js/README.md) is the canonical reference: the dependency graph,
which modules may be impure, where a question comes from, the three extension
seams, and how the tests are organised. Importing `js/game.js` starts the game,
and nothing calls `Math.random()`, so a run is reproducible from its seed.
`BaseGameUI.js` and `StorageManager.js` are shared with the other games and live
in `games/shared/`.

## Browser support and accessibility

Current Chrome, Firefox, Safari, and Edge. Uses ES modules, so it must be served
over HTTP rather than opened from the filesystem.

Fully keyboard navigable. Focus moves to each screen's heading on navigation but
not between questions, which would interrupt a screen reader mid-sentence.
`aria-live` covers the question and the feedback line, and `#item-count` is one
`role="status"` sentence ("9 of 13 diamonds — 4 to go"). Answer buttons carry
`aria-label="Answer A: 42"` and lock with `aria-disabled` rather than `disabled`,
which would drop focus to `<body>`. Colour is never the only signal: correct and
wrong buttons get ✓ and ✗ glyphs, a struck-off choice is ruled through as well
as faded, and each season carries a text-safe accent separate from the one that
paints the trail (4.5:1). All animation is disabled under
`prefers-reduced-motion`, with delays zeroed as well as durations, because a
staggered animation with its delay intact is invisible and then abrupt.

Built for a shared iPad: 64px tap targets, iOS web-app meta tags, and suppressed
double-tap zoom, tap highlight, and text selection. Switching away from the tab,
or opening the settings dialog, stops the countdown, and coming back restarts it
rather than resuming. Follows the OS dark-mode preference unless the site theme
toggle overrides it. `manifest.json` sets `"display": "standalone"`. The
`apple-touch-icon` points at `icon.svg`, which iOS ignores (it takes only PNG),
so Add to Home Screen falls back to a page snapshot. The link stays to match
Times Trail; `games/shared/__tests__/markup-contract.test.js` holds all three
installable games to the same set. For a real icon, drop a 180×180 PNG beside
`icon.svg` and change that one `href`, at the cost of this repo's no-binary-assets
convention.

## Security and privacy

Every node is built with `createElement` or `createElementNS` and every string
written with `textContent`; `innerHTML` is not used anywhere in this game, and
the shared `BaseGameUI` offers no way to write markup. Progress is saved in
`localStorage` under `seasonsProgress`, never leaves the device, and is erased
by the restart button after a confirmation. Saved data is treated as untrusted:
every field is coerced back into range on load and unknown keys are dropped. No
personal information, no cookies, no tracking, no external requests beyond the
site's own stylesheet and scripts.

## Known gaps

Real, and not yet fixed.

- **The countdown is not announced.** The number carries `aria-hidden`, so a
  screen-reader user gets no warning that time is running out. The clock is off
  unless a player turns it on, so this is met only after opting in.
- **The page can scroll mid-question on a small phone**, because
  `min-height: 100dvh` sets a floor, not a ceiling. The target is a shared iPad,
  where it fits.
- **The reinforcement card's picture is `aria-hidden`.** The equation is read out
  and the dot array is not.
- **The card is not a focus trap or a `role="dialog"`.** It takes focus and
  swallows the answer keys, and the choices behind it are locked, so Tab reaches
  nothing that does anything.

**Planned next** is NPCs, items, and trading. The route model was shaped for it: a
route entry is a value in a list, so a `{kind: "npc", who: "badger"}` beside
today's strings needs `obstacles.js` and the art pack to learn the new shape but
no save migration, because a save records a position and the trail is derived
from the route.

## Still to decide

Ella's, not mine:

- The snake woman's name.
- Whether there is anything to spend collected items on, or whether the snake
  woman simply keeps them for the potion.
- Whether a cleared season should be replayable from a picker. Nothing replays a
  season today, so `attempt` is always 0. It stays in the question key because a
  picker would need it.

These, the planned NPC and trading phase, and the polish that was deferred
rather than missed, are written up in
[`docs/seasons-plan.md`](../../docs/seasons-plan.md). This file documents what
the game does; that one is allowed to speculate.

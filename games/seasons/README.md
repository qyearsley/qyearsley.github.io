# Seasons

A journey through four seasons. You choose an animal, walk a trail, and answer
maths questions to gather what a snake woman needs for her potion — roses in
spring, diamonds in summer, leaves in autumn, icicles in winter.

She is not a threat. The snake lady is actually nice and is using the things to
help making a potion; she gives you a quest to test you. Get a question right
and you collect something and move on; get one wrong and the active
wrong-answer rule decides what it costs, which by default is recoverable.

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

**Walk the trail.** Each space is a question, and a correct answer collects an
item and moves you on. Scattered along it are **glowing spaces** — a harder
question, lit up, worth three items instead of one, tagged "Glowing challenge"
on screen.

**Face the boss.** At the end of the trail the snake woman is waiting with one
last question, the hardest in the season, worth a block of items (3 in spring,
rising to 6 in winter) — which is how a run that fell a little short can still
make the demand. Missing it is not the end: `BOSS_TRIES` in
[`js/constants.js`](js/constants.js) is 2, so a wrong boss answer draws a fresh
question and lets you try again — Ella's rule, "if you miss the boss question
you get a chance to go back and try again." A miss also costs nothing at all, so
it can close a gap but never open one. Only running out of tries _and_ still
being short hands over to `RULES.BOSS_FAILURE` below.

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
covers switching one. A character's `penaltyScale` multiplies whichever rule is
active rather than naming a specific punishment, so the roster stays meaningful
while these are being tried out.

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
only file to change — it holds every difficulty number in the game. The
**Maths** column covers **ordinary spaces only**; glowing spaces and the boss
step up further, and division is reserved for them
([why](#change-the-maths)).

|        | Maths (ordinary spaces)                                | Timer | Trail | Glowing | Demand |
| ------ | ------------------------------------------------------ | ----- | ----- | ------- | ------ |
| Spring | + and − within 100, ×2 ×5 ×10                          | none  | 14    | 2       | 11     |
| Summer | × facts to 10×10, + and − within 200 with regrouping   | 20s   | 16    | 3       | 13     |
| Autumn | 2-digit × 1-digit, + and − within 1000 with regrouping | 18s   | 18    | 4       | 15     |
| Winter | Two-step problems, 2-digit × 1-digit, − within 1000    | 15s   | 20    | 5       | 17     |

Demands are tuned against the **Banana Slug**, who collects 2 from a glowing
space rather than 3, because her handicap grows with the number of glowing
spaces and that number grows every season. Each demand sits near 68% of a
perfect run for her and 57–61% for everyone else, so the ratio eases slightly
across the year while the demand _number_ rises. That is deliberate: escalation
should come from harder maths and a tighter clock, not from needing a higher hit
rate as well. See
[Retune a season's difficulty](#retune-a-seasons-difficulty) for the invariant
the tests hold this to.

## Graphics

Undecided, and deliberately isolated rather than deferred. Everything visible
comes from an **art pack** in [`js/art/`](js/art/) — including the season
palettes — and no other module knows what anything looks like. The current pack
draws flat vector shapes in code: enough to be clearly a porcupine, not meant to
be final. Contract in [`js/README.md`](js/README.md#art--art), recipe at
[Replace the art](#replace-the-art).

## Answer input

Four choice buttons, not a keypad. Times Trail rejected multiple choice because
a one-in-four guess corrupts its per-fact mastery data — but Seasons has no
mastery model, it is an adventure, and large tap targets suit a shared iPad. If
Seasons ever grows a mastery model, revisit this.

Distractors are near misses rather than random numbers, because a random
distractor is trivially eliminated and teaches nothing. All the candidates are
derived from the answer alone — `answer ± 1`, `± 2`, `± 10`, `× 2`, `÷ 2`
rounded down, and the answer's digits reversed — and the first three distinct,
non-negative ones become the other buttons. The form kind only changes the
_order_: multiplication, division and two-step questions lead with the scaled
slips, everything else with the off-by-one ones. The generator never sees the
operands, so it cannot offer the answer to the wrong operation.

## Keyboard

Touch is the primary input; the keyboard is an accessibility fallback.

- **1–4** — choose the corresponding answer. Ignored when Cmd, Ctrl, or Alt is
  held, so browser shortcuts still work.
- **Tab** — move between controls; **Enter/Space** activates
- **j/k** — move between page links (site-wide; press **?** for the full list)

## How to change things

Ella redesigns this game as she has new ideas, so these are the paths that are
meant to stay cheap. Each recipe lists the files in the order to edit them and
names the tests that fail on purpose. Keep the game open while you work — see
[Seeing your change](#seeing-your-change).

### Retune a season's difficulty

Everything is in [`js/seasons.js`](js/seasons.js): `spaces`, `glowingAt`,
`demand`, `timerSeconds`, `forms`, `glowingForms`, `boss`. No other file carries
a difficulty number.

Move `demandText` with the demand — it spells the number out — and move the
demand with the trail length, because both bounds are fractions of `maxItems`
(one item per ordinary space, plus the character's `glowingItems` per glowing
one). `seasons.test.js` requires `demand ≤ 0.75 × maxItems` for **every**
character, which is the 25% headroom, and `demand > 0.5 × maxItems` so the trail
still matters. The Banana Slug is always the binding case: her glowing spaces
pay 2 instead of 3, and that handicap grows with the glowing count, which grows
every season. Update the [Difficulty](#difficulty) table above as well.

Expected failures: `seasons.test.js › maxItems › counts <season> at N items…`
(hand-written literals — recompute as `(spaces − glowing) + glowing × 3`, and
`× 2` for the Slug); `Journey.test.js › bossPosition` if `spaces` moved; and the
HUD sentence, hard-coded as `"0 of 11 roses — 11 to go"` and friends in
`GameUI.test.js` and `game.test.js` — a few dozen assertions for spring, two or
three for a later season. Genuine breakage looks different: `reachability` or
`difficulty escalation` in `seasons.test.js`, which also require the demand to
rise strictly spring→winter, the trail not to shorten, the timer not to loosen,
the glowing count not to fall, and `boss.rescue` to stay under the demand.

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

Expected failures when the roster grows: three checks in `characters.test.js`
built on `EXPECTED_IDS` and a roster length of four, three more in
`game.test.js` that count the character cards, and
`art.test.js › draws the character <id>` until the art entry exists — about half
a dozen in total. Invariant: `seasons.test.js` pairs every season with every
character, so a perk that drops `glowingItems` below 2 makes winter unreachable
at today's demands. Express a penalty perk as `penaltyScale`, never as a named
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

The tests are not quite free, though: `GameUI.test.js` and `game.test.js` run at
whatever the defaults are and assert the copy those produce. Measured once —
`GENTLE` five failures, `STEP_BACK` four, `ALWAYS_PASS` four, `END_RUN` one,
`BOSS_TRIES = 1` twelve — so treat those as orders of magnitude. Every one is an
expectation naming the old default, not a broken rule. Move the "**the current
default**" markers above too.

### Change the maths

Forms live in [`js/seasons.js`](js/seasons.js) — `forms` for ordinary spaces,
`glowingForms` for glowing ones, `boss.forms` for the boss — and
[`js/challenges/arithmetic.js`](js/challenges/arithmetic.js) owns what a form
_means_. The five kinds:

| Kind      | Parameters                   | Question                                                                      |
| --------- | ---------------------------- | ----------------------------------------------------------------------------- |
| `add`     | `max`, `borrow`              | a + b, sum at most `max`; `borrow` forces a carry                             |
| `sub`     | `max`, `borrow`              | a − b, never negative; `borrow` forces regrouping                             |
| `mul`     | `tables`, `upTo`, `twoDigit` | one operand from `tables`, the other 2..`upTo`, or 10..`upTo` with `twoDigit` |
| `div`     | `tables`, `upTo`             | exact only; the quotient is 2..`upTo`                                         |
| `twoStep` | `tables`, `upTo`, `max`      | a × b then + or − c, result 0..`max`                                          |

Two rules to keep. **Division never goes in `forms`** — Ella's rule is that it
is the hardest thing in a level, so it belongs in `glowingForms` and the boss,
and `seasons.test.js › keeps division off the ordinary spaces` enforces all
three halves of that. **Two-digit multiplication stays mental**: a small first
operand (2–6) and `upTo` no higher than 20, or it becomes written vertical maths
against a fifteen-second clock — an earlier tuning produced `7 × 83`. Nothing
enforces that second one; it is a convention in the `seasons.js` header.

`arithmetic.test.js` sweeps every form list the real seasons use, parsing each
prompt and recomputing it, and separately checks that no generator exceeds the
`max` its own form declares.

### Replace the art

A pack exports eight names: `id`, `name`, `palette`, `character`, `item`,
`scenery`, `villain`, `trailPath`. Signatures and return shapes are in
[`js/README.md`](js/README.md#art--art), and
[`js/art/placeholder.js`](js/art/placeholder.js) is the reference.

1. A new file in [`js/art/`](js/art/).
2. Two lines in [`js/art/index.js`](js/art/index.js): the `import`, and an entry
   in `PACKS`.
3. One string: `ART.PACK` in [`js/constants.js`](js/constants.js).

Nothing else moves; no other module knows what anything looks like. `art.test.js`'s
"fulfils the art-pack contract" block is written against the contract rather
than the placeholder's shapes, so pointing its `pack` constant at the new module
is the whole test plan. It demands a distinct drawing for every character id, a
distinct plain _and_ rare item for every season, scenery per season, a villain,
a fresh element on every call, and a `palette` returning only `--season-*`
properties with the same keys for every season. One caveat: a second pack is the
moment to move the `svg` helper out of the registry, which currently imports the
pack that imports it — see [`js/README.md`](js/README.md#dependency-direction).

### Add a new kind of challenge

A matching game or a word puzzle is a new module in
[`js/challenges/`](js/challenges/) exporting exactly two functions:

```js
generate(forms, rng) -> Question
check(question, given) -> boolean
```

A `Question` must carry `prompt` (a string to show) and `choices` (values to
render as buttons); GameUI renders those two and nothing else. Everything else
on it belongs to your module, and `forms` is opaque to the rest of the game, so
it can be any shape you like. Then: one entry in `CHALLENGES` in
[`js/challenges/index.js`](js/challenges/index.js), and on a season in
[`js/seasons.js`](js/seasons.js) set `challenge: "<name>"` and give it `forms`,
`glowingForms` and `boss.forms` in your shape.

**The one known leak.** `_onAnswer` in [`js/game.js`](js/game.js) reads
`state.question?.answer`, to tell `GameUI.flashAnswer` which button to mark
correct and to write "The answer was 42" into the feedback line. It is the only
place outside a challenge module that touches a field the seam calls private, so
a challenge whose answer is not a renderable scalar has to fix it first.

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
| The count sentence, wilt note, perk note, trail label                    | `renderHud` and `_updateTrail` in `js/GameUI.js`                          |
| "Glowing challenge" and "Boss challenge"                                 | `renderQuestion` in `js/GameUI.js`                                        |
| Summary-row labels on the result screen                                  | `renderResult` in `js/GameUI.js`                                          |
| Headings, the intro paragraph, top-bar titles                            | `index.html`                                                              |

Two suites pin copy, and both are meant to be updated with it: `game.test.js`
holds the exact feedback lines ("+1 rose", "3 everlasting roses!", "Double! +2
roses"), the result titles ("Spring complete", "Not quite enough", "The potion
is finished") and substrings of her paragraphs; `GameUI.test.js` holds the count
sentence, the wilt note, the question tags, and the perk and cost text on the
cards. `seasons.test.js` and `characters.test.js` only check the fields are
non-empty strings. If you touch `index.html`, `index.zh.json` holds Chinese for
five of its strings, matched by exact text — a stale key makes `npm run build`
warn `no match for "…"`.

## Seeing your change

```bash
npm run dev     # from the repo root; serves the source, no build step
```

Then open <http://localhost:8000/games/seasons/> and reload after each edit.

**Jump straight to a state.** The game restores whatever is in `localStorage`
under `seasonsProgress`, so any screen is one paste into the browser console and
a reload away:

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
  Land on an index in `glowingAt` to get a glowing challenge.
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
js/             # 13 modules; the dependency graph is in js/README.md
__tests__/      # 11 Jest suites
```

[`js/README.md`](js/README.md) is the canonical reference: what to read first,
the dependency graph, which modules are allowed to be impure, where a question
comes from, the three extension seams, and how the tests are organised. Two
things worth knowing before you open anything: `js/game.js` calls `start()` at
the bottom of the module, so importing it starts the game and `index.html` needs
no bootstrap call; and nothing calls `Math.random()`, so a run is reproducible
from its seed. `BaseGameUI.js` and `StorageManager.js` are shared with Number
Garden, Life Garden, and Times Trail, and live in `games/shared/`.

## Browser support and accessibility

Current Chrome, Firefox, Safari, and Edge. Uses ES modules, so it must be served
over HTTP rather than opened from the filesystem.

Fully keyboard navigable; focus moves to each screen's heading on navigation but
not between questions on the same screen, which would interrupt a screen reader
mid-sentence. `aria-live` covers the question and the feedback line, and
`#item-count` is a single `role="status"` sentence ("9 of 13 diamonds — 4 to
go") rather than separate nodes that announce as disconnected words. Answer
buttons carry `aria-label="Answer 1: 42"`, which makes the 1–4 shortcut
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

Real, and not yet fixed. **The countdown is not announced** — a screen-reader
user gets no warning that time is running out, and there is no setting to extend
or turn off the limit; three of the four seasons are timed, and the Sloth's +10
seconds is the only lever, buried in a choice made before the first question.
**The page can still scroll mid-question on a small phone**, because
`min-height: 100dvh` sets a floor rather than a ceiling; the target device is a
shared iPad, where it fits. **`save.unlocked` and `save.totals` are written but
never read** — there is no season picker and no stats screen, and both are the
obvious next features.

## Still to decide

Ella's, not mine:

- The two rules above.
- The Porcupine's perk. The comeback bonus is a placeholder so the slot is
  playable; it is hers to replace.
- The snake woman's name.
- Whether there is anything to spend collected items on, or whether the snake
  woman simply keeps them for the potion.

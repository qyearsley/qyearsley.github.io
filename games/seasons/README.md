# Seasons

A journey through four seasons. You choose an animal, walk a trail, and answer
maths questions to collect what a snake woman demands — roses in spring,
diamonds in summer, leaves in autumn, icicles in winter. Get one right and you
move forward. Get one wrong and you stay where you are, which costs you a
chance you cannot get back.

The game is Ella's idea. This is the foundation for it, not the finished thing.

## How it plays

**Choose an animal.** Four of them, and the choice matters — each one changes a
rule rather than just the picture:

|             | Perk                                                     | Cost                                         |
| ----------- | -------------------------------------------------------- | -------------------------------------------- |
| Banana Slug | Wrong answers never take anything away                   | Glowing challenges give 2 instead of 3       |
| Sloth       | 10 extra seconds on every timed question                 | —                                            |
| Phoenix     | Once a season, a wrong answer costs nothing              | Every other wrong answer hurts twice as much |
| Porcupine   | The first right answer after a wrong one is worth double | —                                            |

**Walk the trail.** Each space is a question. A correct answer collects an item
and moves you on. Scattered along the trail are **glowing spaces** — a harder
question, lit up, worth three items instead of one.

**Face the boss.** At the end of the trail the snake woman is waiting. If you
have what she asked for, the season is yours. If you are short, the boss
question can make up some of the gap. If it cannot, see below.

Seasons get harder in both directions at once: the maths steps up _and_ the
clock tightens, the demand rises, and more of the trail glows. Spring is
untimed addition and subtraction within 100 plus the 2s, 5s, and 10s. Winter is
two-step problems against a fifteen-second clock.

## Two rules that are not decided yet

Ella has not settled these, so the game implements every option and each is one
constant away. Both live in `RULES` in [`js/constants.js`](js/constants.js).
Change one, reload, play — nothing else needs to move, and the tests cover
every option.

**`RULES.WRONG_ANSWER`** — what a wrong answer costs:

- `GENTLE` — nothing. You stay put and the question changes. Good for a bad
  day, or a younger player.
- `WILT` — **the current default.** Your most recent item wilts: it stops
  counting toward the demand, but the _next_ correct answer revives it. Two
  wrong answers in a row and the first one is gone for good. Visible,
  recoverable, and it still stings.
- `STEP_BACK` — you move back a space and lose an item outright.

**`RULES.BOSS_FAILURE`** — what happens when the demand is missed and the boss
question is missed too:

- `RETRY_SEASON` — **the current default.** The season restarts. The frog is a
  joke, not an ending.
- `ALWAYS_PASS` — you continue with fewer items banked and an annoyed snake
  woman. No frustration, and no tension either.
- `END_RUN` — the whole run ends and you start from spring.

A character's `penaltyScale` multiplies whichever rule is active rather than
naming a specific punishment, so the roster stays meaningful while these are
being tried out.

## Difficulty

Pitched at third grade. If it is wrong, [`js/seasons.js`](js/seasons.js) is the
only file to change — it holds every difficulty number in the game.

|        | Maths                                  | Timer | Trail | Glowing | Demand |
| ------ | -------------------------------------- | ----- | ----- | ------- | ------ |
| Spring | +/− within 100, ×2 ×5 ×10              | none  | 14    | 2       | 11     |
| Summer | ×÷ facts to 10×10                      | 20s   | 16    | 3       | 13     |
| Autumn | 2-digit × 1-digit, +/− with regrouping | 18s   | 18    | 4       | 15     |
| Winter | Two-step problems                      | 15s   | 20    | 5       | 17     |

Demands are tuned against the **Banana Slug**, who collects 2 from a glowing
space rather than 3. Her handicap grows with the number of glowing spaces, and
that number grows every season, so a demand tuned to the other characters
squeezes her hardest exactly where the maths is already hardest. Each demand
sits near 70% of a perfect run for her, and around 60% for everyone else.

The ratio therefore eases slightly across the year while the demand _number_
rises. That is deliberate: the escalation comes from harder maths and a tighter
clock, and needing a higher hit rate on top of both is what makes a level unfair
rather than hard.

`seasons.test.js` asserts every demand is reachable by every character with at
least 25% headroom, so a retune cannot quietly make a season impossible.

## Graphics

Undecided, and deliberately isolated rather than deferred. Everything visible
comes from an **art pack** in [`js/art/`](js/art/), and no other module knows
what anything looks like. The current pack draws flat vector shapes in code —
enough to be clearly a porcupine, not meant to be final.

Replacing it is one new file exporting eight names, one line in
`js/art/index.js`, and one string in `constants.ART.PACK`. A pack backed by
image files would return `<image>` elements from the same functions; nothing in
the contract assumes the art is drawn rather than loaded. `art.test.js` holds a
contract test that a new pack has to satisfy.

Season palettes live in the art pack too, as CSS custom properties, so a
replacement pack can re-theme the whole game without touching the stylesheet.

## Answer input

Four choice buttons, not a keypad. Times Trail deliberately rejected multiple
choice because a one-in-four guess corrupts its per-fact mastery data — but
Seasons has no mastery model, it is an adventure, and large tap targets suit a
shared iPad. If Seasons ever grows a mastery model, revisit this.

Distractors are near misses — the answer to the wrong operation, an off-by-one
operand, a digit slip — rather than random numbers, because a random distractor
is trivially eliminated and teaches nothing.

## Keyboard

Touch is the primary input; the keyboard is an accessibility fallback.

- **1–4** — choose the corresponding answer
- **Tab** — move between controls; **Enter/Space** activates
- **j/k** — move between page links (site-wide; press **?** for the full list)

## For developers

### Structure

```
js/
├── game.js              # Page entry point and orchestrator; the only impure file
├── constants.js         # Every shared value, including the two rule switches; imports nothing
├── rng.js               # Seeded generator; the only source of randomness
├── characters.js        # The roster and what each perk does
├── seasons.js           # The four seasons: difficulty, collectibles, demands
├── Journey.js           # Trail spaces, positions, the boss position
├── GameState.js         # Every rule, as pure functions
├── storage.js           # Save shape plus localStorage via games/shared/
├── GameUI.js            # Every DOM write
├── challenges/
│   ├── index.js         # Challenge registry -- the seam for a non-maths challenge
│   └── arithmetic.js    # The first challenge type
└── art/
    ├── index.js         # Art-pack registry and the SVG helper
    └── placeholder.js   # Flat vector shapes

styles/
└── main.css             # The whole stylesheet, light and dark
```

`BaseGameUI.js` and `StorageManager.js` are shared with Number Garden, Life
Garden, and Times Trail, and live in `games/shared/`.

### The three seams

The point of the foundation, and the reason the module list looks the way it
does:

1. **Art** — `js/art/`. Described above.
2. **Challenge type** — `js/challenges/`. A season names a challenge by string,
   so a matching game or a word puzzle is a new module plus one string in a
   season definition. Nothing else changes shape.
3. **Character perks** — `js/characters.js`. Perks are data read by GameState,
   never code. There is no `if (character.id === "phoenix")` anywhere. A fifth
   animal is a new entry in the roster; a genuinely new _kind_ of effect is a
   new field in `DEFAULT_EFFECTS` plus the code in GameState that honours it.

### Determinism

Nothing calls `Math.random()`. A run carries a seed, and every question is
derived from `seed:season:questionsAsked`, so a whole run is reproducible from
one number. That is what makes the rules testable without stubbing globals, and
what lets `storage.js` persist a run without persisting the question.

`Date.now()` is called in exactly one place, `_freshSeed()` in `game.js`, to
pick the seed for a new run. Hard-code it to replay a run exactly.

### Testing

```bash
npm install                                # from repo root
npm test                                   # all tests, including this game
npm test -- --testPathPatterns seasons     # just this game
```

`js/game.js` exports nothing, so `game.test.js` drives it black-box through the
real `index.html`, matching how Times Trail tests its orchestrator.

## Browser support

Current Chrome, Firefox, Safari, and Edge. Uses ES modules, so it must be
served over HTTP rather than opened from the filesystem. Fully keyboard
navigable, with `aria-live` regions for the question and feedback, focus moved
to each screen's heading on navigation, and non-colour indicators wherever
colour carries meaning.

Built for a shared iPad: 64px tap targets, `100dvh` sizing so Safari's toolbars
cannot cause a scroll mid-question, and suppressed double-tap zoom, tap
highlight, and text selection. Follows the OS dark-mode preference unless the
site theme toggle overrides it. All animation is disabled under
`prefers-reduced-motion`.

Like Times Trail, this ships a `manifest.json` and works as a full-screen web
app, but no `apple-touch-icon` — iOS ignores SVG icons and this repo adds no
binary assets, so the home-screen icon is a snapshot of the page. To fix it,
add a 180×180 PNG at `games/seasons/apple-touch-icon.png` and one line to
`<head>`.

## Security and privacy

- Every node is built with `createElement` or `createElementNS` and every string
  written with `textContent`. `innerHTML` is not used anywhere in this game;
  `BaseGameUI.setHTML` exists but is deliberately never called.
- Progress is saved in `localStorage` under `seasonsProgress` and never leaves
  the device. The restart button in the top bar erases it after a confirmation.
- Saved data is treated as untrusted: every field is coerced back into range on
  load and unknown keys are dropped.
- No personal information, no cookies, no tracking, no external requests beyond
  the site's own stylesheet and scripts.

## Still to decide

Ella's, not mine:

- The two rules above.
- The Porcupine's perk. The comeback bonus is a placeholder so the slot is
  playable; it is hers to replace.
- The snake woman's name.
- Whether there is anything to spend collected items on, or whether the snake
  woman simply takes them.

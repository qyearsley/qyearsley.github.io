# Times Trail 🥾

A multiplication practice game for children. It covers the 36 core facts from
2×2 to 9×9, tracks which ones the player actually knows, and walks a token along
a trail as those facts get stronger.

Number Garden also has a multiplication area, but it teaches the concept with
small operands. This game builds fact fluency and keeps a per-fact record of how
that is going.

## Features

- **36 facts, not 78.** Operands 2 through 9 only, canonicalized so `7×8` and
  `8×7` share one record. Both orientations are still shown at random. 1s and
  10s are excluded -- they are rules, not recall.
- **Two practice modes:**
  - ⚡ **Quick Recall** -- `7 × 6 = ?`, answered on tiles or the keypad
  - 🔢 **Array Builder** -- grow a rectangle until it holds the target number of
    squares, which is the area model
- **Adaptive answer entry.** A weak fact gets four large multiple-choice tiles; a
  stronger fact gets the on-screen keypad, because picking one of four options
  proves less. This is derived from the fact's strength, never chosen by the
  player.
- **Deliberate wrong answers.** Tile distractors are near-misses drawn from the
  same tables (`6×7` → 36, 42, 48, 49), so guessing by number sense does not
  work.
- **Misses teach.** A wrong answer reveals the product, then shows the fact as a
  rows-of-columns array with the skip-count ticking through it. The same fact
  comes back three or four questions later. No points are ever lost.
- **Spaced repetition.** Each fact has a strength from 0 to 5 and a due date
  (immediately, 10 minutes, 1 day, 3 days, 7 days, 21 days). Strength decays by
  one point for every 14 days a fact stays overdue. Roughly 70% of questions come
  from weak or due facts and 30% from strong ones, and the same fact is never
  asked twice in a row.
- **Speed is measured, never shown.** The clock runs from the question appearing
  to the first tap or keypress, not to submit. A correct-but-slow answer is
  capped below mastered, because counting up is not recall.
- **The trail.** 40 spaces across 8 regions, one region per table family. The
  token moves one space per correct answer. A region opens when 60% of its facts
  are mastered -- so the trail cannot be walked by grinding 2×2 -- and when the
  token is held at a gate the game says what is still needed. Regions with no
  facts in the current difficulty are skipped rather than blocking the way.
- **Stars and gems.** Stars pay most for the facts the player knows least, with a
  bonus for typing the answer and a streak multiplier up to 3×. Gems come from
  milestones and are permanent trophies -- nothing spends them, and neither
  number is ever subtracted.
- **36 fact cards.** One per fact, going grey → colored → foiled as the fact
  strengthens. A foiled card and a mastered fact are the same thing.
- **8×8 fact map.** Tables 2-9 on both axes, each cell shaded by current
  strength, with pip glyphs and a legend so colour is never the only signal. The
  outlined diagonal is the squares.
- **Daily goal.** 20 facts a day, with a lenient streak: one missed day dims the
  flame but keeps the streak, two or more resets it.
- **Sessions end.** 20 questions, then a summary with the session's stars, gems,
  best streak, any new cards, and any milestone crossed.

Progress saves automatically after every answer.

### Not in this version

Card Match, Card Duel, Product Grid, Story Problems, Lightning Round, and Mixed
Practice are designed but not built -- see `docs/times-trail-plan.md`. There is no
sound yet either: `#start-button` is the intended iOS audio-unlock gesture when
sound arrives.

## Settings

Open settings with the ⚙️ button on the hub or on the play screen. There are
exactly two controls:

- **Difficulty:**
  - Explorer -- tables 2-5 (10 facts), tiles only, never the keypad
  - Adventurer -- tables 2-7 (21 facts), the default
  - Master -- all 36 facts, keypad from strength 2 rather than 3
  - Custom -- pick the tables yourself
- **Which tables?** -- eight toggles, shown only when difficulty is Custom.
  Custom means table families, so ticking 7 includes every fact with a 7 in it.
  The presets mean a ceiling instead: Explorer excludes `4×8` because 8 is not
  enabled. The last enabled table cannot be unticked.

A `sound` value is persisted in the save file but has no control and nothing
reads it, because there is no audio yet.

Answer entry, whether misses show a scaffold, and reduced motion are
deliberately not settings: the first two would corrupt the mastery data or the
teaching, and reduced motion is an OS preference handled in CSS.

## Keyboard Controls

Touch is the primary input; the keyboard is an accessibility fallback.

- **1, 2, 3, 4** -- select the matching answer tile
- **0-9** -- type a digit on the keypad (two digits maximum; the largest product
  is 81)
- **Enter** -- submit the typed answer
- **Backspace** or **Delete** -- delete the last digit, the same as the pad's
  **⌫** key
- **Escape** -- clear the whole entry (the only clear-all; there is no key for it
  on the pad)
- **Tab** -- move between controls; **Enter/Space** activates a focused button
- **j/k** -- move between page links (a site-wide shortcut; press **?** for the
  full list)

The tile and keypad shortcuts only fire while the play screen is showing, the
settings dialog is closed, and that entry method is the visible one.

## iPad notes

The game is built for a shared iPad. Tap targets are 68px (64px on narrow
screens) with 16px gaps, the play area is sized with `100dvh` so Safari's
toolbars cannot cause scrolling mid-round, and double-tap zoom, tap highlight,
text selection, and rubber-band scroll are all suppressed. Every control has a
visible pressed state, and the Array Builder resizes with +/- steppers rather
than a drag.

The page contains no text field. Answers are typed on a keypad drawn in the
page, so iOS never has anything to focus and never raises the system keyboard
over the question.

**Add to Home Screen.** The page ships a `manifest.json` and works as a
full-screen web app. It does **not** ship an `apple-touch-icon`, because iOS
ignores SVG icons and this repo adds no binary assets -- so the home-screen icon
is a snapshot of the page rather than a designed icon. To fix it, add a 180×180
PNG at `games/times-trail/apple-touch-icon.png` and one line to `<head>`:
`<link rel="apple-touch-icon" href="apple-touch-icon.png" />`.

## For Developers

See [js/README.md](js/README.md) for module architecture documentation.

### Structure

```
js/
├── game.js              # Page entry point and session orchestrator
├── constants.js         # Every shared value; imports nothing
├── facts.js             # The 36-fact set and canonicalization
├── MasteryModel.js      # Per-fact strength, decay, due dates, MasteryStore
├── FactSelector.js      # Which fact is asked next
├── distractors.js       # Near-miss options for the tiles
├── Journey.js           # Trail spaces, regions, mastery gates
├── Scoring.js           # Stars, gems, daily goal, streak calendar
├── Settings.js          # Difficulty presets and the active fact pool
├── storage.js           # Save shape plus localStorage via games/shared/
├── GameUI.js            # All DOM rendering
├── Keypad.js            # The in-page numeric keypad
├── EventManager.js      # DOM listeners to callbacks
└── modes/
    ├── index.js         # Mode registry and dispatcher
    ├── quickRecall.js   # "7 × 6 = ?"
    └── arrayBuilder.js  # Build a rectangle of N squares

styles/
└── main.css             # The whole stylesheet, light and dark
```

Base classes shared with Number Garden and Life Garden live in `games/shared/`:
`BaseGameUI.js` and `StorageManager.js`.

### Testing

Tests run from the repository root with the shared toolchain:

```bash
npm install                                     # from repo root
npm test                                        # all tests, including this game
npm test -- --testPathPatterns times-trail      # just this game
```

Every module has a test file except `js/game.js`, which is DOM glue and is
untested by repo convention -- the same split Number Garden uses. The other 15
modules are covered by 15 suites in `__tests__/`.

There are no debug or unlock query parameters; the game reads nothing from the
URL.

## Browser Support

Works in current Chrome, Firefox, Safari, and Edge. Uses ES modules, so it must
be served over HTTP rather than opened from the filesystem. Fully keyboard
navigable, with focus moved to each screen's heading on navigation, `aria-live`
regions for questions and feedback, and non-colour indicators wherever colour
carries meaning.

### Mobile Support

Built for iPad first; see [iPad notes](#ipad-notes) above. Layout adapts to
portrait, landscape, and narrow phone widths, and follows the OS dark-mode
preference unless the site theme toggle overrides it.

## Security & Privacy

- All dynamic content is created with `createElement` and written with
  `textContent`. `innerHTML` is used only to empty a container (`= ""`) and once
  for a static error message with no interpolation. No answer key is ever written
  into the markup.
- The only player input is taps and keypad digits, and digits are echoed as text,
  never as markup.
- Progress is saved in `localStorage` under `timesTrailProgress` and never leaves
  the device. "Start Fresh" on the title screen erases it after a confirmation.
- No personal information, no cookies, no tracking, no external requests beyond
  the site's own stylesheet and scripts.
- Saved data is treated as untrusted: every field is coerced back into range on
  load, and unknown keys are dropped.

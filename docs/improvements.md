# Improvements

> **Status: audited 2026-09-18 against `main` @ `3e8c21d` plus the uncommitted
> Number Garden theme work in the tree at the time** (five files: `index.html`,
> `js/GameUI.js`, `styles/common.css`, `styles/main.css`, and `styles/garden.css`
> deleted). Migrated from the unversioned `~/hobby/IMPROVEMENTS.md`, which
> covered seven repos at once and had drifted; every claim below was re-checked
> on this date.
>
> Two items that were open on arrival are already fixed by that uncommitted work
> — see `## In progress, uncommitted`. Re-audit once it lands.

This file is the maintenance backlog: defects, debt, test gaps and doc drift.
Blog post ideas live in [`blog-ideas.md`](blog-ideas.md). Per-feature design
docs are the `*-plan.md` files in this directory.

## At a glance

1. Turing Tape cannot un-complete a level — S · open
2. No installable game has a real `apple-touch-icon` — S · decision owed
3. `js/README.md` is missing for two of the five games — S · open

## Working on these

- Tests: `npm test` · Lint: `npx eslint .` · Build: `node build.js`
- Git hooks run the tests; see [`development.md`](development.md#git-hooks).
- Public repo. Never commit a work hostname, address, tool name or ticket ID.

## 1. Turing Tape cannot un-complete a level

**S · open**

`games/turing-tape/js/game.js:420` writes `completedLevels` to `localStorage`
under `STORAGE_KEY = "turingTape"` with no version key, and nothing in the UI
clears it — `doReset()` at `:368` resets the machine's tape, not the progress
set. Once a level is green it is green forever. Every other game on the site has
a way back to a clean state.

It cannot brick anything: the load at `:410` is inside a `try`. Add a clear
control, and a version key while the format is being touched anyway.

_Checked 2026-09-18: `grep -n "completedLevels\|STORAGE_KEY"
games/turing-tape/js/game.js`, and the `reset-btn` handler at `:429`, which
calls `doReset`._

## 2. No installable game has a real `apple-touch-icon`

**S · decision owed**

`number-garden`, `seasons` and `times-trail` each point `apple-touch-icon` at
their `icon.svg`. iOS ignores SVG there, so Add to Home Screen falls back to a
page snapshot. Each `index.html` already carries a comment saying exactly this.

The fix is one 180×180 PNG per game and one `href` change. The cost is the
repo's no-binary-assets convention, which is why this is a decision rather than
a chore.

_Checked 2026-09-18: `grep -rn "apple-touch-icon" games/*/index.html` — three
hits, all `href="icon.svg"`, each preceded by the comment._

## 3. `js/README.md` is missing for two of the five games

**S · open**

`times-trail`, `number-garden` and `seasons` each have a `js/README.md`
explaining their module layout. `life-garden` and `turing-tape` do not. All five
have a top-level `README.md`.

_Checked 2026-09-18: `ls games/*/js/README.md` returns three paths._

## In progress, uncommitted

Both were open items when this file was written, and both are already fixed in
the working tree by the Number Garden theme refactor. They are recorded here so
they are not re-raised, and so the next audit knows to confirm rather than
rediscover.

- **Number Garden loaded Google Fonts from a third party.** It was the only file
  on the site referencing `fonts.googleapis.com`, costing a render-blocking
  third-party round trip on the game most likely to be opened on an iPad over
  cellular. The two `preconnect` links and the `Quicksand` stylesheet link are
  gone from `index.html`. _Checked 2026-09-18: `grep -rn "fonts.googleapis"
games/` returns nothing._
- **Number Garden's dark mode covered the modal only** — three selectors in
  `common.css`, while `#game-container` was a hardcoded `rgb(255, 255, 255,
0.95)`, so a dark settings panel floated over a white game. The refactor moves
  theming onto CSS custom properties (`--ng-surface`, `--ng-surface-alt`,
  `--ng-error-bg`, `--theme-accent`) and the dark block now sets those variables
  and `body` at `main.css:1514-1568`, rather than patching three selectors.
  `#game-container` no longer sets a background colour. _Checked 2026-09-18:
  `grep -n "prefers-color-scheme\|data-theme" games/number-garden/styles/*.css`
  now hits `main.css` only._

## Settled

Landed 2026-09-05 unless noted. Suite went to 3,845 tests across 69 suites.

- Seasons: optional countdown behind a gear, animated weather driven by
  `AIR_ART` motion tags, and a focus trap in the new dialog.
- Number Garden: a wrong answer in "Type Answer" mode left the field and Submit
  dead; timeouts fired after navigating away; `d` on a settings `<select>`
  answered the question behind the modal; two fast Enters scored one question
  twice; the activity screen's body colour tinted every other screen; a corrupt
  save bricked the game permanently. All fixed.
- Life Garden: `5` selected a species the palette does not offer; ⌘R reset the
  grid; controls were ~24px on a drag-driven game; the whole persistence layer
  was dead code and `showGrid` existed twice.
- Turing Tape: ⌘R reset the machine; the nav highlighted by label rather than id.
- All three answer games: the site's `?` help overlay let answer keys through.
  `shared/nav.js` had published `__helpOverlayIsOpen` all along.
- Number Garden gained the manifest, icon and iOS meta tags it never had;
  Seasons gained its `apple-touch-icon` link.
- A markup-contract test over all five games' `index.html`, which found a
  divergence on each of the two occasions it was extended.
- Turing Tape's "(solved)" marker rendered as visible text, because
  `.visually-hidden` was used in a game whose stylesheets never defined it —
  introduced and caught within the same 2026-09-05 pass.

## Not looked at

**Nothing in this repo has been rendered in a browser.** Tests and linters pass,
but the visual work — the Seasons settings dialog, the roughly one hundred
CSS-animated SVG groups of falling weather on the winter trail, and now the
Number Garden theme refactor — has never been looked at on a real screen. The
weather and the refactor both want one look on an actual iPad.

The uncommitted work was read, not run. `npm test` was not executed against it.

One pre-existing commit, `0f300d7` (2025-02-20), carries the work email address.
Rewriting it means rewriting every commit after it and force-pushing a public
repo, and would not remove anything — GitHub keeps orphaned commits reachable by
SHA. Left alone deliberately.

---

**Conventions**

- Size: `S` under an hour · `M` half a day · `L` more, or needs a design
  decision.
- State: `open` · `decision owed` · `blocked on <thing>`.
- `## At a glance` is the only place an item is restated. Renumber it in the same
  edit that renumbers a section.
- Every claim carries a `_Checked:_` line. If you change a claim, change its
  evidence. Say when something was not verified.

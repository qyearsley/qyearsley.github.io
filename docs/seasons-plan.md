# Seasons -- Design Notes

Living notes for `games/seasons/`. The README describes what the game **is** and
how to change it; this file holds what is **not settled**: the decisions that are
Ella's to make, the direction the next phase is heading, and the polish that was
consciously deferred rather than missed.

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

2. **What is the snake woman called?** She has a personality, a crown and a
   potion, and no name.

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

- **The result screen is a table.** After fifteen questions of gathering roses,
  the payoff is five rows of numbers. The art pack already draws the
  collectibles; showing them being counted into her jar is the obvious win, and
  the one most likely to make finishing a season feel like something.
- **Nothing frames that there are four seasons.** No picker, no "Spring, 1 of 4".
  `save.unlocked` is recorded and never surfaced, which is most of a season
  picker already done.
- **Item pips are small.** 19px, and sixteen-plus empty rings in the later
  seasons read as a dotted line rather than as what she still owes.
- **Lifetime totals are recorded and never shown.** `save.totals` counts runs,
  seasons and questions; the character screen is the natural home.
- **~2s between questions** (a 900ms flash plus up to 1150ms of crossing). A tap
  skips the crossing but not the flash, so the instinct to hurry only half works.
- **Winter is the least distinctive season** despite being the climax: no snow on
  the ground or the trees, and the palest palette.
- **`obstacles.verb`** ("climbs", "crosses") is defined and unread. It exists so a
  crossing can be described in words -- the trail's label currently uses the
  obstacle's name instead.

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
  Nothing enforces either; a retune could quietly cross both.
- **`npm test -- --testPathPatterns seasons` also collects a stale copy** under
  `.claude/worktrees/`. `npx jest --roots="<rootDir>/games/seasons"` is the
  precise form.

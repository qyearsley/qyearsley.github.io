/**
 * Rendering layer for Times Trail. Every view model in the game is turned into
 * DOM here, and this is the only module that writes game *content* into the
 * page. It is not the only module that touches `document`: `EventManager.js`
 * binds the listeners, `Keypad.js` builds and owns its own twelve keys, and
 * `game.js` reaches into the document in four narrow places (finding the tapped
 * tile by value, toggling `aria-live` while a scaffold teaches, looking up the
 * `#keypad` container once, and building the one-time save-failure banner). The
 * rule is narrower than "nothing else touches `document`": nothing else renders
 * a view model.
 *
 * Architecture: `GameUI` extends the shared `BaseGameUI` and contains no game
 * rules whatsoever. `game.js` computes, then hands this class plain view models
 * (the `@typedef`s below) built from already-decided numbers and strings. That
 * is why this file imports only `BaseGameUI`, `constants.js`, and `facts.js`:
 * the dependency graph forbids the UI layer from reaching into `Journey.js`,
 * `Scoring.js`, `MasteryModel.js`, or any `modes/` module, so it cannot recompute
 * -- and therefore cannot disagree with -- anything the core modules decided.
 *
 * Lifetimes: per-answer feedback (`showFeedback`, `flyStars`) is cleared by the
 * next `renderQuestion`. There is deliberately no gate message: explaining a
 * stopped trail in words meant naming facts the game then did not ask, because
 * selection ignores the token's position. `FactSelector.setPriorityFacts` biases
 * the draw toward those facts instead, so the gate opens on its own and needs no
 * sentence.
 *
 * The overrides below exist because the base behaviour is wrong for this page
 * rather than merely incomplete:
 *   - `showFeedback` / `hideFeedback`: the base assigns `className`, which
 *     destroys `.feedback-area` and `.hidden`, and hides by setting inline
 *     opacity, which leaves stale text in the layout and in the `aria-live`
 *     region forever. These use `classList` only.
 *   - `showScreen`: the base only toggles `.active`, so the button that was just
 *     tapped ends up inside a `display: none` screen and focus falls to `<body>`
 *     with nothing announced. This focuses the new screen's heading.
 *   - `updateProgressBar`: the base writes width and text only, leaving
 *     `aria-valuenow` frozen at its markup value for the whole session.
 *   - `updateTitleButtons`: the base knows only about Continue and Start Fresh,
 *     and this game has a third save-dependent title button.
 *
 * Error Handling: every method looks its target element up defensively and
 * returns without throwing when it is absent, matching `BaseGameUI`'s style.
 * Constructing a `GameUI` against an empty `document.body` is safe, and so is
 * calling every render method afterwards -- a missing element is never fatal.
 *
 * Security Note: this class uses `innerHTML` only to clear a container
 * (`= ""`). Every piece of dynamic content is created with
 * `document.createElement` and written with `textContent`, and all of it comes
 * from controlled game data -- frozen constant tables, the 36-fact set, and
 * numbers computed by the game's own pure modules -- never from user input.
 * There is no code path by which anything a player types can be interpreted as
 * markup.
 */

import { BaseGameUI } from "../../shared/BaseGameUI.js"
import {
  ALL_TABLES,
  ANSWER_KEYS,
  INPUT_MODE,
  KEYPAD,
  MATH,
  OPERAND_MAX,
  OPERAND_MIN,
  SESSION,
  STRENGTH,
  TIMING,
  TOKEN_EMOJI,
  TOTAL_FACTS,
  TRAIL,
} from "./constants.js"
import { FACT_IDS, getFactFor } from "./facts.js"

/**
 * Feedback type classes this game's stylesheet colours. Listed so a show or
 * hide can remove all of them without touching `.feedback-area` or `.hidden`.
 * `correct` and `incorrect` get their own colour; any other type (`info`,
 * `encourage`) simply inherits the body ink, so no rule is needed for it.
 * @private
 * @type {readonly string[]}
 */
const FEEDBACK_TYPES = Object.freeze(["correct", "incorrect", "encourage", "info"])

/**
 * Card art tiers in improving order, so "at least colored" is a rank comparison
 * rather than a list of string equality tests.
 * @private
 * @type {Map<string, number>}
 */
const CARD_TIER_RANK = new Map([
  ["grey", 0],
  ["colored", 1],
  ["foiled", 2],
])

/**
 * Non-colour tier indicator for a fact card, keyed by tier. Grey and colored
 * cards used to differ by background colour alone, which fails WCAG 1.4.1 the
 * same way the fact map's colours would without its pips.
 * @private
 * @type {Readonly<Object<string, string>>}
 */
const CARD_PIPS = Object.freeze({ grey: "·", colored: "▪▪", foiled: "★" })

/**
 * The collection legend, in reading order: the three card tiers paired with
 * words, so the pips and the colours both mean something.
 * @private
 * @type {readonly {tier: string, label: string}[]}
 */
const CARD_LEGEND = Object.freeze([
  Object.freeze({ tier: "grey", label: "Not yet" }),
  Object.freeze({ tier: "colored", label: "Getting there" }),
  Object.freeze({ tier: "foiled", label: "Mastered" }),
])

/**
 * Non-colour strength indicators, indexed by strength 0-5. Colour alone must
 * never convey strength (WCAG 1.4.1), and these also make the fact map readable
 * in the dark theme.
 * @private
 * @type {readonly string[]}
 */
const MASTERY_PIPS = Object.freeze(["·", "▪", "▪▪", "▪▪▪", "★", "★★"])

/**
 * Legend text for each strength 0-5, pairing the colour swatch and the pip with
 * words. Distinct from a cell's `tierLabel`, which names the coarser mastery
 * tier used in the cell's `aria-label`.
 * @private
 * @type {readonly string[]}
 */
const MASTERY_STRENGTH_LABELS = Object.freeze([
  "new",
  "learning",
  "getting there",
  "strong",
  "very strong",
  "mastered",
])

/**
 * The four trail-space states the trail legend explains, in reading order. An
 * empty `className` is the plain, walkable space.
 * @private
 * @type {readonly {className: string, label: string, token: boolean}[]}
 */
const TRAIL_LEGEND_STATES = Object.freeze([
  Object.freeze({ className: "trail-space-current", label: "You are here", token: true }),
  Object.freeze({ className: "", label: "Open", token: false }),
  Object.freeze({ className: "trail-space-locked", label: "Locked", token: false }),
  Object.freeze({ className: "trail-space-skipped", label: "Skipped", token: false }),
])

/**
 * Opacity applied to `#flame-display` when the streak is at risk. Inline rather
 * than a class because the stylesheet defines no dimmed-flame rule, and a class
 * nothing styles renders as no change at all.
 * @private
 * @type {string}
 */
const DIMMED_FLAME_OPACITY = "0.45"

/**
 * Fact id -> index in `FACTS`, so the collection can be rendered in the
 * canonical fact order regardless of the order `game.js` happens to build the
 * card views in.
 * @private
 * @type {Map<string, number>}
 */
const FACT_ORDER = new Map(FACT_IDS.map((id, index) => [id, index]))

/**
 * Hub-screen HUD. Lifetime numbers.
 * @typedef {Object} HudData
 * @property {number} starsTotal - LIFETIME stars. Written to `#star-count`.
 * @property {number} gemsTotal - LIFETIME gems. Written to `#gem-count`.
 * @property {number} streakDays - Daily-goal streak in DAYS, not answers.
 * @property {{index: number, id: string, emoji: string, dimmed: boolean}} flame - Flame stage.
 * @property {string} regionName - Name of the region the token stands in.
 */

/**
 * Play-screen HUD. Session numbers.
 * @typedef {Object} PlayHudData
 * @property {number} sessionStars - Stars earned THIS session. Written to `#play-star-count`.
 * @property {number} sessionStreak - Consecutive correct answers THIS session.
 */

/**
 * The one-row trail indicator on the play screen.
 * @typedef {Object} PlayTrailStripView
 * @property {string} regionName - Current region's name.
 * @property {string} regionEmoji - Current region's emoji.
 * @property {number} spacesInRegion - Always `TRAIL.SPACES_PER_REGION`.
 * @property {number} indexInRegion - 0-4, the token's position within this region.
 * @property {boolean} gated - Whether the next space is behind a locked region.
 */

/**
 * One region as the trail screen draws it.
 * @typedef {Object} TrailRegionView
 * @property {string} id - Region id.
 * @property {string} name - Region name.
 * @property {string} emoji - Region emoji.
 * @property {number} startSpace - Index of the region's first space.
 * @property {number} spaces - How many spaces the region holds.
 * @property {boolean} unlocked - Whether the region has been reached.
 * @property {number} mastered - Facts mastered in this region.
 * @property {number} required - Facts needed to leave this region.
 * @property {boolean} skipped - Whether the region was walked past unmastered.
 */

/**
 * The whole trail.
 * @typedef {Object} TrailView
 * @property {number} space - The token's space index.
 * @property {number} totalSpaces - Total spaces on the trail.
 * @property {TrailRegionView[]} regions - Regions in walking order.
 * @property {string} tokenEmoji - Always `TOKEN_EMOJI`; no cosmetics in Phase 1.
 */

/**
 * One cell of the 8x8 fact map. `strength` is the DECAYED strength, the same
 * number that drives the card tier, so map and collection cannot disagree.
 * @typedef {Object} MasteryCell
 * @property {number} row - 2-9.
 * @property {number} col - 2-9.
 * @property {string} factId - Canonical fact id.
 * @property {number} strength - 0-5, decayed.
 * @property {boolean} isSquare - Whether this is a diagonal cell.
 * @property {number} product - For the `aria-label`.
 * @property {string} tierLabel - "new" | "weak" | "strengthening" | "mastered".
 */

/**
 * One collectible fact card.
 * @typedef {Object} CardView
 * @property {string} factId - Canonical fact id.
 * @property {number} a - Smaller operand.
 * @property {number} b - Larger operand.
 * @property {number} product - a * b.
 * @property {"grey"|"colored"|"foiled"} tier - Card art tier.
 * @property {boolean} isNew - Whether the tier improved this session.
 */

/**
 * Everything the session summary shows.
 * @typedef {Object} SummaryView
 * @property {number} stars - Stars earned THIS session.
 * @property {number} gems - Gems earned THIS session.
 * @property {number} factsCorrect - Correct answers this session.
 * @property {number} factsAnswered - Questions answered this session.
 * @property {number} bestStreak - Longest correct run this session.
 * @property {CardView[]} newCards - Cards that improved tier this session.
 * @property {string|null} newRegionName - Newly reached region, or `null`.
 * @property {string[]} milestoneLabels - Gem milestones crossed this session.
 * @property {boolean} goalJustMet - Whether today's goal was met this session.
 */

/**
 * The two settings controls the modal renders.
 * @typedef {Object} SettingsData
 * @property {number[]} tables - Tables checked in the picker.
 * @property {number} sessionLength - Questions per session.
 */

/**
 * The post-miss teaching array. Deliberately NOT tied to the challenge's `left`
 * and `right`: the scaffold is built from `min`/`max` of the fact's operands, so
 * a question shown as `9 × 2` teaches a two-row array. See `modes/shared.js`.
 * @typedef {Object} Scaffold
 * @property {number} rows - The smaller operand, so the array is never nine rows tall.
 * @property {number} cols - The larger operand.
 * @property {number} product - rows * cols.
 * @property {number[]} skipCounts - `[cols, 2*cols, ..., rows*cols]`.
 * @property {string} text - e.g. "6 rows of 7 makes 42".
 */

/**
 * One question, as a mode built it. Only the fields this class reads are listed;
 * `check` and the rest belong to `game.js`.
 * @typedef {Object} Challenge
 * @property {string} prompt - e.g. "7 × 6 = ?".
 * @property {"tiles"|"keypad"} entry - Which entry affordance to show.
 * @property {number[]|null} options - Four distinct integers for tiles, else `null`.
 */

/**
 * Clamp a value to an integer strength in [0, STRENGTH.MAX].
 * @private
 * @param {unknown} value - Candidate strength, possibly absent or fractional
 * @returns {number} An integer in [0, STRENGTH.MAX]
 */
function clampStrength(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return STRENGTH.MIN
  return Math.min(Math.max(Math.round(numeric), STRENGTH.MIN), STRENGTH.MAX)
}

/**
 * A positive integer, or a fallback when the input is not one.
 * @private
 * @param {unknown} value - Candidate count
 * @param {number} fallback - Value to use when `value` is not a positive integer
 * @returns {number} `value` when it is a positive integer, else `fallback`
 */
function positiveIntOr(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback
}

/**
 * `FACTS`-order sort key for a card view. Unknown ids sort last rather than
 * throwing, so a stale save cannot blank the collection screen.
 * @private
 * @param {CardView} card - Card view
 * @returns {number} Index in `FACTS`, or a sentinel past the end
 */
function factOrderOf(card) {
  const index = FACT_ORDER.get(card && card.factId)
  return index === undefined ? FACT_IDS.length : index
}

/**
 * Rank of a card tier, so "at least colored" is one comparison. An unknown tier
 * ranks as grey rather than throwing, so a stale save cannot blank the
 * collection screen.
 * @private
 * @param {unknown} tier - Candidate tier name
 * @returns {number} 0 for grey or unknown, 1 for colored, 2 for foiled
 */
function cardTierRank(tier) {
  const rank = CARD_TIER_RANK.get(tier)
  return rank === undefined ? 0 : rank
}

export class GameUI extends BaseGameUI {
  constructor() {
    super()
    this.elements = this.cacheElements()

    /**
     * Pending `flyStars` cleanup, so a second correct answer restarts the
     * animation instead of leaving the element stuck mid-flight.
     * @private
     * @type {number|null}
     */
    this._starFlyTimeout = null
  }

  /**
   * Cache every element this game addresses by id, plus the base class's common
   * elements. Called once from the constructor.
   * @returns {Object} Cached DOM elements; any missing id is `null`
   */
  cacheElements() {
    return {
      ...this.cacheCommonElements(),

      // Title screen
      titleScreen: document.getElementById("title-screen"),
      titleHeading: document.getElementById("title-heading"),

      // Hub screen
      hubScreen: document.getElementById("hub-screen"),
      hubHeading: document.getElementById("hub-heading"),
      homeButton: document.getElementById("home-button"),
      hud: document.getElementById("hud"),
      starCount: document.getElementById("star-count"),
      gemCount: document.getElementById("gem-count"),
      flameDisplay: document.getElementById("flame-display"),
      hubRegionName: document.getElementById("hub-region-name"),
      modeQuickRecall: document.getElementById("mode-quick-recall"),
      trailButton: document.getElementById("trail-button"),
      mapButton: document.getElementById("map-button"),
      collectionButton: document.getElementById("collection-button"),

      // Play screen
      playScreen: document.getElementById("play-screen"),
      playHeading: document.getElementById("play-heading"),
      playStarCount: document.getElementById("play-star-count"),
      playStreak: document.getElementById("play-streak"),
      playSettingsButton: document.getElementById("play-settings-button"),
      progressBar: document.getElementById("progress-bar"),
      progressText: document.getElementById("progress-text"),
      playTrailStrip: document.getElementById("play-trail-strip"),
      playArea: document.getElementById("play-area"),
      progressButton: document.getElementById("progress-button"),
      questionText: document.getElementById("question-text"),
      answerTiles: document.getElementById("answer-tiles"),
      answerDisplay: document.getElementById("answer-display"),
      keypad: document.getElementById("keypad"),
      scaffoldArea: document.getElementById("scaffold-area"),
      scaffoldArray: document.getElementById("scaffold-array"),
      scaffoldCounts: document.getElementById("scaffold-counts"),
      scaffoldText: document.getElementById("scaffold-text"),
      scaffoldContinue: document.getElementById("scaffold-continue"),
      feedbackArea: document.getElementById("feedback-area"),
      starFly: document.getElementById("star-fly"),

      // Summary screen
      summaryScreen: document.getElementById("summary-screen"),
      summaryTitle: document.getElementById("summary-title"),
      playAgainButton: document.getElementById("play-again-button"),
      summaryHubButton: document.getElementById("summary-hub-button"),
      summaryStars: document.getElementById("summary-stars"),
      summaryGems: document.getElementById("summary-gems"),
      summaryCorrect: document.getElementById("summary-correct"),
      summaryStreak: document.getElementById("summary-streak"),
      summaryGoal: document.getElementById("summary-goal"),
      summaryRegion: document.getElementById("summary-region"),
      summaryMilestones: document.getElementById("summary-milestones"),
      summaryMilestonesGroup: document.getElementById("summary-milestones-group"),
      summaryCards: document.getElementById("summary-cards"),
      summaryCardsGroup: document.getElementById("summary-cards-group"),

      // Trail screen
      trailScreen: document.getElementById("trail-screen"),
      trailHeading: document.getElementById("trail-heading"),
      trailBackButton: document.getElementById("trail-back-button"),
      trailSpaces: document.getElementById("trail-spaces"),
      trailLegend: document.getElementById("trail-legend"),

      // Fact map screen
      mapScreen: document.getElementById("map-screen"),
      mapHeading: document.getElementById("map-heading"),
      mapBackButton: document.getElementById("map-back-button"),
      masteryGrid: document.getElementById("mastery-grid"),
      masteryLegend: document.getElementById("mastery-legend"),

      // Collection screen
      collectionScreen: document.getElementById("collection-screen"),
      collectionHeading: document.getElementById("collection-heading"),
      collectionBackButton: document.getElementById("collection-back-button"),
      collectionCount: document.getElementById("collection-count"),
      collectionCards: document.getElementById("collection-cards"),
      collectionLegend: document.getElementById("collection-legend"),

      // Settings modal
      sessionLengthSelect: document.getElementById("session-length-select"),
      poolSize: document.getElementById("pool-size"),
      tableToggles: ALL_TABLES.map((table) => ({
        table,
        input: document.getElementById(`table-${table}`),
        label: document.querySelector(`label[for="table-${table}"]`),
      })),
    }
  }

  // ---------------------------------------------------------------- HUD

  /**
   * Write the hub HUD's lifetime numbers. Deliberately never touches
   * `#play-star-count` or `#play-streak` -- each id has exactly one writer.
   * @param {HudData} hud - Hub HUD view model
   * @returns {void}
   */
  updateHud(hud) {
    if (!hud) return
    const { starCount, gemCount, flameDisplay, hubRegionName } = this.elements

    if (starCount) starCount.textContent = String(hud.starsTotal)
    if (gemCount) gemCount.textContent = String(hud.gemsTotal)

    if (flameDisplay) {
      const flame = hud.flame || null
      flameDisplay.textContent = flame ? flame.emoji : ""
      // The emoji alone says nothing to a screen reader, so the day count rides
      // along in the label -- it has no visible element of its own.
      const days = Number(hud.streakDays) || 0
      flameDisplay.setAttribute(
        "aria-label",
        `Daily streak: ${days} ${days === 1 ? "day" : "days"}`,
      )
      flameDisplay.style.opacity = flame && flame.dimmed ? DIMMED_FLAME_OPACITY : "1"
    }

    if (hubRegionName) hubRegionName.textContent = hud.regionName ? String(hud.regionName) : ""
  }

  /**
   * Write the play screen's session numbers. Deliberately never touches
   * `#star-count` or `#gem-count`.
   * @param {PlayHudData} playHud - Play HUD view model
   * @returns {void}
   */
  updatePlayHud(playHud) {
    if (!playHud) return
    const { playStarCount, playStreak } = this.elements
    if (playStarCount) playStarCount.textContent = String(playHud.sessionStars)
    if (playStreak) playStreak.textContent = `Streak ${playHud.sessionStreak}`
  }

  /**
   * OVERRIDES `BaseGameUI.updateProgressBar`, which writes only the width and
   * the text and so leaves `aria-valuenow` frozen at its markup value -- a
   * screen reader would report 0/20 for the entire session.
   *
   * `total` defaults to `SESSION.DEFAULT_LENGTH` only as a floor; the session
   * length is a setting, so `game.js` passes `settings.sessionLength` and this
   * default is never what a real session uses.
   * @param {number} current - Questions answered so far
   * @param {number} [total] - Questions in the session
   * @returns {void}
   */
  updateProgressBar(current, total = SESSION.DEFAULT_LENGTH) {
    super.updateProgressBar(current, total, MATH.PERCENT_MULTIPLIER)
    const bar = this.elements.progressBar
    if (!bar) return
    bar.setAttribute("aria-valuenow", String(current))
    bar.setAttribute("aria-valuemax", String(total))
  }

  /**
   * OVERRIDES `BaseGameUI.updateTitleButtons`, which toggles only Continue and
   * Start Fresh.
   *
   * `#progress-button` is the title screen's route to the hub, and it exists
   * because Play now starts a session directly: without it the trail, cards, and
   * fact map were reachable only by finishing a session or by abandoning one
   * through the "Leave this round?" confirm. It is hidden on a fresh save for the
   * same reason Continue is -- there is no progress to look at yet.
   * @param {boolean} hasSavedProgress - Whether a save exists
   * @returns {void}
   */
  updateTitleButtons(hasSavedProgress) {
    super.updateTitleButtons(hasSavedProgress)
    this.setVisible(this.elements.progressButton, Boolean(hasSavedProgress))
  }

  /**
   * Show the "+N ⭐" reward rising out of the play area. The CSS transition does
   * the movement; this only toggles classes and schedules the reset. A pending
   * flight is cancelled and restarted so a fast second correct answer cannot
   * leave the element stranded mid-air.
   *
   * The layout read between the two class changes is load-bearing, not a
   * leftover. `.hidden` is `display: none !important`, so removing it and adding
   * `.star-fly-active` in the same tick gave the browser no before-state to
   * transition from: the element jumped straight to `opacity: 0` and was hidden
   * again 600ms later, having never been visible. Reading `offsetWidth` forces
   * the style and layout flush that makes the start state real. (Plain DOM
   * rather than `requestAnimationFrame`, which is not in this repo's eslint
   * globals allowlist.)
   * @param {number} amount - Stars just earned
   * @returns {void}
   */
  flyStars(amount) {
    const el = this.elements.starFly
    if (!el) return

    if (this._starFlyTimeout !== null) {
      clearTimeout(this._starFlyTimeout)
      this._starFlyTimeout = null
    }

    el.textContent = `+${amount} ⭐`
    el.classList.remove("star-fly-active")
    el.classList.remove("hidden")
    void el.offsetWidth
    el.classList.add("star-fly-active")

    this._starFlyTimeout = setTimeout(() => {
      this._starFlyTimeout = null
      el.classList.remove("star-fly-active")
      el.classList.add("hidden")
    }, TIMING.STAR_FLY_MS)
  }

  // ------------------------------------------------------------- Screens

  /**
   * OVERRIDES `BaseGameUI.showScreen`, which only toggles `.active`. That leaves
   * focus on the button that was just tapped -- now inside a `display: none`
   * screen -- so focus collapses to `<body>` and the screen change is completely
   * silent to a screen reader. Every screen heading carries `tabindex="-1"`
   * (§ 15) so it can take focus without joining the tab order.
   * @param {string} screenId - Screen element id
   * @returns {void}
   */
  showScreen(screenId) {
    super.showScreen(screenId)
    // Belt and braces: every route out of a live scaffold goes through
    // hideScaffold today, but a screen change with `.teaching` stranded would
    // silently compact the next scaffold's layout forever.
    if (screenId !== "play-screen") this._setTeaching(false)
    const screen = document.getElementById(screenId)
    if (!screen) return
    const heading = screen.querySelector("h1, h2")
    if (!heading) return
    heading.focus()
  }

  // ------------------------------------------------------------ Question

  /**
   * Render a question and show exactly one way to answer it.
   *
   * Everything is reset unconditionally first -- including *hiding* the tiles
   * container rather than merely emptying it. An empty but visible
   * `#answer-tiles` still occupied its `.play-area` row and pushed the keypad
   * off centre, and stale tiles left in place stayed clickable through a keypad
   * question. `#answer-display` is hidden the same way: it is the keypad's
   * readout, and left visible it printed a 3rem "?" on tile questions, where
   * nothing types into it.
   * @param {Challenge} challenge - The question to show
   * @returns {void}
   */
  renderQuestion(challenge) {
    if (!challenge) return

    this.setText("question-text", challenge.prompt)

    this.hideScaffold()
    this.hideFeedback()

    this.clearTiles()
    this.setTilesVisible(false)
    this.setKeypadVisible(false)
    this.setAnswerDisplay(KEYPAD.EMPTY_DISPLAY)
    this.setAnswerDisplayVisible(false)

    if (challenge.entry === INPUT_MODE.TILES) {
      this.renderTiles(challenge.options)
      this.setTilesVisible(true)
    } else if (challenge.entry === INPUT_MODE.KEYPAD) {
      this.setAnswerDisplayVisible(true)
      this.setKeypadVisible(true)
    } else {
      // A question with no way to answer it is a bug worth a warning, not a
      // silently blank screen.
      console.warn(`renderQuestion: unknown entry mode ${JSON.stringify(challenge.entry)}`)
    }
  }

  /**
   * Build the multiple-choice tiles. Takes only the options: correctness has one
   * authority, `challenge.check`, so no `data-correct` attribute is ever written
   * -- the answer key never goes into the page where it can be inspected.
   *
   * The class must stay `answer-btn` so the inherited `disableAnswerButtons` /
   * `enableAnswerButtons` work unmodified.
   * @param {number[]} options - Answer options, in display order
   * @returns {void}
   */
  renderTiles(options) {
    const container = this.elements.answerTiles
    if (!container) return
    container.innerHTML = ""
    if (!Array.isArray(options)) return

    options.forEach((option, index) => {
      const button = document.createElement("button")
      button.type = "button"
      button.className = "answer-btn"
      button.textContent = String(option)
      button.dataset.answer = String(option)
      button.dataset.index = String(index)
      // The keyboard shortcut, written twice for two audiences: `aria-label`
      // says it out loud, and `data-key` is what the stylesheet prints in the
      // tile's corner -- only where there is a real pointer, so nothing is drawn
      // on the iPad, where no shortcut exists. It stays out of `textContent` so
      // the tile's face is exactly the number.
      //
      // A letter, from `ANSWER_KEYS`, because every tile face is a number and a
      // digit in the corner reads as part of one. A tile past the end of that
      // list -- `OPTION_COUNT` is 4, but `generateOptions` accepts up to 8 --
      // gets no key and an unlettered label rather than an invented letter.
      const key = ANSWER_KEYS[index] ? ANSWER_KEYS[index].toUpperCase() : ""
      if (key) button.dataset.key = key
      button.setAttribute("aria-label", key ? `Answer ${key}: ${option}` : `Answer: ${option}`)
      container.appendChild(button)
    })
  }

  /**
   * Remove every tile, and with them any frozen reveal state. Visibility is a
   * separate concern -- see `setTilesVisible`.
   * @returns {void}
   */
  clearTiles() {
    const container = this.elements.answerTiles
    if (!container) return
    container.innerHTML = ""
    container.classList.remove("answer-tiles-frozen")
  }

  /**
   * Keep the tiles on screen but inert, so the tile marked `.correct` is still
   * readable while the scaffold teaches.
   *
   * `game.js` calls this on the miss path INSTEAD OF `clearTiles()` +
   * `setTilesVisible(false)`. Those two ran in the same synchronous turn as the
   * marking, so `.incorrect`, `.shake`, and the correct-tile highlight were
   * detached before the browser ever painted them: a wrong tap produced no
   * acknowledgement at all and never showed which tile was right. The tiles sit
   * in the `entry` grid area and the scaffold in `extra`, so both fit on screen
   * at once.
   * @returns {void}
   */
  freezeTiles() {
    const container = this.elements.answerTiles
    if (!container) return
    this.setTilesVisible(true)
    container.classList.add("answer-tiles-frozen")
    container.querySelectorAll(".answer-btn").forEach((button) => {
      button.disabled = true
    })
  }

  /**
   * Show or hide the tiles container.
   * @param {boolean} visible - Whether tiles are the active affordance
   * @returns {void}
   */
  setTilesVisible(visible) {
    this.setVisible(this.elements.answerTiles, visible)
  }

  /**
   * Show or hide the keypad. `Keypad` owns its children; this owns visibility.
   * @param {boolean} visible - Whether the keypad is the active affordance
   * @returns {void}
   */
  setKeypadVisible(visible) {
    this.setVisible(this.elements.keypad, visible)
  }

  /**
   * Write the keypad readout, clearing any `.correct` state from the previous
   * answer. `#answer-display` is a `<p>`, never an `<input>`, so the iOS system
   * keyboard is never invoked; without this readout a tap on the keypad changed
   * nothing visible anywhere on screen.
   * @param {string} text - Digits typed so far, or `KEYPAD.EMPTY_DISPLAY`
   * @returns {void}
   */
  setAnswerDisplay(text) {
    const el = this.elements.answerDisplay
    if (!el) return
    el.classList.remove("correct")
    el.textContent = text === null || text === undefined ? KEYPAD.EMPTY_DISPLAY : String(text)
  }

  /**
   * Show or hide the keypad readout. Only the keypad types into it, so on a
   * tiles question it would be a meaningless 3rem "?" taking up a row.
   * @param {boolean} visible - Whether the keypad is the active affordance
   * @returns {void}
   */
  setAnswerDisplayVisible(visible) {
    this.setVisible(this.elements.answerDisplay, visible)
  }

  /**
   * Mark the typed answer as correct: leave her digits on screen and paint them
   * green for the feedback beat.
   *
   * A correct keypad answer used to produce nothing at all -- no element marked
   * `.correct`, and the readout already reset to "?" -- so the 42 she typed
   * simply vanished. Because every strength-3+ fact routes to the keypad, that
   * was the dominant path exactly as she improved. The state is cleared by the
   * next `setAnswerDisplay`, which the next keypress and the next
   * `renderQuestion` both go through.
   * @param {string|number} [text] - Answer to show; defaults to whatever the readout already holds
   * @returns {void}
   */
  markAnswerDisplayCorrect(text = null) {
    const el = this.elements.answerDisplay
    if (!el) return
    if (text !== null && text !== undefined) el.textContent = String(text)
    this.setAnswerDisplayVisible(true)
    el.classList.add("correct")
  }

  // ------------------------------------------------------------ Feedback

  /**
   * OVERRIDES `BaseGameUI.showFeedback`, which does
   * `feedbackArea.className = "feedback " + type` -- an assignment that destroys
   * `.feedback-area` (and its reserved height) and `.hidden`, replacing them
   * with a `.feedback` class this game's stylesheet does not define. This uses
   * `classList` only and never touches inline opacity, which fought `.hidden`'s
   * `display: none` and left an invisible element still taking up space.
   * @param {string} message - Text to announce
   * @param {string} [type] - "correct" | "incorrect" | "encourage" | "info"
   * @returns {void}
   */
  showFeedback(message, type = "info") {
    const el = this.elements.feedbackArea
    if (!el) return
    el.textContent = message
    el.classList.remove(...FEEDBACK_TYPES)
    el.classList.add("feedback-area", type)
    el.classList.remove("hidden")
  }

  /**
   * OVERRIDES `BaseGameUI.hideFeedback`, which only sets `style.opacity = "0"`
   * -- so stale text stayed in the layout and in the `aria-live` region forever.
   * This clears the text and hides the element with `.hidden`, the game's single
   * visibility mechanism, while preserving `.feedback-area`.
   * @returns {void}
   */
  hideFeedback() {
    const el = this.elements.feedbackArea
    if (!el) return
    el.textContent = ""
    el.classList.remove(...FEEDBACK_TYPES)
    el.classList.add("feedback-area")
    el.classList.add("hidden")
  }

  // ------------------------------------------------------------ Scaffold

  /**
   * Show the post-miss teaching array: a rows x cols dot array, one skip-count
   * number per row, the sentence that names the product, and a real tap target
   * to dismiss it.
   * @param {Scaffold} scaffold - Scaffold data from the mode
   * @returns {void}
   */
  showScaffold(scaffold) {
    if (!scaffold) return
    const rows = positiveIntOr(scaffold.rows, 1)
    const cols = positiveIntOr(scaffold.cols, 1)

    const array = this.elements.scaffoldArray
    if (array) {
      array.innerHTML = ""
      array.style.gridTemplateColumns = `repeat(${cols}, auto)`
      for (let i = 0; i < rows * cols; i += 1) {
        const dot = document.createElement("div")
        dot.className = "array-dot"
        array.appendChild(dot)
      }
    }

    const counts = this.elements.scaffoldCounts
    if (counts) {
      counts.innerHTML = ""
      const skipCounts = Array.isArray(scaffold.skipCounts) ? scaffold.skipCounts : []
      skipCounts.forEach((value, index) => {
        const span = document.createElement("span")
        span.className = "skip-count"
        span.dataset.index = String(index)
        span.textContent = String(value)
        counts.appendChild(span)
      })
    }

    const text = this.elements.scaffoldText
    if (text) text.textContent = scaffold.text ? String(scaffold.text) : ""

    // The readout still holds the digits of the miss. Leaving "13" on screen
    // beside an array teaching 2 x 6 = 12 is a second, wrong answer in the
    // player's eyeline, and it costs a row of height the scaffold needs.
    this.setAnswerDisplayVisible(false)
    this.setVisible(this.elements.scaffoldContinue, true)
    this.setVisible(this.elements.scaffoldArea, true)
    this._setTeaching(true)
  }

  /**
   * Hide the scaffold. Its children are left in place; the next `showScaffold`
   * rebuilds them.
   * @returns {void}
   */
  hideScaffold() {
    this.setVisible(this.elements.scaffoldArea, false)
    this._setTeaching(false)
  }

  /**
   * Mark the play area as teaching. The stylesheet keys the scaffold's tighter
   * row gaps and its short-viewport dot sizing off this class.
   *
   * It exists because the scaffold is the largest thing the game draws -- a 9x9
   * dot array, a nine-number skip-count row, a sentence, and a button -- and
   * "no scrolling during a round" is a hard constraint on a 768px-high landscape
   * iPad. The compaction is scoped to the class so the keypad, which is never on
   * screen at the same time, keeps its full-size keys.
   * @param {boolean} teaching - Whether the scaffold owns the play area
   * @returns {void}
   * @private
   */
  _setTeaching(teaching) {
    const area = this.elements.playArea
    if (!area) return
    area.classList.toggle("teaching", Boolean(teaching))
  }

  /**
   * Light exactly one skip-count number, clearing any previous one.
   * @param {number} index - Zero-based position in `scaffold.skipCounts`
   * @returns {void}
   */
  highlightSkipCount(index) {
    const counts = this.elements.scaffoldCounts
    if (!counts) return
    const spans = counts.querySelectorAll(".skip-count")
    spans.forEach((span) => span.classList.remove("active"))
    const target = spans[index]
    if (target) target.classList.add("active")
  }

  // ------------------------------------------------------- Trail strip

  /**
   * Rebuild the play screen's one-row trail indicator. Movement has to be
   * visible where she is actually looking, which is the play screen, not the
   * trail screen she visits between sessions.
   *
   * When `strip.gated` is true the marker is APPENDED after the region's five
   * spaces rather than drawn inside them. The gate belongs to the next region,
   * and a blocked token always stands on the region's last space, so the old
   * `i === indexInRegion + 1` test asked for index 5 in a five-iteration loop
   * and drew nothing in every blocked state.
   * @param {PlayTrailStripView} strip - Strip view model
   * @returns {void}
   */
  renderPlayTrailStrip(strip) {
    const container = this.elements.playTrailStrip
    if (!container) return
    container.innerHTML = ""
    if (!strip) return

    const total = positiveIntOr(strip.spacesInRegion, TRAIL.SPACES_PER_REGION)
    const current = Number.isInteger(strip.indexInRegion) ? strip.indexInRegion : -1

    const regionEmoji = document.createElement("span")
    regionEmoji.className = "strip-region"
    regionEmoji.textContent = strip.regionEmoji ? String(strip.regionEmoji) : ""
    container.appendChild(regionEmoji)

    const regionName = document.createElement("span")
    regionName.className = "strip-region-name"
    regionName.textContent = strip.regionName ? String(strip.regionName) : ""
    container.appendChild(regionName)

    for (let i = 0; i < total; i += 1) {
      const space = document.createElement("span")
      space.className = "strip-space"
      space.dataset.index = String(i)
      if (i === current) {
        space.classList.add("strip-space-current")
        const token = document.createElement("span")
        token.className = "strip-token"
        token.textContent = TOKEN_EMOJI
        space.appendChild(token)
      }
      container.appendChild(space)
    }

    if (!strip.gated) return
    // A gate is "not yet"; a lock is "not here". They must look different.
    const gate = document.createElement("span")
    gate.className = "strip-space strip-space-gate"
    gate.dataset.index = String(total)
    gate.setAttribute("aria-hidden", "true")
    container.appendChild(gate)
  }

  // ------------------------------------------------------- Trail screen

  /**
   * Draw the whole trail as eight labelled region rows of five spaces.
   * @param {TrailView} view - Trail view model
   * @returns {void}
   */
  renderTrail(view) {
    const container = this.elements.trailSpaces
    if (container) {
      container.innerHTML = ""
      const regions = view && Array.isArray(view.regions) ? view.regions : []
      const tokenEmoji = (view && view.tokenEmoji) || TOKEN_EMOJI
      const currentSpace = view && Number.isInteger(view.space) ? view.space : -1

      for (const region of regions) {
        if (!region) continue
        const row = document.createElement("div")
        row.className = "trail-region-row"

        const label = document.createElement("span")
        label.className = "trail-region-label"
        label.textContent = `${region.emoji || ""} ${region.name || ""}`.trim()
        row.appendChild(label)

        const start = Number.isInteger(region.startSpace) ? region.startSpace : 0
        const spaces = positiveIntOr(region.spaces, TRAIL.SPACES_PER_REGION)
        for (let i = 0; i < spaces; i += 1) {
          const index = start + i
          const space = document.createElement("div")
          space.className = "trail-space"
          space.dataset.space = String(index)

          const states = []
          if (index === currentSpace) {
            space.classList.add("trail-space-current")
            states.push("you are here")
            const token = document.createElement("span")
            token.className = "trail-token"
            token.textContent = tokenEmoji
            space.appendChild(token)
          }
          if (!region.unlocked) {
            space.classList.add("trail-space-locked")
            states.push("locked")
          }
          if (region.skipped) {
            space.classList.add("trail-space-skipped")
            states.push("skipped")
          }
          if (states.length === 0) states.push("open")

          space.setAttribute("aria-label", `Space ${index + 1}, ${states.join(", ")}`)
          row.appendChild(space)
        }

        container.appendChild(row)
      }
    }

    this._renderTrailLegend()
  }

  /**
   * Populate `#trail-legend` so the trail's colours have words. The swatches
   * reuse `.trail-space` and its state classes, so a legend entry always looks
   * exactly like the thing it explains.
   * @private
   * @returns {void}
   */
  _renderTrailLegend() {
    const legend = this.elements.trailLegend
    if (!legend) return
    legend.innerHTML = ""

    for (const state of TRAIL_LEGEND_STATES) {
      const item = document.createElement("span")
      item.className = "legend-item"

      const swatch = document.createElement("span")
      swatch.className = state.className ? `trail-space ${state.className}` : "trail-space"
      swatch.setAttribute("aria-hidden", "true")
      if (state.token) {
        const token = document.createElement("span")
        token.className = "trail-token"
        token.textContent = TOKEN_EMOJI
        swatch.appendChild(token)
      }
      item.appendChild(swatch)

      const text = document.createElement("span")
      text.textContent = state.label
      item.appendChild(text)

      legend.appendChild(item)
    }
  }

  // --------------------------------------------------------- Fact map

  /**
   * Draw the 9x9 fact map: one header row, then eight rows of one row header and
   * eight data cells, for 81 elements in a nine-column grid.
   *
   * Each data cell gets BOTH a `strength-N` class and a `data-strength`
   * attribute. The stylesheet targets the class; a data-attribute-only version
   * rendered all 64 cells as unpainted boxes while the test still passed. Each
   * cell also carries an `aria-label` and a `.mastery-pip` glyph, because
   * strength conveyed by colour alone fails WCAG 1.4.1.
   * @param {MasteryCell[]} cells - One cell per (row, col) pair, 2-9 each
   * @returns {void}
   */
  renderMasteryGrid(cells) {
    const grid = this.elements.masteryGrid
    if (grid) {
      grid.innerHTML = ""
      grid.setAttribute("role", "table")

      const byKey = new Map()
      if (Array.isArray(cells)) {
        for (const cell of cells) {
          if (cell) byKey.set(`${cell.row}:${cell.col}`, cell)
        }
      }

      grid.appendChild(this._buildMasteryHeaderRow())
      for (let row = OPERAND_MIN; row <= OPERAND_MAX; row += 1) {
        grid.appendChild(this._buildMasteryRow(row, byKey))
      }
    }

    this._renderMasteryLegend()
  }

  /**
   * The map's top row: an empty corner plus eight column headers.
   * @private
   * @returns {HTMLElement} A `role="row"` element
   */
  _buildMasteryHeaderRow() {
    const row = this._buildGridRow()

    const corner = document.createElement("div")
    corner.className = "mastery-header"
    corner.setAttribute("role", "columnheader")
    corner.textContent = "×"
    row.appendChild(corner)

    for (let col = OPERAND_MIN; col <= OPERAND_MAX; col += 1) {
      const header = document.createElement("div")
      header.className = "mastery-header"
      header.setAttribute("role", "columnheader")
      header.textContent = String(col)
      row.appendChild(header)
    }
    return row
  }

  /**
   * One data row of the map: a row header plus eight data cells.
   * @private
   * @param {number} row - The row's operand, 2-9
   * @param {Map<string, MasteryCell>} byKey - Cells keyed "row:col"
   * @returns {HTMLElement} A `role="row"` element
   */
  _buildMasteryRow(row, byKey) {
    const rowEl = this._buildGridRow()

    const header = document.createElement("div")
    header.className = "mastery-header"
    header.setAttribute("role", "rowheader")
    header.textContent = String(row)
    rowEl.appendChild(header)

    for (let col = OPERAND_MIN; col <= OPERAND_MAX; col += 1) {
      const source = byKey.get(`${row}:${col}`) || this._placeholderCell(row, col)
      rowEl.appendChild(this._buildMasteryCell(row, col, source))
    }
    return rowEl
  }

  /**
   * A `role="row"` wrapper that does not break the parent's nine-column grid.
   * `display: contents` is set inline because the stylesheet has no rule for it,
   * and without it the row divs would become the grid items and the map would
   * collapse to a single column.
   * @private
   * @returns {HTMLElement} The row element
   */
  _buildGridRow() {
    const row = document.createElement("div")
    row.className = "mastery-row"
    row.setAttribute("role", "row")
    row.style.display = "contents"
    return row
  }

  /**
   * A stand-in cell for a (row, col) pair the caller did not supply, so a
   * missing entry cannot silently misalign the grid.
   * @private
   * @param {number} row - Row operand, 2-9
   * @param {number} col - Column operand, 2-9
   * @returns {MasteryCell} An unseen-fact cell
   */
  _placeholderCell(row, col) {
    const fact = getFactFor(row, col)
    return {
      row,
      col,
      factId: fact.id,
      strength: STRENGTH.MIN,
      isSquare: row === col,
      product: fact.product,
      tierLabel: "new",
    }
  }

  /**
   * One data cell of the fact map.
   * @private
   * @param {number} row - Row operand as displayed
   * @param {number} col - Column operand as displayed
   * @param {MasteryCell} source - The cell's view model
   * @returns {HTMLElement} A `role="cell"` element
   */
  _buildMasteryCell(row, col, source) {
    const strength = clampStrength(source.strength)
    const cell = document.createElement("div")
    cell.setAttribute("role", "cell")
    cell.className = `mastery-cell strength-${strength}`
    if (source.isSquare) cell.classList.add("mastery-cell-square")
    cell.dataset.factId = String(source.factId)
    cell.dataset.strength = String(strength)
    cell.setAttribute("aria-label", `${row} times ${col}, ${source.product}, ${source.tierLabel}`)

    const pip = document.createElement("span")
    pip.className = "mastery-pip"
    pip.setAttribute("aria-hidden", "true")
    pip.textContent = MASTERY_PIPS[strength]
    cell.appendChild(pip)

    return cell
  }

  /**
   * Populate `#mastery-legend` with one entry per strength, pairing each colour
   * with its pip glyph and a word. This is what makes the pips legible, and it
   * carries the squares note instead of leaving it in a paragraph nothing wrote.
   * @private
   * @returns {void}
   */
  _renderMasteryLegend() {
    const legend = this.elements.masteryLegend
    if (!legend) return
    legend.innerHTML = ""

    for (let strength = STRENGTH.MIN; strength <= STRENGTH.MAX; strength += 1) {
      const item = document.createElement("span")
      item.className = "legend-item"

      const swatch = document.createElement("span")
      swatch.className = `mastery-cell strength-${strength}`
      swatch.setAttribute("aria-hidden", "true")
      const pip = document.createElement("span")
      pip.className = "mastery-pip"
      pip.textContent = MASTERY_PIPS[strength]
      swatch.appendChild(pip)
      item.appendChild(swatch)

      const text = document.createElement("span")
      text.textContent = MASTERY_STRENGTH_LABELS[strength]
      item.appendChild(text)

      legend.appendChild(item)
    }

    const note = document.createElement("span")
    note.className = "legend-item"
    note.textContent = "The outlined diagonal is the squares, 2 × 2 up to 9 × 9."
    legend.appendChild(note)
  }

  // ------------------------------------------------------- Collection

  /**
   * Draw all 36 fact cards in canonical `FACTS` order and write the completion
   * count. `#collection-count` had no writer before, so the collection never
   * said how close it was to finished.
   *
   * The count reports BOTH numbers. Counting only foiled cards said "0 of 36
   * cards complete" through all of session 1 and most of session 2 while cards
   * were visibly changing colour on the same screen, because the first mastered
   * fact does not arrive until around answer 25.
   * @param {CardView[]} cards - One card view per fact
   * @returns {void}
   */
  renderCollection(cards) {
    const list = Array.isArray(cards) ? cards.filter(Boolean) : []
    const ordered = list.slice().sort((x, y) => factOrderOf(x) - factOrderOf(y))

    const container = this.elements.collectionCards
    if (container) {
      container.innerHTML = ""
      for (const card of ordered) container.appendChild(this._buildCard(card))
    }

    const count = this.elements.collectionCount
    if (count) {
      const colored = list.filter((card) => cardTierRank(card.tier) >= 1).length
      const foiled = list.filter((card) => card.tier === "foiled").length
      count.textContent = `${colored} of ${TOTAL_FACTS} cards colored, ${foiled} foiled`
    }

    this._renderCollectionLegend()
  }

  /**
   * Populate `#collection-legend` with one entry per card tier, pairing each
   * card colour with its pip glyph and a word -- the same treatment that makes
   * the fact map's colours readable.
   * @private
   * @returns {void}
   */
  _renderCollectionLegend() {
    const legend = this.elements.collectionLegend
    if (!legend) return
    legend.innerHTML = ""

    for (const entry of CARD_LEGEND) {
      const item = document.createElement("span")
      item.className = "legend-item"

      const swatch = document.createElement("span")
      swatch.className = `card-swatch card-${entry.tier}`
      swatch.setAttribute("aria-hidden", "true")
      swatch.textContent = CARD_PIPS[entry.tier]
      item.appendChild(swatch)

      const text = document.createElement("span")
      text.textContent = entry.label
      item.appendChild(text)

      legend.appendChild(item)
    }
  }

  /**
   * One fact card element, used by both the collection and the summary.
   *
   * A grey card shows "7 × 8" without the product. Printing the answer on every
   * card from minute zero made the collection a complete answer key two taps
   * from the hub, which undercuts collecting it and contradicts the care taken
   * to keep the answer out of the tile markup. The product appears once the card
   * is at least colored, i.e. once she has been getting the fact right.
   *
   * The `.card-pip` glyph is the non-colour tier cue: grey and colored cards
   * otherwise differed by background colour alone.
   * @private
   * @param {CardView} card - Card view model
   * @returns {HTMLElement} The card element
   */
  _buildCard(card) {
    const tier = typeof card.tier === "string" ? card.tier : "grey"
    const revealed = cardTierRank(tier) >= 1

    const el = document.createElement("div")
    el.className = `fact-card card-${tier}`
    if (card.isNew) el.classList.add("card-new")
    el.dataset.factId = String(card.factId)

    const face = document.createElement("span")
    face.className = "card-face"
    face.textContent = revealed
      ? `${card.a} × ${card.b} = ${card.product}`
      : `${card.a} × ${card.b}`
    el.appendChild(face)

    const pip = document.createElement("span")
    pip.className = "card-pip"
    pip.setAttribute("aria-hidden", "true")
    pip.textContent = CARD_PIPS[tier] || CARD_PIPS.grey
    el.appendChild(pip)

    el.setAttribute(
      "aria-label",
      revealed
        ? `${card.a} times ${card.b} equals ${card.product}, ${tier} card`
        : `${card.a} times ${card.b}, ${tier} card`,
    )
    return el
  }

  // ---------------------------------------------------------- Summary

  /**
   * Fill in the session summary. `#summary-milestones` and `#summary-goal` are
   * wired here rather than deleted: a first-session gem and a met daily goal are
   * the two things the summary most needs to say.
   * @param {SummaryView} summary - Summary view model
   * @returns {void}
   */
  renderSessionSummary(summary) {
    if (!summary) return
    const {
      summaryStars,
      summaryGems,
      summaryCorrect,
      summaryStreak,
      summaryGoal,
      summaryRegion,
      summaryMilestones,
      summaryMilestonesGroup,
      summaryCards,
      summaryCardsGroup,
    } = this.elements

    if (summaryStars) summaryStars.textContent = String(summary.stars)
    if (summaryGems) summaryGems.textContent = String(summary.gems)
    if (summaryCorrect) {
      summaryCorrect.textContent = `${summary.factsCorrect}/${summary.factsAnswered}`
    }
    if (summaryStreak) summaryStreak.textContent = String(summary.bestStreak)

    if (summaryGoal) {
      const met = Boolean(summary.goalJustMet)
      summaryGoal.textContent = met ? "Today's goal is done. Nice work!" : ""
      this.setVisible(summaryGoal, met)
    }

    if (summaryRegion) {
      const name = summary.newRegionName
      summaryRegion.textContent = name ? `New region reached: ${name}` : ""
      this.setVisible(summaryRegion, Boolean(name))
    }

    if (summaryMilestones) {
      summaryMilestones.innerHTML = ""
      const labels = Array.isArray(summary.milestoneLabels) ? summary.milestoneLabels : []
      for (const label of labels) {
        const item = document.createElement("li")
        item.textContent = String(label)
        summaryMilestones.appendChild(item)
      }
      // The GROUP is toggled, not the list: the list's heading is what stops
      // "1000 stars" reading as a session tally sitting next to "1189 stars".
      this.setVisible(summaryMilestonesGroup ?? summaryMilestones, labels.length > 0)
    }

    if (summaryCards) {
      summaryCards.innerHTML = ""
      const newCards = Array.isArray(summary.newCards) ? summary.newCards.filter(Boolean) : []
      for (const card of newCards) summaryCards.appendChild(this._buildCard(card))
      // Same reason: four unlabelled cards told the player nothing about why they
      // were on screen.
      this.setVisible(summaryCardsGroup ?? summaryCards, newCards.length > 0)
    }
  }

  // --------------------------------------------------------- Settings

  /**
   * Reflect the persisted settings into the modal's two controls, and say how
   * many facts the chosen tables add up to.
   *
   * The pool size is shown because the toggles alone hide the consequence:
   * ticking 7 adds eight facts, not one, and a player who unticks down to a
   * three-fact pool should be able to see that before wondering why the same
   * question keeps coming back.
   * @param {SettingsData} settingsData - Current settings
   * @param {number} [factCount] - Size of the resulting fact pool; omitted leaves
   *   `#pool-size` as it was
   * @returns {void}
   */
  renderSettings(settingsData, factCount) {
    if (!settingsData) return
    const { sessionLengthSelect, poolSize, tableToggles } = this.elements

    const enabled = new Set(Array.isArray(settingsData.tables) ? settingsData.tables : [])
    if (Array.isArray(tableToggles)) {
      for (const toggle of tableToggles) {
        const pressed = enabled.has(toggle.table)
        if (toggle.input) toggle.input.checked = pressed
        // The label is the visible affordance, so assistive tech reads its
        // pressed state rather than the visually hidden checkbox's.
        if (toggle.label) toggle.label.setAttribute("aria-pressed", pressed ? "true" : "false")
      }
    }

    if (sessionLengthSelect && Number.isFinite(settingsData.sessionLength)) {
      sessionLengthSelect.value = String(settingsData.sessionLength)
    }

    if (poolSize && Number.isFinite(factCount)) {
      poolSize.textContent = `${factCount} fact${factCount === 1 ? "" : "s"} in play`
    }
  }
}

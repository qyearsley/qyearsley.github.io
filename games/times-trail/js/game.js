/**
 * Times Trail -- the page entry point and session orchestrator.
 *
 * This is the only module that knows about every other one. It owns the live
 * game state, wires the DOM event layer to the pure logic modules, and decides
 * when things happen; it contains no rules of its own beyond sequencing.
 *
 * Architecture: the session loop, in order.
 *
 *   1. `startSession(modeId)` resets `this.session`, calls `selector.reset()`
 *      (so a miss from the previous session cannot fire on question 1), rebuilds
 *      `this.journey` with the current fact pool, points selection at the facts
 *      the next gate needs, and shows the play screen.
 *   2. `_askNextQuestion()` picks a fact (`FactSelector`), captures its strength
 *      and card tier BEFORE the answer, builds a `Challenge` through
 *      `modes/index.js`, renders it, and arms the response clock last -- after
 *      the DOM is written, so the player is not charged for the render.
 *   3. The first keypad digit stamps `session.firstInteractionAt` exactly once.
 *      That stamp, not the submit, is the end of the measured thinking time --
 *      charging the player for the motor time of typing made mastery
 *      unreachable on the keypad path.
 *   4. The entry path converges on `_handleAnswer(input)`, which holds the
 *      single double-submit guard, asks `challenge.check(input)` (the sole
 *      authority on correctness), and then updates records, stars, the trail,
 *      the daily goal, milestones, and the save file.
 *   5. A miss always reveals the answer, holds for `TIMING.WRONG_FEEDBACK_MS` so
 *      the marked tiles can actually be seen, and then shows the teaching
 *      scaffold, whose two exits ("Got it" and a computed auto-advance timer) both
 *      run one idempotent `_resolveScaffold()`.
 *   6. After `settings.sessionLength` answers, `_finishSession()` increments
 *      `sessionsCompleted` and checks milestones BEFORE building the summary
 *      view, so session 1 can actually show the gem it just earned.
 *
 * Timers: there is exactly ONE pending advance at a time -- the hold after a
 * correct answer, the hold after a miss, or the scaffold's auto-advance -- because
 * those are three sequential phases of one answer. It is held as a
 * `{run, delayMs}` descriptor beside its timer id, so `_pauseTimers()` can put the
 * countdown down and `_resumeTimers()` can pick it back up while the settings
 * modal is open. Leaving it running behind the modal ended a session underneath an
 * `aria-modal` dialog. The scaffold's skip-count animation is the one concurrent
 * timer and pauses the same way.
 *
 * Two invariants a reader will otherwise trip over:
 *
 *   - **One fact-record map.** `MasteryStore` aliases the map it is given, so
 *     `this.store.records === this.progress.facts` for the life of the page.
 *     Nothing ever reassigns `this.progress.facts`; a "start fresh" rebuilds the
 *     progress object and the store together, as a pair. Break the alias and
 *     spaced repetition, region unlocking, and persistence all read an empty map
 *     while the screen still looks right.
 *   - **Every non-mutating call's return value is assigned.** `Journey.advance`,
 *     `Scoring.applyAnswer`, `Scoring.rollDaily`, `Scoring.checkMilestones`,
 *     and `Journey.normalizeTrail` all return new values and
 *     touch nothing. A dropped return reads exactly like working code and
 *     silently kills the feature. `store.apply()` is the one call that needs no
 *     assignment, because the store writes through the aliased map.
 *
 * DOM ownership: `GameUI` does the rendering. This module touches `document`
 * in exactly four spec-sanctioned places -- finding the correct tile by value
 * for presentation marking, toggling `aria-live` on `#question-text` and
 * `#feedback-area` while a scaffold owns the play area, looking up the
 * `#keypad` container once to construct `Keypad`, and building the one-time
 * "this browser is not saving" banner, which has to outlive every screen and so
 * cannot be any element `GameUI` already owns.
 *
 * Error Handling: the `DOMContentLoaded` bootstrap is wrapped in a `try/catch`
 * that puts a readable message on the page instead of leaving a blank screen.
 * `styles/main.css` does not style `.error-container`, so the fallback carries
 * the few inline styles it needs to be legible on its own.
 *
 * Security Note: this module uses `innerHTML` in one place -- the static,
 * hardcoded error template in the bootstrap's `catch`, mirroring
 * `games/number-garden/js/game.js`. It contains no interpolation of any kind.
 * The save-failure banner is built with `createElement` and `textContent` for the
 * same reason every other piece of content is. Every other piece of dynamic
 * content is built by `GameUI` with `createElement` and `textContent` from
 * controlled game data (frozen constant tables, the 36-fact set, and numbers
 * computed by this game's pure modules), so nothing a player can type is ever
 * interpreted as markup.
 */

import {
  CARD_TIERS,
  INPUT_MODE,
  KEYPAD,
  MODE_IDS,
  OPERAND_MAX,
  OPERAND_MIN,
  RESPONSE_TIME,
  TIMING,
  TOKEN_EMOJI,
  TRAIL,
} from "./constants.js"
import { FACTS, getFact, getFactFor } from "./facts.js"
import { MasteryStore } from "./MasteryModel.js"
import { FactSelector } from "./FactSelector.js"
import { Journey } from "./Journey.js"
import { Scoring } from "./Scoring.js"
import { Settings } from "./Settings.js"
import { StorageManager, defaultProgress } from "./storage.js"
import { Keypad } from "./Keypad.js"
import { GameUI } from "./GameUI.js"
import { EventManager } from "./EventManager.js"
import { createChallenge, getMode } from "./modes/index.js"

/**
 * Card tier id -> position in `CARD_TIERS`, so "did this fact's card improve?"
 * is one comparison rather than a hand-written ordering.
 * @private
 * @type {Map<string, number>}
 */
const CARD_TIER_RANK = new Map(CARD_TIERS.map((tier, index) => [tier.id, index]))

/**
 * The two `aria-live` regions the scaffold silences while it teaches, so a
 * screen reader narrates one thing instead of three.
 * @private
 * @type {readonly string[]}
 */
const LIVE_REGION_IDS = Object.freeze(["question-text", "feedback-area"])

/**
 * The multiplication sign, U+00D7 -- the real glyph, not the letter `x`, matching
 * the prompts the modes build.
 * @private
 * @type {string}
 */
const TIMES_SIGN = "×"

/**
 * What a correct answer is told, ahead of the restated fact.
 *
 * One phrase rather than a rotation: the sentence after it changes every question
 * anyway. It exists because `showFeedback(text, "correct")` is the only producer
 * of the `.feedback-area.correct` style, so never calling it left both that rule
 * and the child's only acknowledgement dead -- a correct answer ticked a counter
 * and said nothing.
 * @private
 * @type {string}
 */
const CORRECT_PRAISE = "Yes!"

/**
 * What the player is told, once, when a save fails. Plain language on purpose:
 * "quota exceeded" is not a sentence an 8-year-old or a parent can act on.
 * @private
 * @type {string}
 */
const SAVE_FAILED_TEXT =
  "This browser is not letting the game save. You can keep playing, but your stars and cards will be gone when you close the page."

/**
 * Live session state, reset at the start of every session.
 *
 * @typedef {Object} SessionState
 * @property {string} modeId              - `MODE_IDS` value being played
 * @property {number} factsAnswered       - Questions answered this session
 * @property {number} factsCorrect        - Of those, correct
 * @property {number} streak              - Current run of correct answers
 * @property {number} bestStreak          - Longest run this session
 * @property {number} starsEarned         - Stars earned this session
 * @property {number} gemsEarned          - Gems earned this session
 * @property {string[]} newCardIds        - Facts whose card tier improved
 * @property {string[]} milestoneLabels   - Milestone labels crossed this session
 * @property {number|null} askedAt        - Epoch ms the question became interactive
 * @property {number|null} firstInteractionAt - Epoch ms of the first touch of it
 * @property {number} strengthAtAsk       - Decayed strength before this answer
 * @property {string} tierAtAsk           - Card tier before this answer
 * @property {"tiles"|"keypad"} entry - `challenge.entry`, never recomputed
 * @property {Object|null} challenge      - The live `Challenge`, or null between questions
 * @property {boolean} goalJustMetThisSession - Today's goal was met during this session
 * @property {string|null} newRegionName  - Region newly entered this session
 */

class TimesTrail {
  /**
   * Screens whose back button returns to the hub without ending anything. The
   * play screen is deliberately absent: leaving it abandons a session, which is
   * a different action.
   * @private
   */
  static HUB_RETURN_SCREENS = Object.freeze(["trail-screen", "map-screen", "collection-screen"])

  /**
   * Text of the "start fresh" confirmation. Kept as configuration so the one
   * destructive action in the game reads the same wherever it is referenced.
   * @private
   */
  static RESET_PROMPT = "Start fresh? This erases your trail, your cards, and every star."

  /**
   * Text of the "leave this session" confirmation.
   *
   * The play screen's back button is 68px, top-left, exactly where a hand rests on
   * an iPad, and a mis-tap at question 15 threw away the streak and the summary
   * with no way back. The wording is careful to say what is and is not lost:
   * answered facts were saved as they landed, so only this round goes.
   * @private
   */
  static ABANDON_PROMPT =
    "Leave this round? Your answers are saved, but this round's streak and summary are not."

  /**
   * Builds the whole game and wires it to the page. Every collaborator is
   * injectable so the orchestrator stays substitutable; the defaults are what
   * the browser gets.
   *
   * @param {Object} [dependencies] - Injected collaborators
   * @param {() => number} [dependencies.now] - Clock returning epoch ms
   * @param {() => number} [dependencies.rng] - Randomness source in [0, 1)
   * @param {StorageManager} [dependencies.storage] - Persistence layer
   * @param {GameUI} [dependencies.ui] - Rendering layer
   * @param {Scoring} [dependencies.scoring] - Stars, gems, daily goal
   * @param {FactSelector} [dependencies.selector] - Which fact comes next
   */
  constructor({
    now = () => Date.now(),
    rng = Math.random,
    storage = new StorageManager(),
    ui = new GameUI(),
    scoring = new Scoring({ now }),
    selector = new FactSelector({ rng, now }),
  } = {}) {
    /** @type {() => number} Injected clock; the only source of "now" here. @private */
    this._now = typeof now === "function" ? now : () => Date.now()

    /** @type {() => number} Injected randomness, handed to the modes. @private */
    this._rng = typeof rng === "function" ? rng : Math.random

    /** @type {StorageManager} */
    this.storage = storage

    /** @type {GameUI} */
    this.ui = ui

    /** @type {Scoring} */
    this.scoring = scoring

    /** @type {FactSelector} */
    this.selector = selector

    const loaded = this.storage.loadProgress()

    /** @type {import("./storage.js").SaveState} The live, normalized save state. */
    this.progress = loaded ?? defaultProgress()

    /**
     * The record store. ALIASES `this.progress.facts` -- the two are the same
     * object from here on, and neither is ever reassigned independently.
     * @type {MasteryStore}
     */
    this.store = new MasteryStore(this.progress.facts, this._now)

    /** @type {Settings} Validated settings; the authority `buildSaveState` persists. */
    this.settings = new Settings(this.progress.settings)

    // Both assigned back: these functions return new objects and mutate nothing.
    this.progress.trail = Journey.normalizeTrail(this.progress.trail)
    this.progress.daily = this.scoring.rollDaily(this.progress.daily)

    /** @type {Journey} Rebuilt whenever the fact pool changes; gating is pool-scoped. */
    this.journey = this._buildJourney()

    /** @type {SessionState} */
    this.session = this._createSession(MODE_IDS.QUICK_RECALL)

    /** @type {boolean} The ONE double-submit guard, covering every entry path. @private */
    this._isProcessingAnswer = false

    /**
     * The one pending "move the session on" action: the hold after a correct
     * answer, the hold after a miss before the scaffold appears, or the
     * scaffold's own auto-advance. Only one is ever armed, because those are
     * three sequential phases of a single answer. Kept as a descriptor rather
     * than just a timer id so `_pauseTimers` can cancel it and `_resumeTimers`
     * can put it back.
     * @type {{run: () => void, delayMs: number}|null}
     * @private
     */
    this._pendingAdvance = null

    /** @type {number|null} Timer id for `_pendingAdvance`. @private */
    this._advanceTimeoutId = null

    /**
     * The next skip-count number the scaffold animation should light, so it can
     * pause and resume rather than restart from the first number.
     * @type {{index: number, total: number}|null}
     * @private
     */
    this._pendingSkipTick = null

    /** @type {number|null} Timer id for `_pendingSkipTick`. @private */
    this._skipCountTimeoutId = null

    /** @type {boolean} Idempotence guard so a tap and the timer cannot both advance. @private */
    this._scaffoldResolved = true

    /** @type {boolean} True once a save has failed and the player has been told. @private */
    this._saveFailed = false

    /** @type {Keypad} */
    this.keypad = new Keypad(document.getElementById("keypad"), {
      onSubmit: (value) => this._handleAnswer(value),
      onChange: (display) => {
        this.ui.setAnswerDisplay(display)
        this._markFirstInteraction()
      },
    })
    this.keypad.render()
    this.keypad.attach()
    this.keypad.setEnabled(false)

    /** @type {EventManager} */
    this.events = new EventManager(this.ui, {
      // Play and Keep Going both go straight into a session. There is one mode,
      // so a hub visit before practice was a screen that asked nothing.
      onStart: () => this.startSession(MODE_IDS.QUICK_RECALL),
      onContinue: () => this.startSession(MODE_IDS.QUICK_RECALL),
      onStartFresh: () => this.startFresh(),
      onShowProgress: () => this.showHub(),
      onHome: () => this.showTitle(),
      onBack: (sourceScreenId) => this.goBack(sourceScreenId),
      onModeSelect: (modeId) => this.startSession(modeId),
      onAnswerSelected: (answer, buttonEl) => this._handleTileAnswer(answer, buttonEl),
      onScaffoldContinue: () => this._resolveScaffold(),
      onShowTrail: () => this.showTrail(),
      onShowMap: () => this.showMap(),
      onShowCollection: () => this.showCollection(),
      onPlayAgain: () => this.startSession(this.session.modeId),
      onSummaryHub: () => this.showHub(),
      onSettingsOpen: () => this.openSettings(),
      onSettingsClose: () => this.closeSettings(),
      onSettingChange: (key, value) => this.changeSetting(key, value),
      onTableToggle: (table, checked) => this.toggleTable(table, checked),
    })
    this.events.initializeEventListeners()

    this.ui.updateTitleButtons(loaded !== null)
    this.ui.renderSettings(this.settings.toJSON(), this.settings.factCount)
    this._refreshHud()
  }

  // ------------------------------------------------------------ Persistence

  /**
   * The whole save state, exactly six keys.
   *
   * `facts` is the live aliased map on purpose -- `saveProgress` normalizes,
   * which copies, so nothing downstream can reach the map the store writes to.
   * `settings` comes from the live `Settings` instance rather than the raw
   * `progress.settings` the file was loaded with; reading the raw object would
   * mean a settings change made this session never persisted. `version` and
   * `lastPlayed` belong to the base storage class and must not appear here.
   *
   * @returns {import("./storage.js").SaveState} A fresh object to persist
   */
  buildSaveState() {
    return {
      facts: this.progress.facts,
      totals: {
        starsTotal: this.progress.totals.starsTotal,
        gemsTotal: this.progress.totals.gemsTotal,
        factsAnswered: this.progress.totals.factsAnswered,
        factsCorrect: this.progress.totals.factsCorrect,
        sessionsCompleted: this.progress.totals.sessionsCompleted,
      },
      trail: this.progress.trail,
      daily: this.progress.daily,
      settings: this.settings.toJSON(),
      awardedMilestoneIds: [...this.progress.awardedMilestoneIds],
    }
  }

  /**
   * Persist the current state, and notice when that fails.
   *
   * Every caller still drops the return value, which is fine only because the
   * failure is handled here. `localStorage` is unavailable in Safari private
   * browsing and throws once the origin's quota is full; in both cases the game
   * played perfectly, stars piled up on screen, and the whole lot evaporated on
   * reload, with a missing Continue button as the only symptom.
   * @returns {boolean} True when the save succeeded
   * @private
   */
  _save() {
    const saved = this.storage.saveProgress(this.buildSaveState())
    if (!saved) this._warnSaveFailedOnce()
    return saved
  }

  /**
   * Tell the player, once, that progress is not being saved.
   *
   * A banner rather than a `showFeedback` line, because this is not per-answer
   * feedback: it has to survive the next `renderQuestion` and every screen change.
   * `styles/main.css` has no rule for `.save-warning`, so it carries the few
   * inline styles it needs to be legible on its own -- the same arrangement the
   * bootstrap's `.error-container` uses, and the fourth of this module's four
   * direct `document` touches.
   * @returns {void}
   * @private
   */
  _warnSaveFailedOnce() {
    if (this._saveFailed) return
    this._saveFailed = true
    const banner = document.createElement("p")
    banner.className = "save-warning"
    banner.setAttribute("role", "alert")
    banner.style.margin = "0"
    banner.style.padding = "0.75rem"
    banner.style.textAlign = "center"
    banner.style.backgroundColor = "#fde68a"
    banner.style.color = "#1f2937"
    banner.textContent = SAVE_FAILED_TEXT
    document.body.prepend(banner)
  }

  /**
   * Ask the player to confirm something she cannot undo.
   *
   * A host without `confirm` is treated as consent: the alternative is a button
   * that silently does nothing, which is worse than the action itself.
   * @param {string} prompt - The question to ask
   * @returns {boolean} True to go ahead
   * @private
   */
  _confirmed(prompt) {
    if (typeof confirm !== "function") return true
    return confirm(prompt) === true
  }

  /**
   * Throw away every trace of progress and rebuild from defaults. The progress
   * object and the record store are replaced together, as a pair, so the alias
   * between `progress.facts` and `store.records` survives the reset.
   * @returns {void}
   */
  startFresh() {
    if (!this._confirmed(TimesTrail.RESET_PROMPT)) return

    this._clearPendingTimers()
    this.storage.clearProgress()
    this.progress = defaultProgress()
    this.store = new MasteryStore(this.progress.facts, this._now)
    // Settings deliberately SURVIVE. The prompt promises the trail, the cards, and
    // the stars, and says nothing about which tables are in play -- but rebuilding
    // `Settings` from the fresh defaults silently turned every table back on and
    // reset the session length. The live instance stays the authority, so the fresh
    // progress object is made to agree with it instead.
    this.progress.settings = this.settings.toJSON()
    this.progress.daily = this.scoring.rollDaily(this.progress.daily)
    this.journey = this._buildJourney()
    this.selector.reset()
    this.session = this._createSession(MODE_IDS.QUICK_RECALL)

    this.ui.renderSettings(this.settings.toJSON(), this.settings.factCount)
    this.ui.updateTitleButtons(false)
    this.showHub()
  }

  // --------------------------------------------------------------- Screens

  /**
   * Show the title screen.
   * @returns {void}
   */
  showTitle() {
    this._clearPendingTimers()
    this.ui.updateTitleButtons(this.storage.loadProgress() !== null)
    this.ui.showScreen("title-screen")
  }

  /**
   * Show the hub and refresh its lifetime HUD.
   * @returns {void}
   */
  showHub() {
    this._refreshHud()
    this.ui.showScreen("hub-screen")
  }

  /**
   * Route a back button by the screen it is leaving, rather than by inspecting
   * which screen happens to be active. The play screen's back button abandons a
   * session; the three list screens' buttons just return to the hub.
   *
   * Abandoning is confirmed, because the button that does it is a 68px target in
   * the top-left corner of an iPad, right where a hand rests.
   * @param {string} sourceScreenId - Id of the screen the button sits in
   * @returns {void}
   */
  goBack(sourceScreenId) {
    if (TimesTrail.HUB_RETURN_SCREENS.includes(sourceScreenId)) {
      this.showHub()
      return
    }
    if (this._sessionInProgress() && !this._confirmed(TimesTrail.ABANDON_PROMPT)) return
    this.abandonSession()
  }

  /**
   * Whether there is a round worth confirming the loss of: a live question, or at
   * least one answer already banked into this session's streak and summary.
   * @returns {boolean} True when a session is in progress
   * @private
   */
  _sessionInProgress() {
    return this.session.challenge !== null || this.session.factsAnswered > 0
  }

  /**
   * Leave a session in progress. Everything answered so far is already scored
   * and saved; this only stops the machinery and returns to the hub.
   * @returns {void}
   */
  abandonSession() {
    this._clearPendingTimers()
    this._setLiveRegions("polite")
    this.ui.hideScaffold()
    this.keypad.setEnabled(false)
    this.session.challenge = null
    this._isProcessingAnswer = false
    this._save()
    this.showHub()
  }

  /**
   * Draw the whole trail and show it.
   * @returns {void}
   */
  showTrail() {
    const regionProgress = this.journey.allRegionProgress(this.progress.facts)
    const regions = this.journey.getRegions().map((region, index) => {
      const status = regionProgress[index]
      return {
        id: region.id,
        name: region.name,
        emoji: region.emoji,
        startSpace: this.journey.regionStartSpace(region.id),
        spaces: region.spaces,
        unlocked: status.unlocked,
        // `strong`, not `mastered`: the gate counts facts at
        // TRAIL.UNLOCK_MIN_STRENGTH (3) and `mastered` is the 4+ count, so
        // pairing `mastered` with `required` reported progress against a bar this
        // region does not use. The view-model key is GameUI's and stays as it is.
        mastered: status.strong,
        required: status.required,
        skipped: status.skipped,
      }
    })

    this.ui.renderTrail({
      space: this.progress.trail.space,
      totalSpaces: this.journey.totalSpaces,
      regions,
      tokenEmoji: TOKEN_EMOJI,
    })
    this.ui.showScreen("trail-screen")
  }

  /**
   * Draw the 8x8 fact map and show it. Cells carry the DECAYED strength, the
   * same number the card tier reads, so the two can never disagree.
   * @returns {void}
   */
  showMap() {
    const cells = []
    for (let row = OPERAND_MIN; row <= OPERAND_MAX; row += 1) {
      for (let col = OPERAND_MIN; col <= OPERAND_MAX; col += 1) {
        const fact = getFactFor(row, col)
        cells.push({
          row,
          col,
          factId: fact.id,
          strength: this.store.strengthOf(fact.id),
          isSquare: row === col,
          product: fact.product,
          tierLabel: this.store.tierOf(fact.id),
        })
      }
    }
    this.ui.renderMasteryGrid(cells)
    this.ui.showScreen("map-screen")
  }

  /**
   * Draw all 36 fact cards and show the collection.
   * @returns {void}
   */
  showCollection() {
    this.ui.renderCollection(FACTS.map((fact) => this._buildCardView(fact.id)))
    this.ui.showScreen("collection-screen")
  }

  // -------------------------------------------------------------- Settings

  /**
   * Reflect the live settings into the modal and open it.
   *
   * Pending timers are put down first. `#play-settings-button` is tappable during
   * a scaffold, and leaving the countdown running behind the dialog produced a
   * verified failure: miss question 20, open settings, wait, and the auto-advance
   * finishes the session so the summary screen renders UNDERNEATH a still-open
   * `aria-modal` dialog, with focus pulled out of it. The countdown waits for her
   * instead, and `closeSettings` starts it again.
   * @returns {void}
   */
  openSettings() {
    this._pauseTimers()
    this.ui.renderSettings(this.settings.toJSON(), this.settings.factCount)
    this.ui.showSettings()
  }

  /**
   * Close the settings modal and restart whatever `openSettings` paused. Both
   * exits -- the Done button and `Escape` -- route here, so neither can leave a
   * countdown down.
   * @returns {void}
   */
  closeSettings() {
    this.ui.hideSettings()
    this._resumeTimers()
  }

  /**
   * Apply one setting. Re-rendering the modal is what keeps the fact-count
   * readout in step with the controls, and the journey is rebuilt because region
   * gating is scoped to the active fact pool.
   *
   * The progress bar is redrawn because the session length is allowed to change
   * MID-SESSION. Every read of `settings.sessionLength` is live, so shortening
   * the round already took effect immediately in the logic -- but the bar is only
   * written on answer and on session start, so it went on claiming "7/20" until
   * the next question and read as a setting that had not applied.
   *
   * `current` is clamped to the new length: dropping to 10 after 15 answers would
   * otherwise paint a 150%-wide bar and set `aria-valuenow` above `aria-valuemax`.
   * The round then ends on the next answer via `_advanceAfterAnswer`, which is
   * deliberate -- finishing it here would show the summary underneath the open
   * `aria-modal` settings dialog, the exact failure `_pauseTimers` exists to
   * prevent.
   * @param {string} key - Settings key
   * @param {*} value - Candidate value; rejected values change nothing
   * @returns {void}
   */
  changeSetting(key, value) {
    if (!this.settings.update(key, value)) return
    this.ui.renderSettings(this.settings.toJSON(), this.settings.factCount)
    this.journey = this._buildJourney()
    if (key === "sessionLength") {
      const length = this.settings.sessionLength
      this.ui.updateProgressBar(Math.min(this.session.factsAnswered, length), length)
    }
    this._reseedGatePriority()
    this._save()
  }

  /**
   * Toggle one table in the picker. An attempt to clear the last table is
   * rejected by `Settings`, and re-rendering restores the control to the state
   * that is actually in force.
   * @param {number} table - Table number, 2-9
   * @param {boolean} checked - Whether the toggle is now on
   * @returns {void}
   */
  toggleTable(table, checked) {
    const tables = new Set(this.settings.enabledTables)
    if (checked) {
      tables.add(table)
    } else {
      tables.delete(table)
    }

    const applied = this.settings.setTables([...tables])
    this.ui.renderSettings(this.settings.toJSON(), this.settings.factCount)
    if (!applied) return
    this.journey = this._buildJourney()
    this._reseedGatePriority()
    this._save()
  }

  // ------------------------------------------------------------ Session loop

  /**
   * Begin a session. `selector.reset()` is unconditional: without it a fact
   * missed at the end of the last session fires immediately and every retry
   * delay is measured from the wrong origin.
   *
   * The gate priority is seeded here rather than left to the first scored answer,
   * so question 1 of a session is already weighted toward the facts the trail is
   * waiting on. `_updateGatePriority` takes an `AdvanceResult`, so it is fed a
   * zero-space advance -- which reports the current `gatingRegionId` without
   * moving the token.
   * @param {string} modeId - A `MODE_IDS` value; anything unknown falls back to Quick Recall
   * @returns {void}
   */
  startSession(modeId) {
    const mode = getMode(modeId)
    this._clearPendingTimers()
    this._setLiveRegions("polite")
    this.session = this._createSession(mode === null ? MODE_IDS.QUICK_RECALL : mode.id)
    this.selector.reset()
    this.journey = this._buildJourney()
    this._reseedGatePriority()
    this._isProcessingAnswer = false

    this.ui.updatePlayHud({ sessionStars: 0, sessionStreak: 0 })
    this.ui.updateProgressBar(0, this.settings.sessionLength)
    this.ui.showScreen("play-screen")
    this._askNextQuestion()
  }

  /**
   * Build, render, and arm one question.
   *
   * Order matters twice over. The strength and card tier are captured BEFORE the
   * answer, because star weighting, the entry affordance, and the "new card"
   * check all depend on the pre-answer values. And `askedAt` is stamped LAST,
   * after the DOM is written and the question is genuinely on screen, so the
   * measured thinking time does not include the render.
   * @returns {void}
   * @private
   */
  _askNextQuestion() {
    const factId = this.selector.selectNext(this.settings.factPool, this.progress.facts)
    const fact = factId === null ? null : getFact(factId)
    if (fact === null) {
      console.error("Times Trail: no fact available to ask; returning to the hub")
      this.showHub()
      return
    }

    const strengthAtAsk = this.store.strengthOf(factId)
    const challenge = createChallenge(
      this.session.modeId,
      fact,
      {
        strength: strengthAtAsk,
        inputModeFor: (strength) => this.settings.inputModeFor(strength),
      },
      this._rng,
    )

    this.session.strengthAtAsk = strengthAtAsk
    this.session.tierAtAsk = this.store.cardTierOf(factId)
    // `challenge.entry` is the single authority on the entry affordance. Deriving
    // it a second time here is what let a non-keypad answer collect the
    // keypad honesty bonus.
    this.session.entry = challenge.entry
    this.session.challenge = challenge

    this.ui.renderQuestion(challenge)

    // Unconditional, every render: both Keypad and EventManager listen on
    // `document`, so this is what keeps exactly one of them acting on a digit.
    this.keypad.setEnabled(challenge.entry === INPUT_MODE.KEYPAD)
    this.keypad.clear()
    this.ui.setAnswerDisplay(KEYPAD.EMPTY_DISPLAY)
    this.ui.renderPlayTrailStrip(this._buildStripView())

    this._isProcessingAnswer = false
    // After `keypad.clear()`, whose own onChange would otherwise leave a stamp.
    this.session.firstInteractionAt = null
    this.session.askedAt = this._now()
  }

  /**
   * Stamp the first interaction with this question, once. Called from the
   * keypad's first digit or clear -- never from a submit.
   * @returns {void}
   * @private
   */
  _markFirstInteraction() {
    if (!this.session) return
    if (this.session.firstInteractionAt === null) {
      this.session.firstInteractionAt = this._now()
    }
  }

  /**
   * Thinking time for the answer being recorded: render to FIRST interaction,
   * clamped to `RESPONSE_TIME.MAX_RECORDED_MS`.
   *
   * Measured to submit instead, a two-digit keypad answer paid for two deliberate
   * taps plus a check mark, so the same recall speed read as `fluent` on tiles and
   * `slow` on the keypad. What that cost was the collection, not the trail: a
   * `slow` answer promotes no higher than `STRENGTH.SLOW_CAP` (3) and steps a fact
   * already above it back down by one, so a keypad fact she knew cold sat at 3
   * indefinitely and its card could never foil. Region gates read strength 3, so
   * the token kept moving and nothing looked broken -- which is exactly why it went
   * unnoticed.
   *
   * The `_now()` fallback covers an answer arriving with no recorded interaction,
   * and `null` means unmeasured, which `MasteryModel` treats as recall.
   * @returns {number|null} Milliseconds, or null when unmeasurable
   * @private
   */
  _responseMs() {
    const { askedAt, firstInteractionAt } = this.session
    if (!Number.isFinite(askedAt)) return null
    const stoppedAt = Number.isFinite(firstInteractionAt) ? firstInteractionAt : this._now()
    const elapsed = stoppedAt - askedAt
    if (!(elapsed > 0)) return null
    return Math.min(elapsed, RESPONSE_TIME.MAX_RECORDED_MS)
  }

  /**
   * A tile was tapped. The tap is both the first interaction and the submit.
   * @param {number} answer - The tapped value
   * @param {HTMLElement} buttonEl - The tapped tile, for presentation only
   * @returns {void}
   * @private
   */
  _handleTileAnswer(answer, buttonEl) {
    if (this.session.entry !== INPUT_MODE.TILES) return
    this._markFirstInteraction()
    this._handleAnswer(answer, buttonEl)
  }

  /**
   * The one answer handler, and the one place the double-submit guard lives. A
   * guard on the tile path alone left a fast double-tap on the keypad's
   * checkmark scoring twice, because that path never passed through it.
   *
   * `challenge.check(input)` is the sole authority on correctness. Nothing here
   * compares `input` to `challenge.answer`, and nothing reads a `data-correct`
   * attribute, because the markup carries none. `check` absorbs the type
   * differences between entry paths on its own, so no call site has to know
   * which one fired.
   * @param {*} input - Whatever the entry path collected
   * @param {HTMLElement|null} [buttonEl] - The tapped tile, when there was one
   * @returns {void}
   * @private
   */
  _handleAnswer(input, buttonEl = null) {
    if (this._isProcessingAnswer) return
    const challenge = this.session.challenge
    if (challenge === null) return

    this._isProcessingAnswer = true
    this.ui.disableAnswerButtons()
    this.keypad.setEnabled(false)

    const responseMs = this._responseMs()
    const correct = challenge.check(input) === true

    this._markTiles(challenge, correct, buttonEl)
    if (correct) {
      this._markAnswerDisplay(challenge)
      this._applyCorrect(challenge, responseMs)
    } else {
      this._applyWrong(challenge, responseMs)
    }

    this.session.factsAnswered += 1
    this.session.factsCorrect += correct ? 1 : 0

    // Assigned back: applyAnswer returns a fresh Daily and mutates nothing.
    const { daily, goalJustMet } = this.scoring.applyAnswer(this.progress.daily)
    this.progress.daily = daily
    if (goalJustMet) this.session.goalJustMetThisSession = true

    this.progress.totals.factsAnswered += 1
    this.progress.totals.factsCorrect += correct ? 1 : 0

    this._checkMilestones()
    this.ui.updateProgressBar(this.session.factsAnswered, this.settings.sessionLength)
    this._save()

    if (correct) {
      const done = this.session.factsAnswered >= this.settings.sessionLength
      const holdMs = done ? TIMING.SUMMARY_DELAY_MS : TIMING.CORRECT_FEEDBACK_MS
      this._scheduleAdvance(() => this._advanceAfterAnswer(), holdMs)
      return
    }
    this._holdMissThenTeach(challenge)
  }

  /**
   * Record a correct answer: the fact, the streak, the stars, the token, the card
   * tier, and words. `showFeedback(..., "correct")` is the only producer of the
   * `.feedback-area.correct` style, and without it a correct answer ticked a
   * counter and said nothing at all.
   * @param {Object} challenge - The live challenge
   * @param {number|null} responseMs - Measured thinking time
   * @returns {void}
   * @private
   */
  _applyCorrect(challenge, responseMs) {
    const factId = challenge.factId

    // No assignment needed here, and only here: the store writes through to the
    // one fact-record map.
    this.store.apply(factId, { correct: true, responseMs })

    this.session.streak += 1
    this.session.bestStreak = Math.max(this.session.bestStreak, this.session.streak)

    const stars = this.scoring.starsForCorrect({
      strength: this.session.strengthAtAsk,
      streak: this.session.streak,
      inputMode: challenge.entry,
    })
    this.session.starsEarned += stars
    this.progress.totals.starsTotal += stars

    this.ui.flyStars(stars)
    this.ui.showFeedback(
      `${CORRECT_PRAISE} ${challenge.left} ${TIMES_SIGN} ${challenge.right} = ${challenge.answer}`,
      "correct",
    )
    this.ui.updatePlayHud({
      sessionStars: this.session.starsEarned,
      sessionStreak: this.session.streak,
    })

    // Assigned back: advance returns a NEW trail. Dropping it leaves the token
    // frozen while every answer still looks scored.
    const result = this.journey.advance(
      this.progress.trail,
      TRAIL.SPACES_PER_CORRECT,
      this.progress.facts,
    )
    this.progress.trail = result.trail

    if (result.enteredRegionId !== null) {
      const region = this.journey.getRegion(result.enteredRegionId)
      if (region !== null) this.session.newRegionName = region.name
    }
    this._updateGatePriority(result)

    this._notePossibleNewCard(factId)
  }

  /**
   * Paint her typed answer green and leave it on screen, for presentation only.
   *
   * The keypad path used to produce no positive feedback whatsoever: nothing was
   * marked `.correct` and the readout was reset to "?" in the same turn, so the 42
   * she typed vanished at the moment she was told it was right. Every strength-3+
   * fact routes to the keypad, which made that the dominant path exactly as she
   * improved.
   *
   * Ordering matters and is now safe from both ends: `Keypad` no longer empties its
   * buffer on submit, and `GameUI` drops the `.correct` state on the next
   * `setAnswerDisplay`, which only the next keypress and the next `renderQuestion`
   * reach.
   * @param {Object} challenge - The live challenge
   * @returns {void}
   * @private
   */
  _markAnswerDisplay(challenge) {
    if (challenge.entry !== INPUT_MODE.KEYPAD) return
    this.ui.markAnswerDisplayCorrect(challenge.answer)
  }

  /**
   * Point selection at the facts the next gate is waiting on.
   *
   * This replaces the gate MESSAGE, which was the wrong tool. The sentence tried
   * to explain a stopped trail in words -- and the honest version of those words
   * named two facts the game then did not ask, because selection ignored the
   * token's position. Naming facts the player never sees is worse than saying
   * nothing: it reads as an instruction she cannot follow. Biasing the draw makes
   * the explanation unnecessary, because the gate opens on its own.
   *
   * Recomputed whenever the gating region can have moved: after a scored answer,
   * and after any change to the fact pool, since a region with no active facts is
   * skipped and a narrower pool moves the gate. A zero-space advance is the way to
   * ask for the current `gatingRegionId` without moving the token.
   * @returns {void}
   * @private
   */
  _reseedGatePriority() {
    this._updateGatePriority(this.journey.advance(this.progress.trail, 0, this.progress.facts))
  }

  /**
   * Point selection at the facts the gate `result` reports, if any.
   *
   * `gatingRegionId` is the first INCOMPLETE region -- the one whose facts
   * actually open the way -- not the locked region beyond it, whose facts do
   * nothing for the gate. `setPriorityFacts` replaces the set, so there is
   * nothing to invalidate.
   * @param {Object} result - The `AdvanceResult` `Journey.advance` just returned
   * @returns {void}
   * @private
   */
  _updateGatePriority(result) {
    const regionId = result.gatingRegionId
    if (regionId === null) {
      this.selector.setPriorityFacts([])
      return
    }
    // Only the facts still short of the bar: one already strong enough needs no
    // more practice to open this gate.
    const pending = this.journey
      .activeFactIdsForRegion(regionId)
      .filter((factId) => this.store.strengthOf(factId) < TRAIL.UNLOCK_MIN_STRENGTH)
    this.selector.setPriorityFacts(pending)
  }

  /**
   * Record a miss and reveal the answer. There is no setting that suppresses the
   * reveal and no path that skips it: a child shown an array but never the
   * number has been handed a puzzle, not an answer.
   * @param {Object} challenge - The live challenge
   * @param {number|null} responseMs - Measured thinking time
   * @returns {void}
   * @private
   */
  _applyWrong(challenge, responseMs) {
    // Called after the question was served and counted, so the retry delay reads
    // as "the number of other questions asked in between".
    this.selector.recordMiss(challenge.factId)
    this.store.apply(challenge.factId, { correct: false, responseMs })

    this.session.streak = 0
    this.ui.updatePlayHud({
      sessionStars: this.session.starsEarned,
      sessionStreak: this.session.streak,
    })
    this.ui.showFeedback(
      `${challenge.left} ${TIMES_SIGN} ${challenge.right} = ${challenge.answer}`,
      "incorrect",
    )
  }

  /**
   * Push a fact onto the session's new-card list when its card art just
   * improved, comparing against the tier captured before the answer.
   * @param {string} factId - Canonical fact id
   * @returns {void}
   * @private
   */
  _notePossibleNewCard(factId) {
    const before = CARD_TIER_RANK.get(this.session.tierAtAsk) ?? 0
    const after = CARD_TIER_RANK.get(this.store.cardTierOf(factId)) ?? 0
    if (after <= before) return
    if (this.session.newCardIds.includes(factId)) return
    this.session.newCardIds.push(factId)
  }

  /**
   * Award every gem milestone the current metrics have newly crossed. Used both
   * per answer and once more at the end of a session.
   * @returns {void}
   * @private
   */
  _checkMilestones() {
    const metrics = {
      sessionsCompleted: this.progress.totals.sessionsCompleted,
      factsCorrect: this.progress.totals.factsCorrect,
      starsTotal: this.progress.totals.starsTotal,
      masteredCount: this.store.masteredCount(),
      // `earnedRegionIds`, NOT `unlockedRegionIds`: a region with no fact in the
      // active pool is skipped, which counts as complete and therefore as
      // unlocked. With the default custom tables [6, 7] that made five regions
      // "unlocked" before a single question had been answered, so the `regions-4`
      // gem ("Halfway along the trail") was handed out on the very first answer.
      unlockedRegionCount: this.journey.earnedRegionIds(this.progress.facts).length,
      streakDays: this.progress.daily.streakDays,
    }

    // Assigned back: checkMilestones reads `awardedMilestoneIds` and never
    // appends to it, so recording the award is this method's job.
    const { newlyAwarded, gems } = this.scoring.checkMilestones(
      metrics,
      this.progress.awardedMilestoneIds,
    )
    if (newlyAwarded.length === 0) return

    this.progress.awardedMilestoneIds = [
      ...this.progress.awardedMilestoneIds,
      ...newlyAwarded.map((milestone) => milestone.id),
    ]
    this.progress.totals.gemsTotal += gems
    this.session.gemsEarned += gems
    this.session.milestoneLabels.push(...newlyAwarded.map((milestone) => milestone.label))
  }

  // -------------------------------------------------------------- Scaffold

  /**
   * Let the miss be seen, then teach it.
   *
   * The reveal, the `.incorrect` mark on the tapped tile, its shake, and the
   * highlight on the tile that was right all land in the same synchronous turn as
   * the answer. Showing the scaffold in that same turn meant none of it was ever
   * painted: a wrong tap drew nothing at all and never showed which tile was right.
   * `TIMING.WRONG_FEEDBACK_MS` is that gap.
   *
   * `_scaffoldResolved` is cleared here rather than in `_showScaffold`, so a "Got
   * it" tap arriving during the gap resolves exactly once -- it cancels the pending
   * scaffold and moves on, and the scaffold cannot then appear over the next
   * question.
   * @param {Object} challenge - The challenge that was just missed
   * @returns {void}
   * @private
   */
  _holdMissThenTeach(challenge) {
    this._scaffoldResolved = false
    this._scheduleAdvance(() => this._showScaffold(challenge), TIMING.WRONG_FEEDBACK_MS)
  }

  /**
   * Show the post-miss teaching array. The scaffold owns the play area while it
   * is up: the keypad goes inert and the scaffold becomes the only live region,
   * so a screen reader narrates one thing.
   *
   * Tiles, if ever restored, are FROZEN rather than removed, so the tile
   * marked `.correct` and the one marked `.incorrect` are still readable while the
   * scaffold teaches -- they occupy the `entry` grid area and the scaffold occupies
   * `extra`, so both fit. On a keypad question there are no tiles to keep,
   * and an empty-but-visible `#answer-tiles` would take a row for nothing, so that
   * path still clears and hides.
   *
   * Both exits are armed here -- the "Got it" button (wired to
   * `_resolveScaffold` through `onScaffoldContinue`) and a computed auto-advance
   * fallback. The duration is computed rather than fixed because a fixed 3200 ms
   * cut `9 × 9` off after 7 of its 9 skip-count numbers.
   * @param {Object} challenge - The challenge that was just missed
   * @returns {void}
   * @private
   */
  _showScaffold(challenge) {
    const scaffold = challenge.scaffold
    if (!scaffold) {
      this._resolveScaffold()
      return
    }

    this._scaffoldResolved = false
    if (challenge.entry === INPUT_MODE.TILES) {
      this.ui.freezeTiles()
    } else {
      this.ui.clearTiles()
      this.ui.setTilesVisible(false)
    }
    this.ui.setKeypadVisible(false)
    this.keypad.setEnabled(false)
    this._setLiveRegions("off")
    this.ui.showScaffold(scaffold)

    const rows = Array.isArray(scaffold.skipCounts) ? scaffold.skipCounts.length : 0
    this._tickSkipCount(0, rows)

    const displayMs = rows * TIMING.SKIP_COUNT_TICK_MS + TIMING.SCAFFOLD_DWELL_MS
    this._scheduleAdvance(() => this._resolveScaffold(), displayMs)
  }

  /**
   * Light one skip-count number and schedule the next. Chained timeouts rather
   * than an interval, so there is a single id to cancel -- and `_pendingSkipTick`
   * records which number comes next, so the settings modal can pause the animation
   * instead of restarting it from the first number.
   * @param {number} index - Which skip-count number to light
   * @param {number} total - How many there are
   * @returns {void}
   * @private
   */
  _tickSkipCount(index, total) {
    if (index >= total) {
      this._pendingSkipTick = null
      return
    }
    this.ui.highlightSkipCount(index)
    this._pendingSkipTick = { index: index + 1, total }
    this._skipCountTimeoutId = setTimeout(() => {
      this._skipCountTimeoutId = null
      this._tickSkipCount(index + 1, total)
    }, TIMING.SKIP_COUNT_TICK_MS)
  }

  /**
   * Dismiss the scaffold and move on. Idempotent, so a tap landing in the same
   * frame as the auto-advance timer cannot ask two questions: whichever exit
   * fires first wins and the second is a no-op.
   * @returns {void}
   * @private
   */
  _resolveScaffold() {
    if (this._scaffoldResolved) return
    this._scaffoldResolved = true
    this._clearPendingTimers()
    this._setLiveRegions("polite")
    this.ui.hideScaffold()
    this._advanceAfterAnswer()
  }

  /**
   * Either ask the next question or end the session.
   * @returns {void}
   * @private
   */
  _advanceAfterAnswer() {
    if (this.session.factsAnswered >= this.settings.sessionLength) {
      this._finishSession()
      return
    }
    this._askNextQuestion()
  }

  /**
   * Close out a session.
   *
   * The order is the whole point: increment, then check milestones, then
   * persist, and only then build the summary view. Building it first meant
   * session 1's summary was assembled while `sessionsCompleted` was still 0 and
   * no milestone had been evaluated, so the very first session -- the one where
   * a child most needs to be told she earned something -- always showed an empty
   * milestone list.
   * @returns {void}
   * @private
   */
  _finishSession() {
    this._clearPendingTimers()
    this._setLiveRegions("polite")
    this.keypad.setEnabled(false)
    this.session.challenge = null
    this._isProcessingAnswer = false

    this.progress.totals.sessionsCompleted += 1
    this._checkMilestones()
    this._save()

    this.ui.renderSessionSummary(this._buildSummaryView())
    this.ui.showScreen("summary-screen")
  }

  // ---------------------------------------------------------- View models

  /**
   * The hub HUD: lifetime numbers, the flame, and where the token is standing.
   * @returns {void}
   * @private
   */
  _refreshHud() {
    this.ui.updateHud({
      starsTotal: this.progress.totals.starsTotal,
      gemsTotal: this.progress.totals.gemsTotal,
      streakDays: this.progress.daily.streakDays,
      flame: this.scoring.flameStage(this.progress.daily),
      regionName: this._currentRegionName(),
    })
  }

  /**
   * The name of the region the token is standing in.
   * @returns {string} The region name, or "" when the space is out of range
   * @private
   */
  _currentRegionName() {
    const region = this.journey.regionForSpace(this.progress.trail.space)
    return region === null ? "" : region.name
  }

  /**
   * The play screen's one-row trail indicator.
   * @returns {Object} A `PlayTrailStripView`
   * @private
   */
  _buildStripView() {
    const space = this.progress.trail.space
    const region = this.journey.regionForSpace(space)
    const startSpace = region === null ? 0 : this.journey.regionStartSpace(region.id)
    const lastUnlocked = this.journey.lastUnlockedSpace(this.progress.facts)
    return {
      regionName: region === null ? "" : region.name,
      regionEmoji: region === null ? "" : region.emoji,
      spacesInRegion: region === null ? TRAIL.SPACES_PER_REGION : region.spaces,
      indexInRegion: space - startSpace,
      gated: space >= lastUnlocked,
    }
  }

  /**
   * One collectible card's view model.
   * @param {string} factId - Canonical fact id
   * @returns {Object} A `CardView`
   * @private
   */
  _buildCardView(factId) {
    const fact = getFact(factId)
    return {
      factId,
      a: fact === null ? 0 : fact.a,
      b: fact === null ? 0 : fact.b,
      product: fact === null ? 0 : fact.product,
      tier: this.store.cardTierOf(factId),
      isNew: this.session.newCardIds.includes(factId),
    }
  }

  /**
   * Everything the session summary shows.
   * @returns {Object} A `SummaryView`
   * @private
   */
  _buildSummaryView() {
    return {
      stars: this.session.starsEarned,
      gems: this.session.gemsEarned,
      factsCorrect: this.session.factsCorrect,
      factsAnswered: this.session.factsAnswered,
      bestStreak: this.session.bestStreak,
      newCards: this.session.newCardIds.map((factId) => this._buildCardView(factId)),
      newRegionName: this.session.newRegionName,
      milestoneLabels: [...this.session.milestoneLabels],
      goalJustMet: this.session.goalJustMetThisSession,
    }
  }

  // -------------------------------------------------------------- Plumbing

  /**
   * A `Journey` bound to the fact pool currently in play. Gating counts only the
   * facts in both a region and the active pool, so the pool is a construction
   * argument rather than a setter -- change the pool, build a new journey.
   * @returns {Journey} A journey for the current settings
   * @private
   */
  _buildJourney() {
    return new Journey({ activePool: this.settings.factPool, now: this._now })
  }

  /**
   * A fresh session state.
   * @param {string} modeId - The mode being played
   * @returns {SessionState} A new session object
   * @private
   */
  _createSession(modeId) {
    return {
      modeId,
      factsAnswered: 0,
      factsCorrect: 0,
      streak: 0,
      bestStreak: 0,
      starsEarned: 0,
      gemsEarned: 0,
      newCardIds: [],
      milestoneLabels: [],
      askedAt: null,
      firstInteractionAt: null,
      strengthAtAsk: 0,
      tierAtAsk: CARD_TIERS[0].id,
      entry: INPUT_MODE.TILES,
      challenge: null,
      goalJustMetThisSession: false,
      newRegionName: null,
    }
  }

  /**
   * Mark the tiles after the fact, for presentation only. The correct tile is
   * found by VALUE: correctness has already been decided by `challenge.check`,
   * and the markup deliberately carries no answer key to read back.
   * @param {Object} challenge - The live challenge
   * @param {boolean} correct - What `challenge.check` said
   * @param {HTMLElement|null} buttonEl - The tapped tile, if any
   * @returns {void}
   * @private
   */
  _markTiles(challenge, correct, buttonEl) {
    if (challenge.entry !== INPUT_MODE.TILES) return
    const correctTile = document.querySelector(`#answer-tiles [data-answer="${challenge.answer}"]`)
    if (correctTile !== null) this.ui.markButtonCorrect(correctTile)
    if (correct || !buttonEl || buttonEl === correctTile) return
    this.ui.markButtonIncorrect(buttonEl)
    this.ui.shakeButton(buttonEl)
  }

  /**
   * Set `aria-live` on the two regions the scaffold silences. One of the four
   * places this module touches `document` directly; `GameUI` owns the content of
   * these elements, this owns their announcement policy for the scaffold's
   * duration.
   * @param {"off"|"polite"} value - The value to set
   * @returns {void}
   * @private
   */
  _setLiveRegions(value) {
    for (const id of LIVE_REGION_IDS) {
      const element = document.getElementById(id)
      if (element !== null) element.setAttribute("aria-live", value)
    }
  }

  /**
   * Arm the one pending advance, replacing whatever was armed. The three phases of
   * an answer are sequential, so a single slot is the whole schedule.
   * @param {() => void} run - What to do when the hold is over
   * @param {number} delayMs - How long to hold
   * @returns {void}
   * @private
   */
  _scheduleAdvance(run, delayMs) {
    this._cancelAdvanceTimer()
    this._pendingAdvance = { run, delayMs }
    this._advanceTimeoutId = setTimeout(() => {
      this._advanceTimeoutId = null
      this._pendingAdvance = null
      run()
    }, delayMs)
  }

  /**
   * Cancel the advance timer but keep its descriptor, so it can be re-armed.
   * @returns {void}
   * @private
   */
  _cancelAdvanceTimer() {
    if (this._advanceTimeoutId !== null) {
      clearTimeout(this._advanceTimeoutId)
      this._advanceTimeoutId = null
    }
  }

  /**
   * Cancel the skip-count timer but keep its descriptor, so it can be re-armed.
   * @returns {void}
   * @private
   */
  _cancelSkipTickTimer() {
    if (this._skipCountTimeoutId !== null) {
      clearTimeout(this._skipCountTimeoutId)
      this._skipCountTimeoutId = null
    }
  }

  /**
   * Stop the clock without forgetting what it was counting down to, for as long as
   * the settings modal is open. See `openSettings` for the failure this prevents.
   * @returns {void}
   * @private
   */
  _pauseTimers() {
    this._cancelAdvanceTimer()
    this._cancelSkipTickTimer()
  }

  /**
   * Re-arm whatever `_pauseTimers` put down: the advance gets its full delay
   * again, and the skip counts pick up at the number they had reached. Coming back
   * from the settings modal then reads as "the scaffold waited for you" instead of
   * as a jump. A no-op when nothing was pending.
   * @returns {void}
   * @private
   */
  _resumeTimers() {
    const skip = this._pendingSkipTick
    if (skip !== null && this._skipCountTimeoutId === null) {
      this._skipCountTimeoutId = setTimeout(() => {
        this._skipCountTimeoutId = null
        this._tickSkipCount(skip.index, skip.total)
      }, TIMING.SKIP_COUNT_TICK_MS)
    }
    const advance = this._pendingAdvance
    if (advance !== null) this._scheduleAdvance(advance.run, advance.delayMs)
  }

  /**
   * Cancel every pending timer and forget what it was for. Without this, leaving
   * the play screen mid-hold lets a queued question render itself on top of the
   * hub. Unlike `_pauseTimers`, nothing here can be resumed -- which is the point,
   * since the session it belonged to is over.
   * @returns {void}
   * @private
   */
  _clearPendingTimers() {
    this._pauseTimers()
    this._pendingAdvance = null
    this._pendingSkipTick = null
    this._scaffoldResolved = true
  }
}

// Boot the game once the page exists. A failure here would otherwise leave a
// blank screen, so it puts a readable message on the page instead. `main.css`
// does not style `.error-container`, hence the few inline styles.
document.addEventListener("DOMContentLoaded", () => {
  try {
    window.game = new TimesTrail()
  } catch (error) {
    console.error("Failed to initialize Times Trail:", error)
    const errorContainer = document.createElement("div")
    errorContainer.className = "error-container"
    errorContainer.style.margin = "2rem auto"
    errorContainer.style.maxWidth = "36rem"
    errorContainer.style.padding = "1rem"
    errorContainer.style.textAlign = "center"
    // Static template, no interpolation -- see this file's Security Note.
    errorContainer.innerHTML = `
      <h2>Game Failed to Load</h2>
      <p>Sorry -- Times Trail hit an error while starting up.</p>
      <p>Try refreshing the page. If it keeps happening, your browser may not support this game.</p>
    `
    document.body.prepend(errorContainer)
  }
})

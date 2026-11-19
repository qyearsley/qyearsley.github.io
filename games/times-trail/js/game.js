/**
 * Times Trail -- the page entry point and session orchestrator.
 *
 * The only module that knows about every other one. It owns the live game
 * state, wires the DOM events to the pure logic modules, and decides when things
 * happen; it has no rules of its own beyond sequencing. `GameUI` does the
 * rendering.
 *
 * Two invariants a reader will otherwise trip over:
 *
 *   - **One fact-record map.** `MasteryStore` aliases the map it is given, so
 *     `this.store.records === this.progress.facts` for the life of the page.
 *     Nothing ever reassigns `this.progress.facts`; a "start fresh" rebuilds the
 *     progress object and the store together, as a pair. Break the alias and
 *     spaced repetition, trail progress, and persistence all read an empty map
 *     while the screen still looks right.
 *   - **Every non-mutating call's return value is assigned.** `Journey.advance`,
 *     `Scoring.applyAnswer`, `Scoring.rollDaily`, and `Scoring.checkMilestones`
 *     return new values and touch nothing. A dropped return reads like working
 *     code and silently kills the feature. `store.apply()` is the one call that
 *     needs no assignment, because the store writes through the aliased map.
 *
 * Timers: only one advance is pending at a time (the hold after a correct
 * answer, the hold after a miss, or the scaffold's auto-advance). It is kept as
 * a `{run, delayMs}` descriptor so `_pauseTimers()` and `_resumeTimers()` can
 * stop and restart it while the settings modal is open.
 */

import {
  CARD_TIERS,
  KEYPAD,
  OPERAND_MAX,
  OPERAND_MIN,
  RESPONSE_TIME,
  TIMING,
  TRAIL,
} from "./constants.js"
import { FACTS, getFact, getFactFor, getTrail } from "./facts.js"
import { MasteryStore } from "./MasteryModel.js"
import { FactSelector } from "./FactSelector.js"
import { allTrailProgress, Journey, normalizeTrailId } from "./Journey.js"
import { Scoring } from "./Scoring.js"
import { Settings } from "./Settings.js"
import { StorageManager, defaultProgress } from "./storage.js"
import { Keypad } from "./Keypad.js"
import { GameUI } from "./GameUI.js"
import { EventManager } from "./EventManager.js"
import { createChallenge } from "./modes/quickRecall.js"

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
 * the prompts `quickRecall.js` builds.
 * @private
 * @type {string}
 */
const TIMES_SIGN = "×"

/** Shown ahead of the restated fact on a correct answer. */
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
 * @property {Object|null} challenge      - The live `Challenge`, or null between questions
 * @property {boolean} goalJustMetThisSession - Today's goal was met during this session
 * @property {string|null} trailFinishedName - Trail finished this session, or null
 */

class TimesTrail {
  /**
   * Screens whose back button returns to the hub without ending anything. The
   * play screen is deliberately absent: leaving it abandons a session, which is
   * a different action.
   * @private
   */
  static HUB_RETURN_SCREENS = Object.freeze(["map-screen", "collection-screen"])

  /**
   * Text of the "start fresh" confirmation. Kept as configuration so the one
   * destructive action in the game reads the same wherever it is referenced.
   * @private
   */
  static RESET_PROMPT = "Start fresh? This erases your trail, your cards, and every star."

  /** Text of the "leave this session" confirmation: says what is and is not lost. @private */
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

    /** @type {() => number} Injected randomness, handed to `createChallenge`. @private */
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

    /** @type {MasteryStore} ALIASES `this.progress.facts`; see the header. */
    this.store = new MasteryStore(this.progress.facts, this._now)

    /** @type {Settings} Validated settings; the authority `buildSaveState` persists. */
    this.settings = new Settings(this.progress.settings)

    // Assigned back: this returns a new object and mutates nothing.
    this.progress.daily = this.scoring.rollDaily(this.progress.daily)

    /** @type {Journey} The trail being walked; rebuilt when the trail changes. */
    this.journey = this._buildJourney()

    /** @type {SessionState} */
    this.session = this._createSession()

    /** @type {boolean} The ONE double-submit guard, covering every entry path. @private */
    this._isProcessingAnswer = false

    /** @type {{run: () => void, delayMs: number}|null} The one pending advance. @private */
    this._pendingAdvance = null

    /** @type {number|null} Timer id for `_pendingAdvance`. @private */
    this._advanceTimeoutId = null

    /** @type {{index: number, total: number}|null} Next skip-count number to light. @private */
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
      // Play and Keep Going both go straight into a session.
      onStart: () => this.startSession(),
      onContinue: () => this.startSession(),
      onStartFresh: () => this.startFresh(),
      onShowProgress: () => this.showHub(),
      onHome: () => this.showTitle(),
      onBack: (sourceScreenId) => this.goBack(sourceScreenId),
      onScaffoldContinue: () => this._resolveScaffold(),
      onStartTrail: (trailId) => this.startTrail(trailId),
      onShowMap: () => this.showMap(),
      onShowCollection: () => this.showCollection(),
      onPlayAgain: () => this.startSession(),
      onSummaryHub: () => this.showHub(),
      onSettingsOpen: () => this.openSettings(),
      onSettingsClose: () => this.closeSettings(),
      onSettingChange: (key, value) => this.changeSetting(key, value),
    })
    this.events.initializeEventListeners()

    this.ui.updateTitleButtons(loaded !== null)
    this.ui.renderSettings(this.settings.toJSON())
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
      trails: {
        currentId: this.progress.trails.currentId,
        spaces: { ...this.progress.trails.spaces },
      },
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
   * inline styles it needs to be legible on its own.
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
    // the stars, and says nothing about the session length -- but rebuilding
    // `Settings` from the fresh defaults silently reset it. The live instance stays the authority, so the fresh
    // progress object is made to agree with it instead.
    this.progress.settings = this.settings.toJSON()
    this.progress.daily = this.scoring.rollDaily(this.progress.daily)
    this.journey = this._buildJourney()
    this.selector.reset()
    this.session = this._createSession()

    this.ui.renderSettings(this.settings.toJSON())
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
   * Show the hub: the list of trails, plus the lifetime HUD. Tapping a trail row
   * starts a round on it.
   * @returns {void}
   */
  showHub() {
    this._refreshHud()
    this._renderTrailList()
    this.ui.showScreen("hub-screen")
  }

  /**
   * Route a back button by the screen it is leaving, rather than by inspecting
   * which screen happens to be active. The play screen's back button abandons a
   * session; the two list screens' buttons just return to the hub.
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
   * Draw every trail into the hub, not just the one being walked. The current
   * one is highlighted, and each row says whether tapping it starts or continues.
   * @returns {void}
   * @private
   */
  _renderTrailList() {
    const statuses = allTrailProgress({
      records: this.progress.facts,
      spaces: this.progress.trails.spaces,
      now: this._now,
    })
    const trails = statuses.map((status) => {
      const trail = getTrail(status.trailId)
      return {
        id: status.trailId,
        name: trail.name,
        emoji: trail.emoji,
        blurb: trail.blurb,
        current: status.trailId === this.journey.trailId,
        space: status.space,
        totalSpaces: status.totalSpaces,
        strong: status.strong,
        total: status.total,
        complete: status.complete,
      }
    })

    this.ui.renderTrail({ trails })
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
    this.ui.renderSettings(this.settings.toJSON())
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
   * Apply one setting.
   *
   * The round counter is redrawn because the session length is allowed to change
   * MID-SESSION. Every read of `settings.sessionLength` is live, so shortening
   * the round already took effect immediately in the logic -- but the counter is
   * only written when a question is asked, so it went on claiming "Question 7 of
   * 20" until the next question and read as a setting that had not applied.
   *
   * The question number is clamped to the new length: dropping to 10 after 15
   * answers would otherwise read "Question 16 of 10". The round then ends on the next answer via `_advanceAfterAnswer`, which is
   * deliberate -- finishing it here would show the summary underneath the open
   * `aria-modal` settings dialog, the exact failure `_pauseTimers` exists to
   * prevent.
   * @param {string} key - Settings key
   * @param {*} value - Candidate value; rejected values change nothing
   * @returns {void}
   */
  changeSetting(key, value) {
    if (!this.settings.update(key, value)) return
    this.ui.renderSettings(this.settings.toJSON())
    if (key === "sessionLength") {
      const length = this.settings.sessionLength
      this.ui.updateRoundCount(Math.min(this.session.factsAnswered + 1, length), length)
    }
    this._save()
  }

  // ------------------------------------------------------------ Session loop

  /**
   * Begin a session. `selector.reset()` is unconditional: without it a fact
   * missed at the end of the last session fires immediately and every retry
   * delay is measured from the wrong origin.
   *
   * A round asks only the facts of the trail being walked (see
   * `_askNextQuestion`).
   * @returns {void}
   */
  startSession() {
    this._clearPendingTimers()
    this._setLiveRegions("polite")
    this.session = this._createSession()
    this.selector.reset()
    this.journey = this._buildJourney()
    this._isProcessingAnswer = false

    this.ui.updatePlayHud({ sessionStars: 0, sessionStreak: 0 })
    this.ui.showScreen("play-screen")
    this._askNextQuestion()
  }

  /**
   * Start a round on one trail: make it the current trail, then begin.
   * Unknown ids fall back to the default trail rather than throwing, since the
   * id comes from a DOM attribute.
   * @param {string} trailId - The trail to walk
   * @returns {void}
   */
  startTrail(trailId) {
    this.progress.trails.currentId = normalizeTrailId(trailId)
    this._save()
    this.startSession()
  }

  /**
   * Build, render, and arm one question.
   *
   * The pool is all of the current trail's facts (`journey.factIds`). Misses
   * re-ask from the same pool.
   *
   * Order matters twice over. The strength and card tier are captured BEFORE the
   * answer, because star weighting and the "new card"
   * check all depend on the pre-answer values. And `askedAt` is stamped LAST,
   * after the DOM is written and the question is genuinely on screen, so the
   * measured thinking time does not include the render.
   * @returns {void}
   * @private
   */
  _askNextQuestion() {
    const factId = this.selector.selectNext(this.journey.factIds, this.progress.facts)
    const fact = factId === null ? null : getFact(factId)
    if (fact === null) {
      console.error("Times Trail: no fact available to ask; returning to the hub")
      this.showHub()
      return
    }

    const strengthAtAsk = this.store.strengthOf(factId)
    const challenge = createChallenge(fact, this._rng)

    this.session.strengthAtAsk = strengthAtAsk
    this.session.tierAtAsk = this.store.cardTierOf(factId)
    this.session.challenge = challenge

    this.ui.renderQuestion(challenge)

    this.keypad.setEnabled(true)
    this.keypad.clear()
    this.ui.setAnswerDisplay(KEYPAD.EMPTY_DISPLAY)
    this.ui.renderPlayTrailStrip(this._buildStripView())
    const length = this.settings.sessionLength
    this.ui.updateRoundCount(Math.min(this.session.factsAnswered + 1, length), length)

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
   * taps plus a check mark, so a fast recall read as `slow`. What that cost was the collection, not the trail: a
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
   * The one answer handler, and the one place the double-submit guard lives. A
   * fast double-tap on the keypad's checkmark must not score twice.
   *
   * `challenge.check(input)` is the sole authority on correctness. Nothing here
   * compares `input` to `challenge.answer`. `check` absorbs the type differences
   * between inputs on its own, so no call site has to know which one fired.
   * @param {*} input - Whatever the keypad collected
   * @returns {void}
   * @private
   */
  _handleAnswer(input) {
    if (this._isProcessingAnswer) return
    const challenge = this.session.challenge
    if (challenge === null) return

    this._isProcessingAnswer = true
    this.keypad.setEnabled(false)

    const responseMs = this._responseMs()
    const correct = challenge.check(input) === true

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
    const result = this.journey.advance(this._currentTrailPosition())
    this._setCurrentTrailPosition(result.trail)

    if (result.finished) this.session.trailFinishedName = this.journey.trail?.name ?? null

    this._notePossibleNewCard(factId)
  }

  /**
   * Paint her typed answer green and leave it on screen, for presentation only.
   *
   * Safe from both ends: `Keypad` does not empty its buffer on submit, and
   * `GameUI` drops the `.correct` state on the next `setAnswerDisplay`, which
   * only the next keypress and the next `renderQuestion` reach.
   * @param {Object} challenge - The live challenge
   * @returns {void}
   * @private
   */
  _markAnswerDisplay(challenge) {
    this.ui.markAnswerDisplayCorrect(challenge.answer)
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
      // Trails FINISHED, not trails available: the token is on the last space.
      completedTrailCount: allTrailProgress({
        records: this.progress.facts,
        spaces: this.progress.trails.spaces,
        now: this._now,
      }).filter((status) => status.complete).length,
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
   * The wrong-answer reveal lands in the same synchronous turn as the answer.
   * Showing the scaffold in that same turn meant none of it was ever painted.
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
    })
  }

  /**
   * The play screen's one-row trail indicator.
   *
   * It shows the WHOLE trail now, not the five spaces of the region the token
   * happens to be in. A trail is 20 spaces, which fits the strip,
   * and showing all of it means the strip answers "how far through Squares am
   * I" rather than "how far through an arbitrary fifth of a 40-space board".
   * @returns {Object} A `PlayTrailStripView`
   * @private
   */
  _buildStripView() {
    const trail = this.journey.trail
    return {
      trailName: trail?.name ?? "",
      trailEmoji: trail?.emoji ?? "",
      totalSpaces: TRAIL.SPACES,
      space: this._currentTrailPosition().space,
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
      trailFinishedName: this.session.trailFinishedName,
      milestoneLabels: [...this.session.milestoneLabels],
      goalJustMet: this.session.goalJustMetThisSession,
    }
  }

  // -------------------------------------------------------------- Plumbing

  /**
   * A `Journey` for the trail being walked. The trail is a construction argument
   * rather than a setter, so changing trail is a new journey.
   * @returns {Journey} A journey for the current trail
   * @private
   */
  _buildJourney() {
    return new Journey({
      trailId: this.progress.trails.currentId,
      now: this._now,
    })
  }

  /**
   * The token's position on the trail now being walked.
   * @returns {{space: number}} A position object; `{space: 0}` when unvisited
   * @private
   */
  _currentTrailPosition() {
    return { space: this.progress.trails.spaces[this.journey.trailId] ?? 0 }
  }

  /**
   * Write the token's position back for the trail now being walked.
   * @param {{space: number}} trail - The position `advance` returned
   * @private
   */
  _setCurrentTrailPosition(trail) {
    this.progress.trails.spaces[this.journey.trailId] = trail.space
  }

  /**
   * A fresh session state.
   * @returns {SessionState} A new session object
   * @private
   */
  _createSession() {
    return {
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
      challenge: null,
      goalJustMetThisSession: false,
      trailFinishedName: null,
    }
  }

  /**
   * Set `aria-live` on the two regions the scaffold silences. One of the few
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

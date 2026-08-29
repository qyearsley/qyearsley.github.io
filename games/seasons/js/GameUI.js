/**
 * Seasons UI -- every DOM write in the game.
 *
 * `GameUI` extends the shared `BaseGameUI` and contains no game rules. It is
 * handed a state and told to draw it; it never decides what an answer is worth,
 * whether a season is won, or what question comes next.
 *
 * - It must not import GameState. Reading a state is fine, advancing one is
 *   not, and the absent import is what keeps that from happening by accident.
 *   (GameState and seasons.js appear in JSDoc types below; a type is a comment,
 *   not an import.)
 * - Nothing here uses `innerHTML`. Every node is built with `createElement` or
 *   the art pack's `createElementNS` helper, and every string is written with
 *   `textContent`. `BaseGameUI.setHTML` exists but is deliberately unused.
 * - No drawing decision lives here. Characters, items, scenery, the snake
 *   woman, the trail curve, and the palette all come from the active art pack,
 *   so this file works unchanged when the art is replaced.
 * - Trail markers are placed by walking the art pack's path with
 *   `getPointAtLength`, so a new pack can hand back a spiral instead of a wave
 *   and the layout follows. jsdom implements no SVG geometry, so `_pointsAlong`
 *   falls back to an evenly spaced line when the method is missing; that keeps
 *   the class constructible under test without a test-only branch in the
 *   caller.
 * - The countdown lives here rather than in GameState, because a clock is not a
 *   rule. `startTimer` owns the interval and `stopTimer` is safe to call at any
 *   time, including when no timer is running.
 *
 * Error Handling: every method returns quietly when the element it needs is
 * absent, matching `BaseGameUI`'s style. A missing node means the markup and
 * this file have drifted, which should degrade the screen rather than stop the
 * game mid-season.
 */

import { BaseGameUI } from "../../shared/BaseGameUI.js"
import { activePack, svg } from "./art/index.js"
import { CHARACTERS, getCharacter } from "./characters.js"
import { PLAY, RULES, WRONG_ANSWER } from "./constants.js"
import { buildTrail, progress } from "./Journey.js"

/**
 * How long the correct/incorrect flash stays on an answer button, in
 * milliseconds. Long enough to read, short enough not to break the rhythm.
 * @private
 */
const FLASH_MS = 900

/**
 * Countdown tick, in milliseconds. 100ms keeps the bar smooth without waking
 * the page 60 times a second for a value that changes once a second.
 * @private
 */
const TICK_MS = 100

/**
 * Ceiling on drawn item slots. Comfortably above anything a real run reaches;
 * it exists only so a corrupted save cannot turn the HUD into an unbounded
 * render.
 * @private
 */
const MAX_ITEM_PIPS = 60

export class GameUI extends BaseGameUI {
  constructor() {
    super()
    this.pack = activePack()
    /** @type {number|null} Interval id for the countdown, null when stopped. */
    this._timerId = null
    /** @type {number} Milliseconds left on the current question. */
    this._timeLeftMs = 0
    this.cacheElements()
  }

  /**
   * Cache the nodes this class writes to. Called once at construction; a node
   * that is missing here shows up as a quiet no-op later rather than a throw.
   */
  cacheElements() {
    const ids = [
      "character-grid",
      "season-name",
      "demand-line",
      "villain-portrait",
      "item-count",
      "item-track",
      "wilt-note",
      "perk-note",
      "trail",
      "question-prompt",
      "question-tag",
      "choices",
      "timer",
      "timer-wrap",
      "timer-bar",
      "feedback",
      "result-title",
      "result-text",
      "result-summary",
      "result-actions",
    ]
    for (const id of ids) {
      this.elements[id] = document.getElementById(id)
    }
  }

  /**
   * Drop an art-pack drawing into a container, replacing whatever was there.
   * @private
   * @param {HTMLElement|null} container - Where to put it
   * @param {import("./art/index.js").Drawing} drawing - From the art pack
   * @param {string} [className] - Class for the `<svg>` wrapper
   * @returns {SVGElement|null} The wrapper, or null if there was no container
   */
  _mount(container, drawing, className = "") {
    if (!container || !drawing) return null
    container.replaceChildren()
    const wrapper = svg("svg", {
      viewBox: drawing.viewBox,
      class: className,
      "aria-hidden": "true",
      focusable: "false",
    })
    wrapper.append(drawing.element)
    container.append(wrapper)
    return wrapper
  }

  /**
   * Apply a season's palette to the page. The stylesheet reads these custom
   * properties and never names a season itself.
   *
   * @param {import("./seasons.js").Season|null} season - The season being played
   */
  applyPalette(season) {
    if (!season) return
    const colors = this.pack.palette(season.id)
    for (const [property, value] of Object.entries(colors)) {
      document.documentElement.style.setProperty(property, value)
    }
    document.documentElement.dataset.season = season.id
  }

  /**
   * Draw the character-select screen.
   *
   * The cards carry no `aria-pressed`: choosing one starts the season
   * immediately, so there is no persistent selected state for it to describe,
   * and a default character would make the first card announce itself as
   * already pressed. They are plain action buttons.
   *
   * @param {function(string): void} onChoose - Called with a character id
   */
  renderCharacterCards(onChoose) {
    const grid = this.elements["character-grid"]
    if (!grid) return
    grid.replaceChildren()

    for (const entry of CHARACTERS) {
      const card = document.createElement("button")
      card.type = "button"
      card.className = "character-card"
      card.dataset.characterId = entry.id

      const art = document.createElement("span")
      art.className = "character-art"
      this._mount(art, this.pack.character(entry.id), "character-svg")
      card.append(art)

      const name = document.createElement("span")
      name.className = "character-name"
      name.textContent = entry.name
      card.append(name)

      const perk = document.createElement("span")
      perk.className = "character-perk"
      perk.textContent = entry.perkName
      card.append(perk)

      const perkText = document.createElement("span")
      perkText.className = "character-perk-text"
      perkText.textContent = entry.perkText
      card.append(perkText)

      if (entry.costText) {
        const cost = document.createElement("span")
        cost.className = "character-cost"
        cost.textContent = entry.costText
        card.append(cost)
      }

      card.addEventListener("click", () => onChoose(entry.id))
      grid.append(card)
    }
  }

  /**
   * Space markers evenly spaced along the trail path.
   *
   * Uses the real path geometry when the browser provides it. jsdom does not
   * implement `getPointAtLength`, so the fallback spreads the markers along a
   * straight line -- the numbers are wrong but the structure is right, which is
   * all a test needs.
   *
   * @private
   * @param {SVGPathElement} path - The trail path
   * @param {number} count - How many points to place
   * @param {number} width - Path viewBox width, for the fallback
   * @param {number} height - Path viewBox height, for the fallback
   * @returns {Array<{x: number, y: number}>} One point per space, plus the boss
   */
  _pointsAlong(path, count, width, height) {
    const total = count > 1 ? count - 1 : 1
    const supported = typeof path?.getTotalLength === "function"
    let length = 0
    if (supported) {
      try {
        length = path.getTotalLength()
      } catch {
        length = 0
      }
    }
    if (!length) {
      return Array.from({ length: count }, (_, i) => ({
        x: (width / total) * i,
        y: height / 2,
      }))
    }
    return Array.from({ length: count }, (_, i) => {
      const point = path.getPointAtLength((length / total) * i)
      return { x: point.x, y: point.y }
    })
  }

  /**
   * Draw the trail: scenery, the path, one marker per space, the boss marker,
   * and the character token at its current position.
   *
   * @param {import("./seasons.js").Season|null} season - The season being played
   * @param {number} position - The player's position, 0 .. season.spaces
   * @param {string} characterId - Which animal to draw as the token
   */
  renderTrail(season, position, characterId) {
    const host = this.elements.trail
    if (!host || !season) return

    // Built once per season+character, then only moved. The CSS transitions on
    // `.trail-token` and `.trail-walked` need an element that persists while
    // its value changes; rebuilding the SVG every question makes them dead code
    // and the token teleports instead of walking.
    const key = `${season.id}:${characterId}`
    if (this._trailKey === key && this._trail?.canvas.isConnected) {
      this._updateTrail(season, position)
      return
    }

    const { d, viewBox, width, height } = this.pack.trailPath(season)
    host.replaceChildren()

    const canvas = svg("svg", {
      viewBox,
      class: "trail-svg",
      role: "img",
    })

    // Scenery sits behind everything, in the same coordinate system.
    canvas.append(this.pack.scenery(season.id).element)

    // The walked part of the path is drawn over the whole path, so the trail
    // visibly fills in as the journey goes on. `pathLength="1"` renormalizes
    // the curve to a length of 1, which lets the stylesheet express the dash
    // offset as a plain fraction whatever shape the art pack hands back.
    const track = svg("path", { d, class: "trail-track", fill: "none" })
    canvas.append(track)
    const walked = svg("path", { d, class: "trail-walked", fill: "none", pathLength: "1" })
    canvas.append(walked)

    const spaces = buildTrail(season)

    const markers = spaces.map((space) => {
      const marker = svg("g", {
        class: `trail-marker${space.glowing ? " is-glowing" : ""}`,
      })
      if (space.glowing) {
        // Ella's "light where it's pretty and glowing".
        marker.append(svg("circle", { r: 17, class: "marker-glow" }))
        marker.append(svg("circle", { r: 11, class: "marker-glow-inner" }))
      }
      marker.append(svg("circle", { r: space.glowing ? 8 : 6, class: "marker-dot" }))
      canvas.append(marker)
      return marker
    })

    const boss = svg("g", { class: "trail-boss" })
    const bossArt = this.pack.villain().element
    bossArt.setAttribute("transform", "translate(-26 -52) scale(0.52)")
    boss.append(bossArt)
    canvas.append(boss)

    const token = svg("g", { class: "trail-token" })
    const tokenArt = this.pack.character(characterId).element
    tokenArt.setAttribute("transform", "scale(0.44)")
    token.append(tokenArt)
    canvas.append(token)

    // Append before measuring. `getTotalLength()` on a detached path returns 0
    // in some engines, and `_pointsAlong` reads 0 as "unsupported" and silently
    // drops to the straight-line fallback meant for jsdom -- which would put
    // every marker in a row across a wavy path, with no error anywhere.
    host.append(canvas)

    const points = this._pointsAlong(track, spaces.length + 1, width, height)
    markers.forEach((marker, index) => {
      marker.setAttribute("transform", `translate(${points[index].x} ${points[index].y})`)
    })
    const bossPoint = points[points.length - 1]
    boss.setAttribute("transform", `translate(${bossPoint.x} ${bossPoint.y})`)

    this._trailKey = key
    this._trail = { canvas, walked, token, markers, points }
    this._updateTrail(season, position)
  }

  /**
   * Move the token, extend the walked path, and re-mark the spaces already
   * passed, without rebuilding anything. This is the half that animates.
   *
   * @private
   * @param {import("./seasons.js").Season} season - The season being played
   * @param {number} position - The player's position
   */
  _updateTrail(season, position) {
    const t = this._trail
    if (!t) return

    const here = t.points[Math.min(position, t.points.length - 1)]
    // Stand to the LEFT of the boss rather than on top of her: the last point
    // belongs to both the snake woman and the arriving character, and drawn at
    // the same offset the two illustrations sit inside one another.
    const shoulder = position >= t.points.length - 1 ? 62 : 22
    // `style.transform` rather than the presentation attribute: the attribute
    // is animatable in current browsers but the style property is the reliable
    // one, and it wins the cascade either way.
    t.token.style.transform = `translate(${here.x - shoulder}px, ${here.y - 44}px)`
    t.walked.style.setProperty("--walked", String(progress(season, position)))
    t.markers.forEach((marker, index) => {
      marker.classList.toggle("is-done", index < position)
    })
    t.canvas.setAttribute(
      "aria-label",
      position >= season.spaces
        ? `${season.name} trail complete — you have reached the snake woman`
        : `${season.name} trail, space ${position + 1} of ${season.spaces}`,
    )
  }

  /**
   * Draw the heads-up display: the demand, the running count, and any active
   * warnings about wilting items or a perk that is still in hand.
   *
   * @param {Object} state - The current GameState
   * @param {import("./seasons.js").Season|null} season - The season being played
   */
  renderHud(state, season) {
    if (!season) return
    this.setText("season-name", season.name)
    this.setText("demand-line", season.demandText)
    this._mount(this.elements["villain-portrait"], this.pack.villain(), "villain-svg")
    this.renderItemTrack(state, season)

    // One sentence in one node, in a live region. Split across several elements
    // the fragments announce as disconnected words, and the count -- the whole
    // state of the game -- changes silently if it is in no live region at all.
    const noun = season.demand === 1 ? season.itemName : season.itemPlural
    // Computed here rather than imported from GameState.remainingDemand: this
    // file deliberately does not import the rulebook, and one subtraction is a
    // cheaper duplication than an exception to that rule.
    const short = Math.max(0, season.demand - state.items)
    this.setText(
      "item-count",
      short === 0
        ? `${state.items} of ${season.demand} ${noun.toLowerCase()} — she has enough`
        : `${state.items} of ${season.demand} ${noun.toLowerCase()} — ${short} to go`,
    )

    const wilting = state.wilting > 0
    this.setVisible("wilt-note", wilting)
    if (wilting) {
      const wiltNoun = state.wilting === 1 ? season.itemName : season.itemPlural
      this.setText(
        "wilt-note",
        RULES.WRONG_ANSWER === WRONG_ANSWER.WILT
          ? `${state.wilting} ${wiltNoun.toLowerCase()} wilting — get the next one right to bring ${
              state.wilting === 1 ? "it" : "them"
            } back`
          : `${state.wilting} ${wiltNoun.toLowerCase()} at risk`,
      )
    }

    const character = getCharacter(state.characterId)
    const hasForgiveness = state.forgivenessLeft > 0
    this.setVisible("perk-note", hasForgiveness)
    if (hasForgiveness) {
      const mistakes =
        state.forgivenessLeft === 1 ? "1 free mistake" : `${state.forgivenessLeft} free mistakes`
      this.setText("perk-note", `${character.perkName}: ${mistakes} left`)
    }
  }

  /**
   * Draw one slot per item the snake woman asked for: filled with the season's
   * collectible when earned, drooping and drained when wilting, a faint outline
   * when still owed. Showing the goods rather than a numeral is what makes
   * "fetch eleven roses" legible to a child, and it is the only place the wilt
   * rule is visible at all.
   *
   * Every pip uses the plain variant. `item()` also offers a brighter `rare`
   * one, but which items came from glowing spaces is not tracked -- the state
   * holds a count, not a list -- so there is nothing to key it off yet.
   *
   * The container carries `aria-hidden` in the markup: the count beside it
   * already says the same thing in a live region, and one announcement per slot
   * would bury it.
   *
   * @param {Object} state - The current GameState
   * @param {import("./seasons.js").Season} season - The season being played
   */
  renderItemTrack(state, season) {
    const track = this.elements["item-track"]
    if (!track || !season) return
    track.replaceChildren()

    const earned = Math.max(0, state.items)
    const wilting = Math.max(0, state.wilting)
    // Slots grow past the demand if she overshoots, so a good run still shows
    // every item rather than capping at the quota -- but bounded, because
    // `items` comes off a save file that storage only clamps to non-negative.
    // A hand-edited `items: 5000000` would otherwise build five million spans,
    // each with its own SVG, on this render and every one after it.
    const slots = Math.min(MAX_ITEM_PIPS, Math.max(season.demand, earned + wilting))

    for (let i = 0; i < slots; i += 1) {
      const pip = document.createElement("span")
      const isEarned = i < earned
      const isWilting = !isEarned && i < earned + wilting
      pip.className = `item-pip${isEarned ? " is-earned" : ""}${isWilting ? " is-wilting" : ""}`
      if (isEarned || isWilting) {
        this._mount(pip, this.pack.item(season.id, false), "item-svg")
      }
      track.append(pip)
    }
  }

  /**
   * Draw the question and its answer buttons.
   *
   * @param {Object} state - The current GameState
   * @param {boolean} glowing - Whether this is a glowing-space question
   * @param {boolean} isBoss - Whether this is the boss question
   * @param {function(number, HTMLButtonElement): void} onAnswer - Called with the
   *   chosen value and the button that was pressed
   */
  renderQuestion(state, glowing, isBoss, onAnswer) {
    const question = state?.question
    const choices = this.elements.choices
    if (!question || !choices) return

    this.setText("question-prompt", question.prompt)
    const tag = isBoss ? "Boss challenge" : glowing ? "Glowing challenge" : ""
    this.setText("question-tag", tag)
    this.setVisible("question-tag", tag !== "")
    document.body.classList.toggle("is-glowing-question", glowing || isBoss)

    choices.replaceChildren()
    question.choices.slice(0, PLAY.CHOICE_COUNT).forEach((value, index) => {
      const button = document.createElement("button")
      button.type = "button"
      button.className = "choice"
      button.textContent = String(value)
      button.dataset.value = String(value)
      // Makes the 1-4 shortcut audible; the digit is otherwise undiscoverable.
      button.setAttribute("aria-label", `Answer ${index + 1}: ${value}`)
      button.addEventListener("click", () => onAnswer(value, button))
      choices.append(button)
    })
    this.hideFeedback()
  }

  /**
   * Flash the result of an answer on the buttons, then lock them.
   *
   * The correct button is always marked, including when the player got it
   * wrong, because seeing the right answer is the only teaching this screen
   * does.
   *
   * @param {import("./GameState.js").Outcome} outcome - What happened
   * @param {HTMLButtonElement|null} pressed - The button pressed, null on timeout
   * @param {number} correctValue - The correct answer
   * @param {string} message - The line to show under the question
   */
  flashAnswer(outcome, pressed, correctValue, message) {
    const choices = this.elements.choices
    if (choices) {
      for (const button of choices.querySelectorAll("button")) {
        // `aria-disabled` rather than `disabled`. Disabling the element that
        // currently has focus drops focus to <body> in every browser, so a
        // keyboard user had to tab in from the top of the document before
        // every single question. The `answering` guard in game.js is what
        // actually rejects a second answer; this only says so.
        button.setAttribute("aria-disabled", "true")
        button.classList.add("is-locked")
        if (Number(button.dataset.value) === correctValue) {
          button.classList.add("is-correct")
        }
      }
    }
    if (pressed && !outcome.correct) {
      pressed.classList.add("is-wrong")
      this.shakeElement(pressed)
    }
    this.showFeedback(message, outcome.correct ? "success" : "error")
  }

  /**
   * How long the flash lasts, so game.js can schedule the next question without
   * duplicating the constant.
   * @returns {number} Milliseconds
   */
  get flashDuration() {
    return FLASH_MS
  }

  /**
   * Start the countdown for a timed question. Stops any timer already running,
   * so a double call cannot leave two intervals ticking.
   *
   * Visibility is toggled on the wrapper, not the number: hiding the number
   * alone would leave an untimed season showing a full, frozen bar.
   *
   * @param {number|null} seconds - Seconds allowed, or null for an untimed season
   * @param {function(): void} onExpire - Called once when the time runs out
   */
  startTimer(seconds, onExpire) {
    this.stopTimer()
    if (!seconds || seconds <= 0) {
      this.setVisible(this.elements["timer-wrap"], false)
      return
    }
    this.setVisible(this.elements["timer-wrap"], true)
    const totalMs = seconds * 1000
    this._timeLeftMs = totalMs
    this._paintTimer(totalMs, totalMs)

    this._timerId = setInterval(() => {
      this._timeLeftMs -= TICK_MS
      if (this._timeLeftMs <= 0) {
        this.stopTimer()
        this._paintTimer(0, totalMs)
        onExpire()
        return
      }
      this._paintTimer(this._timeLeftMs, totalMs)
    }, TICK_MS)
  }

  /**
   * Update the countdown's number and bar.
   * @private
   * @param {number} leftMs - Milliseconds remaining
   * @param {number} totalMs - Milliseconds the question started with
   */
  _paintTimer(leftMs, totalMs) {
    const bar = this.elements["timer-bar"]
    this.setText("timer", String(Math.ceil(leftMs / 1000)))
    if (bar) {
      bar.style.width = `${Math.max(0, (leftMs / totalMs) * 100)}%`
      bar.classList.toggle("is-low", leftMs <= totalMs * 0.25)
    }
  }

  /**
   * Stop the countdown. Safe to call when no timer is running.
   */
  stopTimer() {
    if (this._timerId !== null) {
      clearInterval(this._timerId)
      this._timerId = null
    }
  }

  /**
   * Draw the end-of-season screen.
   *
   * @param {Object} state - The finished state
   * @param {import("./seasons.js").Season|null} season - The season just played
   * @param {{label: string, onClick: function(): void, primary?: boolean}[]} actions
   *   Buttons to offer, in order
   * @param {string} title - Headline
   * @param {string} text - The snake woman's verdict
   * @param {Array<[string, string]>} [rows] - Summary rows. Defaults to the
   *   just-played season's figures; a caller summarising a whole run must pass
   *   its own, because every per-season counter on `state` belongs to the last
   *   season only.
   */
  renderResult(state, season, actions, title, text, rows = null) {
    this.setText("result-title", title)
    this.setText("result-text", text)

    const summary = this.elements["result-summary"]
    if (summary && (season || rows)) {
      summary.replaceChildren()
      const lines = rows ?? [
        [season.itemPlural + " delivered", String(state.items)],
        ["She asked for", String(season.demand)],
        ["Questions right", `${state.correctCount} of ${state.questionsAsked}`],
        ["Best streak", String(state.bestStreak)],
        ...(state.lost > 0 ? [[`${season.itemPlural} lost`, String(state.lost)]] : []),
      ]
      for (const [label, value] of lines) {
        const row = document.createElement("div")
        row.className = "summary-row"
        const key = document.createElement("span")
        key.textContent = label
        const val = document.createElement("strong")
        val.textContent = value
        row.append(key, val)
        summary.append(row)
      }
    }

    const holder = this.elements["result-actions"]
    if (holder) {
      holder.replaceChildren()
      for (const action of actions) {
        const button = document.createElement("button")
        button.type = "button"
        button.className = action.primary ? "big-btn is-primary" : "big-btn"
        button.textContent = action.label
        button.addEventListener("click", action.onClick)
        holder.append(button)
      }
      holder.querySelector("button")?.focus()
    }
  }

  /**
   * Write the verdict under the question.
   *
   * OVERRIDES `BaseGameUI.showFeedback`, which writes to a hard-coded
   * `#feedback-area`. Seasons' element is `#feedback`, so the inherited version
   * finds nothing and silently drops every message. The base also hides by
   * setting `opacity: 0`, which is the wrong way to hide an `aria-live` region
   * -- a fully transparent element is still announced -- so `hideFeedback`
   * clears the text instead.
   *
   * @param {string} message - The line to show
   * @param {string} [type] - "success", "error", or "info"; becomes a class
   */
  showFeedback(message, type = "info") {
    const feedback = this.elements.feedback
    if (!feedback) return
    feedback.textContent = message
    feedback.className = `feedback ${type}`
  }

  /**
   * Clear the verdict. OVERRIDES `BaseGameUI.hideFeedback`; see above.
   */
  hideFeedback() {
    const feedback = this.elements.feedback
    if (!feedback) return
    feedback.textContent = ""
    feedback.className = "feedback"
  }

  /**
   * Move focus to a screen's heading, so a keyboard or screen-reader user lands
   * somewhere meaningful after a screen change.
   *
   * @param {string} screenId - The screen that was just shown
   */
  focusHeading(screenId) {
    const heading = document.getElementById(screenId)?.querySelector("h1, h2")
    if (heading instanceof HTMLElement) {
      heading.setAttribute("tabindex", "-1")
      heading.focus()
    }
  }
}

/**
 * Seasons UI -- every DOM write in the game.
 *
 * Architecture: `GameUI` extends the shared `BaseGameUI` and contains no game
 * rules. It is handed a state and told to draw it; it never decides what an
 * answer is worth, whether a season is won, or what question comes next. That
 * is why this file imports art, characters, seasons, and Journey but not
 * GameState -- it reads a state, it never advances one.
 *
 * - Nothing here uses `innerHTML`. Every node is built with `createElement` or
 *   the art pack's `createElementNS` helper, and every string is written with
 *   `textContent`. `BaseGameUI.setHTML` exists but is deliberately unused.
 * - No drawing decision lives here. Characters, items, scenery, the villain,
 *   the trail curve, and the palette all come from the active art pack, so this
 *   file works unchanged when the art is replaced.
 * - Trail markers are placed by walking the art pack's path with
 *   `getPointAtLength`, so a new pack can hand back a spiral instead of a wave
 *   and the layout follows. jsdom implements no SVG geometry, so
 *   `_pointsAlong` falls back to an evenly spaced line when the method is
 *   missing; that keeps the class constructible under test without a
 *   test-only branch in the caller.
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
      "item-demand",
      "item-label",
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
   * @param {string} selectedId - The character to mark as chosen
   * @param {function(string): void} onChoose - Called with a character id
   */
  renderCharacterCards(selectedId, onChoose) {
    const grid = this.elements["character-grid"]
    if (!grid) return
    grid.replaceChildren()

    for (const entry of CHARACTERS) {
      const card = document.createElement("button")
      card.type = "button"
      card.className = "character-card"
      card.dataset.characterId = entry.id
      card.setAttribute("aria-pressed", String(entry.id === selectedId))

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

    const { d, viewBox, width, height } = this.pack.trailPath(season)
    host.replaceChildren()

    const canvas = svg("svg", {
      viewBox,
      class: "trail-svg",
      role: "img",
      "aria-label": `${season.name} trail, space ${Math.min(position + 1, season.spaces)} of ${season.spaces}`,
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
    const points = this._pointsAlong(track, spaces.length + 1, width, height)

    spaces.forEach((space, index) => {
      const point = points[index]
      const marker = svg("g", {
        class: [
          "trail-marker",
          space.glowing ? "is-glowing" : "",
          index < position ? "is-done" : "",
        ]
          .filter(Boolean)
          .join(" "),
        transform: `translate(${point.x} ${point.y})`,
      })
      if (space.glowing) {
        // Ella's "light where it's pretty and glowing".
        marker.append(svg("circle", { r: 17, class: "marker-glow" }))
        marker.append(svg("circle", { r: 11, class: "marker-glow-inner" }))
      }
      marker.append(svg("circle", { r: space.glowing ? 8 : 6, class: "marker-dot" }))
      canvas.append(marker)
    })

    // The boss waits one past the last space.
    const bossPoint = points[points.length - 1]
    const boss = svg("g", {
      class: "trail-boss",
      transform: `translate(${bossPoint.x} ${bossPoint.y})`,
    })
    const bossArt = this.pack.villain().element
    bossArt.setAttribute("transform", "translate(-26 -52) scale(0.52)")
    boss.append(bossArt)
    canvas.append(boss)

    // The character token.
    const here = points[Math.min(position, points.length - 1)]
    const token = svg("g", {
      class: "trail-token",
      transform: `translate(${here.x - 22} ${here.y - 44})`,
    })
    const tokenArt = this.pack.character(characterId).element
    tokenArt.setAttribute("transform", "scale(0.44)")
    token.append(tokenArt)
    canvas.append(token)

    // Reveal the walked portion with a dash offset, which animates in CSS.
    const fraction = progress(season, position)
    walked.style.setProperty("--walked", String(fraction))

    host.append(canvas)
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
    this.setText("item-count", String(state.items))
    this.setText("item-demand", String(season.demand))
    this.setText("item-label", state.items === 1 ? season.itemName : season.itemPlural)
    this._mount(this.elements["villain-portrait"], this.pack.villain(), "villain-svg")

    const wilting = state.wilting > 0
    this.setVisible("wilt-note", wilting)
    if (wilting) {
      const noun = state.wilting === 1 ? season.itemName : season.itemPlural
      this.setText(
        "wilt-note",
        RULES.WRONG_ANSWER === WRONG_ANSWER.WILT
          ? `${state.wilting} ${noun.toLowerCase()} wilting -- get the next one right to bring ${
              state.wilting === 1 ? "it" : "them"
            } back`
          : `${state.wilting} ${noun.toLowerCase()} at risk`,
      )
    }

    const character = getCharacter(state.characterId)
    const hasForgiveness = state.forgivenessLeft > 0
    this.setVisible("perk-note", hasForgiveness)
    if (hasForgiveness) {
      this.setText("perk-note", `${character.perkName}: ${state.forgivenessLeft} left this season`)
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
    for (const value of question.choices.slice(0, PLAY.CHOICE_COUNT)) {
      const button = document.createElement("button")
      button.type = "button"
      button.className = "choice"
      button.textContent = String(value)
      button.dataset.value = String(value)
      button.addEventListener("click", () => onAnswer(value, button))
      choices.append(button)
    }
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
        button.disabled = true
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
   */
  renderResult(state, season, actions, title, text) {
    this.setText("result-title", title)
    this.setText("result-text", text)

    const summary = this.elements["result-summary"]
    if (summary && season) {
      summary.replaceChildren()
      const rows = [
        [season.itemPlural + " delivered", String(state.items)],
        ["She asked for", String(season.demand)],
        ["Questions right", `${state.correctCount} of ${state.questionsAsked}`],
        ["Best streak", String(state.bestStreak)],
      ]
      if (state.lost > 0) rows.push([`${season.itemPlural} lost`, String(state.lost)])
      for (const [label, value] of rows) {
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
   * found nothing, null-checked, and silently dropped every message the game
   * composed. The base also hides by setting `opacity: 0`, which is the wrong
   * way to hide an `aria-live` region -- a fully transparent element is still
   * announced -- so `hideFeedback` clears the text instead.
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

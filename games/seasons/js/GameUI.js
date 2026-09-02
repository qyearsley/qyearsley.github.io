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
 * - No drawing decision lives here. Characters, items, obstacles, the backdrop,
 *   the snake woman, the trail's geometry, the motion of each crossing, and the
 *   palette all come from the active art pack, so this file works unchanged when
 *   the art is replaced.
 * - The trail is wider than the screen and scrolls by panning a camera group,
 *   because a `viewBox` cannot be animated and a transform can. The backdrop is
 *   several more such groups, each panned by the same offset scaled by the
 *   parallax factor its own layer reported, which is the only thing this file
 *   knows about depth -- how many layers there are, what is in them and how
 *   fast each moves are all the pack's. Both the geometry and the crossing
 *   animations come from the art pack, so a pack could hand back a spiral, or
 *   swap sprite frames where this one arcs a transform, and nothing here
 *   changes. No SVG geometry is measured, so the class works under jsdom
 *   without a test-only branch.
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
import { buildTrail } from "./Journey.js"
import { getObstacle } from "./obstacles.js"

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
 * How long the camera takes to follow the character to the next stop. Slightly
 * longer than most traversals so the landscape keeps drifting for a beat after
 * the character lands, which reads as momentum rather than a jump cut.
 * @private
 */
const CAMERA_MS = 900

/**
 * How long the camera takes to follow under `prefers-reduced-motion`. Paired
 * with the pack's reduced crossing and a beat longer than it, so the landscape
 * still settles fractionally after the character lands rather than stopping
 * dead with it.
 * @private
 */
const CAMERA_REDUCED_MS = 300

/**
 * Ceiling on drawn item slots. Comfortably above anything a real run reaches;
 * it exists only so a corrupted save cannot turn the HUD into an unbounded
 * render.
 * @private
 */
const MAX_ITEM_PIPS = 60

/**
 * Code point of "A", so the nth answer button can be named A, B, C, D.
 *
 * Letters, not digits. Every answer in this game is a number, so a small "3" in
 * the corner of a button reading "34" is one glance away from being read as part
 * of the answer. A letter is a *name* for the choice and cannot be mistaken for
 * one. Derived from the index rather than listed, so the run of letters follows
 * `PLAY.CHOICE_COUNT` if it ever changes. `game.js` reverses this arithmetic to
 * turn a keypress back into an index.
 * @private
 */
const FIRST_CHOICE_KEY = "A".codePointAt(0)

export class GameUI extends BaseGameUI {
  constructor() {
    super()
    this.pack = activePack()
    /** @type {number|null} Interval id for the countdown, null when stopped. */
    this._timerId = null
    /** @type {number} Milliseconds left on the current question. */
    this._timeLeftMs = 0
    /**
     * Seasons in play order, for the finished potion on the end-of-run screen:
     * one collectible per season, in the order they were played. Assigned once
     * by game.js rather than imported, for the reason given on
     * `renderJourneySoFar`. Empty means the flask is simply drawn empty rather
     * than this file inventing a season list of its own.
     * @type {Array<{id: string, name: string}>}
     */
    this.seasonOrder = []
    this.cacheElements()
  }

  /**
   * Cache the nodes this class writes to. Called once at construction; a node
   * that is missing here shows up as a quiet no-op later rather than a throw.
   */
  cacheElements() {
    const ids = [
      "character-grid",
      "journey-so-far",
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
      "result-haul",
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
   * Draw the "journey so far" panel under the character cards: which of the
   * four seasons are open, and the counters that carry across runs.
   *
   * Both halves already existed in the save and neither reached the screen, so
   * nothing told a player there were four seasons at all, or that the question
   * counts were cumulative rather than per-run.
   *
   * The season list is passed in rather than imported. `GameUI` sits above
   * `seasons.js` in the dependency order and does not otherwise know about the
   * levels; keeping it that way means the panel stays a view of whatever it is
   * handed.
   *
   * @param {Object|null} save - The save state, or null before one is loaded
   * @param {Array<{id: string, name: string}>} seasons - Seasons, in play order
   */
  renderJourneySoFar(save, seasons) {
    const host = this.elements["journey-so-far"]
    if (!host) return
    host.replaceChildren()
    if (!save || !seasons?.length) return

    const heading = document.createElement("h2")
    heading.className = "journey-heading"
    heading.textContent = `Your journey: ${seasons.length} seasons`
    host.append(heading)

    const list = document.createElement("ol")
    list.className = "journey-seasons"
    for (const [index, season] of seasons.entries()) {
      const open = save.unlocked.includes(season.id)
      const item = document.createElement("li")
      item.className = `journey-season${open ? " is-open" : ""}`

      const ordinal = document.createElement("span")
      ordinal.className = "journey-ordinal"
      ordinal.textContent = String(index + 1)
      item.append(ordinal)

      const name = document.createElement("span")
      name.className = "journey-season-name"
      name.textContent = season.name
      item.append(name)

      // The open ones are only distinguished by colour and weight otherwise,
      // which says nothing to a screen reader and little to a colour-blind eye.
      const state = document.createElement("span")
      state.className = "visually-hidden"
      state.textContent = open ? " (open)" : " (not reached yet)"
      item.append(state)

      list.append(item)
    }
    host.append(list)

    // A first run has nothing to report, and four zeros would read as failure.
    const totals = save.totals
    if (!totals || totals.questionsAnswered < 1) return

    const line = document.createElement("p")
    line.className = "journey-totals"
    const cleared = totals.seasonsCleared
    line.textContent =
      `Altogether you have answered ${totals.questionsAnswered} questions ` +
      `and got ${totals.questionsCorrect} right.` +
      (cleared > 0 ? ` You have finished ${cleared} ${cleared === 1 ? "season" : "seasons"}.` : "")
    host.append(line)
  }

  renderTrail(season, position, characterId) {
    const host = this.elements.trail
    if (!host || !season) return

    // Built once per season+character, then only moved. The camera pan and the
    // traversal animation both need elements that persist while their transforms
    // change; rebuilding the scene every question would make the character
    // teleport and the landscape jump.
    const key = `${season.id}:${characterId}`
    if (this._trailKey === key && this._trail?.canvas.isConnected) {
      this._placeToken(position, { animate: false })
      return
    }

    const plan = this.pack.layout(season)
    host.replaceChildren()

    const canvas = svg("svg", { viewBox: plan.viewBox, class: "trail-svg", role: "img" })

    // The backdrop is not one group but several, each with its own parallax
    // factor, and each therefore needing its own transform -- so they are
    // siblings of the camera rather than children of it. What is drawn in them,
    // how many there are and how fast each moves are all the pack's business;
    // this loop only mounts what it is given, in the order it is given, back to
    // front.
    const backdrop = this.pack.backdrop(season.id, plan.width)
    const layers = []
    for (const plane of backdrop.layers ?? []) {
      const group = svg("g", {
        // `is-still` is the stylesheet's cue not to promote a layer that never
        // moves onto its own compositor layer. Derived from the factor the pack
        // reported rather than from the layer's name, so nothing here has to
        // know that "sky" is the fixed one.
        class: `trail-layer${plane.factor === 0 ? " is-still" : ""}`,
        "data-layer": plane.name,
      })
      group.append(plane.element)
      canvas.append(group)
      layers.push({ group, factor: plane.factor })
    }

    // Everything that moves with the ground inside the camera group; panning it
    // is what scrolls the trail. `viewBox` would be the obvious thing to move
    // instead, but it is not animatable, and a transform is. The camera is the
    // last layer and its factor is 1 by definition: it *is* the ground, and the
    // parallax factors above are all measured against it.
    const camera = svg("g", { class: "trail-camera" })
    canvas.append(camera)
    layers.push({ group: camera, factor: 1 })

    for (const d of plan.groundSegments) {
      camera.append(svg("path", { d, class: "trail-ground" }))
    }
    // The band of material along the top of the ground, over the earth and
    // under everything standing on it. One path per ground segment, from the
    // same list of samples, so it follows the river basins down and stops at
    // the lip of every gap.
    for (const d of plan.groundEdges ?? []) {
      camera.append(svg("path", { d, class: "trail-ground-edge" }))
    }

    // One obstacle per space, each sitting on the ground where layout put it.
    buildTrail(season).forEach((space, index) => {
      const spot = plan.obstacles[index]
      if (!spot) return
      const group = svg("g", {
        class: `trail-obstacle${space.glowing ? " is-glowing" : ""}`,
        transform: `translate(${spot.x} ${spot.y})`,
      })
      if (space.glowing) {
        // Ella's "light where it's pretty and glowing" -- now behind a mountain
        // rather than a dot, so it haloes the thing being climbed.
        group.append(svg("circle", { ...plan.glow, class: "obstacle-glow" }))
      }
      group.append(this.pack.obstacle(space.kind, season.id).element)
      camera.append(group)
    })

    const boss = svg("g", { class: "trail-boss" })
    const bossArt = this.pack.villain().element
    bossArt.setAttribute("transform", plan.bossTransform)
    boss.append(bossArt)
    const bossStop = plan.stops[plan.stops.length - 1]
    boss.setAttribute("transform", `translate(${bossStop.x + plan.bossOffset} ${bossStop.y})`)
    camera.append(boss)

    const token = svg("g", { class: "trail-token" })
    const tokenArt = this.pack.character(characterId, true).element
    tokenArt.setAttribute("transform", `scale(${plan.tokenScale})`)
    token.append(tokenArt)
    camera.append(token)

    host.append(canvas)

    this._trailKey = key
    this._trail = { canvas, camera, layers, token, plan, season }
    this._placeToken(position, { animate: false })
  }

  /**
   * Put the character at a position and point the camera at it.
   *
   * With `animate: false` both snap, which is what a fresh draw or a reloaded
   * save wants. `crossObstacle` is the animated path.
   *
   * @private
   * @param {number} position - Which stop to stand on
   * @param {{animate: boolean}} options - Whether to move or jump
   */
  _placeToken(position, { animate }) {
    const t = this._trail
    if (!t) return
    const index = Math.max(0, Math.min(position, t.plan.stops.length - 1))
    const stop = t.plan.stops[index]
    // Clear any finished crossing first. Every traversal is played with
    // `fill: "forwards"`, and a filling animation outranks inline style in the
    // cascade -- so writing `style.transform` here was silently ignored and the
    // character stayed wherever it last walked to. That stranded the animal
    // beside the snake woman when a season was retried, since the reuse branch
    // of `renderTrail` calls this and nothing else.
    this._cancelAnimations()
    t.token.style.transform = this.pack.standing(stop)
    this._panCamera(stop, { animate })
    this._describeTrail(position)
  }

  /**
   * Drop any animations still applying to the token or the camera.
   *
   * Separate from `skipTraversal`, which *finishes* a running crossing on
   * purpose. This throws the results away, so an inline transform can take
   * effect again.
   * @private
   */
  _cancelAnimations() {
    const t = this._trail
    if (!t) return
    for (const element of [t.token, ...t.layers.map((layer) => layer.group)]) {
      if (typeof element.getAnimations !== "function") continue
      for (const animation of element.getAnimations()) animation.cancel()
    }
    this._crossing = null
  }

  /**
   * Scroll the trail so the character sits comfortably in view, clamped so the
   * camera never runs off either end of the landscape.
   *
   * One offset, applied to every layer scaled by that layer's parallax factor.
   * The ground's layer has a factor of 1 and so moves by the whole offset; a
   * ridge on the horizon at 0.25 moves by a quarter of it and therefore appears
   * to be four times further away. The clamp is applied to the offset *before*
   * the factors, which is what keeps this safe: every layer is asked for a
   * window no further along than `factor * furthest + viewportWidth`, and the
   * pack promises a `span` at least that wide -- see `BackdropLayer`.
   *
   * @private
   * @param {{x: number, y: number}} stop - Where the character is
   * @param {{animate: boolean}} options - Whether to pan or jump
   * @returns {Array<Animation>} The pans that were started, which may be empty
   */
  _panCamera(stop, { animate }) {
    const t = this._trail
    if (!t) return []
    // A third of the way in rather than centred: the player is walking left to
    // right, so what is ahead matters more than what is behind.
    const ideal = stop.x - t.plan.viewportWidth / 3
    const furthest = Math.max(0, t.plan.width - t.plan.viewportWidth)
    const offset = Math.max(0, Math.min(ideal, furthest))
    const reduced = this._prefersReducedMotion()
    const pans = []
    for (const layer of t.layers) {
      const target = `translateX(${-(offset * layer.factor)}px)`
      const current = layer.group.style.transform
      if (!animate || typeof layer.group.animate !== "function") {
        layer.group.style.transform = target
        continue
      }
      // A layer that is already where it is going gets no animation at all.
      // That is every crossing for a fixed sky, and starting a no-op animation
      // on it would promote it to its own compositor layer for nothing.
      if (current === target) continue
      const pan = layer.group.animate([{ transform: current || target }, { transform: target }], {
        // Under reduced motion the pan matches the pack's plain slide rather
        // than the leisurely drift: a long eased pan of the whole landscape is
        // a large moving field, which is the thing the preference is about.
        duration: reduced ? CAMERA_REDUCED_MS : CAMERA_MS,
        easing: reduced ? "linear" : "ease-in-out",
        fill: "forwards",
      })
      layer.group.style.transform = target
      pans.push(pan)
    }
    return pans
  }

  /**
   * Animate the character across the obstacle it is standing in front of.
   *
   * The motion comes from the art pack, so a sprite pack could swap frames
   * where this one arcs a transform, and nothing here needs to know. Returns a
   * promise so the caller can wait before asking the next question, and
   * `skipTraversal` can cut it short if the player is faster than the animation.
   *
   * Three paths, and they are three different conditions rather than one:
   *
   * - No Web Animations API at all -- jsdom, and nothing else in practice --
   *   places the character instantly. There is nothing else it could do.
   * - `prefers-reduced-motion` asks the pack for its reduced crossing, a plain
   *   slide. This used to be folded in with the case above and placed the
   *   character instantly too, which meant the trail's main piece of feedback
   *   simply did not happen for anyone with the system setting on. A pack with
   *   no reduced crossing to offer falls back to the instant placement, which
   *   is no worse than what it did before.
   * - Otherwise the full crossing, arc and squash and all.
   *
   * @param {number} from - The stop being left
   * @param {string} kind - The obstacle kind being crossed
   * @returns {Promise<void>} Resolves when the character has arrived
   */
  crossObstacle(from, kind) {
    const t = this._trail
    if (!t) return Promise.resolve()
    const stops = t.plan.stops
    const start = stops[Math.max(0, Math.min(from, stops.length - 1))]
    const finish = stops[Math.max(0, Math.min(from + 1, stops.length - 1))]

    this._describeTrail(from + 1)
    const reduced = this._prefersReducedMotion()
    const motion = reduced ? this.pack.reducedTraversal : this.pack.traversal
    if (typeof t.token.animate !== "function" || typeof motion !== "function") {
      this._placeToken(from + 1, { animate: false })
      return Promise.resolve()
    }

    // Everything from here on is wrapped, and the wrap is load-bearing rather
    // than decorative. The caller holds its "an answer is being processed" flag
    // until this promise settles, so a throw escaping this method would leave
    // that flag stuck on and the game would accept no further answers until the
    // page was reloaded. A pack handing back keyframes a browser rejects is
    // exactly the kind of thing a future sprite pack could do.
    let move
    try {
      const { keyframes, options } = motion.call(this.pack, kind, start, finish)
      move = t.token.animate(keyframes, { ...options, fill: "forwards" })
    } catch (error) {
      console.error("GameUI.crossObstacle: could not animate the crossing", error)
      this._crossing = null
      this._placeToken(from + 1, { animate: false })
      return Promise.resolve()
    }

    const pans = this._panCamera(finish, { animate: true })
    this._crossing = { move, pans }
    t.token.style.transform = this.pack.standing(finish)

    return move.finished
      .catch(() => {})
      .then(() => {
        this._crossing = null
      })
  }

  /**
   * Cut a crossing short and land the character. Safe to call when nothing is
   * animating, which is what lets a tap anywhere skip it.
   *
   * Every pan is finished, not just the ground's: with the backdrop split into
   * parallax layers a skip that only landed the character would leave four
   * ridges still drifting behind a stationary animal.
   */
  skipTraversal() {
    if (!this._crossing) return
    for (const animation of [this._crossing.move, ...this._crossing.pans]) {
      if (animation && animation.playState === "running") animation.finish()
    }
    this._crossing = null
  }

  /**
   * Whether the player has asked for less motion. Read per call rather than
   * cached, because it can change while the game is open.
   * @private
   * @returns {boolean} True when motion should be minimal
   */
  _prefersReducedMotion() {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  }

  /**
   * Update the trail's accessible label to say where the player is and what is
   * in the way.
   * @private
   * @param {number} position - The position being described
   */
  _describeTrail(position) {
    const t = this._trail
    if (!t) return
    const season = t.season
    const space = buildTrail(season)[position]
    const obstacle = space ? getObstacle(space.kind) : null
    t.canvas.setAttribute(
      "aria-label",
      obstacle
        ? `${season.name} trail, space ${position + 1} of ${season.spaces}: a ${obstacle.name.toLowerCase()} to ${obstacle.verb}`
        : `${season.name} trail complete — you have reached the snake woman`,
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
    // Drawn once, not once per answer. `villain()` takes no arguments and so
    // returns the same picture every time, but it is by far the biggest thing
    // the pack builds -- the coiled tail alone is hundreds of ellipses -- and
    // renderHud runs on every answer. Rebuilding it each time cost more than
    // the rest of the game put together. The check is against the live DOM
    // rather than a flag on `this`, so a fresh page with a fresh GameUI draws
    // it again.
    const portrait = this.elements["villain-portrait"]
    if (portrait && !portrait.firstElementChild) {
      this._mount(portrait, this.pack.villain(), "villain-svg")
    }
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
   * @param {{tag?: string, lit?: boolean}} label - The line above the question,
   *   and whether to give the prompt its glow. Composed by the caller.
   * @param {function(number, HTMLButtonElement): void} onAnswer - Called with the
   *   chosen value and the button that was pressed
   */
  renderQuestion(state, { tag = "", lit = false } = {}, onAnswer) {
    const question = state?.question
    const choices = this.elements.choices
    if (!question || !choices) return

    this.setText("question-prompt", question.prompt)
    // The caller supplies the label rather than this file deriving it. Player
    // copy lives in game.js, and the boss label has to say how many tries are
    // left and what the question is worth -- neither of which the UI knows.
    this.setText("question-tag", tag)
    this.setVisible("question-tag", tag !== "")
    document.body.classList.toggle("is-glowing-question", lit)

    choices.replaceChildren()
    question.choices.slice(0, PLAY.CHOICE_COUNT).forEach((value, index) => {
      const button = document.createElement("button")
      button.type = "button"
      button.className = "choice"
      button.textContent = String(value)
      button.dataset.value = String(value)
      // The A-D keyboard shortcut, in two forms. `aria-label` makes it audible;
      // `data-key` is what the stylesheet prints in the corner of the button,
      // and only on a device with a real pointer -- see `.choice::before`. On
      // the iPad the shortcut does not exist, so nothing is drawn there at all.
      const key = String.fromCodePoint(FIRST_CHOICE_KEY + index)
      button.dataset.key = key
      button.setAttribute("aria-label", `Answer ${key}: ${value}`)
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
   * @param {{finale?: boolean}} [options] - `finale` draws the finished potion
   *   instead of the season's haul. The end-of-run screen is the only caller.
   */
  renderResult(state, season, actions, title, text, rows = null, { finale = false } = {}) {
    this.setText("result-title", title)
    this.setText("result-text", text)
    if (finale) this._renderFinale()
    else this._renderHaul(state, season, rows)

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
   * Draw the finished potion: the last thing the game shows.
   *
   * The end-of-run screen used to be a title, a paragraph and a table of four
   * numbers -- the flattest screen in the game, at the one moment that has been
   * earned. Every other result screen draws the haul going into the jar, and
   * this one could not, because every per-season counter belongs to the last
   * season played.
   *
   * What it draws instead is the thing the whole run was for: one rare
   * collectible from each season, suspended in the finished flask. It needs no
   * per-season counts, it is the only screen where all four seasons appear at
   * once, and it comes free from art the pack already has. The flask is CSS and
   * the collectibles are the pack's, the same split as the jar -- so a new art
   * pack changes what is in it without owning the glass.
   * @private
   */
  _renderFinale() {
    const host = this.elements["result-haul"]
    if (!host) return
    host.replaceChildren()

    const flask = document.createElement("div")
    flask.className = "finale-flask"

    const brew = document.createElement("div")
    brew.className = "finale-brew"
    this.seasonOrder.forEach((season, index) => {
      const slot = document.createElement("span")
      slot.className = "finale-item"
      // The stagger, read by the stylesheet, so they rise one after another.
      slot.style.setProperty("--finale-index", String(index))
      // The rare variant: this is the finished potion, not a day's gathering.
      this._mount(slot, this.pack.item(season.id, true), "item-svg")
      brew.append(slot)
    })
    flask.append(brew)

    const neck = document.createElement("div")
    neck.className = "finale-neck"
    flask.prepend(neck)
    host.append(flask)

    const caption = document.createElement("p")
    caption.className = "haul-caption"
    caption.textContent = "One of every season, and it is done"
    host.append(caption)
  }

  /**
   * Draw the season's haul going into the snake woman's jar.
   *
   * After fifteen questions of gathering roses the payoff used to be five rows
   * of numbers. The collectibles are already drawn by the art pack for the HUD,
   * so showing the pile she actually delivered costs nothing new to draw.
   *
   * Only for the per-season screen. When the caller passes its own `rows` it is
   * the end-of-run screen, and every per-season counter on `state` belongs to
   * the last season played -- a jar of seventeen icicles labelled as the whole
   * journey would be a lie. There is no lifetime item count to draw instead.
   *
   * The jar is CSS; the items are the art pack's. That split is deliberate, so
   * a replacement art pack changes what is in the jar without owning the jar.
   *
   * @private
   * @param {Object} state - The finished GameState
   * @param {import("./seasons.js").Season|null} season - The season just played
   * @param {Array|null} rows - Caller-supplied summary rows, if any
   */
  _renderHaul(state, season, rows) {
    const host = this.elements["result-haul"]
    if (!host) return
    host.replaceChildren()
    if (rows || !season) return

    const delivered = Math.max(0, state?.items ?? 0)
    if (delivered < 1) return

    const jar = document.createElement("div")
    jar.className = "haul-jar"

    const contents = document.createElement("div")
    contents.className = "haul-contents"
    // Same ceiling as the HUD track, and for the same reason: `items` comes off
    // a save file that storage only clamps to non-negative.
    const drawn = Math.min(MAX_ITEM_PIPS, delivered)
    for (let i = 0; i < drawn; i += 1) {
      const slot = document.createElement("span")
      slot.className = "haul-item"
      // Read by the stylesheet as the stagger, so they drop in one after
      // another instead of all at once. No JS animation: the reduced-motion
      // rule then covers this for free.
      slot.style.setProperty("--haul-index", String(i))
      this._mount(slot, this.pack.item(season.id, false), "item-svg")
      contents.append(slot)
    }
    jar.append(contents)
    host.append(jar)

    const caption = document.createElement("p")
    caption.className = "haul-caption"
    const noun = delivered === 1 ? season.itemName : season.itemPlural
    caption.textContent = `${delivered} ${noun.toLowerCase()} into her jar`
    host.append(caption)
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

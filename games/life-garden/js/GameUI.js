import { BaseGameUI } from "../../shared/BaseGameUI.js"
import { KIND } from "./constants.js"

export class GameUI extends BaseGameUI {
  constructor() {
    super()
    this.elements = this.cacheElements()
  }

  cacheElements() {
    return {
      canvas: document.getElementById("game-canvas"),
      speciesPalette: document.getElementById("species-palette"),
      speciesInfo: document.getElementById("species-info"),
      generationDisplay: document.getElementById("generation-display"),
      playBtn: document.getElementById("play-btn"),
      pauseBtn: document.getElementById("pause-btn"),
      stepBackBtn: document.getElementById("step-back-btn"),
      stepBtn: document.getElementById("step-btn"),
      resetBtn: document.getElementById("reset-btn"),
    }
  }

  renderSpeciesPalette(species, selectedSpecies) {
    const palette = this.elements.speciesPalette
    if (!palette) return
    palette.innerHTML = ""
    species.forEach((def, i) => {
      const btn = document.createElement("button")
      btn.className = "species-btn"
      btn.dataset.speciesId = def.id
      btn.innerHTML = `<span class="species-emoji">${def.emoji}</span><span class="species-name">${def.name}</span><kbd class="species-key">${i + 1}</kbd>`
      if (def.id === selectedSpecies) btn.classList.add("selected")
      palette.appendChild(btn)
    })
  }

  /**
   * The card under the palette: what the selected species does, and how many of
   * it are on the board.
   *
   * Deliberately short. The full rules are the section under the game, which
   * you read once; this is the bit worth glancing at while you play, and it
   * grows a row per species instead of a paragraph.
   *
   * @param {object} def - Species definition
   * @param {number} count - How many are on the board now
   * @param {import('./Species.js').SpeciesRegistry} registry - To name its food
   */
  renderSpeciesInfo(def, count, registry) {
    const box = this.elements.speciesInfo
    if (!box) return

    const rows =
      def.kind === KIND.ANIMAL
        ? [
            ["Eats", def.eats.map((id) => registry.get(id)?.name ?? "?").join(", ")],
            ["Sees", `${def.sight} cells`],
            ["Meal", `+${def.gain}, then ${def.digest} to digest`],
            ["Splits at", String(def.breedAt)],
          ]
        : [
            ["Lives on", `${def.survive.join(", ")} neighbours`],
            ["Spreads on", `${def.birth.join(", ")} neighbours`],
            [
              def.bloomsInto ? "Blooms after" : "Lasts",
              `${def.bloomAge ?? def.bloomDuration} gens`,
            ],
          ]

    box.innerHTML = ""
    const title = document.createElement("h4")
    title.className = "species-info-title"
    title.textContent = `${def.emoji} ${def.name}`
    box.appendChild(title)

    const list = document.createElement("dl")
    list.className = "species-info-rows"
    // The population goes in the list rather than the heading. Inside the
    // heading its accessible name became "Grass 128", with nothing to say what
    // 128 counted.
    for (const [label, value] of [...rows, ["On the board", String(count)]]) {
      const dt = document.createElement("dt")
      dt.textContent = label
      const dd = document.createElement("dd")
      dd.textContent = value
      list.append(dt, dd)
    }
    box.appendChild(list)
  }

  updateGeneration(gen) {
    this.setText("generation-display", `Gen ${gen}`)
  }

  setSimulatingControls(simulating) {
    if (this.elements.playBtn) this.elements.playBtn.classList.toggle("hidden", simulating)
    if (this.elements.pauseBtn) this.elements.pauseBtn.classList.toggle("hidden", !simulating)
  }

  /**
   * Mark the speed button that is actually in force.
   *
   * `index.html` hardcodes `active` on Normal, which was true only because the
   * saved speed was never loaded. A restored "fast" would otherwise run fast
   * with Normal lit up.
   *
   * @param {string} speed - "slow", "normal" or "fast"
   */
  setActiveSpeed(speed) {
    for (const btn of document.querySelectorAll(".speed-btn")) {
      btn.classList.toggle("active", btn.dataset.speed === speed)
    }
  }
}

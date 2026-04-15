import { BaseGameUI } from "../../shared/BaseGameUI.js"

export class GameUI extends BaseGameUI {
  constructor() {
    super()
    this.elements = this.cacheElements()
  }

  cacheElements() {
    return {
      canvas: document.getElementById("game-canvas"),
      speciesPalette: document.getElementById("species-palette"),
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

  updateGeneration(gen) {
    this.setText("generation-display", `Gen ${gen}`)
  }

  setSimulatingControls(simulating) {
    if (this.elements.playBtn) this.elements.playBtn.classList.toggle("hidden", simulating)
    if (this.elements.pauseBtn) this.elements.pauseBtn.classList.toggle("hidden", !simulating)
  }
}

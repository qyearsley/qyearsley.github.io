import { describe, test, expect, beforeEach } from "@jest/globals"
import { SPECIES } from "../js/constants.js"
import { GameUI } from "../js/GameUI.js"

const SPECIES_DEFS = [
  { id: SPECIES.GRASS, emoji: "🌿", name: "Grass" },
  { id: SPECIES.BEE, emoji: "🐝", name: "Bee" },
  { id: SPECIES.RABBIT, emoji: "🐇", name: "Rabbit" },
]

describe("GameUI", () => {
  let ui

  beforeEach(() => {
    document.body.innerHTML = `
      <canvas id="game-canvas"></canvas>
      <div id="species-palette"></div>
      <div id="generation-display"></div>
      <button id="play-btn"></button>
      <button id="pause-btn"></button>
      <button id="step-back-btn"></button>
      <button id="step-btn"></button>
      <button id="reset-btn"></button>
    `
    ui = new GameUI()
  })

  test("caches the elements the game controls", () => {
    for (const key of ["canvas", "speciesPalette", "playBtn", "pauseBtn", "resetBtn"]) {
      expect(ui.elements[key]).not.toBeNull()
    }
  })

  describe("renderSpeciesPalette", () => {
    test("renders one button per species, tagged with its id", () => {
      ui.renderSpeciesPalette(SPECIES_DEFS, SPECIES.GRASS)
      const buttons = [...document.querySelectorAll(".species-btn")]
      expect(buttons.map((b) => b.dataset.speciesId)).toEqual(["1", "2", "3"])
    })

    test("numbers the keyboard shortcuts from 1", () => {
      ui.renderSpeciesPalette(SPECIES_DEFS, SPECIES.GRASS)
      const keys = [...document.querySelectorAll(".species-key")].map((k) => k.textContent)
      expect(keys).toEqual(["1", "2", "3"])
    })

    test("marks only the selected species", () => {
      ui.renderSpeciesPalette(SPECIES_DEFS, SPECIES.BEE)
      const selected = [...document.querySelectorAll(".species-btn.selected")]
      expect(selected.map((b) => b.dataset.speciesId)).toEqual(["2"])
    })

    test("marks nothing when the selection matches no species", () => {
      ui.renderSpeciesPalette(SPECIES_DEFS, SPECIES.EMPTY)
      expect(document.querySelectorAll(".species-btn.selected")).toHaveLength(0)
    })

    test("replaces the previous palette instead of appending", () => {
      ui.renderSpeciesPalette(SPECIES_DEFS, SPECIES.GRASS)
      ui.renderSpeciesPalette(SPECIES_DEFS, SPECIES.GRASS)
      expect(document.querySelectorAll(".species-btn")).toHaveLength(3)
    })
  })

  test("updateGeneration shows the generation count", () => {
    ui.updateGeneration(42)
    expect(document.getElementById("generation-display").textContent).toBe("Gen 42")
  })

  describe("setSimulatingControls", () => {
    test("shows pause and hides play while simulating", () => {
      ui.setSimulatingControls(true)
      expect(ui.elements.playBtn.classList.contains("hidden")).toBe(true)
      expect(ui.elements.pauseBtn.classList.contains("hidden")).toBe(false)
    })

    test("shows play and hides pause when stopped", () => {
      ui.setSimulatingControls(false)
      expect(ui.elements.playBtn.classList.contains("hidden")).toBe(false)
      expect(ui.elements.pauseBtn.classList.contains("hidden")).toBe(true)
    })
  })
})

import { SPECIES, PHASE, SPEED } from "./constants.js"
import { SpeciesRegistry } from "./Species.js"
import { Grid } from "./Grid.js"
import { GameState } from "./GameState.js"
import { GameUI } from "./GameUI.js"
import { Renderer } from "./Renderer.js"
import { EventManager } from "./EventManager.js"
import { LifeGardenStorage } from "./storage.js"
import { PUZZLES } from "./PuzzleData.js"
import { PRESETS } from "./Presets.js"

// Max generations to keep in undo history
const MAX_HISTORY = 200

class LifeGarden {
  constructor() {
    this.registry = new SpeciesRegistry()
    this.storage = new LifeGardenStorage()
    this.state = new GameState(this.storage)
    this.ui = new GameUI()
    this.grid = null
    this.renderer = null
    this.selectedSpecies = SPECIES.GRASS
    this.simulationTimer = null
    this.history = [] // previous grid states for undo

    this._setupRenderer()
    this._setupEvents()
    this._init()
  }

  _setupRenderer() {
    const canvas = this.ui.elements.canvas
    if (canvas) {
      this.renderer = new Renderer(canvas, this.registry)
    }
  }

  _setupEvents() {
    this.events = new EventManager(this.ui, {
      onSpeciesSelect: (id) => this._selectSpecies(id),
      onCanvasProbe: (px, py) => {
        const pos = this.renderer.canvasToGrid(px, py)
        if (!pos) return false
        const cell = this.grid.getCell(pos.x, pos.y)
        return cell && cell.species !== SPECIES.EMPTY
      },
      onCanvasDrag: (px, py, mode) => this._handleCanvasDrag(px, py, mode),
      onCanvasHover: (px, py) => this._handleCanvasHover(px, py),
      onCanvasLeave: () => this._handleCanvasLeave(),
      onPlay: () => this._startSimulation(),
      onPause: () => this._pauseSimulation(),
      onTogglePlay: () => {
        if (this.state.phase === PHASE.SIMULATING) this._pauseSimulation()
        else this._startSimulation()
      },
      onStep: () => this._stepOnce(),
      onStepBack: () => this._stepBack(),
      onReset: () => this._resetGrid(),
      onPreset: (index) => this._loadPreset(index),
      onSpeedChange: (speed) => {
        this.state.settings.speed = speed
        if (this.simulationTimer) {
          this._stopSimulation()
          this._startSimulation()
        }
      },
    })
  }

  _init() {
    const puzzle = PUZZLES[0]
    this.state.startPuzzle(puzzle)
    this.grid = new Grid(puzzle.gridWidth, puzzle.gridHeight, this.registry)
    this.history = []
    this.selectedSpecies = SPECIES.GRASS

    this.renderer.fitToGrid(puzzle.gridWidth, puzzle.gridHeight)
    this.renderer.setLockedCells(puzzle.lockedCells)
    this.renderer.setGoalZones([])

    this._updatePalette()
    this._renderPresets()
    this.ui.updateGeneration(this.state.generation)
    this.ui.showScreen("game-screen")
    this.ui.setSimulatingControls(false)
    this.renderer.render(this.grid)
  }

  _selectSpecies(id) {
    const def = this.registry.get(id)
    if (def) {
      this.selectedSpecies = id
      this._updatePalette()
    }
  }

  _handleCanvasDrag(px, py, mode) {
    const pos = this.renderer.canvasToGrid(px, py)
    if (!pos) return
    if (this.renderer.isLocked(pos.x, pos.y)) return

    const cell = this.grid.getCell(pos.x, pos.y)
    if (mode === "erase") {
      if (cell.species !== SPECIES.EMPTY) {
        this.grid.setCell(pos.x, pos.y, SPECIES.EMPTY)
      }
    } else {
      if (cell.species === SPECIES.EMPTY) {
        this.grid.setCell(pos.x, pos.y, this.selectedSpecies)
      }
    }

    this.renderer.render(this.grid)
  }

  _handleCanvasHover(px, py) {
    const pos = this.renderer.canvasToGrid(px, py)
    this.renderer.hoverCell = pos
    this.renderer.selectedSpecies = this.selectedSpecies
    this.renderer.render(this.grid)
  }

  _handleCanvasLeave() {
    this.renderer.hoverCell = null
    this.renderer.render(this.grid)
  }

  _startSimulation() {
    // Clear any existing timer to prevent stacking
    this._stopSimulation()
    this.state.phase = PHASE.SIMULATING
    this.ui.setSimulatingControls(true)

    const speedMs = SPEED[this.state.settings.speed.toUpperCase()] || SPEED.NORMAL
    this.simulationTimer = setInterval(() => this._simulationTick(), speedMs)
  }

  _pauseSimulation() {
    this.state.phase = PHASE.PAUSED
    this._stopSimulation()
    this.ui.setSimulatingControls(false)
  }

  _stopSimulation() {
    if (this.simulationTimer) {
      clearInterval(this.simulationTimer)
      this.simulationTimer = null
    }
  }

  _stepOnce() {
    // If running, pause first
    this._stopSimulation()
    this.state.phase = PHASE.PAUSED
    this.ui.setSimulatingControls(false)
    this._simulationTick()
  }

  _stepBack() {
    if (this.history.length === 0) return
    // If running, pause first
    this._stopSimulation()
    this.state.phase = PHASE.PAUSED
    this.ui.setSimulatingControls(false)

    this.grid = this.history.pop()
    this.state.generation--
    this.ui.updateGeneration(this.state.generation)
    this.renderer.render(this.grid)
  }

  _simulationTick() {
    try {
      this.history.push(this.grid)
      if (this.history.length > MAX_HISTORY) {
        this.history.shift()
      }

      this.grid = this.grid.step()
      this.state.generation++
      this.ui.updateGeneration(this.state.generation)
      this.renderer.render(this.grid)
    } catch (error) {
      console.error("Simulation error:", error)
      this._pauseSimulation()
    }
  }

  _resetGrid() {
    this._stopSimulation()
    this.state.startPuzzle(PUZZLES[0])
    this.grid = new Grid(PUZZLES[0].gridWidth, PUZZLES[0].gridHeight, this.registry)
    this.history = []
    this.ui.updateGeneration(this.state.generation)
    this.ui.setSimulatingControls(false)
    this.renderer.render(this.grid)
  }

  _loadPreset(index) {
    const preset = PRESETS[index]
    if (!preset) return
    this._stopSimulation()
    this.state.startPuzzle(PUZZLES[0])
    this.grid = new Grid(PUZZLES[0].gridWidth, PUZZLES[0].gridHeight, this.registry)
    this.history = []
    for (const cell of preset.cells) {
      this.grid.setCell(cell.x, cell.y, cell.species)
    }
    this.ui.updateGeneration(this.state.generation)
    this.ui.setSimulatingControls(false)
    this.renderer.render(this.grid)
  }

  _renderPresets() {
    const container = document.getElementById("preset-buttons")
    if (!container) return
    container.innerHTML = ""
    PRESETS.forEach((preset, i) => {
      const btn = document.createElement("button")
      btn.className = "preset-btn"
      btn.textContent = preset.name
      btn.title = preset.description
      btn.addEventListener("click", () => this._loadPreset(i))
      container.appendChild(btn)
    })
  }

  _updatePalette() {
    this.ui.renderSpeciesPalette(
      this.registry.placeable(),
      this.selectedSpecies,
    )
  }
}

document.addEventListener("DOMContentLoaded", () => {
  try {
    window.game = new LifeGarden()
  } catch (error) {
    console.error("Failed to initialize Life Garden:", error)
  }
})

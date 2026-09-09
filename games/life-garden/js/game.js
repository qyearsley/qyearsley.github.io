import { SPECIES, KIND, PHASE, SPEED } from "./constants.js"
import { SpeciesRegistry } from "./Species.js"
import { Grid } from "./Grid.js"
import { GameState } from "./GameState.js"
import { GameUI } from "./GameUI.js"
import { Renderer } from "./Renderer.js"
import { EventManager } from "./EventManager.js"
import { PopulationChart } from "./PopulationChart.js"
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
    this.chart = null
    this.selectedSpecies = SPECIES.GRASS
    this.simulationTimer = null
    this.history = [] // previous grid states for undo
    this.paintedThisDrag = new Set() // cell keys, so one drag paints each cell once

    this._setupRenderer()
    this._setupChart()
    this._setupEvents()
    this._setupThemeRepaint()
    this._init()
  }

  _setupRenderer() {
    const canvas = this.ui.elements.canvas
    if (canvas) {
      this.renderer = new Renderer(canvas, this.registry)
    }
  }

  _setupChart() {
    const canvas = document.getElementById("population-chart")
    if (!canvas) return
    this.chart = new PopulationChart(canvas, this.registry, document.getElementById("chart-legend"))
  }

  /**
   * Repaint when the page theme changes.
   *
   * The stylesheet re-resolves itself, but the canvas holds whatever was last
   * painted into it. Without this the grid keeps its old background and grid
   * lines until the next generation, which on a paused board is forever.
   *
   * Both sources are covered: `themechange` for the site theme picker
   * (shared/theme.js), and the media query for a change to the OS preference
   * while the page is open.
   */
  _setupThemeRepaint() {
    const repaint = () => {
      if (this.renderer && this.grid) this.renderer.render(this.grid)
      this.chart?.render()
    }
    window.addEventListener("themechange", repaint)
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", repaint)
  }

  _setupEvents() {
    this.events = new EventManager(this.ui, {
      onSpeciesSelect: (id) => this._selectSpecies(id),
      // Which layer decides the gesture is the layer the selected species
      // would land on, not "is anything here at all". Probing both layers made
      // the first click of a gesture disagree with the rest of it: clicking
      // grass onto a cell holding a rabbit deleted the rabbit, while dragging
      // the same grass in from next door planted it underneath.
      onCanvasProbe: (px, py) => {
        // Fires exactly once, at the start of a gesture, which makes it the
        // place to forget the cells the last gesture covered.
        this.paintedThisDrag.clear()
        const pos = this.renderer.canvasToGrid(px, py)
        return pos ? this._layerTaken(pos.x, pos.y, this.selectedSpecies) : false
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
        this.state.saveProgress()
        if (this.simulationTimer) {
          this._stopSimulation()
          this._startSimulation()
        }
      },
    })
  }

  _init() {
    // Settings first: the speed decides the simulation interval, and the grid
    // flag decides how the first frame is drawn. Nothing called this before, so
    // `storage.js` and half of `GameState` were dead code and the speed you
    // chose was forgotten the moment you reloaded.
    this.state.loadProgress()
    this.ui.setActiveSpeed(this.state.settings.speed)
    if (this.renderer) this.renderer.showGrid = this.state.settings.showGrid

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
    this.chart?.reset()
    this.chart?.record(this.state.generation, this.grid)
    this.ui.updateGeneration(this.state.generation)
    this.ui.showScreen("game-screen")
    this.ui.setSimulatingControls(false)
    this.renderer.render(this.grid)
    this._updateSpeciesInfo()
  }

  _selectSpecies(id) {
    // `get` knows every species, including the life stages the palette does not
    // offer and the rules will not let the player place. Pressing 5 used to
    // select flowering grass: a 🌸 appeared under the cursor, no palette button
    // lit up, and nothing could ever be born from it. `placeable()` is the same
    // list the palette is built from, so the two cannot disagree.
    if (!this.registry.placeable().some((def) => def.id === id)) return
    this.selectedSpecies = id
    this._updatePalette()
    this._updateSpeciesInfo()
  }

  _handleCanvasDrag(px, py, mode) {
    const pos = this.renderer.canvasToGrid(px, py)
    if (!pos) return
    if (this.renderer.isLocked(pos.x, pos.y)) return

    // One touch per cell per gesture, remembering every cell rather than just
    // the last one. `mousedown` and every `mousemove` after it both paint, so a
    // click that drifts a single pixel used to call `clearCell` twice on one
    // cell -- taking the rabbit and then the grass it was standing in, instead
    // of just the rabbit. Dragging back over a cell you have already crossed
    // does the same thing, which is why this is a set.
    const cell = `${pos.x},${pos.y}`
    if (this.paintedThisDrag.has(cell)) return
    this.paintedThisDrag.add(cell)

    // Two layers, so "is this cell taken" depends on what you are holding: a
    // rabbit can be dropped into grass, and grass can be planted under a
    // rabbit. Erasing takes the top layer first, so clicking a rabbit in the
    // grass takes the rabbit.
    if (mode === "erase") {
      this.grid.clearCell(pos.x, pos.y)
    } else if (!this._layerTaken(pos.x, pos.y, this.selectedSpecies)) {
      this.grid.setCell(pos.x, pos.y, this.selectedSpecies)
    }

    this.renderer.render(this.grid)
    this.chart?.record(this.state.generation, this.grid)
    this._updateSpeciesInfo()
  }

  /** Whether the layer this species would land on is already occupied. */
  _layerTaken(x, y, speciesId) {
    const def = this.registry.get(speciesId)
    if (def?.kind === KIND.ANIMAL) return this.grid.getAnimal(x, y) !== null
    return this.grid.getPlant(x, y).species !== SPECIES.EMPTY
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
    this.chart?.truncate(this.state.generation)
    this.ui.updateGeneration(this.state.generation)
    this.renderer.render(this.grid)
    this._updateSpeciesInfo()
  }

  _simulationTick() {
    try {
      this.history.push(this.grid)
      if (this.history.length > MAX_HISTORY) {
        this.history.shift()
      }

      this.grid = this.grid.step()
      this.state.generation++
      this.chart?.record(this.state.generation, this.grid)
      this.ui.updateGeneration(this.state.generation)
      this.renderer.render(this.grid)
      this._updateSpeciesInfo()
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
    this.chart?.reset()
    this.chart?.record(this.state.generation, this.grid)
    this.ui.updateGeneration(this.state.generation)
    this.ui.setSimulatingControls(false)
    this.renderer.render(this.grid)
    this._updateSpeciesInfo()
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
    this.chart?.reset()
    this.chart?.record(this.state.generation, this.grid)
    this.ui.updateGeneration(this.state.generation)
    this.ui.setSimulatingControls(false)
    this.renderer.render(this.grid)
    this._updateSpeciesInfo()
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
    this.ui.renderSpeciesPalette(this.registry.placeable(), this.selectedSpecies)
  }

  /**
   * Refresh the sidebar card for the selected species.
   *
   * The rules used to live in the sidebar as a wall of text that nobody read
   * while playing. This is the part worth having to hand: what the thing you
   * are holding eats, how far it sees, and how many of it are on the board
   * right now.
   */
  _updateSpeciesInfo() {
    const def = this.registry.get(this.selectedSpecies)
    if (def) this.ui.renderSpeciesInfo(def, this.grid.countSpecies(def.id), this.registry)
  }
}

document.addEventListener("DOMContentLoaded", () => {
  try {
    window.game = new LifeGarden()
  } catch (error) {
    console.error("Failed to initialize Life Garden:", error)
  }
})

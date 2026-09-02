import { SPECIES } from "./constants.js"

// Generations kept on screen. Matches game.js's MAX_HISTORY so the chart can
// always show every generation Back can still reach.
const WINDOW = 200

/**
 * A small line chart of population against generation, one series per living
 * species drawn in that species' own colour.
 *
 * The chart owns no simulation state: game.js calls record() after every step
 * and truncate() after every rewind. Series are read from the registry, so a
 * new species shows up here with no change to this file.
 */
export class PopulationChart {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('./Species.js').SpeciesRegistry} registry
   * @param {HTMLElement} [legend] - optional element for the text readout
   */
  constructor(canvas, registry, legend = null) {
    this.canvas = canvas
    this.ctx = canvas?.getContext("2d") || null
    this.registry = registry
    this.legend = legend
    // Species that can appear on the grid, life stages included
    this.species = registry.all().filter((def) => def.id !== SPECIES.EMPTY)
    this.points = [] // { gen, counts: { [speciesId]: number } }
  }

  /** Drop every sample. */
  reset() {
    this.points = []
    this.render()
  }

  /**
   * Sample the grid for one generation, dropping the oldest if past WINDOW.
   *
   * Re-recording the generation already at the end replaces it rather than
   * appending, so painting cells at generation 0 moves the last point instead
   * of stacking a column of samples on top of each other.
   */
  record(generation, grid) {
    const counts = {}
    for (const def of this.species) counts[def.id] = grid.countSpecies(def.id)
    const last = this.points[this.points.length - 1]
    if (last && last.gen === generation) last.counts = counts
    else this.points.push({ gen: generation, counts })
    if (this.points.length > WINDOW) this.points.shift()
    this.render()
  }

  /**
   * Discard samples from after `generation`, for Back.
   *
   * A chart still showing the future the player just rewound out of is worse
   * than no chart, so this runs on every rewind even when nothing is dropped.
   */
  truncate(generation) {
    this.points = this.points.filter((p) => p.gen <= generation)
    this.render()
  }

  /** Highest count in the window, and never zero, so the scale is usable. */
  _peak() {
    let peak = 1
    for (const point of this.points) {
      for (const def of this.species) {
        if (point.counts[def.id] > peak) peak = point.counts[def.id]
      }
    }
    return peak
  }

  render() {
    this._renderLegend()
    const ctx = this.ctx
    if (!ctx) return

    const { width, height } = this.canvas
    const pad = 6
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = this._bgColor()
    ctx.fillRect(0, 0, width, height)

    // Baseline
    ctx.strokeStyle = this._axisColor()
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(pad, height - pad + 0.5)
    ctx.lineTo(width - pad, height - pad + 0.5)
    ctx.stroke()

    if (this.points.length < 2) return

    const peak = this._peak()
    const plotW = width - pad * 2
    const plotH = height - pad * 2
    // Always scale to a full window, so the lines advance across the chart
    // instead of stretching to fill it as samples arrive.
    const span = Math.max(this.points.length - 1, WINDOW - 1)
    const xAt = (i) => pad + (i / span) * plotW
    const yAt = (n) => pad + plotH - (n / peak) * plotH

    for (const def of this.species) {
      ctx.strokeStyle = def.color
      ctx.lineWidth = 1.5
      ctx.beginPath()
      this.points.forEach((point, i) => {
        const x = xAt(i)
        const y = yAt(point.counts[def.id] || 0)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
    }

    // Scale marker, so the heights mean something
    ctx.fillStyle = this._axisColor()
    ctx.font = "11px system-ui, sans-serif"
    ctx.textBaseline = "top"
    ctx.fillText(String(peak), pad + 2, pad)
  }

  /**
   * Text readout of the current counts.
   *
   * The lines are told apart by colour alone, which on its own is not a
   * distinction everyone can make, so the numbers are also written out.
   */
  _renderLegend() {
    if (!this.legend) return
    const latest = this.points[this.points.length - 1]
    this.legend.innerHTML = ""
    for (const def of this.species) {
      const item = document.createElement("span")
      item.className = "chart-legend-item"
      const swatch = document.createElement("span")
      swatch.className = "chart-legend-swatch"
      swatch.style.background = def.color
      item.appendChild(swatch)
      item.append(`${def.name} ${latest ? latest.counts[def.id] : 0}`)
      this.legend.appendChild(item)
    }
  }

  /** Matches Renderer._isDark: the site theme picker beats the OS preference. */
  _isDark() {
    if (typeof window.__prefersDark === "function") return window.__prefersDark()
    return window.matchMedia("(prefers-color-scheme: dark)").matches
  }

  _bgColor() {
    return this._isDark() ? "#1a202c" : "#f8fafc"
  }

  _axisColor() {
    return this._isDark() ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)"
  }
}

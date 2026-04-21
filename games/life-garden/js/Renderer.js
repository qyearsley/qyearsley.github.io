import { SPECIES } from "./constants.js"

export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('./Species.js').SpeciesRegistry} registry
   */
  constructor(canvas, registry) {
    this.canvas = canvas
    this.ctx = canvas.getContext("2d")
    this.registry = registry
    this.cellSize = 0
    this.offsetX = 0
    this.offsetY = 0
    this.gridWidth = 0
    this.gridHeight = 0
    this.showGrid = true
    this.hoverCell = null
    this.selectedSpecies = null
    this.lockedCells = new Set()
    this.goalZones = []
  }

  fitToGrid(gridWidth, gridHeight) {
    this.gridWidth = gridWidth
    this.gridHeight = gridHeight
    const maxCellW = this.canvas.width / gridWidth
    const maxCellH = this.canvas.height / gridHeight
    this.cellSize = Math.floor(Math.min(maxCellW, maxCellH))
    this.offsetX = Math.floor((this.canvas.width - this.cellSize * gridWidth) / 2)
    this.offsetY = Math.floor((this.canvas.height - this.cellSize * gridHeight) / 2)
  }

  canvasToGrid(px, py) {
    const gx = Math.floor((px - this.offsetX) / this.cellSize)
    const gy = Math.floor((py - this.offsetY) / this.cellSize)
    if (gx < 0 || gx >= this.gridWidth || gy < 0 || gy >= this.gridHeight) return null
    return { x: gx, y: gy }
  }

  setLockedCells(cells) {
    this.lockedCells = new Set(cells.map((c) => `${c.x},${c.y}`))
  }

  setGoalZones(zones) {
    this.goalZones = zones
  }

  isLocked(x, y) {
    return this.lockedCells.has(`${x},${y}`)
  }

  render(grid) {
    const ctx = this.ctx
    const cs = this.cellSize

    // Clear
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    // Background
    ctx.fillStyle = this._bgColor()
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    // Goal zone overlays
    for (const zone of this.goalZones) {
      ctx.fillStyle = "rgba(255, 215, 0, 0.12)"
      ctx.fillRect(this.offsetX + zone.x * cs, this.offsetY + zone.y * cs, zone.w * cs, zone.h * cs)
      ctx.strokeStyle = "rgba(255, 215, 0, 0.4)"
      ctx.lineWidth = 2
      ctx.strokeRect(
        this.offsetX + zone.x * cs,
        this.offsetY + zone.y * cs,
        zone.w * cs,
        zone.h * cs,
      )
    }

    // Cells
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const px = this.offsetX + x * cs
        const py = this.offsetY + y * cs

        if (this.isLocked(x, y)) {
          ctx.fillStyle = this._lockedColor()
          this._fillRoundedRect(ctx, px + 1, py + 1, cs - 2, cs - 2, 3)
          continue
        }

        const cell = grid.getCell(x, y)
        if (cell && cell.species !== SPECIES.EMPTY) {
          const def = this.registry.get(cell.species)
          if (def) {
            const ageRatio = def.maxAge ? Math.min(cell.age / def.maxAge, 1) : 0
            const baseColor = this._lerpColor(def.color, def.colorAlt, ageRatio)
            ctx.fillStyle = baseColor
            this._fillRoundedRect(ctx, px + 1, py + 1, cs - 2, cs - 2, 4)
            this._drawTexture(ctx, px + 1, py + 1, cs - 2, cs - 2, def, ageRatio)
          }
        }
      }
    }

    // Grid lines
    if (this.showGrid) {
      ctx.strokeStyle = this._gridLineColor()
      ctx.lineWidth = 0.5
      for (let x = 0; x <= grid.width; x++) {
        const px = this.offsetX + x * cs
        ctx.beginPath()
        ctx.moveTo(px, this.offsetY)
        ctx.lineTo(px, this.offsetY + grid.height * cs)
        ctx.stroke()
      }
      for (let y = 0; y <= grid.height; y++) {
        const py = this.offsetY + y * cs
        ctx.beginPath()
        ctx.moveTo(this.offsetX, py)
        ctx.lineTo(this.offsetX + grid.width * cs, py)
        ctx.stroke()
      }
    }

    // Hover preview
    if (this.hoverCell && this.selectedSpecies) {
      const def = this.registry.get(this.selectedSpecies)
      if (def && !this.isLocked(this.hoverCell.x, this.hoverCell.y)) {
        const px = this.offsetX + this.hoverCell.x * cs
        const py = this.offsetY + this.hoverCell.y * cs
        ctx.globalAlpha = 0.4
        ctx.fillStyle = def.color
        this._fillRoundedRect(ctx, px + 1, py + 1, cs - 2, cs - 2, 4)
        ctx.globalAlpha = 1
      }
    }
  }

  _drawTexture(ctx, x, y, w, h, def, ageRatio) {
    const cx = x + w / 2
    const cy = y + h / 2
    const s = Math.min(w, h)
    const alpha = 1 - ageRatio * 0.5

    switch (def.texture) {
      case "blades":
        this._drawBlades(ctx, cx, cy, s, alpha)
        break
      case "petals":
        this._drawPetals(ctx, cx, cy, s, alpha)
        break
      case "dot":
        this._drawDot(ctx, cx, cy, s, alpha)
        break
      case "ears":
        this._drawEars(ctx, cx, cy, s, alpha)
        break
    }
  }

  _drawBlades(ctx, cx, cy, s, alpha) {
    ctx.save()
    ctx.globalAlpha = alpha * 0.5
    ctx.strokeStyle = "rgba(255,255,255,0.6)"
    ctx.lineWidth = Math.max(1, s * 0.08)
    ctx.lineCap = "round"
    const r = s * 0.25
    // Three small blade strokes
    for (const dx of [-0.2, 0, 0.2]) {
      ctx.beginPath()
      ctx.moveTo(cx + dx * s, cy + r)
      ctx.lineTo(cx + dx * s - s * 0.05, cy - r * 0.6)
      ctx.stroke()
    }
    ctx.restore()
  }

  _drawPetals(ctx, cx, cy, s, alpha) {
    ctx.save()
    ctx.globalAlpha = alpha * 0.6
    const r = s * 0.12
    // Center dot
    ctx.fillStyle = "rgba(255,255,200,0.8)"
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
    // Four small petal dots
    ctx.fillStyle = "rgba(255,255,255,0.4)"
    const pr = s * 0.08
    const d = s * 0.22
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ]) {
      ctx.beginPath()
      ctx.arc(cx + dx * d, cy + dy * d, pr, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  _drawDot(ctx, cx, cy, s, alpha) {
    ctx.save()
    ctx.globalAlpha = alpha * 0.7
    // Dark center body
    ctx.fillStyle = "rgba(60,40,0,0.7)"
    ctx.beginPath()
    ctx.arc(cx, cy, s * 0.15, 0, Math.PI * 2)
    ctx.fill()
    // Two small wing hints
    ctx.fillStyle = "rgba(255,255,255,0.3)"
    ctx.beginPath()
    ctx.ellipse(cx - s * 0.12, cy - s * 0.1, s * 0.1, s * 0.06, -0.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(cx + s * 0.12, cy - s * 0.1, s * 0.1, s * 0.06, 0.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  _drawEars(ctx, cx, cy, s, alpha) {
    ctx.save()
    ctx.globalAlpha = alpha * 0.6
    ctx.fillStyle = "rgba(255,230,200,0.6)"
    // Two ear ovals
    const ew = s * 0.1
    const eh = s * 0.2
    ctx.beginPath()
    ctx.ellipse(cx - s * 0.14, cy - s * 0.15, ew, eh, -0.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(cx + s * 0.14, cy - s * 0.15, ew, eh, 0.2, 0, Math.PI * 2)
    ctx.fill()
    // Small nose dot
    ctx.fillStyle = "rgba(180,120,80,0.5)"
    ctx.beginPath()
    ctx.arc(cx, cy + s * 0.1, s * 0.06, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  _fillRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.fill()
  }

  _lerpColor(hex1, hex2, t) {
    const r1 = parseInt(hex1.slice(1, 3), 16)
    const g1 = parseInt(hex1.slice(3, 5), 16)
    const b1 = parseInt(hex1.slice(5, 7), 16)
    const r2 = parseInt(hex2.slice(1, 3), 16)
    const g2 = parseInt(hex2.slice(3, 5), 16)
    const b2 = parseInt(hex2.slice(5, 7), 16)
    const r = Math.round(r1 + (r2 - r1) * t)
    const g = Math.round(g1 + (g2 - g1) * t)
    const b = Math.round(b1 + (b2 - b1) * t)
    return `rgb(${r}, ${g}, ${b})`
  }

  _bgColor() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "#1a202c" : "#f8fafc"
  }

  _gridLineColor() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "rgba(255,255,255,0.1)"
      : "rgba(0,0,0,0.1)"
  }

  _lockedColor() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "#4a5568" : "#cbd5e0"
  }
}

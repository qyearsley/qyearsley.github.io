import { Garden, SIZE } from "./garden.js"
import { keyIsNotForGame } from "../../shared/keyboardGuard.js"

const COLORS = { ground: "#e6dcc3", grass: "#48a05a", rabbit: "#3182ce", fox: "#e8590c" }
const HISTORY = 300 // generations the chart shows
const $ = (id) => document.getElementById(id)

class Game {
  constructor() {
    this.board = $("board")
    this.chart = $("chart")
    this.preset = "both"
    this.tool = "grass"
    this.timer = null
    this.painting = false

    $("play-btn").onclick = () => this.play()
    $("pause-btn").onclick = () => this.pause()
    $("step-btn").onclick = () => this.step()
    $("reset-btn").onclick = () => this.load(this.preset)
    $("speed").onchange = () => this.timer && (this.pause(), this.play())
    this.pick("presets", "preset", (preset) => this.load(preset))
    this.pick("tools", "tool", (tool) => (this.tool = tool))

    this.board.addEventListener("pointerdown", (e) => ((this.painting = true), this.paint(e)))
    this.board.addEventListener("pointermove", (e) => this.painting && this.paint(e))
    // Page-level listeners share one signal, so dispose() can remove them (the tests boot many games).
    const { signal } = (this.abort = new AbortController())
    window.addEventListener("pointerup", () => (this.painting = false), { signal })
    document.addEventListener("keydown", (e) => this.onKey(e), { signal })
    window.addEventListener("themechange", () => this.draw(), { signal })

    this.load(this.preset)
  }

  dispose() {
    this.abort.abort()
    this.pause()
  }

  /** Wire a row of buttons so that exactly one has aria-pressed. */
  pick(rowId, key, onPick) {
    const buttons = [...$(rowId).querySelectorAll("button")]
    for (const button of buttons) {
      button.onclick = () => {
        for (const other of buttons) other.setAttribute("aria-pressed", other === button)
        onPick(button.dataset[key])
      }
    }
  }

  load(preset) {
    this.pause()
    this.preset = preset
    this.garden = new Garden(preset, Math.floor(Math.random() * 2 ** 32))
    this.history = [this.garden.counts()]
    this.draw()
  }

  step() {
    this.garden.step()
    this.history.push(this.garden.counts())
    if (this.history.length > HISTORY) this.history.shift()
    this.draw()
  }

  play() {
    if (this.timer) return
    this.timer = setInterval(() => this.step(), Number($("speed").value))
    $("play-btn").classList.add("hidden")
    $("pause-btn").classList.remove("hidden")
  }

  pause() {
    clearInterval(this.timer)
    this.timer = null
    $("play-btn").classList.remove("hidden")
    $("pause-btn").classList.add("hidden")
  }

  onKey(e) {
    if (keyIsNotForGame(e)) return
    // A focused button handles Space itself.
    if (e.key === " " && e.target.tagName !== "BUTTON") {
      e.preventDefault()
      this.timer ? this.pause() : this.play()
    } else if (e.key === "ArrowRight") this.step()
    else if (e.key === "r") this.load(this.preset)
  }

  paint(e) {
    const rect = this.board.getBoundingClientRect()
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * SIZE)
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * SIZE)
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return
    this.garden.paint(y * SIZE + x, this.tool)
    this.history[this.history.length - 1] = this.garden.counts()
    this.draw()
  }

  /** Repaint the board, the counts and the chart. */
  draw() {
    const counts = this.garden.counts()
    $("generation").textContent = this.garden.generation
    for (const name of Object.keys(counts)) $(`count-${name}`).textContent = counts[name]
    this.drawBoard()
    this.drawChart()
  }

  drawBoard() {
    const ctx = this.board.getContext("2d")
    const cell = this.board.width / SIZE
    ctx.fillStyle = COLORS.ground
    ctx.fillRect(0, 0, this.board.width, this.board.height)
    ctx.fillStyle = COLORS.grass
    this.garden.grass.forEach((grass, i) => {
      if (grass) ctx.fillRect((i % SIZE) * cell, Math.floor(i / SIZE) * cell, cell, cell)
    })
    for (const animal of this.garden.animals) {
      if (!animal) continue
      ctx.fillStyle = COLORS[animal.kind]
      ctx.beginPath()
      const x = (animal.at % SIZE) + 0.5
      const y = Math.floor(animal.at / SIZE) + 0.5
      ctx.arc(x * cell, y * cell, cell * 0.4, 0, 2 * Math.PI)
      ctx.fill()
    }
  }

  /** One line per species, each scaled to its own peak so all three stay readable. */
  drawChart() {
    const ctx = this.chart.getContext("2d")
    const { width, height } = this.chart
    const style = getComputedStyle(document.documentElement)
    ctx.fillStyle = style.getPropertyValue("--color-bg-card") || "#f8fafc"
    ctx.fillRect(0, 0, width, height)
    for (const name of ["grass", "rabbit", "fox"]) {
      const peak = Math.max(1, ...this.history.map((c) => c[name]))
      ctx.strokeStyle = COLORS[name]
      ctx.lineWidth = 2
      ctx.beginPath()
      this.history.forEach((c, i) => {
        const x = (i / (HISTORY - 1)) * width
        const y = height - 8 - (c[name] / peak) * (height - 16)
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
      })
      ctx.stroke()
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.game = new Game()
})

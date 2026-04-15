export class EventManager {
  constructor(ui, callbacks) {
    this.ui = ui
    this.cb = callbacks
    this._dragging = false
    this._dragMode = null // "place" or "erase"
    this._setupCanvasEvents()
    this._setupButtons()
    this._setupKeyboard()
  }

  _setupCanvasEvents() {
    const canvas = this.ui.elements.canvas
    if (!canvas) return

    canvas.addEventListener("mousedown", (e) => {
      const pos = this._canvasPos(e)
      this._dragging = true
      // Determine drag mode from first cell: if occupied, erase; if empty, place
      this._dragMode = this.cb.onCanvasProbe?.(pos.px, pos.py) ? "erase" : "place"
      this.cb.onCanvasDrag?.(pos.px, pos.py, this._dragMode)
    })

    canvas.addEventListener("mousemove", (e) => {
      const pos = this._canvasPos(e)
      if (this._dragging) {
        this.cb.onCanvasDrag?.(pos.px, pos.py, this._dragMode)
      } else {
        this.cb.onCanvasHover?.(pos.px, pos.py)
      }
    })

    canvas.addEventListener("mouseup", () => {
      this._dragging = false
      this._dragMode = null
    })

    canvas.addEventListener("mouseleave", () => {
      this._dragging = false
      this._dragMode = null
      this.cb.onCanvasLeave?.()
    })

    // Touch support
    canvas.addEventListener("touchstart", (e) => {
      e.preventDefault()
      const pos = this._touchPos(e)
      this._dragging = true
      this._dragMode = this.cb.onCanvasProbe?.(pos.px, pos.py) ? "erase" : "place"
      this.cb.onCanvasDrag?.(pos.px, pos.py, this._dragMode)
    })

    canvas.addEventListener("touchmove", (e) => {
      e.preventDefault()
      if (this._dragging) {
        const pos = this._touchPos(e)
        this.cb.onCanvasDrag?.(pos.px, pos.py, this._dragMode)
      }
    })

    canvas.addEventListener("touchend", () => {
      this._dragging = false
      this._dragMode = null
    })
  }

  _canvasPos(e) {
    const canvas = this.ui.elements.canvas
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      px: (e.clientX - rect.left) * scaleX,
      py: (e.clientY - rect.top) * scaleY,
    }
  }

  _touchPos(e) {
    const touch = e.touches[0]
    const canvas = this.ui.elements.canvas
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      px: (touch.clientX - rect.left) * scaleX,
      py: (touch.clientY - rect.top) * scaleY,
    }
  }

  _setupButtons() {
    const el = this.ui.elements

    el.playBtn?.addEventListener("click", () => this.cb.onPlay?.())
    el.pauseBtn?.addEventListener("click", () => this.cb.onPause?.())
    el.stepBtn?.addEventListener("click", () => this.cb.onStep?.())
    el.stepBackBtn?.addEventListener("click", () => this.cb.onStepBack?.())
    el.resetBtn?.addEventListener("click", () => this.cb.onReset?.())

    const speedBtns = document.querySelectorAll(".speed-btn")
    for (const btn of speedBtns) {
      btn.addEventListener("click", () => {
        for (const b of speedBtns) b.classList.remove("active")
        btn.classList.add("active")
        this.cb.onSpeedChange?.(btn.dataset.speed)
      })
    }

    el.speciesPalette?.addEventListener("click", (e) => {
      const btn = e.target.closest(".species-btn")
      if (btn) {
        this.cb.onSpeciesSelect?.(parseInt(btn.dataset.speciesId, 10))
      }
    })
  }

  _setupKeyboard() {
    document.addEventListener("keydown", (e) => {
      if (e.target.matches("input, textarea, select")) return

      switch (e.key) {
        case " ":
          e.preventDefault()
          this.cb.onTogglePlay?.()
          break
        case "r":
          this.cb.onReset?.()
          break
        case "ArrowRight":
          e.preventDefault()
          this.cb.onStep?.()
          break
        case "ArrowLeft":
          e.preventDefault()
          this.cb.onStepBack?.()
          break
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9":
          this.cb.onSpeciesSelect?.(parseInt(e.key, 10))
          break
      }
    })
  }
}

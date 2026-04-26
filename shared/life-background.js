// Conway's Game of Life background animation for the 404 page.
"use strict"
;(function () {
  const canvas = document.getElementById("life-canvas")
  const ctx = canvas.getContext("2d")
  const cellSize = 10
  const initialDensity = 0.15
  let cols, rows, grid

  function resize() {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const newCols = Math.floor(canvas.width / cellSize)
    const newRows = Math.floor(canvas.height / cellSize)
    if (newCols !== cols || newRows !== rows) {
      cols = newCols
      rows = newRows
      randomize()
    }
  }

  function randomize() {
    grid = new Uint8Array(cols * rows)
    for (let i = 0; i < grid.length; i++) {
      grid[i] = Math.random() < initialDensity ? 1 : 0
    }
  }

  function countNeighbors(x, y) {
    let count = 0
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue
        const nx = (x + dx + cols) % cols
        const ny = (y + dy + rows) % rows
        count += grid[ny * cols + nx]
      }
    }
    return count
  }

  function step() {
    const next = new Uint8Array(cols * rows)
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const idx = y * cols + x
        const n = countNeighbors(x, y)
        if (grid[idx]) {
          next[idx] = n === 2 || n === 3 ? 1 : 0
        } else {
          next[idx] = n === 3 ? 1 : 0
        }
      }
    }
    grid = next
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const color =
      getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim() ||
      "#3182ce"
    ctx.fillStyle = color
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (grid[y * cols + x]) {
          ctx.fillRect(x * cellSize, y * cellSize, cellSize - 1, cellSize - 1)
        }
      }
    }
  }

  function tick() {
    if (document.hidden) {
      setTimeout(tick, 500)
      return
    }
    step()
    draw()
    setTimeout(tick, 200)
  }

  resize()
  window.addEventListener("resize", resize)
  draw()
  setTimeout(tick, 200)
})()

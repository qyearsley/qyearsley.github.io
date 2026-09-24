import * as mg from "./maze-generator.js"

const SIZES = [
  [4, 4],
  [10, 10],
  [5, 8],
]

describe("createRng", () => {
  test("a digit string is the same seed as its number, so ?seed= links reload the same maze", () => {
    const fromNumber = mg.createRng(12345)
    const fromUrl = mg.createRng("12345")
    for (let i = 0; i < 5; i += 1) expect(fromUrl.next()).toBe(fromNumber.next())
  })

  test("the same seed produces the same sequence", () => {
    const a = mg.createRng(42)
    const b = mg.createRng(42)
    const seqA = Array.from({ length: 10 }, () => a.next())
    const seqB = Array.from({ length: 10 }, () => b.next())
    expect(seqA).toEqual(seqB)
  })

  test("different seeds produce different sequences", () => {
    const a = mg.createRng(1)
    const b = mg.createRng(2)
    expect(a.next()).not.toEqual(b.next())
  })

  test("a string seed is accepted and is reproducible", () => {
    const a = mg.createRng("maze-party")
    const b = mg.createRng("maze-party")
    expect(a.next()).toEqual(b.next())
  })

  test("next() always returns a value in [0, 1)", () => {
    const rng = mg.createRng(7)
    for (let i = 0; i < 200; i += 1) {
      const value = rng.next()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  test("int(min, max) is always in range, inclusive", () => {
    const rng = mg.createRng(7)
    for (let i = 0; i < 200; i += 1) {
      const value = rng.int(2, 5)
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(2)
      expect(value).toBeLessThanOrEqual(5)
    }
  })
})

describe("generateMazeInstant: perfect maze invariants", () => {
  test.each(SIZES)("every cell is reachable (%p x %p)", (width, height) => {
    const { grid } = mg.generateMazeInstant(width, height, 1)
    expect(mg.countReachableCells(grid, width, height)).toBe(width * height)
  })

  test.each(SIZES)("exactly cells - 1 passages (%p x %p)", (width, height) => {
    const { grid } = mg.generateMazeInstant(width, height, 1)
    expect(mg.countPassages(grid, width, height)).toBe(width * height - 1)
  })

  test.each(SIZES)("walls are symmetric between neighbors (%p x %p)", (width, height) => {
    const { grid } = mg.generateMazeInstant(width, height, 2)
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const cell = grid[y][x]
        if (x < width - 1) expect(cell.E).toBe(grid[y][x + 1].W)
        if (y < height - 1) expect(cell.S).toBe(grid[y + 1][x].N)
      }
    }
  })

  test.each(SIZES)("every cell is visited (%p x %p)", (width, height) => {
    const { grid } = mg.generateMazeInstant(width, height, 3)
    for (const row of grid) {
      for (const cell of row) {
        expect(cell.visited).toBe(true)
      }
    }
  })
})

describe("generateMazeInstant: determinism", () => {
  test("the same seed gives the same maze", () => {
    const a = mg.generateMazeInstant(10, 10, 12345)
    const b = mg.generateMazeInstant(10, 10, 12345)
    expect(a).toEqual(b)
  })

  test("different seeds give different mazes", () => {
    const a = mg.generateMazeInstant(10, 10, 1)
    const b = mg.generateMazeInstant(10, 10, 2)
    expect(a).not.toEqual(b)
  })

  test("a 1x1 maze is a single visited cell with no passages", () => {
    const { grid } = mg.generateMazeInstant(1, 1, 1)
    expect(mg.countReachableCells(grid, 1, 1)).toBe(1)
    expect(mg.countPassages(grid, 1, 1)).toBe(0)
  })
})

describe("generateMaze: step sequence", () => {
  test("ends in the same maze as generateMazeInstant for the same seed", () => {
    const seed = 99
    const width = 8
    const height = 6

    const stepped = mg.generateMaze(width, height, mg.createRng(seed))
    let result = stepped.next()
    let stepCount = 0
    while (!result.done) {
      result = stepped.next()
      stepCount += 1
    }

    const instant = mg.generateMazeInstant(width, height, seed)
    expect(result.value).toEqual(instant)
    // A carve or a backtrack happens every step, so a maze with more than one
    // cell takes more than one step to finish.
    expect(stepCount).toBeGreaterThan(1)
  })

  test("every yielded step carries a grid, a stack, and a current cell (or null once done)", () => {
    const stepped = mg.generateMaze(3, 3, mg.createRng(5))
    let result = stepped.next()
    while (!result.done) {
      const { grid, stack, current } = result.value
      expect(grid).toHaveLength(3)
      expect(Array.isArray(stack)).toBe(true)
      if (stack.length > 0) {
        expect(current).toEqual(stack[stack.length - 1])
      } else {
        expect(current).toBeNull()
      }
      result = stepped.next()
    }
  })

  test("the stack never holds more cells than the maze has", () => {
    const width = 5
    const height = 5
    const stepped = mg.generateMaze(width, height, mg.createRng(2))
    let result = stepped.next()
    while (!result.done) {
      expect(result.value.stack.length).toBeLessThanOrEqual(width * height)
      result = stepped.next()
    }
  })
})

describe("solveMaze", () => {
  test.each(SIZES)(
    "the path starts at the top-left and ends at the bottom-right (%p x %p)",
    (width, height) => {
      const { grid } = mg.generateMazeInstant(width, height, 4)
      const path = mg.solveMaze(grid, width, height)
      expect(path[0]).toEqual({ x: 0, y: 0 })
      expect(path[path.length - 1]).toEqual({ x: width - 1, y: height - 1 })
    },
  )

  test.each(SIZES)(
    "the path is connected: each step moves to an adjacent cell through an open wall (%p x %p)",
    (width, height) => {
      const { grid } = mg.generateMazeInstant(width, height, 5)
      const path = mg.solveMaze(grid, width, height)
      for (let i = 1; i < path.length; i += 1) {
        const prev = path[i - 1]
        const cur = path[i]
        const dx = cur.x - prev.x
        const dy = cur.y - prev.y
        // Exactly one axis moves, by exactly one cell.
        expect(Math.abs(dx) + Math.abs(dy)).toBe(1)

        const wallLeaving = dx === 1 ? "E" : dx === -1 ? "W" : dy === 1 ? "S" : "N"
        expect(grid[prev.y][prev.x][wallLeaving]).toBe(false)
      }
    },
  )

  test("the path visits no cell twice", () => {
    const { grid } = mg.generateMazeInstant(10, 10, 6)
    const path = mg.solveMaze(grid, 10, 10)
    const seen = new Set(path.map((c) => `${c.x},${c.y}`))
    expect(seen.size).toBe(path.length)
  })

  test("a single-cell maze solves to a one-cell path", () => {
    const { grid } = mg.generateMazeInstant(1, 1, 7)
    const path = mg.solveMaze(grid, 1, 1)
    expect(path).toEqual([{ x: 0, y: 0 }])
  })
})

describe("countPassages / countReachableCells on a hand-built grid", () => {
  test("a 2x1 grid with the wall between the cells removed is fully connected", () => {
    const grid = mg.makeGrid(2, 1)
    grid[0][0].E = false
    grid[0][1].W = false
    expect(mg.countReachableCells(grid, 2, 1)).toBe(2)
    expect(mg.countPassages(grid, 2, 1)).toBe(1)
  })

  test("a 2x1 grid with all walls up is not fully connected", () => {
    const grid = mg.makeGrid(2, 1)
    expect(mg.countReachableCells(grid, 2, 1)).toBe(1)
    expect(mg.countPassages(grid, 2, 1)).toBe(0)
  })
})

describe("SIZE_PRESETS", () => {
  test("offers a few square sizes", () => {
    expect(mg.SIZE_PRESETS.length).toBeGreaterThanOrEqual(3)
    for (const size of mg.SIZE_PRESETS) {
      expect(Number.isInteger(size)).toBe(true)
      expect(size).toBeGreaterThan(0)
    }
  })
})

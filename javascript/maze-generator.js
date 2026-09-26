/**
 * maze-generator.js
 *
 * A perfect maze (a spanning tree over a grid of cells -- exactly one path
 * between any two cells) built with randomized depth-first backtracking, plus
 * a breadth-first solver for the shortest path from the top-left to the
 * bottom-right cell.
 *
 * The generator is a JS generator function: apart from the initial yield,
 * which hands back the start cell before anything is carved, each `next()`
 * call performs exactly one carve or one backtrack pop and yields a snapshot
 * of the grid, the current cell, and the backtracking stack. That is what
 * lets the page animate carving one step at a time and lets
 * `generateMazeInstant` and the tests drain the same sequence to completion
 * in one call -- there is only one code path for "how the maze is built."
 *
 * Randomness goes through `createRng`, a small seeded PRNG (mulberry32), so a
 * seed reproduces the exact same maze -- for tests, and for a `?seed=` link.
 */

/** Grid sizes offered by the page (always square). */
const SIZE_PRESETS = [10, 20, 40]

/**
 * The four wall directions a cell tracks, paired with the coordinate delta to
 * the neighbor across that wall and the direction that neighbor calls it back
 * from (removing a wall always clears both sides).
 */
const DIRECTIONS = [
  { name: "N", dx: 0, dy: -1, opposite: "S" },
  { name: "E", dx: 1, dy: 0, opposite: "W" },
  { name: "S", dx: 0, dy: 1, opposite: "N" },
  { name: "W", dx: -1, dy: 0, opposite: "E" },
]

/**
 * Coerces any seed into a usable 32-bit unsigned integer. A digit string (as
 * read back from `?seed=`) is the same seed as its number; any other string is
 * hashed with FNV-1a. A non-finite or missing seed becomes 1 rather than NaN,
 * since a NaN seed would silently produce the same value forever.
 *
 * @param {number|string|undefined} seed
 * @returns {number} A 32-bit unsigned integer, never 0.
 */
function normalizeSeed(seed) {
  // A seed read back from the URL is a string, so "12345" must mean 12345.
  if (typeof seed === "string" && /^\d+$/.test(seed)) {
    seed = Number(seed)
  }
  if (typeof seed === "number" && Number.isFinite(seed)) {
    return Math.floor(seed) >>> 0 || 1
  }
  const str = String(seed ?? "")
  let hash = 2166136261
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0 || 1
}

/**
 * Creates a seeded pseudo-random generator (mulberry32: 32-bit state, one
 * multiply-xorshift round per value). Not cryptographically secure -- only
 * meant to make maze generation reproducible from a seed.
 *
 * @param {number|string} [seed]
 * @returns {{next: () => number, int: (min: number, max: number) => number}}
 *   `next()` returns a float in [0, 1); `int(min, max)` returns an integer in
 *   [min, max], inclusive.
 */
function createRng(seed) {
  let state = normalizeSeed(seed)

  function next() {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  function int(min, max) {
    return min + Math.floor(next() * (max - min + 1))
  }

  return { next, int }
}

/**
 * Builds a fresh, fully-walled grid.
 *
 * @param {number} width
 * @param {number} height
 * @returns {Array<Array<{N: boolean, E: boolean, S: boolean, W: boolean, visited: boolean}>>}
 *   `grid[y][x]`, each cell starting with all four walls up and unvisited.
 */
function makeGrid(width, height) {
  const grid = []
  for (let y = 0; y < height; y += 1) {
    const row = []
    for (let x = 0; x < width; x += 1) {
      row.push({ N: true, E: true, S: true, W: true, visited: false })
    }
    grid.push(row)
  }
  return grid
}

/**
 * A deep copy of a grid, so a snapshot handed out by the generator is safe to
 * keep even after the generator carves further.
 *
 * @param {Array<Array<object>>} grid
 * @returns {Array<Array<object>>}
 */
function cloneGrid(grid) {
  return grid.map((row) => row.map((cell) => ({ ...cell })))
}

function inBounds(x, y, width, height) {
  return x >= 0 && x < width && y >= 0 && y < height
}

/**
 * The unvisited neighbors of a cell, each paired with the wall direction that
 * connects it to `(x, y)`.
 *
 * @param {Array<Array<object>>} grid
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @returns {Array<{x: number, y: number, dir: string, opposite: string}>}
 */
function unvisitedNeighbors(grid, x, y, width, height) {
  const result = []
  for (const dir of DIRECTIONS) {
    const nx = x + dir.dx
    const ny = y + dir.dy
    if (inBounds(nx, ny, width, height) && !grid[ny][nx].visited) {
      result.push({ x: nx, y: ny, dir: dir.name, opposite: dir.opposite })
    }
  }
  return result
}

/**
 * The neighbors of a cell reachable without crossing a wall -- i.e. the
 * maze's actual passages, as opposed to `unvisitedNeighbors`, which is a
 * generation-time helper that ignores walls entirely.
 *
 * @param {Array<Array<object>>} grid
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @returns {Array<{x: number, y: number}>}
 */
function passableNeighbors(grid, x, y, width, height) {
  const cell = grid[y][x]
  const result = []
  for (const dir of DIRECTIONS) {
    if (cell[dir.name]) continue
    const nx = x + dir.dx
    const ny = y + dir.dy
    if (inBounds(nx, ny, width, height)) result.push({ x: nx, y: ny })
  }
  return result
}

/**
 * A step-able maze generator: randomized depth-first backtracking
 * (recursive backtracker), implemented iteratively with an explicit stack so
 * it can be driven one carve at a time.
 *
 * Apart from the initial yield, which hands back the start cell before
 * anything is carved, each call to `.next()` performs exactly one carve or
 * one backtrack pop and yields `{ grid, stack, current }`, a snapshot for
 * rendering:
 * - `grid` -- a clone of the grid as it stands after this step
 * - `stack` -- the current backtracking path, from the start cell to the cell
 *   generation is standing on (empty once generation is finished)
 * - `current` -- the cell generation is standing on, or `null` once finished
 *
 * When the generator is exhausted, its `{ done: true, value }` carries the
 * finished maze as `{ width, height, grid }` -- the same shape
 * `generateMazeInstant` returns, so both paths produce an identical result
 * for a given seed.
 *
 * @param {number} width
 * @param {number} height
 * @param {{next: () => number, int: (min: number, max: number) => number}} rng
 * @returns {Generator<{grid: Array<Array<object>>, stack: Array<{x:number,y:number}>, current: {x:number,y:number}|null}, {width: number, height: number, grid: Array<Array<object>>}>}
 */
function* generateMaze(width, height, rng) {
  const grid = makeGrid(width, height)
  const stack = [{ x: 0, y: 0 }]
  grid[0][0].visited = true

  yield { grid: cloneGrid(grid), stack: [...stack], current: stack[stack.length - 1] }

  while (stack.length > 0) {
    const { x, y } = stack[stack.length - 1]
    const candidates = unvisitedNeighbors(grid, x, y, width, height)

    if (candidates.length > 0) {
      const chosen = candidates[rng.int(0, candidates.length - 1)]
      grid[y][x][chosen.dir] = false
      grid[chosen.y][chosen.x][chosen.opposite] = false
      grid[chosen.y][chosen.x].visited = true
      stack.push({ x: chosen.x, y: chosen.y })
    } else {
      stack.pop()
    }

    yield {
      grid: cloneGrid(grid),
      stack: [...stack],
      current: stack.length > 0 ? stack[stack.length - 1] : null,
    }
  }

  return { width, height, grid }
}

/**
 * Runs `generateMaze` to completion in one call, for "Instant" mode and for
 * tests that only care about the finished maze.
 *
 * @param {number} width
 * @param {number} height
 * @param {number|string} [seed]
 * @returns {{width: number, height: number, grid: Array<Array<object>>}}
 */
function generateMazeInstant(width, height, seed) {
  const rng = createRng(seed)
  const gen = generateMaze(width, height, rng)
  let result = gen.next()
  while (!result.done) result = gen.next()
  return result.value
}

/**
 * Breadth-first shortest path from the top-left cell to the bottom-right
 * cell, following passages (open walls) only.
 *
 * @param {Array<Array<object>>} grid
 * @param {number} width
 * @param {number} height
 * @returns {Array<{x: number, y: number}>|null} The path from start to end,
 *   inclusive of both, or `null` if no such path exists (not possible in a
 *   perfect maze, but guarded against a malformed grid).
 */
function solveMaze(grid, width, height) {
  const start = { x: 0, y: 0 }
  const end = { x: width - 1, y: height - 1 }
  const key = (x, y) => `${x},${y}`

  const cameFrom = new Map()
  const visited = new Set([key(start.x, start.y)])
  const queue = [start]

  while (queue.length > 0) {
    const cur = queue.shift()
    if (cur.x === end.x && cur.y === end.y) break
    for (const next of passableNeighbors(grid, cur.x, cur.y, width, height)) {
      const k = key(next.x, next.y)
      if (visited.has(k)) continue
      visited.add(k)
      cameFrom.set(k, cur)
      queue.push(next)
    }
  }

  if (!visited.has(key(end.x, end.y))) return null

  const path = [end]
  let cur = end
  while (!(cur.x === start.x && cur.y === start.y)) {
    cur = cameFrom.get(key(cur.x, cur.y))
    path.push(cur)
  }
  path.reverse()
  return path
}

/**
 * The number of cells reachable from the top-left cell, following passages
 * only. Equal to `width * height` exactly when the maze is fully connected.
 *
 * @param {Array<Array<object>>} grid
 * @param {number} width
 * @param {number} height
 * @returns {number}
 */
function countReachableCells(grid, width, height) {
  const key = (x, y) => `${x},${y}`
  const visited = new Set([key(0, 0)])
  const queue = [{ x: 0, y: 0 }]
  while (queue.length > 0) {
    const cur = queue.shift()
    for (const next of passableNeighbors(grid, cur.x, cur.y, width, height)) {
      const k = key(next.x, next.y)
      if (visited.has(k)) continue
      visited.add(k)
      queue.push(next)
    }
  }
  return visited.size
}

/**
 * The number of open passages in the maze. Counting only the east and south
 * wall of every cell (rather than all four) avoids counting the same
 * passage twice from both sides. A perfect maze -- a spanning tree over
 * `width * height` cells -- has exactly `width * height - 1` of these.
 *
 * @param {Array<Array<object>>} grid
 * @param {number} width
 * @param {number} height
 * @returns {number}
 */
function countPassages(grid, width, height) {
  let count = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cell = grid[y][x]
      if (!cell.E && x < width - 1) count += 1
      if (!cell.S && y < height - 1) count += 1
    }
  }
  return count
}

export {
  SIZE_PRESETS,
  DIRECTIONS,
  createRng,
  makeGrid,
  cloneGrid,
  generateMaze,
  generateMazeInstant,
  solveMaze,
  countReachableCells,
  countPassages,
}

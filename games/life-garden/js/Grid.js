import { SPECIES } from "./constants.js"

// Moore neighborhood offsets (8 surrounding cells)
const NEIGHBORS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
]

export class Grid {
  /**
   * @param {number} width
   * @param {number} height
   * @param {import('./Species.js').SpeciesRegistry} registry
   */
  constructor(width, height, registry) {
    this.width = width
    this.height = height
    this.registry = registry
    // cells[y][x] = { species: number, age: number }
    this.cells = []
    for (let y = 0; y < height; y++) {
      const row = []
      for (let x = 0; x < width; x++) {
        row.push({ species: SPECIES.EMPTY, age: 0 })
      }
      this.cells.push(row)
    }
  }

  getCell(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null
    return this.cells[y][x]
  }

  setCell(x, y, species) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return
    this.cells[y][x] = { species, age: 0 }
  }

  /**
   * Count neighbors of given species types around (x, y).
   * @param {number} x
   * @param {number} y
   * @param {number[]} speciesIds - which species IDs count
   * @returns {number}
   */
  countNeighbors(x, y, speciesIds) {
    let count = 0
    for (const [dy, dx] of NEIGHBORS) {
      const nx = x + dx
      const ny = y + dy
      const cell = this.getCell(nx, ny)
      if (cell && speciesIds.includes(cell.species)) {
        count++
      }
    }
    return count
  }

  /** Count total living cells of a species on the entire grid. */
  countSpecies(speciesId) {
    let count = 0
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.cells[y][x].species === speciesId) count++
      }
    }
    return count
  }

  /** Count living cells of a species within a rectangular zone. */
  countSpeciesInZone(speciesId, zone) {
    let count = 0
    const x0 = Math.max(0, zone.x)
    const y0 = Math.max(0, zone.y)
    const x1 = Math.min(this.width, zone.x + zone.w)
    const y1 = Math.min(this.height, zone.y + zone.h)
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (this.cells[y][x].species === speciesId) count++
      }
    }
    return count
  }

  /** Count total living cells (any species). */
  countLiving() {
    let count = 0
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.cells[y][x].species !== SPECIES.EMPTY) count++
      }
    }
    return count
  }

  /** Advance one generation. Returns a new Grid. */
  step() {
    const next = new Grid(this.width, this.height, this.registry)
    const placeableSpecies = this.registry.placeable()

    // Build a set of cells killed by predator species (e.g. rabbits eating grass)
    const killed = new Set()
    for (const predator of placeableSpecies) {
      if (!predator.killTargets) continue
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          const cell = this.cells[y][x]
          if (predator.killTargets.includes(cell.species)) {
            const predatorCount = this.countNeighbors(x, y, [predator.id])
            if (predatorCount >= predator.killThreshold) {
              killed.add(`${x},${y}`)
            }
          }
        }
      }
    }

    // Build a map: pollinated speciesId -> { cells: Set, birthRules: array }
    const pollinatorMap = new Map()
    for (const def of placeableSpecies) {
      if (!def.pollinates) continue
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          if (this.countNeighbors(x, y, [def.id]) > 0) {
            if (!pollinatorMap.has(def.pollinates)) {
              pollinatorMap.set(def.pollinates, {
                cells: new Set(),
                birthRules: def.pollinateBirth || [],
              })
            }
            pollinatorMap.get(def.pollinates).cells.add(`${x},${y}`)
          }
        }
      }
    }

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.cells[y][x]

        if (cell.species !== SPECIES.EMPTY) {
          // Check if killed by predator
          if (killed.has(`${x},${y}`)) continue // dies

          // Survival check
          const def = this.registry.get(cell.species)
          if (def) {
            const neighborCount = this.countNeighbors(x, y, def.neighbors)
            const survives = def.survive.includes(neighborCount)
            const withinAge = def.maxAge === null || cell.age < def.maxAge
            if (survives && withinAge) {
              next.cells[y][x] = { species: cell.species, age: cell.age + 1 }
              continue
            }
          }
          // Cell dies -- leave empty
        } else {
          // Birth check: find highest-priority species that wants to birth here
          let bestCandidate = null
          for (const def of placeableSpecies) {
            const neighborCount = this.countNeighbors(x, y, def.neighbors)
            // Species with birthRequiresOwn must have at least 1 of its own kind adjacent
            if (def.birthRequiresOwn && this.countNeighbors(x, y, [def.id]) === 0) {
              continue
            }
            // Check if this cell gets a pollination birth bonus
            const bonus = pollinatorMap.get(def.id)
            const birthRules =
              bonus && bonus.cells.has(`${x},${y}`) && bonus.birthRules.length > 0
                ? bonus.birthRules
                : def.birth
            if (birthRules.includes(neighborCount)) {
              if (!bestCandidate || def.priority > bestCandidate.priority) {
                bestCandidate = def
              }
            }
          }
          if (bestCandidate) {
            next.cells[y][x] = { species: bestCandidate.id, age: 0 }
          }
        }
      }
    }
    return next
  }

  clone() {
    const copy = new Grid(this.width, this.height, this.registry)
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.cells[y][x]
        copy.cells[y][x] = { species: cell.species, age: cell.age }
      }
    }
    return copy
  }
}

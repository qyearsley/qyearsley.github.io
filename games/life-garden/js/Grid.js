import { SPECIES, KIND, DEFAULT_SEED } from "./constants.js"
import { Random } from "./Random.js"

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

/** Bare ground. */
function bare() {
  return { species: SPECIES.EMPTY, age: 0 }
}

/** A living plant, newly at this stage. */
function plant(species) {
  return { species, age: 0 }
}

/**
 * The board, in two layers.
 *
 * The ground layer holds plants and is a cellular automaton: every plant counts
 * its neighbours and lives, dies or is born by Conway's rules. Nothing on it
 * moves.
 *
 * The layer above holds animals, one to a cell, and they are not an automaton
 * at all. Each animal is an individual with an energy counter that walks
 * towards food, eats, breeds and starves.
 *
 * Two layers rather than one is what lets a rabbit stand in the grass instead
 * of replacing it, and it is also what removed the old birth-priority system:
 * nothing competes for a cell with something on the other layer.
 */
export class Grid {
  /**
   * @param {number} width
   * @param {number} height
   * @param {import('./Species.js').SpeciesRegistry} registry
   * @param {Random|number} [rng] - Generator or seed. Each grid owns its own,
   *   so rewinding to an older grid rewinds the randomness with it.
   */
  constructor(width, height, registry, rng = DEFAULT_SEED) {
    this.width = width
    this.height = height
    this.registry = registry
    this.rng = rng instanceof Random ? rng : new Random(rng)
    // plants[y][x] = { species, age }; species is EMPTY for bare ground
    this.plants = []
    // animals[y][x] = { species, energy, age, full } or null for nobody there
    this.animals = []
    // Animal species that have lived on this board. Only these wander back in
    // -- see `_arrivals`.
    this.residents = new Set()
    for (let y = 0; y < height; y++) {
      const plantRow = []
      const animalRow = []
      for (let x = 0; x < width; x++) {
        plantRow.push(bare())
        animalRow.push(null)
      }
      this.plants.push(plantRow)
      this.animals.push(animalRow)
    }
  }

  inBounds(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height
  }

  /** @returns {{species: number, age: number}|null} Ground at (x, y), null if off the board. */
  getPlant(x, y) {
    return this.inBounds(x, y) ? this.plants[y][x] : null
  }

  /** @returns {{species: number, energy: number, age: number, full: number}|null} Animal. */
  getAnimal(x, y) {
    return this.inBounds(x, y) ? this.animals[y][x] : null
  }

  /** Whether anything at all is at (x, y), on either layer. */
  isOccupied(x, y) {
    if (!this.inBounds(x, y)) return false
    return this.plants[y][x].species !== SPECIES.EMPTY || this.animals[y][x] !== null
  }

  /**
   * Put a species on the board, on whichever layer it belongs to.
   *
   * A plant goes on the ground and an animal stands on top, so planting grass
   * under a rabbit and dropping a rabbit into long grass both work. Passing
   * EMPTY clears the ground.
   *
   * @param {number} x
   * @param {number} y
   * @param {number} speciesId
   */
  setCell(x, y, speciesId) {
    if (!this.inBounds(x, y)) return
    if (speciesId === SPECIES.EMPTY) {
      this.plants[y][x] = bare()
      return
    }
    const def = this.registry.get(speciesId)
    if (!def) return
    if (def.kind === KIND.ANIMAL) {
      this.residents.add(speciesId)
      this.animals[y][x] = { species: speciesId, energy: def.startEnergy, age: 0, full: 0 }
    } else {
      this.plants[y][x] = plant(speciesId)
    }
  }

  /**
   * Clear a cell, topmost layer first.
   *
   * Clicking a rabbit standing in grass takes the rabbit and leaves the grass,
   * which is what you would expect from clicking the thing you can see.
   */
  clearCell(x, y) {
    if (!this.inBounds(x, y)) return
    if (this.animals[y][x]) this.animals[y][x] = null
    else this.plants[y][x] = bare()
  }

  /**
   * Count neighbours of the given species around (x, y), across both layers.
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
      if (!this.inBounds(nx, ny)) continue
      if (speciesIds.includes(this.plants[ny][nx].species)) count++
      const animal = this.animals[ny][nx]
      if (animal && speciesIds.includes(animal.species)) count++
    }
    return count
  }

  /** Count cells of a species on the entire grid, on whichever layer it lives. */
  countSpecies(speciesId) {
    let count = 0
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.plants[y][x].species === speciesId) count++
        if (this.animals[y][x]?.species === speciesId) count++
      }
    }
    return count
  }

  /** Count cells of a species within a rectangular zone. */
  countSpeciesInZone(speciesId, zone) {
    let count = 0
    const x0 = Math.max(0, zone.x)
    const y0 = Math.max(0, zone.y)
    const x1 = Math.min(this.width, zone.x + zone.w)
    const y1 = Math.min(this.height, zone.y + zone.h)
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (this.plants[y][x].species === speciesId) count++
        if (this.animals[y][x]?.species === speciesId) count++
      }
    }
    return count
  }

  /** Count everything alive, on both layers. */
  countLiving() {
    let count = 0
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.plants[y][x].species !== SPECIES.EMPTY) count++
        if (this.animals[y][x]) count++
      }
    }
    return count
  }

  /**
   * Advance one generation. Returns a new Grid; this one is left alone.
   *
   * The plants grow first and the animals then move over the result, so a
   * rabbit can eat grass that was born this turn. Doing it the other way round
   * would let grass reappear under an animal that had just grazed it.
   */
  step() {
    const next = new Grid(this.width, this.height, this.registry, this.rng.clone())
    next.residents = new Set(this.residents)
    next._growPlants(this)
    next._copyAnimalsFrom(this)
    next._moveAnimals()
    next._arrivals()
    return next
  }

  clone() {
    const copy = new Grid(this.width, this.height, this.registry, this.rng.clone())
    copy.residents = new Set(this.residents)
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        copy.plants[y][x] = { ...this.plants[y][x] }
        copy.animals[y][x] = this.animals[y][x] ? { ...this.animals[y][x] } : null
      }
    }
    return copy
  }

  // -- Plants: the cellular automaton ------------------------------------

  /**
   * Fill this grid's ground layer from `source`, one generation on.
   *
   * Three things happen here. Conway's survival and birth rules, read out of
   * the species data, are the first and they are the game's original engine.
   * The two life-stage transitions are the second: grass that has stood long
   * enough comes into bloom, and a bloom that has stood long enough drops back
   * to plain grass. The third is sprouting -- see `_sproutChance`.
   *
   * The last two are what stopped every board ending as frozen flowers. A bloom
   * used to be permanent, and grazed ground could never come back, because
   * Conway needs three living neighbours to grow anything and a stripped patch
   * has none.
   *
   * @param {Grid} source - The previous generation
   */
  _growPlants(source) {
    const born = source.registry.plants().filter((def) => def.placeable !== false)

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = source.plants[y][x]

        if (cell.species === SPECIES.EMPTY) {
          this._growOnBareGround(source, born, x, y)
          continue
        }

        const def = source.registry.get(cell.species)
        if (!def || !def.survive.includes(source.countNeighbors(x, y, def.neighbors))) {
          continue // crowded out, leaving bare ground
        }

        const age = cell.age + 1
        if (def.bloomsInto && age >= def.bloomAge) {
          // Age resets so the new stage times itself from its own start
          this.plants[y][x] = plant(def.bloomsInto)
        } else if (def.revertsTo && age >= def.bloomDuration) {
          this.plants[y][x] = plant(def.revertsTo)
        } else {
          this.plants[y][x] = { species: cell.species, age }
        }
      }
    }
  }

  /**
   * What happens to one bare cell: Conway birth first, then a chance to sprout.
   *
   * @param {Grid} source - The previous generation
   * @param {object[]} born - Plant species that can be born
   */
  _growOnBareGround(source, born, x, y) {
    for (const def of born) {
      if (def.birth.includes(source.countNeighbors(x, y, def.neighbors))) {
        this.plants[y][x] = plant(def.id)
        return
      }
    }

    const chance = source._sproutChance(x, y)
    if (chance > 0 && this.rng.next() < chance) {
      this.plants[y][x] = plant(SPECIES.GRASS)
    }
  }

  /**
   * The chance that bare ground at (x, y) sprouts grass this generation.
   *
   * Each neighbouring plant contributes its own `sproutChance` -- grass a
   * little, grass in bloom rather more -- and a pollinator standing next to the
   * cell multiplies the total by its `sproutBonus`. That multiplier is the
   * whole of pollination: a bee grows nothing itself, it makes the grass around
   * it spread faster.
   *
   * This is the game's only source of grass that Conway's rule cannot produce,
   * and everything else depends on it: a rule that needs three living
   * neighbours can never recolonise ground the rabbits stripped bare, so
   * without this the meadow only ever shrank and one boom and bust was all the
   * food chain could manage.
   *
   * It is deliberately proportional to how much grass is already next door,
   * which puts recovery fastest at the edge of a surviving patch and keeps a
   * cleared board clear.
   *
   * @returns {number} A probability in [0, 1]
   */
  _sproutChance(x, y) {
    let chance = 0
    let bonus = 1
    for (const [dy, dx] of NEIGHBORS) {
      const nx = x + dx
      const ny = y + dy
      if (!this.inBounds(nx, ny)) continue
      chance += this.registry.get(this.plants[ny][nx].species)?.sproutChance || 0
      const pollinator = this.registry.get(this.animals[ny][nx]?.species)?.sproutBonus
      if (pollinator) bonus = Math.max(bonus, pollinator)
    }
    if (chance === 0) return 0
    return Math.min(1, chance * bonus)
  }

  // -- Animals: individuals that move ------------------------------------

  /** @param {Grid} source */
  _copyAnimalsFrom(source) {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.animals[y][x] = source.animals[y][x] ? { ...source.animals[y][x] } : null
      }
    }
  }

  /**
   * Every animal takes its turn, in a shuffled order.
   *
   * Animals act one at a time on the live board rather than all at once into a
   * copy, because two of them must not end up in the same cell. That means the
   * order matters, and reading order would hand the top-left animal first
   * choice of every meal, so it is shuffled from this grid's own generator.
   */
  _moveAnimals() {
    const actors = []
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.animals[y][x]) actors.push({ animal: this.animals[y][x], x, y })
      }
    }
    this.rng.shuffle(actors)

    // Animals eaten before their own turn came round. Identity, not position:
    // a victim may have moved since the list was built.
    const eaten = new Set()
    for (const actor of actors) {
      if (eaten.has(actor.animal)) continue
      this._takeTurn(actor, eaten)
    }
  }

  /**
   * Life arriving from outside the garden.
   *
   * A twenty-by-twenty board is too small to hold a food chain up on its own.
   * Every arrangement that cycles nicely for a few hundred generations still
   * dies out in the end -- a run of bad luck takes the last few rabbits, and
   * nothing on the board can bring them back. A stripped board is worse still:
   * grass only sprouts beside grass, so once the last blade goes the ground
   * stays bare for good.
   *
   * The garden is not the whole world, though. Seeds blow over the fence and
   * animals wander in at the edge, which is what a real patch of ground lives
   * on.
   *
   * Animals arrive at the edge, because that is where something walking in
   * would appear. Seeds land on any bare cell: wind does not respect a fence,
   * and while seeds were edge-only too the border filled with grass that the
   * animals never reached, leaving a visible green frame around the board
   * within about forty generations.
   *
   * Two things hold arrivals back. An animal only comes if the board already
   * holds enough of its food, so a fox never walks into an empty field. And
   * only a kind that has lived here before comes back, so a board loaded
   * without foxes never grows foxes -- which is the whole point of having the
   * same field with the predator and without it.
   */
  _arrivals() {
    for (const def of this.registry.all()) {
      if (!def.arriveChance) continue
      if (def.kind === KIND.ANIMAL) {
        if (!this.residents.has(def.id)) continue
        const food = def.eats.reduce((total, id) => total + this.countSpecies(id), 0)
        if (food < def.arriveNeeds) continue
      }
      if (this.rng.next() >= def.arriveChance) continue
      const spot = this.rng.pick(
        def.kind === KIND.ANIMAL ? this._freeEdgeCells() : this._bareCells(),
      )
      if (spot) this.setCell(spot.x, spot.y, def.id)
    }
  }

  /** Edge cells with no animal standing on them, for something walking in. */
  _freeEdgeCells() {
    const spots = []
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const onEdge = x === 0 || y === 0 || x === this.width - 1 || y === this.height - 1
        if (onEdge && !this.animals[y][x]) spots.push({ x, y })
      }
    }
    return spots
  }

  /** Every cell with bare ground, for something blowing in. */
  _bareCells() {
    const spots = []
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.plants[y][x].species === SPECIES.EMPTY) spots.push({ x, y })
      }
    }
    return spots
  }

  /**
   * One animal's turn: spend, move, eat, breed.
   * @param {{animal: object, x: number, y: number}} actor - Mutated as it moves
   * @param {Set<object>} eaten
   */
  _takeTurn(actor, eaten) {
    const animal = actor.animal
    const def = this.registry.get(animal.species)
    if (!def) return

    animal.age++
    animal.energy--
    if (animal.energy <= 0) {
      this.animals[actor.y][actor.x] = null
      return
    }

    // Whether it is still on the last meal is decided once, before anything can
    // change it, and the counter comes down once whatever else happens. Doing
    // this inside the branches let an animal that fled after eating digest a
    // generation short.
    const digesting = animal.full > 0
    if (digesting) animal.full--

    // A visible predator beats everything else: a rabbit that can see a fox
    // runs rather than grazes. Flight is what gives the prey any refuge at all
    // -- a fox that hunts on sight and never misses wipes them out otherwise,
    // and then starves itself. Running is not hunting, so an animal in flight
    // will not step onto its own food even if the escape route runs over it.
    const threat = this._findThreat(actor.x, actor.y, def)
    if (threat) {
      const away = this._stepAway(actor.x, actor.y, threat.x, threat.y, def)
      if (away) this._moveTo(actor, away.x, away.y, def, eaten)
      return
    }

    const target = digesting ? null : this._findFood(actor.x, actor.y, def, animal)
    if (target) {
      // One meal a turn. `_moveTo` feeds the animal if it landed on prey, and
      // without this a species that ate both animals and plants would take the
      // prey and the grass underneath it in the same generation.
      let ate = false
      if (target.x !== actor.x || target.y !== actor.y) {
        const step = this._stepToward(actor.x, actor.y, target.x, target.y, def)
        if (step) ate = this._moveTo(actor, step.x, step.y, def, eaten)
      }
      if (!ate) this._eatPlant(animal, def, actor.x, actor.y)
    } else {
      const spot = this.rng.pick(this._freeNeighbors(actor.x, actor.y))
      if (spot) this._moveTo(actor, spot.x, spot.y, def, eaten)
    }

    if (animal.energy >= def.breedAt) this._breed(actor, def)
  }

  /**
   * The nearest food within sight, or null.
   *
   * Rings outward from the animal so the closest meal wins, and picks at random
   * between equally close ones. Distance 0 counts: an animal already standing
   * on its food eats without moving.
   *
   * @param {number} x
   * @param {number} y
   * @param {object} def - The hungry animal's species definition
   * @param {object} self - The hungry animal, which does not block its own cell
   * @returns {{x: number, y: number}|null}
   */
  _findFood(x, y, def, self) {
    for (let r = 0; r <= def.sight; r++) {
      const found = []
      for (const [nx, ny] of this._ring(x, y, r)) {
        if (this._isReachableFood(nx, ny, def, self)) found.push({ x: nx, y: ny })
      }
      if (found.length > 0) return this.rng.pick(found)
    }
    return null
  }

  /**
   * The nearest animal this one is afraid of, within `fearSight`, or null.
   *
   * Deliberately a shorter range than the fox's own sight, so a fox can stalk a
   * rabbit that has not noticed it yet. Two animals of the same speed can never
   * close on each other, so if prey saw as far as the predator did the predator
   * would never eat.
   *
   * @returns {{x: number, y: number}|null}
   */
  _findThreat(x, y, def) {
    if (!def.fears) return null
    for (let r = 1; r <= def.fearSight; r++) {
      const found = []
      for (const [nx, ny] of this._ring(x, y, r)) {
        const occupant = this.animals[ny][nx]
        if (occupant && def.fears.includes(occupant.species)) found.push({ x: nx, y: ny })
      }
      if (found.length > 0) return this.rng.pick(found)
    }
    return null
  }

  /** One step directly away from (tx, ty), around anything in the way. */
  _stepAway(x, y, tx, ty, def) {
    return this._stepToward(x, y, x - Math.sign(tx - x), y - Math.sign(ty - y), def, false)
  }

  /** The cells at exactly Chebyshev distance `r` from (x, y), inside the board. */
  _ring(x, y, r) {
    const cells = []
    const add = (nx, ny) => {
      if (this.inBounds(nx, ny)) cells.push([nx, ny])
    }
    if (r === 0) {
      add(x, y)
      return cells
    }
    for (let dx = -r; dx <= r; dx++) {
      add(x + dx, y - r)
      add(x + dx, y + r)
    }
    for (let dy = -r + 1; dy <= r - 1; dy++) {
      add(x - r, y + dy)
      add(x + r, y + dy)
    }
    return cells
  }

  /**
   * Whether (x, y) holds food this animal could actually get to.
   *
   * A cell with someone else's animal standing on it is no use even if there is
   * grass underneath, so it is not worth walking towards. Prey is the exception:
   * the predator moves into the cell it is eating out of. The animal doing the
   * looking does not block itself, so it can see the grass under its own feet.
   */
  _isReachableFood(x, y, def, self) {
    const occupant = this.animals[y][x]
    if (occupant && occupant !== self) return def.eats.includes(occupant.species)
    return def.eats.includes(this.plants[y][x].species)
  }

  /**
   * One step towards (tx, ty), around anything in the way.
   *
   * The diagonal straight at the target is tried first; if it is blocked the
   * animal tries either single axis, which is enough to get around another
   * animal rather than queueing behind it.
   *
   * @param {boolean} [hunting] - False when running away, which may not eat
   * @returns {{x: number, y: number}|null} Where to move, or null if hemmed in
   */
  _stepToward(x, y, tx, ty, def, hunting = true) {
    const dx = Math.sign(tx - x)
    const dy = Math.sign(ty - y)
    const options = [[dx, dy]]
    if (dx !== 0 && dy !== 0) options.push([dx, 0], [0, dy])
    else if (dx !== 0) options.push([dx, -1], [dx, 1])
    else options.push([-1, dy], [1, dy])

    for (const [ox, oy] of options) {
      const nx = x + ox
      const ny = y + oy
      if (this._canEnter(nx, ny, def, hunting)) return { x: nx, y: ny }
    }
    return null
  }

  /** In bounds, and either empty of animals or -- when hunting -- holding prey. */
  _canEnter(x, y, def, hunting = true) {
    if (!this.inBounds(x, y)) return false
    const occupant = this.animals[y][x]
    return !occupant || (hunting && def.eats.includes(occupant.species))
  }

  /** The adjacent cells with no animal on them. */
  _freeNeighbors(x, y) {
    const spots = []
    for (const [dy, dx] of NEIGHBORS) {
      const nx = x + dx
      const ny = y + dy
      if (this.inBounds(nx, ny) && !this.animals[ny][nx]) spots.push({ x: nx, y: ny })
    }
    return spots
  }

  /**
   * Move the animal, catching whatever prey was standing there.
   *
   * A predator eats by moving into its prey's cell, which is the same motion as
   * a rabbit moving onto grass -- an animal eats what it lands on, whichever
   * layer the meal was on.
   *
   * @returns {boolean} Whether the move caught something
   */
  _moveTo(actor, nx, ny, def, eaten) {
    const victim = this.animals[ny][nx]
    if (victim) {
      eaten.add(victim)
      this._feed(actor.animal, def)
    }
    this.animals[actor.y][actor.x] = null
    this.animals[ny][nx] = actor.animal
    actor.x = nx
    actor.y = ny
    return victim !== null
  }

  /**
   * Eat the plant under the animal, if it is on the menu.
   *
   * Grazing knocks a plant back one life stage rather than always killing it: a
   * grazed bloom drops to plain grass, and only plain grass is grazed down to
   * bare ground. That is what keeps a mature meadow standing under animals that
   * eat every few generations -- when eating always cleared the cell the
   * rabbits stripped the board faster than anything could refill it.
   *
   * A bee does not graze at all (`grazes: false`). It takes nectar and leaves
   * the flower standing, which matters more than it sounds: a bloom seeds the
   * ground beside it four times as readily as plain grass does, so a bee that
   * ate the flower would undo with one mouthful most of what its pollinating
   * was worth. Measured on the Pollinator board, a grazing bee left the meadow
   * no bigger than no bee at all.
   */
  _eatPlant(animal, def, x, y) {
    const eaten = this.plants[y][x]
    if (!def.eats.includes(eaten.species)) return

    this._feed(animal, def)
    if (def.grazes === false) return
    const becomes = this.registry.get(eaten.species)?.eatenBecomes ?? SPECIES.EMPTY
    this.plants[y][x] = becomes === SPECIES.EMPTY ? bare() : plant(becomes)
  }

  /**
   * Take a meal: energy up, and a few generations of digesting.
   *
   * Energy stops at `breedAt`, because that is the most an animal has any use
   * for -- one hemmed in with nowhere to put its young would otherwise bank
   * energy forever and become effectively immortal. The outer `max` is what
   * keeps that a ceiling rather than a haircut: a species defined with more
   * starting energy than it needs to breed would otherwise be cut down to
   * `breedAt` by its first meal.
   */
  _feed(animal, def) {
    animal.energy = Math.max(animal.energy, Math.min(animal.energy + def.gain, def.breedAt))
    animal.full = def.digest
  }

  /** Split in two, sharing the energy, if there is anywhere to put the young. */
  _breed(actor, def) {
    const spot = this.rng.pick(this._freeNeighbors(actor.x, actor.y))
    if (!spot) return
    const share = Math.floor(actor.animal.energy / 2)
    actor.animal.energy -= share
    this.animals[spot.y][spot.x] = { species: def.id, energy: share, age: 0, full: 0 }
  }
}

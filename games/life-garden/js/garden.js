// The Life Garden model: a board of squares, each with grass and maybe one animal.
// No DOM in here, so the tests can run it for hundreds of steps.

export const SIZE = 40

// Every number that tunes the garden. The "How it works" text on the page
// repeats these; garden.test.js checks that the two agree.
export const RULES = {
  regrow: 0.04, // chance that a bare square grows grass each step
  rabbit: { eat: 6, splitAt: 12 }, // energy from one grass; energy that makes it split
  fox: { eat: 4, splitAt: 24 }, // energy from one rabbit; energy that makes it split
}

// Where each preset starts. `grass` is the share of squares that start green.
export const PRESETS = {
  grass: { grass: 0.05, rabbits: 0, foxes: 0 },
  rabbits: { grass: 1, rabbits: 20, foxes: 0 },
  both: { grass: 1, rabbits: 80, foxes: 16 },
}

// Local copies: under Jest each global `Math` lookup is ~17x slower.
const { floor, imul } = Math

// Seeded random numbers (mulberry32), so a test can replay a run exactly.
function makeRandom(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = imul(t ^ (t >>> 15), t | 1)
    t ^= t + imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class Garden {
  /** @param {keyof PRESETS} preset @param {number} seed */
  constructor(preset, seed, rules = RULES, size = SIZE) {
    this.size = size
    this.rules = rules
    this.random = makeRandom(seed)
    this.generation = 0
    this.grass = new Uint8Array(size * size) // 1 where grass grows
    this.animals = new Array(size * size).fill(null) // { kind, energy, at } or null
    const start = PRESETS[preset]
    for (let i = 0; i < this.grass.length; i++) this.grass[i] = this.random() < start.grass ? 1 : 0
    this._scatter("rabbit", start.rabbits)
    this._scatter("fox", start.foxes)
  }

  _scatter(kind, count) {
    for (let placed = 0; placed < count;) {
      const at = floor(this.random() * this.animals.length)
      if (!this.animals[at]) {
        this.addAnimal(kind, at)
        placed++
      }
    }
  }

  addAnimal(kind, at) {
    this.animals[at] = { kind, at, energy: this.rules[kind].splitAt / 2 }
  }

  /** Paint by hand. `what` is "grass", "rabbit", "fox", or "erase". */
  paint(at, what) {
    if (what === "grass") this.grass[at] = 1
    else if (what === "erase") {
      if (this.animals[at]) this.animals[at] = null
      else this.grass[at] = 0
    } else if (!this.animals[at]) this.addAnimal(what, at)
  }

  /** The 8 squares around one square. The board wraps around at the edges. */
  _around(at) {
    const n = this.size
    const x = at % n
    const y = (at - x) / n
    const out = []
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx || dy) out.push(((y + dy + n) % n) * n + ((x + dx + n) % n))
      }
    }
    return out
  }

  step() {
    const { random, rules, grass, animals } = this

    for (let i = 0; i < grass.length; i++) {
      if (!grass[i] && random() < rules.regrow) grass[i] = 1
    }

    // Animals act in a random order, so no square gets first pick every time.
    const order = animals.filter(Boolean)
    for (let i = order.length - 1; i > 0; i--) {
      const j = floor(random() * (i + 1))
      ;[order[i], order[j]] = [order[j], order[i]]
    }

    for (const animal of order) {
      if (animal.dead) continue
      const from = animal.at
      if (--animal.energy <= 0) {
        animals[from] = null
        continue
      }

      // Go to food if any is next door. Otherwise go to any empty square.
      const around = this._around(from)
      const isRabbit = animal.kind === "rabbit"
      const food = around.filter((at) =>
        isRabbit ? grass[at] && !animals[at] : animals[at]?.kind === "rabbit",
      )
      const empty = around.filter((at) => !animals[at])
      const choices = food.length ? food : empty
      if (!choices.length) continue
      const to = choices[floor(random() * choices.length)]

      if (isRabbit && grass[to]) {
        grass[to] = 0
        animal.energy += rules.rabbit.eat
      } else if (!isRabbit && animals[to]) {
        animals[to].dead = true
        animal.energy += rules.fox.eat
      }
      animals[from] = null
      animals[to] = animal
      animal.at = to

      // Past the threshold, split in two. The young one takes the square left behind.
      if (animal.energy >= rules[animal.kind].splitAt) {
        const young = floor(animal.energy / 2)
        animal.energy -= young
        animals[from] = { kind: animal.kind, at: from, energy: young }
      }
    }
    this.generation++
  }

  counts() {
    const counts = { grass: 0, rabbit: 0, fox: 0 }
    for (const g of this.grass) counts.grass += g
    for (const a of this.animals) if (a) counts[a.kind]++
    return counts
  }
}

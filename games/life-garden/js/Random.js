/**
 * A small seeded pseudo-random generator (mulberry32).
 *
 * The simulation needs randomness -- animals wander, seeds scatter -- but it
 * also has to stay reproducible. `Grid.step()` returns a new grid and `game.js`
 * keeps the old ones for Back, so each grid carries its own generator state:
 * rewinding to an old grid rewinds the randomness with it, and stepping forward
 * again replays the same run. The presets are pinned by tests for the same
 * reason -- with `Math.random` there would be nothing to assert.
 *
 * The whole state is one 32-bit integer, which is what makes it cheap to copy
 * onto every generation.
 */
export class Random {
  /** @param {number} [seed] - Any integer. The same seed replays the same run. */
  constructor(seed = 1) {
    this.state = seed >>> 0
  }

  /** @returns {number} A float in [0, 1). */
  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /**
   * @param {number} n - Exclusive upper bound
   * @returns {number} An integer in [0, n).
   */
  int(n) {
    return Math.floor(this.next() * n)
  }

  /**
   * @param {Array} items
   * @returns {*} A uniformly chosen element, or null for an empty array.
   */
  pick(items) {
    return items.length === 0 ? null : items[this.int(items.length)]
  }

  /**
   * Fisher-Yates, in place.
   *
   * Used on the list of animals before they act. Acting in reading order would
   * give the animals nearest the top left first refusal on every contested cell
   * and every meal, which shows up as a population that drifts up and left.
   *
   * @param {Array} items
   * @returns {Array} The same array, shuffled.
   */
  shuffle(items) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(i + 1)
      ;[items[i], items[j]] = [items[j], items[i]]
    }
    return items
  }

  /** @returns {Random} An independent generator at the same point in the sequence. */
  clone() {
    const copy = new Random(0)
    copy.state = this.state
    return copy
  }
}

/**
 * Pure logic: building practice text, following a player through it, and
 * scoring the result. No DOM here, so all of it is easy to test.
 */
import { LESSONS, WORDS, keysUpTo } from "./lessons.js"

/** Below this many usable words, a lesson practices short letter groups instead. */
const MIN_WORDS = 8

/** Pick one item; weights[i] is how likely items[i] is relative to the rest. */
function weightedPick(items, weights, rng) {
  const total = weights.reduce((sum, w) => sum + w, 0)
  let roll = rng() * total
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i]
    if (roll < 0) return items[i]
  }
  return items[items.length - 1]
}

/** Extra weight for a key the player often misses, capped so one bad key does not take over. */
function weakness(key, errors) {
  return Math.min(errors[key] || 0, 5)
}

/** Words whose every letter has been taught. */
export function wordsFor(keys) {
  return WORDS.filter((word) => [...word].every((ch) => keys.includes(ch)))
}

/**
 * One line of practice text, about `length` characters, for lesson `index`.
 * Favors the lesson's new keys and any key in `errors` (key -> miss count).
 */
export function practiceLine(index, errors = {}, rng = Math.random, length = 24) {
  const keys = keysUpTo(index)
  const fresh = LESSONS[index]
  const words = wordsFor(keys)
  // Punctuation such as ; and . is in no word, so it goes after one: "sad;" or "zoo."
  const marks = [...keys].filter((key) => !/[a-z]/.test(key))
  const pieces = []
  let size = 0
  while (size < length) {
    let piece
    if (words.length < MIN_WORDS) piece = drill(keys, fresh, errors, rng)
    else {
      piece = pickWord(words, fresh, errors, rng)
      if (marks.length && rng() < 0.2) piece += marks[Math.floor(rng() * marks.length)]
    }
    pieces.push(piece)
    size += piece.length + 1
  }
  return pieces.join(" ")
}

function pickWord(words, fresh, errors, rng) {
  const weights = words.map((word) => {
    const letters = [...word]
    const isFresh = letters.some((ch) => fresh.includes(ch))
    return 1 + (isFresh ? 3 : 0) + Math.max(...letters.map((ch) => weakness(ch, errors)))
  })
  return weightedPick(words, weights, rng)
}

/** A 2-4 letter group such as "fjf", for lessons that know too few words. */
function drill(keys, fresh, errors, rng) {
  const all = [...keys]
  const weights = all.map((key) => 1 + (fresh.includes(key) ? 2 : 0) + weakness(key, errors))
  const size = 2 + Math.floor(rng() * 3)
  let group = ""
  for (let i = 0; i < size; i++) group += weightedPick(all, weights, rng)
  return group
}

/** Follows the player through one line of text. */
export class Run {
  constructor(text) {
    this.text = text
    this.pos = 0
    this.missed = new Set() // positions that took more than one try
    this.misses = {} // key -> how many wrong presses while it was the target
  }

  get done() {
    return this.pos >= this.text.length
  }

  get target() {
    return this.text[this.pos]
  }

  /** Returns true if `key` was the right one. A wrong key never moves the player back. */
  press(key) {
    if (this.done) return false
    if (key === this.target) {
      this.pos++
      return true
    }
    this.missed.add(this.pos)
    this.misses[this.target] = (this.misses[this.target] || 0) + 1
    return false
  }

  /** Share of characters typed right on the first try. */
  get accuracy() {
    return this.pos === 0 ? 1 : (this.pos - this.missed.size) / this.pos
  }
}

/** Finishing a lesson always earns one star; accuracy earns the rest. */
export function stars(accuracy) {
  if (accuracy >= 0.97) return 3
  if (accuracy >= 0.9) return 2
  return 1
}

/** Words per minute, counting five characters as one word. */
export function wpm(chars, ms) {
  return ms <= 0 ? 0 : Math.round(chars / 5 / (ms / 60000))
}

/** Add one run's misses to the saved per-key counts. Correct keys slowly earn their count back. */
export function updateErrors(errors, run) {
  const next = { ...errors }
  for (const [key, count] of Object.entries(run.misses)) next[key] = (next[key] || 0) + count
  for (const ch of new Set(run.text)) {
    if (!run.misses[ch] && next[ch]) next[ch] = next[ch] - 1 || undefined
  }
  return Object.fromEntries(Object.entries(next).filter(([, v]) => v))
}

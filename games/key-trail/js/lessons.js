/**
 * Lesson data: the order keys are taught in, which finger presses each key,
 * and the words practice text is drawn from.
 */

/** Each lesson adds these keys to everything taught before it. */
export const LESSONS = [
  "fj",
  "dk",
  "sl",
  "a;",
  "gh",
  "ei",
  "ru",
  "ty",
  "wo",
  "qp",
  "vn",
  "cm",
  "bx",
  "z.",
]

/** All keys taught up to and including lesson `index`. */
export function keysUpTo(index) {
  return LESSONS.slice(0, index + 1).join("")
}

/** Finger names, 0-7 from left pinky to right pinky. */
export const FINGERS = [
  "left pinky",
  "left ring",
  "left middle",
  "left index",
  "right index",
  "right middle",
  "right ring",
  "right pinky",
]

/** The three letter rows of the on-screen keyboard. */
export const ROWS = ["qwertyuiop", "asdfghjkl;", "zxcvbnm,./"]

/** Key -> finger number. Columns 0-3 go to the left hand, 4-9 to the right. */
export const FINGER_OF = {}
for (const row of ROWS) {
  ;[...row].forEach((key, col) => {
    FINGER_OF[key] = [0, 1, 2, 3, 3, 4, 4, 5, 6, 7][col]
  })
}

/** Short, common words a young reader knows. Filtered per lesson to the keys taught so far. */
export const WORDS = `a as ask add dad sad had has lad gas all fall hall flag glass half
shall ash dash salad jag lag
he she see seed feed fed led sled red hid did lid kid like lake fake desk
hide side ride slide sea leaf deal lead jar far
her here are rug sure fire hire rid fur us use run fun sun
the that this there they tea tree eat sit hat get yes yet try day say
key keys sky fly fish tiger
we will well was saw who two to too go so do no of off on one out our
what why with work word wood owl dog log frog hot pot top
put pig pet pie pull up stop ship quiet quick queen
van vet very have give love live save never seven even and in it not
can cat cup cake come camp mom moon more much make milk move my
big bed bus but box fox bike bird book bag back best both
zoo zip zebra lazy fuzzy`
  .split(/\s+/)
  .filter(Boolean)

/** Sentences for the speed run. Every character is a taught key or a space. */
export const SENTENCES = [
  "the quick brown fox jumps over the lazy dog.",
  "a big black bear sat on a log by the lake.",
  "my cat likes to sleep in the warm sun.",
  "we can fly a kite on a windy day.",
  "the frog hid under a green leaf.",
  "seven owls sat in a tall old tree.",
  "pack my box with five dozen jugs.",
  "she sells sea shells by the sea shore.",
  "the zebra ran to the river for a drink.",
  "do not feed the fish too much food.",
]

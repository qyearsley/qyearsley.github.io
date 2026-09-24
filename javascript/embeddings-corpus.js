/**
 * embeddings-corpus.js
 *
 * A small built-in English corpus for the "How Embeddings Work" page, plus
 * the cluster labels used to color the scatter plot and check that nearest
 * neighbors land in the expected group.
 *
 * Earlier drafts of this corpus gave every word in a cluster the exact same
 * six sentence frames, with nothing else. That made every animal (or every
 * food, or every verb) a perfect distributional twin of its cluster-mates --
 * cosine similarity 1.0000, all landing on the same point -- which is a
 * degenerate result, not a demonstration. This version gives every word:
 *
 * - its own handful of sentences, describing what actually makes it
 *   different from its cluster-mates ("the cat purrs on the windowsill",
 *   "the dog fetches the ball"), so a cat and a dog are similar without
 *   being identical
 * - a few sentences from a shared per-cluster pool, but a random subset of
 *   them at a random repeat count -- not the full set at the same count for
 *   every word -- so cluster membership is still the dominant shared
 *   signal, and word frequency varies the way it does in real text
 *
 * The corpus is built by a seeded PRNG (mulberry32, the same one used in
 * maze-generator.js, reimplemented here so this module has no dependency on
 * that page), so "random" here means "reproducible," not "different every
 * load."
 *
 * The royalty/people cluster gets its gender signal from pronouns rather
 * than a stated rule: "king", "prince", "man", and "lord" all appear next to
 * "he", while "queen", "princess", "woman", and "lady" appear next to "she"
 * -- the way gender shows up in real text, not as an explicit "a king is a
 * kind of man" sentence written to make one analogy come out a certain way.
 * `embeddings.js`'s default stopword list deliberately keeps "he"/"she" in
 * the vocabulary so this signal survives into the co-occurrence counts.
 * King/prince share royal content (crown, throne, council) that man/lord
 * don't, and queen/princess share the same royal content that woman/lady
 * don't -- so the corpus has both a gender axis (pronouns) and a status axis
 * (royal vs. common), which is what an analogy like "king - man + woman"
 * needs to have any chance of finding "queen." Whether it actually does is
 * reported on the page itself, not asserted here.
 */

/**
 * A tiny seeded PRNG (mulberry32: 32-bit state, one multiply-xorshift round
 * per value) so the corpus is reproducible without `Math.random`.
 *
 * @param {number} seed
 * @returns {() => number} Returns a function producing floats in [0, 1).
 */
function createRng(seed) {
  let state = seed >>> 0
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A deterministic integer in [min, max], inclusive. */
function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1))
}

/** A deterministic in-place-free shuffle (Fisher-Yates). */
function shuffled(array, rng) {
  const copy = [...array]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randInt(rng, 0, i)
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** Fixed seed: the corpus is the same every time it's built. */
const CORPUS_SEED = 20260924

const CLUSTERS = [
  {
    name: "animals",
    label: "Animals",
    words: ["dog", "cat", "lion", "tiger", "bird", "fish", "horse", "wolf"],
    ownSentences: {
      dog: [
        "The dog barks at strangers by the gate.",
        "The dog fetches the ball in the yard.",
        "The dog chews on an old bone.",
        "The dog wags its tail when it's happy.",
        "The dog guards the house all night.",
      ],
      cat: [
        "The cat purrs on the windowsill.",
        "The cat chases mice through the yard.",
        "The cat drinks warm milk from a bowl.",
        "The cat naps in a sunny spot.",
        "The cat scratches the old wooden post.",
      ],
      lion: [
        "The lion roars across the open plain.",
        "The lion hunts together with its pride.",
        "The lion naps in the shade all afternoon.",
        "The lion has a thick golden mane.",
        "The lion stalks its prey at dusk.",
      ],
      tiger: [
        "The tiger prowls through the tall jungle grass.",
        "The tiger hunts alone under the night sky.",
        "The tiger has bold orange and black stripes.",
        "The tiger swims easily across the river.",
        "The tiger guards its territory fiercely.",
      ],
      bird: [
        "The bird sings loudly at dawn.",
        "The bird builds a nest high in the tree.",
        "The bird flies south before winter arrives.",
        "The bird eats seeds from the feeder.",
        "The bird perches quietly on the fence.",
      ],
      fish: [
        "The fish swims in a large school.",
        "The fish breathes through its gills.",
        "The fish hides among the river reeds.",
        "The fish eats tiny plankton all day.",
        "The fish lives in the cold mountain pond.",
      ],
      horse: [
        "The horse gallops across the open field.",
        "The horse eats hay in the barn.",
        "The horse pulls the wooden cart to town.",
        "The horse wears a worn leather saddle.",
        "The horse trots slowly down the lane.",
      ],
      wolf: [
        "The wolf howls at the full moon.",
        "The wolf hunts together with the rest of its pack.",
        "The wolf roams deep into the forest.",
        "The wolf guards its den at the base of the hill.",
        "The wolf prowls quietly at dusk.",
      ],
    },
    sharedFrames: [
      "The {w} lives near the old farm.",
      "People often see a {w} in the countryside.",
      "An old story once mentioned a {w}.",
      "Everyone in town was curious about the {w}.",
    ],
  },
  {
    name: "foods",
    label: "Foods",
    words: ["bread", "rice", "cheese", "soup", "apple", "meat", "milk", "honey"],
    ownSentences: {
      bread: [
        "The bread is baked fresh every morning.",
        "The bread is sliced thin for sandwiches.",
        "The bread rises slowly with yeast.",
        "The bread goes stale after about a week.",
        "The bread is spread with soft butter.",
      ],
      rice: [
        "The rice is boiled in a heavy pot.",
        "The rice grows in flooded paddies.",
        "The rice is served with steamed vegetables.",
        "The rice comes in several different varieties.",
        "The rice is a staple in many countries.",
      ],
      cheese: [
        "The cheese is aged slowly in a cool cellar.",
        "The cheese melts over the hot pasta.",
        "The cheese is made from fresh milk.",
        "The cheese pairs well with red wine.",
        "The cheese is sliced thin for the tray.",
      ],
      soup: [
        "The soup simmers gently on the stove.",
        "The soup is served hot in the winter.",
        "The soup is made with a rich broth.",
        "The soup warms you up on cold nights.",
        "The soup is ladled carefully into bowls.",
      ],
      apple: [
        "The apple grows on a tall, old tree.",
        "The apple is picked fresh from the orchard.",
        "The apple is sliced thin into the pie.",
        "The apple has a crisp, sweet bite.",
        "The apple comes in shades of red and green.",
      ],
      meat: [
        "The meat is grilled slowly over the fire.",
        "The meat is seasoned with strong spices.",
        "The meat is a good source of protein.",
        "The meat is cut carefully by the butcher.",
        "The meat is roasted for Sunday dinner.",
      ],
      milk: [
        "The milk is poured over morning cereal.",
        "The milk comes fresh from the dairy.",
        "The milk is kept cold in the fridge.",
        "The milk is used to make soft cheese.",
        "The milk is a common breakfast drink.",
      ],
      honey: [
        "The honey is made slowly by bees.",
        "The honey is drizzled warm over toast.",
        "The honey is stored in a glass jar.",
        "The honey is harvested from the hive.",
        "The honey sweetens the afternoon tea.",
      ],
    },
    sharedFrames: [
      "The {w} was fresh at the store today.",
      "She bought some {w} for the week.",
      "The recipe called for a bit more {w}.",
      "The {w} was kept in the kitchen.",
    ],
  },
  {
    name: "royalty",
    label: "Royalty and people",
    words: ["king", "queen", "prince", "princess", "man", "woman", "lord", "lady"],
    ownSentences: {
      king: [
        "The king ruled the kingdom, and he was fair to his people.",
        "The king wore a golden crown at the ceremony.",
        "The king met with his council, for he trusted their advice.",
        "The king declared a holiday, and he opened the castle gates.",
        "Before the battle, the king said he would defend the land.",
      ],
      queen: [
        "The queen ruled the kingdom, and she was fair to her people.",
        "The queen wore a golden crown at the ceremony.",
        "The queen met with her council, for she trusted their advice.",
        "The queen declared a holiday, and she opened the castle gates.",
        "Before the battle, the queen said she would defend the land.",
      ],
      prince: [
        "The prince trained with a sword, for he hoped to rule one day.",
        "The prince will inherit the throne when he comes of age.",
        "The prince studied history, and he asked many questions.",
        "The prince rode through town, and he waved at the crowd.",
        "The young prince practiced his manners before the feast.",
      ],
      princess: [
        "The princess trained with a bow, for she hoped to rule one day.",
        "The princess will inherit the throne when she comes of age.",
        "The princess studied history, and she asked many questions.",
        "The princess rode through town, and she waved at the crowd.",
        "The young princess practiced her manners before the feast.",
      ],
      man: [
        "The man walked into the shop, and he bought some bread.",
        "The man fixed the fence, for he was handy with tools.",
        "The man read the newspaper, and he sipped his coffee.",
        "The man worked in the field until he was tired.",
        "The man greeted his neighbor, and he waved from the porch.",
      ],
      woman: [
        "The woman walked into the shop, and she bought some bread.",
        "The woman fixed the fence, for she was handy with tools.",
        "The woman read the newspaper, and she sipped her coffee.",
        "The woman worked in the field until she was tired.",
        "The woman greeted her neighbor, and she waved from the porch.",
      ],
      lord: [
        "The lord managed the estate, for he cared about his tenants.",
        "The lord hosted a dinner, and he welcomed his guests.",
        "The lord rode across his land, and he inspected the crops.",
        "The lord collected the taxes, though he disliked the task.",
        "The old lord retired to the countryside, and he rarely traveled.",
      ],
      lady: [
        "The lady managed the estate, for she cared about her tenants.",
        "The lady hosted a dinner, and she welcomed her guests.",
        "The lady rode across her land, and she inspected the crops.",
        "The lady collected the taxes, though she disliked the task.",
        "The old lady retired to the countryside, and she rarely traveled.",
      ],
    },
    sharedFrames: [
      "The {w} lived in the region for many years.",
      "People in town spoke well of the {w}.",
      "An old story mentioned a {w} from long ago.",
      "Everyone in town knew the {w}.",
    ],
  },
  {
    name: "places",
    label: "Places",
    words: ["castle", "palace", "forest", "river", "village", "market", "kingdom", "field"],
    ownSentences: {
      castle: [
        "The castle has tall stone towers.",
        "The castle is surrounded by a wide moat.",
        "The castle was built many centuries ago.",
        "The castle has a great hall for feasts.",
        "The castle overlooks the quiet valley below.",
      ],
      palace: [
        "The palace has polished marble floors.",
        "The palace hosts grand royal banquets.",
        "The palace has many walled gardens.",
        "The palace was designed by a famous architect.",
        "The palace glows with lanterns at night.",
      ],
      forest: [
        "The forest is full of tall pines.",
        "The forest hides many kinds of animals.",
        "The forest has a long, winding trail.",
        "The forest grows thick with soft moss.",
        "The forest is quiet in the early morning.",
      ],
      river: [
        "The river flows down from the mountains.",
        "The river is home to many kinds of fish.",
        "The river floods every spring.",
        "The river is crossed by an old stone bridge.",
        "The river winds slowly through the valley.",
      ],
      village: [
        "The village has a small market square.",
        "The village is home to a few hundred people.",
        "The village has narrow cobblestone streets.",
        "The village holds a festival every summer.",
        "The village is surrounded by open farmland.",
      ],
      market: [
        "The market sells fresh vegetables every day.",
        "The market is busy on Saturday mornings.",
        "The market has rows of small wooden stalls.",
        "The market smells of spices and fresh bread.",
        "The market closes just before sunset.",
      ],
      kingdom: [
        "The kingdom stretches across many hills.",
        "The kingdom is protected by trained soldiers.",
        "The kingdom has a long and storied history.",
        "The kingdom trades goods with its neighbors.",
        "The kingdom is ruled from the capital city.",
      ],
      field: [
        "The field is planted with golden wheat.",
        "The field is plowed early every spring.",
        "The field stretches all the way to the horizon.",
        "The field is grazed by a small herd of cattle.",
        "The field turns golden brown in autumn.",
      ],
    },
    sharedFrames: [
      "The {w} was quiet in the early morning.",
      "They traveled to the {w} together.",
      "News spread quickly through the {w}.",
      "A small festival was held near the {w}.",
    ],
  },
  {
    name: "verbs",
    label: "Verbs",
    words: ["run", "eat", "sleep", "walk", "buy", "cook", "travel", "rule"],
    ownSentences: {
      run: [
        "People run in the park every morning.",
        "She likes to run before breakfast.",
        "He can run faster than most of his friends.",
        "They run to catch the early bus.",
        "The children run around the yard for hours.",
      ],
      eat: [
        "People eat lunch together around noon.",
        "She likes to eat fresh fruit for a snack.",
        "He can eat an entire pizza by himself.",
        "They eat dinner as a family every night.",
        "The children eat slowly at the dinner table.",
      ],
      sleep: [
        "People sleep about eight hours a night.",
        "She likes to sleep late on weekends.",
        "He can sleep through almost any noise.",
        "They sleep in separate rooms upstairs.",
        "The children sleep soundly after a long day.",
      ],
      walk: [
        "People walk to work across the city.",
        "She likes to walk along the beach at dawn.",
        "He can walk for miles without stopping.",
        "They walk the dog every single evening.",
        "The children walk to school together.",
      ],
      buy: [
        "People buy groceries every Friday afternoon.",
        "She likes to buy fresh flowers for the table.",
        "He can buy the tickets online in advance.",
        "They buy small gifts for the holidays.",
        "The children buy candy with their allowance.",
      ],
      cook: [
        "People cook dinner together after work.",
        "She likes to cook with fresh herbs from the garden.",
        "He can cook a full meal in under an hour.",
        "They cook a big meal together every weekend.",
        "The children cook simple recipes with some help.",
      ],
      travel: [
        "People travel to see family over the holidays.",
        "She likes to travel to new cities each summer.",
        "He can travel light with just one small bag.",
        "They travel by train more often than by car.",
        "The children travel with their parents every year.",
      ],
      rule: [
        "Good leaders rule with careful, patient judgment.",
        "She helped rule the small province for years.",
        "He learned to rule with patience and care.",
        "They rule the region together as equals.",
        "The council helped rule the growing city.",
      ],
    },
    sharedFrames: [
      "It takes practice to {w} well.",
      "Many people learn to {w} as children.",
      "She decided to {w} again the next day.",
      "He will try to {w} again tomorrow.",
    ],
  },
]

/**
 * Builds the corpus: every word's own sentences (used once each), plus a
 * random subset of its cluster's shared frames at a random repeat count.
 * Deterministic for a given seed.
 *
 * @param {number} [seed]
 * @returns {string[]}
 */
function buildCorpus(seed = CORPUS_SEED) {
  const rng = createRng(seed)
  const sentences = []

  for (const cluster of CLUSTERS) {
    for (const word of cluster.words) {
      sentences.push(...cluster.ownSentences[word])

      // A random subset of the shared frames (at least half), each repeated
      // a random number of times -- so every word in a cluster shares some
      // context with its cluster-mates, but not the same amount of it.
      const frameCount = randInt(
        rng,
        Math.ceil(cluster.sharedFrames.length / 2),
        cluster.sharedFrames.length,
      )
      const chosenFrames = shuffled(cluster.sharedFrames, rng).slice(0, frameCount)
      for (const frame of chosenFrames) {
        const repeats = randInt(rng, 1, 3)
        for (let r = 0; r < repeats; r += 1) sentences.push(frame.replace("{w}", word))
      }
    }
  }

  return sentences
}

/** The built-in corpus: a few hundred short sentences, deterministically generated. */
const CORPUS_SENTENCES = buildCorpus()

/**
 * Maps each cluster's word to its cluster name, e.g. `"dog" -> "animals"`.
 * Words that appear only inside a frame (like "field" as a place, or a
 * pronoun like "he") are not included -- only the words a cluster was built
 * around.
 *
 * @returns {Map<string, string>}
 */
function buildWordClusterMap() {
  const map = new Map()
  for (const cluster of CLUSTERS) {
    for (const word of cluster.words) map.set(word, cluster.name)
  }
  return map
}

/** `word -> cluster name`, for coloring the plot and checking neighbors. */
const WORD_CLUSTER = buildWordClusterMap()

export { CLUSTERS, CORPUS_SENTENCES, WORD_CLUSTER, createRng, buildCorpus }

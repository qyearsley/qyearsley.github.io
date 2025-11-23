/**
 * Word Bank - Curated word lists for Word Quest
 * Organized by difficulty level and skill type
 */
export class WordBank {
  constructor() {
    this.words = {
      // EXPLORER LEVEL (K-1st Grade)
      explorer: {
        // Simple CVC words
        cvc: [
          "cat",
          "dog",
          "sun",
          "pig",
          "bat",
          "hat",
          "red",
          "sit",
          "top",
          "bug",
          "can",
          "run",
          "hot",
          "big",
          "fun",
          "wet",
          "pen",
          "box",
          "fox",
          "ten",
          "man",
          "map",
          "cup",
          "bed",
          "leg",
          "bag",
          "sad",
          "net",
          "pot",
          "rug",
          "zip",
          "jam",
          "hen",
          "log",
          "six",
          "mix",
          "van",
          "gas",
          "win",
          "yes",
          "bus",
          "jet",
          "pin",
          "hit",
          "mom",
          "dad",
          "kid",
          "web",
          "mud",
          "gum",
        ],

        // 2-letter words
        twoLetter: [
          "at",
          "it",
          "an",
          "in",
          "on",
          "to",
          "up",
          "go",
          "no",
          "so",
          "my",
          "is",
          "as",
          "be",
          "or",
        ],

        // Word families
        wordFamilies: {
          at: ["cat", "bat", "hat", "rat", "mat", "sat", "fat", "pat"],
          et: ["bet", "get", "let", "pet", "wet", "met", "net", "set", "vet"],
          ig: ["big", "dig", "fig", "pig", "wig", "jig", "rig"],
          op: ["hop", "mop", "pop", "top", "cop", "stop", "shop", "drop"],
          ug: ["bug", "dug", "hug", "mug", "rug", "tug", "jug", "pug"],
          an: ["can", "fan", "man", "pan", "ran", "tan", "van", "ban"],
          en: ["den", "hen", "men", "pen", "ten", "when", "then"],
          in: ["bin", "fin", "pin", "sin", "tin", "win", "thin", "chin"],
          ot: ["cot", "dot", "got", "hot", "lot", "not", "pot", "rot"],
          un: ["bun", "fun", "gun", "run", "sun", "spun"],
        },

        // Pre-primer Dolch sight words
        sightWords: [
          "a",
          "and",
          "away",
          "big",
          "blue",
          "can",
          "come",
          "down",
          "find",
          "for",
          "funny",
          "go",
          "help",
          "here",
          "I",
          "in",
          "is",
          "it",
          "jump",
          "little",
          "look",
          "make",
          "me",
          "my",
          "not",
          "one",
          "play",
          "red",
          "run",
          "said",
          "see",
          "the",
          "three",
          "to",
          "two",
          "up",
          "we",
          "where",
          "yellow",
          "you",
        ],

        // Pictures for word-image matching
        pictureWords: {
          cat: "🐱",
          dog: "🐶",
          sun: "☀️",
          pig: "🐷",
          bat: "🦇",
          hat: "🎩",
          red: "🔴",
          cup: "☕",
          bed: "🛏️",
          bug: "🐛",
          box: "📦",
          fox: "🦊",
          pen: "🖊️",
          top: "🔝",
          run: "🏃",
          sit: "🪑",
          hot: "🔥",
          big: "🦣",
          fun: "🎉",
          wet: "💧",
          net: "🥅",
          pot: "🫖",
          rug: "🧶",
          can: "🥫",
          man: "👨",
          map: "🗺️",
          leg: "🦵",
          bag: "👜",
          sad: "😢",
        },
      },

      // ADVENTURER LEVEL (1st-2nd Grade)
      adventurer: {
        // CVC words (more advanced)
        cvc: [
          "trip",
          "snap",
          "flag",
          "drum",
          "frog",
          "skip",
          "glad",
          "crab",
          "clap",
          "plan",
          "plug",
          "sled",
          "swim",
          "twin",
          "blend",
        ],

        // CVCe words (magic e)
        cvce: [
          "make",
          "bike",
          "hope",
          "huge",
          "cake",
          "like",
          "home",
          "time",
          "name",
          "take",
          "ride",
          "cone",
          "rope",
          "tune",
          "same",
          "mile",
          "bone",
          "tube",
          "game",
          "five",
          "nose",
          "mule",
          "safe",
          "nine",
          "hole",
          "rude",
          "bake",
          "kite",
          "note",
          "cute",
          "lake",
          "line",
          "dome",
          "dune",
          "fame",
          "hire",
          "vote",
          "fuse",
          "wave",
          "pine",
          "zone",
          "mute",
        ],

        // Digraphs (ch, sh, th, wh)
        digraphs: [
          "shop",
          "chat",
          "that",
          "when",
          "ship",
          "chin",
          "with",
          "what",
          "fish",
          "chop",
          "then",
          "wish",
          "shed",
          "chip",
          "this",
          "shut",
          "math",
          "rush",
          "chill",
          "path",
          "dash",
          "shack",
          "check",
          "thank",
          "whip",
          "flash",
          "chess",
          "thick",
          "shell",
          "much",
        ],

        // Word families (more advanced)
        wordFamilies: {
          ake: ["make", "bake", "cake", "take", "wake", "shake", "brake", "lake", "rake", "sake"],
          ide: ["hide", "ride", "side", "wide", "slide", "bride", "tide", "pride"],
          one: ["bone", "cone", "tone", "zone", "phone", "stone", "alone"],
          ute: ["mute", "flute", "lute", "brute"],
          ain: ["rain", "pain", "main", "train", "brain", "chain", "gain", "plain"],
          eat: ["beat", "heat", "meat", "seat", "treat", "wheat", "neat", "cheat"],
          ine: ["line", "mine", "pine", "wine", "shine", "spine", "fine", "dine"],
          oke: ["joke", "poke", "woke", "smoke", "stroke", "broke"],
        },

        // Initial blends
        blends: [
          "black",
          "blue",
          "brag",
          "brick",
          "club",
          "clap",
          "flag",
          "flip",
          "glad",
          "glow",
          "plan",
          "plus",
          "crab",
          "crop",
          "drag",
          "drip",
          "frog",
          "free",
          "grab",
          "grin",
          "snack",
          "snap",
          "skip",
          "skin",
          "stamp",
          "step",
          "swim",
          "swing",
          "truck",
          "trip",
        ],

        // Primer + 1st grade Dolch sight words
        sightWords: [
          "all",
          "am",
          "are",
          "at",
          "ate",
          "be",
          "black",
          "brown",
          "but",
          "came",
          "did",
          "do",
          "eat",
          "four",
          "get",
          "good",
          "have",
          "he",
          "into",
          "like",
          "must",
          "new",
          "no",
          "now",
          "on",
          "our",
          "out",
          "please",
          "pretty",
          "ran",
          "ride",
          "saw",
          "say",
          "she",
          "so",
          "soon",
          "that",
          "there",
          "they",
          "this",
          "too",
          "under",
          "want",
          "was",
          "well",
          "went",
          "what",
          "white",
          "who",
          "will",
          "with",
          "yes",
        ],

        // Pictures for word-image matching
        pictureWords: {
          bike: "🚲",
          cake: "🎂",
          home: "🏠",
          fish: "🐟",
          ship: "🚢",
          rain: "🌧️",
          train: "🚂",
          frog: "🐸",
          flag: "🚩",
          make: "🔨",
          time: "⏰",
          ride: "🎠",
          cone: "🍦",
          rope: "🪢",
          bone: "🦴",
          game: "🎮",
          five: "5️⃣",
          nose: "👃",
          safe: "🔒",
          nine: "9️⃣",
          hole: "🕳️",
          black: "⬛",
          blue: "🔵",
          club: "♣️",
          snap: "📸",
          skip: "⏭️",
          swim: "🏊",
          truck: "🚚",
          trip: "✈️",
          drum: "🥁",
        },
      },

      // MASTER LEVEL (2nd-3rd Grade)
      master: {
        // Multi-syllable words
        multiSyllable: [
          "rabbit",
          "napkin",
          "pencil",
          "basket",
          "window",
          "button",
          "happen",
          "kitten",
          "puppet",
          "pumpkin",
          "problem",
          "napkin",
          "plastic",
          "cactus",
          "dentist",
          "helmet",
          "sunset",
          "picnic",
          "fabric",
          "magnet",
          "muffin",
          "blanket",
          "chicken",
          "sister",
          "brother",
          "sandwich",
          "dragon",
          "winter",
          "summer",
          "garden",
          "silver",
          "traffic",
          "market",
          "carpet",
          "lantern",
        ],

        // Complex vowel patterns
        complexPatterns: [
          "night",
          "light",
          "fight",
          "right",
          "bright",
          "could",
          "would",
          "should",
          "thought",
          "bought",
          "caught",
          "taught",
          "rain",
          "pain",
          "train",
          "boat",
          "coat",
          "float",
          "coin",
          "join",
          "point",
          "boy",
          "toy",
          "enjoy",
        ],

        // r-controlled vowels
        rControlled: [
          "car",
          "far",
          "star",
          "park",
          "dark",
          "her",
          "term",
          "fern",
          "bird",
          "girl",
          "first",
          "third",
          "for",
          "born",
          "corn",
          "storm",
          "turn",
          "burn",
          "hurt",
          "nurse",
        ],

        // Words with prefixes/suffixes
        prefixSuffix: [
          "unhappy",
          "redo",
          "replay",
          "preview",
          "jumped",
          "jumping",
          "bigger",
          "biggest",
          "walking",
          "walked",
          "player",
          "teacher",
          "careful",
          "helpful",
          "slowly",
          "quickly",
          "unpack",
          "repay",
          "softly",
          "sadly",
        ],

        // Silent letters
        silentLetters: [
          "knee",
          "knife",
          "know",
          "knock",
          "write",
          "wrong",
          "wrap",
          "lamb",
          "climb",
          "comb",
          "thumb",
        ],

        // 2nd-3rd grade Dolch + common words
        sightWords: [
          "always",
          "around",
          "because",
          "been",
          "before",
          "best",
          "both",
          "buy",
          "call",
          "cold",
          "does",
          "don't",
          "fast",
          "first",
          "five",
          "found",
          "gave",
          "goes",
          "green",
          "its",
          "made",
          "many",
          "off",
          "or",
          "pull",
          "read",
          "right",
          "sing",
          "sit",
          "sleep",
          "tell",
          "their",
          "these",
          "those",
          "upon",
          "us",
          "use",
          "very",
          "wash",
          "which",
          "why",
          "wish",
          "work",
          "would",
          "write",
          "your",
        ],

        // Homophones for advanced spelling
        homophones: {
          there: ["there", "their", "they're"],
          to: ["to", "too", "two"],
          your: ["your", "you're"],
          its: ["its", "it's"],
        },

        // Pictures for word-image matching
        pictureWords: {
          rabbit: "🐰",
          pencil: "✏️",
          basket: "🧺",
          window: "🪟",
          button: "🔘",
          kitten: "🐱",
          puppet: "🎭",
          pumpkin: "🎃",
          sunset: "🌅",
          picnic: "🧺",
          magnet: "🧲",
          night: "🌙",
          light: "💡",
          train: "🚂",
          boat: "⛵",
          coin: "🪙",
          star: "⭐",
          car: "🚗",
          bird: "🐦",
          girl: "👧",
          corn: "🌽",
          storm: "⛈️",
          nurse: "👩‍⚕️",
          knee: "🦵",
          knife: "🔪",
          write: "✍️",
          climb: "🧗",
          thumb: "👍",
        },
      },
    }

    // Letter sounds for phonics activities
    this.letterSounds = {
      consonants: {
        b: "/b/ as in bat",
        c: "/k/ as in cat",
        d: "/d/ as in dog",
        f: "/f/ as in fish",
        g: "/g/ as in goat",
        h: "/h/ as in hat",
        j: "/j/ as in jump",
        k: "/k/ as in kite",
        l: "/l/ as in lion",
        m: "/m/ as in moon",
        n: "/n/ as in nest",
        p: "/p/ as in pig",
        q: "/kw/ as in queen",
        r: "/r/ as in run",
        s: "/s/ as in sun",
        t: "/t/ as in top",
        v: "/v/ as in van",
        w: "/w/ as in web",
        x: "/ks/ as in box",
        y: "/y/ as in yes",
        z: "/z/ as in zoo",
      },
      shortVowels: {
        a: "/ă/ as in cat",
        e: "/ĕ/ as in bed",
        i: "/ĭ/ as in sit",
        o: "/ŏ/ as in hot",
        u: "/ŭ/ as in cup",
      },
      longVowels: {
        a: "/ā/ as in cake",
        e: "/ē/ as in see",
        i: "/ī/ as in bike",
        o: "/ō/ as in home",
        u: "/ū/ as in mute",
      },
    }
  }

  /**
   * Get words for a specific difficulty and type
   * @param {string} difficulty - "explorer", "adventurer", or "master"
   * @param {string} type - Type of words to retrieve
   * @returns {Array} Array of words
   */
  getWords(difficulty, type) {
    if (!this.words[difficulty] || !this.words[difficulty][type]) {
      return []
    }
    return this.words[difficulty][type]
  }

  /**
   * Get a random word from a specific category
   * @param {string} difficulty - Difficulty level
   * @param {string} type - Word type
   * @param {Array} exclude - Words to exclude
   * @returns {string} Random word
   */
  getRandomWord(difficulty, type, exclude = []) {
    const words = this.getWords(difficulty, type)
    const available = words.filter((word) => !exclude.includes(word))
    if (available.length === 0) return words[0]
    return available[Math.floor(Math.random() * available.length)]
  }

  /**
   * Get words from a specific word family
   * @param {string} difficulty - Difficulty level
   * @param {string} family - Word family suffix (e.g., "at", "ake")
   * @returns {Array} Array of words in that family
   */
  getWordFamily(difficulty, family) {
    if (!this.words[difficulty]?.wordFamilies?.[family]) {
      return []
    }
    return this.words[difficulty].wordFamilies[family]
  }

  /**
   * Get all word families for a difficulty level
   * @param {string} difficulty - Difficulty level
   * @returns {Object} Object with family names as keys
   */
  getAllWordFamilies(difficulty) {
    return this.words[difficulty]?.wordFamilies || {}
  }

  /**
   * Get sight words for a difficulty level
   * @param {string} difficulty - Difficulty level
   * @param {number} count - Number of words to return (optional)
   * @returns {Array} Array of sight words
   */
  getSightWords(difficulty, count = null) {
    const words = this.getWords(difficulty, "sightWords")
    if (count === null) return words
    return words.slice(0, count)
  }

  /**
   * Get a picture emoji for a word
   * @param {string} difficulty - Difficulty level
   * @param {string} word - The word
   * @returns {string|null} Emoji or null if not available
   */
  getPictureForWord(difficulty, word) {
    return this.words[difficulty]?.pictureWords?.[word] || null
  }

  /**
   * Check if a word has a picture available
   * @param {string} difficulty - Difficulty level
   * @param {string} word - The word
   * @returns {boolean} True if picture is available
   */
  hasPicture(difficulty, word) {
    return this.getPictureForWord(difficulty, word) !== null
  }
}

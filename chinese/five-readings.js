// Data and pure helpers for the "One Character, Five Readings" page
// (chinese/five-readings.html).
//
// Each character shows its reading in Mandarin, Cantonese, Japanese
// (on'yomi), Korean, and Sino-Vietnamese, grouped by which Middle Chinese
// final it illustrates -- see GROUPS for the explanation shown per group.
//
// Romanization used throughout: Hanyu Pinyin (Mandarin), Jyutping
// (Cantonese), Hepburn (Japanese), Revised Romanization plus Hangul
// (Korean), and Quoc Ngu (Vietnamese).
//
// Source: none yet. The readings were written from memory and have not been
// checked against Unihan (kMandarin, kCantonese, kJapaneseOn, kHangul,
// kVietnamese). The least certain: the Cantonese tones for 骨, 立, 音 and 北,
// and Korean 六 and 立, given here in their surface forms 육 and 입 rather
// than the dictionary forms 륙 and 립.
"use strict"

/**
 * @typedef {object} ReadingGroup
 * @property {string} id
 * @property {string} label - Short label, e.g. "-k".
 * @property {string} note - Explanation shown on the page for this group.
 */

/** @type {ReadingGroup[]} */
export const GROUPS = [
  {
    id: "k",
    label: "-k",
    note: "Middle Chinese checked-tone syllables ending in -k. Mandarin dropped the final stop; Cantonese, Korean, and Vietnamese still close the syllable with it. Japanese on'yomi approximates it with a trailing -ku/-oku, since Japanese doesn't allow a syllable to end in a bare stop.",
  },
  {
    id: "t",
    label: "-t",
    note: "Same pattern, with an original final -t. Cantonese and Vietnamese keep the -t; Korean turns it into -l (일, 팔, 골), so it still closes the syllable, but not with a stop. Japanese fills it in with -chi/-tsu.",
  },
  {
    id: "p",
    label: "-p",
    note: "Same pattern again, with an original final -p -- the rarest of the three checked endings among common characters. Cantonese, Korean, and Vietnamese still close the lips on it; Japanese represents it with a trailing -u (historically -fu).",
  },
  {
    id: "m",
    label: "-m merges into -n",
    note: "Middle Chinese kept a nasal -m distinct from -n. Mandarin merged the two, so these characters now end in -n, indistinguishable from characters that were always -n. Cantonese, Korean, and Vietnamese still keep -m separate. Japanese merged -m into -n on its own, centuries ago, so it doesn't preserve the distinction either.",
  },
  {
    id: "n",
    label: "-n (control group)",
    note: "A control group: these already ended in -n in Middle Chinese, so every language here agrees. Compare with the -m group above: Mandarin can't tell the two groups apart by ear, but Cantonese, Korean, and Vietnamese can.",
  },
]

/**
 * @typedef {object} CharacterReading
 * @property {string} hanzi
 * @property {string} meaning
 * @property {string} group - A GROUPS id.
 * @property {string} mandarin - Hanyu Pinyin.
 * @property {string} cantonese - Jyutping.
 * @property {string} japanese - Hepburn on'yomi.
 * @property {{hangul: string, romanization: string}} korean - Revised Romanization.
 * @property {string} vietnamese - Quoc Ngu.
 */

/** @type {CharacterReading[]} */
export const CHARACTERS = [
  // -k
  {
    hanzi: "學",
    meaning: "study, learn",
    group: "k",
    mandarin: "xué",
    cantonese: "hok6",
    japanese: "gaku",
    korean: { hangul: "학", romanization: "hak" },
    vietnamese: "học",
  },
  {
    hanzi: "六",
    meaning: "six",
    group: "k",
    mandarin: "liù",
    cantonese: "luk6",
    japanese: "roku",
    korean: { hangul: "육", romanization: "yuk" },
    vietnamese: "lục",
  },
  {
    hanzi: "國",
    meaning: "country",
    group: "k",
    mandarin: "guó",
    cantonese: "gwok3",
    japanese: "koku",
    korean: { hangul: "국", romanization: "guk" },
    vietnamese: "quốc",
  },
  {
    hanzi: "木",
    meaning: "wood, tree",
    group: "k",
    mandarin: "mù",
    cantonese: "muk6",
    japanese: "moku",
    korean: { hangul: "목", romanization: "mok" },
    vietnamese: "mộc",
  },
  {
    hanzi: "白",
    meaning: "white",
    group: "k",
    mandarin: "bái",
    cantonese: "baak6",
    japanese: "haku",
    korean: { hangul: "백", romanization: "baek" },
    vietnamese: "bạch",
  },
  {
    hanzi: "北",
    meaning: "north",
    group: "k",
    mandarin: "běi",
    cantonese: "bak1",
    japanese: "hoku",
    korean: { hangul: "북", romanization: "buk" },
    vietnamese: "bắc",
  },

  // -t
  {
    hanzi: "日",
    meaning: "sun, day",
    group: "t",
    mandarin: "rì",
    cantonese: "jat6",
    japanese: "nichi",
    korean: { hangul: "일", romanization: "il" },
    vietnamese: "nhật",
  },
  {
    hanzi: "一",
    meaning: "one",
    group: "t",
    mandarin: "yī",
    cantonese: "jat1",
    japanese: "ichi",
    korean: { hangul: "일", romanization: "il" },
    vietnamese: "nhất",
  },
  {
    hanzi: "八",
    meaning: "eight",
    group: "t",
    mandarin: "bā",
    cantonese: "baat3",
    japanese: "hachi",
    korean: { hangul: "팔", romanization: "pal" },
    vietnamese: "bát",
  },
  {
    hanzi: "骨",
    meaning: "bone",
    group: "t",
    mandarin: "gǔ",
    cantonese: "gwat1",
    japanese: "kotsu",
    korean: { hangul: "골", romanization: "gol" },
    vietnamese: "cốt",
  },

  // -p
  {
    hanzi: "十",
    meaning: "ten",
    group: "p",
    mandarin: "shí",
    cantonese: "sap6",
    japanese: "jū",
    korean: { hangul: "십", romanization: "sip" },
    vietnamese: "thập",
  },
  {
    hanzi: "入",
    meaning: "enter",
    group: "p",
    mandarin: "rù",
    cantonese: "jap6",
    japanese: "nyū",
    korean: { hangul: "입", romanization: "ip" },
    vietnamese: "nhập",
  },
  {
    hanzi: "立",
    meaning: "stand",
    group: "p",
    mandarin: "lì",
    cantonese: "laap6",
    japanese: "ritsu",
    korean: { hangul: "입", romanization: "ip" },
    vietnamese: "lập",
  },

  // -m (merges into -n in Mandarin)
  {
    hanzi: "三",
    meaning: "three",
    group: "m",
    mandarin: "sān",
    cantonese: "saam1",
    japanese: "san",
    korean: { hangul: "삼", romanization: "sam" },
    vietnamese: "tam",
  },
  {
    hanzi: "心",
    meaning: "heart, mind",
    group: "m",
    mandarin: "xīn",
    cantonese: "sam1",
    japanese: "shin",
    korean: { hangul: "심", romanization: "sim" },
    vietnamese: "tâm",
  },
  {
    hanzi: "金",
    meaning: "gold, metal",
    group: "m",
    mandarin: "jīn",
    cantonese: "gam1",
    japanese: "kin",
    korean: { hangul: "금", romanization: "geum" },
    vietnamese: "kim",
  },
  {
    hanzi: "南",
    meaning: "south",
    group: "m",
    mandarin: "nán",
    cantonese: "naam4",
    japanese: "nan",
    korean: { hangul: "남", romanization: "nam" },
    vietnamese: "nam",
  },
  {
    hanzi: "音",
    meaning: "sound",
    group: "m",
    mandarin: "yīn",
    cantonese: "jam1",
    japanese: "on",
    korean: { hangul: "음", romanization: "eum" },
    vietnamese: "âm",
  },

  // -n (control group -- already -n in Middle Chinese)
  {
    hanzi: "人",
    meaning: "person",
    group: "n",
    mandarin: "rén",
    cantonese: "jan4",
    japanese: "jin",
    korean: { hangul: "인", romanization: "in" },
    vietnamese: "nhân",
  },
  {
    hanzi: "天",
    meaning: "sky, heaven",
    group: "n",
    mandarin: "tiān",
    cantonese: "tin1",
    japanese: "ten",
    korean: { hangul: "천", romanization: "cheon" },
    vietnamese: "thiên",
  },
  {
    hanzi: "山",
    meaning: "mountain",
    group: "n",
    mandarin: "shān",
    cantonese: "saan1",
    japanese: "san",
    korean: { hangul: "산", romanization: "san" },
    vietnamese: "sơn",
  },
]

/**
 * Finds a character record by its hanzi.
 * @param {string} hanzi
 * @returns {CharacterReading | undefined}
 */
export function findCharacter(hanzi) {
  return CHARACTERS.find((c) => c.hanzi === hanzi)
}

/**
 * Finds a group definition by id.
 * @param {string} groupId
 * @returns {ReadingGroup | undefined}
 */
export function findGroup(groupId) {
  return GROUPS.find((g) => g.id === groupId)
}

/**
 * Returns all characters belonging to a group, in table order. Returns an
 * empty array for an unknown group id, rather than throwing.
 * @param {string} groupId
 * @returns {CharacterReading[]}
 */
export function charactersInGroup(groupId) {
  return CHARACTERS.filter((c) => c.group === groupId)
}

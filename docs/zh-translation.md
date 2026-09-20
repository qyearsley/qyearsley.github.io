# Chinese Translation Review

The conventions the Chinese pages follow, and what the 2026-09-20 review found.

Read this before writing or editing any `*.zh.json`. The mechanics of the
pipeline are in [`translations.md`](translations.md); this file is about the
Chinese itself.

## Conventions

Settled 2026-09-20. **Write mainland-standard Simplified Chinese.** Where a term
has a Taiwan or Hong Kong form and a mainland form, use the mainland one.

|     | Rule                         | Do                        | Not         |
| --- | ---------------------------- | ------------------------- | ----------- |
| 1   | Script                       | Simplified                | Traditional |
| 2   | Quotation marks              | “ ”                       | 「 」       |
| 3   | Parentheses around Chinese   | （ ）                     | ( )         |
| 4   | Em-dash aside                | ——                        | — or -      |
| 5   | Latin or numerals beside CJK | No space (`ASCII用1字节`) | Space       |
| 6   | Comma, colon, semicolon      | ，：；                    | , : ;       |

Rule 5 has one exception: keep the space when the Latin run is a filename or a
code span, where the gap aids reading. Everything else runs together. The
corpus was 200 unspaced against 28 spaced when this was settled.

Rule 1 has one exception, and it is the important one. **Keep a traditional form
when the form itself is the subject.** On `homophones.html` the sentence
"后 is used to write 後" is about those two glyphs, so simplifying 後 would
destroy the example. But on `buddhist-vocabulary.html` the cited Buddhist terms
-- 覺者, 菩薩, 觀世音 -- are cited for their _wording_, not their script, so the
Chinese page writes 觉者, 菩萨, 观世音. The test: if simplifying the character
makes the sentence say something false, keep it; otherwise simplify.

A consequence worth knowing: the English page cites those terms in traditional
and the Chinese page now renders them simplified, so the two versions show
different glyphs for the same term. That is deliberate.

### Choosing a word

- **Use the same Chinese word for the same English word**, across every file. The
  audit found the two game pages using different words for the same three
  buttons.
- **`_title` is long and descriptive; link text is short.** `真值表生成器` in the
  title, `真值表` in a link. Both are correct, and that is the rule.
- **汉字 for a Chinese character, 字符 for a codepoint.** `字符` is right on the
  encoding pages and wrong when the subject is Chinese writing.
- **数列 for a mathematical sequence, 序列 for a CS sequence.** A series is
  `数列各项之和`.
- **Do not calque.** `在那里` for a relative "where", `它` for an inanimate
  antecedent across a sentence break, and `角色` for a byte's "role" are all
  translationese. Chinese drops the pronoun.

### Terms this site has settled on

|     | English            | Chinese         | Note                                            |
| --- | ------------------ | --------------- | ----------------------------------------------- |
| 1   | cellular automaton | 元胞自动机      | Mainland standard. `细胞` is the Taiwan/HK form |
| 2   | diacritic          | 变音符号        | Unicode uses `组合变音符号`. Not `声调符号`     |
| 3   | diphthong          | 复元音          | See the ruling below -- `复韵母` would be wrong |
| 4   | biconditional      | 双条件          | `等价` names a metalanguage relation            |
| 5   | transliteration    | 音译            | Paired with `意译`, never `義譯`                |
| 6   | Explorer (a tool)  | 查看器 / 探索器 | `浏览器` means a web browser                    |
| 7   | legacy (encoding)  | 旧式            | `传统中文` means Traditional Chinese            |

When you introduce a term not in that table, check whether another file already
renders it, and match.

## What the review found

Five agents reviewed all 27 files -- 659 keys, about 11,400 Chinese characters.
Four read one section each against its English source; the fifth read the whole
corpus for consistency, which is the only way to see a term rendered two ways in
two files.

**No fidelity errors in `buddhist-vocabulary`**, the newest and most culturally
loaded page. Every historical claim survived translation. The errors were
elsewhere.

### Confirmed errors, all fixed 2026-09-20

|     | File                 | Was                      | Problem                                                                                                       |
| --- | -------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| 1   | `encoding-explorer`  | 1980年的**传统中文**编码 | "Legacy" became "Traditional Chinese", in a sentence that then says 简体汉字. GB2312 is a simplified standard |
| 2   | `zh-common`          | 寿命计算器               | "Lifespan calculator", a death predictor. The tool counts elapsed age                                         |
| 3   | `password-generator` | 十六进制（32**位**）     | 位 reads as bit. The preset makes 32 characters, 128 bits                                                     |
| 4   | `cellular-automata`  | **可计算**的行为         | The fixed term for "computable". English says "computation-capable"                                           |
| 5   | `syllabary`          | **每个**音有多个字可选   | English says "most sounds". False for several syllables                                                       |
| 6   | `homophones`         | 必须**重新**学会区分     | "Learn again". These are distinctions a simplified-only reader never had                                      |
| 7   | `resume`             | 改进告警算法，助力发现…  | Two bullets lost their whole value clause                                                                     |
| 8   | `life-garden`        | 棋盘                     | Chessboard, for a meadow grid. The same file uses 网格                                                        |
| 9   | `life-garden`        | 一分为二，吃饱后就分裂   | A split key rendered the verb twice                                                                           |

Error 1 is the one to remember. It is the failure mode of a translation that
reads fluently: nothing looks wrong until you notice the sentence contradicts
itself.

### Consistency fixed at the same time

- The two game pages used different words for Play, Step and Clear. Unified on
  Turing Tape's wording, which was the correct set.
- "How It Works" had three renderings across eight files. Standardised on
  `工作原理`.
- `buddhist-vocabulary` wrote the same term in both scripts three times over --
  `五种/五種不翻`, `顺古/順古`, `音译/音譯`. All simplified now.
- `javascript/` used 「 」 while `chinese/` used “ ”. All “ ” now.
- `life-garden` was the only file spacing numerals against Chinese.
- `See also` was copied identically into eight files. Promoted to
  `zh-common.json`.

### The shadow-key trap

Three page files defined a key that `zh-common.json` also defines, with a
different value. `build.js` merges as `{...common, ...pageT}`, so **the page
value wins and nothing warns.** That is how `chinese/index.html` kept showing
`字符转换` and `编码浏览器` after both were changed in the shared file, and how
`life-calculator` showed `寿命计算器` while every other page showed `活了多久`.

Check for it after any edit to `zh-common.json`:

```bash
node -e '
const c=require("./zh-common.json");
for (const f of require("child_process").execSync("git ls-files \"*.zh.json\"",{encoding:"utf8"}).trim().split("\n")) {
  const j=require("./"+f);
  for (const k in j) if (!k.startsWith("_") && k in c && c[k]!==j[k])
    console.log(f, k, c[k], "vs", j[k]);
}'
```

An exact duplicate is not a bug today but is the same trap waiting: an edit to
the shared value will not reach the page. Keep the shared file the only
definition.

## Rulings on doubtful renderings

Kept after review. Recorded so they are not re-litigated.

**`复元音` for "diphthong" -- and `复韵母` would be an error.** The obvious
correction is wrong. Chinese pedagogy usually says `复韵母`, but the page's own
examples include `iên = yan`, `uan = wan` and `uen = wen`, which are `鼻韵母`,
not `复韵母`. Switching would make the rule false for three of the listed cases.
`复元音` describes the vowel nucleus, which is what the English sentence is
about.

**`双条件` for "Biconditional" -- and `等价` would be worse.** `等价` is logical
equivalence, a metalanguage relation between formulas. The page's connective is
object-language, and its own truth-table tool makes that distinction visible.

**`变音符号` for "diacritic".** It replaced `声调符号`, which was wrong: the
circumflex on ê and the umlaut on ü are not tone marks.

**`最小正数` for "smallest".** It says more than the English, deliberately.
5e-324 is the smallest positive subnormal, and a bare `最小` cannot stand as a
Chinese label beside buttons reading `Infinity` and `NaN`.

**`空格` for the spacebar.** Translating a key _name_ is right, even though the
literal `R` and `1`--`4` caps stay English. Chinese keyboards often leave the bar
unlabelled, so there is no printed English word to match against.

## Open questions

|     | Question                                                       | Size |
| --- | -------------------------------------------------------------- | ---- |
| 1   | The essay writes `義譯` where the standard term is `意譯`      | S    |
| 2   | `叶昆廷` in the body, `Quinten Yearsley` in all 26 page titles | S    |
| 3   | `四季` does not read as a game name                            | S    |
| 4   | Runtime-rendered English on `/zh/` pages                       | M    |

On question 1: `義` simplifies to `义`, not `意`, so `義譯` and `意译` are
different words rather than script variants. `義譯` does occur in Buddhological
writing, so it may be deliberate. The Chinese now uses `意译` consistently; the
English is unchanged, pending a decision.

On question 2: a reader sees `叶昆廷` in the page header and `Quinten Yearsley`
in the browser tab. Either is defensible; the split is not.

These are tracked in [`improvements.md`](improvements.md).

## Running the review again

Two checks are mechanical, and worth running before asking anyone to read
Chinese:

```bash
npm test          # the coverage ratchet, __tests__/zh-coverage.test.js
node build.js     # warns on any key that matches nothing
```

The ratchet counts English text nodes per page and fails when a page goes
backwards or beats its baseline. It does not judge Chinese. For that, give a
reviewer one section, the English source beside the translation, and ask for
severities rather than prose -- `WRONG` for a meaning error, `TERM` for
terminology, `REGISTER`, `AWKWARD`, `NIT`. Ask separately for a whole-corpus
consistency pass; a per-section reviewer cannot see a term rendered two ways in
two directories.

**The Chinese has still never been read by a native speaker.** Five model
reviews found nine real errors, which is worth having, and is not the same
thing.

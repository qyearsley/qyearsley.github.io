/**
 * Tests for tradsimp.js - Traditional to Simplified Chinese converter.
 */

import { simplify, traditionalize } from "./tradsimp.js"

describe("simplify", () => {
  test("converts traditional characters to simplified", () => {
    expect(simplify("電腦")).toBe("电脑")
    expect(simplify("學習")).toBe("学习")
    expect(simplify("資訊")).toBe("资讯")
  })

  test("leaves simplified characters unchanged", () => {
    expect(simplify("电脑")).toBe("电脑")
    expect(simplify("学习")).toBe("学习")
  })

  test("handles mixed traditional and simplified", () => {
    expect(simplify("學习电腦")).toBe("学习电脑")
  })

  test("leaves unknown characters unchanged", () => {
    expect(simplify("abc123")).toBe("abc123")
    expect(simplify("中国")).toBe("中国") // Already simplified.
  })

  test("handles empty string", () => {
    expect(simplify("")).toBe("")
  })

  test("preserves non-Chinese characters", () => {
    expect(simplify("Hello 世界!")).toBe("Hello 世界!")
    expect(simplify("數字123")).toBe("数字123")
  })

  test("handles long text", () => {
    const input = "這個網站提供電腦資訊"
    const expected = "这个网站提供电脑资讯"
    expect(simplify(input)).toBe(expected)
  })

  test("handles common punctuation", () => {
    expect(simplify("你好，世界！")).toBe("你好，世界！")
  })
})

describe("simplify 著", () => {
  // 著 has two readings. As the aspect particle it becomes 着; in the zhù
  // sense ("write", "notable") it stays 著. Both directions are tested here,
  // so that a fix for one cannot silently break the other.

  test("keeps 著 in the zhù sense", () => {
    expect(simplify("著名")).toBe("著名")
    expect(simplify("著作")).toBe("著作")
    expect(simplify("著述")).toBe("著述")
    expect(simplify("著者")).toBe("著者")
    expect(simplify("顯著")).toBe("显著")
    expect(simplify("土著")).toBe("土著")
  })

  test("converts 著 to 着 as the aspect particle", () => {
    expect(simplify("看著")).toBe("看着")
    expect(simplify("穿著")).toBe("穿着")
    expect(simplify("拿著")).toBe("拿着")
    expect(simplify("笑著")).toBe("笑着")
    expect(simplify("睡著")).toBe("睡着")
  })

  test("converts a bare 著 to 着", () => {
    expect(simplify("著")).toBe("着")
  })

  test("converts 著 in the zhuó sense", () => {
    expect(simplify("著手")).toBe("着手")
    expect(simplify("著涼")).toBe("着凉")
  })

  test("handles both senses of 著 in one string", () => {
    expect(simplify("他寫著一本著名的著作")).toBe("他写着一本著名的著作")
  })

  test("matches zhù words inside longer text", () => {
    expect(simplify("世界名著")).toBe("世界名著")
    expect(simplify("這本原著很顯著")).toBe("这本原著很显著")
  })
})

describe("simplify 乾 and 麼", () => {
  test("converts 乾 to 干", () => {
    expect(simplify("乾淨")).toBe("干净")
    expect(simplify("乾燥")).toBe("干燥")
    expect(simplify("餅乾")).toBe("饼干")
  })

  test("keeps 乾 in the qián sense", () => {
    expect(simplify("乾坤")).toBe("乾坤")
    expect(simplify("乾隆")).toBe("乾隆")
    expect(simplify("乾坤大挪移")).toBe("乾坤大挪移")
  })

  test("converts 麼 to 么", () => {
    expect(simplify("這麼")).toBe("这么")
    expect(simplify("什麼")).toBe("什么")
    expect(simplify("怎麼")).toBe("怎么")
  })
})

describe("simplify 後, 餘, 諮, 鍾", () => {
  // These four were either missing from the dictionary or mapped to a variant
  // character instead of the standard simplified form.

  test("converts 後 to 后", () => {
    expect(simplify("以後")).toBe("以后")
    expect(simplify("後來")).toBe("后来")
    expect(simplify("最後")).toBe("最后")
    expect(simplify("然後")).toBe("然后")
    expect(simplify("後果")).toBe("后果")
  })

  test("leaves the empress 后 alone", () => {
    expect(simplify("皇后")).toBe("皇后")
    expect(simplify("太后")).toBe("太后")
  })

  test("converts 餘 to 余, not to the 馀 variant", () => {
    expect(simplify("其餘")).toBe("其余")
    expect(simplify("業餘")).toBe("业余")
    expect(simplify("餘額")).toBe("余额")
  })

  test("converts 諮 to 咨, not to the 谘 variant", () => {
    expect(simplify("諮詢")).toBe("咨询")
    expect(simplify("咨文")).toBe("咨文")
  })

  test("converts 鍾 to 钟, not to the 锺 variant", () => {
    expect(simplify("鍾情")).toBe("钟情")
  })

  test("still converts 鐘 to 钟", () => {
    expect(simplify("鐘錶")).toBe("钟表")
    expect(simplify("一分鐘")).toBe("一分钟")
  })

  test("converts 囉 to 啰, not to the 罗 of 羅", () => {
    expect(simplify("囉嗦")).toBe("啰嗦")
    expect(simplify("羅馬")).toBe("罗马")
  })

  test("converts 鍊 by word, because it is two characters", () => {
    expect(simplify("項鍊")).toBe("项链")
    expect(simplify("鍛鍊")).toBe("锻炼")
  })

  test("converts 瞭 by word, because it is two characters", () => {
    expect(simplify("瞭解")).toBe("了解")
    expect(simplify("一目瞭然")).toBe("一目了然")
    expect(simplify("瞭望")).toBe("瞭望")
  })
})

describe("traditionalize", () => {
  test("converts simplified characters to traditional", () => {
    expect(traditionalize("电脑")).toBe("電腦")
    expect(traditionalize("学习")).toBe("學習")
  })

  test("converts 着 back to 著", () => {
    expect(traditionalize("着")).toBe("著")
    expect(traditionalize("看着")).toBe("看著")
  })

  test("converts 么 back to 麼", () => {
    expect(traditionalize("这么")).toBe("這麼")
  })

  test("leaves unknown characters unchanged", () => {
    expect(traditionalize("abc123")).toBe("abc123")
    expect(traditionalize("")).toBe("")
  })
})

describe("traditionalize 后", () => {
  test("converts 后 to 後 by default", () => {
    expect(traditionalize("以后")).toBe("以後")
    expect(traditionalize("后来")).toBe("後來")
    expect(traditionalize("最后")).toBe("最後")
    expect(traditionalize("然后")).toBe("然後")
    expect(traditionalize("后果")).toBe("後果")
  })

  test("keeps 后 for the empress", () => {
    expect(traditionalize("皇后")).toBe("皇后")
    expect(traditionalize("太后")).toBe("太后")
    expect(traditionalize("王后")).toBe("王后")
    expect(traditionalize("后宫")).toBe("后宮")
  })

  test("keeps 后 inside a longer title", () => {
    expect(traditionalize("皇太后")).toBe("皇太后")
  })
})

describe("traditionalize 余", () => {
  // 余 has no safe default: it is both the simplification of 餘 and a surname
  // written 余 in traditional. Known 餘 words convert; everything else is left
  // alone rather than guessed at.

  test("converts known 餘 words", () => {
    expect(traditionalize("其余")).toBe("其餘")
    expect(traditionalize("业余")).toBe("業餘")
    expect(traditionalize("剩余")).toBe("剩餘")
    expect(traditionalize("余额")).toBe("餘額")
  })

  test("leaves a bare 余 alone, so surnames survive", () => {
    expect(traditionalize("余")).toBe("余")
    expect(traditionalize("余光中")).toBe("余光中")
  })
})

describe("traditionalize 咨, 钟, 了", () => {
  test("converts 咨 to 諮 for the consult sense", () => {
    expect(traditionalize("咨询")).toBe("諮詢")
  })

  test("keeps 咨 for 咨文", () => {
    expect(traditionalize("咨文")).toBe("咨文")
  })

  test("converts 钟 to 鐘 by default", () => {
    expect(traditionalize("钟表")).toBe("鐘錶")
    expect(traditionalize("一分钟")).toBe("一分鐘")
    expect(traditionalize("闹钟")).toBe("鬧鐘")
  })

  test("converts 钟 to 鍾 for the affection sense", () => {
    expect(traditionalize("钟情")).toBe("鍾情")
    expect(traditionalize("钟爱")).toBe("鍾愛")
  })

  test("leaves the particle 了 alone", () => {
    expect(traditionalize("好了")).toBe("好了")
    expect(traditionalize("来了")).toBe("來了")
    expect(traditionalize("了解")).toBe("了解")
  })
})

describe("traditionalize 干", () => {
  // 干 stands for three traditional characters, so it needs entries for two of
  // them and a default for the third.

  test("converts 干 to 幹 by default", () => {
    expect(traditionalize("干活")).toBe("幹活")
    expect(traditionalize("树干")).toBe("樹幹")
    expect(traditionalize("干部")).toBe("幹部")
  })

  test("converts 干 to 乾 for the dry sense", () => {
    expect(traditionalize("干净")).toBe("乾淨")
    expect(traditionalize("干燥")).toBe("乾燥")
    expect(traditionalize("干杯")).toBe("乾杯")
    expect(traditionalize("饼干")).toBe("餅乾")
  })

  test("keeps 干 for the interfere sense", () => {
    expect(traditionalize("干扰")).toBe("干擾")
    expect(traditionalize("干涉")).toBe("干涉")
    expect(traditionalize("若干")).toBe("若干")
  })
})

describe("round trip", () => {
  // simplify and traditionalize are not exact inverses, because several
  // traditional characters share one simplified character. These cases do
  // round trip, and are worth holding still.

  test("returns the original for one-to-one characters", () => {
    for (const word of ["電腦", "學習", "資訊", "這麼"]) {
      expect(traditionalize(simplify(word))).toBe(word)
    }
  })

  test("returns the original for words the exception lists protect", () => {
    const words = [
      "著名",
      "著作",
      "乾坤",
      "乾隆",
      "乾淨",
      "餅乾",
      "皇后",
      "以後",
      "其餘",
      "業餘",
      "諮詢",
      "咨文",
      "鍾情",
      "鐘錶",
    ]
    for (const word of words) {
      expect(traditionalize(simplify(word))).toBe(word)
    }
  })

  test("does not round trip where the mapping is many-to-one", () => {
    // 髮 and 發 both simplify to 发, so only the first one comes back. There
    // are about 20 more pairs like this; see the comment on traditionalWords.
    expect(simplify("頭髮")).toBe("头发")
    expect(traditionalize("头发")).toBe("頭發")
  })
})

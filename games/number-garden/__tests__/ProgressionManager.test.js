import { ProgressionManager } from "../js/ProgressionManager.js"

describe("ProgressionManager", () => {
  let progression

  beforeEach(() => {
    progression = new ProgressionManager()
  })

  describe("initialization", () => {
    test("initializes with area themes", () => {
      expect(progression.areaThemes).toBeDefined()
      expect(progression.areaThemes["flower-meadow"]).toBeDefined()
      expect(progression.areaThemes["crystal-cave"]).toBeDefined()
      expect(progression.areaThemes["enchanted-forest"]).toBeDefined()
    })

    test("flower-meadow theme has correct stages", () => {
      const theme = progression.areaThemes["flower-meadow"]

      expect(theme.progressionType).toBe("color")
      expect(theme.stages).toHaveLength(5)
      expect(theme.stages[0].percent).toBe(0)
      expect(theme.stages[4].percent).toBe(100)
      expect(theme.decorations).toBeDefined()
    })

    test("crystal-cave theme has correct stages", () => {
      const theme = progression.areaThemes["crystal-cave"]

      expect(theme.progressionType).toBe("glow")
      expect(theme.stages).toHaveLength(5)
      expect(theme.decorations).toContain("💎")
    })

    test("enchanted-forest theme has correct stages", () => {
      const theme = progression.areaThemes["enchanted-forest"]

      expect(theme.progressionType).toBe("depth")
      expect(theme.stages).toHaveLength(5)
      expect(theme.decorations).toContain("🌿")
      expect(theme.decorations).toContain("🍄")
    })
  })

  describe("getAreaThemes", () => {
    test("returns all area themes", () => {
      const themes = progression.getAreaThemes()

      expect(themes).toBe(progression.areaThemes)
      expect(Object.keys(themes)).toContain("flower-meadow")
      expect(Object.keys(themes)).toContain("crystal-cave")
    })
  })

  describe("getTheme", () => {
    test("returns theme for valid area", () => {
      const theme = progression.getTheme("flower-meadow")

      expect(theme).toBeDefined()
      expect(theme.progressionType).toBe("color")
    })

    test("returns null for invalid area", () => {
      const theme = progression.getTheme("nonexistent-area")

      expect(theme).toBeNull()
    })
  })

  describe("theme colors", () => {
    // WCAG relative luminance, then the contrast ratio against white
    // (luminance 1.0). Kept local to the test so a colour tweak that makes
    // heading text unreadable fails here instead of shipping.
    const relativeLuminance = (hex) => {
      const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      const [r, g, b] = channels.map((c) =>
        c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
      )
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const contrastOnWhite = (hex) => 1.05 / (relativeLuminance(hex) + 0.05)

    test("relative luminance helper matches known reference values", () => {
      // Sanity check on the helper itself: pure black is 21:1 on white, and
      // white is 1:1.
      expect(contrastOnWhite("#000000")).toBeCloseTo(21, 1)
      expect(contrastOnWhite("#ffffff")).toBeCloseTo(1, 2)
    })

    test("every area theme defines primary, accent, and ink colors", () => {
      const themes = Object.values(progression.getAreaThemes())
      expect(themes).toHaveLength(6)

      themes.forEach((theme) => {
        expect(theme.primaryColor).toMatch(/^#[0-9a-f]{6}$/i)
        expect(theme.accentColor).toMatch(/^#[0-9a-f]{6}$/i)
        expect(theme.inkColor).toMatch(/^#[0-9a-f]{6}$/i)
      })
    })

    // inkColor is used for heading text on the light page background, so it has
    // to clear WCAG AA for normal text. primaryColor is decorative and is
    // deliberately not held to this bar.
    test("every inkColor clears 4.5:1 against white", () => {
      // Collect failures so the message names the offending area and its ratio.
      const tooLight = Object.entries(progression.getAreaThemes())
        .map(([areaId, theme]) => [areaId, contrastOnWhite(theme.inkColor)])
        .filter(([, ratio]) => ratio < 4.5)
        .map(([areaId, ratio]) => `${areaId}: ${ratio.toFixed(2)}:1`)

      expect(tooLight).toEqual([])
    })

    test("the two light primaries have darker ink variants", () => {
      const gold = progression.getTheme("time-temple")
      const orange = progression.getTheme("measurement-market")

      expect(gold.inkColor).not.toBe(gold.primaryColor)
      expect(orange.inkColor).not.toBe(orange.primaryColor)
      expect(contrastOnWhite(gold.primaryColor)).toBeLessThan(4.5)
      expect(contrastOnWhite(orange.primaryColor)).toBeLessThan(4.5)
      expect(contrastOnWhite(gold.inkColor)).toBeCloseTo(4.61, 2)
      expect(contrastOnWhite(orange.inkColor)).toBeCloseTo(4.6, 2)
    })
  })

  describe("theme stages", () => {
    test("stages are ordered by percent", () => {
      const theme = progression.getTheme("flower-meadow")

      for (let i = 0; i < theme.stages.length - 1; i++) {
        expect(theme.stages[i].percent).toBeLessThan(theme.stages[i + 1].percent)
      }
    })

    test("all stages have required properties", () => {
      const theme = progression.getTheme("flower-meadow")

      theme.stages.forEach((stage) => {
        expect(stage).toHaveProperty("percent")
        expect(stage).toHaveProperty("background")
        expect(stage).toHaveProperty("description")
      })
    })
  })
})

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

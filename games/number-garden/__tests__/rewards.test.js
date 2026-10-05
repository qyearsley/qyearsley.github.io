import { RewardSystem } from "../js/rewards.js"

describe("RewardSystem", () => {
  let rewardSystem

  beforeEach(() => {
    rewardSystem = new RewardSystem()
  })

  describe("initialization", () => {
    test("initializes with area rewards", () => {
      expect(rewardSystem.areaRewards).toBeDefined()
      expect(rewardSystem.areaRewards["flower-meadow"]).toBeDefined()
      expect(rewardSystem.areaRewards["crystal-cave"]).toBeDefined()
      expect(rewardSystem.areaRewards["enchanted-forest"]).toBeDefined()
    })

    test("flower-meadow has flower rewards", () => {
      const rewards = rewardSystem.areaRewards["flower-meadow"]
      expect(rewards.length).toBeGreaterThan(0)
      expect(rewards.some((r) => r.emoji === "🌹")).toBe(true)
    })

    test("crystal-cave has crystal rewards", () => {
      const rewards = rewardSystem.areaRewards["crystal-cave"]
      expect(rewards.length).toBeGreaterThan(0)
      expect(rewards.some((r) => r.emoji === "💎")).toBe(true)
    })

    test("enchanted-forest has nature rewards", () => {
      const rewards = rewardSystem.areaRewards["enchanted-forest"]
      expect(rewards.length).toBeGreaterThan(0)
      expect(rewards.some((r) => r.emoji === "🌲")).toBe(true)
      expect(rewards.some((r) => r.emoji === "🍄")).toBe(true)
    })
  })

  describe("generateFlower", () => {
    test("generates reward with all required fields", () => {
      const reward = rewardSystem.generateFlower()
      expect(reward).toHaveProperty("color")
      expect(reward).toHaveProperty("emoji")
      expect(reward).toHaveProperty("name")
      expect(reward).toHaveProperty("timestamp")
    })

    test("generates flower-meadow rewards by default", () => {
      const reward = rewardSystem.generateFlower()
      const flowerEmojis = ["🌹", "🌺", "🌻", "🪻", "💠", "🌼", "🌸", "🌷"]
      expect(flowerEmojis).toContain(reward.emoji)
    })

    test("generates crystal-cave rewards when specified", () => {
      const reward = rewardSystem.generateFlower("crystal-cave")
      const crystalEmojis = ["💎", "💠", "🔮", "🔷", "🔹", "💜", "⭐", "✨"]
      expect(crystalEmojis).toContain(reward.emoji)
    })

    test("generates enchanted-forest rewards when specified", () => {
      const reward = rewardSystem.generateFlower("enchanted-forest")
      const forestEmojis = ["🌲", "🌳", "🌴", "🎄", "🌿", "🍄", "🍃", "🪵"]
      expect(forestEmojis).toContain(reward.emoji)
    })

    test("falls back to flower-meadow for unknown area", () => {
      const reward = rewardSystem.generateFlower("unknown-area")
      const flowerEmojis = ["🌹", "🌺", "🌻", "🪻", "💠", "🌼", "🌸", "🌷"]
      expect(flowerEmojis).toContain(reward.emoji)
    })

    test("timestamp is recent", () => {
      const before = Date.now()
      const reward = rewardSystem.generateFlower()
      const after = Date.now()

      expect(reward.timestamp).toBeGreaterThanOrEqual(before)
      expect(reward.timestamp).toBeLessThanOrEqual(after)
    })
  })
})

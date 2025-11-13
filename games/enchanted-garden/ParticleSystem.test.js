import { ParticleSystem } from "../enchanted-garden/js/ParticleSystem.js"

describe("ParticleSystem", () => {
  let particleSystem
  let container

  beforeEach(() => {
    particleSystem = new ParticleSystem()
    container = document.createElement("div")
    container.id = "test-container"
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.removeChild(container)
  })

  describe("initialization", () => {
    test("initializes with default values", () => {
      expect(particleSystem.emojis).toEqual(["✨", "⭐"])
      expect(particleSystem.particleCount).toBe(5)
      expect(particleSystem.particleLifetime).toBe(2000)
      expect(particleSystem.spawnDelay).toBe(80)
    })
  })

  describe("createParticle", () => {
    test("creates particle element with correct properties", () => {
      const particle = particleSystem.createParticle(100, 200)

      expect(particle.className).toBe("particle")
      expect(particle.style.left).toBe("100px")
      expect(particle.style.top).toBe("200px")
      expect(["✨", "⭐"]).toContain(particle.textContent)
    })

    test("sets random translation", () => {
      const particle = particleSystem.createParticle(0, 0)
      const translation = particle.style.getPropertyValue("--tx")

      expect(translation).toMatch(/^-?\d+(\.\d+)?px$/)
    })
  })

  describe("createParticles", () => {
    test("creates correct number of particles", (done) => {
      particleSystem.createParticles(150, 150, container)

      // Wait for all particles to spawn
      setTimeout(() => {
        const particles = container.querySelectorAll(".particle")
        expect(particles.length).toBe(5)
        done()
      }, 500)
    })

    test("particles are removed after lifetime", (done) => {
      particleSystem.particleLifetime = 100
      particleSystem.createParticles(150, 150, container)

      // Check particles exist initially
      setTimeout(() => {
        expect(container.querySelectorAll(".particle").length).toBeGreaterThan(0)
      }, 50)

      // Check particles are removed after lifetime
      setTimeout(() => {
        expect(container.querySelectorAll(".particle").length).toBe(0)
        done()
      }, 150)
    })
  })
})

import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals"

import { ParticleSystem } from "../js/ParticleSystem.js"

describe("ParticleSystem", () => {
  let particleSystem
  let container

  beforeEach(() => {
    // Every particle is spawned and removed on a timer, so the tests below drive
    // the clock rather than waiting on it. Left on real timers this file slept
    // for about 1.8 seconds, which was almost all of its runtime.
    jest.useFakeTimers()
    particleSystem = new ParticleSystem()
    container = document.createElement("div")
    container.id = "test-container"
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.removeChild(container)
    jest.useRealTimers()
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

    test("hides decorative particles from assistive technology", () => {
      const particle = particleSystem.createParticle(0, 0)

      expect(particle.getAttribute("aria-hidden")).toBe("true")
    })

    test("sets random translation", () => {
      const particle = particleSystem.createParticle(0, 0)
      const translation = particle.style.getPropertyValue("--tx")

      expect(translation).toMatch(/^-?\d+(\.\d+)?px$/)
    })
  })

  describe("createParticles", () => {
    test("creates correct number of particles", () => {
      particleSystem.createParticles(150, 150, container)

      // Past the last spawn (4 * 80ms) but well inside the 2000ms lifetime.
      jest.advanceTimersByTime(500)

      expect(container.querySelectorAll(".particle").length).toBe(5)
    })

    test("particles are removed after lifetime", () => {
      particleSystem.particleLifetime = 100
      particleSystem.particleCount = 2
      particleSystem.spawnDelay = 20
      particleSystem.createParticles(150, 150, container)

      // Both particles have spawned (0ms and 20ms) and neither has expired.
      jest.advanceTimersByTime(30)
      expect(container.querySelectorAll(".particle").length).toBe(2)

      // The later particle spawns at 20ms and lives 100ms, so everything is
      // gone by 120ms.
      jest.advanceTimersByTime(120)
      expect(container.querySelectorAll(".particle").length).toBe(0)
    })
  })

  describe("reduced motion", () => {
    // jsdom does not implement window.matchMedia, so stub it per test.
    let queries

    beforeEach(() => {
      queries = []
    })

    afterEach(() => {
      delete window.matchMedia
    })

    const stubMatchMedia = (matches) => {
      window.matchMedia = (query) => {
        queries.push(query)
        return { matches }
      }
    }

    test("treats missing matchMedia as no preference", () => {
      expect(window.matchMedia).toBeUndefined()
      expect(particleSystem.prefersReducedMotion()).toBe(false)
    })

    test("reports the media query result", () => {
      stubMatchMedia(true)

      expect(particleSystem.prefersReducedMotion()).toBe(true)
      expect(queries).toEqual(["(prefers-reduced-motion: reduce)"])
    })

    test("creates no particles when reduced motion is preferred", () => {
      stubMatchMedia(true)
      particleSystem.createParticles(150, 150, container)

      jest.advanceTimersByTime(500)

      expect(container.querySelectorAll(".particle").length).toBe(0)
    })

    test("still creates particles when reduced motion is not preferred", () => {
      stubMatchMedia(false)
      particleSystem.createParticles(150, 150, container)

      jest.advanceTimersByTime(500)

      expect(container.querySelectorAll(".particle").length).toBe(5)
    })
  })
})

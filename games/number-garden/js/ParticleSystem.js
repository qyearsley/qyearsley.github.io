/**
 * Manages particle effects for celebrations
 */
export class ParticleSystem {
  constructor() {
    this.emojis = ["✨", "⭐"]
    this.particleCount = 5
    this.particleLifetime = 2000
    this.spawnDelay = 80
  }

  /**
   * Create particle effects at a specific location
   * @param {number} centerX - X coordinate
   * @param {number} centerY - Y coordinate
   * @param {HTMLElement} container - Container element for particles
   */
  createParticles(centerX, centerY, container) {
    for (let i = 0; i < this.particleCount; i++) {
      setTimeout(() => {
        const particle = this.createParticle(centerX, centerY)
        container.appendChild(particle)

        setTimeout(() => particle.remove(), this.particleLifetime)
      }, i * this.spawnDelay)
    }
  }

  /**
   * Create a single particle element
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {HTMLElement} Particle element
   */
  createParticle(x, y) {
    const particle = document.createElement("div")
    particle.className = "particle"
    particle.textContent = this.emojis[Math.floor(Math.random() * this.emojis.length)]
    particle.style.left = x + "px"
    particle.style.top = y + "px"
    particle.style.setProperty("--tx", (Math.random() - 0.5) * 200 + "px")
    return particle
  }
}

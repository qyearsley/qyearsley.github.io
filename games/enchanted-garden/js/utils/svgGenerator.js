/**
 * SVG generation utilities
 * Centralizes all SVG creation for visual elements
 */

export class SVGGenerator {
  /**
   * Create an analog clock SVG
   * @param {number} hour - Hour (1-12)
   * @param {number} minute - Minute (0-59)
   * @returns {string} SVG markup
   */
  static clock(hour, minute) {
    const hourAngle = ((hour % 12) * 30 + minute * 0.5) - 90
    const minuteAngle = minute * 6 - 90

    // Generate all 12 hour numbers
    const hourNumbers = Array.from({ length: 12 }, (_, i) => {
      const num = i === 0 ? 12 : i
      const angle = (i * 30 - 90) * Math.PI / 180
      const x = 60 + 40 * Math.cos(angle)
      const y = 60 + 40 * Math.sin(angle) + 5 // +5 to center text vertically
      return `<text x="${x}" y="${y}" text-anchor="middle" font-size="12" fill="#333" font-weight="bold">${num}</text>`
    }).join('')

    // Generate minute tick marks
    const tickMarks = Array.from({ length: 60 }, (_, i) => {
      const angle = (i * 6 - 90) * Math.PI / 180
      const isHourMark = i % 5 === 0
      const innerRadius = isHourMark ? 48 : 50
      const outerRadius = 52
      const x1 = 60 + innerRadius * Math.cos(angle)
      const y1 = 60 + innerRadius * Math.sin(angle)
      const x2 = 60 + outerRadius * Math.cos(angle)
      const y2 = 60 + outerRadius * Math.sin(angle)
      const width = isHourMark ? 2 : 1
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#333" stroke-width="${width}"/>`
    }).join('')

    return `
      <svg width="140" height="140" viewBox="0 0 120 120" style="display:inline-block">
        <circle cx="60" cy="60" r="55" fill="white" stroke="#333" stroke-width="3"/>
        ${tickMarks}
        ${hourNumbers}
        <!-- Hour hand -->
        <line x1="60" y1="60" x2="${60 + 30 * Math.cos(hourAngle * Math.PI / 180)}" y2="${60 + 30 * Math.sin(hourAngle * Math.PI / 180)}" stroke="#333" stroke-width="6" stroke-linecap="round"/>
        <!-- Minute hand -->
        <line x1="60" y1="60" x2="${60 + 45 * Math.cos(minuteAngle * Math.PI / 180)}" y2="${60 + 45 * Math.sin(minuteAngle * Math.PI / 180)}" stroke="#666" stroke-width="4" stroke-linecap="round"/>
        <!-- Center dot -->
        <circle cx="60" cy="60" r="4" fill="#333"/>
      </svg>
    `
  }

  /**
   * Create a ruler SVG
   * @param {number} length - Length in inches
   * @returns {string} SVG markup
   */
  static ruler(length) {
    return `
      <svg width="300" height="60" viewBox="0 0 300 60" style="display:inline-block">
        <rect x="0" y="20" width="${length * 25}" height="30" fill="none" stroke="#333" stroke-width="2"/>
        ${Array.from({ length: length + 1 }, (_, i) => `
          <line x1="${i * 25}" y1="20" x2="${i * 25}" y2="50" stroke="#333" stroke-width="2"/>
          <text x="${i * 25}" y="15" text-anchor="middle" font-size="10">${i}</text>
        `).join('')}
      </svg>
    `
  }

  /**
   * Create a scale SVG with items
   * @param {number} numItems - Number of items to show
   * @returns {string} SVG markup
   */
  static scale(numItems) {
    const apples = Array.from({ length: numItems }, (_, i) =>
      `<text x="${20 + i * 25}" y="50" font-size="30">🍎</text>`
    ).join('')

    return `
      <svg width="200" height="80" viewBox="0 0 200 80" style="display:inline-block">
        <text x="10" y="30" font-size="24">⚖️</text>
        ${apples}
      </svg>
    `
  }

  /**
   * Create cups/beakers SVG
   * @param {number} numCups - Number of cups to show
   * @returns {string} SVG markup
   */
  static cups(numCups) {
    const cups = Array.from({ length: numCups }, (_, i) =>
      `<text x="${20 + i * 35}" y="40" font-size="35">🧪</text>`
    ).join('')

    return `
      <svg width="250" height="60" viewBox="0 0 250 60" style="display:inline-block">
        ${cups}
      </svg>
    `
  }

  /**
   * Create castle SVG with progressive building
   * @param {number} pieces - Number of completed pieces (0-6)
   * @returns {string} SVG markup
   */
  static castle(pieces) {
    return `
      <svg width="400" height="400" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
        <!-- Sky background -->
        <rect width="400" height="400" fill="${pieces >= 6 ? "#87CEEB" : "#e0e0e0"}" />

        ${pieces >= 1 ? `
        <!-- Foundation -->
        <rect x="100" y="320" width="200" height="60" fill="#8B7355" stroke="#654321" stroke-width="2"/>
        ` : ""}

        ${pieces >= 2 ? `
        <!-- Main walls -->
        <rect x="120" y="220" width="160" height="100" fill="#D3D3D3" stroke="#808080" stroke-width="2"/>
        ` : ""}

        ${pieces >= 3 ? `
        <!-- Towers -->
        <rect x="80" y="180" width="60" height="140" fill="#C0C0C0" stroke="#808080" stroke-width="2"/>
        <polygon points="80,180 110,140 140,180" fill="#8B0000" stroke="#654321" stroke-width="2"/>
        <rect x="260" y="180" width="60" height="140" fill="#C0C0C0" stroke="#808080" stroke-width="2"/>
        <polygon points="260,180 290,140 320,180" fill="#8B0000" stroke="#654321" stroke-width="2"/>
        ` : ""}

        ${pieces >= 4 ? `
        <!-- Door and windows -->
        <rect x="175" y="260" width="50" height="60" fill="#654321" stroke="#4a2f1a" stroke-width="2"/>
        <circle cx="150" cy="250" r="12" fill="#FFD700" stroke="#DAA520" stroke-width="2"/>
        <circle cx="250" cy="250" r="12" fill="#FFD700" stroke="#DAA520" stroke-width="2"/>
        ` : ""}

        ${pieces >= 5 ? `
        <!-- Center tower -->
        <rect x="180" y="120" width="40" height="100" fill="#B8B8B8" stroke="#808080" stroke-width="2"/>
        <polygon points="180,120 200,80 220,120" fill="#8B0000" stroke="#654321" stroke-width="2"/>
        ` : ""}

        ${pieces >= 6 ? `
        <!-- Victory flag and sparkles -->
        <line x1="200" y1="80" x2="200" y2="50" stroke="#654321" stroke-width="3"/>
        <polygon points="200,50 240,60 200,70" fill="#FFD700" stroke="#DAA520" stroke-width="1"/>
        <text x="210" y="65" font-size="20">🏆</text>

        <!-- Sparkles all around -->
        <text x="50" y="100" font-size="30">✨</text>
        <text x="330" y="100" font-size="30">✨</text>
        <text x="70" y="300" font-size="30">⭐</text>
        <text x="310" y="300" font-size="30">⭐</text>
        <text x="200" y="30" font-size="25">🎉</text>
        ` : ""}

        ${pieces < 6 ? `
        <!-- Construction message -->
        <text x="200" y="390" text-anchor="middle" font-size="16" fill="#666" font-family="Arial">
          ${pieces}/6 pieces complete
        </text>
        ` : `
        <!-- Completion message -->
        <text x="200" y="390" text-anchor="middle" font-size="18" fill="#FFD700" font-family="Arial" font-weight="bold">
          Castle Complete! 🎊
        </text>
        `}
      </svg>
    `
  }
}

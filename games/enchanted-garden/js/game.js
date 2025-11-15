import { GameState } from "./GameState.js"
import { GameUI } from "./GameUI.js"
import { ParticleSystem } from "./ParticleSystem.js"
import { ProgressionManager } from "./ProgressionManager.js"
import { EventManager } from "./EventManager.js"
import { StorageManager } from "./storage.js"
import { RewardSystem } from "./rewards.js"
import { ActivityGenerator } from "./activities.js"

/**
 * Main game controller for Enchanted Garden
 * Orchestrates all game systems and handles game flow
 */
class EnchantedGarden {
  /**
   * Project type configuration
   * @private
   */
  static PROJECT_CONFIG = {
    castle: { icon: "🏰", title: "Build a Castle", pieceName: "Castle Piece" },
    garden: { icon: "🌻", title: "Grow a Garden", pieceName: "Garden Section" },
    robot: { icon: "🤖", title: "Build a Robot", pieceName: "Robot Part" },
    spaceship: { icon: "🚀", title: "Build a Rocket", pieceName: "Rocket Part" },
  }

  /**
   * @param {Object} options - Configuration options
   * @param {StorageManager} options.storageManager - Storage manager instance
   * @param {RewardSystem} options.rewardSystem - Reward system instance
   * @param {ActivityGenerator} options.activityGenerator - Activity generator instance
   */
  constructor({ storageManager, rewardSystem, activityGenerator } = {}) {
    // Initialize subsystems with dependency injection
    this.storageManager = storageManager || new StorageManager()
    this.rewardSystem = rewardSystem || new RewardSystem()
    this.activityGenerator = activityGenerator || new ActivityGenerator()

    this.state = new GameState(this.storageManager)
    this.ui = new GameUI()
    this.particles = new ParticleSystem()
    this.progression = new ProgressionManager()

    // Initialize event manager with callbacks
    this.events = new EventManager(this.ui, {
      onStart: () => this.showScreen("project-selection"),
      onContinue: () => this.showScreen("garden-hub"),
      onStartFresh: () => this.startFresh(),
      onBack: () => this.showScreen("garden-hub"),
      onHome: () => this.showScreen("title-screen"),
      onAreaEnter: (areaId) => this.enterArea(areaId),
      onAnswerSelected: (answer, isCorrect, button) => this.checkAnswer(isCorrect, button),
      onSettingsOpen: () => this.openSettings(),
      onSettingsClose: () => this.closeSettings(),
      onSettingChange: (key, value) => this.updateSetting(key, value),
      onCastleView: () => this.viewCastle(),
      onCastleBack: () => this.showScreen("garden-hub"),
      onProjectSelect: (projectType) => this.selectProject(projectType),
      onProjectBack: () => this.showScreen("title-screen"),
    })

    this.events.initializeEventListeners()
    this.ui.updateStats(this.state.stats)
    this.ui.updateSettingsUI(this.state.settings)
    this.ui.updateCastleBadge(this.state.getCompletedAreasCount())

    // Update project UI on load
    this.updateProjectUI()

    // Update title screen based on saved progress
    this.updateTitleScreen()

    // Handle query parameters for testing
    this.handleQueryParameters()
  }

  /**
   * Select project type
   */
  selectProject(projectType) {
    this.state.setProjectType(projectType)
    this.updateProjectUI()
    this.showScreen("garden-hub")
  }

  /**
   * Update UI to reflect selected project
   */
  updateProjectUI() {
    const info = this.getProjectInfo()

    // Update project icon in header
    const projectIconEl = document.getElementById("project-icon")
    if (projectIconEl) {
      projectIconEl.textContent = info.icon
    }

    // Update project icon in activity screen
    const activityProjectIconEl = document.getElementById("activity-project-icon")
    if (activityProjectIconEl) {
      activityProjectIconEl.textContent = info.icon
    }

    // Update project title
    const projectTitleEl = document.getElementById("project-title")
    if (projectTitleEl) {
      projectTitleEl.textContent = info.title
    }
  }

  /**
   * Update title screen buttons based on saved progress
   */
  updateTitleScreen() {
    const hasSavedProgress = this.storageManager.loadProgress() !== null
    this.ui.updateTitleButtons(hasSavedProgress)
  }

  /**
   * Start fresh (reset progress and go to garden hub)
   */
  startFresh() {
    if (confirm("Start fresh? This will reset all your progress!")) {
      this.state.resetProgress()
      this.ui.updateStats(this.state.stats)
      this.ui.updateTitleButtons(false)
      this.showScreen("garden-hub")
      console.log("🔄 Started fresh")
    }
  }

  /**
   * Handle query parameters for testing
   */
  handleQueryParameters() {
    const params = new URLSearchParams(window.location.search)

    // Unlock specific areas: ?unlock=crystal-cave or ?unlock=all
    const unlockParam = params.get("unlock")
    if (unlockParam) {
      if (unlockParam === "all") {
        this.state.unlockArea("crystal-cave")
        this.state.unlockArea("enchanted-forest")
        this.state.unlockArea("time-temple")
        this.state.unlockArea("measurement-market")
        this.state.unlockArea("pattern-path")
        console.log("🔓 All areas unlocked for testing")
      } else {
        this.state.unlockArea(unlockParam)
        console.log(`🔓 Unlocked ${unlockParam} for testing`)
      }
    }
  }

  /**
   * Open settings modal
   */
  openSettings() {
    this.ui.updateSettingsUI(this.state.settings)
    this.ui.showSettings()
  }

  /**
   * Close settings modal
   */
  closeSettings() {
    this.ui.hideSettings()
  }

  /**
   * Update a setting
   * @param {string} key - Setting key
   * @param {*} value - Setting value
   */
  updateSetting(key, value) {
    this.state.updateSetting(key, value)
  }

  /**
   * View castle screen
   */
  viewCastle() {
    const projectInfo = this.getProjectInfo()
    this.showScreen("castle-screen")
    this.ui.updateCastleScreen(projectInfo)
    this.ui.updateCastleProgress(this.state.getCompletedAreasCount(), 6)
    this.ui.displayCastlePieces(this.state.completedAreas)
    this.renderCastle()
  }

  /**
   * Render the castle SVG based on progress
   */
  renderCastle() {
    const container = this.ui.elements.castleSvgContainer
    if (!container) return

    const completed = this.state.getCompletedAreasCount()
    const projectSvg = this.createProjectSVG(completed)
    container.innerHTML = projectSvg
  }

  /**
   * Create project SVG based on project type
   * @param {number} pieces - Number of completed pieces (0-6)
   * @returns {string} SVG markup
   */
  createProjectSVG(pieces) {
    const projectType = this.state.projectType
    switch (projectType) {
      case "garden":
        return this.createGardenSVG(pieces)
      case "robot":
        return this.createRobotSVG(pieces)
      case "spaceship":
        return this.createSpaceshipSVG(pieces)
      case "castle":
      default:
        return this.createCastleSVG(pieces)
    }
  }

  /**
   * Create castle SVG with progressive building
   * @param {number} pieces - Number of completed pieces (0-6)
   * @returns {string} SVG markup
   */
  createCastleSVG(pieces) {
    // Castle SVG that builds piece by piece (6 total pieces)
    return `
      <svg width="400" height="400" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
        <!-- Sky background with gradient -->
        <defs>
          <linearGradient id="skyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:${pieces >= 6 ? "#87CEEB" : "#e8e8e8"};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${pieces >= 6 ? "#B0E0E6" : "#f0f0f0"};stop-opacity:1" />
          </linearGradient>
          <linearGradient id="stoneGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#E8E8E8;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#C0C0C0;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="roofGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#DC143C;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#8B0000;stop-opacity:1" />
          </linearGradient>
          <filter id="shadow">
            <feDropShadow dx="2" dy="4" stdDeviation="3" flood-opacity="0.3"/>
          </filter>
        </defs>

        <rect width="400" height="400" fill="url(#skyGradient)" />

        ${
          pieces >= 1
            ? `
        <!-- Foundation with texture -->
        <rect x="100" y="320" width="200" height="60" fill="#8B7355" stroke="#654321" stroke-width="3" filter="url(#shadow)"/>
        <line x1="100" y1="340" x2="300" y2="340" stroke="#654321" stroke-width="1" opacity="0.3"/>
        <line x1="100" y1="360" x2="300" y2="360" stroke="#654321" stroke-width="1" opacity="0.3"/>
        `
            : ""
        }

        ${
          pieces >= 2
            ? `
        <!-- Main walls with stone texture -->
        <rect x="120" y="220" width="160" height="100" fill="url(#stoneGradient)" stroke="#808080" stroke-width="3" filter="url(#shadow)"/>
        <!-- Stone blocks -->
        <line x1="120" y1="245" x2="280" y2="245" stroke="#A0A0A0" stroke-width="1" opacity="0.4"/>
        <line x1="120" y1="270" x2="280" y2="270" stroke="#A0A0A0" stroke-width="1" opacity="0.4"/>
        <line x1="120" y1="295" x2="280" y2="295" stroke="#A0A0A0" stroke-width="1" opacity="0.4"/>
        `
            : ""
        }

        ${
          pieces >= 3
            ? `
        <!-- Left tower -->
        <rect x="80" y="180" width="60" height="140" fill="url(#stoneGradient)" stroke="#808080" stroke-width="3" filter="url(#shadow)"/>
        <polygon points="80,180 110,140 140,180" fill="url(#roofGradient)" stroke="#654321" stroke-width="2" filter="url(#shadow)"/>
        <!-- Battlements -->
        <rect x="85" y="175" width="10" height="10" fill="#A0A0A0"/>
        <rect x="105" y="175" width="10" height="10" fill="#A0A0A0"/>
        <rect x="125" y="175" width="10" height="10" fill="#A0A0A0"/>

        <!-- Right tower -->
        <rect x="260" y="180" width="60" height="140" fill="url(#stoneGradient)" stroke="#808080" stroke-width="3" filter="url(#shadow)"/>
        <polygon points="260,180 290,140 320,180" fill="url(#roofGradient)" stroke="#654321" stroke-width="2" filter="url(#shadow)"/>
        <!-- Battlements -->
        <rect x="265" y="175" width="10" height="10" fill="#A0A0A0"/>
        <rect x="285" y="175" width="10" height="10" fill="#A0A0A0"/>
        <rect x="305" y="175" width="10" height="10" fill="#A0A0A0"/>
        `
            : ""
        }

        ${
          pieces >= 4
            ? `
        <!-- Door with arch -->
        <rect x="175" y="260" width="50" height="60" fill="#654321" stroke="#4a2f1a" stroke-width="3" rx="5" filter="url(#shadow)"/>
        <circle cx="200" cy="255" r="25" fill="#654321" stroke="#4a2f1a" stroke-width="3"/>
        <rect x="175" y="255" width="50" height="30" fill="#654321"/>
        <!-- Door details -->
        <circle cx="215" cy="285" r="3" fill="#8B7355"/>
        <line x1="200" y1="260" x2="200" y2="320" stroke="#4a2f1a" stroke-width="2"/>

        <!-- Windows with glow -->
        <circle cx="150" cy="250" r="14" fill="#FFD700" stroke="#DAA520" stroke-width="2" filter="url(#shadow)"/>
        <circle cx="150" cy="250" r="10" fill="#FFED4E" opacity="0.8"/>
        <circle cx="250" cy="250" r="14" fill="#FFD700" stroke="#DAA520" stroke-width="2" filter="url(#shadow)"/>
        <circle cx="250" cy="250" r="10" fill="#FFED4E" opacity="0.8"/>
        `
            : ""
        }

        ${
          pieces >= 5
            ? `
        <!-- Center tower (taller) -->
        <rect x="175" y="120" width="50" height="100" fill="url(#stoneGradient)" stroke="#808080" stroke-width="3" filter="url(#shadow)"/>
        <polygon points="175,120 200,75 225,120" fill="url(#roofGradient)" stroke="#654321" stroke-width="2" filter="url(#shadow)"/>
        <!-- Battlements -->
        <rect x="180" y="115" width="8" height="8" fill="#A0A0A0"/>
        <rect x="196" y="115" width="8" height="8" fill="#A0A0A0"/>
        <rect x="212" y="115" width="8" height="8" fill="#A0A0A0"/>
        <!-- Window -->
        <circle cx="200" cy="165" r="8" fill="#4A5568" stroke="#2D3748" stroke-width="2"/>
        `
            : ""
        }

        ${
          pieces >= 6
            ? `
        <!-- Victory flag with wave effect -->
        <line x1="200" y1="75" x2="200" y2="45" stroke="#654321" stroke-width="4" filter="url(#shadow)"/>
        <path d="M 200 45 Q 220 50, 240 48 Q 235 53, 240 57 Q 220 59, 200 55 Z" fill="#FFD700" stroke="#DAA520" stroke-width="2"/>
        <text x="210" y="58" font-size="16">🏆</text>

        <!-- Sparkles with glow -->
        <text x="50" y="100" font-size="35" filter="url(#shadow)">✨</text>
        <text x="330" y="100" font-size="35" filter="url(#shadow)">✨</text>
        <text x="70" y="300" font-size="35" filter="url(#shadow)">⭐</text>
        <text x="310" y="300" font-size="35" filter="url(#shadow)">⭐</text>
        <text x="190" y="25" font-size="30" filter="url(#shadow)">🎉</text>

        <!-- Rays of light -->
        <line x1="200" y1="50" x2="150" y2="20" stroke="#FFD700" stroke-width="2" opacity="0.6"/>
        <line x1="200" y1="50" x2="250" y2="20" stroke="#FFD700" stroke-width="2" opacity="0.6"/>
        <line x1="200" y1="50" x2="200" y2="10" stroke="#FFD700" stroke-width="3" opacity="0.6"/>
        `
            : ""
        }

        ${
          pieces < 6
            ? `
        <!-- Construction message -->
        <text x="200" y="390" text-anchor="middle" font-size="18" fill="#666" font-family="Arial" font-weight="bold">
          ${pieces}/6 pieces complete
        </text>
        `
            : `
        <!-- Completion message -->
        <text x="200" y="390" text-anchor="middle" font-size="20" fill="#FFD700" font-family="Arial" font-weight="bold" filter="url(#shadow)">
          Castle Complete! 🎊
        </text>
        `
        }
      </svg>
    `
  }

  /**
   * Create garden SVG with progressive growing
   * @param {number} pieces - Number of completed pieces (0-6)
   * @returns {string} SVG markup
   */
  createGardenSVG(pieces) {
    return `
      <svg width="400" height="400" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="skyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:${pieces >= 6 ? "#87CEEB" : "#e8e8e8"};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${pieces >= 6 ? "#B0E0E6" : "#f0f0f0"};stop-opacity:1" />
          </linearGradient>
          <linearGradient id="grassGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#90EE90;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#228B22;stop-opacity:1" />
          </linearGradient>
          <filter id="shadow">
            <feDropShadow dx="2" dy="4" stdDeviation="3" flood-opacity="0.3"/>
          </filter>
        </defs>

        <rect width="400" height="400" fill="url(#skyGradient)" />

        ${pieces >= 1 ? `
        <!-- Ground -->
        <ellipse cx="200" cy="360" rx="180" ry="30" fill="url(#grassGradient)" filter="url(#shadow)"/>
        <rect x="20" y="330" width="360" height="70" fill="url(#grassGradient)"/>
        ` : ""}

        ${pieces >= 2 ? `
        <!-- Sunflower (left) -->
        <line x1="100" y1="300" x2="100" y2="200" stroke="#228B22" stroke-width="6"/>
        <circle cx="100" cy="180" r="30" fill="#FFD700" filter="url(#shadow)"/>
        <circle cx="100" cy="180" r="15" fill="#8B4513"/>
        <!-- Petals -->
        ${[0, 45, 90, 135, 180, 225, 270, 315].map(angle => {
          const rad = (angle * Math.PI) / 180
          const x = 100 + Math.cos(rad) * 25
          const y = 180 + Math.sin(rad) * 25
          return `<circle cx="${x}" cy="${y}" r="10" fill="#FFA500"/>`
        }).join("")}
        ` : ""}

        ${pieces >= 3 ? `
        <!-- Rose (center-left) -->
        <line x1="150" y1="320" x2="150" y2="230" stroke="#2F4F2F" stroke-width="5"/>
        <circle cx="150" cy="215" r="20" fill="#DC143C" filter="url(#shadow)"/>
        <circle cx="150" cy="215" r="12" fill="#8B0000"/>
        <circle cx="145" cy="210" r="8" fill="#FF1493"/>
        <!-- Leaves -->
        <ellipse cx="140" cy="270" rx="15" ry="8" fill="#228B22" transform="rotate(-30 140 270)"/>
        <ellipse cx="160" cy="280" rx="15" ry="8" fill="#228B22" transform="rotate(30 160 280)"/>
        ` : ""}

        ${pieces >= 4 ? `
        <!-- Tulip (center-right) -->
        <line x1="250" y1="320" x2="250" y2="240" stroke="#2F4F2F" stroke-width="5"/>
        <ellipse cx="250" cy="225" rx="18" ry="25" fill="#FF69B4" filter="url(#shadow)"/>
        <ellipse cx="245" cy="220" rx="8" ry="15" fill="#FF1493"/>
        <ellipse cx="255" cy="220" rx="8" ry="15" fill="#FF1493"/>
        <!-- Leaves -->
        <ellipse cx="235" cy="280" rx="20" ry="10" fill="#32CD32" transform="rotate(-20 235 280)"/>
        ` : ""}

        ${pieces >= 5 ? `
        <!-- Daisy (right) -->
        <line x1="300" y1="310" x2="300" y2="220" stroke="#228B22" stroke-width="5"/>
        <circle cx="300" cy="205" r="20" fill="white" filter="url(#shadow)"/>
        <circle cx="300" cy="205" r="8" fill="#FFD700"/>
        <!-- White petals -->
        ${[0, 60, 120, 180, 240, 300].map(angle => {
          const rad = (angle * Math.PI) / 180
          const x = 300 + Math.cos(rad) * 18
          const y = 205 + Math.sin(rad) * 18
          return `<ellipse cx="${x}" cy="${y}" rx="7" ry="12" fill="white" transform="rotate(${angle} ${x} ${y})"/>`
        }).join("")}
        ` : ""}

        ${pieces >= 6 ? `
        <!-- Butterflies and sparkles -->
        <text x="50" y="100" font-size="40">🦋</text>
        <text x="320" y="130" font-size="40">🦋</text>
        <text x="30" y="200" font-size="30" filter="url(#shadow)">✨</text>
        <text x="350" y="250" font-size="30" filter="url(#shadow)">✨</text>
        <text x="200" y="80" font-size="35" filter="url(#shadow)">🌈</text>

        <!-- Sun rays -->
        <circle cx="350" cy="50" r="40" fill="#FFD700" opacity="0.8"/>
        <circle cx="350" cy="50" r="30" fill="#FFA500" opacity="0.6"/>
        <line x1="350" y1="50" x2="380" y2="20" stroke="#FFD700" stroke-width="3" opacity="0.6"/>
        <line x1="350" y1="50" x2="390" y2="50" stroke="#FFD700" stroke-width="3" opacity="0.6"/>
        <line x1="350" y1="50" x2="380" y2="80" stroke="#FFD700" stroke-width="3" opacity="0.6"/>
        ` : ""}

        ${pieces < 6 ? `
        <text x="200" y="390" text-anchor="middle" font-size="18" fill="#666" font-family="Arial" font-weight="bold">
          ${pieces}/6 pieces complete
        </text>
        ` : `
        <text x="200" y="390" text-anchor="middle" font-size="20" fill="#228B22" font-family="Arial" font-weight="bold" filter="url(#shadow)">
          Garden Complete! 🌺
        </text>
        `}
      </svg>
    `
  }

  /**
   * Create robot SVG with progressive building
   * @param {number} pieces - Number of completed pieces (0-6)
   * @returns {string} SVG markup
   */
  createRobotSVG(pieces) {
    return `
      <svg width="400" height="400" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:${pieces >= 6 ? "#1a1a2e" : "#e8e8e8"};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${pieces >= 6 ? "#16213e" : "#f0f0f0"};stop-opacity:1" />
          </linearGradient>
          <linearGradient id="metalGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#E0E0E0;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#C0C0C0;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#A0A0A0;stop-opacity:1" />
          </linearGradient>
          <filter id="shadow">
            <feDropShadow dx="2" dy="4" stdDeviation="3" flood-opacity="0.3"/>
          </filter>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <rect width="400" height="400" fill="url(#bgGradient)" />

        ${pieces >= 1 ? `
        <!-- Legs -->
        <rect x="150" y="280" width="30" height="80" fill="url(#metalGradient)" stroke="#808080" stroke-width="2" rx="5" filter="url(#shadow)"/>
        <rect x="220" y="280" width="30" height="80" fill="url(#metalGradient)" stroke="#808080" stroke-width="2" rx="5" filter="url(#shadow)"/>
        <!-- Feet -->
        <rect x="140" y="350" width="50" height="20" fill="#606060" stroke="#404040" stroke-width="2" rx="8" filter="url(#shadow)"/>
        <rect x="210" y="350" width="50" height="20" fill="#606060" stroke="#404040" stroke-width="2" rx="8" filter="url(#shadow)"/>
        <!-- Joints -->
        <circle cx="165" cy="310" r="8" fill="#4A90E2" stroke="#357ABD" stroke-width="2"/>
        <circle cx="235" cy="310" r="8" fill="#4A90E2" stroke="#357ABD" stroke-width="2"/>
        ` : ""}

        ${pieces >= 2 ? `
        <!-- Body/Torso -->
        <rect x="140" y="180" width="120" height="100" fill="url(#metalGradient)" stroke="#808080" stroke-width="3" rx="10" filter="url(#shadow)"/>
        <!-- Control panel -->
        <rect x="160" y="200" width="80" height="60" fill="#2C3E50" stroke="#1A252F" stroke-width="2" rx="5"/>
        <!-- Buttons and lights -->
        <circle cx="180" cy="220" r="6" fill="#E74C3C"/>
        <circle cx="200" cy="220" r="6" fill="#F39C12"/>
        <circle cx="220" cy="220" r="6" fill="#2ECC71"/>
        <rect x="170" y="235" width="60" height="15" fill="#3498DB" rx="3"/>
        ` : ""}

        ${pieces >= 3 ? `
        <!-- Left arm -->
        <rect x="80" y="200" width="60" height="25" fill="url(#metalGradient)" stroke="#808080" stroke-width="2" rx="8" filter="url(#shadow)"/>
        <circle cx="110" cy="212" r="10" fill="#606060" stroke="#404040" stroke-width="2"/>
        <!-- Left hand/gripper -->
        <rect x="50" y="205" width="30" height="5" fill="#808080" stroke="#606060" stroke-width="1" rx="2"/>
        <rect x="50" y="220" width="30" height="5" fill="#808080" stroke="#606060" stroke-width="1" rx="2"/>

        <!-- Right arm -->
        <rect x="260" y="200" width="60" height="25" fill="url(#metalGradient)" stroke="#808080" stroke-width="2" rx="8" filter="url(#shadow)"/>
        <circle cx="290" cy="212" r="10" fill="#606060" stroke="#404040" stroke-width="2"/>
        <!-- Right hand/gripper -->
        <rect x="320" y="205" width="30" height="5" fill="#808080" stroke="#606060" stroke-width="1" rx="2"/>
        <rect x="320" y="220" width="30" height="5" fill="#808080" stroke="#606060" stroke-width="1" rx="2"/>
        ` : ""}

        ${pieces >= 4 ? `
        <!-- Neck -->
        <rect x="180" y="150" width="40" height="30" fill="#909090" stroke="#707070" stroke-width="2" rx="5" filter="url(#shadow)"/>
        ` : ""}

        ${pieces >= 5 ? `
        <!-- Head -->
        <rect x="150" y="80" width="100" height="80" fill="url(#metalGradient)" stroke="#808080" stroke-width="3" rx="15" filter="url(#shadow)"/>
        <!-- Eyes -->
        <circle cx="175" cy="110" r="15" fill="#4A90E2" filter="url(#glow)"/>
        <circle cx="175" cy="110" r="8" fill="#00FFFF"/>
        <circle cx="225" cy="110" r="15" fill="#4A90E2" filter="url(#glow)"/>
        <circle cx="225" cy="110" r="8" fill="#00FFFF"/>
        <!-- Mouth -->
        <rect x="170" y="135" width="60" height="10" fill="#2C3E50" rx="5"/>
        <!-- Antennae -->
        <line x1="175" y1="80" x2="175" y2="60" stroke="#808080" stroke-width="3"/>
        <circle cx="175" cy="55" r="6" fill="#E74C3C" filter="url(#glow)"/>
        ` : ""}

        ${pieces >= 6 ? `
        <!-- Second antenna -->
        <line x1="225" y1="80" x2="225" y2="65" stroke="#808080" stroke-width="3"/>
        <circle cx="225" cy="60" r="6" fill="#2ECC71" filter="url(#glow)"/>

        <!-- Energy effects -->
        <text x="50" y="100" font-size="30" filter="url(#shadow)">⚡</text>
        <text x="330" y="100" font-size="30" filter="url(#shadow)">⚡</text>
        <text x="70" y="300" font-size="30" filter="url(#shadow)">⭐</text>
        <text x="310" y="300" font-size="30" filter="url(#shadow)">⭐</text>

        <!-- Power indicator -->
        <circle cx="200" cy="40" r="25" fill="#FFD700" opacity="0.8" filter="url(#glow)"/>
        <text x="200" y="50" text-anchor="middle" font-size="25">💡</text>
        ` : ""}

        ${pieces < 6 ? `
        <text x="200" y="390" text-anchor="middle" font-size="18" fill="#666" font-family="Arial" font-weight="bold">
          ${pieces}/6 pieces complete
        </text>
        ` : `
        <text x="200" y="390" text-anchor="middle" font-size="20" fill="#00FFFF" font-family="Arial" font-weight="bold" filter="url(#shadow)">
          Robot Complete! 🤖
        </text>
        `}
      </svg>
    `
  }

  /**
   * Create spaceship SVG with progressive building
   * @param {number} pieces - Number of completed pieces (0-6)
   * @returns {string} SVG markup
   */
  createSpaceshipSVG(pieces) {
    return `
      <svg width="400" height="400" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="spaceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:${pieces >= 6 ? "#0a0a1a" : "#e8e8e8"};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${pieces >= 6 ? "#1a1a3e" : "#f0f0f0"};stop-opacity:1" />
          </linearGradient>
          <linearGradient id="rocketGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#E8E8E8;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#B0B0B0;stop-opacity:1" />
          </linearGradient>
          <radialGradient id="flameGradient">
            <stop offset="0%" style="stop-color:#FFD700;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#FF6B00;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#FF0000;stop-opacity:0.8" />
          </radialGradient>
          <filter id="shadow">
            <feDropShadow dx="2" dy="4" stdDeviation="3" flood-opacity="0.3"/>
          </filter>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <rect width="400" height="400" fill="url(#spaceGradient)" />

        ${pieces >= 6 ? `
        <!-- Stars in background -->
        <circle cx="50" cy="50" r="2" fill="white" opacity="0.8"/>
        <circle cx="100" cy="30" r="1.5" fill="white" opacity="0.6"/>
        <circle cx="150" cy="70" r="2" fill="white" opacity="0.9"/>
        <circle cx="320" cy="40" r="1.5" fill="white" opacity="0.7"/>
        <circle cx="350" cy="90" r="2" fill="white" opacity="0.8"/>
        <circle cx="80" cy="150" r="1" fill="white" opacity="0.6"/>
        <circle cx="330" cy="180" r="2" fill="white" opacity="0.9"/>
        <circle cx="60" cy="280" r="1.5" fill="white" opacity="0.7"/>
        <circle cx="340" cy="300" r="2" fill="white" opacity="0.8"/>
        ` : ""}

        ${pieces >= 1 ? `
        <!-- Rocket fins -->
        <polygon points="140,280 120,350 160,320" fill="#DC143C" stroke="#8B0000" stroke-width="2" filter="url(#shadow)"/>
        <polygon points="260,280 280,350 240,320" fill="#DC143C" stroke="#8B0000" stroke-width="2" filter="url(#shadow)"/>
        <!-- Center fin (back) -->
        <polygon points="200,290 200,360 220,320 180,320" fill="#B00000" stroke="#8B0000" stroke-width="2" filter="url(#shadow)"/>
        ` : ""}

        ${pieces >= 2 ? `
        <!-- Main body (lower section) -->
        <rect x="160" y="240" width="80" height="80" fill="url(#rocketGradient)" stroke="#808080" stroke-width="3" filter="url(#shadow)"/>
        <!-- Boosters -->
        <circle cx="170" cy="280" r="8" fill="#4A90E2" stroke="#357ABD" stroke-width="2"/>
        <circle cx="230" cy="280" r="8" fill="#4A90E2" stroke="#357ABD" stroke-width="2"/>
        <!-- USA text -->
        <text x="200" y="285" text-anchor="middle" font-size="14" fill="#DC143C" font-family="Arial" font-weight="bold">USA</text>
        ` : ""}

        ${pieces >= 3 ? `
        <!-- Main body (middle section) -->
        <rect x="165" y="160" width="70" height="80" fill="url(#rocketGradient)" stroke="#808080" stroke-width="3" filter="url(#shadow)"/>
        <!-- Windows -->
        <circle cx="200" cy="190" r="15" fill="#4A90E2" stroke="#2C5F8D" stroke-width="2" filter="url(#glow)"/>
        <circle cx="200" cy="190" r="12" fill="#87CEEB" opacity="0.6"/>
        <circle cx="200" cy="220" r="12" fill="#4A90E2" stroke="#2C5F8D" stroke-width="2"/>
        <circle cx="200" cy="220" r="9" fill="#87CEEB" opacity="0.6"/>
        ` : ""}

        ${pieces >= 4 ? `
        <!-- Main body (upper section) -->
        <rect x="170" y="100" width="60" height="60" fill="url(#rocketGradient)" stroke="#808080" stroke-width="3" filter="url(#shadow)"/>
        <!-- Stripe -->
        <rect x="170" y="125" width="60" height="10" fill="#DC143C"/>
        ` : ""}

        ${pieces >= 5 ? `
        <!-- Nose cone -->
        <polygon points="200,50 170,100 230,100" fill="url(#rocketGradient)" stroke="#808080" stroke-width="3" filter="url(#shadow)"/>
        <polygon points="200,50 180,85 220,85" fill="#E0E0E0"/>
        ` : ""}

        ${pieces >= 6 ? `
        <!-- Engine flames -->
        <ellipse cx="200" cy="365" rx="15" ry="25" fill="url(#flameGradient)" filter="url(#glow)"/>
        <ellipse cx="200" cy="370" rx="10" ry="20" fill="#FFD700" opacity="0.8"/>
        <ellipse cx="180" cy="345" rx="12" ry="20" fill="url(#flameGradient)" filter="url(#glow)"/>
        <ellipse cx="220" cy="345" rx="12" ry="20" fill="url(#flameGradient)" filter="url(#glow)"/>

        <!-- Smoke trail -->
        <ellipse cx="200" cy="385" rx="20" ry="10" fill="#D3D3D3" opacity="0.4"/>
        <ellipse cx="200" cy="395" rx="25" ry="8" fill="#D3D3D3" opacity="0.3"/>

        <!-- Launch effects -->
        <text x="50" y="200" font-size="30" filter="url(#shadow)">💨</text>
        <text x="330" y="200" font-size="30" filter="url(#shadow)">💨</text>
        <text x="200" y="30" font-size="35" filter="url(#shadow)">⭐</text>

        <!-- Planet in background -->
        <circle cx="80" cy="80" r="30" fill="#4A90E2" opacity="0.5"/>
        <circle cx="70" cy="75" r="8" fill="#2C5F8D" opacity="0.5"/>
        <circle cx="85" cy="90" r="6" fill="#2C5F8D" opacity="0.5"/>
        ` : ""}

        ${pieces < 6 ? `
        <text x="200" y="390" text-anchor="middle" font-size="18" fill="#666" font-family="Arial" font-weight="bold">
          ${pieces}/6 pieces complete
        </text>
        ` : `
        <text x="200" y="25" text-anchor="middle" font-size="20" fill="#FFD700" font-family="Arial" font-weight="bold" filter="url(#shadow)">
          Rocket Complete! 🚀
        </text>
        `}
      </svg>
    `
  }

  /**
   * Show a specific screen
   * @param {string} screenId - Screen identifier
   */
  showScreen(screenId) {
    this.state.setScreen(screenId)
    this.ui.showScreen(screenId)

    // Update area locks when showing garden hub
    if (screenId === "garden-hub") {
      this.ui.updateAreaLocks(this.state.unlockedAreas)
      this.ui.updateCastleBadge(this.state.getCompletedAreasCount())
    }
  }

  /**
   * Enter a garden area
   * @param {string} areaId - Area identifier
   */
  enterArea(areaId) {
    this.state.enterArea(areaId)
    this.showScreen("activity-screen")
    this.ui.updateProgressBar(
      this.state.stats.currentLevelProgress,
      this.state.settings.questionsPerLevel,
    )
    this.generateActivity()
    this.ui.renderGarden(this.state.garden)
  }

  /**
   * Generate a new activity
   */
  generateActivity() {
    this.events.resetAnswerProcessing()
    const activity = this.activityGenerator.generateActivity(
      this.state.stats.activitiesCompleted,
      this.state.currentArea,
    )
    this.state.setActivity(activity)
    this.ui.displayActivity(
      activity,
      this.state.settings.inputMode,
      this.state.settings.visualHints,
    )
  }

  /**
   * Check if answer is correct and handle result
   * @param {boolean} isCorrect - Whether answer is correct
   * @param {HTMLElement} button - The clicked button
   */
  checkAnswer(isCorrect, button) {
    this.ui.disableAnswerButtons()

    if (isCorrect) {
      this.handleCorrectAnswer(button)
    } else {
      this.handleWrongAnswer(button)
    }
  }

  /**
   * Handle correct answer
   * @param {HTMLElement} button - The clicked button
   */
  handleCorrectAnswer(button) {
    this.ui.markButtonCorrect(button)
    this.ui.showFeedback("Correct! 🌟", "correct")

    // Create celebration particles
    const center = this.ui.getButtonCenter(button)
    this.particles.createParticles(center.x, center.y, this.ui.getParticlesContainer())

    // Update game state - pass current area for area-specific rewards
    const flower = this.rewardSystem.generateFlower(this.state.currentArea)
    const levelComplete = this.state.recordCorrectAnswer(flower)

    // Update UI
    this.updateAllDisplays()

    // Handle level completion or continue
    if (levelComplete) {
      setTimeout(() => this.showLevelComplete(), 1500)
    } else {
      setTimeout(() => this.generateActivity(), 1500)
    }
  }

  /**
   * Handle wrong answer
   * @param {HTMLElement} button - The clicked button
   */
  handleWrongAnswer(button) {
    this.ui.shakeButton(button)
    this.ui.showFeedback("Try again! 💫", "encourage")

    setTimeout(() => {
      this.ui.enableAnswerButtons()
    }, 1000)
  }

  /**
   * Update all UI displays
   */
  updateAllDisplays() {
    this.ui.updateStats(this.state.stats)
    this.ui.updateProgressBar(
      this.state.stats.currentLevelProgress,
      this.state.settings.questionsPerLevel,
    )
    this.ui.updateVisualProgression(
      this.state.currentArea,
      this.progression.getAreaThemes(),
      this.state.getProgressPercent(),
    )
    this.ui.renderGarden(this.state.garden)
    this.state.saveProgress()
  }

  /**
   * Show level complete celebration
   */
  showLevelComplete() {
    const wasAreaJustCompleted =
      this.state.currentArea && !this.state.completedAreas.has(this.state.currentArea)
    const areaName = this.getAreaName(this.state.currentArea)

    this.state.completeLevel()

    // Update displays
    this.ui.updateStats(this.state.stats)
    this.ui.updateVisualProgression(
      this.state.currentArea,
      this.progression.getAreaThemes(),
      this.state.getProgressPercent(),
    )
    this.ui.renderGarden(this.state.garden)
    this.state.saveProgress()

    // Return to garden hub immediately
    this.showScreen("garden-hub")

    // Show castle piece notification if area was just completed
    if (wasAreaJustCompleted) {
      const projectInfo = this.getProjectInfo()
      setTimeout(() => {
        this.ui.showCastleNotification(areaName, this.state.getCompletedAreasCount(), projectInfo)
        this.ui.updateCastleBadge(this.state.getCompletedAreasCount())
      }, 500)
    }
  }

  /**
   * Get project information for the current project type
   * @returns {Object} Project info with icon, title, and pieceName
   */
  getProjectInfo() {
    return (
      EnchantedGarden.PROJECT_CONFIG[this.state.projectType] ||
      EnchantedGarden.PROJECT_CONFIG.castle
    )
  }

  /**
   * Get readable area name
   * @param {string} areaId - Area identifier
   * @returns {string} Area name
   */
  getAreaName(areaId) {
    const names = {
      "flower-meadow": "Flower Meadow",
      "crystal-cave": "Crystal Cave",
      "enchanted-forest": "Enchanted Forest",
      "time-temple": "Time Temple",
      "measurement-market": "Measurement Market",
      "pattern-path": "Pattern Path",
    }
    return names[areaId] || areaId
  }
}

// Initialize game when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  // Create instances with dependency injection
  const storageManager = new StorageManager()
  const rewardSystem = new RewardSystem()
  const activityGenerator = new ActivityGenerator()

  window.game = new EnchantedGarden({
    storageManager,
    rewardSystem,
    activityGenerator,
  })
})

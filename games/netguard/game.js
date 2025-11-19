import { LEVEL_ORDER } from "./levels.js"
import { GameState } from "./js/GameState.js"
import { GameUI } from "./js/GameUI.js"
import { CommandHandler } from "./js/CommandHandler.js"
import { NPCManager } from "./js/NPCManager.js"

/**
 * Main game class for NetGuard
 * Orchestrates all game subsystems and handles game flow
 */
class NetGuardGame {
  constructor() {
    // Initialize subsystems
    this.gameState = new GameState("1.0")
    this.gameUI = new GameUI()
    this.commandHandler = new CommandHandler(this.gameState, this.gameUI)
    this.npcManager = new NPCManager(this.gameState, this.gameUI)

    // Setup event listeners
    this.setupEventListeners()
    this.setupKeyboardNavigation()

    // Show level selection
    this.showLevelSelection()
  }

  /**
   * Setup event listeners for UI elements
   */
  setupEventListeners() {
    const elements = this.gameUI.elements

    // Dialog modal controls
    elements.dialogClose.addEventListener("click", () => this.npcManager.closeDialog())
    elements.dialogContinue.addEventListener("click", () => this.npcManager.closeDialog())

    // Victory modal controls
    elements.nextLevelBtn.addEventListener("click", () => this.goToNextLevel())
    elements.backToLevelsBtn.addEventListener("click", () => this.showLevelSelection())

    // Navigation controls
    elements.backButtonEl.addEventListener("click", () => this.showLevelSelection())
    elements.talkButtonEl.addEventListener("click", () => this.npcManager.talkToNPC())

    // Tool modal controls
    elements.toolClose.addEventListener("click", () => this.gameUI.closeTool())
    elements.toolExecute.addEventListener("click", () => this.commandHandler.executeTool())

    // Reset button
    elements.resetButton.addEventListener("click", () => this.resetProgress())

    // Level card clicks (delegated)
    elements.levelListEl.addEventListener("click", (e) => {
      const card = e.target.closest(".level-card")
      if (card && !card.classList.contains("locked")) {
        const levelId = LEVEL_ORDER[Array.from(elements.levelListEl.children).indexOf(card)]
        this.startLevel(levelId)
      }
    })

    // Network node clicks (delegated)
    elements.networkMapEl.addEventListener("click", (e) => {
      const node = e.target.closest(".network-node")
      if (node) {
        const nodeId = node.dataset.nodeId
        this.selectNode(nodeId)
      }
    })

    // Command button clicks (delegated)
    elements.availableCommandsEl.addEventListener("click", (e) => {
      const button = e.target.closest(".command-button")
      if (button && !button.disabled) {
        const commandId = button.dataset.commandId
        this.executeCommand(commandId)
      }
    })
  }

  /**
   * Setup keyboard navigation
   */
  setupKeyboardNavigation() {
    document.addEventListener("keydown", (e) => {
      // Escape - close modals
      if (e.key === "Escape") {
        if (this.gameUI.elements.dialogModal.classList.contains("show")) {
          this.npcManager.closeDialog()
          return
        }
        if (this.gameUI.elements.victoryModal.classList.contains("show")) {
          this.showLevelSelection()
          return
        }
        if (this.gameUI.elements.toolModal.classList.contains("show")) {
          this.gameUI.closeTool()
          return
        }
      }

      // Enter - activate focused element
      if (e.key === "Enter") {
        const focused = document.activeElement

        // Level card selection
        if (focused.classList.contains("level-card") && !focused.classList.contains("locked")) {
          focused.click()
          return
        }

        // Command button activation
        if (focused.classList.contains("command-button") && !focused.disabled) {
          focused.click()
          return
        }

        // Network node selection
        if (focused.classList.contains("network-node")) {
          focused.click()
          return
        }
      }

      // Arrow keys - navigate level cards when on level selection screen
      if (this.gameUI.elements.levelSelectionEl.style.display !== "none") {
        const levelCards = Array.from(document.querySelectorAll(".level-card:not(.locked)"))
        const currentIndex = levelCards.indexOf(document.activeElement)

        if (e.key === "ArrowRight" && currentIndex >= 0 && currentIndex < levelCards.length - 1) {
          levelCards[currentIndex + 1].focus()
          e.preventDefault()
        } else if (e.key === "ArrowLeft" && currentIndex > 0) {
          levelCards[currentIndex - 1].focus()
          e.preventDefault()
        } else if (
          (e.key === "ArrowRight" || e.key === "ArrowDown") &&
          currentIndex === -1 &&
          levelCards.length > 0
        ) {
          // No card focused, focus first one
          levelCards[0].focus()
          e.preventDefault()
        }
      }

      // Arrow keys - navigate network nodes when in game
      if (this.gameUI.elements.gameScreenEl.style.display !== "none") {
        const nodes = Array.from(document.querySelectorAll(".network-node"))
        const currentIndex = nodes.indexOf(document.activeElement)

        if (e.key === "ArrowDown" && currentIndex >= 0 && currentIndex < nodes.length - 1) {
          nodes[currentIndex + 1].focus()
          e.preventDefault()
        } else if (e.key === "ArrowUp" && currentIndex > 0) {
          nodes[currentIndex - 1].focus()
          e.preventDefault()
        } else if (
          (e.key === "ArrowDown" || e.key === "ArrowRight") &&
          currentIndex === -1 &&
          nodes.length > 0
        ) {
          // No node focused, focus first one
          nodes[0].focus()
          e.preventDefault()
        }
      }
    })
  }

  /**
   * Show level selection screen
   */
  showLevelSelection() {
    this.gameUI.showLevelSelection()
    this.gameUI.renderLevelList(this.gameState)
  }

  /**
   * Start a level
   * @param {string} levelId - Level identifier
   */
  startLevel(levelId) {
    this.gameState.enterLevel(levelId)

    this.gameUI.showGameScreen()

    const hasProgress =
      this.gameState.cluesFound.size > 0 || this.gameState.vulnerabilitiesFixed.size > 0
    this.gameUI.initializeLevelScreen(this.gameState.currentLevel, hasProgress)

    this.updateProgressInfo()
    this.gameUI.renderNetworkMap(this.gameState.networkNodes, this.gameState.currentNode)
    this.renderCommands()
  }

  /**
   * Select (connect to) a network node
   * @param {string} nodeId - Node identifier
   */
  selectNode(nodeId) {
    const node = this.gameState.getNodeById(nodeId)
    const wasConnected = this.gameState.currentNode !== null

    // If already connected to a different node, disconnect first
    if (wasConnected && this.gameState.currentNode !== nodeId) {
      this.gameUI.addTerminalLine("", "")
      this.gameUI.addTerminalLine("Connection closed.", "info")
      this.gameUI.addTerminalLine("---", "")
    }

    this.gameState.selectNode(nodeId)

    // SSH connection message
    this.gameUI.addTerminalLine(`ssh user@${node.hostname}`, "command")
    this.gameUI.addTerminalLine(`Connected to ${node.hostname}`, "info")
    this.gameUI.addTerminalLine(
      `System load: ${node.systemLoad || "0.15"}  Memory: ${node.memoryUsage || "42"}%`,
      "info",
    )
    this.gameUI.addTerminalLine("", "")

    this.gameUI.updateNPCPanel(node)
    this.gameUI.renderNetworkMap(this.gameState.networkNodes, this.gameState.currentNode)
    this.renderCommands()
    this.gameUI.scrollTerminalToBottom()
  }

  /**
   * Execute a command
   * @param {string} commandId - Command identifier
   */
  executeCommand(commandId) {
    this.commandHandler.executeCommand(commandId)
    this.updateProgressInfo()
    this.renderCommands()
    this.gameUI.renderNetworkMap(this.gameState.networkNodes, this.gameState.currentNode)
    this.checkLevelComplete()
  }

  /**
   * Render available commands
   */
  renderCommands() {
    const commands = this.commandHandler.getAvailableCommands()
    this.gameUI.renderCommands(commands)
  }

  /**
   * Update progress information display
   */
  updateProgressInfo() {
    const cluesFound = this.gameState.cluesFound.size
    const totalClues = this.gameState.currentLevel.requiredClues.length
    const vulnsFixed = this.gameState.vulnerabilitiesFixed.size
    const totalVulns = this.gameState.currentLevel.vulnerabilities.length

    this.gameUI.updateProgressInfo(cluesFound, totalClues, vulnsFixed, totalVulns)
  }

  /**
   * Check if level is complete
   */
  checkLevelComplete() {
    if (this.gameState.isLevelComplete()) {
      setTimeout(() => {
        this.showVictory()
      }, 1000)
    }
  }

  /**
   * Show victory modal
   */
  showVictory() {
    this.gameState.completeLevel()
    const hasNextLevel = this.gameState.hasNextLevel()
    this.gameUI.showVictory(this.gameState.currentLevel, hasNextLevel)
  }

  /**
   * Go to next level
   */
  goToNextLevel() {
    this.gameUI.closeVictory()
    const nextLevelId = this.gameState.getNextLevelId()
    if (nextLevelId) {
      this.startLevel(nextLevelId)
    }
  }

  /**
   * Reset all progress
   */
  resetProgress() {
    if (
      confirm("⚠️ Reset all progress?\n\nThis will delete your save data and cannot be undone.")
    ) {
      this.gameState.resetProgress()
      this.gameUI.renderLevelList(this.gameState)
      this.gameUI.addTerminalLine("Progress reset successfully.", "success")
    }
  }
}

// Initialize game when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  window.game = new NetGuardGame()
})

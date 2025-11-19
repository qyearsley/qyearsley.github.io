import { LEVELS, LEVEL_ORDER } from "../levels.js"
import { getNetworkForLevel } from "../networks.js"
import { STORAGE_KEYS } from "../constants.js"
import { StorageManager } from "../../common/js/StorageManager.js"

/**
 * Manages the game state for NetGuard
 * Handles level progression, node scanning, clue discovery, and vulnerability tracking
 */
export class GameState {
  /**
   * @param {string} version - Game version for save compatibility
   */
  constructor(version = "1.0") {
    this.storageManager = new StorageManager("netguard-save", version)

    /** @type {Object|null} - Current level object from LEVELS */
    this.currentLevel = null

    /** @type {string|null} - ID of the currently selected node */
    this.currentNode = null

    /** @type {Array} - Array of network node objects for current level */
    this.networkNodes = []

    /** @type {Set<string>} - IDs of scanned nodes */
    this.scannedNodes = new Set()

    /** @type {Set<string>} - IDs of found clues */
    this.cluesFound = new Set()

    /** @type {Set<string>} - IDs of fixed vulnerabilities */
    this.vulnerabilitiesFixed = new Set()

    /** @type {Set<string>} - IDs of completed levels */
    this.completedLevels = new Set()

    /** @type {boolean} - Whether a level is currently in progress */
    this.inProgress = false

    /** @type {boolean} - Whether a vulnerability has been identified (for Level 1) */
    this.vulnerabilityFound = false

    this.loadGameState()
    this.handleQueryParameters()
  }

  /**
   * Start a new level
   * @param {string} levelId - Level identifier
   */
  enterLevel(levelId) {
    this.currentLevel = LEVELS[levelId]
    this.networkNodes = JSON.parse(JSON.stringify(getNetworkForLevel(levelId))) // Deep copy
    this.currentNode = null
    this.scannedNodes = new Set()
    this.cluesFound = new Set()
    this.vulnerabilitiesFixed = new Set()
    this.vulnerabilityFound = false
    this.inProgress = true

    // Load saved progress if available
    const savedProgress = this.loadLevelProgress(levelId)
    if (savedProgress) {
      this.restoreLevelProgress(savedProgress)
    }
  }

  /**
   * Restore level progress from saved data
   * @param {Object} savedProgress - Saved progress data
   */
  restoreLevelProgress(savedProgress) {
    if (!savedProgress) return

    // Restore progress data
    savedProgress.cluesFound?.forEach((clue) => this.cluesFound.add(clue))
    savedProgress.vulnerabilitiesFixed?.forEach((vuln) => this.vulnerabilitiesFixed.add(vuln))
    savedProgress.scannedNodes?.forEach((node) => this.scannedNodes.add(node))

    // Restore node statuses based on saved progress
    this.networkNodes.forEach((node) => {
      // Mark scanned nodes as healthy (unless they have issues)
      if (this.scannedNodes.has(node.id)) {
        if (node.status === "unexamined") {
          node.status = "healthy"
        }
      }
    })

    // Update node statuses based on vulnerabilities found and fixed
    if (this.vulnerabilityFound || this.cluesFound.size > 0) {
      const authNode = this.networkNodes.find((n) => n.id === "auth")
      if (authNode && this.cluesFound.has("auth_config")) {
        authNode.status = this.vulnerabilitiesFixed.has("jwt_expiration")
          ? "healthy"
          : "compromised"
      }

      const commentNode = this.networkNodes.find((n) => n.id === "comment-system")
      if (commentNode && this.vulnerabilitiesFixed.has("stored_xss")) {
        commentNode.status = "healthy"
      }

      const webNode = this.networkNodes.find((n) => n.id === "web-server")
      if (webNode && this.vulnerabilitiesFixed.has("missing_csp")) {
        webNode.status = "healthy"
      }

      const adminNode = this.networkNodes.find((n) => n.id === "admin-panel")
      if (adminNode && this.vulnerabilitiesFixed.has("auth_bypass")) {
        adminNode.status = "healthy"
      }

      const sessionNode = this.networkNodes.find((n) => n.id === "session-store")
      if (sessionNode && this.vulnerabilitiesFixed.has("broken_access_control")) {
        sessionNode.status = "healthy"
      }
    }
  }

  /**
   * Complete the current level
   */
  completeLevel() {
    if (!this.currentLevel) return

    this.completedLevels.add(this.currentLevel.id)
    this.saveGameState()
    this.clearLevelProgress(this.currentLevel.id)
  }

  /**
   * Connect to a network node
   * @param {string} nodeId - Node identifier
   */
  selectNode(nodeId) {
    this.currentNode = nodeId
  }

  /**
   * Disconnect from current node
   */
  disconnectNode() {
    this.currentNode = null
  }

  /**
   * Mark a node as scanned
   * @param {string} nodeId - Node identifier
   */
  scanNode(nodeId) {
    this.scannedNodes.add(nodeId)
    this.saveLevelProgress()
  }

  /**
   * Add a clue to found clues
   * @param {string} clueId - Clue identifier
   */
  addClue(clueId) {
    this.cluesFound.add(clueId)
    this.saveLevelProgress()
  }

  /**
   * Mark a vulnerability as fixed
   * @param {string} vulnerabilityId - Vulnerability identifier
   */
  fixVulnerability(vulnerabilityId) {
    this.vulnerabilitiesFixed.add(vulnerabilityId)
    this.saveLevelProgress()
  }

  /**
   * Mark that a vulnerability has been identified
   */
  markVulnerabilityFound() {
    this.vulnerabilityFound = true
  }

  /**
   * Check if all vulnerabilities in current level are fixed
   * @returns {boolean} True if level is complete
   */
  isLevelComplete() {
    if (!this.currentLevel) return false
    return this.currentLevel.vulnerabilities.every((v) => this.vulnerabilitiesFixed.has(v))
  }

  /**
   * Check if a level is unlocked
   * @param {string} levelId - Level identifier
   * @returns {boolean} True if level is unlocked
   */
  isLevelUnlocked(levelId) {
    const levelIndex = LEVEL_ORDER.indexOf(levelId)
    if (levelIndex === 0) return true
    const previousLevelId = LEVEL_ORDER[levelIndex - 1]
    return this.completedLevels.has(previousLevelId)
  }

  /**
   * Check if a level is completed
   * @param {string} levelId - Level identifier
   * @returns {boolean} True if level is completed
   */
  isLevelCompleted(levelId) {
    return this.completedLevels.has(levelId)
  }

  /**
   * Get the current node object
   * @returns {Object|null} Current node object
   */
  getCurrentNode() {
    if (!this.currentNode) return null
    return this.networkNodes.find((n) => n.id === this.currentNode)
  }

  /**
   * Get a node by ID
   * @param {string} nodeId - Node identifier
   * @returns {Object|null} Node object
   */
  getNodeById(nodeId) {
    return this.networkNodes.find((n) => n.id === nodeId)
  }

  /**
   * Update node status
   * @param {string} nodeId - Node identifier
   * @param {string} status - New status (healthy, suspicious, compromised, unexamined)
   */
  updateNodeStatus(nodeId, status) {
    const node = this.getNodeById(nodeId)
    if (node) {
      node.status = status
    }
  }

  /**
   * Save game state to storage
   */
  saveGameState() {
    const saveData = {
      completedLevels: Array.from(this.completedLevels),
      timestamp: Date.now(),
    }
    localStorage.setItem(STORAGE_KEYS.GAME_SAVE, JSON.stringify(saveData))
  }

  /**
   * Save per-level progress to storage
   */
  saveLevelProgress() {
    if (!this.currentLevel || !this.inProgress) return

    const levelId = this.currentLevel.id
    const progressData = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEVEL_PROGRESS) || "{}")

    progressData[levelId] = {
      cluesFound: Array.from(this.cluesFound),
      vulnerabilitiesFixed: Array.from(this.vulnerabilitiesFixed),
      scannedNodes: Array.from(this.scannedNodes),
    }

    localStorage.setItem(STORAGE_KEYS.LEVEL_PROGRESS, JSON.stringify(progressData))
  }

  /**
   * Load per-level progress from storage
   * @param {string} levelId - Level identifier
   * @returns {Object|null} Progress data or null
   */
  loadLevelProgress(levelId) {
    try {
      const progressData = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEVEL_PROGRESS) || "{}")
      return progressData[levelId] || null
    } catch (e) {
      console.error("Failed to load level progress:", e)
      return null
    }
  }

  /**
   * Clear progress for a specific level
   * @param {string} levelId - Level identifier
   */
  clearLevelProgress(levelId) {
    try {
      const progressData = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEVEL_PROGRESS) || "{}")
      delete progressData[levelId]
      localStorage.setItem(STORAGE_KEYS.LEVEL_PROGRESS, JSON.stringify(progressData))
    } catch (e) {
      console.error("Failed to clear level progress:", e)
    }
  }

  /**
   * Load game state from storage
   */
  loadGameState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.GAME_SAVE)
      if (saved) {
        const data = JSON.parse(saved)
        data.completedLevels.forEach((id) => this.completedLevels.add(id))
      }
    } catch (e) {
      console.error("Failed to load save data:", e)
    }
  }

  /**
   * Reset all progress
   */
  resetProgress() {
    localStorage.removeItem(STORAGE_KEYS.GAME_SAVE)
    localStorage.removeItem(STORAGE_KEYS.LEVEL_PROGRESS)
    this.completedLevels.clear()
    this.currentLevel = null
    this.currentNode = null
    this.networkNodes = []
    this.scannedNodes.clear()
    this.cluesFound.clear()
    this.vulnerabilitiesFixed.clear()
    this.inProgress = false
    this.vulnerabilityFound = false
  }

  /**
   * Handle query parameters (for testing)
   */
  handleQueryParameters() {
    const params = new URLSearchParams(window.location.search)

    // Unlock levels: ?unlock=all
    const unlockParam = params.get("unlock")
    if (unlockParam === "all") {
      LEVEL_ORDER.forEach((levelId) => {
        this.completedLevels.add(levelId)
      })
      console.log("🔓 All levels unlocked for testing")
    }
  }

  /**
   * Get the next level ID after current level
   * @returns {string|null} Next level ID or null
   */
  getNextLevelId() {
    if (!this.currentLevel) return null
    const currentIndex = LEVEL_ORDER.indexOf(this.currentLevel.id)
    if (currentIndex < LEVEL_ORDER.length - 1) {
      return LEVEL_ORDER[currentIndex + 1]
    }
    return null
  }

  /**
   * Check if there is a next level
   * @returns {boolean} True if there is a next level
   */
  hasNextLevel() {
    return this.getNextLevelId() !== null
  }
}

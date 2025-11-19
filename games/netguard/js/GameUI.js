import { BaseGameUI } from "../../common/js/BaseGameUI.js"
import { LEVELS, LEVEL_ORDER } from "../levels.js"

/**
 * Manages all DOM manipulation and UI updates for NetGuard
 * Extends BaseGameUI to leverage common UI patterns
 */
export class GameUI extends BaseGameUI {
  constructor() {
    super()
    this.elements = this.cacheElements()
  }

  /**
   * Cache DOM elements to avoid repeated queries
   * @returns {Object} Object containing cached DOM elements
   */
  cacheElements() {
    return {
      ...this.cacheCommonElements(),
      levelSelectionEl: document.getElementById("level-selection"),
      levelListEl: document.getElementById("level-list"),
      gameScreenEl: document.getElementById("game-screen"),
      levelInfoEl: document.getElementById("level-info"),
      progressInfoEl: document.getElementById("progress-info"),
      backButtonEl: document.getElementById("back-button"),
      networkMapEl: document.getElementById("network-map"),
      terminalOutputEl: document.getElementById("terminal-output"),
      availableCommandsEl: document.getElementById("available-commands"),
      npcInfoEl: document.getElementById("npc-info"),
      talkButtonEl: document.getElementById("talk-button"),
      dialogModal: document.getElementById("dialog-modal"),
      dialogNPC: document.getElementById("dialog-npc"),
      dialogBody: document.getElementById("dialog-body"),
      dialogClose: document.getElementById("dialog-close"),
      dialogContinue: document.getElementById("dialog-continue"),
      victoryModal: document.getElementById("victory-modal"),
      nextLevelBtn: document.getElementById("next-level"),
      backToLevelsBtn: document.getElementById("back-to-levels"),
      toolModal: document.getElementById("tool-modal"),
      toolTitle: document.getElementById("tool-title"),
      toolInput: document.getElementById("tool-input"),
      toolInputLabel: document.getElementById("tool-input-label"),
      toolOutput: document.getElementById("tool-output"),
      toolClose: document.getElementById("tool-close"),
      toolExecute: document.getElementById("tool-execute"),
      resetButton: document.getElementById("reset-button"),
    }
  }

  /**
   * Show level selection screen
   */
  showLevelSelection() {
    this.elements.levelSelectionEl.style.display = "block"
    this.elements.gameScreenEl.style.display = "none"
    this.elements.victoryModal.classList.remove("show")
  }

  /**
   * Show game screen
   */
  showGameScreen() {
    this.elements.levelSelectionEl.style.display = "none"
    this.elements.gameScreenEl.style.display = "block"
  }

  /**
   * Render the level selection list
   * @param {GameState} gameState - Game state object
   */
  renderLevelList(gameState) {
    this.elements.levelListEl.innerHTML = ""

    LEVEL_ORDER.forEach((levelId, index) => {
      const level = LEVELS[levelId]
      const isLocked = index > 0 && !gameState.completedLevels.has(LEVEL_ORDER[index - 1])
      const isCompleted = gameState.completedLevels.has(levelId)

      const card = document.createElement("div")
      card.className = `level-card ${isLocked ? "locked" : ""}`

      // Make keyboard accessible
      if (!isLocked) {
        card.tabIndex = 0
        card.setAttribute("role", "button")
        card.setAttribute("aria-label", `Start level ${level.id}: ${level.name}`)
      }

      card.innerHTML = `
        <div class="level-card-header">
          <span class="level-number">Level ${level.id}</span>
          <span class="level-difficulty difficulty-${level.difficulty.toLowerCase()}">
            ${level.difficulty}
          </span>
        </div>
        <div class="level-name">${level.name}</div>
        <div class="level-description">${level.description}</div>
        <div class="level-concepts">
          ${level.concepts.map((c) => `<span class="concept-tag">${c}</span>`).join("")}
        </div>
        ${isCompleted ? '<div style="margin-top: 15px; color: var(--accent-green);">✅ Completed</div>' : ""}
        ${isLocked ? '<div style="margin-top: 15px; color: var(--text-secondary);">🔒 Complete previous levels to unlock</div>' : ""}
      `

      this.elements.levelListEl.appendChild(card)
    })
  }

  /**
   * Initialize level screen with current level info
   * @param {Object} currentLevel - Current level object
   * @param {boolean} hasProgress - Whether there is saved progress
   */
  initializeLevelScreen(currentLevel, hasProgress) {
    this.elements.levelInfoEl.textContent = `Level ${currentLevel.id}: ${currentLevel.name}`

    // Initialize terminal
    this.elements.terminalOutputEl.innerHTML = ""
    this.addTerminalLine("NetGuard Security Terminal v2.0", "")
    this.addTerminalLine("---", "")
    this.addTerminalLine("🎯 MISSION:", "narrative")
    this.addTerminalLine(currentLevel.description, "narrative")
    this.addTerminalLine("", "")
    this.addTerminalLine("OBJECTIVES:", "info")
    currentLevel.concepts.forEach((concept) => {
      this.addTerminalLine(`• ${concept}`, "info")
    })
    this.addTerminalLine("---", "")

    if (hasProgress) {
      this.addTerminalLine("📁 Progress restored from previous session", "success")
      this.addTerminalLine("---", "")
    }

    this.addTerminalLine("Click a network node to SSH into it and investigate.", "info")
  }

  /**
   * Update progress information display
   * @param {number} cluesFound - Number of clues found
   * @param {number} totalClues - Total clues needed
   * @param {number} vulnsFixed - Number of vulnerabilities fixed
   * @param {number} totalVulns - Total vulnerabilities to fix
   */
  updateProgressInfo(cluesFound, totalClues, vulnsFixed, totalVulns) {
    this.elements.progressInfoEl.textContent = `Clues: ${cluesFound}/${totalClues} | Vulnerabilities Fixed: ${vulnsFixed}/${totalVulns}`
  }

  /**
   * Render the network map
   * @param {Array} networkNodes - Array of network node objects
   * @param {string|null} currentNodeId - ID of currently selected node
   */
  renderNetworkMap(networkNodes, currentNodeId) {
    this.elements.networkMapEl.innerHTML = ""

    networkNodes.forEach((node) => {
      const nodeEl = document.createElement("div")
      nodeEl.className = `network-node ${node.status}`
      if (currentNodeId === node.id) {
        nodeEl.classList.add("selected")
      }

      // Make keyboard accessible
      nodeEl.tabIndex = 0
      nodeEl.setAttribute("role", "button")
      nodeEl.setAttribute("aria-label", `Connect to ${node.name} - ${node.description}`)

      nodeEl.innerHTML = `
        <div class="node-header">
          <div class="node-name">${node.name}</div>
          <div class="status-indicator">${this.getStatusEmoji(node.status)}</div>
        </div>
        <div class="node-type">${node.hostname}</div>
        <div class="node-description">${node.description}</div>
      `

      nodeEl.dataset.nodeId = node.id
      this.elements.networkMapEl.appendChild(nodeEl)
    })
  }

  /**
   * Get emoji for node status
   * @param {string} status - Node status
   * @returns {string} Status emoji
   */
  getStatusEmoji(status) {
    const statusMap = {
      healthy: "🟢",
      suspicious: "🟡",
      compromised: "🔴",
      unexamined: "🔵",
    }
    return statusMap[status] || "🔵"
  }

  /**
   * Update NPC panel display
   * @param {Object|null} node - Current node object
   */
  updateNPCPanel(node) {
    if (node && node.npc) {
      this.elements.npcInfoEl.textContent = node.npc.name
      this.elements.talkButtonEl.disabled = false
      this.elements.talkButtonEl.textContent = "Talk to Personnel"
    } else {
      this.elements.npcInfoEl.textContent = "No personnel available at this location"
      this.elements.talkButtonEl.disabled = true
    }
  }

  /**
   * Render available commands
   * @param {Array} commands - Array of command objects
   */
  renderCommands(commands) {
    this.elements.availableCommandsEl.innerHTML = ""

    commands.forEach((cmd) => {
      const button = document.createElement("button")
      button.className = "command-button"
      button.textContent = cmd.name
      button.title = cmd.description

      if (cmd.disabled) {
        button.disabled = true
      }

      button.dataset.commandId = cmd.id
      this.elements.availableCommandsEl.appendChild(button)
    })
  }

  /**
   * Add a line to the terminal output
   * @param {string} text - Text content
   * @param {string} className - CSS class name for styling
   */
  addTerminalLine(text, className = "") {
    const line = document.createElement("div")
    line.className = `terminal-line ${className}`
    if (className === "command") {
      // Commands get a prompt prefix
      line.innerHTML = `<span style="color: var(--accent-blue)">$ </span>${text}`
    } else {
      line.textContent = text
    }
    this.elements.terminalOutputEl.appendChild(line)
  }

  /**
   * Scroll terminal output to bottom
   */
  scrollTerminalToBottom() {
    this.elements.terminalOutputEl.scrollTop = this.elements.terminalOutputEl.scrollHeight
  }

  /**
   * Show NPC dialog modal
   * @param {string} npcName - NPC name
   * @param {string} message - Dialog message
   */
  showDialog(npcName, message) {
    this.elements.dialogNPC.textContent = npcName
    this.elements.dialogBody.textContent = message
    this.elements.dialogModal.classList.add("show")
  }

  /**
   * Close NPC dialog modal
   */
  closeDialog() {
    this.elements.dialogModal.classList.remove("show")
  }

  /**
   * Show victory modal with level completion info
   * @param {Object} currentLevel - Current level object
   * @param {boolean} hasNextLevel - Whether there is a next level
   */
  showVictory(currentLevel, hasNextLevel) {
    const victoryMessage = document.getElementById("victory-message")

    // Clear previous content safely
    victoryMessage.textContent = ""

    // Create greeting
    const greetingText = document.createElement("p")
    const greetingStrong = document.createElement("strong")
    greetingStrong.textContent = "Excellent work, Security Engineer!"
    greetingText.appendChild(greetingStrong)
    victoryMessage.appendChild(greetingText)

    // Create level name
    const levelText = document.createElement("p")
    levelText.textContent = "You successfully completed: "
    const levelName = document.createElement("strong")
    levelName.textContent = currentLevel.name
    levelText.appendChild(levelName)
    victoryMessage.appendChild(levelText)

    // Create concepts learned section
    const conceptsHeading = document.createElement("p")
    const conceptsStrong = document.createElement("strong")
    conceptsStrong.textContent = "What you learned:"
    conceptsHeading.appendChild(conceptsStrong)
    victoryMessage.appendChild(conceptsHeading)

    const conceptsList = document.createElement("ul")
    conceptsList.style.textAlign = "left"
    conceptsList.style.display = "inline-block"

    currentLevel.concepts.forEach((concept) => {
      const li = document.createElement("li")
      li.textContent = concept
      conceptsList.appendChild(li)
    })
    victoryMessage.appendChild(conceptsList)

    // Create vulnerabilities section
    const vulnHeading = document.createElement("p")
    const vulnStrong = document.createElement("strong")
    vulnStrong.textContent = "Vulnerabilities Fixed:"
    vulnHeading.appendChild(vulnStrong)
    victoryMessage.appendChild(vulnHeading)

    const vulnList = document.createElement("ul")
    vulnList.style.textAlign = "left"
    vulnList.style.display = "inline-block"

    currentLevel.vulnerabilities.forEach((v) => {
      const li = document.createElement("li")
      li.textContent = `✅ ${v.replace(/_/g, " ").toUpperCase()}`
      vulnList.appendChild(li)
    })
    victoryMessage.appendChild(vulnList)

    // Add learning resources if available
    if (currentLevel.resources && currentLevel.resources.length > 0) {
      const resourcesHeading = document.createElement("p")
      const resourcesStrong = document.createElement("strong")
      resourcesStrong.textContent = "📚 Learn More:"
      resourcesHeading.appendChild(resourcesStrong)
      resourcesHeading.style.marginTop = "20px"
      victoryMessage.appendChild(resourcesHeading)

      const resourcesList = document.createElement("ul")
      resourcesList.style.textAlign = "left"
      resourcesList.style.display = "inline-block"

      currentLevel.resources.forEach((resource) => {
        const li = document.createElement("li")
        const link = document.createElement("a")
        link.href = resource.url
        link.target = "_blank"
        link.rel = "noopener noreferrer"
        link.textContent = resource.title
        link.style.color = "var(--accent-blue)"
        link.style.textDecoration = "none"
        li.appendChild(link)
        resourcesList.appendChild(li)
      })
      victoryMessage.appendChild(resourcesList)
    }

    // Check if there's a next level
    if (hasNextLevel) {
      const nextLevelText = document.createElement("p")
      nextLevelText.textContent = "Ready for the next challenge?"
      victoryMessage.appendChild(nextLevelText)
      this.elements.nextLevelBtn.style.display = "inline-block"
    } else {
      const congratsText = document.createElement("p")
      const congratsStrong = document.createElement("strong")
      congratsStrong.textContent = "🎉 Congratulations! You've completed all levels!"
      congratsText.appendChild(congratsStrong)
      victoryMessage.appendChild(congratsText)

      const masteryText = document.createElement("p")
      masteryText.textContent = "You've mastered the fundamentals of web security!"
      victoryMessage.appendChild(masteryText)

      this.elements.nextLevelBtn.style.display = "none"
    }

    this.elements.victoryModal.classList.add("show")
  }

  /**
   * Close victory modal
   */
  closeVictory() {
    this.elements.victoryModal.classList.remove("show")
  }

  /**
   * Open interactive tool modal
   * @param {string} toolName - Tool name
   * @param {Object|null} node - Current node (for context-specific hints)
   */
  openTool(toolName, node = null) {
    this.elements.toolTitle.textContent = toolName
    this.elements.toolInput.value = ""
    this.elements.toolOutput.textContent = ""

    // Set context-specific hints
    if (toolName.includes("base64") && node?.sampleToken) {
      this.elements.toolInputLabel.textContent = "JWT Token or Payload:"
      this.elements.toolInput.placeholder =
        "Paste full JWT token or just the payload (middle part between dots)..."
      this.elements.toolInput.value = node.sampleToken // Full token
      this.elements.toolOutput.textContent =
        "Hint: JWT tokens have 3 parts (header.payload.signature). Paste the full token or just the middle part to see the payload."
    } else if (toolName.includes("psql")) {
      this.elements.toolInputLabel.textContent = "SQL Query:"
      this.elements.toolInput.placeholder = "e.g., SELECT * FROM users WHERE id = '1' OR '1'='1'"
      this.elements.toolOutput.textContent =
        "Try SQL injection payloads to see how they exploit vulnerabilities.\nExample: ' OR '1'='1"
    }

    this.elements.toolModal.classList.add("show")
  }

  /**
   * Close interactive tool modal
   */
  closeTool() {
    this.elements.toolModal.classList.remove("show")
  }

  /**
   * Set tool output text
   * @param {string} output - Output text
   */
  setToolOutput(output) {
    this.elements.toolOutput.textContent = output
  }

  /**
   * Get tool input value
   * @returns {string} Input value
   */
  getToolInput() {
    return this.elements.toolInput.value.trim()
  }

  /**
   * Get tool title
   * @returns {string} Tool title
   */
  getToolTitle() {
    return this.elements.toolTitle.textContent
  }
}

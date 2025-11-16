// Level-specific handlers for NetGuard
// This file contains all level-specific logic for commands and victory conditions

import {
  LEVEL_IDS,
  LEVEL_1_NODES,
  LEVEL_2_NODES,
  LEVEL_3_NODES,
  COMMAND_IDS,
  CLUE_IDS,
} from "./constants.js"

// Level 1: JWT Expiration Handler
const level1Handler = {
  id: LEVEL_IDS.JWT_EXPIRATION,

  // Get level-specific commands
  getLevelCommands(gameState) {
    return [
      {
        id: COMMAND_IDS.ANALYZE_TOKENS,
        name: "./analyze-tokens.sh",
        description: "Analyze JWT tokens",
        disabled: !gameState.currentNode || gameState.currentNode !== LEVEL_1_NODES.AUTH,
      },
      {
        id: COMMAND_IDS.FIX_JWT,
        name: "enable-jwt-expiration",
        description: "Enable JWT expiration validation",
        disabled: !gameState.vulnerabilityFound,
      },
    ]
  },

  // Get tool commands for this level
  getToolCommands(gameState) {
    const node = gameState.networkNodes.find((n) => n.id === gameState.currentNode)
    const commands = []

    // JWT decoder (if token available)
    if (node?.sampleToken) {
      commands.push({
        id: COMMAND_IDS.DECODE_JWT,
        name: "echo <token> | base64 -d",
        description: "Decode JWT token from logs",
        disabled: false,
      })
    }

    return commands
  },
}

// Level 2: XSS Vulnerability Handler
const level2Handler = {
  id: LEVEL_IDS.XSS_VULNERABILITY,

  getLevelCommands(gameState) {
    return [
      {
        id: COMMAND_IDS.ANALYZE_XSS,
        name: "grep '<script>' db.log",
        description: "Search for injected scripts",
        disabled: !gameState.currentNode || gameState.currentNode !== LEVEL_2_NODES.DATABASE,
      },
      {
        id: COMMAND_IDS.FIX_XSS,
        name: "sanitize-user-input",
        description: "Fix XSS vulnerability",
        disabled: !gameState.cluesFound.has(CLUE_IDS.UNSANITIZED_INPUT),
      },
      {
        id: COMMAND_IDS.ADD_CSP,
        name: "add-csp-headers",
        description: "Add Content Security Policy",
        disabled: !gameState.cluesFound.has(CLUE_IDS.MISSING_CSP),
      },
    ]
  },

  getToolCommands() {
    return []
  },
}

// Level 3: Authentication Bypass Handler
const level3Handler = {
  id: LEVEL_IDS.AUTH_BYPASS,

  getLevelCommands(gameState) {
    return [
      {
        id: COMMAND_IDS.CHECK_AUTH,
        name: "audit-auth-checks",
        description: "Audit authorization logic",
        disabled: !gameState.currentNode || gameState.currentNode !== LEVEL_3_NODES.AUDIT_LOG,
      },
      {
        id: COMMAND_IDS.FIX_AUTH,
        name: "add-role-checks",
        description: "Add proper authorization checks",
        disabled: !gameState.cluesFound.has(CLUE_IDS.MISSING_AUTH_CHECK),
      },
      {
        id: COMMAND_IDS.FIX_SESSION,
        name: "secure-session-tokens",
        description: "Fix predictable session tokens",
        disabled: !gameState.cluesFound.has(CLUE_IDS.INSECURE_SESSION),
      },
    ]
  },

  getToolCommands() {
    return []
  },
}

// Map of level ID to handler
export const LEVEL_HANDLERS = {
  [LEVEL_IDS.JWT_EXPIRATION]: level1Handler,
  [LEVEL_IDS.XSS_VULNERABILITY]: level2Handler,
  [LEVEL_IDS.AUTH_BYPASS]: level3Handler,
}

// Get handler for current level
export function getCurrentLevelHandler(gameState) {
  if (!gameState.currentLevel) return null
  return LEVEL_HANDLERS[gameState.currentLevel.id] || null
}

// Get all commands for current level (level-specific + tool commands)
export function getLevelAndToolCommands(gameState) {
  const handler = getCurrentLevelHandler(gameState)
  if (!handler) return []

  return [...handler.getLevelCommands(gameState), ...handler.getToolCommands(gameState)]
}

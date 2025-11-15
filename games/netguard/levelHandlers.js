// Level-specific handlers for NetGuard
// This file contains all level-specific logic for commands and victory conditions

import {
  LEVEL_IDS,
  LEVEL_1_NODES,
  LEVEL_2_NODES,
  LEVEL_3_NODES,
  LEVEL_4_NODES,
  LEVEL_5_NODES,
  LEVEL_6_NODES,
  LEVEL_7_NODES,
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

// Level 2: SQL Injection Handler
const level2Handler = {
  id: LEVEL_IDS.SQL_INJECTION,

  // Get level-specific commands
  getLevelCommands(gameState) {
    return [
      {
        id: COMMAND_IDS.VIEW_SOURCE,
        name: "cat source.js",
        description: "View source code",
        disabled:
          !gameState.currentNode ||
          (gameState.currentNode !== LEVEL_2_NODES.API_SERVER &&
            gameState.currentNode !== LEVEL_2_NODES.REPO),
      },
      {
        id: COMMAND_IDS.FIX_SQL,
        name: "patch-sql-injection",
        description: "Fix SQL injection vulnerability",
        disabled: !gameState.cluesFound.has(CLUE_IDS.INJECTABLE_ENDPOINT),
      },
      {
        id: COMMAND_IDS.FIX_SECRETS,
        name: "rotate-credentials",
        description: "Rotate hardcoded credentials",
        disabled: !gameState.cluesFound.has(CLUE_IDS.SOURCE_CODE_SECRETS),
      },
    ]
  },

  // Get tool commands for this level
  getToolCommands() {
    return [
      {
        id: COMMAND_IDS.TEST_SQL,
        name: "psql -c",
        description: "Test SQL query",
        disabled: false,
      },
    ]
  },
}

// Level 3: Certificate Validation Handler
const level3Handler = {
  id: LEVEL_IDS.CERT_VALIDATION,

  // Get level-specific commands
  getLevelCommands(gameState) {
    return [
      {
        id: COMMAND_IDS.CHECK_CERT,
        name: "openssl s_client",
        description: "Check SSL certificate",
        disabled:
          !gameState.currentNode ||
          (gameState.currentNode !== LEVEL_3_NODES.PAYMENT_PROXY &&
            gameState.currentNode !== LEVEL_3_NODES.EXTERNAL_API),
      },
      {
        id: COMMAND_IDS.FIX_CERT,
        name: "enable-cert-validation",
        description: "Enable certificate validation",
        disabled: !gameState.cluesFound.has(CLUE_IDS.DISABLED_CERT_CHECK),
      },
    ]
  },

  // Get tool commands for this level
  getToolCommands(gameState) {
    const node = gameState.networkNodes.find((n) => n.id === gameState.currentNode)
    const commands = []

    if (node?.certificate) {
      commands.push({
        id: COMMAND_IDS.CHECK_CERT_TOOL,
        name: "openssl x509 -text",
        description: "Inspect certificate",
        disabled: false,
      })
    }

    return commands
  },
}

// Level 4: CSRF Attack Handler
const level4Handler = {
  id: LEVEL_IDS.CSRF_ATTACK,

  getLevelCommands(gameState) {
    return [
      {
        id: COMMAND_IDS.ANALYZE_CSRF,
        name: "analyze-requests",
        description: "Analyze cross-origin requests",
        disabled: !gameState.currentNode || gameState.currentNode !== LEVEL_4_NODES.SECURITY_LOGS,
      },
      {
        id: COMMAND_IDS.FIX_CSRF,
        name: "enable-csrf-protection",
        description: "Implement CSRF token validation",
        disabled: !gameState.cluesFound.has(CLUE_IDS.MISSING_CSRF_VALIDATION),
      },
    ]
  },

  getToolCommands() {
    return []
  },
}

// Level 5: XSS Vulnerability Handler
const level5Handler = {
  id: LEVEL_IDS.XSS_VULNERABILITY,

  getLevelCommands(gameState) {
    return [
      {
        id: COMMAND_IDS.ANALYZE_XSS,
        name: "grep '<script>' db.log",
        description: "Search for injected scripts",
        disabled: !gameState.currentNode || gameState.currentNode !== LEVEL_5_NODES.DATABASE,
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

// Level 6: Authentication Bypass Handler
const level6Handler = {
  id: LEVEL_IDS.AUTH_BYPASS,

  getLevelCommands(gameState) {
    return [
      {
        id: COMMAND_IDS.CHECK_AUTH,
        name: "audit-auth-checks",
        description: "Audit authorization logic",
        disabled: !gameState.currentNode || gameState.currentNode !== LEVEL_6_NODES.AUDIT_LOG,
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

// Level 7: API Security Handler
const level7Handler = {
  id: LEVEL_IDS.API_SECURITY,

  getLevelCommands(gameState) {
    return [
      {
        id: COMMAND_IDS.ANALYZE_API,
        name: "api-security-audit",
        description: "Audit API security",
        disabled: !gameState.currentNode || gameState.currentNode !== LEVEL_7_NODES.API_DOCS,
      },
      {
        id: COMMAND_IDS.ADD_RATE_LIMIT,
        name: "enable-rate-limiting",
        description: "Add rate limiting",
        disabled: !gameState.cluesFound.has(CLUE_IDS.NO_RATE_LIMITS),
      },
      {
        id: COMMAND_IDS.FIX_IDOR,
        name: "fix-authorization",
        description: "Fix object-level authorization",
        disabled: !gameState.cluesFound.has(CLUE_IDS.IDOR_VULNERABILITY),
      },
      {
        id: COMMAND_IDS.FIX_DATA_EXPOSURE,
        name: "filter-sensitive-fields",
        description: "Filter sensitive data from responses",
        disabled: !gameState.cluesFound.has(CLUE_IDS.SENSITIVE_DATA_LEAK),
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
  [LEVEL_IDS.SQL_INJECTION]: level2Handler,
  [LEVEL_IDS.CERT_VALIDATION]: level3Handler,
  [LEVEL_IDS.CSRF_ATTACK]: level4Handler,
  [LEVEL_IDS.XSS_VULNERABILITY]: level5Handler,
  [LEVEL_IDS.AUTH_BYPASS]: level6Handler,
  [LEVEL_IDS.API_SECURITY]: level7Handler,
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

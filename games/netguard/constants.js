// Game constants for NetGuard

// Level IDs
export const LEVEL_IDS = {
  JWT_EXPIRATION: 1,
  XSS_VULNERABILITY: 2,
  AUTH_BYPASS: 3,
}

// Node IDs for Level 1 (JWT Expiration)
export const LEVEL_1_NODES = {
  GATEWAY: "gateway",
  AUTH: "auth",
  DATABASE: "database",
  WEB_SERVER: "webserver",
}

// Node IDs for Level 2 (XSS Vulnerability)
export const LEVEL_2_NODES = {
  COMMENT_SYSTEM: "comment-system",
  WEB_SERVER: "web-server",
  DATABASE: "database",
  VICTIM_BROWSER: "victim-browser",
}

// Node IDs for Level 3 (Authentication Bypass)
export const LEVEL_3_NODES = {
  ADMIN_PANEL: "admin-panel",
  API_SERVER: "api-server",
  SESSION_STORE: "session-store",
  AUDIT_LOG: "audit-log",
}

// Command IDs
export const COMMAND_IDS = {
  SCAN: "scan",
  LOGS: "logs",
  EXIT: "exit",
  // Level 1
  DECODE_JWT: "decode-jwt",
  ANALYZE_TOKENS: "analyze-tokens",
  FIX_JWT: "fix-jwt",
  // Level 2
  ANALYZE_XSS: "analyze-xss",
  FIX_XSS: "fix-xss",
  ADD_CSP: "add-csp",
  // Level 3
  CHECK_AUTH: "check-auth",
  FIX_AUTH: "fix-auth",
  FIX_SESSION: "fix-session",
}

// Clue IDs
export const CLUE_IDS = {
  // Level 1
  SUSPICIOUS_USER: "suspicious_user",
  EXPIRED_CONTRACTOR: "expired_contractor",
  AUTH_CONFIG: "auth_config",

  // Level 2
  UNSANITIZED_INPUT: "unsanitized_input",
  SCRIPT_INJECTION: "script_injection",
  MISSING_CSP: "missing_csp",

  // Level 3
  MISSING_AUTH_CHECK: "missing_auth_check",
  PRIVILEGE_ESCALATION: "privilege_escalation",
  INSECURE_SESSION: "insecure_session",
}

// Game state keys for localStorage
export const STORAGE_KEYS = {
  GAME_SAVE: "netguard_save",
  LEVEL_PROGRESS: "netguard_level_progress",
}

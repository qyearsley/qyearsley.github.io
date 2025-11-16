// Game constants for NetGuard

// Level IDs
export const LEVEL_IDS = {
  JWT_EXPIRATION: 1,
  SQL_INJECTION: 2,
  CSRF_ATTACK: 3,
  XSS_VULNERABILITY: 4,
  AUTH_BYPASS: 5,
  API_SECURITY: 6,
}

// Node IDs for Level 1 (JWT Expiration)
export const LEVEL_1_NODES = {
  GATEWAY: "gateway",
  AUTH: "auth",
  DATABASE: "database",
  WEB_SERVER: "webserver",
}

// Node IDs for Level 2 (SQL Injection)
export const LEVEL_2_NODES = {
  FIREWALL: "firewall",
  API_SERVER: "api-server",
  DATABASE: "database",
  REPO: "repo",
}

// Node IDs for Level 3 (CSRF Attack)
export const LEVEL_3_NODES = {
  WEB_APP: "web-app",
  API_BACKEND: "api-backend",
  USER_BROWSER: "user-browser",
  SECURITY_LOGS: "security-logs",
}

// Node IDs for Level 4 (XSS Vulnerability)
export const LEVEL_4_NODES = {
  COMMENT_SYSTEM: "comment-system",
  WEB_SERVER: "web-server",
  DATABASE: "database",
  VICTIM_BROWSER: "victim-browser",
  ATTACKER_SERVER: "attacker-server",
}

// Node IDs for Level 5 (Authentication Bypass)
export const LEVEL_5_NODES = {
  ADMIN_PANEL: "admin-panel",
  API_SERVER: "api-server",
  SESSION_STORE: "session-store",
  AUDIT_LOG: "audit-log",
}

// Node IDs for Level 6 (API Security)
export const LEVEL_6_NODES = {
  API_GATEWAY: "api-gateway",
  USER_API: "user-api",
  AUTHORIZATION: "authorization",
  API_DOCS: "api-docs",
  MONITORING: "monitoring",
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
  TEST_SQL: "test-sql",
  VIEW_SOURCE: "view-source",
  FIX_SQL: "fix-sql",
  FIX_SECRETS: "fix-secrets",
  // Level 3
  ANALYZE_CSRF: "analyze-csrf",
  FIX_CSRF: "fix-csrf",
  // Level 4
  ANALYZE_XSS: "analyze-xss",
  FIX_XSS: "fix-xss",
  ADD_CSP: "add-csp",
  // Level 5
  CHECK_AUTH: "check-auth",
  FIX_AUTH: "fix-auth",
  FIX_SESSION: "fix-session",
  // Level 6
  ANALYZE_API: "analyze-api",
  ADD_RATE_LIMIT: "add-rate-limit",
  FIX_IDOR: "fix-idor",
  FIX_DATA_EXPOSURE: "fix-data-exposure",
}

// Clue IDs
export const CLUE_IDS = {
  // Level 1
  SUSPICIOUS_USER: "suspicious_user",
  EXPIRED_CONTRACTOR: "expired_contractor",
  AUTH_CONFIG: "auth_config",

  // Level 2
  INJECTABLE_ENDPOINT: "injectable_endpoint",
  SOURCE_CODE_SECRETS: "source_code_secrets",
  SUSPICIOUS_QUERIES: "suspicious_queries",

  // Level 3
  FORGED_REQUEST: "forged_request",
  MISSING_CSRF_VALIDATION: "missing_csrf_validation",
  SUSPICIOUS_STATE_CHANGE: "suspicious_state_change",

  // Level 4
  UNSANITIZED_INPUT: "unsanitized_input",
  SCRIPT_INJECTION: "script_injection",
  MISSING_CSP: "missing_csp",

  // Level 5
  MISSING_AUTH_CHECK: "missing_auth_check",
  PRIVILEGE_ESCALATION: "privilege_escalation",
  INSECURE_SESSION: "insecure_session",

  // Level 6
  SENSITIVE_DATA_LEAK: "sensitive_data_leak",
  NO_RATE_LIMITS: "no_rate_limits",
  IDOR_VULNERABILITY: "idor_vulnerability",
}

// Game state keys for localStorage
export const STORAGE_KEYS = {
  GAME_SAVE: "netguard_save",
}

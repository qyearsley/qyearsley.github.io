// Level definitions for different scenarios
export const LEVELS = {
  1: {
    id: 1,
    name: "Expired Credentials",
    description: "A contractor's token still works months after contract ended",
    difficulty: "Beginner",
    concepts: ["JWT tokens", "Token expiration"],
    vulnerabilities: ["jwt_expiration"],
    requiredClues: ["suspicious_user", "expired_contractor", "auth_config"],
    clueDescriptions: {
      suspicious_user: 'Suspicious activity from "contractor_mike_2024"',
      expired_contractor: "Contractor ended employment in March 2024",
      auth_config: "JWT expiration checking is disabled",
    },
    resources: [
      {
        title: "OWASP: JSON Web Token Cheat Sheet",
        url: "https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html",
      },
      {
        title: "JWT.io - Introduction to JWT",
        url: "https://jwt.io/introduction",
      },
    ],
  },
  2: {
    id: 2,
    name: "SQL Injection & Secrets",
    description: "API vulnerable to SQL injection with hardcoded credentials",
    difficulty: "Intermediate",
    concepts: ["SQL injection", "Parameterized queries", "Secret management"],
    vulnerabilities: ["sql_injection", "hardcoded_credentials"],
    requiredClues: ["injectable_endpoint", "source_code_secrets", "suspicious_queries"],
    clueDescriptions: {
      injectable_endpoint: "API endpoint vulnerable to SQL injection",
      source_code_secrets: "Hardcoded credentials in source code",
      suspicious_queries: "Malicious SQL queries in database logs",
    },
    resources: [
      {
        title: "OWASP: SQL Injection",
        url: "https://owasp.org/www-community/attacks/SQL_Injection",
      },
      {
        title: "OWASP: Secrets Management",
        url: "https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html",
      },
    ],
  },
  3: {
    id: 3,
    name: "CSRF Attack",
    description: "State-changing requests can be forged by attackers",
    difficulty: "Intermediate",
    concepts: ["CSRF tokens", "Same-origin policy", "Request validation"],
    vulnerabilities: ["csrf_protection", "missing_csrf_token"],
    requiredClues: ["forged_request", "missing_csrf_validation", "suspicious_state_change"],
    clueDescriptions: {
      forged_request: "Unauthorized request from external origin",
      missing_csrf_validation: "CSRF token validation not implemented",
      suspicious_state_change: "Account modifications without authorization",
    },
    resources: [
      {
        title: "OWASP: CSRF Prevention",
        url: "https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html",
      },
    ],
  },
  4: {
    id: 4,
    name: "XSS Vulnerability",
    description: "User input reflected in page without sanitization",
    difficulty: "Intermediate",
    concepts: ["Cross-Site Scripting", "Input sanitization", "Content Security Policy"],
    vulnerabilities: ["stored_xss", "reflected_xss"],
    requiredClues: ["unsanitized_input", "script_injection", "missing_csp"],
    clueDescriptions: {
      unsanitized_input: "User input inserted into HTML without encoding",
      script_injection: "JavaScript execution from user data",
      missing_csp: "No Content Security Policy headers",
    },
    resources: [
      {
        title: "OWASP: XSS Prevention",
        url: "https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html",
      },
    ],
  },
  5: {
    id: 5,
    name: "Authentication Bypass",
    description: "Auth logic flaw allows unauthorized access to resources",
    difficulty: "Advanced",
    concepts: ["Authorization checks", "Session management", "Privilege escalation"],
    vulnerabilities: ["auth_bypass", "broken_access_control"],
    requiredClues: ["missing_auth_check", "privilege_escalation", "insecure_session"],
    clueDescriptions: {
      missing_auth_check: "Endpoint accessible without proper authorization",
      privilege_escalation: "Regular user can access admin functionality",
      insecure_session: "Session tokens are predictable",
    },
    resources: [
      {
        title: "OWASP: Broken Access Control",
        url: "https://owasp.org/Top10/A01_2021-Broken_Access_Control/",
      },
    ],
  },
  6: {
    id: 6,
    name: "API Security Flaws",
    description: "REST API exposes sensitive data and allows unauthorized ops",
    difficulty: "Advanced",
    concepts: ["Rate limiting", "Data exposure", "API security"],
    vulnerabilities: [
      "excessive_data_exposure",
      "missing_rate_limiting",
      "broken_object_authorization",
    ],
    requiredClues: ["sensitive_data_leak", "no_rate_limits", "idor_vulnerability"],
    clueDescriptions: {
      sensitive_data_leak: "API returns sensitive fields unnecessarily",
      no_rate_limits: "No rate limiting allows enumeration attacks",
      idor_vulnerability: "Access to other users' data (IDOR)",
    },
    resources: [
      {
        title: "OWASP API Security Top 10",
        url: "https://owasp.org/www-project-api-security/",
      },
    ],
  },
}

export const LEVEL_ORDER = [1, 2, 3, 4, 5, 6]

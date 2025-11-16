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
  3: {
    id: 3,
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
}

export const LEVEL_ORDER = [1, 2, 3]

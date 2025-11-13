// Level definitions for different scenarios
export const LEVELS = {
  1: {
    id: 1,
    name: "Expired Credentials",
    description: "A contractor's token is still working months after their contract ended",
    difficulty: "Beginner",
    concepts: ["JWT tokens", "Token expiration", "Access revocation"],
    vulnerabilities: ["jwt_expiration"],
    requiredClues: ["suspicious_user", "expired_contractor", "auth_config"],
    clueDescriptions: {
      suspicious_user: 'Suspicious activity from user "contractor_mike_2024"',
      expired_contractor: "Contractor ended employment in March 2024",
      auth_config: "JWT middleware configuration anomaly detected",
    },
    resources: [
      {
        title: "OWASP: JSON Web Token Cheat Sheet",
        url: "https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html"
      },
      {
        title: "JWT.io - Introduction to JWT",
        url: "https://jwt.io/introduction"
      },
      {
        title: "OWASP: Broken Access Control",
        url: "https://owasp.org/Top10/A01_2021-Broken_Access_Control/"
      }
    ],
  },
  2: {
    id: 2,
    name: "SQL Injection & Hardcoded Secrets",
    description:
      "Multiple security issues: injectable queries and credentials in source code",
    difficulty: "Intermediate",
    concepts: [
      "SQL injection",
      "Parameterized queries",
      "Secret management",
      "Code review",
    ],
    vulnerabilities: ["sql_injection", "hardcoded_credentials"],
    requiredClues: [
      "injectable_endpoint",
      "source_code_secrets",
      "suspicious_queries",
    ],
    clueDescriptions: {
      injectable_endpoint: "Found API endpoint vulnerable to SQL injection",
      source_code_secrets: "Discovered hardcoded credentials in source code",
      suspicious_queries: "Detected malicious SQL queries in database logs",
    },
    resources: [
      {
        title: "OWASP: SQL Injection",
        url: "https://owasp.org/www-community/attacks/SQL_Injection"
      },
      {
        title: "OWASP: SQL Injection Prevention Cheat Sheet",
        url: "https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html"
      },
      {
        title: "OWASP: Secrets Management Cheat Sheet",
        url: "https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html"
      }
    ],
  },
  3: {
    id: 3,
    name: "Certificate Validation Bypass",
    description:
      "TLS certificate validation disabled, allowing man-in-the-middle attacks",
    difficulty: "Advanced",
    concepts: [
      "TLS/HTTPS",
      "Certificate validation",
      "MITM attacks",
      "Trust chains",
    ],
    vulnerabilities: ["cert_validation", "mitm_attack"],
    requiredClues: [
      "disabled_cert_check",
      "suspicious_traffic",
      "invalid_certificate",
    ],
    clueDescriptions: {
      disabled_cert_check: "SSL certificate validation is disabled in config",
      suspicious_traffic: "Detected potential man-in-the-middle attack",
      invalid_certificate: "External API using self-signed certificate",
    },
    resources: [
      {
        title: "OWASP: Transport Layer Protection Cheat Sheet",
        url: "https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Protection_Cheat_Sheet.html"
      },
      {
        title: "OWASP: Man-in-the-Middle Attacks",
        url: "https://owasp.org/www-community/attacks/Man-in-the-middle_attack"
      },
      {
        title: "Mozilla: SSL/TLS Best Practices",
        url: "https://wiki.mozilla.org/Security/Server_Side_TLS"
      }
    ],
  },
  4: {
    id: 4,
    name: "CSRF Attack Vector",
    description:
      "State-changing requests can be forged by attackers, causing unauthorized actions",
    difficulty: "Intermediate",
    concepts: [
      "CSRF tokens",
      "Same-origin policy",
      "State-changing operations",
      "Request validation",
    ],
    vulnerabilities: ["csrf_protection", "missing_csrf_token"],
    requiredClues: [
      "forged_request",
      "missing_csrf_validation",
      "suspicious_state_change",
    ],
    clueDescriptions: {
      forged_request: "Detected unauthorized state-changing request from external origin",
      missing_csrf_validation: "CSRF token validation not implemented",
      suspicious_state_change: "User account modifications without proper authorization",
    },
    resources: [
      {
        title: "OWASP: Cross-Site Request Forgery Prevention Cheat Sheet",
        url: "https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html"
      },
      {
        title: "OWASP: CSRF",
        url: "https://owasp.org/www-community/attacks/csrf"
      },
      {
        title: "MDN: Same-origin policy",
        url: "https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy"
      }
    ],
  },
  5: {
    id: 5,
    name: "XSS Vulnerability",
    description:
      "User input is being reflected in the page without proper sanitization",
    difficulty: "Intermediate",
    concepts: [
      "Cross-Site Scripting (XSS)",
      "Input sanitization",
      "Content Security Policy",
      "DOM manipulation",
    ],
    vulnerabilities: ["stored_xss", "reflected_xss"],
    requiredClues: [
      "unsanitized_input",
      "script_injection",
      "missing_csp",
    ],
    clueDescriptions: {
      unsanitized_input: "User input directly inserted into HTML without encoding",
      script_injection: "JavaScript execution from user-controlled data",
      missing_csp: "No Content Security Policy headers configured",
    },
    resources: [
      {
        title: "OWASP: Cross Site Scripting (XSS)",
        url: "https://owasp.org/www-community/attacks/xss/"
      },
      {
        title: "OWASP: XSS Prevention Cheat Sheet",
        url: "https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html"
      },
      {
        title: "MDN: Content Security Policy",
        url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP"
      }
    ],
  },
  6: {
    id: 6,
    name: "Authentication Bypass",
    description:
      "Critical authentication logic flaw allows unauthorized access to protected resources",
    difficulty: "Advanced",
    concepts: [
      "Authentication flows",
      "Authorization checks",
      "Session management",
      "Privilege escalation",
    ],
    vulnerabilities: ["auth_bypass", "broken_access_control"],
    requiredClues: [
      "missing_auth_check",
      "privilege_escalation",
      "insecure_session",
    ],
    clueDescriptions: {
      missing_auth_check: "Protected endpoint accessible without authentication",
      privilege_escalation: "Regular user can access admin functionality",
      insecure_session: "Session tokens are predictable and can be forged",
    },
    resources: [
      {
        title: "OWASP: Broken Access Control",
        url: "https://owasp.org/Top10/A01_2021-Broken_Access_Control/"
      },
      {
        title: "OWASP: Authentication Cheat Sheet",
        url: "https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html"
      },
      {
        title: "OWASP: Session Management Cheat Sheet",
        url: "https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html"
      }
    ],
  },
  7: {
    id: 7,
    name: "API Security Flaws",
    description:
      "REST API exposes sensitive data and allows unauthorized operations",
    difficulty: "Advanced",
    concepts: [
      "API authentication",
      "Rate limiting",
      "Data exposure",
      "API security best practices",
    ],
    vulnerabilities: ["excessive_data_exposure", "missing_rate_limiting", "broken_object_authorization"],
    requiredClues: [
      "sensitive_data_leak",
      "no_rate_limits",
      "idor_vulnerability",
    ],
    clueDescriptions: {
      sensitive_data_leak: "API returns more data than necessary, including sensitive fields",
      no_rate_limits: "No rate limiting allows brute force and enumeration attacks",
      idor_vulnerability: "Insecure Direct Object Reference allows access to other users' data",
    },
    resources: [
      {
        title: "OWASP API Security Top 10",
        url: "https://owasp.org/www-project-api-security/"
      },
      {
        title: "OWASP: API Security Cheat Sheet",
        url: "https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html"
      },
      {
        title: "OWASP: Mass Assignment Cheat Sheet",
        url: "https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html"
      }
    ],
  },
};

export const LEVEL_ORDER = [1, 2, 3, 4, 5, 6, 7];

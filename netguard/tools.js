// Interactive tools for learning and exploitation

export class JWTDecoder {
  static decode(token) {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) {
        return { error: "Invalid JWT format. Expected 3 parts separated by dots." };
      }

      const header = JSON.parse(atob(parts[0]));
      const payload = JSON.parse(atob(parts[1]));
      const signature = parts[2];

      return {
        header,
        payload,
        signature,
        raw: { header: parts[0], payload: parts[1], signature },
      };
    } catch (e) {
      return { error: "Failed to decode JWT: " + e.message };
    }
  }

  static isExpired(payload) {
    if (!payload.exp) return { expired: false, reason: "No expiration claim" };

    const now = Math.floor(Date.now() / 1000);
    const expired = now > payload.exp;

    return {
      expired,
      exp: payload.exp,
      now,
      diff: now - payload.exp,
      expDate: new Date(payload.exp * 1000).toISOString(),
      nowDate: new Date(now * 1000).toISOString(),
    };
  }

  static formatDecoded(decoded) {
    if (decoded.error) return decoded.error;

    const expInfo = this.isExpired(decoded.payload);

    return `JWT Token Analysis:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HEADER:
${JSON.stringify(decoded.header, null, 2)}

PAYLOAD:
${JSON.stringify(decoded.payload, null, 2)}

SIGNATURE (base64):
${decoded.signature.substring(0, 40)}...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXPIRATION CHECK:
${expInfo.expired ? "❌ EXPIRED" : "✅ VALID"}
${expInfo.exp ? `Expiration: ${expInfo.expDate}` : "No expiration claim"}
Current time: ${expInfo.nowDate}
${expInfo.expired ? `Expired ${Math.floor(expInfo.diff / 86400)} days ago` : ""}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  }
}

export class SQLInjectionTester {
  static testPayload(payload, originalQuery) {
    // Educational SQL injection testing
    const dangerous = [
      "' OR '1'='1",
      "' OR 1=1--",
      "'; DROP TABLE",
      "' UNION SELECT",
      "admin'--",
    ];

    const isDangerous = dangerous.some((d) => payload.includes(d));

    if (isDangerous) {
      return {
        vulnerable: true,
        payload,
        originalQuery,
        exploitedQuery: originalQuery.replace("?", payload),
        explanation: `The query is vulnerable because user input is directly concatenated:

Original Query: ${originalQuery}
Exploited Query: ${originalQuery.replace("?", payload)}

The attacker's input breaks out of the string and adds their own SQL logic.`,
        fix: `Use parameterized queries instead:

❌ BAD:  query = "SELECT * FROM users WHERE username = '" + input + "'";
✅ GOOD: query = "SELECT * FROM users WHERE username = ?";
         db.execute(query, [input]);`,
      };
    }

    return {
      vulnerable: false,
      message: "This payload doesn't exploit the vulnerability.",
    };
  }

  static generateExamples() {
    return [
      { payload: "' OR '1'='1", description: "Bypass authentication" },
      { payload: "' OR 1=1--", description: "Comment out rest of query" },
      { payload: "admin'--", description: "Login as admin" },
      {
        payload: "' UNION SELECT password FROM users--",
        description: "Extract data",
      },
    ];
  }
}

export class CertificateValidator {
  static validate(certData) {
    const issues = [];

    // Check if self-signed
    if (certData.issuer === certData.subject) {
      issues.push({
        severity: "HIGH",
        issue: "Self-signed certificate",
        explanation:
          "Certificate is self-signed (issuer equals subject). This bypasses the trust chain.",
        risk: "Man-in-the-middle attacks cannot be detected.",
      });
    }

    // Check expiration
    const now = new Date();
    const notBefore = new Date(certData.notBefore);
    const notAfter = new Date(certData.notAfter);

    if (now < notBefore) {
      issues.push({
        severity: "HIGH",
        issue: "Certificate not yet valid",
        explanation: `Certificate validity starts ${notBefore.toISOString()}, but current time is ${now.toISOString()}`,
      });
    }

    if (now > notAfter) {
      issues.push({
        severity: "CRITICAL",
        issue: "Certificate expired",
        explanation: `Certificate expired on ${notAfter.toISOString()}`,
        risk: "Expired certificates should not be trusted.",
      });
    }

    // Check hostname
    if (certData.requestedHost && certData.certHost !== certData.requestedHost) {
      issues.push({
        severity: "CRITICAL",
        issue: "Hostname mismatch",
        explanation: `Certificate is for '${certData.certHost}' but connecting to '${certData.requestedHost}'`,
        risk: "Possible man-in-the-middle attack.",
      });
    }

    return {
      valid: issues.length === 0,
      issues,
      summary: `Found ${issues.length} issue(s) with certificate`,
    };
  }
}

export class InteractiveTools {
  static availableTools = {
    jwt_decoder: {
      name: "echo <token> | base64 -d",
      description: "Decode JWT token (base64 decode)",
      usage: "echo <token> | base64 -d",
    },
    sql_tester: {
      name: "psql -c",
      description: "Test SQL query (educational)",
      usage: "psql -c '<query>'",
    },
    cert_validator: {
      name: "openssl x509 -text",
      description: "Inspect SSL certificate",
      usage: "openssl x509 -in <cert> -text",
    },
  };

  static getToolsList() {
    return Object.values(this.availableTools)
      .map((tool) => `${tool.name.padEnd(30)} - ${tool.description}`)
      .join("\n");
  }
}

import { describe, test, expect } from "@jest/globals";
import {
  JWTDecoder,
  SQLInjectionTester,
  CertificateValidator,
  InteractiveTools,
} from "./tools.js";

describe("JWTDecoder", () => {
  const validToken =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE3MDkyNTEyMDB9.xxx";

  test("should decode valid JWT token", () => {
    const decoded = JWTDecoder.decode(validToken);

    expect(decoded.error).toBeUndefined();
    expect(decoded.header).toBeDefined();
    expect(decoded.payload).toBeDefined();
    expect(decoded.signature).toBeDefined();
    expect(decoded.header.alg).toBe("HS256");
    expect(decoded.payload.sub).toBe("1234567890");
  });

  test("should handle invalid JWT format", () => {
    const result = JWTDecoder.decode("invalid.token");
    expect(result.error).toBeDefined();
    expect(result.error).toContain("3 parts");
  });

  test("should handle malformed base64", () => {
    const result = JWTDecoder.decode("not.valid.base64!!!");
    expect(result.error).toBeDefined();
  });

  test("should detect expired tokens", () => {
    const payload = {
      sub: "user123",
      exp: 1609459200, // Jan 1, 2021
    };

    const result = JWTDecoder.isExpired(payload);

    expect(result.expired).toBe(true);
    expect(result.exp).toBe(1609459200);
    expect(result.diff).toBeGreaterThan(0);
  });

  test("should detect valid (non-expired) tokens", () => {
    const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const payload = {
      sub: "user123",
      exp: futureTime,
    };

    const result = JWTDecoder.isExpired(payload);

    expect(result.expired).toBe(false);
  });

  test("should handle missing expiration claim", () => {
    const payload = {
      sub: "user123",
    };

    const result = JWTDecoder.isExpired(payload);

    expect(result.expired).toBe(false);
    expect(result.reason).toContain("No expiration");
  });

  test("should format decoded token correctly", () => {
    const decoded = JWTDecoder.decode(validToken);
    const formatted = JWTDecoder.formatDecoded(decoded);

    expect(formatted).toContain("JWT Token Analysis");
    expect(formatted).toContain("HEADER");
    expect(formatted).toContain("PAYLOAD");
    expect(formatted).toContain("SIGNATURE");
    expect(formatted).toContain("EXPIRATION CHECK");
  });

  test("should format error message", () => {
    const error = { error: "Test error message" };
    const formatted = JWTDecoder.formatDecoded(error);

    expect(formatted).toBe("Test error message");
  });
});

describe("SQLInjectionTester", () => {
  const baseQuery = "SELECT * FROM users WHERE username = '?'";

  test("should detect SQL injection with OR 1=1", () => {
    const result = SQLInjectionTester.testPayload("' OR '1'='1", baseQuery);

    expect(result.vulnerable).toBe(true);
    expect(result.payload).toBe("' OR '1'='1");
    expect(result.explanation).toContain("vulnerable");
    expect(result.fix).toContain("parameterized");
  });

  test("should detect SQL injection with comment", () => {
    const result = SQLInjectionTester.testPayload("admin'--", baseQuery);

    expect(result.vulnerable).toBe(true);
    expect(result.explanation).toContain("breaks out");
  });

  test("should detect UNION attacks", () => {
    const result = SQLInjectionTester.testPayload("' UNION SELECT", baseQuery);

    expect(result.vulnerable).toBe(true);
  });

  test("should detect DROP TABLE attempts", () => {
    const result = SQLInjectionTester.testPayload("'; DROP TABLE users", baseQuery);

    expect(result.vulnerable).toBe(true);
  });

  test("should return safe for non-malicious input", () => {
    const result = SQLInjectionTester.testPayload("normal_username", baseQuery);

    expect(result.vulnerable).toBe(false);
    expect(result.message).toBeDefined();
  });

  test("should generate example payloads", () => {
    const examples = SQLInjectionTester.generateExamples();

    expect(examples).toBeInstanceOf(Array);
    expect(examples.length).toBeGreaterThan(0);
    examples.forEach((ex) => {
      expect(ex).toHaveProperty("payload");
      expect(ex).toHaveProperty("description");
    });
  });
});

describe("CertificateValidator", () => {
  test("should detect self-signed certificates", () => {
    const cert = {
      subject: "example.com",
      issuer: "example.com", // Self-signed
      notBefore: "2024-01-01T00:00:00Z",
      notAfter: "2025-01-01T00:00:00Z",
    };

    const result = CertificateValidator.validate(cert);

    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues[0].issue).toContain("Self-signed");
    expect(result.issues[0].severity).toBe("HIGH");
  });

  test("should detect expired certificates", () => {
    const cert = {
      subject: "example.com",
      issuer: "TrustedCA",
      notBefore: "2020-01-01T00:00:00Z",
      notAfter: "2021-01-01T00:00:00Z", // Expired
    };

    const result = CertificateValidator.validate(cert);

    expect(result.valid).toBe(false);
    const expiredIssue = result.issues.find((i) => i.issue.includes("expired"));
    expect(expiredIssue).toBeDefined();
    expect(expiredIssue.severity).toBe("CRITICAL");
  });

  test("should detect not-yet-valid certificates", () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 2);

    const cert = {
      subject: "example.com",
      issuer: "TrustedCA",
      notBefore: futureDate.toISOString(),
      notAfter: new Date(futureDate.getTime() + 31536000000).toISOString(),
    };

    const result = CertificateValidator.validate(cert);

    expect(result.valid).toBe(false);
    const notYetValidIssue = result.issues.find((i) => i.issue.includes("not yet valid"));
    expect(notYetValidIssue).toBeDefined();
  });

  test("should detect hostname mismatch", () => {
    const cert = {
      subject: "example.com",
      issuer: "TrustedCA",
      certHost: "example.com",
      requestedHost: "evil.com",
      notBefore: "2024-01-01T00:00:00Z",
      notAfter: "2025-12-31T00:00:00Z",
    };

    const result = CertificateValidator.validate(cert);

    expect(result.valid).toBe(false);
    const hostnameMismatch = result.issues.find((i) => i.issue.includes("Hostname mismatch"));
    expect(hostnameMismatch).toBeDefined();
    expect(hostnameMismatch.severity).toBe("CRITICAL");
    expect(hostnameMismatch.risk).toContain("man-in-the-middle");
  });

  test("should validate correct certificates", () => {
    const cert = {
      subject: "example.com",
      issuer: "TrustedCA",
      notBefore: "2024-01-01T00:00:00Z",
      notAfter: "2025-12-31T00:00:00Z",
    };

    const result = CertificateValidator.validate(cert);

    expect(result.valid).toBe(true);
    expect(result.issues.length).toBe(0);
  });
});

describe("InteractiveTools", () => {
  test("should list all available tools", () => {
    const tools = InteractiveTools.availableTools;

    expect(tools).toHaveProperty("jwt_decoder");
    expect(tools).toHaveProperty("sql_tester");
    expect(tools).toHaveProperty("cert_validator");
  });

  test("should provide tool descriptions", () => {
    Object.values(InteractiveTools.availableTools).forEach((tool) => {
      expect(tool).toHaveProperty("name");
      expect(tool).toHaveProperty("description");
      expect(tool).toHaveProperty("usage");
    });
  });

  test("should format tools list correctly", () => {
    const list = InteractiveTools.getToolsList();

    expect(list).toContain("base64 -d");
    expect(list).toContain("psql -c");
    expect(list).toContain("openssl x509");
  });
});

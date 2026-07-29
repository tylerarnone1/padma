import { describe, expect, it } from "vitest";
import { createContentSecurityPolicy } from "./content-security-policy";

describe("content security policy", () => {
  it("supports Next development styles and embedded development fonts", () => {
    const policy = createContentSecurityPolicy(
      "development-nonce",
      "development",
    );

    expect(policy).toContain("style-src 'self' 'unsafe-inline'");
    expect(policy).not.toContain(
      "style-src 'self' 'nonce-development-nonce'",
    );
    expect(policy).toContain("font-src 'self' data:");
    expect(policy).toContain("'unsafe-eval'");
    expect(policy).not.toContain("upgrade-insecure-requests");
  });

  it("keeps production styles nonce-protected and fonts same-origin", () => {
    const policy = createContentSecurityPolicy(
      "production-nonce",
      "production",
    );

    expect(policy).toContain(
      "style-src 'self' 'nonce-production-nonce'",
    );
    expect(policy).not.toContain("'unsafe-inline'");
    expect(policy).toContain("font-src 'self'");
    expect(policy).not.toContain("font-src 'self' data:");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).toContain("upgrade-insecure-requests");
  });
});

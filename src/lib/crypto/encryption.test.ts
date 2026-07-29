import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  environment: vi.fn(),
}));

vi.mock("@/lib/env/server", () => ({
  getServerEnvironment: mocks.environment,
}));

import { decryptSecret, encryptSecret } from "./encryption";

describe("integration secret encryption", () => {
  beforeEach(() => {
    mocks.environment.mockReturnValue({
      INTEGRATION_ENCRYPTION_KEY:
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    });
  });

  it("round-trips with authenticated encryption and a unique IV", () => {
    const first = encryptSecret("secret-value");
    const second = encryptSecret("secret-value");

    expect(first).not.toBe(second);
    expect(decryptSecret(first)).toBe("secret-value");
    expect(decryptSecret(second)).toBe("secret-value");
  });

  it("rejects malformed and tampered ciphertext", () => {
    expect(() => decryptSecret("not-an-envelope")).toThrow(
      "unsupported format",
    );

    const encrypted = encryptSecret("secret-value");
    const parts = encrypted.split(".");
    const ciphertext = parts[3] ?? "";
    parts[3] = `${ciphertext.startsWith("A") ? "B" : "A"}${ciphertext.slice(1)}`;
    expect(() => decryptSecret(parts.join("."))).toThrow();
  });

  it("rejects a configured key with the wrong decoded length", () => {
    mocks.environment.mockReturnValue({
      INTEGRATION_ENCRYPTION_KEY: "too-short",
    });

    expect(() => encryptSecret("secret-value")).toThrow(
      "base64url-encoded 32-byte key",
    );
  });
});

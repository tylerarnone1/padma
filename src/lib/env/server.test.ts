import { describe, expect, it } from "vitest";
import {
  parseServerEnvironment,
  requireConfiguredAuthSecret,
} from "./server";

describe("server environment", () => {
  it("treats blank optional values as unconfigured", () => {
    const environment = parseServerEnvironment({
      APP_URL: "http://localhost:3000",
      AUTH_MODE: "mock",
      NODE_ENV: "development",
      BETTER_AUTH_SECRET: "",
      INTEGRATION_ENCRYPTION_KEY: "",
      GITHUB_CLIENT_ID: "",
      GITHUB_CLIENT_SECRET: "",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
      OTEL_EXPORTER_OTLP_ENDPOINT: "",
    });

    expect(environment.AUTH_MODE).toBe("mock");
    expect(environment.BETTER_AUTH_SECRET).toBeUndefined();
    expect(environment.GITHUB_CLIENT_ID).toBeUndefined();
    expect(environment.OTEL_EXPORTER_OTLP_ENDPOINT).toBeUndefined();
  });

  it("still requires real secrets in production", () => {
    expect(() =>
      parseServerEnvironment({
        APP_URL: "https://padma.example",
        AUTH_MODE: "mock",
        NODE_ENV: "production",
        BETTER_AUTH_SECRET: "",
        INTEGRATION_ENCRYPTION_KEY: "",
      }),
    ).toThrow("BETTER_AUTH_SECRET is required in production");
  });

  it("refuses mock authentication on a public application origin", () => {
    // Both AUTH_MODE and NODE_ENV default to their development values, so a
    // deployment that sets neither must not inherit mock authentication.
    expect(() =>
      parseServerEnvironment({
        APP_URL: "https://padma.example",
        AUTH_MODE: "mock",
        // The value an unset NODE_ENV resolves to.
        NODE_ENV: "development",
      }),
    ).toThrow('AUTH_MODE="mock" requires a loopback APP_URL');
  });

  it("allows mock authentication on either loopback alias", () => {
    for (const appUrl of [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]) {
      expect(
        parseServerEnvironment({
          APP_URL: appUrl,
          AUTH_MODE: "mock",
          NODE_ENV: "development",
        }).AUTH_MODE,
      ).toBe("mock");
    }
  });

  it("rejects a trusted origin that is not a bare http(s) origin", () => {
    for (const origin of [
      "not-a-url",
      "https://app.example/admin",
      "https://user:pass@app.example",
      "ftp://app.example",
    ]) {
      expect(() =>
        parseServerEnvironment({
          APP_URL: "https://padma.example",
          AUTH_MODE: "oauth",
          NODE_ENV: "development",
          TRUSTED_ORIGINS: origin,
        }),
      ).toThrow("TRUSTED_ORIGINS");
    }
  });

  it("accepts a comma-separated list of bare origins", () => {
    const environment = parseServerEnvironment({
      APP_URL: "https://padma.example",
      AUTH_MODE: "oauth",
      NODE_ENV: "development",
      TRUSTED_ORIGINS: "https://preview.example, https://staging.example",
    });

    expect(environment.TRUSTED_ORIGINS).toContain("preview.example");
  });

  it("does not invent a different authentication secret per server module", () => {
    expect(() => requireConfiguredAuthSecret(undefined)).toThrow(
      "BETTER_AUTH_SECRET is missing",
    );
    expect(requireConfiguredAuthSecret("configured-process-secret")).toBe(
      "configured-process-secret",
    );
  });
});

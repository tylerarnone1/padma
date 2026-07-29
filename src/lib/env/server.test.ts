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

  it("does not invent a different authentication secret per server module", () => {
    expect(() => requireConfiguredAuthSecret(undefined)).toThrow(
      "BETTER_AUTH_SECRET is missing",
    );
    expect(requireConfiguredAuthSecret("configured-process-secret")).toBe(
      "configured-process-secret",
    );
  });
});

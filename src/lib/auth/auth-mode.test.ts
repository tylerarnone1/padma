import { describe, expect, it } from "vitest";
import { isDevelopmentAuthEnabled } from "./auth-mode";

describe("development authentication boundary", () => {
  it("enables the mock account only for a local development origin", () => {
    expect(
      isDevelopmentAuthEnabled({
        APP_URL: "http://localhost:3000",
        AUTH_MODE: "mock",
        NODE_ENV: "development",
      }),
    ).toBe(true);
  });

  it.each([
    {
      APP_URL: "https://padma.example",
      AUTH_MODE: "mock",
      NODE_ENV: "development",
    },
    {
      APP_URL: "http://localhost:3000",
      AUTH_MODE: "mock",
      NODE_ENV: "production",
    },
    {
      APP_URL: "http://localhost:3000",
      AUTH_MODE: "oauth",
      NODE_ENV: "development",
    },
  ] as const)(
    "fails closed for non-development configuration %#",
    (environment) => {
      expect(isDevelopmentAuthEnabled(environment)).toBe(false);
    },
  );
});

import { describe, expect, it } from "vitest";
import {
  createDevelopmentSessionToken,
  DEVELOPMENT_SESSION_COOKIE,
  hasValidDevelopmentSessionCookie,
} from "./development-session-cookie";

const secret = "development-cookie-test-secret";

describe("development session cookie", () => {
  it("accepts only the integrity-protected token", () => {
    const token = createDevelopmentSessionToken(secret);
    const headers = new Headers({
      cookie: `theme=dark; ${DEVELOPMENT_SESSION_COOKIE}=${token}`,
    });

    expect(hasValidDevelopmentSessionCookie(headers, secret)).toBe(true);
  });

  it.each([
    new Headers(),
    new Headers({ cookie: `${DEVELOPMENT_SESSION_COOKIE}=tampered` }),
    new Headers({
      cookie: `${DEVELOPMENT_SESSION_COOKIE}=${createDevelopmentSessionToken("wrong-secret")}`,
    }),
  ])("rejects missing or invalid cookie state", (headers) => {
    expect(hasValidDevelopmentSessionCookie(headers, secret)).toBe(false);
  });
});

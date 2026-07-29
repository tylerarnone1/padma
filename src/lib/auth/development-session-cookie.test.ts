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

  it("rejects a token whose signed expiry has passed", () => {
    const now = Date.UTC(2026, 6, 29, 12, 0, 0);
    const token = createDevelopmentSessionToken(secret, now - 1);
    const headers = new Headers({
      cookie: `${DEVELOPMENT_SESSION_COOKIE}=${token}`,
    });

    // The lifetime is inside the signature, so discarding the cookie's Max-Age
    // does not extend it.
    expect(hasValidDevelopmentSessionCookie(headers, secret, now)).toBe(false);
    expect(
      hasValidDevelopmentSessionCookie(headers, secret, now - 60_000),
    ).toBe(true);
  });

  it("rejects an expiry that was edited after signing", () => {
    const now = Date.UTC(2026, 6, 29, 12, 0, 0);
    const token = createDevelopmentSessionToken(secret, now - 1);
    const [version, accountId, , signature] = token.split(".");
    const extended = [version, accountId, String(now + 60_000), signature].join(
      ".",
    );

    expect(
      hasValidDevelopmentSessionCookie(
        new Headers({ cookie: `${DEVELOPMENT_SESSION_COOKIE}=${extended}` }),
        secret,
        now,
      ),
    ).toBe(false);
  });

  it("rejects a token that is missing its expiry segment", () => {
    expect(
      hasValidDevelopmentSessionCookie(
        new Headers({
          cookie: `${DEVELOPMENT_SESSION_COOKIE}=v2.account.signature`,
        }),
        secret,
      ),
    ).toBe(false);
  });
});

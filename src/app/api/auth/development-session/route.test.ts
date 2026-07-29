import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getEnvironment: vi.fn(),
  getAuthSecret: vi.fn(),
  getDevelopmentSession: vi.fn(),
  createToken: vi.fn(),
  assertWithinRateLimit: vi.fn(),
  getTrustedOrigins: vi.fn(),
}));

vi.mock("@/lib/http/rate-limit", () => ({
  assertWithinRateLimit: mocks.assertWithinRateLimit,
  rateLimitKey: (scope: string, subject: string) => `${scope}:${subject}`,
  rateLimitSubject: () => "address:test",
}));

vi.mock("@/lib/env/server", () => ({
  getServerEnvironment: mocks.getEnvironment,
  getAuthSecret: mocks.getAuthSecret,
  getTrustedOrigins: mocks.getTrustedOrigins,
}));

vi.mock("@/lib/auth/development-session", () => ({
  getDevelopmentSession: mocks.getDevelopmentSession,
}));

vi.mock("@/lib/auth/development-session-cookie", () => ({
  DEVELOPMENT_SESSION_COOKIE: "padma.development-session",
  createDevelopmentSessionToken: mocks.createToken,
}));

vi.mock("@/lib/logging/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { POST } from "./route";

function request(
  origin: string,
  requestOrigin = origin,
  host?: string,
): Request {
  return new Request(`${requestOrigin}/api/auth/development-session`, {
    method: "POST",
    headers: {
      ...(host ? { host } : {}),
      origin,
      "sec-fetch-site": "same-origin",
    },
  });
}

describe("development session route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.assertWithinRateLimit.mockResolvedValue(undefined);
    mocks.getTrustedOrigins.mockReturnValue(["http://localhost:3000"]);
    mocks.getEnvironment.mockReturnValue({
      APP_URL: "http://localhost:3000",
      AUTH_MODE: "mock",
      NODE_ENV: "development",
    });
    mocks.getAuthSecret.mockReturnValue("random-development-secret");
    mocks.getDevelopmentSession.mockResolvedValue({});
    mocks.createToken.mockReturnValue("signed-token");
  });

  it("rejects a non-loopback request even when APP_URL is loopback", async () => {
    const response = await POST(request("http://192.168.1.20:3000"));

    expect(response.status).toBe(404);
    expect(mocks.getDevelopmentSession).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("sets the guarded cookie for an explicit loopback login", async () => {
    const response = await POST(request("http://localhost:3000"));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/dashboard",
    );
    expect(response.headers.get("set-cookie")).toContain(
      "padma.development-session=signed-token",
    );
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
  });

  it("keeps the cookie and redirect on the browser's loopback alias", async () => {
    const response = await POST(
      request(
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "127.0.0.1:3000",
      ),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://127.0.0.1:3000/dashboard",
    );
    expect(response.headers.get("set-cookie")).toContain(
      "padma.development-session=signed-token",
    );
  });
});

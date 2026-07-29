import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authGetSession: vi.fn(),
  developmentGetSession: vi.fn(),
  hasDevelopmentCookie: vi.fn(),
  getAuthSecret: vi.fn(() => "test-auth-secret"),
  getEnvironment: vi.fn(),
  requestHeaders: new Headers({
    "x-test": "session",
    "x-padma-request-host": "localhost",
  }),
}));

vi.mock("@/lib/auth/auth", () => ({
  auth: {
    api: {
      getSession: mocks.authGetSession,
    },
  },
}));

vi.mock("@/lib/auth/development-session", () => ({
  getDevelopmentSession: mocks.developmentGetSession,
}));

vi.mock("@/lib/auth/development-session-cookie", () => ({
  hasValidDevelopmentSessionCookie: mocks.hasDevelopmentCookie,
}));

vi.mock("@/lib/env/server", () => ({
  getAuthSecret: mocks.getAuthSecret,
  getServerEnvironment: mocks.getEnvironment,
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => mocks.requestHeaders),
}));

import {
  assertRecentMfa,
  getCurrentSession,
  hasRecentMfa,
} from "./session";

describe("session adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the fixture only after an explicit guarded development login", async () => {
    const fixtureSession = { session: { id: "development-session" } };
    mocks.getEnvironment.mockReturnValue({
      APP_URL: "http://localhost:3000",
      AUTH_MODE: "mock",
      NODE_ENV: "development",
    });
    mocks.hasDevelopmentCookie.mockReturnValue(true);
    mocks.developmentGetSession.mockResolvedValue(fixtureSession);

    await expect(getCurrentSession()).resolves.toBe(fixtureSession);
    expect(mocks.hasDevelopmentCookie).toHaveBeenCalledWith(
      mocks.requestHeaders,
      "test-auth-secret",
    );
    expect(mocks.developmentGetSession).toHaveBeenCalledOnce();
    expect(mocks.authGetSession).not.toHaveBeenCalled();
  });

  it("remains signed out in mock mode until the login cookie is present", async () => {
    mocks.getEnvironment.mockReturnValue({
      APP_URL: "http://localhost:3000",
      AUTH_MODE: "mock",
      NODE_ENV: "development",
    });
    mocks.hasDevelopmentCookie.mockReturnValue(false);

    await expect(getCurrentSession()).resolves.toBeNull();
    expect(mocks.developmentGetSession).not.toHaveBeenCalled();
    expect(mocks.authGetSession).not.toHaveBeenCalled();
  });

  it("delegates to Better Auth when any development guard is absent", async () => {
    const providerSession = { session: { id: "provider-session" } };
    mocks.getEnvironment.mockReturnValue({
      APP_URL: "https://padma.example",
      AUTH_MODE: "mock",
      NODE_ENV: "production",
    });
    mocks.authGetSession.mockResolvedValue(providerSession);

    await expect(
      getCurrentSession(mocks.requestHeaders),
    ).resolves.toBe(providerSession);
    expect(mocks.authGetSession).toHaveBeenCalledWith({
      headers: mocks.requestHeaders,
    });
    expect(mocks.hasDevelopmentCookie).not.toHaveBeenCalled();
    expect(mocks.developmentGetSession).not.toHaveBeenCalled();
  });

  it("does not honor the development cookie on a non-loopback request", async () => {
    mocks.getEnvironment.mockReturnValue({
      APP_URL: "http://localhost:3000",
      AUTH_MODE: "mock",
      NODE_ENV: "development",
    });
    mocks.authGetSession.mockResolvedValue(null);
    const remoteHeaders = new Headers({
      cookie: "padma.development-session=valid-looking-cookie",
      "x-padma-request-host": "192.168.1.20",
    });

    await expect(getCurrentSession(remoteHeaders)).resolves.toBeNull();
    expect(mocks.hasDevelopmentCookie).not.toHaveBeenCalled();
    expect(mocks.developmentGetSession).not.toHaveBeenCalled();
    expect(mocks.authGetSession).toHaveBeenCalledWith({
      headers: remoteHeaders,
    });
  });
});

describe("recent MFA policy", () => {
  function session(input: {
    enabled: boolean;
    verifiedAt: Date | null;
  }): Parameters<typeof hasRecentMfa>[0] {
    return {
      user: {
        twoFactorEnabled: input.enabled,
      },
      session: {
        mfaVerifiedAt: input.verifiedAt,
      },
    } as Parameters<typeof hasRecentMfa>[0];
  }

  it("requires enrollment instead of treating a missing factor as verified", () => {
    const unenrolled = session({ enabled: false, verifiedAt: null });

    expect(hasRecentMfa(unenrolled)).toBe(false);
    expect(() => assertRecentMfa(unenrolled)).toThrow(
      "Multi-factor authentication must be configured",
    );
  });

  it("accepts only a recent verification timestamp", () => {
    const recent = session({
      enabled: true,
      verifiedAt: new Date(Date.now() - 60_000),
    });
    const stale = session({
      enabled: true,
      verifiedAt: new Date(Date.now() - 16 * 60_000),
    });
    const implausiblyFuture = session({
      enabled: true,
      verifiedAt: new Date(Date.now() + 5 * 60_000),
    });

    expect(hasRecentMfa(recent)).toBe(true);
    expect(() => assertRecentMfa(recent)).not.toThrow();
    expect(hasRecentMfa(stale)).toBe(false);
    expect(() => assertRecentMfa(stale)).toThrow(
      "Recent multi-factor verification is required",
    );
    expect(hasRecentMfa(implausiblyFuture)).toBe(false);
  });
});

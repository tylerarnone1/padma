import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authGetSession: vi.fn(),
  developmentGetSession: vi.fn(),
  hasDevelopmentCookie: vi.fn(),
  getAuthSecret: vi.fn(() => "test-auth-secret"),
  getEnvironment: vi.fn(),
  requestHeaders: new Headers({ "x-test": "session" }),
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

import { getCurrentSession } from "./session";

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
});

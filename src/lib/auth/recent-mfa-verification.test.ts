import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  sessionUpdateMany: vi.fn(),
  twoFactorUpdateMany: vi.fn(),
  twoFactorFindUnique: vi.fn(),
  auditCreate: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  database: {
    $transaction: mocks.transaction,
    twoFactor: { findUnique: mocks.twoFactorFindUnique },
  },
}));

vi.mock("@/lib/logging/logger", () => ({
  logger: { error: mocks.loggerError, warn: vi.fn(), info: vi.fn() },
}));

import {
  isMfaVerificationPath,
  isSuccessfulMfaVerification,
  parseVerifiedSession,
  recordMfaVerificationResult,
} from "./recent-mfa-verification";

/**
 * The real shape of a successful step-up response. Better Auth echoes the
 * session token and the user; it does not populate the hook's session
 * snapshots on this path.
 */
function successfulResponse(token = "session-token-1", userId = "user-1") {
  return { token, user: { id: userId } };
}

describe("recent MFA verification result", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessionUpdateMany.mockResolvedValue({ count: 1 });
    mocks.twoFactorUpdateMany.mockResolvedValue({ count: 1 });
    mocks.twoFactorFindUnique.mockResolvedValue(null);
    mocks.auditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation(
      (callback: (transaction: unknown) => unknown) =>
        callback({
          session: { updateMany: mocks.sessionUpdateMany },
          twoFactor: { updateMany: mocks.twoFactorUpdateMany },
          auditEvent: { create: mocks.auditCreate },
        }),
    );
  });

  it.each([
    "/two-factor/verify-totp",
    "/two-factor/verify-otp",
    "/two-factor/verify-backup-code",
  ])("recognizes %s as an MFA verification route", (path) => {
    expect(isMfaVerificationPath(path)).toBe(true);
  });

  it("accepts only a completed successful verification response", () => {
    expect(
      isSuccessfulMfaVerification({
        path: "/two-factor/verify-totp",
        returned: successfulResponse(),
      }),
    ).toBe(true);

    expect(
      isSuccessfulMfaVerification({
        path: "/two-factor/verify-totp",
        returned: new APIError("UNAUTHORIZED", { message: "Invalid code" }),
      }),
    ).toBe(false);

    expect(
      isSuccessfulMfaVerification({
        path: "/two-factor/verify-totp",
        returned: undefined,
      }),
    ).toBe(false);

    expect(
      isSuccessfulMfaVerification({
        path: "/sign-in/social",
        returned: successfulResponse(),
      }),
    ).toBe(false);
  });

  it("reads the verified session from the response body", () => {
    expect(parseVerifiedSession(successfulResponse("token-9", "user-9"))).toEqual(
      { token: "token-9", user: { id: "user-9" } },
    );
    expect(parseVerifiedSession({ status: true })).toBeNull();
    expect(parseVerifiedSession(undefined)).toBeNull();
  });

  /**
   * Regression: step-up verification for an already-enrolled user populates
   * neither `newSession` nor `session`, because the endpoint declares no
   * session middleware and does not rotate the cookie. Stamping from those
   * snapshots recorded recency at enrollment and never again, which left
   * every step-up gate permanently denying.
   */
  it("stamps recency from the response token when no session snapshot exists", async () => {
    await recordMfaVerificationResult({
      path: "/two-factor/verify-totp",
      returned: successfulResponse("session-token-1", "user-1"),
      newSession: null,
      session: null,
      headers: new Headers({
        "x-request-id": "request-1",
        "user-agent": "test agent",
      }),
    });

    expect(mocks.sessionUpdateMany).toHaveBeenCalledWith({
      where: { token: "session-token-1", userId: "user-1" },
      data: { mfaVerifiedAt: expect.any(Date) },
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: "user-1",
        outcome: "SUCCESS",
        requestId: "request-1",
      }),
    });
  });

  it("never writes a session token into the audit record", async () => {
    await recordMfaVerificationResult({
      path: "/two-factor/verify-totp",
      returned: successfulResponse("secret-session-token", "user-1"),
    });

    const audited = mocks.auditCreate.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(JSON.stringify(audited.data)).not.toContain("secret-session-token");
    expect(audited.data.targetId).toBe("user-1");
  });

  it("clears the failure counter after a successful verification", async () => {
    await recordMfaVerificationResult({
      path: "/two-factor/verify-totp",
      returned: successfulResponse(),
    });

    expect(mocks.twoFactorUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { failedVerificationCount: 0, lockedUntil: null },
    });
  });

  it("counts a failed step-up attempt against the actor it resolves", async () => {
    mocks.twoFactorFindUnique.mockResolvedValue({
      failedVerificationCount: 1,
      lockedUntil: null,
    });

    await recordMfaVerificationResult({
      path: "/two-factor/verify-totp",
      returned: new APIError("UNAUTHORIZED", { message: "Invalid code" }),
      newSession: null,
      session: null,
      resolveActorId: async () => "user-1",
    });

    expect(mocks.sessionUpdateMany).not.toHaveBeenCalled();
    expect(mocks.twoFactorUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { failedVerificationCount: 2, lockedUntil: null },
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ actorId: "user-1", outcome: "DENIED" }),
    });
  });

  it("locks the factor on the final failed attempt", async () => {
    mocks.twoFactorFindUnique.mockResolvedValue({
      failedVerificationCount: 4,
      lockedUntil: null,
    });

    await recordMfaVerificationResult({
      path: "/two-factor/verify-totp",
      returned: new APIError("UNAUTHORIZED", { message: "Invalid code" }),
      resolveActorId: async () => "user-1",
    });

    expect(mocks.twoFactorUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: {
        failedVerificationCount: 0,
        lockedUntil: expect.any(Date),
      },
    });
  });

  it("distinguishes an internal verification failure from a denial", async () => {
    await recordMfaVerificationResult({
      path: "/two-factor/verify-totp",
      returned: new APIError("INTERNAL_SERVER_ERROR", {
        message: "Verification service failed",
      }),
      resolveActorId: async () => "user-1",
    });

    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ outcome: "FAILURE" }),
    });
  });

  it("reports loudly when a success carries no recognizable session", async () => {
    await recordMfaVerificationResult({
      path: "/two-factor/verify-totp",
      returned: { status: true },
      resolveActorId: async () => "user-1",
    });

    expect(mocks.loggerError).toHaveBeenCalled();
    expect(mocks.sessionUpdateMany).not.toHaveBeenCalled();
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ outcome: "SUCCESS" }),
    });
  });

  it("ignores unrelated Better Auth routes", async () => {
    await recordMfaVerificationResult({
      path: "/sign-in/social",
      returned: successfulResponse(),
    });

    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

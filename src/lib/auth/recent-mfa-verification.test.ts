import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  sessionUpdateMany: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  database: {
    $transaction: mocks.transaction,
  },
}));
import {
  isMfaVerificationPath,
  isSuccessfulMfaVerification,
  recordMfaVerificationResult,
} from "./recent-mfa-verification";

describe("recent MFA verification result", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessionUpdateMany.mockResolvedValue({ count: 1 });
    mocks.auditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation(
      (callback: (transaction: unknown) => unknown) =>
        callback({
          session: { updateMany: mocks.sessionUpdateMany },
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
        returned: { status: true },
      }),
    ).toBe(true);

    expect(
      isSuccessfulMfaVerification({
        path: "/two-factor/verify-totp",
        returned: new APIError("UNAUTHORIZED", {
          message: "Invalid code",
        }),
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
        returned: { status: true },
      }),
    ).toBe(false);
  });

  it("updates and audits only a successful verification", async () => {
    const verifiedSession = {
      session: { id: "session-1" },
      user: { id: "user-1" },
    };

    await recordMfaVerificationResult({
      path: "/two-factor/verify-totp",
      returned: { status: true },
      newSession: verifiedSession,
      session: null,
      headers: new Headers({
        "x-request-id": "request-1",
        "user-agent": "test agent",
      }),
    });

    expect(mocks.sessionUpdateMany).toHaveBeenCalledWith({
      where: { id: "session-1", userId: "user-1" },
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

  it("audits but never stamps a failed verification", async () => {
    const currentSession = {
      session: { id: "session-1" },
      user: { id: "user-1" },
    };

    await recordMfaVerificationResult({
      path: "/two-factor/verify-totp",
      returned: new APIError("UNAUTHORIZED", {
        message: "Invalid code",
      }),
      newSession: null,
      session: currentSession,
    });

    expect(mocks.sessionUpdateMany).not.toHaveBeenCalled();
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: "user-1",
        outcome: "DENIED",
      }),
    });
  });

  it("distinguishes an internal verification failure from a denial", async () => {
    await recordMfaVerificationResult({
      path: "/two-factor/verify-totp",
      returned: new APIError("INTERNAL_SERVER_ERROR", {
        message: "Verification service failed",
      }),
      newSession: null,
      session: {
        session: { id: "session-1" },
        user: { id: "user-1" },
      },
    });

    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        outcome: "FAILURE",
      }),
    });
  });
});

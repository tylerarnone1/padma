import { isAPIError } from "better-auth/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auditCreate: vi.fn(),
  twoFactorFindUnique: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  database: {
    auditEvent: { create: mocks.auditCreate },
    twoFactor: { findUnique: mocks.twoFactorFindUnique },
  },
}));

import { decideMfaLifecycleAccess, guardMfaRequest } from "./mfa-guard";

const now = new Date("2026-07-29T12:00:00.000Z");

function minutesBefore(minutes: number): Date {
  return new Date(now.getTime() - minutes * 60 * 1000);
}

function sessionFor(overrides: {
  twoFactorEnabled: boolean;
  createdAt?: Date;
  mfaVerifiedAt?: Date | null;
}) {
  return {
    session: {
      createdAt: overrides.createdAt ?? minutesBefore(0),
      mfaVerifiedAt: overrides.mfaVerifiedAt ?? null,
    },
    user: { id: "user-1", twoFactorEnabled: overrides.twoFactorEnabled },
  };
}

async function expectDenied(
  promise: Promise<unknown>,
  expectedCode: string,
): Promise<void> {
  const error = await promise.then(
    () => null,
    (thrown: unknown) => thrown,
  );

  expect(error).not.toBeNull();
  expect(isAPIError(error)).toBe(true);
  expect(JSON.stringify(error)).toContain(expectedCode);
}

describe("MFA lifecycle access decision", () => {
  it("denies an unauthenticated caller", () => {
    expect(decideMfaLifecycleAccess({ session: null, now })).toEqual({
      allowed: false,
      reason: "authentication_required",
    });
  });

  it("requires the current factor before an enrolled user may change it", () => {
    expect(
      decideMfaLifecycleAccess({
        session: sessionFor({ twoFactorEnabled: true, mfaVerifiedAt: null }),
        now,
      }),
    ).toEqual({ allowed: false, reason: "recent_mfa_required" });

    expect(
      decideMfaLifecycleAccess({
        session: sessionFor({
          twoFactorEnabled: true,
          mfaVerifiedAt: minutesBefore(60),
        }),
        now,
      }),
    ).toEqual({ allowed: false, reason: "recent_mfa_required" });

    expect(
      decideMfaLifecycleAccess({
        session: sessionFor({
          twoFactorEnabled: true,
          mfaVerifiedAt: minutesBefore(2),
        }),
        now,
      }),
    ).toEqual({ allowed: true });
  });

  it("requires a recent sign-in for first enrollment", () => {
    expect(
      decideMfaLifecycleAccess({
        session: sessionFor({
          twoFactorEnabled: false,
          createdAt: minutesBefore(120),
        }),
        now,
      }),
    ).toEqual({ allowed: false, reason: "fresh_session_required" });

    expect(
      decideMfaLifecycleAccess({
        session: sessionFor({
          twoFactorEnabled: false,
          createdAt: minutesBefore(3),
        }),
        now,
      }),
    ).toEqual({ allowed: true });
  });

  it("does not accept an account-level flag in place of a verification", () => {
    // twoFactorEnabled alone must never satisfy the gate; only a timestamped
    // verification does.
    expect(
      decideMfaLifecycleAccess({
        session: sessionFor({
          twoFactorEnabled: true,
          createdAt: minutesBefore(0),
          mfaVerifiedAt: null,
        }),
        now,
      }),
    ).toEqual({ allowed: false, reason: "recent_mfa_required" });
  });
});

describe("MFA request guard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auditCreate.mockResolvedValue({});
    mocks.twoFactorFindUnique.mockResolvedValue(null);
  });

  it("ignores unrelated Better Auth routes without resolving a session", async () => {
    const resolveSession = vi.fn();

    await guardMfaRequest({
      path: "/sign-in/social",
      resolveSession,
      now,
    });

    expect(resolveSession).not.toHaveBeenCalled();
  });

  it.each([
    "/two-factor/enable",
    "/two-factor/disable",
    "/two-factor/get-totp-uri",
    "/two-factor/generate-backup-codes",
  ])("denies %s to a bare session with an enrolled factor", async (path) => {
    await expectDenied(
      guardMfaRequest({
        path,
        resolveSession: async () =>
          sessionFor({ twoFactorEnabled: true, mfaVerifiedAt: null }),
        now,
      }),
      "RECENT_MFA_REQUIRED",
    );

    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: "user-1",
        outcome: "DENIED",
        metadata: { code: "recent_mfa_required" },
      }),
    });
  });

  it("denies a stale session that has never enrolled", async () => {
    await expectDenied(
      guardMfaRequest({
        path: "/two-factor/enable",
        resolveSession: async () =>
          sessionFor({
            twoFactorEnabled: false,
            createdAt: minutesBefore(240),
          }),
        now,
      }),
      "FRESH_SESSION_REQUIRED",
    );
  });

  it("denies an unauthenticated lifecycle request", async () => {
    await expectDenied(
      guardMfaRequest({
        path: "/two-factor/disable",
        resolveSession: async () => null,
        now,
      }),
      "AUTHENTICATION_REQUIRED",
    );
  });

  it("allows a lifecycle change after a recent verification", async () => {
    await expect(
      guardMfaRequest({
        path: "/two-factor/enable",
        resolveSession: async () =>
          sessionFor({
            twoFactorEnabled: true,
            mfaVerifiedAt: minutesBefore(1),
          }),
        now,
      }),
    ).resolves.toBeUndefined();

    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("rejects step-up verification while the factor is locked", async () => {
    mocks.twoFactorFindUnique.mockResolvedValue({
      failedVerificationCount: 0,
      lockedUntil: new Date(now.getTime() + 60_000),
    });

    await expectDenied(
      guardMfaRequest({
        path: "/two-factor/verify-totp",
        resolveSession: async () => sessionFor({ twoFactorEnabled: true }),
        now,
      }),
      "FACTOR_TEMPORARILY_LOCKED",
    );

    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        outcome: "DENIED",
        metadata: { code: "factor_locked" },
      }),
    });
  });

  it("allows step-up verification once the lock has expired", async () => {
    mocks.twoFactorFindUnique.mockResolvedValue({
      failedVerificationCount: 4,
      lockedUntil: new Date(now.getTime() - 1_000),
    });

    await expect(
      guardMfaRequest({
        path: "/two-factor/verify-totp",
        resolveSession: async () => sessionFor({ twoFactorEnabled: true }),
        now,
      }),
    ).resolves.toBeUndefined();
  });

  it("leaves the sign-in challenge to Better Auth's own lockout", async () => {
    await expect(
      guardMfaRequest({
        path: "/two-factor/verify-totp",
        resolveSession: async () => null,
        now,
      }),
    ).resolves.toBeUndefined();

    expect(mocks.twoFactorFindUnique).not.toHaveBeenCalled();
  });
});

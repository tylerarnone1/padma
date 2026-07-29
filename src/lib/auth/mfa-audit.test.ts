import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  database: { auditEvent: { create: mocks.auditCreate } },
}));

import {
  mfaLifecycleOutcome,
  recordMfaLifecycleResult,
} from "./mfa-audit";

describe("MFA lifecycle outcome", () => {
  it("classifies a completed call as success", () => {
    expect(mfaLifecycleOutcome({ totpURI: "otpauth://x" })).toBe("SUCCESS");
  });

  it("classifies a client error as a denial and a server error as a failure", () => {
    expect(
      mfaLifecycleOutcome(new APIError("FORBIDDEN", { message: "no" })),
    ).toBe("DENIED");
    expect(
      mfaLifecycleOutcome(
        new APIError("INTERNAL_SERVER_ERROR", { message: "boom" }),
      ),
    ).toBe("FAILURE");
  });

  it("treats an absent response as a failure rather than a success", () => {
    expect(mfaLifecycleOutcome(undefined)).toBe("FAILURE");
  });
});

describe("MFA lifecycle audit", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auditCreate.mockResolvedValue({});
  });

  it.each([
    ["/two-factor/enable", "mfa:enable"],
    ["/two-factor/disable", "mfa:disable"],
    ["/two-factor/get-totp-uri", "mfa:get-totp-uri"],
    ["/two-factor/generate-backup-codes", "mfa:generate-backup-codes"],
  ])("audits %s as %s", async (path, action) => {
    await recordMfaLifecycleResult({
      path,
      returned: { ok: true },
      resolveActorId: async () => "user-1",
      headers: new Headers({ "x-request-id": "request-1" }),
    });

    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: "user-1",
        action,
        outcome: "SUCCESS",
        requestId: "request-1",
      }),
    });
  });

  it("never records the enrollment secret it just handed out", async () => {
    await recordMfaLifecycleResult({
      path: "/two-factor/enable",
      returned: {
        totpURI: "otpauth://totp/Padma?secret=SUPERSECRETVALUE",
        backupCodes: ["code-1"],
      },
      resolveActorId: async () => "user-1",
    });

    const audited = mocks.auditCreate.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(JSON.stringify(audited.data)).not.toContain("SUPERSECRETVALUE");
    expect(JSON.stringify(audited.data)).not.toContain("code-1");
  });

  it("ignores verification and unrelated routes", async () => {
    await recordMfaLifecycleResult({
      path: "/two-factor/verify-totp",
      returned: { token: "t", user: { id: "user-1" } },
      resolveActorId: async () => "user-1",
    });
    await recordMfaLifecycleResult({
      path: "/sign-in/social",
      returned: {},
      resolveActorId: async () => "user-1",
    });

    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });
});

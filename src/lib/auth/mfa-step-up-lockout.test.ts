import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/client", () => ({
  database: { twoFactor: { findUnique: vi.fn() } },
}));

import {
  isStepUpLocked,
  nextStepUpFailureState,
  recordStepUpFailure,
  resetStepUpFailures,
  STEP_UP_LOCKOUT_MS,
  STEP_UP_MAXIMUM_FAILED_ATTEMPTS,
} from "./mfa-step-up-lockout";

const now = new Date("2026-07-29T12:00:00.000Z");

describe("step-up lockout state", () => {
  it("treats a missing or cleared lock as unlocked", () => {
    expect(isStepUpLocked(null, now)).toBe(false);
    expect(
      isStepUpLocked({ failedVerificationCount: 3, lockedUntil: null }, now),
    ).toBe(false);
  });

  it("locks only while the expiry is in the future", () => {
    expect(
      isStepUpLocked(
        {
          failedVerificationCount: 0,
          lockedUntil: new Date(now.getTime() + 1),
        },
        now,
      ),
    ).toBe(true);

    expect(
      isStepUpLocked(
        {
          failedVerificationCount: 0,
          lockedUntil: new Date(now.getTime() - 1),
        },
        now,
      ),
    ).toBe(false);
  });

  it("accumulates consecutive failures below the cap", () => {
    expect(nextStepUpFailureState(null, now)).toEqual({
      failedVerificationCount: 1,
      lockedUntil: null,
    });

    expect(
      nextStepUpFailureState(
        { failedVerificationCount: 2, lockedUntil: null },
        now,
      ),
    ).toEqual({ failedVerificationCount: 3, lockedUntil: null });
  });

  it("locks the factor on reaching the cap and restarts the counter", () => {
    expect(
      nextStepUpFailureState(
        {
          failedVerificationCount: STEP_UP_MAXIMUM_FAILED_ATTEMPTS - 1,
          lockedUntil: null,
        },
        now,
      ),
    ).toEqual({
      failedVerificationCount: 0,
      lockedUntil: new Date(now.getTime() + STEP_UP_LOCKOUT_MS),
    });
  });

  it("writes the computed state through the provided writer", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const writer = { twoFactor: { updateMany } };

    await recordStepUpFailure(
      writer,
      "user-1",
      { failedVerificationCount: 0, lockedUntil: null },
      now,
    );
    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { failedVerificationCount: 1, lockedUntil: null },
    });

    await resetStepUpFailures(writer, "user-1");
    expect(updateMany).toHaveBeenLastCalledWith({
      where: { userId: "user-1" },
      data: { failedVerificationCount: 0, lockedUntil: null },
    });
  });
});

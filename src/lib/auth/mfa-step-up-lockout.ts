import "server-only";

import { database } from "@/lib/db/client";

/**
 * Better Auth applies its `accountLockout` configuration only when a second
 * factor is verified as part of sign-in, where no session exists yet. Padma
 * establishes the session through OAuth first and then steps up, so every
 * verification it performs takes the already-authenticated path and Better
 * Auth's per-factor throttling is skipped entirely.
 *
 * These helpers reimplement the cap for the step-up path using the columns the
 * two-factor table already carries, so a caller holding a session cannot
 * brute-force a six-digit code behind the global request rate limit.
 */

export const STEP_UP_MAXIMUM_FAILED_ATTEMPTS = 5;
export const STEP_UP_LOCKOUT_MS = 15 * 60 * 1000;

export type StepUpLockoutState = {
  failedVerificationCount: number;
  lockedUntil: Date | null;
};

/** Minimal structural view of the write surface, so callers may pass a transaction. */
export type StepUpLockoutWriter = {
  twoFactor: {
    updateMany(args: {
      where: { userId: string };
      data: Partial<StepUpLockoutState>;
    }): Promise<{ count: number }>;
  };
};

export function isStepUpLocked(
  state: StepUpLockoutState | null | undefined,
  now: Date = new Date(),
): boolean {
  const lockedUntil = state?.lockedUntil;
  if (!(lockedUntil instanceof Date)) {
    return false;
  }
  return lockedUntil.getTime() > now.getTime();
}

/**
 * Consecutive failures accumulate until the cap, at which point the factor is
 * locked and the counter restarts. A lock that has already expired does not
 * carry its count forward, matching the "consecutive failures" definition in
 * NIST SP 800-63B section 5.2.2.
 */
export function nextStepUpFailureState(
  state: StepUpLockoutState | null | undefined,
  now: Date = new Date(),
  maximumFailedAttempts: number = STEP_UP_MAXIMUM_FAILED_ATTEMPTS,
  lockoutMs: number = STEP_UP_LOCKOUT_MS,
): StepUpLockoutState {
  const attempts = (state?.failedVerificationCount ?? 0) + 1;

  if (attempts >= maximumFailedAttempts) {
    return {
      failedVerificationCount: 0,
      lockedUntil: new Date(now.getTime() + lockoutMs),
    };
  }

  return { failedVerificationCount: attempts, lockedUntil: null };
}

export async function readStepUpLockoutState(
  userId: string,
): Promise<StepUpLockoutState | null> {
  return database.twoFactor.findUnique({
    where: { userId },
    select: { failedVerificationCount: true, lockedUntil: true },
  });
}

export async function recordStepUpFailure(
  writer: StepUpLockoutWriter,
  userId: string,
  state: StepUpLockoutState | null | undefined,
  now: Date = new Date(),
): Promise<StepUpLockoutState> {
  const next = nextStepUpFailureState(state, now);
  await writer.twoFactor.updateMany({ where: { userId }, data: next });
  return next;
}

export async function resetStepUpFailures(
  writer: StepUpLockoutWriter,
  userId: string,
): Promise<void> {
  await writer.twoFactor.updateMany({
    where: { userId },
    data: { failedVerificationCount: 0, lockedUntil: null },
  });
}

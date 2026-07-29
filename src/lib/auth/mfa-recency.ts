/**
 * Pure recency arithmetic for step-up authentication.
 *
 * This module deliberately has no imports. Both the session seam and the
 * Better Auth request guard depend on it, and neither may pull the other into a
 * cycle.
 */

export const RECENT_MFA_MAXIMUM_AGE_MS = 15 * 60 * 1000;
export const FRESH_SESSION_MAXIMUM_AGE_MS = 15 * 60 * 1000;

/**
 * Verification timestamps are written by the server, but the database clock and
 * the application clock are not guaranteed to be identical. A small negative
 * tolerance keeps a legitimate verification from being rejected as future-dated
 * without widening the window a stale timestamp can occupy.
 */
export const MFA_CLOCK_SKEW_TOLERANCE_MS = 30_000;

function isWithinWindow(
  timestamp: Date | null | undefined,
  now: Date,
  maximumAgeMs: number,
): boolean {
  if (!(timestamp instanceof Date) || Number.isNaN(timestamp.getTime())) {
    return false;
  }

  const ageMs = now.getTime() - timestamp.getTime();
  return ageMs >= -MFA_CLOCK_SKEW_TOLERANCE_MS && ageMs <= maximumAgeMs;
}

/** True when a second factor was verified recently enough to elevate a session. */
export function isRecentMfaTimestamp(
  verifiedAt: Date | null | undefined,
  now: Date = new Date(),
  maximumAgeMs: number = RECENT_MFA_MAXIMUM_AGE_MS,
): boolean {
  return isWithinWindow(verifiedAt, now, maximumAgeMs);
}

/**
 * True when the session itself was established recently. Used to gate first
 * factor enrollment, where no second factor exists to step up with yet.
 */
export function isFreshSession(
  createdAt: Date | null | undefined,
  now: Date = new Date(),
  maximumAgeMs: number = FRESH_SESSION_MAXIMUM_AGE_MS,
): boolean {
  return isWithinWindow(createdAt, now, maximumAgeMs);
}

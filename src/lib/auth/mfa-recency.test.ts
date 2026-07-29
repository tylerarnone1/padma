import { describe, expect, it } from "vitest";

import {
  FRESH_SESSION_MAXIMUM_AGE_MS,
  isFreshSession,
  isRecentMfaTimestamp,
  MFA_CLOCK_SKEW_TOLERANCE_MS,
  RECENT_MFA_MAXIMUM_AGE_MS,
} from "./mfa-recency";

const now = new Date("2026-07-29T12:00:00.000Z");

function offset(ms: number): Date {
  return new Date(now.getTime() + ms);
}

describe("MFA recency", () => {
  it("rejects a missing or unusable timestamp", () => {
    expect(isRecentMfaTimestamp(null, now)).toBe(false);
    expect(isRecentMfaTimestamp(undefined, now)).toBe(false);
    expect(isRecentMfaTimestamp(new Date("not a date"), now)).toBe(false);
  });

  it("accepts a verification inside the window and rejects one outside it", () => {
    expect(isRecentMfaTimestamp(offset(-1000), now)).toBe(true);
    expect(
      isRecentMfaTimestamp(offset(-RECENT_MFA_MAXIMUM_AGE_MS + 1000), now),
    ).toBe(true);
    expect(
      isRecentMfaTimestamp(offset(-RECENT_MFA_MAXIMUM_AGE_MS - 1000), now),
    ).toBe(false);
  });

  it("tolerates bounded clock skew but not an arbitrary future timestamp", () => {
    expect(
      isRecentMfaTimestamp(offset(MFA_CLOCK_SKEW_TOLERANCE_MS - 1000), now),
    ).toBe(true);
    expect(
      isRecentMfaTimestamp(offset(MFA_CLOCK_SKEW_TOLERANCE_MS + 1000), now),
    ).toBe(false);
  });

  it("measures session freshness from creation", () => {
    expect(isFreshSession(offset(-1000), now)).toBe(true);
    expect(
      isFreshSession(offset(-FRESH_SESSION_MAXIMUM_AGE_MS - 1000), now),
    ).toBe(false);
    expect(isFreshSession(null, now)).toBe(false);
  });
});

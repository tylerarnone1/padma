import "server-only";

import { APIError } from "better-auth/api";
import { recordMfaAudit } from "@/lib/auth/mfa-audit";
import {
  isMfaLifecyclePath,
  isMfaVerificationPath,
} from "@/lib/auth/mfa-paths";
import { isFreshSession, isRecentMfaTimestamp } from "@/lib/auth/mfa-recency";
import {
  isStepUpLocked,
  readStepUpLockoutState,
} from "@/lib/auth/mfa-step-up-lockout";

export type MfaLifecycleDenialReason =
  | "authentication_required"
  | "recent_mfa_required"
  | "fresh_session_required";

export type MfaLifecycleDecision =
  | { allowed: true }
  | { allowed: false; reason: MfaLifecycleDenialReason };

type GuardedSession = {
  session: {
    createdAt?: Date | null | undefined;
    mfaVerifiedAt?: Date | null | undefined;
  };
  user: { id: string; twoFactorEnabled?: boolean | null | undefined };
};

/**
 * Decides whether a caller may change their own second factor.
 *
 * An enrolled user must prove possession of the current factor, which stops a
 * stolen session from silently re-enrolling or removing MFA. A user with no
 * factor yet has nothing to prove possession of, so the session itself must be
 * recent. Losing a device is recovered through a backup code, which elevates
 * the session and then satisfies the enrolled branch.
 */
export function decideMfaLifecycleAccess(input: {
  session: GuardedSession | null | undefined;
  now?: Date;
}): MfaLifecycleDecision {
  const now = input.now ?? new Date();
  const resolved = input.session;

  if (!resolved) {
    return { allowed: false, reason: "authentication_required" };
  }

  if (resolved.user.twoFactorEnabled === true) {
    return isRecentMfaTimestamp(resolved.session.mfaVerifiedAt, now)
      ? { allowed: true }
      : { allowed: false, reason: "recent_mfa_required" };
  }

  return isFreshSession(resolved.session.createdAt, now)
    ? { allowed: true }
    : { allowed: false, reason: "fresh_session_required" };
}

function denialError(reason: MfaLifecycleDenialReason): APIError {
  if (reason === "authentication_required") {
    return new APIError("UNAUTHORIZED", {
      message: "Authentication is required to change a second factor.",
      code: "AUTHENTICATION_REQUIRED",
    });
  }

  if (reason === "recent_mfa_required") {
    return new APIError("FORBIDDEN", {
      message:
        "Verify your current second factor before changing multi-factor settings.",
      code: "RECENT_MFA_REQUIRED",
    });
  }

  return new APIError("FORBIDDEN", {
    message: "Sign in again before configuring multi-factor authentication.",
    code: "FRESH_SESSION_REQUIRED",
  });
}

/**
 * Before-hook body for Better Auth's two-factor endpoints.
 *
 * Padma delegates `/api/auth/*` to Better Auth wholesale, so this is the only
 * seam that every caller of those endpoints must pass through. The session is
 * resolved lazily: unrelated paths must not pay for a lookup.
 */
export async function guardMfaRequest(input: {
  path: string | undefined;
  resolveSession: () => Promise<GuardedSession | null>;
  headers?: Headers | undefined;
  now?: Date;
}): Promise<void> {
  const { path } = input;
  const isLifecycle = isMfaLifecyclePath(path);
  const isVerification = isMfaVerificationPath(path);

  if (!path || (!isLifecycle && !isVerification)) {
    return;
  }

  const session = await input.resolveSession();

  if (isLifecycle) {
    const decision = decideMfaLifecycleAccess({
      session,
      ...(input.now ? { now: input.now } : {}),
    });

    if (!decision.allowed) {
      await recordMfaAudit({
        path,
        actorId: session?.user.id ?? null,
        outcome: "DENIED",
        code: decision.reason,
        headers: input.headers,
      });
      throw denialError(decision.reason);
    }

    return;
  }

  // A verification with no session is the sign-in challenge, where Better Auth
  // applies its own lockout. Only the step-up path needs Padma's cap.
  if (!session) {
    return;
  }

  const lockout = await readStepUpLockoutState(session.user.id);
  if (isStepUpLocked(lockout, input.now ?? new Date())) {
    await recordMfaAudit({
      path,
      actorId: session.user.id,
      outcome: "DENIED",
      code: "factor_locked",
      headers: input.headers,
    });
    throw new APIError("TOO_MANY_REQUESTS", {
      message:
        "Too many failed verification attempts. Try again after the lockout expires.",
      code: "FACTOR_TEMPORARILY_LOCKED",
    });
  }
}

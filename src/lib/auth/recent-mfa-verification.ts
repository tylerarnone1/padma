import { isAPIError } from "better-auth/api";
import { z } from "zod";
import { database } from "@/lib/db/client";
import { isMfaVerificationPath, mfaAuditAction } from "@/lib/auth/mfa-paths";
import {
  readStepUpLockoutState,
  recordStepUpFailure,
  resetStepUpFailures,
} from "@/lib/auth/mfa-step-up-lockout";
import { logger } from "@/lib/logging/logger";

export { isMfaVerificationPath };

export function isSuccessfulMfaVerification(input: {
  path: string | undefined;
  returned: unknown;
}): boolean {
  return (
    isMfaVerificationPath(input.path) &&
    input.returned !== undefined &&
    !isAPIError(input.returned)
  );
}

/**
 * Shape of a successful verification response.
 *
 * Better Auth's step-up verification endpoints declare no session middleware
 * and do not rotate the session cookie for an already-enrolled user, so neither
 * `context.session` nor `context.newSession` is populated on that path. The
 * session token echoed in the response body is the only reliable handle on the
 * session that was just elevated. Stamping from the hook's session snapshots
 * instead means recency is recorded at enrollment and never again.
 */
const verifiedSessionSchema = z.object({
  token: z.string().min(1),
  user: z.object({ id: z.string().min(1) }),
});

export type VerifiedSession = z.infer<typeof verifiedSessionSchema>;

export function parseVerifiedSession(
  returned: unknown,
): VerifiedSession | null {
  const parsed = verifiedSessionSchema.safeParse(returned);
  return parsed.success ? parsed.data : null;
}

type MfaSessionSnapshot = {
  user: {
    id: string;
  };
};

export async function recordMfaVerificationResult(input: {
  path: string | undefined;
  returned: unknown;
  newSession?: MfaSessionSnapshot | null;
  session?: MfaSessionSnapshot | null;
  resolveActorId?: () => Promise<string | null>;
  headers?: Headers | undefined;
  now?: Date;
}): Promise<void> {
  const { path } = input;
  if (!isMfaVerificationPath(path)) return;

  const now = input.now ?? new Date();
  const successful = isSuccessfulMfaVerification(input);
  const verified = successful ? parseVerifiedSession(input.returned) : null;

  if (successful && !verified) {
    // Fail closed, but never silently: an unrecognized success response means
    // no session was elevated and every step-up gate will keep denying.
    logger.error(
      { path },
      "A successful MFA verification returned no recognizable session token; recency was not recorded",
    );
  }

  const actorId =
    verified?.user.id ??
    input.newSession?.user.id ??
    input.session?.user.id ??
    (input.resolveActorId ? await input.resolveActorId() : null);

  const outcome = successful
    ? "SUCCESS"
    : isAPIError(input.returned) && input.returned.statusCode >= 500
      ? "FAILURE"
      : "DENIED";

  // Read outside the transaction so the failure counter is derived from a
  // committed value rather than extending the write window.
  const lockoutState =
    !successful && actorId ? await readStepUpLockoutState(actorId) : null;

  await database.$transaction(async (transaction) => {
    if (verified) {
      const updated = await transaction.session.updateMany({
        where: { token: verified.token, userId: verified.user.id },
        data: { mfaVerifiedAt: now },
      });
      if (updated.count !== 1) {
        throw new Error("The verified MFA session could not be updated.");
      }
      await resetStepUpFailures(transaction, verified.user.id);
    } else if (!successful && actorId) {
      await recordStepUpFailure(transaction, actorId, lockoutState, now);
    }

    await transaction.auditEvent.create({
      data: {
        actorId,
        action: mfaAuditAction(path),
        // Deliberately the acting user, never the session token: audit records
        // must not become a place credentials are stored.
        targetType: "user",
        targetId: actorId,
        outcome,
        requestId: input.headers?.get("x-request-id") ?? null,
        userAgent: input.headers?.get("user-agent")?.slice(0, 500) ?? null,
      },
    });
  });
}

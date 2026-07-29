import "server-only";

import { isAPIError } from "better-auth/api";
import { database } from "@/lib/db/client";
import { isMfaLifecyclePath, mfaAuditAction } from "@/lib/auth/mfa-paths";

export type MfaAuditOutcome = "SUCCESS" | "DENIED" | "FAILURE";

export async function recordMfaAudit(input: {
  path: string;
  actorId: string | null;
  outcome: MfaAuditOutcome;
  code?: string | undefined;
  headers?: Headers | undefined;
}): Promise<void> {
  await database.auditEvent.create({
    data: {
      actorId: input.actorId,
      action: mfaAuditAction(input.path),
      targetType: "user",
      targetId: input.actorId,
      outcome: input.outcome,
      requestId: input.headers?.get("x-request-id") ?? null,
      userAgent: input.headers?.get("user-agent")?.slice(0, 500) ?? null,
      ...(input.code ? { metadata: { code: input.code } } : {}),
    },
  });
}

export function mfaLifecycleOutcome(returned: unknown): MfaAuditOutcome {
  if (isAPIError(returned)) {
    return returned.statusCode >= 500 ? "FAILURE" : "DENIED";
  }
  return returned === undefined ? "FAILURE" : "SUCCESS";
}

/**
 * Audits enrollment, replacement, secret disclosure, and removal of a second
 * factor. Denials raised by the request guard are audited there, before the
 * endpoint runs, so this only sees requests that passed the guard.
 */
export async function recordMfaLifecycleResult(input: {
  path: string | undefined;
  returned: unknown;
  resolveActorId: () => Promise<string | null>;
  headers?: Headers | undefined;
}): Promise<void> {
  const { path } = input;
  if (!isMfaLifecyclePath(path)) return;

  await recordMfaAudit({
    path,
    actorId: await input.resolveActorId(),
    outcome: mfaLifecycleOutcome(input.returned),
    headers: input.headers,
  });
}

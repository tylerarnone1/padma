import "server-only";

import { ZodError } from "zod";
import {
  auditOutcomeForError,
  recordSecurityAudit,
} from "@/lib/audit/security-audit";
import { ApplicationError, isAuditedError } from "@/lib/http/errors";
import { problemResponse } from "@/lib/http/problem";
import {
  getRequestId,
  runWithRequestContext,
} from "@/lib/logging/request-context";
import { logger } from "@/lib/logging/logger";

function auditCodeForError(error: unknown): string {
  if (error instanceof ApplicationError) return error.code;
  if (error instanceof ZodError) return "validation_failed";
  if (error instanceof SyntaxError) return "invalid_json";
  return "internal_error";
}

export type AuditedRouteContext = {
  requestId: string;
  /**
   * Attributes any later failure to this actor. Call it as soon as a session is
   * established so a denial after that point is not recorded as anonymous.
   */
  setActor: (actorId: string) => void;
};

/**
 * Wraps a route handler with request correlation, failure auditing, and safe
 * problem responses.
 *
 * This intentionally does not perform the session, MFA, permission, or
 * ownership checks. Those stay written out in each handler so the required
 * operation order is readable at the call site instead of hidden behind
 * configuration. What it removes is the bookkeeping that was previously
 * duplicated and easy to get wrong.
 *
 * Errors whose thrower already audited them are not audited again.
 */
export async function withAuditedRequest(
  input: {
    request: Request;
    action: string;
    targetType: string;
  },
  handler: (context: AuditedRouteContext) => Promise<Response>,
): Promise<Response> {
  const requestId = getRequestId(input.request.headers);
  const userAgent = input.request.headers.get("user-agent")?.slice(0, 500);
  let actorId: string | undefined;

  return runWithRequestContext(
    {
      requestId,
      ...(userAgent ? { userAgent } : {}),
    },
    async () => {
      try {
        return await handler({
          requestId,
          setActor: (id: string) => {
            actorId = id;
          },
        });
      } catch (error) {
        if (!isAuditedError(error)) {
          try {
            await recordSecurityAudit({
              ...(actorId ? { actorId } : {}),
              action: input.action,
              targetType: input.targetType,
              outcome: auditOutcomeForError(error),
              code: auditCodeForError(error),
            });
          } catch (auditError) {
            logger.error(
              { error: auditError, requestId, action: input.action },
              "Security audit write failed",
            );
          }
        }

        return problemResponse(error, input.request, requestId);
      }
    },
  );
}

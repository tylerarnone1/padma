import "server-only";

import { ZodError } from "zod";
import { database } from "@/lib/db/client";
import { ApplicationError } from "@/lib/http/errors";
import { getRequestContext } from "@/lib/logging/request-context";

export function auditOutcomeForError(
  error: unknown,
): "DENIED" | "FAILURE" {
  if (error instanceof ZodError || error instanceof SyntaxError) {
    return "DENIED";
  }
  return error instanceof ApplicationError && error.status < 500
    ? "DENIED"
    : "FAILURE";
}

export async function recordSecurityAudit(input: {
  actorId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  outcome: "DENIED" | "FAILURE";
  code?: string;
}): Promise<void> {
  const context = getRequestContext();

  await database.auditEvent.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      outcome: input.outcome,
      requestId: context?.requestId ?? null,
      userAgent: context?.userAgent ?? null,
      ...(input.code ? { metadata: { code: input.code } } : {}),
    },
  });
}

import { ZodError } from "zod";
import { requirePermission } from "@/features/access-control/data/authorization";
import { PERMISSIONS } from "@/features/access-control/permissions";
import { createWebhookSchema } from "@/features/integrations/schemas/webhook-schema";
import { createWebhookEndpoint } from "@/features/integrations/services/webhook-service";
import { assertRecentMfa, requireSession } from "@/lib/auth/session";
import {
  auditOutcomeForError,
  recordSecurityAudit,
} from "@/lib/audit/security-audit";
import { ApplicationError, ForbiddenError } from "@/lib/http/errors";
import { problemResponse } from "@/lib/http/problem";
import { assertSameOrigin, readJsonBody } from "@/lib/http/request";
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

export async function POST(request: Request): Promise<Response> {
  const requestId = getRequestId(request.headers);
  let actorId: string | undefined;
  let stage:
    | "origin"
    | "session"
    | "mfa"
    | "permission"
    | "validation"
    | "mutation" = "origin";
  const userAgent = request.headers.get("user-agent")?.slice(0, 500);

  return runWithRequestContext(
    {
      requestId,
      ...(userAgent ? { userAgent } : {}),
    },
    async () => {
      try {
        assertSameOrigin(request);
        stage = "session";
        const session = await requireSession(request.headers);
        actorId = session.user.id;
        stage = "mfa";
        assertRecentMfa(session);
        stage = "permission";
        await requirePermission({
          userId: session.user.id,
          permission: PERMISSIONS.INTEGRATION_MANAGE,
        });
        stage = "validation";
        const input = createWebhookSchema.parse(await readJsonBody(request));
        stage = "mutation";
        const result = await createWebhookEndpoint({
          actorId: session.user.id,
          webhook: input,
        });

        return Response.json(
          {
            data: {
              ...result.endpoint,
              signingSecret: result.signingSecret,
              warning:
                "The signing secret is returned once and cannot be recovered.",
            },
          },
          {
            status: 201,
            headers: {
              "cache-control": "no-store",
              "x-request-id": requestId,
            },
          },
        );
      } catch (error) {
        const permissionDenialAlreadyAudited =
          stage === "permission" && error instanceof ForbiddenError;
        if (!permissionDenialAlreadyAudited) {
          try {
            await recordSecurityAudit({
              ...(actorId ? { actorId } : {}),
              action: "webhook:create",
              targetType: "webhook_endpoint",
              outcome: auditOutcomeForError(error),
              code: auditCodeForError(error),
            });
          } catch (auditError) {
            logger.error(
              { error: auditError, requestId, action: "webhook:create" },
              "Security audit write failed",
            );
          }
        }
        return problemResponse(error, request, requestId);
      }
    },
  );
}

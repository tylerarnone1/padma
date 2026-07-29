import { requirePermission } from "@/features/access-control/data/authorization";
import { PERMISSIONS } from "@/features/access-control/permissions";
import { createWebhookSchema } from "@/features/integrations/schemas/webhook-schema";
import {
  createWebhookEndpoint,
  listWebhookEndpoints,
} from "@/features/integrations/services/webhook-service";
import { assertRecentMfa, requireSession } from "@/lib/auth/session";
import { withAuditedRequest } from "@/lib/http/audited-route";
import {
  assertWithinRateLimit,
  rateLimitKey,
  rateLimitSubject,
} from "@/lib/http/rate-limit";
import { assertSameOrigin, readJsonBody } from "@/lib/http/request";

export async function POST(request: Request): Promise<Response> {
  return withAuditedRequest(
    { request, action: "webhook:create", targetType: "webhook_endpoint" },
    async ({ requestId, setActor }) => {
      assertSameOrigin(request);
      const session = await requireSession(request.headers);
      setActor(session.user.id);
      assertRecentMfa(session);
      await assertWithinRateLimit({
        key: rateLimitKey(
          "webhook:create",
          rateLimitSubject({ request, sessionId: session.session.id }),
        ),
        limit: 10,
        windowSeconds: 60,
      });
      await requirePermission({
        userId: session.user.id,
        permission: PERMISSIONS.INTEGRATION_MANAGE,
      });
      const input = createWebhookSchema.parse(await readJsonBody(request));
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
    },
  );
}

/**
 * Lists the caller's own endpoints.
 *
 * Reads do not require step-up: the response carries no secret, and the query is
 * scoped to the owner rather than filtered afterwards.
 */
export async function GET(request: Request): Promise<Response> {
  return withAuditedRequest(
    { request, action: "webhook:read", targetType: "webhook_endpoint" },
    async ({ requestId, setActor }) => {
      const session = await requireSession(request.headers);
      setActor(session.user.id);
      await requirePermission({
        userId: session.user.id,
        permission: PERMISSIONS.INTEGRATION_READ,
      });
      const endpoints = await listWebhookEndpoints({
        actorId: session.user.id,
      });

      return Response.json(
        { data: endpoints },
        {
          status: 200,
          headers: {
            "cache-control": "no-store",
            "x-request-id": requestId,
          },
        },
      );
    },
  );
}

import { z } from "zod";
import { requirePermission } from "@/features/access-control/data/authorization";
import { PERMISSIONS } from "@/features/access-control/permissions";
import { revokeWebhookEndpoint } from "@/features/integrations/services/webhook-service";
import { assertRecentMfa, requireSession } from "@/lib/auth/session";
import { withAuditedRequest } from "@/lib/http/audited-route";
import {
  assertWithinRateLimit,
  rateLimitKey,
  rateLimitSubject,
} from "@/lib/http/rate-limit";
import { assertSameOrigin } from "@/lib/http/request";

/** Route parameters are caller input and are validated like a request body. */
const routeParametersSchema = z.object({ endpointId: z.uuid() }).strict();

export async function DELETE(
  request: Request,
  context: { params: Promise<{ endpointId: string }> },
): Promise<Response> {
  return withAuditedRequest(
    { request, action: "webhook:revoke", targetType: "webhook_endpoint" },
    async ({ requestId, setActor }) => {
      assertSameOrigin(request);
      const session = await requireSession(request.headers);
      setActor(session.user.id);
      assertRecentMfa(session);
      await assertWithinRateLimit({
        key: rateLimitKey(
          "webhook:revoke",
          rateLimitSubject({ request, sessionId: session.session.id }),
        ),
        limit: 20,
        windowSeconds: 60,
      });
      await requirePermission({
        userId: session.user.id,
        permission: PERMISSIONS.INTEGRATION_MANAGE,
      });
      const { endpointId } = routeParametersSchema.parse(
        await context.params,
      );

      // Ownership is enforced inside the service as part of the delete
      // predicate, so another owner's id is indistinguishable from a
      // nonexistent one.
      await revokeWebhookEndpoint({
        actorId: session.user.id,
        endpointId,
      });

      return new Response(null, {
        status: 204,
        headers: {
          "cache-control": "no-store",
          "x-request-id": requestId,
        },
      });
    },
  );
}

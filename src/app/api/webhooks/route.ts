import { requirePermission } from "@/features/access-control/data/authorization";
import { PERMISSIONS } from "@/features/access-control/permissions";
import { createWebhookSchema } from "@/features/integrations/schemas/webhook-schema";
import { createWebhookEndpoint } from "@/features/integrations/services/webhook-service";
import { requireRecentMfa } from "@/lib/auth/session";
import { problemResponse } from "@/lib/http/problem";
import { assertSameOrigin, readJsonBody } from "@/lib/http/request";
import {
  getRequestId,
  runWithRequestContext,
} from "@/lib/logging/request-context";

export async function POST(request: Request): Promise<Response> {
  const requestId = getRequestId(request.headers);

  return runWithRequestContext({ requestId }, async () => {
    try {
      assertSameOrigin(request);
      const session = await requireRecentMfa(request.headers);
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
            warning: "The signing secret is returned once and cannot be recovered.",
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
      return problemResponse(error, request, requestId);
    }
  });
}

import "server-only";

import { randomBytes } from "node:crypto";
import type { CreateWebhookInput } from "@/features/integrations/schemas/webhook-schema";
import { assertSafeWebhookUrl } from "@/features/integrations/security/webhook-security";
import { encryptSecret } from "@/lib/crypto/encryption";
import { database } from "@/lib/db/client";
import { ValidationError } from "@/lib/http/errors";
import { getRequestContext } from "@/lib/logging/request-context";

export async function createWebhookEndpoint(input: {
  actorId: string;
  webhook: CreateWebhookInput;
}) {
  let url: URL;
  try {
    url = await assertSafeWebhookUrl(input.webhook.url);
  } catch (error) {
    throw new ValidationError(
      error instanceof Error ? error.message : "The webhook URL is not safe.",
      { url: ["The webhook URL is not allowed."] },
    );
  }

  const signingSecret = `whsec_${randomBytes(32).toString("base64url")}`;
  const context = getRequestContext();

  const endpoint = await database.$transaction(async (transaction) => {
    const created = await transaction.webhookEndpoint.create({
      data: {
        url: url.toString(),
        description: input.webhook.description ?? null,
        eventPatterns: input.webhook.eventPatterns,
        secretEncrypted: encryptSecret(signingSecret),
      },
      select: {
        id: true,
        url: true,
        description: true,
        eventPatterns: true,
        isActive: true,
        createdAt: true,
      },
    });

    await transaction.auditEvent.create({
      data: {
        actorId: input.actorId,
        action: "webhook:create",
        targetType: "webhook_endpoint",
        targetId: created.id,
        outcome: "SUCCESS",
        requestId: context?.requestId ?? null,
      },
    });

    return created;
  });

  return {
    endpoint,
    signingSecret,
  };
}

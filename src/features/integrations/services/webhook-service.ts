import "server-only";

import { randomBytes } from "node:crypto";
import type { CreateWebhookInput } from "@/features/integrations/schemas/webhook-schema";
import { assertSafeWebhookUrl } from "@/features/integrations/security/webhook-security";
import { recordSecurityAudit } from "@/lib/audit/security-audit";
import { encryptSecret } from "@/lib/crypto/encryption";
import { database } from "@/lib/db/client";
import { NotFoundError, ValidationError } from "@/lib/http/errors";
import { getRequestContext } from "@/lib/logging/request-context";

/**
 * Fields safe to return to the owner. The signing secret is deliberately absent:
 * it is shown once at creation and never readable again.
 */
const endpointView = {
  id: true,
  url: true,
  description: true,
  eventPatterns: true,
  isActive: true,
  createdAt: true,
} as const;

export async function createWebhookEndpoint(input: {
  actorId: string;
  webhook: CreateWebhookInput;
}) {
  let url: URL;
  try {
    url = await assertSafeWebhookUrl(input.webhook.url);
  } catch {
    throw new ValidationError("The webhook URL is not allowed.", {
      url: ["The webhook URL is not allowed."],
    });
  }

  const signingSecret = `whsec_${randomBytes(32).toString("base64url")}`;
  const context = getRequestContext();

  const endpoint = await database.$transaction(async (transaction) => {
    const created = await transaction.webhookEndpoint.create({
      data: {
        // Ownership is taken from the verified session, never from the request
        // body: an owner is trusted state, not caller input.
        ownerId: input.actorId,
        url: url.toString(),
        description: input.webhook.description ?? null,
        eventPatterns: input.webhook.eventPatterns,
        secretEncrypted: encryptSecret(signingSecret),
      },
      select: endpointView,
    });

    await transaction.auditEvent.create({
      data: {
        actorId: input.actorId,
        action: "webhook:create",
        targetType: "webhook_endpoint",
        targetId: created.id,
        outcome: "SUCCESS",
        requestId: context?.requestId ?? null,
        userAgent: context?.userAgent ?? null,
      },
    });

    return created;
  });

  return {
    endpoint,
    signingSecret,
  };
}

/** Lists only the caller's own endpoints. */
export async function listWebhookEndpoints(input: { actorId: string }) {
  return database.webhookEndpoint.findMany({
    where: { ownerId: input.actorId },
    orderBy: { createdAt: "desc" },
    select: endpointView,
  });
}

/**
 * Revokes one of the caller's own endpoints.
 *
 * The owner is part of the write predicate rather than a check performed after
 * fetching the row. A caller who guesses another owner's endpoint id gets the
 * same "not found" as a caller who guesses an id that never existed, so the
 * response cannot be used to confirm that an endpoint exists.
 */
export async function revokeWebhookEndpoint(input: {
  actorId: string;
  endpointId: string;
}): Promise<void> {
  const context = getRequestContext();

  const deletedCount = await database.$transaction(async (transaction) => {
    const deleted = await transaction.webhookEndpoint.deleteMany({
      where: { id: input.endpointId, ownerId: input.actorId },
    });

    if (deleted.count === 1) {
      await transaction.auditEvent.create({
        data: {
          actorId: input.actorId,
          action: "webhook:revoke",
          targetType: "webhook_endpoint",
          targetId: input.endpointId,
          outcome: "SUCCESS",
          requestId: context?.requestId ?? null,
          userAgent: context?.userAgent ?? null,
        },
      });
    }

    return deleted.count;
  });

  if (deletedCount !== 1) {
    // Audited outside the transaction: a denial must survive, and there is no
    // domain write for it to be atomic with.
    await recordSecurityAudit({
      actorId: input.actorId,
      action: "webhook:revoke",
      targetType: "webhook_endpoint",
      targetId: input.endpointId,
      outcome: "DENIED",
    });
    throw new NotFoundError("Webhook endpoint", true);
  }
}

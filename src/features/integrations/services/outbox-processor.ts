import "server-only";

import { WebhookAdapter } from "@/features/integrations/adapters/webhook-adapter";
import type { IntegrationAdapter } from "@/features/integrations/contracts/integration-adapter";
import { parseDatabaseIntegrationEvent } from "@/features/integrations/schemas/integration-event-schema";
import {
  assertSafeWebhookUrl,
  isLocalDevelopmentWebhookUrl,
  signWebhook,
} from "@/features/integrations/security/webhook-security";
import { postSignedWebhook } from "@/features/integrations/security/webhook-transport";
import { decryptSecret } from "@/lib/crypto/encryption";
import { database } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

const adapters: IntegrationAdapter[] = [new WebhookAdapter()];
const MAXIMUM_ATTEMPTS = 8;
const PROCESSING_LEASE_MS = 5 * 60 * 1000;

export async function processOutboxBatch(limit = 25): Promise<number> {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - PROCESSING_LEASE_MS);
  const candidates = await database.outboxEvent.findMany({
    where: {
      attemptCount: { lt: MAXIMUM_ATTEMPTS },
      OR: [
        {
          status: { in: ["PENDING", "FAILED"] },
          availableAt: { lte: now },
        },
        {
          status: "PROCESSING",
          lockedAt: { lte: staleBefore },
        },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let processed = 0;
  for (const event of candidates) {
    const claimed = await database.outboxEvent.updateMany({
      where: {
        id: event.id,
        status: event.status,
        lockedAt: event.lockedAt,
      },
      data: {
        status: "PROCESSING",
        lockedAt: now,
        attemptCount: { increment: 1 },
      },
    });
    if (claimed.count !== 1) continue;

    try {
      await Promise.all(
        adapters.map((adapter) =>
          adapter.dispatch(
            parseDatabaseIntegrationEvent({
              id: event.id,
              topic: event.topic,
              aggregateType: event.aggregateType,
              aggregateId: event.aggregateId,
              ownerId: event.ownerId,
              payload: event.payload,
              occurredAt: event.createdAt,
            }),
          ),
        ),
      );
      await database.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: "COMPLETED",
          processedAt: new Date(),
          lockedAt: null,
          lastError: null,
        },
      });
      processed += 1;
    } catch (error) {
      const attempt = event.attemptCount + 1;
      const exhausted = attempt >= MAXIMUM_ATTEMPTS;
      await database.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: "FAILED",
          lockedAt: null,
          lastError: error instanceof Error ? error.message.slice(0, 500) : "Unknown error",
          availableAt: new Date(
            Date.now() + Math.min(60 * 60, 2 ** attempt * 5) * 1000,
          ),
        },
      });
      // An exhausted event stops matching the candidate filter, so without an
      // explicit signal it would go silently dead.
      if (exhausted) {
        logger.error(
          { error, eventId: event.id, topic: event.topic, attempt },
          "Outbox event exhausted its retries and will not be retried again",
        );
      } else {
        logger.error({ error, eventId: event.id }, "Outbox dispatch failed");
      }
    }
  }

  return processed;
}

export async function processWebhookDeliveryBatch(limit = 25): Promise<number> {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - PROCESSING_LEASE_MS);
  const candidates = await database.webhookDelivery.findMany({
    where: {
      attemptCount: { lt: MAXIMUM_ATTEMPTS },
      OR: [
        {
          status: { in: ["PENDING", "RETRYING"] },
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
        },
        {
          status: "PROCESSING",
          lockedAt: { lte: staleBefore },
        },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: {
      endpoint: true,
      outboxEvent: true,
    },
  });

  let delivered = 0;
  for (const delivery of candidates) {
    const claimed = await database.webhookDelivery.updateMany({
      where: {
        id: delivery.id,
        status: delivery.status,
        attemptCount: delivery.attemptCount,
      },
      data: {
        status: "PROCESSING",
        lockedAt: now,
        attemptCount: { increment: 1 },
      },
    });
    if (claimed.count !== 1) continue;

    const payload = JSON.stringify({
      id: delivery.outboxEvent.id,
      topic: delivery.outboxEvent.topic,
      aggregateType: delivery.outboxEvent.aggregateType,
      aggregateId: delivery.outboxEvent.aggregateId,
      data: delivery.outboxEvent.payload,
      occurredAt: delivery.outboxEvent.createdAt.toISOString(),
    });
    const timestamp = Math.floor(Date.now() / 1000).toString();

    try {
      const url = await assertSafeWebhookUrl(delivery.endpoint.url);
      const response = await postSignedWebhook({
        url,
        headers: {
          "content-type": "application/json",
          "user-agent": "Padma-Webhooks/1.0",
          "webhook-id": delivery.id,
          "webhook-timestamp": timestamp,
          "webhook-signature": `v1=${signWebhook({
            secret: decryptSecret(delivery.endpoint.secretEncrypted),
            timestamp,
            payload,
          })}`,
        },
        body: payload,
        allowPrivateAddresses: isLocalDevelopmentWebhookUrl(url),
      });

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`Webhook returned HTTP ${response.status}.`);
      }

      await database.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "DELIVERED",
          responseStatus: response.status,
          deliveredAt: new Date(),
          nextAttemptAt: null,
          lockedAt: null,
          lastError: null,
        },
      });
      delivered += 1;
    } catch (error) {
      const attempt = delivery.attemptCount + 1;
      const exhausted = attempt >= MAXIMUM_ATTEMPTS;
      await database.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: exhausted ? "FAILED" : "RETRYING",
          lockedAt: null,
          nextAttemptAt: exhausted
            ? null
            : new Date(
                Date.now() + Math.min(60 * 60, 2 ** attempt * 5) * 1000,
              ),
          lastError:
            error instanceof Error ? error.message.slice(0, 500) : "Unknown error",
        },
      });
      if (exhausted) {
        logger.error(
          {
            error,
            deliveryId: delivery.id,
            endpointId: delivery.endpointId,
            attempt,
          },
          "Webhook delivery exhausted its retries",
        );
      } else {
        logger.warn(
          { error, deliveryId: delivery.id, attempt },
          "Webhook delivery failed",
        );
      }
    }
  }

  return delivered;
}

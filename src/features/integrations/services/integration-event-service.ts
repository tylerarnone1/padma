import "server-only";

import {
  integrationEventInputSchema,
  type IntegrationEventInput,
} from "@/features/integrations/schemas/integration-event-schema";

/**
 * Minimal structural view of the outbox write surface.
 *
 * Typed this way so the only thing a caller can pass is a transaction client:
 * a domain event and the state that caused it must commit together, or a
 * consumer can observe an event for a write that was rolled back.
 */
export type OutboxWriter = {
  outboxEvent: {
    createMany(args: {
      data: Array<{
        topic: string;
        aggregateType: string;
        aggregateId: string;
        ownerId: string | null;
        payload: Record<string, unknown>;
        idempotencyKey: string;
      }>;
      skipDuplicates: boolean;
    }): Promise<{ count: number }>;
  };
};

export type EnqueueResult = {
  /** False when `idempotencyKey` was already enqueued, which is not an error. */
  enqueued: boolean;
};

/**
 * Records a provider-neutral domain event inside the caller's transaction.
 *
 * ```ts
 * await database.$transaction(async (transaction) => {
 *   const note = await transaction.note.create({ data: { ownerId, body } });
 *   await enqueueIntegrationEvent(transaction, {
 *     topic: "note.created",
 *     aggregateType: "note",
 *     aggregateId: note.id,
 *     ownerId: note.ownerId,
 *     payload: { id: note.id },
 *     idempotencyKey: `note.created:${note.id}`,
 *   });
 * });
 * ```
 *
 * Duplicate keys are skipped rather than raising, so a retried command cannot
 * abort the surrounding transaction. Never call a third party from here; the
 * worker dispatches through `IntegrationAdapter` after the commit.
 */
export async function enqueueIntegrationEvent(
  writer: OutboxWriter,
  input: IntegrationEventInput,
): Promise<EnqueueResult> {
  const event = integrationEventInputSchema.parse(input);

  const created = await writer.outboxEvent.createMany({
    data: [
      {
        topic: event.topic,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        ownerId: event.ownerId,
        payload: event.payload,
        idempotencyKey: event.idempotencyKey,
      },
    ],
    skipDuplicates: true,
  });

  return { enqueued: created.count === 1 };
}

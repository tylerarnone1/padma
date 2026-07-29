import "server-only";

import { z } from "zod";
import type { IntegrationEvent } from "@/features/integrations/contracts/integration-adapter";

const MAXIMUM_EVENT_PAYLOAD_BYTES = 256 * 1024;
const eventKey = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*)+$/);
const aggregateType = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z][a-z0-9_-]*$/);
const aggregateId = z.string().trim().min(1).max(200);
const ownerId = z.string().trim().min(1).max(200).nullable();
const eventPayload = z
  .record(z.string().trim().min(1).max(100), z.json())
  .refine(
    (payload) =>
      Buffer.byteLength(JSON.stringify(payload), "utf8") <=
      MAXIMUM_EVENT_PAYLOAD_BYTES,
    "The integration event payload is too large.",
  );

/**
 * Input contract for emitting a domain event. `ownerId` has no default on
 * purpose: an emitter must state who the event is about, because that decides
 * who may receive it.
 */
export const integrationEventInputSchema = z
  .object({
    topic: eventKey,
    aggregateType,
    aggregateId,
    ownerId,
    payload: eventPayload,
    idempotencyKey: z.string().trim().min(1).max(200),
  })
  .strict();

export type IntegrationEventInput = z.input<
  typeof integrationEventInputSchema
>;

export const databaseIntegrationEventSchema = z
  .object({
    id: z.uuid(),
    topic: eventKey,
    aggregateType,
    aggregateId,
    ownerId,
    payload: eventPayload,
    occurredAt: z.date(),
  })
  .strict();

export function parseDatabaseIntegrationEvent(
  input: unknown,
): IntegrationEvent {
  return databaseIntegrationEventSchema.parse(input);
}

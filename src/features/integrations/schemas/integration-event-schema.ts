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

export const databaseIntegrationEventSchema = z
  .object({
    id: z.uuid(),
    topic: eventKey,
    aggregateType: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[a-z][a-z0-9_-]*$/),
    aggregateId: z.string().trim().min(1).max(200),
    payload: z
      .record(z.string().trim().min(1).max(100), z.json())
      .refine(
        (payload) =>
          Buffer.byteLength(JSON.stringify(payload), "utf8") <=
          MAXIMUM_EVENT_PAYLOAD_BYTES,
        "The integration event payload is too large.",
      ),
    occurredAt: z.date(),
  })
  .strict();

export function parseDatabaseIntegrationEvent(
  input: unknown,
): IntegrationEvent {
  return databaseIntegrationEventSchema.parse(input);
}

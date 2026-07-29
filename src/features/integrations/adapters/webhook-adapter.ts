import "server-only";

import type {
  DispatchResult,
  IntegrationAdapter,
  IntegrationEvent,
} from "@/features/integrations/contracts/integration-adapter";
import { database } from "@/lib/db/client";

export function matchesEvent(topic: string, pattern: string): boolean {
  if (pattern === topic) return true;
  if (pattern.endsWith(".*")) {
    return topic.startsWith(pattern.slice(0, -1));
  }
  return false;
}

export class WebhookAdapter implements IntegrationAdapter {
  readonly key = "webhook";

  async dispatch(event: IntegrationEvent): Promise<DispatchResult> {
    // An event with no owner has no audience. Selecting every active endpoint
    // here would let anyone who can register a webhook receive every event in
    // the application, including other users' payloads.
    if (event.ownerId === null) {
      return { accepted: 0 };
    }

    const endpoints = await database.webhookEndpoint.findMany({
      where: {
        isActive: true,
        ownerId: event.ownerId,
      },
      select: {
        id: true,
        eventPatterns: true,
      },
    });
    const matchingEndpoints = endpoints.filter((endpoint) =>
      endpoint.eventPatterns.some((pattern) =>
        matchesEvent(event.topic, pattern),
      ),
    );

    await database.webhookDelivery.createMany({
      data: matchingEndpoints.map((endpoint) => ({
        endpointId: endpoint.id,
        outboxEventId: event.id,
      })),
      skipDuplicates: true,
    });

    return { accepted: matchingEndpoints.length };
  }
}

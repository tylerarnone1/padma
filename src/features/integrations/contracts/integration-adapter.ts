export type IntegrationEvent = {
  id: string;
  topic: string;
  aggregateType: string;
  aggregateId: string;
  /**
   * Who the event is about, and therefore who may receive it. `null` means the
   * event has no user-facing audience; it is never a wildcard. Adapters must
   * treat an unmatched owner as "deliver to nothing".
   */
  ownerId: string | null;
  payload: unknown;
  occurredAt: Date;
};

export type DispatchResult = {
  accepted: number;
};

/**
 * Zapier, Nango, Pipedream, and product-specific integrations implement this
 * port. Domain services only emit outbox events and never import providers.
 */
export interface IntegrationAdapter {
  readonly key: string;
  dispatch(event: IntegrationEvent): Promise<DispatchResult>;
}

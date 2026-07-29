export type IntegrationEvent = {
  id: string;
  topic: string;
  aggregateType: string;
  aggregateId: string;
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

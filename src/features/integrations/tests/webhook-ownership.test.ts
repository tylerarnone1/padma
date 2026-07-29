import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  endpointFindMany: vi.fn(),
  endpointDeleteMany: vi.fn(),
  deliveryCreateMany: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
  recordSecurityAudit: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  database: {
    webhookEndpoint: {
      findMany: mocks.endpointFindMany,
      deleteMany: mocks.endpointDeleteMany,
    },
    webhookDelivery: { createMany: mocks.deliveryCreateMany },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/audit/security-audit", () => ({
  recordSecurityAudit: mocks.recordSecurityAudit,
  auditOutcomeForError: () => "DENIED",
}));

import { WebhookAdapter } from "@/features/integrations/adapters/webhook-adapter";
import { revokeWebhookEndpoint } from "@/features/integrations/services/webhook-service";
import { NotFoundError } from "@/lib/http/errors";

function eventFor(ownerId: string | null) {
  return {
    id: "b80efbe7-a826-4827-aaf6-92a1eeef742c",
    topic: "record.created",
    aggregateType: "record",
    aggregateId: "record-1",
    ownerId,
    payload: { name: "Example" },
    occurredAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

describe("webhook delivery ownership", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.endpointFindMany.mockResolvedValue([]);
    mocks.deliveryCreateMany.mockResolvedValue({ count: 0 });
  });

  it("selects endpoints scoped to the event's owner", async () => {
    mocks.endpointFindMany.mockResolvedValue([
      { id: "endpoint-1", eventPatterns: ["record.*"] },
    ]);

    await new WebhookAdapter().dispatch(eventFor("user-1"));

    expect(mocks.endpointFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, ownerId: "user-1" },
      }),
    );
  });

  /**
   * Regression: dispatch previously selected every active endpoint, so any
   * caller who could register a webhook received every event in the
   * application, including other users' payloads.
   */
  it("never queries endpoints without an owner predicate", async () => {
    await new WebhookAdapter().dispatch(eventFor("user-1"));

    const where = mocks.endpointFindMany.mock.calls[0]?.[0]?.where as
      | Record<string, unknown>
      | undefined;
    expect(where).toBeDefined();
    expect(where).toHaveProperty("ownerId", "user-1");
  });

  it("delivers an unowned event to nothing rather than to everything", async () => {
    const result = await new WebhookAdapter().dispatch(eventFor(null));

    expect(result).toEqual({ accepted: 0 });
    expect(mocks.endpointFindMany).not.toHaveBeenCalled();
    expect(mocks.deliveryCreateMany).not.toHaveBeenCalled();
  });
});

describe("webhook revocation ownership", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auditCreate.mockResolvedValue({});
    mocks.recordSecurityAudit.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(
      (callback: (transaction: unknown) => unknown) =>
        callback({
          webhookEndpoint: { deleteMany: mocks.endpointDeleteMany },
          auditEvent: { create: mocks.auditCreate },
        }),
    );
  });

  it("scopes the delete predicate to the acting owner", async () => {
    mocks.endpointDeleteMany.mockResolvedValue({ count: 1 });

    await revokeWebhookEndpoint({
      actorId: "user-1",
      endpointId: "endpoint-1",
    });

    expect(mocks.endpointDeleteMany).toHaveBeenCalledWith({
      where: { id: "endpoint-1", ownerId: "user-1" },
    });
  });

  it("denies another owner's endpoint without disclosing that it exists", async () => {
    mocks.endpointDeleteMany.mockResolvedValue({ count: 0 });

    const error = await revokeWebhookEndpoint({
      actorId: "attacker",
      endpointId: "endpoint-owned-by-someone-else",
    }).then(
      () => null,
      (thrown: unknown) => thrown,
    );

    // Identical to a genuinely nonexistent id, so the response cannot confirm
    // existence.
    expect(error).toBeInstanceOf(NotFoundError);
    expect((error as NotFoundError).status).toBe(404);
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("durably audits a cross-owner denial outside the rolled-back transaction", async () => {
    mocks.endpointDeleteMany.mockResolvedValue({ count: 0 });

    await revokeWebhookEndpoint({
      actorId: "attacker",
      endpointId: "endpoint-1",
    }).catch(() => undefined);

    expect(mocks.recordSecurityAudit).toHaveBeenCalledWith({
      actorId: "attacker",
      action: "webhook:revoke",
      targetType: "webhook_endpoint",
      targetId: "endpoint-1",
      outcome: "DENIED",
    });
  });
});

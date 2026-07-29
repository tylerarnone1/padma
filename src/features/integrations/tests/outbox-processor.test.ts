import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  outboxFindMany: vi.fn(),
  outboxUpdateMany: vi.fn(),
  outboxUpdate: vi.fn(),
  endpointFindMany: vi.fn(),
  deliveryCreateMany: vi.fn(),
  deliveryFindMany: vi.fn(),
  deliveryUpdateMany: vi.fn(),
  deliveryUpdate: vi.fn(),
  assertSafeWebhookUrl: vi.fn(),
  postSignedWebhook: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  database: {
    outboxEvent: {
      findMany: mocks.outboxFindMany,
      updateMany: mocks.outboxUpdateMany,
      update: mocks.outboxUpdate,
    },
    webhookEndpoint: {
      findMany: mocks.endpointFindMany,
    },
    webhookDelivery: {
      createMany: mocks.deliveryCreateMany,
      findMany: mocks.deliveryFindMany,
      updateMany: mocks.deliveryUpdateMany,
      update: mocks.deliveryUpdate,
    },
  },
}));

vi.mock("@/lib/crypto/encryption", () => ({
  decryptSecret: vi.fn(() => "webhook-secret"),
}));

vi.mock("@/features/integrations/security/webhook-security", () => ({
  assertSafeWebhookUrl: mocks.assertSafeWebhookUrl,
  isLocalDevelopmentWebhookUrl: vi.fn(() => false),
  signWebhook: vi.fn(() => "signature"),
}));

vi.mock("@/features/integrations/security/webhook-transport", () => ({
  postSignedWebhook: mocks.postSignedWebhook,
}));

vi.mock("@/lib/logging/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import {
  processOutboxBatch,
  processWebhookDeliveryBatch,
} from "@/features/integrations/services/outbox-processor";

const outboxEvent = {
  id: "b80efbe7-a826-4827-aaf6-92a1eeef742c",
  topic: "record.created",
  aggregateType: "record",
  aggregateId: "record-1",
  ownerId: "user-1",
  payload: { name: "Example" },
  status: "PROCESSING",
  attemptCount: 1,
  availableAt: new Date("2026-01-01T00:00:00.000Z"),
  lockedAt: new Date("2026-01-01T00:00:00.000Z"),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("outbox processor leases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.outboxUpdateMany.mockResolvedValue({ count: 1 });
    mocks.outboxUpdate.mockResolvedValue({});
    mocks.endpointFindMany.mockResolvedValue([]);
    mocks.deliveryCreateMany.mockResolvedValue({ count: 0 });
    mocks.deliveryUpdateMany.mockResolvedValue({ count: 1 });
    mocks.deliveryUpdate.mockResolvedValue({});
    mocks.assertSafeWebhookUrl.mockResolvedValue(
      new URL("https://hooks.example.test/events"),
    );
  });

  it("includes stale processing events and claims them with a new lease", async () => {
    mocks.outboxFindMany.mockResolvedValue([outboxEvent]);

    await expect(processOutboxBatch()).resolves.toBe(1);

    const findArguments = mocks.outboxFindMany.mock.calls[0]?.[0];
    expect(findArguments.where.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "PROCESSING",
          lockedAt: { lte: expect.any(Date) },
        }),
      ]),
    );
    expect(mocks.outboxUpdateMany).toHaveBeenCalledWith({
      where: {
        id: outboxEvent.id,
        status: "PROCESSING",
        lockedAt: outboxEvent.lockedAt,
      },
      data: {
        status: "PROCESSING",
        lockedAt: expect.any(Date),
        attemptCount: { increment: 1 },
      },
    });
  });

  it("marks a webhook delivery processing before the network call", async () => {
    mocks.deliveryFindMany.mockResolvedValue([
      {
        id: "delivery-1",
        status: "RETRYING",
        attemptCount: 1,
        nextAttemptAt: null,
        lockedAt: null,
        endpoint: {
          id: "endpoint-1",
          url: "https://hooks.example.test/events",
          secretEncrypted: "encrypted",
        },
        outboxEvent,
      },
    ]);
    mocks.postSignedWebhook.mockResolvedValue({ status: 204 });

    await expect(processWebhookDeliveryBatch()).resolves.toBe(1);

    expect(mocks.deliveryUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "delivery-1",
        status: "RETRYING",
        attemptCount: 1,
      },
      data: {
        status: "PROCESSING",
        lockedAt: expect.any(Date),
        attemptCount: { increment: 1 },
      },
    });
    expect(
      mocks.deliveryUpdateMany.mock.invocationCallOrder[0],
    ).toBeLessThan(
      mocks.postSignedWebhook.mock.invocationCallOrder[0] ?? Infinity,
    );
    expect(mocks.deliveryUpdate).toHaveBeenCalledWith({
      where: { id: "delivery-1" },
      data: expect.objectContaining({
        status: "DELIVERED",
        lockedAt: null,
      }),
    });
  });
});

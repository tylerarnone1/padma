import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertSafeWebhookUrl: vi.fn(),
  encryptSecret: vi.fn(),
  transaction: vi.fn(),
  endpointCreate: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/features/integrations/security/webhook-security", () => ({
  assertSafeWebhookUrl: mocks.assertSafeWebhookUrl,
}));

vi.mock("@/lib/crypto/encryption", () => ({
  encryptSecret: mocks.encryptSecret,
}));

vi.mock("@/lib/db/client", () => ({
  database: {
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/logging/request-context", () => ({
  getRequestContext: vi.fn(() => ({
    requestId: "request-1",
    userAgent: "test agent",
  })),
}));

import { createWebhookEndpoint } from "@/features/integrations/services/webhook-service";

describe("webhook creation service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.assertSafeWebhookUrl.mockResolvedValue(
      new URL("https://hooks.example/events"),
    );
    mocks.encryptSecret.mockReturnValue("encrypted-secret");
    mocks.endpointCreate.mockResolvedValue({
      id: "endpoint-1",
      url: "https://hooks.example/events",
      eventPatterns: ["record.created"],
    });
    mocks.auditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation(
      (callback: (transaction: unknown) => unknown) =>
        callback({
          webhookEndpoint: { create: mocks.endpointCreate },
          auditEvent: { create: mocks.auditCreate },
        }),
    );
  });

  it("commits the endpoint and success audit in one transaction", async () => {
    const result = await createWebhookEndpoint({
      actorId: "user-1",
      webhook: {
        url: "https://hooks.example/events",
        eventPatterns: ["record.created"],
      },
    });

    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.endpointCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        url: "https://hooks.example/events",
        secretEncrypted: "encrypted-secret",
      }),
      select: expect.any(Object),
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: "user-1",
        action: "webhook:create",
        outcome: "SUCCESS",
        requestId: "request-1",
        userAgent: "test agent",
      }),
    });
    expect(result.endpoint.id).toBe("endpoint-1");
    expect(result.signingSecret).toMatch(/^whsec_[A-Za-z0-9_-]+$/);
    expect(result.signingSecret).not.toBe("encrypted-secret");
  });

  it("rejects an unsafe destination before opening a transaction", async () => {
    mocks.assertSafeWebhookUrl.mockRejectedValue(
      new Error("Webhook URLs cannot resolve to private addresses."),
    );

    await expect(
      createWebhookEndpoint({
        actorId: "user-1",
        webhook: {
          url: "https://internal.example/events",
          eventPatterns: ["record.created"],
        },
      }),
    ).rejects.toMatchObject({
      status: 422,
      code: "validation_failed",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

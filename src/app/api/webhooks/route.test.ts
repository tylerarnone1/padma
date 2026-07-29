import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthenticationRequiredError,
  ForbiddenError,
  RateLimitedError,
} from "@/lib/http/errors";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  assertRecentMfa: vi.fn(),
  requirePermission: vi.fn(),
  createWebhookEndpoint: vi.fn(),
  listWebhookEndpoints: vi.fn(),
  recordSecurityAudit: vi.fn(),
  assertWithinRateLimit: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireSession: mocks.requireSession,
  assertRecentMfa: mocks.assertRecentMfa,
}));

vi.mock("@/features/access-control/data/authorization", () => ({
  requirePermission: mocks.requirePermission,
}));

vi.mock("@/features/integrations/services/webhook-service", () => ({
  createWebhookEndpoint: mocks.createWebhookEndpoint,
  listWebhookEndpoints: mocks.listWebhookEndpoints,
}));

vi.mock("@/lib/http/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/http/rate-limit")>();
  return {
    ...actual,
    assertWithinRateLimit: mocks.assertWithinRateLimit,
  };
});

vi.mock("@/lib/audit/security-audit", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/audit/security-audit")>();
  return {
    ...actual,
    recordSecurityAudit: mocks.recordSecurityAudit,
  };
});

vi.mock("@/lib/logging/logger", () => ({
  logger: {
    error: mocks.loggerError,
    warn: vi.fn(),
  },
}));

import { GET, POST } from "./route";

const session = {
  user: {
    id: "user-1",
    twoFactorEnabled: true,
  },
  session: {
    id: "session-1",
    mfaVerifiedAt: new Date(),
  },
};

function webhookRequest(): Request {
  return new Request("https://app.example/api/webhooks", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://app.example",
      "sec-fetch-site": "same-origin",
      "user-agent": "Padma test",
    },
    body: JSON.stringify({
      url: "https://hooks.example/events",
      eventPatterns: ["record.created"],
    }),
  });
}

describe("webhook route security boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireSession.mockResolvedValue(session);
    mocks.requirePermission.mockResolvedValue(undefined);
    mocks.createWebhookEndpoint.mockResolvedValue({
      endpoint: {
        id: "endpoint-1",
        url: "https://hooks.example/events",
      },
      signingSecret: "whsec_once",
    });
    mocks.listWebhookEndpoints.mockResolvedValue([]);
    mocks.recordSecurityAudit.mockResolvedValue(undefined);
    mocks.assertWithinRateLimit.mockResolvedValue(undefined);
  });

  it("durably audits an MFA denial for the authenticated actor", async () => {
    mocks.assertRecentMfa.mockImplementation(() => {
      throw new ForbiddenError("Recent MFA is required.");
    });

    const response = await POST(webhookRequest());

    expect(response.status).toBe(403);
    expect(mocks.requirePermission).not.toHaveBeenCalled();
    expect(mocks.createWebhookEndpoint).not.toHaveBeenCalled();
    expect(mocks.recordSecurityAudit).toHaveBeenCalledWith({
      actorId: "user-1",
      action: "webhook:create",
      targetType: "webhook_endpoint",
      outcome: "DENIED",
      code: "forbidden",
    });
  });

  it("audits an unauthenticated denial without inventing an actor", async () => {
    mocks.requireSession.mockRejectedValue(
      new AuthenticationRequiredError(),
    );

    const response = await POST(webhookRequest());

    expect(response.status).toBe(401);
    expect(mocks.recordSecurityAudit).toHaveBeenCalledWith({
      action: "webhook:create",
      targetType: "webhook_endpoint",
      outcome: "DENIED",
      code: "authentication_required",
    });
  });

  it("does not duplicate the permission policy's denial audit", async () => {
    // The real requirePermission audits its own denial and marks the error as
    // already audited.
    mocks.requirePermission.mockRejectedValue(
      new ForbiddenError(undefined, true),
    );

    const response = await POST(webhookRequest());

    expect(response.status).toBe(403);
    expect(mocks.recordSecurityAudit).not.toHaveBeenCalled();
  });

  it("audits an unexpected permission lookup failure", async () => {
    mocks.requirePermission.mockRejectedValue(
      new Error("Permission database unavailable"),
    );

    const response = await POST(webhookRequest());

    expect(response.status).toBe(500);
    expect(mocks.recordSecurityAudit).toHaveBeenCalledWith({
      actorId: "user-1",
      action: "webhook:create",
      targetType: "webhook_endpoint",
      outcome: "FAILURE",
      code: "internal_error",
    });
  });

  it("preserves the protected mutation order on success", async () => {
    const response = await POST(webhookRequest());

    expect(response.status).toBe(201);
    expect(mocks.requireSession).toHaveBeenCalledOnce();
    expect(mocks.assertRecentMfa).toHaveBeenCalledWith(session);
    expect(mocks.requirePermission).toHaveBeenCalledOnce();
    expect(mocks.createWebhookEndpoint).toHaveBeenCalledOnce();
    expect(mocks.requireSession.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.assertRecentMfa.mock.invocationCallOrder[0] ?? Infinity,
    );
    expect(mocks.assertRecentMfa.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.requirePermission.mock.invocationCallOrder[0] ?? Infinity,
    );
    expect(mocks.requirePermission.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.createWebhookEndpoint.mock.invocationCallOrder[0] ?? Infinity,
    );
  });

  it("rate limits creation before performing the mutation", async () => {
    mocks.assertWithinRateLimit.mockRejectedValue(
      new RateLimitedError(30),
    );

    const response = await POST(webhookRequest());

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("30");
    expect(mocks.createWebhookEndpoint).not.toHaveBeenCalled();
  });

  it("scopes the listing to the authenticated owner", async () => {
    mocks.listWebhookEndpoints.mockResolvedValue([
      { id: "endpoint-1", url: "https://hooks.example/events" },
    ]);

    const response = await GET(
      new Request("https://app.example/api/webhooks", { method: "GET" }),
    );

    expect(response.status).toBe(200);
    expect(mocks.listWebhookEndpoints).toHaveBeenCalledWith({
      actorId: "user-1",
    });
    expect(mocks.requirePermission).toHaveBeenCalledWith({
      userId: "user-1",
      permission: "integration:read",
    });
  });

  it("never returns a signing secret when listing", async () => {
    mocks.listWebhookEndpoints.mockResolvedValue([
      { id: "endpoint-1", url: "https://hooks.example/events" },
    ]);

    const response = await GET(
      new Request("https://app.example/api/webhooks", { method: "GET" }),
    );

    expect(await response.text()).not.toContain("whsec_");
  });

  it("denies an unauthenticated listing", async () => {
    mocks.requireSession.mockRejectedValue(new AuthenticationRequiredError());

    const response = await GET(
      new Request("https://app.example/api/webhooks", { method: "GET" }),
    );

    expect(response.status).toBe(401);
    expect(mocks.listWebhookEndpoints).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApplicationError } from "@/lib/http/errors";

const mocks = vi.hoisted(() => ({
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  database: {
    auditEvent: { create: mocks.auditCreate },
  },
}));

vi.mock("@/lib/logging/request-context", () => ({
  getRequestContext: vi.fn(() => ({
    requestId: "request-1",
    userAgent: "test agent",
  })),
}));

import {
  auditOutcomeForError,
  recordSecurityAudit,
} from "./security-audit";

describe("security audit outcome", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auditCreate.mockResolvedValue({});
  });

  it("classifies expected rejections as denials", () => {
    expect(
      auditOutcomeForError(
        new ApplicationError("Rejected", 403, "rejected"),
      ),
    ).toBe("DENIED");
    expect(
      auditOutcomeForError(z.string().safeParse(42).error),
    ).toBe("DENIED");
    expect(auditOutcomeForError(new SyntaxError("Invalid JSON"))).toBe(
      "DENIED",
    );
  });

  it("classifies unexpected and server errors as failures", () => {
    expect(auditOutcomeForError(new Error("Database unavailable"))).toBe(
      "FAILURE",
    );
    expect(
      auditOutcomeForError(
        new ApplicationError("Unavailable", 503, "unavailable"),
      ),
    ).toBe("FAILURE");
  });

  it("records bounded security context without raw error details", async () => {
    await recordSecurityAudit({
      actorId: "user-1",
      action: "webhook:create",
      targetType: "webhook_endpoint",
      outcome: "DENIED",
      code: "forbidden",
    });

    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: {
        actorId: "user-1",
        action: "webhook:create",
        targetType: "webhook_endpoint",
        targetId: null,
        outcome: "DENIED",
        requestId: "request-1",
        userAgent: "test agent",
        metadata: { code: "forbidden" },
      },
    });
  });
});

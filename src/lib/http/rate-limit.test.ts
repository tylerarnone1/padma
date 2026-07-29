import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  findUnique: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  database: { $transaction: mocks.transaction },
}));

import {
  assertWithinRateLimit,
  consumeRateLimit,
  rateLimitKey,
  rateLimitSubject,
} from "./rate-limit";
import { RateLimitedError } from "./errors";

const now = new Date("2026-07-29T12:00:00.000Z");

describe("route rate limiting", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.upsert.mockResolvedValue({});
    mocks.update.mockResolvedValue({});
    mocks.findUnique.mockResolvedValue(null);
    mocks.transaction.mockImplementation(
      (callback: (transaction: unknown) => unknown) =>
        callback({
          rateLimit: {
            findUnique: mocks.findUnique,
            upsert: mocks.upsert,
            update: mocks.update,
          },
        }),
    );
  });

  it("namespaces keys so Better Auth counters cannot collide", () => {
    expect(rateLimitKey("webhook:create", "session:abc")).toBe(
      "padma:route:webhook:create:session:abc",
    );
  });

  it("prefers the session over a spoofable forwarded address", () => {
    const request = new Request("https://app.example/api/webhooks", {
      headers: { "x-forwarded-for": "203.0.113.9" },
    });

    expect(rateLimitSubject({ request, sessionId: "session-1" })).toBe(
      "session:session-1",
    );
    expect(rateLimitSubject({ request })).toBe("address:203.0.113.9");
    expect(
      rateLimitSubject({
        request: new Request("https://app.example/api/webhooks"),
      }),
    ).toBe("address:unknown");
  });

  it("opens a fresh window for a first request", async () => {
    const decision = await consumeRateLimit({
      key: "k",
      limit: 3,
      windowSeconds: 60,
      now,
    });

    expect(decision).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { key: "k", count: 1, lastRequest: BigInt(now.getTime()) },
      }),
    );
  });

  it("increments inside an open window", async () => {
    mocks.findUnique.mockResolvedValue({
      count: 1,
      lastRequest: BigInt(now.getTime() - 10_000),
    });

    const decision = await consumeRateLimit({
      key: "k",
      limit: 3,
      windowSeconds: 60,
      now,
    });

    expect(decision.allowed).toBe(true);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { key: "k" },
      data: { count: { increment: 1 } },
    });
  });

  it("denies once the limit is reached and reports when to retry", async () => {
    mocks.findUnique.mockResolvedValue({
      count: 3,
      lastRequest: BigInt(now.getTime() - 20_000),
    });

    const decision = await consumeRateLimit({
      key: "k",
      limit: 3,
      windowSeconds: 60,
      now,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.retryAfterSeconds).toBe(40);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("restarts the window once it has expired", async () => {
    mocks.findUnique.mockResolvedValue({
      count: 99,
      lastRequest: BigInt(now.getTime() - 61_000),
    });

    const decision = await consumeRateLimit({
      key: "k",
      limit: 3,
      windowSeconds: 60,
      now,
    });

    expect(decision.allowed).toBe(true);
    expect(mocks.upsert).toHaveBeenCalled();
  });

  it("raises a typed error carrying the retry hint", async () => {
    mocks.findUnique.mockResolvedValue({
      count: 5,
      lastRequest: BigInt(now.getTime()),
    });

    const error = await assertWithinRateLimit({
      key: "k",
      limit: 5,
      windowSeconds: 30,
      now,
    }).then(
      () => null,
      (thrown: unknown) => thrown,
    );

    expect(error).toBeInstanceOf(RateLimitedError);
    expect((error as RateLimitedError).status).toBe(429);
    expect((error as RateLimitedError).retryAfterSeconds).toBe(30);
  });
});

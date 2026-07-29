import "server-only";

import { database } from "@/lib/db/client";
import { RateLimitedError } from "@/lib/http/errors";

/**
 * Fixed-window rate limiting for Padma's own route handlers.
 *
 * Better Auth rate limits only the endpoints it serves. Everything else —
 * including route handlers that happen to live under `/api/auth/` but are not
 * part of the Better Auth handler — is uncovered without this.
 *
 * Keys are namespaced because Better Auth stores its own counters in the same
 * table.
 */
const KEY_NAMESPACE = "padma:route";

export type RateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export function rateLimitKey(scope: string, subject: string): string {
  return `${KEY_NAMESPACE}:${scope}:${subject}`;
}

/**
 * Identifies the caller for limiting purposes.
 *
 * A session id is used when present. Otherwise this falls back to a
 * proxy-supplied client address, which is spoofable unless the deployment
 * terminates and rewrites `x-forwarded-for` at a trusted edge — see
 * docs/production-checklist.md. Unauthenticated limits are therefore a
 * throttle, not an authorization control.
 */
export function rateLimitSubject(input: {
  request: Request;
  sessionId?: string | undefined;
}): string {
  if (input.sessionId) return `session:${input.sessionId}`;

  const forwarded = input.request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  return `address:${forwarded || "unknown"}`;
}

export async function consumeRateLimit(input: {
  key: string;
  limit: number;
  windowSeconds: number;
  now?: Date;
}): Promise<RateLimitDecision> {
  const nowMs = (input.now ?? new Date()).getTime();
  const windowMs = input.windowSeconds * 1000;

  return database.$transaction(async (transaction) => {
    const existing = await transaction.rateLimit.findUnique({
      where: { key: input.key },
      select: { count: true, lastRequest: true },
    });

    const windowStartedAt = existing ? Number(existing.lastRequest) : 0;
    const windowExpired = nowMs - windowStartedAt >= windowMs;

    if (!existing || windowExpired) {
      await transaction.rateLimit.upsert({
        where: { key: input.key },
        create: { key: input.key, count: 1, lastRequest: BigInt(nowMs) },
        update: { count: 1, lastRequest: BigInt(nowMs) },
      });
      return { allowed: true, retryAfterSeconds: 0 };
    }

    if (existing.count >= input.limit) {
      const retryAfterMs = windowStartedAt + windowMs - nowMs;
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      };
    }

    await transaction.rateLimit.update({
      where: { key: input.key },
      data: { count: { increment: 1 } },
    });
    return { allowed: true, retryAfterSeconds: 0 };
  });
}

export async function assertWithinRateLimit(input: {
  key: string;
  limit: number;
  windowSeconds: number;
  now?: Date;
}): Promise<void> {
  const decision = await consumeRateLimit(input);
  if (!decision.allowed) {
    throw new RateLimitedError(decision.retryAfterSeconds);
  }
}

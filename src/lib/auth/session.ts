import "server-only";

import { headers } from "next/headers";
import { auth, type AuthSession } from "@/lib/auth/auth";
import { isDevelopmentAuthRequestEnabled } from "@/lib/auth/auth-mode";
import { hasValidDevelopmentSessionCookie } from "@/lib/auth/development-session-cookie";
import { getDevelopmentSession } from "@/lib/auth/development-session";
import { getAuthSecret, getServerEnvironment } from "@/lib/env/server";
import {
  AuthenticationRequiredError,
  ForbiddenError,
} from "@/lib/http/errors";

export async function getCurrentSession(
  requestHeaders?: Headers,
): Promise<AuthSession | null> {
  const resolvedHeaders = requestHeaders ?? (await headers());

  if (
    isDevelopmentAuthRequestEnabled(
      getServerEnvironment(),
      resolvedHeaders.get("x-padma-request-host"),
    )
  ) {
    if (
      !hasValidDevelopmentSessionCookie(resolvedHeaders, getAuthSecret())
    ) {
      return null;
    }

    return getDevelopmentSession();
  }

  return auth.api.getSession({
    headers: resolvedHeaders,
  });
}

export async function requireSession(
  requestHeaders?: Headers,
): Promise<AuthSession> {
  const session = await getCurrentSession(requestHeaders);
  if (!session) {
    throw new AuthenticationRequiredError();
  }
  return session;
}

export function hasRecentMfa(
  session: AuthSession,
  maximumAgeMs = 15 * 60 * 1000,
): boolean {
  if (!session.user.twoFactorEnabled) {
    return false;
  }

  const verifiedAt = session.session.mfaVerifiedAt;
  if (!(verifiedAt instanceof Date)) return false;

  const ageMs = Date.now() - verifiedAt.getTime();
  return ageMs >= -30_000 && ageMs <= maximumAgeMs;
}

export function assertRecentMfa(session: AuthSession): void {
  if (!session.user.twoFactorEnabled) {
    throw new ForbiddenError(
      "Multi-factor authentication must be configured for this action.",
    );
  }
  if (!hasRecentMfa(session)) {
    throw new ForbiddenError("Recent multi-factor verification is required.");
  }
}

export async function requireRecentMfa(
  requestHeaders?: Headers,
): Promise<AuthSession> {
  const session = await requireSession(requestHeaders);
  assertRecentMfa(session);
  return session;
}

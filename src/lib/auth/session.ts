import "server-only";

import { headers } from "next/headers";
import { auth, type AuthSession } from "@/lib/auth/auth";
import { isDevelopmentAuthEnabled } from "@/lib/auth/auth-mode";
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

  if (isDevelopmentAuthEnabled(getServerEnvironment())) {
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
    return true;
  }

  const verifiedAt = session.session.mfaVerifiedAt;
  return (
    verifiedAt instanceof Date &&
    Date.now() - verifiedAt.getTime() <= maximumAgeMs
  );
}

export async function requireRecentMfa(
  requestHeaders?: Headers,
): Promise<AuthSession> {
  const session = await requireSession(requestHeaders);
  if (!hasRecentMfa(session)) {
    throw new ForbiddenError("Recent multi-factor verification is required.");
  }
  return session;
}

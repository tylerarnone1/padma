import "server-only";

import { betterAuth } from "better-auth/minimal";
import { createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { database } from "@/lib/db/client";
import {
  getAuthSecret,
  getServerEnvironment,
  getTrustedOrigins,
} from "@/lib/env/server";
import { recordMfaLifecycleResult } from "@/lib/auth/mfa-audit";
import { guardMfaRequest } from "@/lib/auth/mfa-guard";
import { recordMfaVerificationResult } from "@/lib/auth/recent-mfa-verification";
import { logger } from "@/lib/logging/logger";

const environment = getServerEnvironment();

const socialProviders = {
  ...(environment.GITHUB_CLIENT_ID && environment.GITHUB_CLIENT_SECRET
    ? {
        github: {
          clientId: environment.GITHUB_CLIENT_ID,
          clientSecret: environment.GITHUB_CLIENT_SECRET,
        },
      }
    : {}),
  ...(environment.GOOGLE_CLIENT_ID && environment.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: environment.GOOGLE_CLIENT_ID,
          clientSecret: environment.GOOGLE_CLIENT_SECRET,
        },
      }
    : {}),
};

export const auth = betterAuth({
  appName: environment.APP_NAME,
  baseURL: environment.APP_URL,
  secret: getAuthSecret(),
  trustedOrigins: getTrustedOrigins(),
  database: prismaAdapter(database, {
    provider: "postgresql",
  }),
  experimental: {
    joins: true,
  },
  emailAndPassword: {
    enabled: false,
  },
  socialProviders,
  account: {
    accountLinking: {
      enabled: true,
      disableImplicitLinking: true,
      allowUnlinkingAll: false,
    },
    encryptOAuthTokens: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    freshAge: 60 * 15,
    additionalFields: {
      mfaVerifiedAt: {
        type: "date",
        required: false,
        input: false,
      },
    },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    storage: "database",
  },
  advanced: {
    cookiePrefix: "padma",
    useSecureCookies: environment.NODE_ENV === "production",
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: environment.NODE_ENV === "production",
      path: "/",
    },
  },
  hooks: {
    // Padma delegates all of `/api/auth/*` to Better Auth, so these hooks are
    // the only seam every caller of those endpoints must pass through.
    before: createAuthMiddleware(async (context) => {
      await guardMfaRequest({
        path: context.path,
        resolveSession: () =>
          auth.api.getSession({
            headers: context.headers ?? new Headers(),
          }),
        ...(context.headers ? { headers: context.headers } : {}),
      });
    }),
    after: createAuthMiddleware(async (context) => {
      const resolveActorId = async (): Promise<string | null> => {
        if (!context.headers) return null;
        const session = await auth.api.getSession({
          headers: context.headers,
        });
        return session?.user.id ?? null;
      };

      await recordMfaVerificationResult({
        path: context.path,
        returned: context.context.returned,
        newSession: context.context.newSession,
        session: context.context.session,
        resolveActorId,
        ...(context.headers ? { headers: context.headers } : {}),
      });

      await recordMfaLifecycleResult({
        path: context.path,
        returned: context.context.returned,
        resolveActorId,
        ...(context.headers ? { headers: context.headers } : {}),
      });
    }),
  },
  plugins: [
    twoFactor({
      issuer: environment.APP_NAME,
      allowPasswordless: true,
      accountLockout: {
        enabled: true,
        maxFailedAttempts: 5,
        durationSeconds: 15 * 60,
      },
    }),
    nextCookies(),
  ],
  logger: {
    disabled: false,
    level: environment.NODE_ENV === "development" ? "debug" : "warn",
    log(level, message, ...args) {
      logger[level](
        {
          authArgumentTypes: args.map((argument) =>
            argument instanceof Error ? argument.name : typeof argument,
          ),
        },
        message,
      );
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;

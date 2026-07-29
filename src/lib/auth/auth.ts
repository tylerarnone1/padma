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

const mfaVerificationPaths = new Set([
  "/two-factor/verify-totp",
  "/two-factor/verify-otp",
  "/two-factor/verify-backup-code",
]);

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
    after: createAuthMiddleware(async (context) => {
      if (!mfaVerificationPaths.has(context.path)) {
        return;
      }

      const sessionId =
        context.context.newSession?.session.id ??
        context.context.session?.session.id;

      if (sessionId) {
        await database.session.update({
          where: { id: sessionId },
          data: { mfaVerifiedAt: new Date() },
        });
      }
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
      logger[level]({ args }, message);
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;

import "server-only";

import pino from "pino";
import { getServerEnvironment } from "@/lib/env/server";

const environment = getServerEnvironment();

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: {
    service: environment.APP_NAME,
    environment: environment.NODE_ENV,
  },
  /**
   * Pino matches whole property names, not substrings, so every secret-bearing
   * key this codebase actually uses has to be listed. `*.secret` does not cover
   * `signingSecret`.
   */
  redact: {
    censor: "[REDACTED]",
    paths: [
      ...[
        "authorization",
        "cookie",
        "set-cookie",
        "setCookie",
        "password",
        "token",
        "sessionToken",
        "accessToken",
        "refreshToken",
        "idToken",
        "secret",
        "signingSecret",
        "secretEncrypted",
        "credentialsEncrypted",
        "backupCodes",
        "totpURI",
        "totpUri",
        "apiKey",
      ].flatMap((property) => [property, `*.${property}`]),
      "req.headers.authorization",
      "req.headers.cookie",
    ],
  },
  serializers: {
    error(error: unknown) {
      if (!(error instanceof Error)) {
        return { type: "UnknownError" };
      }

      return {
        type: error.name,
        message: error.message,
        stack:
          environment.NODE_ENV === "development" ? error.stack : undefined,
      };
    },
  },
});

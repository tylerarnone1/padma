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
  redact: {
    censor: "[REDACTED]",
    paths: [
      "authorization",
      "cookie",
      "password",
      "token",
      "accessToken",
      "refreshToken",
      "idToken",
      "secret",
      "req.headers.authorization",
      "req.headers.cookie",
      "*.authorization",
      "*.cookie",
      "*.password",
      "*.token",
      "*.accessToken",
      "*.refreshToken",
      "*.idToken",
      "*.secret",
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

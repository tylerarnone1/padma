import "server-only";

import { z } from "zod";
import { authModes, isLoopbackHostname } from "@/lib/auth/auth-mode";

function emptyStringToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === ""
    ? undefined
    : value;
}

function isLoopbackUrl(value: string): boolean {
  try {
    return isLoopbackHostname(new URL(value).hostname);
  } catch {
    return false;
  }
}

function splitTrustedOrigins(value: string): string[] {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const optionalSecret = z.preprocess(
  emptyStringToUndefined,
  z.string().trim().min(32).optional(),
);
const optionalProviderValue = z.preprocess(
  emptyStringToUndefined,
  z.string().trim().min(1).optional(),
);
const optionalUrl = z.preprocess(
  emptyStringToUndefined,
  z.url().optional(),
);

const serverEnvironmentSchema = z
  .object({
    APP_NAME: z.string().trim().min(1).default("Padma"),
    APP_URL: z.url().default("http://localhost:3000"),
    AUTH_MODE: z.enum(authModes).default("mock"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DATABASE_URL: z
      .string()
      .min(1)
      .default(
        "postgresql://postgres:postgres@localhost:5433/padma?schema=public",
      ),
    BETTER_AUTH_SECRET: optionalSecret,
    INTEGRATION_ENCRYPTION_KEY: optionalSecret,
    GITHUB_CLIENT_ID: optionalProviderValue,
    GITHUB_CLIENT_SECRET: optionalProviderValue,
    GOOGLE_CLIENT_ID: optionalProviderValue,
    GOOGLE_CLIENT_SECRET: optionalProviderValue,
    TRUSTED_ORIGINS: z.string().default(""),
    OTEL_EXPORTER_OTLP_ENDPOINT: optionalUrl,
  })
  .superRefine((environment, context) => {
    const pairedSecrets = [
      ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"],
      ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    ] as const;

    for (const [idKey, secretKey] of pairedSecrets) {
      if (Boolean(environment[idKey]) !== Boolean(environment[secretKey])) {
        context.addIssue({
          code: "custom",
          path: [idKey],
          message: `${idKey} and ${secretKey} must be configured together`,
        });
      }
    }

    if (
      environment.NODE_ENV === "production" &&
      !environment.BETTER_AUTH_SECRET
    ) {
      context.addIssue({
        code: "custom",
        path: ["BETTER_AUTH_SECRET"],
        message: "BETTER_AUTH_SECRET is required in production",
      });
    }

    if (
      environment.NODE_ENV === "production" &&
      !environment.INTEGRATION_ENCRYPTION_KEY
    ) {
      context.addIssue({
        code: "custom",
        path: ["INTEGRATION_ENCRYPTION_KEY"],
        message: "INTEGRATION_ENCRYPTION_KEY is required in production",
      });
    }

    // `AUTH_MODE` and `NODE_ENV` both default to their development values, so a
    // deployment that forgets to set them would otherwise inherit mock
    // authentication. Refuse to start on the combination that matters: mock
    // mode with a public application origin. The runtime gate in auth-mode.ts
    // would still deny, but failing at startup makes the misconfiguration
    // visible instead of silent.
    if (environment.AUTH_MODE === "mock" && !isLoopbackUrl(environment.APP_URL)) {
      context.addIssue({
        code: "custom",
        path: ["AUTH_MODE"],
        message:
          'AUTH_MODE="mock" requires a loopback APP_URL. Set AUTH_MODE="oauth" for any non-local origin.',
      });
    }

    for (const origin of splitTrustedOrigins(environment.TRUSTED_ORIGINS)) {
      let parsed: URL;
      try {
        parsed = new URL(origin);
      } catch {
        context.addIssue({
          code: "custom",
          path: ["TRUSTED_ORIGINS"],
          message: `"${origin}" is not an absolute URL`,
        });
        continue;
      }

      // Trusted origins decide which cross-origin mutations are accepted, so a
      // path or credentials in one is a configuration error, not a detail to
      // normalize away.
      if (
        !["http:", "https:"].includes(parsed.protocol) ||
        parsed.username ||
        parsed.password ||
        parsed.pathname !== "/" ||
        parsed.search ||
        parsed.hash
      ) {
        context.addIssue({
          code: "custom",
          path: ["TRUSTED_ORIGINS"],
          message: `"${origin}" must be a bare http(s) origin`,
        });
      }
    }
  });

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

let cachedEnvironment: ServerEnvironment | undefined;

export function parseServerEnvironment(
  environment: NodeJS.ProcessEnv,
): ServerEnvironment {
  const parsed = serverEnvironmentSchema.safeParse(environment);
  if (!parsed.success) {
    const details = z.prettifyError(parsed.error);
    throw new Error(`Invalid server environment:\n${details}`);
  }

  return parsed.data;
}

export function getServerEnvironment(): ServerEnvironment {
  if (cachedEnvironment) {
    return cachedEnvironment;
  }

  cachedEnvironment = parseServerEnvironment(process.env);
  return cachedEnvironment;
}

export function requireConfiguredAuthSecret(
  configuredSecret: string | undefined,
): string {
  if (!configuredSecret) {
    throw new Error(
      "BETTER_AUTH_SECRET is missing. Start development through `npm run dev` or `npm run dev:next` so Padma can inject one process-wide secret.",
    );
  }
  return configuredSecret;
}

export function getAuthSecret(): string {
  return requireConfiguredAuthSecret(
    getServerEnvironment().BETTER_AUTH_SECRET,
  );
}

export function getTrustedOrigins(): string[] {
  const environment = getServerEnvironment();
  return [
    environment.APP_URL,
    ...splitTrustedOrigins(environment.TRUSTED_ORIGINS),
  ];
}

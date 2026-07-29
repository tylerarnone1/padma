export const authModes = ["oauth", "mock"] as const;

export type AuthMode = (typeof authModes)[number];

type AuthModeEnvironment = {
  APP_URL: string;
  AUTH_MODE: AuthMode;
  NODE_ENV: "development" | "test" | "production";
};

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Mock authentication needs three independent development signals. This keeps
 * a copied AUTH_MODE value from becoming an authentication bypass in a
 * production build or on a public application origin.
 */
export function isDevelopmentAuthEnabled(
  environment: AuthModeEnvironment,
): boolean {
  if (
    environment.AUTH_MODE !== "mock" ||
    environment.NODE_ENV !== "development"
  ) {
    return false;
  }

  return loopbackHosts.has(new URL(environment.APP_URL).hostname);
}

type ContentSecurityPolicyEnvironment = "development" | "production";

export function createContentSecurityPolicy(
  nonce: string,
  environment: ContentSecurityPolicyEnvironment,
): string {
  const isDevelopment = environment === "development";
  const styleSources = isDevelopment
    ? "style-src 'self' 'unsafe-inline'"
    : `style-src 'self' 'nonce-${nonce}'`;
  const fontSources = isDevelopment
    ? "font-src 'self' data:"
    : "font-src 'self'";

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    styleSources,
    "img-src 'self' blob: data:",
    fontSources,
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "worker-src 'self' blob:",
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

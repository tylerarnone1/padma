import { getServerEnvironment, getTrustedOrigins } from "@/lib/env/server";
import { ApplicationError } from "@/lib/http/errors";

const DEFAULT_MAXIMUM_BODY_BYTES = 32 * 1024;

const loopbackHostnames = ["localhost", "127.0.0.1", "[::1]"];

/**
 * `localhost` and `127.0.0.1` are the same origin to a developer but different
 * origins to the URL parser, and Next may canonicalize one into the other. The
 * aliases are treated as equivalent only outside production, and only when the
 * request already arrived on a loopback address.
 */
function addLoopbackAliases(origins: Set<string>, requestUrl: URL): void {
  if (getServerEnvironment().NODE_ENV === "production") return;
  if (!loopbackHostnames.includes(requestUrl.hostname)) return;

  const port = requestUrl.port ? `:${requestUrl.port}` : "";
  for (const hostname of loopbackHostnames) {
    origins.add(`${requestUrl.protocol}//${hostname}${port}`);
  }
}

/**
 * Origins this deployment will accept a cookie-authenticated mutation from.
 *
 * The request's own origin is included because a direct, unproxied request is
 * self-consistent. The rest come from configuration rather than from the `Host`
 * header: reflecting `Host` makes the trust anchor partly attacker-influenced
 * whenever a proxy forwards an unvalidated host, and `TRUSTED_ORIGINS` already
 * exists for deployments that terminate on a different origin.
 */
function acceptedOrigins(request: Request): Set<string> {
  const requestUrl = new URL(request.url);
  const origins = new Set<string>([requestUrl.origin]);

  for (const configured of getTrustedOrigins()) {
    try {
      origins.add(new URL(configured).origin);
    } catch {
      // A malformed configured origin is ignored rather than widening trust.
    }
  }

  addLoopbackAliases(origins, requestUrl);

  return origins;
}

export function assertSameOrigin(request: Request): string {
  const origin = request.headers.get("origin");

  if (!origin || !acceptedOrigins(request).has(origin)) {
    throw new ApplicationError(
      "The request origin could not be verified.",
      403,
      "invalid_origin",
    );
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && !["same-origin", "same-site"].includes(fetchSite)) {
    throw new ApplicationError(
      "Cross-site requests are not allowed.",
      403,
      "cross_site_request",
    );
  }

  return origin;
}

export async function readJsonBody(
  request: Request,
  maximumBytes = DEFAULT_MAXIMUM_BODY_BYTES,
): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") {
    throw new ApplicationError(
      "Content-Type must be application/json.",
      415,
      "unsupported_media_type",
    );
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) {
      throw new ApplicationError(
        "Content-Length must be a non-negative integer.",
        400,
        "invalid_content_length",
      );
    }
    if (Number(contentLength) > maximumBytes) {
      throw new ApplicationError(
        "The request body is too large.",
        413,
        "payload_too_large",
      );
    }
  }

  if (!request.body) {
    return JSON.parse("");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;

      receivedBytes += result.value.byteLength;
      if (receivedBytes > maximumBytes) {
        await reader
          .cancel("Request body exceeded the configured limit.")
          .catch(() => undefined);
        throw new ApplicationError(
          "The request body is too large.",
          413,
          "payload_too_large",
        );
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }

  const text = Buffer.concat(chunks, receivedBytes).toString("utf8");
  return JSON.parse(text) as unknown;
}

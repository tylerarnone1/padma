import { ApplicationError } from "@/lib/http/errors";

const DEFAULT_MAXIMUM_BODY_BYTES = 32 * 1024;

function hostHeaderOrigin(request: Request): string | null {
  const host = request.headers.get("host");
  if (!host) return null;

  try {
    const requestUrl = new URL(request.url);
    const hostUrl = new URL(`${requestUrl.protocol}//${host}`);
    if (
      hostUrl.username ||
      hostUrl.password ||
      hostUrl.pathname !== "/" ||
      hostUrl.search ||
      hostUrl.hash
    ) {
      return null;
    }
    return hostUrl.origin;
  } catch {
    return null;
  }
}

export function assertSameOrigin(request: Request): string {
  const origin = request.headers.get("origin");
  const requestOrigin = new URL(request.url).origin;
  const acceptedOrigins = new Set([
    requestOrigin,
    hostHeaderOrigin(request),
  ]);

  if (!origin || !acceptedOrigins.has(origin)) {
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

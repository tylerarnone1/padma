import { ApplicationError } from "@/lib/http/errors";

const DEFAULT_MAXIMUM_BODY_BYTES = 32 * 1024;

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const requestOrigin = new URL(request.url).origin;

  if (!origin || origin !== requestOrigin) {
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
}

export async function readJsonBody(
  request: Request,
  maximumBytes = DEFAULT_MAXIMUM_BODY_BYTES,
): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new ApplicationError(
      "Content-Type must be application/json.",
      415,
      "unsupported_media_type",
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new ApplicationError(
      "The request body is too large.",
      413,
      "payload_too_large",
    );
  }

  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maximumBytes) {
    throw new ApplicationError(
      "The request body is too large.",
      413,
      "payload_too_large",
    );
  }

  return JSON.parse(text) as unknown;
}

import { createHmac, timingSafeEqual } from "node:crypto";
import { developmentAccount } from "@/mock-data/development-account";

export const DEVELOPMENT_SESSION_COOKIE = "padma.development-session";

const tokenVersion = "v2";
const tokenPurpose = "padma-local-development-session";

export const DEVELOPMENT_SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret)
    .update(`${tokenPurpose}.${payload}`)
    .digest("base64url");
}

/**
 * Mints a local development session token.
 *
 * The expiry is inside the signed payload, not only in the cookie's `Max-Age`.
 * A cookie attribute is a client-side hint: a copied token value would
 * otherwise stay valid for as long as mock mode is enabled.
 */
export function createDevelopmentSessionToken(
  secret: string,
  expiresAtMs: number = Date.now() + DEVELOPMENT_SESSION_LIFETIME_MS,
): string {
  const payload = `${tokenVersion}.${developmentAccount.id}.${expiresAtMs}`;
  return `${payload}.${sign(secret, payload)}`;
}

export function hasValidDevelopmentSessionCookie(
  requestHeaders: Headers,
  secret: string,
  now: number = Date.now(),
): boolean {
  const cookieHeader = requestHeaders.get("cookie");
  if (!cookieHeader) {
    return false;
  }

  const encodedToken = cookieHeader
    .split(";")
    .map((part) => part.trim().split("=", 2))
    .find(([name]) => name === DEVELOPMENT_SESSION_COOKIE)?.[1];

  if (!encodedToken) {
    return false;
  }

  let token: string;
  try {
    token = decodeURIComponent(encodedToken);
  } catch {
    return false;
  }

  const parts = token.split(".");
  if (parts.length !== 4) {
    return false;
  }

  const [version, accountId, expiresAt, signature] = parts as [
    string,
    string,
    string,
    string,
  ];

  if (version !== tokenVersion || accountId !== developmentAccount.id) {
    return false;
  }

  if (!/^\d+$/.test(expiresAt)) {
    return false;
  }

  // Signature first, so an attacker cannot learn anything from the ordering of
  // the cheaper checks.
  const expected = Buffer.from(
    sign(secret, `${version}.${accountId}.${expiresAt}`),
  );
  const received = Buffer.from(signature);
  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    return false;
  }

  return Number(expiresAt) > now;
}

import { createHmac, timingSafeEqual } from "node:crypto";
import { developmentAccount } from "@/mock-data/development-account";

export const DEVELOPMENT_SESSION_COOKIE = "padma.development-session";

const tokenVersion = "v1";
const tokenPurpose = "padma-local-development-session";

export function createDevelopmentSessionToken(secret: string): string {
  const payload = `${tokenVersion}.${developmentAccount.id}`;
  const signature = createHmac("sha256", secret)
    .update(`${tokenPurpose}.${payload}`)
    .digest("base64url");

  return `${payload}.${signature}`;
}

export function hasValidDevelopmentSessionCookie(
  requestHeaders: Headers,
  secret: string,
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

  const expected = Buffer.from(createDevelopmentSessionToken(secret));
  const received = Buffer.from(token);

  return (
    expected.length === received.length &&
    timingSafeEqual(expected, received)
  );
}

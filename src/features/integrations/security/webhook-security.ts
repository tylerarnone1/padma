import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { getServerEnvironment } from "@/lib/env/server";

function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  const [first, second] = octets;
  if (first === undefined || second === undefined) return true;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 100 && second >= 64 && second <= 127) ||
    first >= 224
  );
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.")
  );
}

export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return true;
}

export async function assertSafeWebhookUrl(value: string): Promise<URL> {
  const environment = getServerEnvironment();
  const url = new URL(value);

  if (url.username || url.password) {
    throw new Error("Webhook URLs cannot contain credentials.");
  }
  if (url.protocol !== "https:") {
    const isLocalDevelopment =
      environment.NODE_ENV !== "production" &&
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (!isLocalDevelopment) {
      throw new Error("Webhook URLs must use HTTPS.");
    }
  }

  if (
    environment.NODE_ENV !== "production" &&
    ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
  ) {
    return url;
  }

  const addresses = await lookup(url.hostname, {
    all: true,
    verbatim: true,
  });
  if (
    addresses.length === 0 ||
    addresses.some((address) => isPrivateAddress(address.address))
  ) {
    throw new Error("Webhook URLs cannot resolve to private network addresses.");
  }

  return url;
}

export function signWebhook(input: {
  secret: string;
  timestamp: string;
  payload: string;
}): string {
  return createHmac("sha256", input.secret)
    .update(`${input.timestamp}.${input.payload}`)
    .digest("base64url");
}

export function verifyWebhookSignature(input: {
  secret: string;
  timestamp: string;
  payload: string;
  signature: string;
}): boolean {
  const expected = Buffer.from(
    signWebhook({
      secret: input.secret,
      timestamp: input.timestamp,
      payload: input.payload,
    }),
  );
  const actual = Buffer.from(input.signature);

  return (
    expected.length === actual.length && timingSafeEqual(expected, actual)
  );
}

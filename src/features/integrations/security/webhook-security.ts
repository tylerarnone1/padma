import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { getServerEnvironment } from "@/lib/env/server";

const nonPublicIpv4Addresses = new BlockList();
const nonPublicIpv6Addresses = new BlockList();

for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  nonPublicIpv4Addresses.addSubnet(network, prefix, "ipv4");
}

for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["::ffff:0:0", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  nonPublicIpv6Addresses.addSubnet(network, prefix, "ipv6");
}

export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return nonPublicIpv4Addresses.check(address, "ipv4");
  if (version === 6) return nonPublicIpv6Addresses.check(address, "ipv6");
  return true;
}

function hostnameWithoutBrackets(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
}

export async function assertSafeWebhookUrl(value: string): Promise<URL> {
  const environment = getServerEnvironment();
  const url = new URL(value);
  const hostname = hostnameWithoutBrackets(url.hostname);

  if (url.username || url.password) {
    throw new Error("Webhook URLs cannot contain credentials.");
  }
  if (url.protocol !== "https:") {
    const isLocalDevelopment =
      environment.NODE_ENV !== "production" &&
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "::1"].includes(hostname);
    if (!isLocalDevelopment) {
      throw new Error("Webhook URLs must use HTTPS.");
    }
  }

  if (
    environment.NODE_ENV !== "production" &&
    ["localhost", "127.0.0.1", "::1"].includes(hostname)
  ) {
    return url;
  }

  const addresses = await lookup(hostname, {
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

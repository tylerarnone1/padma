import "server-only";

import { lookup as dnsLookup } from "node:dns";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isPrivateAddress } from "@/features/integrations/security/webhook-security";

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Responses are not used, only their status. A bounded reader keeps a hostile
 * destination from streaming an unbounded body at the worker.
 */
const RESPONSE_BODY_LIMIT_BYTES = 4 * 1024;

export type WebhookTransportResponse = {
  status: number;
};

type LookupResult = string | Array<{ address: string; family: number }>;

type LookupCallback = (
  error: NodeJS.ErrnoException | null,
  address: LookupResult,
  family?: number,
) => void;

/**
 * A DNS resolver that validates the address the socket is about to use.
 *
 * Checking the destination and then calling `fetch` leaves a window: `fetch`
 * resolves the hostname a second time, so a name that answered with a public
 * address during validation can answer with a private one at connection time.
 * Validating inside the connection's own resolver removes the second lookup,
 * because the address this callback returns is the address that gets dialled.
 *
 * TLS is unaffected: the request still carries the hostname, so SNI and
 * certificate verification behave normally.
 */
/**
 * `dns.lookup` is overloaded on its options shape, and Node passes through
 * whatever the socket asked for (including `all: true` when address family
 * autoselection is on). The resolver contract is uniform at runtime, so it is
 * adapted once here rather than at each call.
 */
const resolveHostname = dnsLookup as unknown as (
  hostname: string,
  options: unknown,
  callback: LookupCallback,
) => void;

export function createValidatingLookup(allowPrivateAddresses = false) {
  return function validatingLookup(
    hostname: string,
    options: unknown,
    callback: LookupCallback,
  ): void {
    resolveHostname(hostname, options, (error, address, family) => {
      if (error) {
        callback(error, address, family);
        return;
      }

      if (allowPrivateAddresses) {
        callback(null, address, family);
        return;
      }

      const resolved: Array<{ address: string; family: number }> =
        Array.isArray(address)
          ? address
          : [{ address, family: family ?? 0 }];

      if (resolved.some((entry) => isPrivateAddress(entry.address))) {
        const blocked: NodeJS.ErrnoException = new Error(
          "The webhook destination resolved to a private network address.",
        );
        blocked.code = "EACCES";
        callback(blocked, address, family);
        return;
      }

      callback(null, address, family);
    });
  };
}

/**
 * Posts a signed payload to a webhook destination.
 *
 * Uses `node:https` rather than `fetch` because the platform HTTP client is the
 * only way to supply the connection's resolver, which is what closes the
 * rebinding window. Redirects are never followed: `http.request` does not
 * follow them, and any non-2xx status is reported as a failed delivery.
 */
export async function postSignedWebhook(input: {
  url: URL;
  headers: Record<string, string>;
  body: string;
  timeoutMs?: number;
  allowPrivateAddresses?: boolean;
}): Promise<WebhookTransportResponse> {
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const sendRequest =
    input.url.protocol === "https:" ? httpsRequest : httpRequest;

  return new Promise<WebhookTransportResponse>((resolve, reject) => {
    let settled = false;
    const settleWith = (result: WebhookTransportResponse) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const failWith = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const clientRequest = sendRequest(
      input.url,
      {
        method: "POST",
        headers: {
          ...input.headers,
          "content-length": String(Buffer.byteLength(input.body, "utf8")),
        },
        lookup: createValidatingLookup(input.allowPrivateAddresses === true),
      },
      (response) => {
        const status = response.statusCode ?? 0;
        let received = 0;

        response.on("data", (chunk: Buffer) => {
          received += chunk.byteLength;
          if (received > RESPONSE_BODY_LIMIT_BYTES) {
            response.destroy();
          }
        });
        response.on("end", () => settleWith({ status }));
        response.on("close", () => settleWith({ status }));
        response.on("error", failWith);
      },
    );

    clientRequest.setTimeout(timeoutMs, () => {
      clientRequest.destroy(new Error("The webhook request timed out."));
    });
    clientRequest.on("error", failWith);
    clientRequest.end(input.body);
  });
}

import { describe, expect, it } from "vitest";
import { matchesEvent } from "@/features/integrations/adapters/webhook-adapter";
import {
  isPrivateAddress,
  signWebhook,
  verifyWebhookSignature,
} from "@/features/integrations/security/webhook-security";

describe("webhook event matching", () => {
  it("matches an exact topic", () => {
    expect(matchesEvent("record.created", "record.created")).toBe(true);
  });

  it("matches only a namespaced wildcard", () => {
    expect(matchesEvent("record.created", "record.*")).toBe(true);
    expect(matchesEvent("records.created", "record.*")).toBe(false);
    expect(matchesEvent("record", "record.*")).toBe(false);
  });
});

describe("webhook signatures", () => {
  it("verifies the exact timestamp and payload", () => {
    const input = {
      secret: "whsec_test",
      timestamp: "1710000000",
      payload: '{"id":"event-1"}',
    };
    const signature = signWebhook(input);

    expect(verifyWebhookSignature({ ...input, signature })).toBe(true);
    expect(
      verifyWebhookSignature({
        ...input,
        payload: '{"id":"event-2"}',
        signature,
      }),
    ).toBe(false);
  });
});

describe("private network classification", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "::1",
    "fd00::1",
  ])("blocks %s", (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each(["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"])(
    "allows public address %s",
    (address) => {
      expect(isPrivateAddress(address)).toBe(false);
    },
  );
});

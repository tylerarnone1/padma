import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  lookup: vi.fn(),
  environment: vi.fn(),
}));

vi.mock("node:dns/promises", () => ({
  lookup: mocks.lookup,
}));

vi.mock("@/lib/env/server", () => ({
  getServerEnvironment: mocks.environment,
}));

import { assertSafeWebhookUrl } from "@/features/integrations/security/webhook-security";

describe("webhook URL policy", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.environment.mockReturnValue({ NODE_ENV: "production" });
    mocks.lookup.mockResolvedValue([
      { address: "1.1.1.1", family: 4 },
      { address: "2606:4700:4700::1111", family: 6 },
    ]);
  });

  it("accepts HTTPS only when every resolution result is public", async () => {
    await expect(
      assertSafeWebhookUrl("https://hooks.example/events"),
    ).resolves.toEqual(new URL("https://hooks.example/events"));
    expect(mocks.lookup).toHaveBeenCalledWith("hooks.example", {
      all: true,
      verbatim: true,
    });
  });

  it("rejects credentials, insecure schemes, and private resolution", async () => {
    await expect(
      assertSafeWebhookUrl("https://user:secret@hooks.example/events"),
    ).rejects.toThrow("cannot contain credentials");
    await expect(
      assertSafeWebhookUrl("http://hooks.example/events"),
    ).rejects.toThrow("must use HTTPS");

    mocks.lookup.mockResolvedValue([
      { address: "169.254.169.254", family: 4 },
    ]);
    await expect(
      assertSafeWebhookUrl("https://hooks.example/events"),
    ).rejects.toThrow("private network addresses");
  });

  it("allows explicit loopback HTTP only outside production", async () => {
    mocks.environment.mockReturnValue({ NODE_ENV: "development" });

    await expect(
      assertSafeWebhookUrl("http://[::1]:4000/events"),
    ).resolves.toEqual(new URL("http://[::1]:4000/events"));
    expect(mocks.lookup).not.toHaveBeenCalled();
  });
});

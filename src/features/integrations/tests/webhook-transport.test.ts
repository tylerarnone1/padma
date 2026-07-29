import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dnsLookup: vi.fn(),
}));

vi.mock("node:dns", () => ({
  lookup: mocks.dnsLookup,
}));

import { createValidatingLookup } from "@/features/integrations/security/webhook-transport";

type LookupOutcome = {
  error: NodeJS.ErrnoException | null;
  address: string | Array<{ address: string; family: number }>;
  family?: number;
};

function runLookup(
  allowPrivateAddresses: boolean,
  resolved: LookupOutcome,
): Promise<LookupOutcome> {
  mocks.dnsLookup.mockImplementation(
    (
      _hostname: string,
      _options: unknown,
      callback: (
        error: NodeJS.ErrnoException | null,
        address: unknown,
        family?: number,
      ) => void,
    ) => {
      callback(resolved.error, resolved.address, resolved.family);
    },
  );

  return new Promise((resolve) => {
    createValidatingLookup(allowPrivateAddresses)(
      "hooks.example.test",
      { all: false },
      (error, address, family) => {
        resolve({ error, address, ...(family === undefined ? {} : { family }) });
      },
    );
  });
}

/**
 * These cover the resolver that the socket itself uses. Validating a URL and
 * then handing the hostname to a client that resolves it again leaves a window
 * where the second answer can be a private address; the address this resolver
 * returns is the address that gets dialled, so there is no second answer.
 */
describe("webhook connection resolver", () => {
  it("passes a public address through", async () => {
    const outcome = await runLookup(false, {
      error: null,
      address: "93.184.216.34",
      family: 4,
    });

    expect(outcome.error).toBeNull();
    expect(outcome.address).toBe("93.184.216.34");
  });

  it("refuses a private address returned at connection time", async () => {
    const outcome = await runLookup(false, {
      error: null,
      address: "169.254.169.254",
      family: 4,
    });

    expect(outcome.error).toBeInstanceOf(Error);
    expect(outcome.error?.code).toBe("EACCES");
  });

  it("refuses loopback returned at connection time", async () => {
    const outcome = await runLookup(false, {
      error: null,
      address: "127.0.0.1",
      family: 4,
    });

    expect(outcome.error?.code).toBe("EACCES");
  });

  it("refuses a NAT64-embedded internal address", async () => {
    const outcome = await runLookup(false, {
      error: null,
      address: "64:ff9b::a00:1",
      family: 6,
    });

    expect(outcome.error?.code).toBe("EACCES");
  });

  it("refuses when any address in a multi-answer result is private", async () => {
    const outcome = await runLookup(false, {
      error: null,
      address: [
        { address: "93.184.216.34", family: 4 },
        { address: "10.0.0.5", family: 4 },
      ],
    });

    expect(outcome.error?.code).toBe("EACCES");
  });

  it("allows a private address only when local development opts in", async () => {
    const outcome = await runLookup(true, {
      error: null,
      address: "127.0.0.1",
      family: 4,
    });

    expect(outcome.error).toBeNull();
  });

  it("propagates a resolution failure unchanged", async () => {
    const failure: NodeJS.ErrnoException = new Error("getaddrinfo ENOTFOUND");
    failure.code = "ENOTFOUND";

    const outcome = await runLookup(false, {
      error: failure,
      address: "",
    });

    expect(outcome.error?.code).toBe("ENOTFOUND");
  });
});

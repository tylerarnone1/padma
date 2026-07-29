import { describe, expect, it } from "vitest";
import { assertSameOrigin, readJsonBody } from "@/lib/http/request";

describe("assertSameOrigin", () => {
  it("accepts same-origin browser requests", () => {
    const request = new Request("https://app.example.com/api/records", {
      method: "POST",
      headers: {
        origin: "https://app.example.com",
        "sec-fetch-site": "same-origin",
      },
    });

    expect(() => assertSameOrigin(request)).not.toThrow();
  });

  it("rejects a missing or cross-site origin", () => {
    expect(() =>
      assertSameOrigin(
        new Request("https://app.example.com/api/records", {
          method: "POST",
        }),
      ),
    ).toThrow();

    expect(() =>
      assertSameOrigin(
        new Request("https://app.example.com/api/records", {
          method: "POST",
          headers: {
            origin: "https://attacker.example",
            "sec-fetch-site": "cross-site",
          },
        }),
      ),
    ).toThrow();
  });
});

describe("readJsonBody", () => {
  it("parses a bounded JSON body", async () => {
    const request = new Request("https://app.example.com/api/records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"name":"Example"}',
    });

    await expect(readJsonBody(request)).resolves.toEqual({ name: "Example" });
  });

  it("rejects unsupported media and oversized bodies", async () => {
    const wrongMedia = new Request("https://app.example.com/api/records", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}",
    });
    await expect(readJsonBody(wrongMedia)).rejects.toMatchObject({
      status: 415,
    });

    const oversized = new Request("https://app.example.com/api/records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "x".repeat(100) }),
    });
    await expect(readJsonBody(oversized, 16)).rejects.toMatchObject({
      status: 413,
    });
  });
});

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

    expect(assertSameOrigin(request)).toBe("https://app.example.com");
  });

  it("accepts the browser origin when Next canonicalizes a loopback alias", () => {
    const request = new Request("http://localhost:3000/api/records", {
      method: "POST",
      headers: {
        host: "127.0.0.1:3000",
        origin: "http://127.0.0.1:3000",
        "sec-fetch-site": "same-origin",
      },
    });

    expect(assertSameOrigin(request)).toBe("http://127.0.0.1:3000");
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

    expect(() =>
      assertSameOrigin(
        new Request("https://app.example.com/api/records", {
          method: "POST",
          headers: {
            host: "app.example.com",
            origin: "https://attacker.example",
            "sec-fetch-site": "same-origin",
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

  it("accepts JSON parameters but rejects lookalike media types", async () => {
    const charset = new Request("https://app.example.com/api/records", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: "{}",
    });
    await expect(readJsonBody(charset)).resolves.toEqual({});

    const lookalike = new Request("https://app.example.com/api/records", {
      method: "POST",
      headers: { "content-type": "application/jsonx" },
      body: "{}",
    });
    await expect(readJsonBody(lookalike)).rejects.toMatchObject({
      status: 415,
    });
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

  it("cancels a streamed body as soon as the byte limit is crossed", async () => {
    let pulls = 0;
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new TextEncoder().encode("x".repeat(10)));
        if (pulls >= 10) controller.close();
      },
      cancel() {
        cancelled = true;
      },
    });
    const request = new Request("https://app.example.com/api/records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    await expect(readJsonBody(request, 16)).rejects.toMatchObject({
      status: 413,
    });
    expect(cancelled).toBe(true);
    expect(pulls).toBeLessThan(10);
  });
});

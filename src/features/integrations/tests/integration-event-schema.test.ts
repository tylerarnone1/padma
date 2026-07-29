import { describe, expect, it } from "vitest";
import { parseDatabaseIntegrationEvent } from "@/features/integrations/schemas/integration-event-schema";

const event = {
  id: "b80efbe7-a826-4827-aaf6-92a1eeef742c",
  topic: "record.created",
  aggregateType: "record",
  aggregateId: "record-1",
  ownerId: "user-1",
  payload: { name: "Example" },
  occurredAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("database integration event boundary", () => {
  it("accepts a bounded provider-neutral event", () => {
    expect(parseDatabaseIntegrationEvent(event)).toEqual(event);
  });

  it.each([
    { ...event, topic: "record.*" },
    { ...event, payload: "not-an-object" },
    { ...event, payload: { value: "x".repeat(256 * 1024) } },
    { ...event, unexpected: true },
  ])("rejects invalid database event state %#", (input) => {
    expect(() => parseDatabaseIntegrationEvent(input)).toThrow();
  });
});

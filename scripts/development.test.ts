import { describe, expect, it } from "vitest";
import {
  developmentAppPort,
  nextDevelopmentArguments,
} from "./development";

describe("development application port", () => {
  it("derives the Next.js port from APP_URL", () => {
    expect(developmentAppPort("http://localhost:3042")).toBe(3042);
    expect(
      nextDevelopmentArguments("http://localhost:3042", [
        "--turbo",
      ]),
    ).toEqual([
      "--turbo",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3042",
    ]);
  });

  it("accepts and normalizes a matching explicit port", () => {
    expect(
      nextDevelopmentArguments("http://127.0.0.1:3007", [
        "--port",
        "3007",
      ]),
    ).toEqual([
      "--hostname",
      "127.0.0.1",
      "--port",
      "3007",
    ]);
  });

  it("rejects a port that conflicts with APP_URL", () => {
    expect(() =>
      nextDevelopmentArguments("http://localhost:3000", [
        "--port=3001",
      ]),
    ).toThrow("conflicts with APP_URL port 3000");
  });

  it("refuses non-loopback or ambiguous local origins", () => {
    for (const appUrl of [
      "https://localhost:3000",
      "http://0.0.0.0:3000",
      "http://localhost",
      "http://localhost:3000/path",
    ]) {
      expect(() => developmentAppPort(appUrl)).toThrow(
        "bare loopback HTTP origin",
      );
    }
  });
});

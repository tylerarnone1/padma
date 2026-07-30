import { randomUUID } from "node:crypto";
import {
  mkdir,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  diagnoseProject,
  type AppProbeResult,
  type DoctorDependencies,
} from "./doctor-lib";

const roots: string[] = [];
const authSecret = "a".repeat(43);
const integrationSecret = "b".repeat(43);
const validEnvironment = `APP_URL="http://localhost:3000"
NODE_ENV="development"
AUTH_MODE="mock"
POSTGRES_PORT="5433"
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/padma?schema=public"
BETTER_AUTH_SECRET="${authSecret}"
INTEGRATION_ENCRYPTION_KEY="${integrationSecret}"
`;

async function createFixture(options?: {
  environment?: string | null;
}): Promise<string> {
  const root = path.resolve(".tmp", `doctor-test-${randomUUID()}`);
  roots.push(root);
  await mkdir(path.join(root, "prisma"), { recursive: true });
  await mkdir(path.join(root, "node_modules", "prisma", "build"), {
    recursive: true,
  });
  await Promise.all([
    writeFile(path.join(root, "AGENTS.md"), "# Test contract\n"),
    writeFile(path.join(root, ".env.example"), validEnvironment),
    writeFile(path.join(root, "compose.yaml"), "services: {}\n"),
    writeFile(path.join(root, "package.json"), '{"name":"padma"}\n'),
    writeFile(path.join(root, "prisma", "schema.prisma"), ""),
    writeFile(
      path.join(root, "node_modules", "prisma", "build", "index.js"),
      "",
    ),
  ]);
  if (options?.environment !== null) {
    await writeFile(
      path.join(root, ".env"),
      options?.environment ?? validEnvironment,
    );
  }
  return root;
}

function createDependencies(options?: {
  daemonFailure?: boolean;
  schemaCode?: number;
  app?: AppProbeResult;
}): DoctorDependencies {
  return {
    runCommand: vi.fn(async ({ command, arguments: arguments_ }) => {
      const joined = arguments_.join(" ");
      if (joined === "info" && options?.daemonFailure) {
        return { code: 1, stdout: "", stderr: "daemon unavailable" };
      }
      if (joined === "compose ps --status running --services") {
        return { code: 0, stdout: "postgres\n", stderr: "" };
      }
      if (joined === "compose port postgres 5432") {
        return { code: 0, stdout: "127.0.0.1:5433\n", stderr: "" };
      }
      if (joined.includes("migrate diff") || command === process.execPath) {
        return {
          code: options?.schemaCode ?? 0,
          stdout: "",
          stderr: "",
        };
      }
      return { code: 0, stdout: "", stderr: "" };
    }),
    probeApp: vi.fn(
      async () =>
        options?.app ?? {
          reachable: true,
          padma: true,
          status: 200,
        },
    ),
  };
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true }),
    ),
  );
});

describe("Padma doctor", () => {
  it("passes a coherent, healthy local environment without exposing secrets", async () => {
    const root = await createFixture();
    const report = await diagnoseProject({
      root,
      dependencies: createDependencies(),
    });

    expect(report.ok).toBe(true);
    expect(report.checks.every((check) => check.status === "pass")).toBe(
      true,
    );
    const output = JSON.stringify(report);
    expect(output).not.toContain(authSecret);
    expect(output).not.toContain(integrationSecret);
  });

  it("treats a stopped application as a non-blocking next step", async () => {
    const root = await createFixture();
    const report = await diagnoseProject({
      root,
      dependencies: createDependencies({
        app: { reachable: false },
      }),
    });

    expect(report.ok).toBe(true);
    expect(report.checks).toContainEqual(
      expect.objectContaining({
        name: "Application",
        status: "warn",
      }),
    );
  });

  it("fails clearly when setup has not created .env", async () => {
    const root = await createFixture({ environment: null });
    const report = await diagnoseProject({
      root,
      dependencies: createDependencies(),
    });

    expect(report.ok).toBe(false);
    expect(report.checks).toContainEqual(
      expect.objectContaining({
        name: "Local configuration",
        status: "fail",
        detail: expect.stringContaining("Run npm run setup"),
      }),
    );
  });

  it("detects configuration mismatch without printing configured secrets", async () => {
    const root = await createFixture({
      environment: validEnvironment.replace(
        "localhost:5433/padma",
        "localhost:5440/padma",
      ),
    });
    const report = await diagnoseProject({
      root,
      dependencies: createDependencies(),
    });

    expect(report.ok).toBe(false);
    expect(report.checks).toContainEqual(
      expect.objectContaining({
        name: "Local configuration",
        status: "fail",
      }),
    );
    expect(JSON.stringify(report)).not.toContain(authSecret);
  });

  it("rejects ambiguous duplicate managed configuration", async () => {
    const root = await createFixture({
      environment: `${validEnvironment}APP_URL="http://localhost:3001"\n`,
    });
    const report = await diagnoseProject({
      root,
      dependencies: createDependencies(),
    });

    expect(report.ok).toBe(false);
    expect(report.checks).toContainEqual(
      expect.objectContaining({
        name: "Local configuration",
        status: "fail",
        detail: expect.stringContaining("APP_URL more than once"),
      }),
    );
  });

  it("reports Docker daemon failure and skips mutating recovery", async () => {
    const root = await createFixture();
    const dependencies = createDependencies({ daemonFailure: true });
    const report = await diagnoseProject({ root, dependencies });

    expect(report.ok).toBe(false);
    expect(report.checks).toContainEqual(
      expect.objectContaining({ name: "Docker", status: "fail" }),
    );
    expect(dependencies.runCommand).not.toHaveBeenCalledWith(
      expect.objectContaining({
        arguments: expect.arrayContaining(["up"]),
      }),
    );
  });

  it("reports schema drift as a blocking failure", async () => {
    const root = await createFixture();
    const report = await diagnoseProject({
      root,
      dependencies: createDependencies({ schemaCode: 2 }),
    });

    expect(report.ok).toBe(false);
    expect(report.checks).toContainEqual(
      expect.objectContaining({
        name: "Database schema",
        status: "fail",
        detail: expect.stringContaining("Schema drift"),
      }),
    );
  });

  it("rejects another application occupying APP_URL", async () => {
    const root = await createFixture();
    const report = await diagnoseProject({
      root,
      dependencies: createDependencies({
        app: { reachable: true, padma: false, status: 200 },
      }),
    });

    expect(report.ok).toBe(false);
    expect(report.checks).toContainEqual(
      expect.objectContaining({
        name: "Application",
        status: "fail",
        detail: expect.stringContaining("did not identify as Padma"),
      }),
    );
  });
});

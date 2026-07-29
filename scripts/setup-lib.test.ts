import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { parse } from "dotenv";
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  setupProject,
  type CommandResult,
  type SetupDependencies,
} from "./setup-lib";

const template = `# Application
APP_NAME="Padma"
APP_URL="http://localhost:3000"
NODE_ENV="development"
AUTH_MODE="mock"

# Database
POSTGRES_PORT="5433"
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/padma?schema=public"

BETTER_AUTH_SECRET=""
INTEGRATION_ENCRYPTION_KEY=""
CUSTOM_SETTING="keep-me"
`;

const roots: string[] = [];

async function createFixture(): Promise<string> {
  const root = path.resolve(".tmp", `setup-test-${randomUUID()}`);
  roots.push(root);
  await mkdir(path.join(root, "prisma"), { recursive: true });
  await mkdir(path.join(root, "node_modules", "prisma", "build"), {
    recursive: true,
  });
  await mkdir(path.join(root, "node_modules", "tsx", "dist"), {
    recursive: true,
  });
  await Promise.all([
    writeFile(path.join(root, ".env.example"), template),
    writeFile(path.join(root, "compose.yaml"), "services: {}\n"),
    writeFile(
      path.join(root, "package.json"),
      '{"engines":{"node":">=22.12"}}\n',
    ),
    writeFile(path.join(root, "prisma", "schema.prisma"), ""),
    writeFile(
      path.join(root, "node_modules", "prisma", "build", "index.js"),
      "",
    ),
    writeFile(
      path.join(root, "node_modules", "tsx", "dist", "cli.mjs"),
      "",
    ),
  ]);
  return root;
}

type DependencyOptions = {
  unavailablePorts?: readonly number[];
  daemonFailure?: boolean;
  composePort?: number;
};

function createDependencies(options: DependencyOptions = {}) {
  const logs: string[] = [];
  const warnings: string[] = [];
  let secretNumber = 0;
  const unavailablePorts = new Set(options.unavailablePorts ?? []);
  const successfulCommand: CommandResult = {
    code: 0,
    stdout: "",
    stderr: "",
  };
  const dependencies: SetupDependencies = {
    runCommand: vi.fn(async ({ arguments: arguments_ }) => {
      if (
        arguments_.join(" ") === "info" &&
        options.daemonFailure
      ) {
        return {
          code: 1,
          stdout: "",
          stderr: "Cannot connect to the Docker daemon",
        };
      }
      if (arguments_.join(" ") === "compose port postgres 5432") {
        return options.composePort
          ? {
              code: 0,
              stdout: `127.0.0.1:${options.composePort}\n`,
              stderr: "",
            }
          : { code: 1, stdout: "", stderr: "" };
      }
      return successfulCommand;
    }),
    portIsAvailable: vi.fn(
      async (port) => !unavailablePorts.has(port),
    ),
    prepareServices: vi.fn(async () => undefined),
    randomSecret: vi.fn(() => {
      secretNumber += 1;
      return `generated-secret-${secretNumber}`.padEnd(43, "x");
    }),
    logger: {
      log: (message) => logs.push(message),
      warn: (message) => warnings.push(message),
    },
  };
  return { dependencies, logs, warnings };
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true }),
    ),
  );
});

describe("first-run setup", () => {
  it("selects free ports, persists independent secrets, and prepares services", async () => {
    const root = await createFixture();
    const { dependencies, logs } = createDependencies({
      unavailablePorts: [3000, 5433],
    });

    const result = await setupProject({ root, dependencies });
    const source = await readFile(path.join(root, ".env"), "utf8");
    const values = parse(source);

    expect(result).toMatchObject({
      appUrl: "http://localhost:3001",
      appPort: 3001,
      postgresPort: 5434,
      createdEnvironmentFile: true,
    });
    expect(values.APP_URL).toBe("http://localhost:3001");
    expect(values.POSTGRES_PORT).toBe("5434");
    expect(values.DATABASE_URL).toContain("localhost:5434/padma");
    expect(values.BETTER_AUTH_SECRET).toHaveLength(43);
    expect(values.INTEGRATION_ENCRYPTION_KEY).toHaveLength(43);
    expect(values.BETTER_AUTH_SECRET).not.toBe(
      values.INTEGRATION_ENCRYPTION_KEY,
    );
    expect(values.CUSTOM_SETTING).toBe("keep-me");
    expect(dependencies.prepareServices).toHaveBeenCalledWith(
      expect.objectContaining({
        APP_URL: "http://localhost:3001",
        POSTGRES_PORT: "5434",
        BETTER_AUTH_SECRET: values.BETTER_AUTH_SECRET,
      }),
      root,
    );

    const output = logs.join("\n");
    expect(output).toContain("npm run dev:next");
    expect(output).not.toContain(values.BETTER_AUTH_SECRET);
    expect(output).not.toContain(values.INTEGRATION_ENCRYPTION_KEY);
  });

  it("fails before writing when the Docker daemon is unavailable", async () => {
    const root = await createFixture();
    const { dependencies } = createDependencies({ daemonFailure: true });

    await expect(
      setupProject({ root, dependencies }),
    ).rejects.toThrow("The Docker daemon is unavailable");
    await expect(readFile(path.join(root, ".env"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(dependencies.prepareServices).not.toHaveBeenCalled();
  });
});

describe("setup reruns", () => {
  it("preserves comments, unknown values, ports, and generated secrets", async () => {
    const root = await createFixture();
    const first = createDependencies();
    await setupProject({ root, dependencies: first.dependencies });
    const firstSource = await readFile(path.join(root, ".env"), "utf8");
    await writeFile(
      path.join(root, ".env"),
      `${firstSource}# adopter note\nUNRELATED_VALUE="untouched"\n`,
    );

    const second = createDependencies();
    await setupProject({ root, dependencies: second.dependencies });
    const secondSource = await readFile(path.join(root, ".env"), "utf8");
    const firstValues = parse(firstSource);
    const secondValues = parse(secondSource);

    expect(secondSource).toContain("# adopter note");
    expect(secondValues.UNRELATED_VALUE).toBe("untouched");
    expect(secondValues.BETTER_AUTH_SECRET).toBe(
      firstValues.BETTER_AUTH_SECRET,
    );
    expect(secondValues.INTEGRATION_ENCRYPTION_KEY).toBe(
      firstValues.INTEGRATION_ENCRYPTION_KEY,
    );
    expect(second.dependencies.randomSecret).not.toHaveBeenCalled();
  });

  it("fills blank secrets without changing custom values", async () => {
    const root = await createFixture();
    await writeFile(
      path.join(root, ".env"),
      template.replace(
        'BETTER_AUTH_SECRET=""',
        `BETTER_AUTH_SECRET="${"a".repeat(40)}"`,
      ),
    );
    const { dependencies } = createDependencies();

    await setupProject({ root, dependencies });
    const values = parse(await readFile(path.join(root, ".env"), "utf8"));

    expect(values.BETTER_AUTH_SECRET).toBe("a".repeat(40));
    expect(values.INTEGRATION_ENCRYPTION_KEY).toHaveLength(43);
    expect(values.CUSTOM_SETTING).toBe("keep-me");
    expect(dependencies.randomSecret).toHaveBeenCalledTimes(1);
  });

  it("allows this Compose project to own the configured database port", async () => {
    const root = await createFixture();
    const configured = template
      .replace(
        'BETTER_AUTH_SECRET=""',
        `BETTER_AUTH_SECRET="${"a".repeat(40)}"`,
      )
      .replace(
        'INTEGRATION_ENCRYPTION_KEY=""',
        `INTEGRATION_ENCRYPTION_KEY="${"b".repeat(40)}"`,
      );
    await writeFile(path.join(root, ".env"), configured);
    const { dependencies, warnings } = createDependencies({
      unavailablePorts: [3000, 5433],
      composePort: 5433,
    });

    const result = await setupProject({ root, dependencies });

    expect(result.warnings).toHaveLength(1);
    expect(warnings[0]).toContain("Padma may already be running");
    expect(dependencies.prepareServices).toHaveBeenCalledOnce();
  });

  it("refuses a database port owned by another process", async () => {
    const root = await createFixture();
    const configured = template
      .replace(
        'BETTER_AUTH_SECRET=""',
        `BETTER_AUTH_SECRET="${"a".repeat(40)}"`,
      )
      .replace(
        'INTEGRATION_ENCRYPTION_KEY=""',
        `INTEGRATION_ENCRYPTION_KEY="${"b".repeat(40)}"`,
      );
    await writeFile(path.join(root, ".env"), configured);
    const { dependencies } = createDependencies({
      unavailablePorts: [5433],
      composePort: 5440,
    });

    await expect(
      setupProject({ root, dependencies }),
    ).rejects.toThrow("occupied by a process outside");
    expect(dependencies.prepareServices).not.toHaveBeenCalled();
  });
});

describe("setup configuration refusal", () => {
  it("rejects duplicate managed keys", async () => {
    const root = await createFixture();
    await writeFile(
      path.join(root, ".env"),
      `${template}\nAPP_URL="http://localhost:3001"\n`,
    );
    const { dependencies } = createDependencies();

    await expect(
      setupProject({ root, dependencies }),
    ).rejects.toThrow("defines APP_URL more than once");
  });

  it.each([
    {
      label: "a public origin",
      source: template.replace(
        'APP_URL="http://localhost:3000"',
        'APP_URL="https://padma.example"',
      ),
      message: "bare loopback HTTP APP_URL",
    },
    {
      label: "production mode",
      source: template.replace(
        'NODE_ENV="development"',
        'NODE_ENV="production"',
      ),
      message: 'requires NODE_ENV="development"',
    },
    {
      label: "an inconsistent database port",
      source: template.replace(
        "localhost:5433/padma",
        "localhost:5440/padma",
      ),
      message: "must target the local Padma database",
    },
  ])("rejects $label without preparing services", async ({ source, message }) => {
    const root = await createFixture();
    await writeFile(path.join(root, ".env"), source);
    const { dependencies } = createDependencies();

    await expect(
      setupProject({ root, dependencies }),
    ).rejects.toThrow(message);
    expect(dependencies.prepareServices).not.toHaveBeenCalled();
  });
});

import { randomBytes } from "node:crypto";
import {
  chmod,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { parse } from "dotenv";
import { prepareDevelopmentServices } from "./development";
import {
  localPortIsAvailable,
  runLocalCommand,
  type CommandResult,
} from "./local-command";

const APP_PORT_START = 3000;
const APP_PORT_END = 3099;
const POSTGRES_PORT_START = 5433;
const POSTGRES_PORT_END = 5532;
const REQUIRED_NODE_VERSION = [22, 12, 0] as const;
const SECRET_LENGTH_BYTES = 32;

const managedKeys = [
  "APP_URL",
  "NODE_ENV",
  "AUTH_MODE",
  "POSTGRES_PORT",
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "INTEGRATION_ENCRYPTION_KEY",
] as const;

type ManagedKey = (typeof managedKeys)[number];

export type SetupLogger = {
  log(message: string): void;
  warn(message: string): void;
};

export type SetupDependencies = {
  runCommand(input: {
    command: string;
    arguments: readonly string[];
    cwd: string;
    environment: NodeJS.ProcessEnv;
  }): Promise<CommandResult>;
  portIsAvailable(port: number): Promise<boolean>;
  prepareServices(
    environment: NodeJS.ProcessEnv,
    root: string,
  ): Promise<unknown>;
  randomSecret(): string;
  logger: SetupLogger;
};

export type SetupResult = {
  appUrl: string;
  appPort: number;
  postgresPort: number;
  createdEnvironmentFile: boolean;
  warnings: readonly string[];
};

const defaultDependencies: SetupDependencies = {
  runCommand: runLocalCommand,
  portIsAvailable: localPortIsAvailable,
  prepareServices: prepareDevelopmentServices,
  randomSecret: () => randomBytes(SECRET_LENGTH_BYTES).toString("base64url"),
  logger: console,
};

function formatCommandFailure(
  label: string,
  result: CommandResult,
): Error {
  const detail = result.stderr.trim() || result.stdout.trim();
  return new Error(
    `${label} is unavailable.${detail ? ` ${detail}` : ""}`,
  );
}

function parseVersion(value: string): [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(value);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function versionAtLeast(
  actual: readonly number[],
  required: readonly number[],
): boolean {
  for (let index = 0; index < required.length; index += 1) {
    const actualPart = actual[index] ?? 0;
    const requiredPart = required[index] ?? 0;
    if (actualPart > requiredPart) return true;
    if (actualPart < requiredPart) return false;
  }
  return true;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function preflight(
  root: string,
  environment: NodeJS.ProcessEnv,
  dependencies: SetupDependencies,
): Promise<void> {
  const nodeVersion = parseVersion(process.versions.node);
  if (
    !nodeVersion ||
    !versionAtLeast(nodeVersion, REQUIRED_NODE_VERSION)
  ) {
    throw new Error(
      `Padma requires Node.js 22.12.0 or newer; received ${process.version}.`,
    );
  }

  const requiredPaths = [
    ".env.example",
    "compose.yaml",
    "package.json",
    path.join("prisma", "schema.prisma"),
    path.join("node_modules", "prisma", "build", "index.js"),
    path.join("node_modules", "tsx", "dist", "cli.mjs"),
  ];
  for (const relativePath of requiredPaths) {
    if (!(await pathExists(path.resolve(root, relativePath)))) {
      throw new Error(
        `Required setup file is missing: ${relativePath}. Run \`npm install\` from the repository root and try again.`,
      );
    }
  }

  for (const check of [
    {
      label: "Docker",
      command: "docker",
      arguments: ["--version"],
    },
    {
      label: "Docker Compose",
      command: "docker",
      arguments: ["compose", "version"],
    },
    {
      label: "The Docker daemon",
      command: "docker",
      arguments: ["info"],
    },
  ] as const) {
    const result = await dependencies.runCommand({
      command: check.command,
      arguments: check.arguments,
      cwd: root,
      environment,
    });
    if (result.code !== 0) {
      throw formatCommandFailure(check.label, result);
    }
  }
}

function assignments(source: string): Map<string, number[]> {
  const found = new Map<string, number[]>();
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    const match =
      /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
    if (!match) continue;
    const key = match[1]!;
    const indexes = found.get(key) ?? [];
    indexes.push(index);
    found.set(key, indexes);
  }
  return found;
}

function rejectDuplicateManagedKeys(source: string): void {
  const found = assignments(source);
  for (const key of managedKeys) {
    const indexes = found.get(key) ?? [];
    if (indexes.length > 1) {
      throw new Error(
        `.env defines ${key} more than once. Remove the duplicate so setup cannot read one value and write another.`,
      );
    }
  }
}

function updateEnvironmentSource(
  source: string,
  updates: ReadonlyMap<ManagedKey, string>,
): string {
  if (updates.size === 0) return source;

  const lines = source.split(/\r?\n/);
  const found = assignments(source);

  for (const [key, value] of updates) {
    const line = `${key}=${JSON.stringify(value)}`;
    const indexes = found.get(key);
    if (indexes?.length) {
      lines[indexes[0]!] = line;
    } else {
      if (lines.length > 0 && lines.at(-1) !== "") lines.push("");
      lines.push(line);
    }
  }

  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}

function valueIsBlank(value: string | undefined): boolean {
  return !value || value.trim() === "";
}

function parsePort(value: string, key: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${key} must be an integer between 1 and 65535.`);
  }
  return port;
}

function validateAppUrl(value: string): number {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("APP_URL must be an absolute URL.");
  }

  if (
    parsed.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]", "::1"].includes(parsed.hostname) ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash ||
    !parsed.port
  ) {
    throw new Error(
      "npm run setup manages only a bare loopback HTTP APP_URL with an explicit port.",
    );
  }

  return parsePort(parsed.port, "APP_URL port");
}

function expectedDatabaseUrl(postgresPort: number): string {
  return (
    `postgresql://postgres:postgres@localhost:${postgresPort}` +
    "/padma?schema=public"
  );
}

function validateDatabaseUrl(value: string, postgresPort: number): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("DATABASE_URL must be an absolute PostgreSQL URL.");
  }

  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    !["localhost", "127.0.0.1", "[::1]", "::1"].includes(parsed.hostname) ||
    parsePort(parsed.port, "DATABASE_URL port") !== postgresPort ||
    parsed.pathname !== "/padma" ||
    parsed.searchParams.get("schema") !== "public"
  ) {
    throw new Error(
      "DATABASE_URL must target the local Padma database on POSTGRES_PORT with schema=public.",
    );
  }
}

async function firstAvailablePort(
  start: number,
  end: number,
  dependencies: SetupDependencies,
): Promise<number> {
  for (let port = start; port <= end; port += 1) {
    if (await dependencies.portIsAvailable(port)) return port;
  }
  throw new Error(
    `No available loopback port was found between ${start} and ${end}.`,
  );
}

function parseComposePort(stdout: string): number | null {
  const lastLine = stdout
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .at(-1);
  if (!lastLine) return null;
  const match = /:(\d+)$/.exec(lastLine);
  return match ? Number(match[1]) : null;
}

async function composeOwnsPostgresPort(
  root: string,
  port: number,
  environment: NodeJS.ProcessEnv,
  dependencies: SetupDependencies,
): Promise<boolean> {
  const result = await dependencies.runCommand({
    command: "docker",
    arguments: ["compose", "port", "postgres", "5432"],
    cwd: root,
    environment,
  });
  return result.code === 0 && parseComposePort(result.stdout) === port;
}

function validateLocalModes(
  values: Record<string, string | undefined>,
): void {
  if (values.NODE_ENV !== "development") {
    throw new Error(
      'npm run setup is local-only and requires NODE_ENV="development".',
    );
  }
  if (values.AUTH_MODE !== "mock") {
    throw new Error(
      'npm run setup prepares the credential-free local path and requires AUTH_MODE="mock".',
    );
  }
}

function validateSecret(value: string, key: string): void {
  if (value.trim().length < 32) {
    throw new Error(`${key} must contain at least 32 characters.`);
  }
}

export async function setupProject(input?: {
  root?: string;
  environment?: NodeJS.ProcessEnv;
  dependencies?: Partial<SetupDependencies>;
}): Promise<SetupResult> {
  const root = path.resolve(input?.root ?? process.cwd());
  const processEnvironment = input?.environment ?? process.env;
  const dependencies: SetupDependencies = {
    ...defaultDependencies,
    ...input?.dependencies,
  };

  dependencies.logger.log("Checking the local development environment…");
  await preflight(root, processEnvironment, dependencies);

  const environmentPath = path.resolve(root, ".env");
  const environmentExists = await pathExists(environmentPath);
  const sourcePath = environmentExists
    ? environmentPath
    : path.resolve(root, ".env.example");
  const originalSource = await readFile(sourcePath, "utf8");
  rejectDuplicateManagedKeys(originalSource);
  const parsed = parse(originalSource);
  const updates = new Map<ManagedKey, string>();

  if (valueIsBlank(parsed.NODE_ENV)) updates.set("NODE_ENV", "development");
  if (valueIsBlank(parsed.AUTH_MODE)) updates.set("AUTH_MODE", "mock");

  let appPort: number;
  if (!environmentExists || valueIsBlank(parsed.APP_URL)) {
    appPort = await firstAvailablePort(
      APP_PORT_START,
      APP_PORT_END,
      dependencies,
    );
    updates.set("APP_URL", `http://localhost:${appPort}`);
  } else {
    appPort = validateAppUrl(parsed.APP_URL!);
  }

  let postgresPort: number;
  if (!environmentExists || valueIsBlank(parsed.POSTGRES_PORT)) {
    postgresPort = await firstAvailablePort(
      POSTGRES_PORT_START,
      POSTGRES_PORT_END,
      dependencies,
    );
    updates.set("POSTGRES_PORT", String(postgresPort));
  } else {
    postgresPort = parsePort(parsed.POSTGRES_PORT!, "POSTGRES_PORT");
  }

  if (appPort === postgresPort) {
    throw new Error("APP_URL and POSTGRES_PORT must use different ports.");
  }

  if (!environmentExists || valueIsBlank(parsed.DATABASE_URL)) {
    updates.set("DATABASE_URL", expectedDatabaseUrl(postgresPort));
  } else {
    validateDatabaseUrl(parsed.DATABASE_URL!, postgresPort);
  }

  for (const key of [
    "BETTER_AUTH_SECRET",
    "INTEGRATION_ENCRYPTION_KEY",
  ] as const) {
    if (!environmentExists || valueIsBlank(parsed[key])) {
      updates.set(key, dependencies.randomSecret());
    } else {
      validateSecret(parsed[key]!, key);
    }
  }

  const nextSource = updateEnvironmentSource(originalSource, updates);
  const nextValues = parse(nextSource);
  validateLocalModes(nextValues);
  const resolvedAppUrl = nextValues.APP_URL;
  const resolvedDatabaseUrl = nextValues.DATABASE_URL;
  if (!resolvedAppUrl || !resolvedDatabaseUrl) {
    throw new Error("Setup could not resolve the required local URLs.");
  }
  const resolvedPostgresPort = nextValues.POSTGRES_PORT;
  const resolvedAuthSecret = nextValues.BETTER_AUTH_SECRET;
  const resolvedIntegrationSecret = nextValues.INTEGRATION_ENCRYPTION_KEY;
  if (
    !resolvedPostgresPort ||
    !resolvedAuthSecret ||
    !resolvedIntegrationSecret
  ) {
    throw new Error("Setup could not resolve the required local secrets and port.");
  }
  appPort = validateAppUrl(resolvedAppUrl);
  postgresPort = parsePort(resolvedPostgresPort, "POSTGRES_PORT");
  validateDatabaseUrl(resolvedDatabaseUrl, postgresPort);
  validateSecret(resolvedAuthSecret, "BETTER_AUTH_SECRET");
  validateSecret(
    resolvedIntegrationSecret,
    "INTEGRATION_ENCRYPTION_KEY",
  );

  const warnings: string[] = [];
  if (environmentExists && !(await dependencies.portIsAvailable(appPort))) {
    warnings.push(
      `APP_URL port ${appPort} is already listening. Padma may already be running; setup kept the configured port.`,
    );
  }

  if (
    environmentExists &&
    !(await dependencies.portIsAvailable(postgresPort)) &&
    !(await composeOwnsPostgresPort(
      root,
      postgresPort,
      { ...processEnvironment, ...nextValues },
      dependencies,
    ))
  ) {
    throw new Error(
      `POSTGRES_PORT ${postgresPort} is occupied by a process outside this Padma Compose project. Setup did not change it.`,
    );
  }

  if (!environmentExists) {
    await writeFile(environmentPath, nextSource, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
  } else if (nextSource !== originalSource) {
    await writeFile(environmentPath, nextSource, {
      encoding: "utf8",
      mode: 0o600,
    });
  }
  await chmod(environmentPath, 0o600);

  for (const warning of warnings) dependencies.logger.warn(warning);
  dependencies.logger.log("Preparing PostgreSQL and local fixtures…");
  await dependencies.prepareServices(
    { ...processEnvironment, ...nextValues },
    root,
  );

  dependencies.logger.log("");
  dependencies.logger.log("Padma local setup is ready.");
  dependencies.logger.log("Golden path:");
  dependencies.logger.log("  1. npm run doctor");
  dependencies.logger.log("  2. npm run dev:next");
  dependencies.logger.log(
    `  3. Open ${resolvedAppUrl}/sign-in and choose "Continue with mock account"`,
  );
  dependencies.logger.log(
    "  4. In another terminal: npm run generate:feature -- your-feature",
  );
  dependencies.logger.log(
    "  5. Declare its ownership model and run the generated tests",
  );

  return {
    appUrl: resolvedAppUrl,
    appPort,
    postgresPort,
    createdEnvironmentFile: !environmentExists,
    warnings,
  };
}

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";

export const DEFAULT_POSTGRES_PORT = 5433;

function isLoopbackHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1"
  );
}

export function developmentPostgresPort(
  value: string | undefined,
): number {
  const port = value ? Number(value) : DEFAULT_POSTGRES_PORT;
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(
      `POSTGRES_PORT must be an integer between 1 and 65535; received ${value ?? "an invalid value"}.`,
    );
  }
  return port;
}

export function developmentAppPort(appUrl: string | undefined): number {
  let parsed: URL;
  try {
    parsed = new URL(appUrl ?? "http://localhost:3000");
  } catch {
    throw new Error(`APP_URL must be an absolute URL; received ${appUrl}.`);
  }

  if (
    parsed.protocol !== "http:" ||
    !isLoopbackHostname(parsed.hostname) ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash ||
    !parsed.port
  ) {
    throw new Error(
      "Local development APP_URL must be a bare loopback HTTP origin with an explicit port, such as http://localhost:3000.",
    );
  }

  const port = Number(parsed.port);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`APP_URL contains an invalid port: ${parsed.port}.`);
  }
  return port;
}

type PortArgument = {
  index: number;
  length: number;
  value: string;
};

function findPortArguments(arguments_: readonly string[]): PortArgument[] {
  const found: PortArgument[] = [];

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index]!;
    if (argument === "--port" || argument === "-p") {
      const value = arguments_[index + 1];
      if (!value) {
        throw new Error(`${argument} requires a port value.`);
      }
      found.push({ index, length: 2, value });
      index += 1;
      continue;
    }

    if (argument.startsWith("--port=")) {
      found.push({
        index,
        length: 1,
        value: argument.slice("--port=".length),
      });
      continue;
    }

    const shortMatch = /^-p(\d+)$/.exec(argument);
    if (shortMatch) {
      found.push({ index, length: 1, value: shortMatch[1]! });
    }
  }

  return found;
}

export function nextDevelopmentArguments(
  appUrl: string | undefined,
  arguments_: readonly string[],
): string[] {
  const appPort = developmentAppPort(appUrl);
  const portArguments = findPortArguments(arguments_);
  if (portArguments.length > 1) {
    throw new Error(
      "Pass the development port through APP_URL, not multiple Next.js --port arguments.",
    );
  }

  const suppliedPort = portArguments[0];
  if (
    suppliedPort &&
    Number(suppliedPort.value) !== appPort
  ) {
    throw new Error(
      `Next.js port ${suppliedPort.value} conflicts with APP_URL port ${appPort}. Update APP_URL so authentication and trusted-origin checks stay coordinated.`,
    );
  }

  const indexesToRemove = new Set<number>();
  for (const portArgument of portArguments) {
    for (
      let index = portArgument.index;
      index < portArgument.index + portArgument.length;
      index += 1
    ) {
      indexesToRemove.add(index);
    }
  }

  return [
    ...arguments_.filter((_, index) => !indexesToRemove.has(index)),
    "--hostname",
    "127.0.0.1",
    "--port",
    String(appPort),
  ];
}

function run(
  command: string,
  arguments_: readonly string[],
  environment: NodeJS.ProcessEnv,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, {
      env: environment,
      stdio: "inherit",
      windowsHide: true,
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${command} ${arguments_.join(" ")} exited with ${signal ?? `code ${code ?? "unknown"}`}.`,
        ),
      );
    });
  });
}

/** Runs a command that communicates through its exit code rather than failing. */
function runForExitCode(
  command: string,
  arguments_: readonly string[],
  environment: NodeJS.ProcessEnv,
  stdio: "inherit" | "ignore",
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, {
      env: environment,
      stdio,
      windowsHide: true,
    });

    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
}

/**
 * An error whose message is already the complete instruction to the developer.
 * The generic startup hint is suppressed for these.
 */
export class ActionableStartupError extends Error {}

/** `prisma migrate diff --exit-code`: 0 means no difference, 2 means differences. */
const DIFF_NO_DIFFERENCE = 0;
const DIFF_DIFFERENCES = 2;

function schemaPath(root: string): string {
  return path.resolve(root, "prisma", "schema.prisma");
}

async function databaseIsEmpty(
  prismaCli: string,
  environment: NodeJS.ProcessEnv,
): Promise<boolean> {
  const code = await runForExitCode(
    process.execPath,
    [
      prismaCli,
      "migrate",
      "diff",
      "--from-empty",
      "--to-config-datasource",
      "--exit-code",
    ],
    environment,
    "ignore",
  );
  return code === DIFF_NO_DIFFERENCE;
}

async function databaseMatchesSchema(
  prismaCli: string,
  environment: NodeJS.ProcessEnv,
  root: string,
): Promise<boolean> {
  const code = await runForExitCode(
    process.execPath,
    [
      prismaCli,
      "migrate",
      "diff",
      "--from-config-datasource",
      "--to-schema",
      schemaPath(root),
      "--exit-code",
    ],
    environment,
    "ignore",
  );

  if (code === DIFF_NO_DIFFERENCE) return true;
  if (code === DIFF_DIFFERENCES) return false;

  throw new Error(
    "Could not compare prisma/schema.prisma with the database schema.",
  );
}

/**
 * Brings an *empty* database up to the current schema, and otherwise refuses to
 * touch it.
 */
async function prepareDatabaseSchema(
  prismaCli: string,
  environment: NodeJS.ProcessEnv,
  root: string,
): Promise<void> {
  if (await databaseIsEmpty(prismaCli, environment)) {
    console.log("Creating the database schema from prisma/schema.prisma…");
    await run(process.execPath, [prismaCli, "db", "push"], environment);
    return;
  }

  if (await databaseMatchesSchema(prismaCli, environment, root)) {
    console.log("Database schema matches prisma/schema.prisma.");
    return;
  }

  console.error(
    "\nprisma/schema.prisma no longer matches your local database:\n",
  );
  await runForExitCode(
    process.execPath,
    [
      prismaCli,
      "migrate",
      "diff",
      "--from-config-datasource",
      "--to-schema",
      schemaPath(root),
    ],
    environment,
    "inherit",
  );

  throw new ActionableStartupError(
    [
      "",
      "Startup will not change your database for you.",
      "",
      "Review the difference above, then choose:",
      "",
      "  npm run db:push    apply it to the existing database",
      "                     (can drop columns and the data in them)",
      "  npm run db:reset   discard the local database and rebuild it",
      "",
      "If you did not expect a schema change, check `git diff prisma/schema.prisma`",
      "before running either command.",
    ].join("\n"),
  );
}

export function createDevelopmentEnvironment(
  configuredEnvironment: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const postgresPort = developmentPostgresPort(
    configuredEnvironment.POSTGRES_PORT,
  );
  const databaseUrl =
    `postgresql://postgres:postgres@127.0.0.1:${postgresPort}` +
    "/padma?schema=public";

  return {
    ...configuredEnvironment,
    POSTGRES_PORT: String(postgresPort),
    DATABASE_URL: databaseUrl,
    BETTER_AUTH_SECRET:
      configuredEnvironment.BETTER_AUTH_SECRET?.trim() ||
      randomBytes(32).toString("base64url"),
  };
}

export async function prepareDevelopmentServices(
  configuredEnvironment: NodeJS.ProcessEnv,
  root = process.cwd(),
): Promise<NodeJS.ProcessEnv> {
  const environment = createDevelopmentEnvironment(configuredEnvironment);
  const postgresPort = developmentPostgresPort(environment.POSTGRES_PORT);
  const prismaCli = path.resolve(
    root,
    "node_modules",
    "prisma",
    "build",
    "index.js",
  );
  const tsxCli = path.resolve(root, "node_modules", "tsx", "dist", "cli.mjs");

  console.log(
    `Starting the isolated Padma PostgreSQL service on port ${postgresPort}…`,
  );
  await run(
    "docker",
    ["compose", "up", "-d", "--wait", "postgres"],
    environment,
  );

  await prepareDatabaseSchema(prismaCli, environment, root);

  console.log("Seeding permissions and development fixtures…");
  await run(
    process.execPath,
    [tsxCli, path.resolve(root, "prisma", "seed.ts")],
    environment,
  );

  return environment;
}

export async function startNextDevelopmentServer(
  configuredEnvironment: NodeJS.ProcessEnv,
  nextArguments: readonly string[],
  root = process.cwd(),
): Promise<void> {
  const environment = createDevelopmentEnvironment(configuredEnvironment);
  const arguments_ = nextDevelopmentArguments(
    environment.APP_URL,
    nextArguments,
  );

  console.log("Starting Next.js…");
  console.log("PostgreSQL will remain available until `npm run db:stop`.");
  await run(
    process.execPath,
    [
      path.resolve(root, "node_modules", "next", "dist", "bin", "next"),
      "dev",
      ...arguments_,
    ],
    environment,
  );
}

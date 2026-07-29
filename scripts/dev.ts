import "dotenv/config";

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import process from "node:process";

const DEFAULT_POSTGRES_PORT = 5433;
const prepareOnly = process.argv.includes("--prepare-only");
const nextOnly = process.argv.includes("--next-only");
const nextArguments = process.argv
  .slice(2)
  .filter(
    (argument) =>
      argument !== "--prepare-only" && argument !== "--next-only",
  );

function developmentPostgresPort(value: string | undefined): number {
  const port = value ? Number(value) : DEFAULT_POSTGRES_PORT;
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(
      `POSTGRES_PORT must be an integer between 1 and 65535; received ${value ?? "an invalid value"}.`,
    );
  }
  return port;
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
class ActionableStartupError extends Error {}

/** `prisma migrate diff --exit-code`: 0 means no difference, 2 means differences. */
const DIFF_NO_DIFFERENCE = 0;
const DIFF_DIFFERENCES = 2;

function schemaPath(): string {
  return path.resolve("prisma", "schema.prisma");
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
): Promise<boolean> {
  const code = await runForExitCode(
    process.execPath,
    [
      prismaCli,
      "migrate",
      "diff",
      "--from-config-datasource",
      "--to-schema",
      schemaPath(),
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
 *
 * Startup must never reconcile an existing database. A schema edit — including
 * one an agent made on your behalf — would silently rewrite local data the next
 * time the app booted, and a dropped column looks identical to a feature that
 * "just worked". Drift is reported and the developer chooses what happens next.
 */
async function prepareDatabaseSchema(
  prismaCli: string,
  environment: NodeJS.ProcessEnv,
): Promise<void> {
  if (await databaseIsEmpty(prismaCli, environment)) {
    console.log("Creating the database schema from prisma/schema.prisma…");
    await run(process.execPath, [prismaCli, "db", "push"], environment);
    return;
  }

  if (await databaseMatchesSchema(prismaCli, environment)) {
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
      schemaPath(),
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

async function main(): Promise<void> {
  if (prepareOnly && nextOnly) {
    throw new Error("--prepare-only and --next-only cannot be combined.");
  }

  const postgresPort = developmentPostgresPort(process.env.POSTGRES_PORT);
  const databaseUrl =
    `postgresql://postgres:postgres@127.0.0.1:${postgresPort}` +
    "/padma?schema=public";
  const environment = {
    ...process.env,
    POSTGRES_PORT: String(postgresPort),
    DATABASE_URL: databaseUrl,
    BETTER_AUTH_SECRET:
      process.env.BETTER_AUTH_SECRET?.trim() ||
      randomBytes(32).toString("base64url"),
  };
  const prismaCli = path.resolve(
    "node_modules",
    "prisma",
    "build",
    "index.js",
  );
  const tsxCli = path.resolve("node_modules", "tsx", "dist", "cli.mjs");

  if (!nextOnly) {
    console.log(
      `Starting the isolated Padma PostgreSQL service on port ${postgresPort}…`,
    );
    await run(
      "docker",
      ["compose", "up", "-d", "--wait", "postgres"],
      environment,
    );

    await prepareDatabaseSchema(prismaCli, environment);

    console.log("Seeding permissions and development fixtures…");
    await run(process.execPath, [tsxCli, "prisma/seed.ts"], environment);
  }

  if (prepareOnly) {
    console.log("Padma development services are ready.");
    return;
  }

  console.log("Starting Next.js…");
  console.log("PostgreSQL will remain available until `npm run db:stop`.");
  await run(
    process.execPath,
    [
      path.resolve("node_modules", "next", "dist", "bin", "next"),
      "dev",
      ...nextArguments,
      "--hostname",
      "127.0.0.1",
    ],
    environment,
  );
}

main().catch((error: unknown) => {
  // An actionable error already says exactly what to do; the generic hint would
  // only bury it.
  if (error instanceof ActionableStartupError) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  const message =
    error instanceof Error ? error.message : "Unknown development startup error";
  console.error(`\nPadma development startup failed: ${message}`);
  console.error(
    "Confirm Docker Desktop is running and that POSTGRES_PORT is available.",
  );
  process.exitCode = 1;
});

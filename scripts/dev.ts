import "dotenv/config";

import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const DEFAULT_POSTGRES_PORT = 5433;
const prepareOnly = process.argv.includes("--prepare-only");
const nextArguments = process.argv
  .slice(2)
  .filter((argument) => argument !== "--prepare-only");

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

async function main(): Promise<void> {
  const postgresPort = developmentPostgresPort(process.env.POSTGRES_PORT);
  const databaseUrl =
    `postgresql://postgres:postgres@127.0.0.1:${postgresPort}` +
    "/padma?schema=public";
  const environment = {
    ...process.env,
    POSTGRES_PORT: String(postgresPort),
    DATABASE_URL: databaseUrl,
  };
  const prismaCli = path.resolve(
    "node_modules",
    "prisma",
    "build",
    "index.js",
  );
  const tsxCli = path.resolve("node_modules", "tsx", "dist", "cli.mjs");

  console.log(
    `Starting the isolated Padma PostgreSQL service on port ${postgresPort}…`,
  );
  await run(
    "docker",
    ["compose", "up", "-d", "--wait", "postgres"],
    environment,
  );

  console.log("Applying committed database migrations…");
  await run(process.execPath, [prismaCli, "migrate", "deploy"], environment);

  console.log("Seeding permissions and development fixtures…");
  await run(process.execPath, [tsxCli, "prisma/seed.ts"], environment);

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
    ],
    environment,
  );
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown development startup error";
  console.error(`\nPadma development startup failed: ${message}`);
  console.error(
    "Confirm Docker Desktop is running and that POSTGRES_PORT is available.",
  );
  process.exitCode = 1;
});

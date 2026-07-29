import "dotenv/config";

import process from "node:process";
import {
  ActionableStartupError,
  prepareDevelopmentServices,
  startNextDevelopmentServer,
} from "./development";

const prepareOnly = process.argv.includes("--prepare-only");
const nextOnly = process.argv.includes("--next-only");
const nextArguments = process.argv
  .slice(2)
  .filter(
    (argument) =>
      argument !== "--prepare-only" && argument !== "--next-only",
  );

async function main(): Promise<void> {
  if (prepareOnly && nextOnly) {
    throw new Error("--prepare-only and --next-only cannot be combined.");
  }

  let environment = process.env;
  if (!nextOnly) {
    environment = await prepareDevelopmentServices(environment);
  }

  if (prepareOnly) {
    console.log("Padma development services are ready.");
    return;
  }

  await startNextDevelopmentServer(environment, nextArguments);
}

main().catch((error: unknown) => {
  if (error instanceof ActionableStartupError) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  const message =
    error instanceof Error ? error.message : "Unknown development startup error";
  console.error(`\nPadma development startup failed: ${message}`);
  console.error(
    "Confirm Docker Desktop is running and that the configured local ports are available.",
  );
  process.exitCode = 1;
});

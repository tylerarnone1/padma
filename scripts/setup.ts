import process from "node:process";
import { setupProject } from "./setup-lib";

async function main(): Promise<void> {
  if (process.argv.length > 2) {
    throw new Error("Usage: npm run setup");
  }
  await setupProject();
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown setup error";
  console.error(`\nPadma setup failed: ${message}`);
  process.exitCode = 1;
});

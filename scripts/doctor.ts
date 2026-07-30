import process from "node:process";
import { diagnoseProject } from "./doctor-lib";

const symbols = {
  pass: "✓",
  warn: "!",
  fail: "✗",
} as const;

async function main(): Promise<void> {
  if (process.argv.length > 2) {
    throw new Error("Usage: npm run doctor");
  }

  const report = await diagnoseProject();
  console.log("Padma local diagnostics\n");
  for (const check of report.checks) {
    console.log(
      `${symbols[check.status]} ${check.name}: ${check.detail}`,
    );
  }
  console.log(
    report.ok
      ? "\nDoctor found no blocking local-development problems."
      : "\nDoctor found blocking problems. Follow the guidance above and rerun it.",
  );
  if (!report.ok) process.exitCode = 1;
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown diagnostic error";
  console.error(`\nPadma doctor failed: ${message}`);
  process.exitCode = 1;
});

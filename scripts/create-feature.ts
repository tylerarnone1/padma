import process from "node:process";
import {
  FeatureGeneratorError,
  generateFeature,
} from "./feature-generator";

async function main(): Promise<void> {
  const arguments_ = process.argv.slice(2);
  if (arguments_.length !== 1) {
    throw new FeatureGeneratorError(
      "Usage: npm run generate:feature -- <lowercase-kebab-case-name>",
    );
  }
  await generateFeature({ featureName: arguments_[0]! });
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown feature generator error";
  console.error(`\nFeature generation failed: ${message}`);
  process.exitCode = 1;
});

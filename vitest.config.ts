import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "src/test/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/app/api/**/*.ts",
        "src/features/**/adapters/**/*.ts",
        "src/features/**/data/**/*.ts",
        "src/features/**/policies/**/*.ts",
        "src/features/**/schemas/**/*.ts",
        "src/features/**/security/**/*.ts",
        "src/features/**/services/**/*.ts",
        "src/lib/**/*.ts",
      ],
      exclude: ["**/*.test.ts"],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 65,
        lines: 70,
      },
    },
  },
});

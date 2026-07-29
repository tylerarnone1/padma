import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const featureName = process.argv[2];

if (!featureName || !/^[a-z][a-z0-9-]*$/.test(featureName)) {
  console.error(
    "Usage: npm run generate:feature -- <lowercase-kebab-case-name>",
  );
  process.exit(1);
}

const root = path.resolve(process.cwd(), "src", "features", featureName);
const folders = ["components", "data", "policies", "schemas", "services", "tests"];

const readme = `# ${featureName}

## Purpose

Describe the user outcome and domain vocabulary.

## Trust boundaries

- List every caller-controlled input.
- State who owns each record and how callers may address it.
- State the permission required by each operation.
- State security-sensitive side effects and audit events.

## Public surface

Export intentional entry points only. Do not reach into another feature's internals.
`;

await mkdir(root, { recursive: false });
await Promise.all(
  folders.map((folder) => mkdir(path.join(root, folder), { recursive: false })),
);
await writeFile(path.join(root, "README.md"), readme, {
  encoding: "utf8",
  flag: "wx",
});

console.log(`Created ${path.relative(process.cwd(), root)}.`);
console.log("Next: complete the trust boundaries before writing implementation.");

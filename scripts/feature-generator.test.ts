import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  generateFeature,
  validateFeatureName,
} from "./feature-generator";

const roots: string[] = [];

async function createFixture(): Promise<string> {
  const root = path.resolve(
    ".tmp",
    `feature-generator-test-${randomUUID()}`,
  );
  roots.push(root);
  await mkdir(path.join(root, "src", "features"), { recursive: true });
  await mkdir(path.join(root, "src", "lib", "http"), {
    recursive: true,
  });
  await Promise.all([
    writeFile(path.join(root, "AGENTS.md"), "# Test contract\n"),
    writeFile(path.join(root, "package.json"), '{"name":"padma"}\n'),
    writeFile(path.join(root, "src", "lib", "http", "errors.ts"), ""),
  ]);
  return root;
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true }),
    ),
  );
});

describe("feature name validation", () => {
  it.each([
    "",
    "CustomerNotes",
    "customer_notes",
    "customer--notes",
    "customer-notes-",
    "-customer-notes",
  ])("rejects %j with actionable kebab-case guidance", (name) => {
    expect(() => validateFeatureName(name)).toThrow(
      name
        ? "lowercase kebab-case"
        : "A feature name is required",
    );
  });

  it("rejects names that are too long", () => {
    expect(() => validateFeatureName(`a${"b".repeat(64)}`)).toThrow(
      "64 characters or fewer",
    );
  });
});

describe("atomic feature generation", () => {
  it("creates the complete default-deny slice and prints the next steps", async () => {
    const root = await createFixture();
    const logs: string[] = [];

    const result = await generateFeature({
      root,
      featureName: "customer-notes",
      dependencies: { log: (message) => logs.push(message) },
    });

    expect(result.files).toHaveLength(8);
    await expect(stat(result.featureRoot)).resolves.toMatchObject({
      isDirectory: expect.any(Function),
    });
    const ownership = await readFile(
      path.join(result.featureRoot, "ownership.ts"),
      "utf8",
    );
    const authorizationTest = await readFile(
      path.join(
        result.featureRoot,
        "tests",
        "customer-notes-authorization.test.ts",
      ),
      "utf8",
    );
    expect(ownership).toContain(
      'ownershipModel: OwnershipModel = "undeclared"',
    );
    expect(authorizationTest).toContain(
      "does not reveal that another owner's record exists",
    );
    expect(logs.join("\n")).toContain(
      "npm test -- src/features/customer-notes/tests",
    );
  });

  it("refuses an existing feature without changing it", async () => {
    const root = await createFixture();
    const featureRoot = path.join(
      root,
      "src",
      "features",
      "existing-feature",
    );
    await mkdir(featureRoot);
    await writeFile(path.join(featureRoot, "keep.txt"), "unchanged");

    await expect(
      generateFeature({ root, featureName: "existing-feature" }),
    ).rejects.toThrow("already exists");
    await expect(
      readFile(path.join(featureRoot, "keep.txt"), "utf8"),
    ).resolves.toBe("unchanged");
  });

  it("cleans every temporary artifact after a write failure", async () => {
    const root = await createFixture();
    let writeCount = 0;

    await expect(
      generateFeature({
        root,
        featureName: "partial-failure",
        dependencies: {
          log: vi.fn(),
          writeGeneratedFile: async (filePath, contents) => {
            writeCount += 1;
            if (writeCount === 3) {
              throw new Error("simulated disk failure");
            }
            await writeFile(filePath, contents, { flag: "wx" });
          },
        },
      }),
    ).rejects.toThrow("No partial feature was left behind");

    const entries = await readdir(path.join(root, "src", "features"));
    expect(entries).toEqual([]);
  });

  it("fails from the wrong working directory before writing", async () => {
    const root = path.resolve(
      ".tmp",
      `wrong-generator-root-${randomUUID()}`,
    );
    roots.push(root);
    await mkdir(root, { recursive: true });

    await expect(
      generateFeature({ root, featureName: "customer-notes" }),
    ).rejects.toThrow("Run the feature generator from the Padma repository root");
    expect(await readdir(root)).toEqual([]);
  });

  it("reports an invalid package manifest clearly", async () => {
    const root = await createFixture();
    await writeFile(path.join(root, "package.json"), "{");

    await expect(
      generateFeature({ root, featureName: "customer-notes" }),
    ).rejects.toThrow("package.json is not valid JSON");
  });
});

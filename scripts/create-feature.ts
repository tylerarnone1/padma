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

/** `widget-parts` -> `WidgetParts` */
const pascal = featureName
  .split("-")
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join("");
/** `widget-parts` -> `widgetParts` */
const camel = pascal.charAt(0).toLowerCase() + pascal.slice(1);

const readme = `# ${featureName}

## Purpose

Describe the user outcome and domain vocabulary.

## Trust boundaries

- List every caller-controlled input.
- State who owns each record and how callers may address it.
- State the permission required by each operation.
- State security-sensitive side effects and audit events.
- State retry, duplicate, idempotency, and worker-crash behavior.
- List the negative tests that prove default denial and ownership isolation.

## Public surface

Export intentional entry points only. Do not reach into another feature's internals.

## Generated scaffold

The generator produced a working, default-deny vertical slice. It compiles and
its authorization tests pass, except one: \`${camel}-authorization.test.ts\`
fails until \`ownership.ts\` declares an ownership model. That failure is
deliberate. Padma cannot decide who owns a ${featureName} record, and an
unanswered ownership question is the most common way an application ends up
with a broken authorization boundary.

Work through the scaffold in this order:

1. \`ownership.ts\` — declare the ownership model. The failing test then passes.
2. \`prisma/schema.prisma\` — add the model, with the owner column and the
   constraints that make ownership real at the database level.
3. \`src/features/access-control/permissions.ts\` — register
   \`${featureName}:read\` and \`${featureName}:manage\`.
4. \`data/${featureName}-repository.ts\` — replace the in-memory repository with
   Prisma, keeping the owner inside the query predicate.
5. \`services/${featureName}-service.ts\` — extend with the mutations this
   feature needs, following the required operation order in AGENTS.md.
6. \`tests/\` — add a negative test for every new operation.
`;

const ownership = `/**
 * Who owns a ${featureName} record?
 *
 * Padma ships no universal tenancy model, so this decision belongs to the
 * product. Change \`ownershipModel\` away from "undeclared" once the answer is
 * real, and record the reasoning in README.md.
 *
 * - "actor-owned": each record belongs to exactly one user, and only that user
 *   may read or mutate it. The generated policy implements this shape.
 * - "shared-with-explicit-grants": a record has an owner plus an explicit grant
 *   table. Never infer sharing from a role name.
 * - "application-wide": every record is visible to any caller holding the
 *   permission. Only correct when the data genuinely has no subject, and it
 *   must be a deliberate, documented choice rather than a default.
 */
export type OwnershipModel =
  | "undeclared"
  | "actor-owned"
  | "shared-with-explicit-grants"
  | "application-wide";

export const ownershipModel: OwnershipModel = "undeclared";

/** Stable permission contracts for this feature. Register them in access-control. */
export const ${camel}Permissions = {
  read: "${featureName}:read",
  manage: "${featureName}:manage",
} as const;
`;

const policy = `import { ${camel}Permissions } from "@/features/${featureName}/ownership";

/**
 * The caller, reduced to what an authorization decision may depend on.
 *
 * Identity and permissions come from trusted server state. Never widen this
 * with values a client can set.
 */
export type ${pascal}Principal = {
  userId: string;
  permissionKeys: ReadonlySet<string>;
};

/** The minimum a record must expose to be authorized. */
export type ${pascal}Record = {
  id: string;
  ownerId: string;
};

/**
 * Holding a permission is necessary and never sufficient: a caller must also
 * own the record. Both checks are separate on purpose.
 */
export function canRead${pascal}(principal: ${pascal}Principal): boolean {
  return principal.permissionKeys.has(${camel}Permissions.read);
}

export function canManage${pascal}(principal: ${pascal}Principal): boolean {
  return principal.permissionKeys.has(${camel}Permissions.manage);
}

export function owns${pascal}Record(
  principal: ${pascal}Principal,
  record: ${pascal}Record,
): boolean {
  return record.ownerId === principal.userId;
}
`;

const repository = `import type { ${pascal}Record } from "@/features/${featureName}/policies/${featureName}-policy";

/**
 * Reads are addressed by owner *and* id, never by id alone.
 *
 * Fetching by id and authorizing afterwards leaks existence: the caller can
 * tell a record they may not see from one that does not exist. Keeping the
 * owner in the predicate makes both cases identical.
 */
export type ${pascal}Repository = {
  findOwned(input: {
    ownerId: string;
    id: string;
  }): Promise<${pascal}Record | null>;
  listOwned(input: { ownerId: string }): Promise<${pascal}Record[]>;
};

/**
 * Replace this with Prisma once the model exists in prisma/schema.prisma:
 *
 *     import { database } from "@/lib/db/client";
 *
 *     export function createPrisma${pascal}Repository(): ${pascal}Repository {
 *       return {
 *         findOwned: ({ ownerId, id }) =>
 *           database.${camel}.findFirst({ where: { id, ownerId } }),
 *         listOwned: ({ ownerId }) =>
 *           database.${camel}.findMany({ where: { ownerId } }),
 *       };
 *     }
 *
 * Keep the owner in the \`where\` clause. Do not fetch globally and filter in
 * application code.
 */
export function createInMemory${pascal}Repository(
  records: readonly ${pascal}Record[],
): ${pascal}Repository {
  return {
    async findOwned({ ownerId, id }) {
      return (
        records.find(
          (record) => record.id === id && record.ownerId === ownerId,
        ) ?? null
      );
    },
    async listOwned({ ownerId }) {
      return records.filter((record) => record.ownerId === ownerId);
    },
  };
}
`;

const service = `import {
  canRead${pascal},
  owns${pascal}Record,
  type ${pascal}Principal,
  type ${pascal}Record,
} from "@/features/${featureName}/policies/${featureName}-policy";
import type { ${pascal}Repository } from "@/features/${featureName}/data/${featureName}-repository";
import { ForbiddenError, NotFoundError } from "@/lib/http/errors";

/**
 * Reads one record on behalf of a caller.
 *
 * A caller without the permission is refused before any query runs. A caller
 * with the permission but without ownership gets the same "not found" as a
 * caller who invented an id, so the response cannot be used to probe for
 * records they may not see.
 *
 * Route handlers still owe the rest of the required operation order in
 * AGENTS.md: request correlation, same-origin protection for cookie
 * mutations, a real server session, recent MFA when the operation is
 * sensitive, and a strict bounded schema for input.
 */
export async function read${pascal}(input: {
  repository: ${pascal}Repository;
  principal: ${pascal}Principal;
  id: string;
}): Promise<${pascal}Record> {
  if (!canRead${pascal}(input.principal)) {
    throw new ForbiddenError();
  }

  const record = await input.repository.findOwned({
    ownerId: input.principal.userId,
    id: input.id,
  });

  if (!record) {
    throw new NotFoundError("${pascal}");
  }

  // Ownership is already enforced by the predicate. This restates the
  // invariant so a future change to the repository cannot quietly widen it.
  if (!owns${pascal}Record(input.principal, record)) {
    throw new NotFoundError("${pascal}");
  }

  return record;
}

export async function list${pascal}(input: {
  repository: ${pascal}Repository;
  principal: ${pascal}Principal;
}): Promise<${pascal}Record[]> {
  if (!canRead${pascal}(input.principal)) {
    throw new ForbiddenError();
  }

  return input.repository.listOwned({ ownerId: input.principal.userId });
}
`;

const authorizationTest = `import { describe, expect, it } from "vitest";
import { createInMemory${pascal}Repository } from "@/features/${featureName}/data/${featureName}-repository";
import { ${camel}Permissions, ownershipModel } from "@/features/${featureName}/ownership";
import type { ${pascal}Principal } from "@/features/${featureName}/policies/${featureName}-policy";
import { list${pascal}, read${pascal} } from "@/features/${featureName}/services/${featureName}-service";
import { ForbiddenError, NotFoundError } from "@/lib/http/errors";

const records = [
  { id: "record-owned", ownerId: "owner" },
  { id: "record-other", ownerId: "someone-else" },
];

const repository = createInMemory${pascal}Repository(records);

function principal(
  userId: string,
  permissions: string[] = [${camel}Permissions.read],
): ${pascal}Principal {
  return { userId, permissionKeys: new Set(permissions) };
}

describe("${featureName} ownership declaration", () => {
  /**
   * Deliberately failing until the product decides. Delete nothing to make it
   * pass: set \`ownershipModel\` in ownership.ts and revisit the tests below so
   * they match the model you chose.
   */
  it("declares an ownership model before the feature ships", () => {
    expect(
      ownershipModel,
      "Declare who owns a ${featureName} record in src/features/${featureName}/ownership.ts, then align these tests with that model. See the feature README.",
    ).not.toBe("undeclared");
  });
});

describe("${featureName} authorization", () => {
  it("denies a caller with no permission", async () => {
    await expect(
      read${pascal}({
        repository,
        principal: principal("owner", []),
        id: "record-owned",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("allows an owner holding the permission", async () => {
    await expect(
      read${pascal}({
        repository,
        principal: principal("owner"),
        id: "record-owned",
      }),
    ).resolves.toMatchObject({ id: "record-owned" });
  });

  it("does not reveal that another owner's record exists", async () => {
    // Not Forbidden: a 403 would confirm the record is real.
    await expect(
      read${pascal}({
        repository,
        principal: principal("owner"),
        id: "record-other",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("treats an unknown id and another owner's id identically", async () => {
    const unknown = await read${pascal}({
      repository,
      principal: principal("owner"),
      id: "does-not-exist",
    }).catch((error: unknown) => error);
    const foreign = await read${pascal}({
      repository,
      principal: principal("owner"),
      id: "record-other",
    }).catch((error: unknown) => error);

    expect((unknown as NotFoundError).message).toBe(
      (foreign as NotFoundError).message,
    );
  });

  it("lists only the caller's own records", async () => {
    await expect(
      list${pascal}({ repository, principal: principal("owner") }),
    ).resolves.toEqual([{ id: "record-owned", ownerId: "owner" }]);
  });

  it("returns nothing for a caller who owns nothing", async () => {
    await expect(
      list${pascal}({ repository, principal: principal("stranger") }),
    ).resolves.toEqual([]);
  });
});
`;

const componentsPlaceholder = `# components

Client and server components for this feature. Keep Prisma access out of them:
data and service modules own persistence.

UI that hides an action is a convenience, not a control. The server decides.
`;

const schemasPlaceholder = `# schemas

Strict Zod schemas for every value that crosses a trust boundary.

Use \`.strict()\` so unknown fields are rejected rather than ignored, bound
string lengths and array sizes, and parse route parameters as carefully as
request bodies.
`;

const files: Array<[string, string]> = [
  ["README.md", readme],
  ["ownership.ts", ownership],
  [path.join("policies", `${featureName}-policy.ts`), policy],
  [path.join("data", `${featureName}-repository.ts`), repository],
  [path.join("services", `${featureName}-service.ts`), service],
  [
    path.join("tests", `${featureName}-authorization.test.ts`),
    authorizationTest,
  ],
  [path.join("components", "README.md"), componentsPlaceholder],
  [path.join("schemas", "README.md"), schemasPlaceholder],
];

async function main(): Promise<void> {
  // `recursive: false` so an existing feature is a hard error rather than a
  // silent partial overwrite.
  await mkdir(root, { recursive: false });
  await Promise.all(
    ["components", "data", "policies", "schemas", "services", "tests"].map(
      (folder) => mkdir(path.join(root, folder), { recursive: false }),
    ),
  );

  await Promise.all(
    files.map(([relativePath, contents]) =>
      writeFile(path.join(root, relativePath), contents, {
        encoding: "utf8",
        flag: "wx",
      }),
    ),
  );

  console.log(`Created ${path.relative(process.cwd(), root)}.`);
  console.log(
    `Next: declare the ownership model in src/features/${featureName}/ownership.ts.`,
  );
  console.log(
    "One generated test fails on purpose until that decision is recorded.",
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

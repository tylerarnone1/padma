import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { parse } from "dotenv";
import {
  developmentAppPort,
  developmentPostgresPort,
} from "./development";
import {
  runLocalCommand,
  type CommandResult,
  type LocalCommandInput,
} from "./local-command";

export type DoctorStatus = "pass" | "warn" | "fail";

export type DoctorCheck = {
  name: string;
  status: DoctorStatus;
  detail: string;
};

export type DoctorReport = {
  ok: boolean;
  checks: readonly DoctorCheck[];
};

export type AppProbeResult =
  | { reachable: false }
  | { reachable: true; padma: boolean; status: number };

export type DoctorDependencies = {
  runCommand(input: LocalCommandInput): Promise<CommandResult>;
  probeApp(appUrl: string): Promise<AppProbeResult>;
};

const defaultDependencies: DoctorDependencies = {
  runCommand: runLocalCommand,
  async probeApp(appUrl) {
    try {
      const response = await fetch(appUrl, {
        redirect: "manual",
        signal: AbortSignal.timeout(2_000),
      });
      const contentSecurityPolicy =
        response.headers.get("content-security-policy") ?? "";
      return {
        reachable: true,
        padma:
          response.headers.has("x-request-id") &&
          contentSecurityPolicy.includes("default-src 'self'"),
        status: response.status,
      };
    } catch {
      return { reachable: false };
    }
  },
};

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function versionAtLeast(
  actual: readonly number[],
  required: readonly number[],
): boolean {
  for (let index = 0; index < required.length; index += 1) {
    const actualPart = actual[index] ?? 0;
    const requiredPart = required[index] ?? 0;
    if (actualPart > requiredPart) return true;
    if (actualPart < requiredPart) return false;
  }
  return true;
}

function supportedNodeVersion(): boolean {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(process.versions.node);
  if (!match) return false;
  return versionAtLeast(
    [Number(match[1]), Number(match[2]), Number(match[3])],
    [22, 12, 0],
  );
}

function validateDatabaseUrl(
  value: string | undefined,
  postgresPort: number,
): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return (
      ["postgres:", "postgresql:"].includes(parsed.protocol) &&
      ["localhost", "127.0.0.1", "[::1]", "::1"].includes(
        parsed.hostname,
      ) &&
      Number(parsed.port) === postgresPort &&
      parsed.pathname === "/padma" &&
      parsed.searchParams.get("schema") === "public"
    );
  } catch {
    return false;
  }
}

function duplicateManagedEnvironmentKey(source: string): string | null {
  const counts = new Map<string, number>();
  const managedKeys = new Set([
    "APP_URL",
    "NODE_ENV",
    "AUTH_MODE",
    "POSTGRES_PORT",
    "DATABASE_URL",
    "BETTER_AUTH_SECRET",
    "INTEGRATION_ENCRYPTION_KEY",
  ]);
  for (const line of source.split(/\r?\n/)) {
    const match =
      /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
    const key = match?.[1];
    if (!key || !managedKeys.has(key)) continue;
    const count = (counts.get(key) ?? 0) + 1;
    if (count > 1) return key;
    counts.set(key, count);
  }
  return null;
}

function parseComposePort(stdout: string): number | null {
  const line = stdout
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .at(-1);
  const match = line ? /:(\d+)$/.exec(line) : null;
  return match ? Number(match[1]) : null;
}

export async function diagnoseProject(input?: {
  root?: string;
  environment?: NodeJS.ProcessEnv;
  dependencies?: Partial<DoctorDependencies>;
}): Promise<DoctorReport> {
  const root = path.resolve(input?.root ?? process.cwd());
  const processEnvironment = input?.environment ?? process.env;
  const dependencies: DoctorDependencies = {
    ...defaultDependencies,
    ...input?.dependencies,
  };
  const checks: DoctorCheck[] = [];
  const add = (
    name: string,
    status: DoctorStatus,
    detail: string,
  ) => checks.push({ name, status, detail });

  add(
    "Node.js",
    supportedNodeVersion() ? "pass" : "fail",
    supportedNodeVersion()
      ? `${process.version} satisfies >=22.12.0.`
      : `${process.version} is unsupported; install Node.js 22.12.0 or newer.`,
  );

  const requiredPaths = [
    "AGENTS.md",
    ".env.example",
    "compose.yaml",
    "package.json",
    path.join("prisma", "schema.prisma"),
    path.join("node_modules", "prisma", "build", "index.js"),
  ];
  const missingPaths: string[] = [];
  for (const relativePath of requiredPaths) {
    if (!(await pathExists(path.resolve(root, relativePath)))) {
      missingPaths.push(relativePath);
    }
  }
  add(
    "Repository",
    missingPaths.length === 0 ? "pass" : "fail",
    missingPaths.length === 0
      ? "Required project and installed dependency files are present."
      : `Missing ${missingPaths.join(", ")}. Run npm install from the repository root.`,
  );

  const environmentPath = path.resolve(root, ".env");
  let localEnvironment: Record<string, string> | null = null;
  if (!(await pathExists(environmentPath))) {
    add(
      "Local configuration",
      "fail",
      ".env is missing. Run npm run setup.",
    );
  } else {
    try {
      const environmentSource = await readFile(environmentPath, "utf8");
      const duplicateKey =
        duplicateManagedEnvironmentKey(environmentSource);
      if (duplicateKey) {
        throw new Error(`.env defines ${duplicateKey} more than once.`);
      }
      localEnvironment = parse(environmentSource);
      const appPort = developmentAppPort(localEnvironment.APP_URL);
      const postgresPort = developmentPostgresPort(
        localEnvironment.POSTGRES_PORT,
      );
      const secretsConfigured =
        (localEnvironment.BETTER_AUTH_SECRET?.trim().length ?? 0) >= 32 &&
        (localEnvironment.INTEGRATION_ENCRYPTION_KEY?.trim().length ?? 0) >=
          32;
      const localModes =
        localEnvironment.NODE_ENV === "development" &&
        localEnvironment.AUTH_MODE === "mock";
      const databaseMatches = validateDatabaseUrl(
        localEnvironment.DATABASE_URL,
        postgresPort,
      );
      const valid = secretsConfigured && localModes && databaseMatches;
      add(
        "Local configuration",
        valid ? "pass" : "fail",
        valid
          ? `Loopback app port ${appPort} and PostgreSQL port ${postgresPort} are coherent; persistent secrets are configured.`
          : "Configuration is not a coherent mock-development environment. Run npm run setup or repair .env.",
      );
      if (!valid) localEnvironment = null;
    } catch (error) {
      add(
        "Local configuration",
        "fail",
        `${error instanceof Error ? error.message : "Invalid .env."} Run npm run setup.`,
      );
      localEnvironment = null;
    }
  }

  const commandEnvironment = {
    ...processEnvironment,
    ...(localEnvironment ?? {}),
  };
  const docker = await dependencies.runCommand({
    command: "docker",
    arguments: ["--version"],
    cwd: root,
    environment: commandEnvironment,
  });
  const compose =
    docker.code === 0
      ? await dependencies.runCommand({
          command: "docker",
          arguments: ["compose", "version"],
          cwd: root,
          environment: commandEnvironment,
        })
      : { code: 1, stdout: "", stderr: "" };
  const daemon =
    docker.code === 0 && compose.code === 0
      ? await dependencies.runCommand({
          command: "docker",
          arguments: ["info"],
          cwd: root,
          environment: commandEnvironment,
        })
      : { code: 1, stdout: "", stderr: "" };
  const dockerReady =
    docker.code === 0 && compose.code === 0 && daemon.code === 0;
  add(
    "Docker",
    dockerReady ? "pass" : "fail",
    dockerReady
      ? "Docker, Compose, and the daemon are available."
      : "Docker, Compose, or the daemon is unavailable. Start Docker and retry.",
  );

  let postgresReady = false;
  if (dockerReady && localEnvironment) {
    const configuredPostgresPort = developmentPostgresPort(
      localEnvironment.POSTGRES_PORT,
    );
    const services = await dependencies.runCommand({
      command: "docker",
      arguments: ["compose", "ps", "--status", "running", "--services"],
      cwd: root,
      environment: commandEnvironment,
    });
    const postgresRunning =
      services.code === 0 &&
      services.stdout.split(/\r?\n/).includes("postgres");
    const mapping = postgresRunning
      ? await dependencies.runCommand({
          command: "docker",
          arguments: ["compose", "port", "postgres", "5432"],
          cwd: root,
          environment: commandEnvironment,
        })
      : { code: 1, stdout: "", stderr: "" };
    const mappedPort = parseComposePort(mapping.stdout);
    const readiness =
      postgresRunning && mappedPort === configuredPostgresPort
        ? await dependencies.runCommand({
            command: "docker",
            arguments: [
              "compose",
              "exec",
              "-T",
              "postgres",
              "pg_isready",
              "-U",
              "postgres",
              "-d",
              "padma",
            ],
            cwd: root,
            environment: commandEnvironment,
          })
        : { code: 1, stdout: "", stderr: "" };
    postgresReady =
      postgresRunning &&
      mappedPort === configuredPostgresPort &&
      readiness.code === 0;
    add(
      "PostgreSQL",
      postgresReady ? "pass" : "fail",
      postgresReady
        ? `The Padma Compose database is healthy on port ${configuredPostgresPort}.`
        : "The configured Padma database is not running and healthy on its expected port. Run npm run setup.",
    );
  } else {
    add(
      "PostgreSQL",
      "fail",
      "Database checks require valid local configuration and Docker.",
    );
  }

  if (postgresReady && localEnvironment) {
    const prismaCli = path.resolve(
      root,
      "node_modules",
      "prisma",
      "build",
      "index.js",
    );
    const schema = await dependencies.runCommand({
      command: process.execPath,
      arguments: [
        prismaCli,
        "migrate",
        "diff",
        "--from-config-datasource",
        "--to-schema",
        path.resolve(root, "prisma", "schema.prisma"),
        "--exit-code",
      ],
      cwd: root,
      environment: commandEnvironment,
    });
    add(
      "Database schema",
      schema.code === 0 ? "pass" : "fail",
      schema.code === 0
        ? "The database matches prisma/schema.prisma."
        : schema.code === 2
          ? "Schema drift detected. Review it, then choose npm run db:push or npm run db:reset."
          : "The schema comparison failed. Inspect Docker and Prisma diagnostics.",
    );
  } else {
    add(
      "Database schema",
      "fail",
      "Schema comparison requires a healthy configured database.",
    );
  }

  if (localEnvironment?.APP_URL) {
    const app = await dependencies.probeApp(localEnvironment.APP_URL);
    if (!app.reachable) {
      add(
        "Application",
        "warn",
        `Nothing is listening at ${localEnvironment.APP_URL}. Start it with npm run dev:next.`,
      );
    } else if (!app.padma) {
      add(
        "Application",
        "fail",
        `The configured APP_URL responded with HTTP ${app.status}, but it did not identify as Padma.`,
      );
    } else {
      add(
        "Application",
        "pass",
        `Padma responded with HTTP ${app.status} at ${localEnvironment.APP_URL}.`,
      );
    }
  } else {
    add(
      "Application",
      "fail",
      "Application probing requires valid local configuration.",
    );
  }

  return {
    ok: checks.every((check) => check.status !== "fail"),
    checks,
  };
}

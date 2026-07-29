import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getServerEnvironment } from "@/lib/env/server";

const globalDatabase = globalThis as unknown as {
  database?: PrismaClient;
};

function createDatabaseClient(): PrismaClient {
  const environment = getServerEnvironment();
  const adapter = new PrismaPg({
    connectionString: environment.DATABASE_URL,
  });

  return new PrismaClient({
    adapter,
  });
}

export const database = globalDatabase.database ?? createDatabaseClient();

if (process.env.NODE_ENV !== "production") {
  globalDatabase.database = database;
}

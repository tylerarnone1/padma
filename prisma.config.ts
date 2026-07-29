import "dotenv/config";
import { defineConfig } from "prisma/config";

const localDatabaseUrl =
  "postgresql://postgres:postgres@localhost:5433/padma?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? localDatabaseUrl,
  },
});

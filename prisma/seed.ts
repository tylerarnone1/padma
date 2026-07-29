import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { PERMISSION_DEFINITIONS } from "../src/features/access-control/permissions";
import { developmentAccount } from "../src/mock-data/development-account";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5433/padma?schema=public";

const database = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const permissions = await Promise.all(
    PERMISSION_DEFINITIONS.map((permission) =>
      database.permission.upsert({
        where: { key: permission.key },
        update: { description: permission.description },
        create: permission,
      }),
    ),
  );

  const administratorRole = await database.role.upsert({
    where: { key: "administrator" },
    update: {
      name: "Administrator",
      description: "Full access to Padma's application-level primitives.",
      isSystem: true,
    },
    create: {
      key: "administrator",
      name: "Administrator",
      description: "Full access to Padma's application-level primitives.",
      isSystem: true,
    },
  });

  await database.rolePermission.createMany({
    data: permissions.map((permission) => ({
      roleId: administratorRole.id,
      permissionId: permission.id,
    })),
    skipDuplicates: true,
  });

  const shouldSeedDevelopmentAccount =
    (process.env.AUTH_MODE ?? "mock") === "mock" &&
    process.env.NODE_ENV !== "production";

  if (shouldSeedDevelopmentAccount) {
    const developmentUser = await database.user.upsert({
      where: { id: developmentAccount.id },
      update: {
        name: developmentAccount.name,
        email: developmentAccount.email,
        emailVerified: developmentAccount.emailVerified,
        image: developmentAccount.image,
        twoFactorEnabled: developmentAccount.twoFactorEnabled,
      },
      create: developmentAccount,
    });

    await database.userRole.upsert({
      where: {
        userId_roleId: {
          userId: developmentUser.id,
          roleId: administratorRole.id,
        },
      },
      update: {},
      create: {
        userId: developmentUser.id,
        roleId: administratorRole.id,
      },
    });
  }

  return {
    developmentAccountSeeded: shouldSeedDevelopmentAccount,
    administratorRole,
  };
}

main()
  .then(({ developmentAccountSeeded, administratorRole }) => {
    console.log(
      `Seeded ${PERMISSION_DEFINITIONS.length} permissions and the ${administratorRole.name} role.`,
    );
    if (developmentAccountSeeded) {
      console.log(`Seeded mock account ${developmentAccount.email}.`);
    }
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.$disconnect();
  });

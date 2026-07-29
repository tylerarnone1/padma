import "server-only";

import type { PermissionKey } from "@/features/access-control/permissions";
import { can } from "@/features/access-control/policies/permission-policy";
import { database } from "@/lib/db/client";
import { ForbiddenError } from "@/lib/http/errors";
import { getRequestContext } from "@/lib/logging/request-context";

export async function getAccessSummary(userId: string) {
  const assignments = await database.userRole.findMany({
    where: { userId },
    orderBy: { role: { name: "asc" } },
    select: {
      role: {
        select: {
          key: true,
          name: true,
          permissions: {
            select: {
              permission: {
                select: { key: true },
              },
            },
          },
        },
      },
    },
  });

  return {
    roles: assignments.map(({ role }) => ({
      key: role.key,
      name: role.name,
    })),
    permissions: [
      ...new Set(
        assignments.flatMap(({ role }) =>
          role.permissions.map(({ permission }) => permission.key),
        ),
      ),
    ].sort(),
  };
}

export async function hasPermission(input: {
  userId: string;
  permission: PermissionKey;
}): Promise<boolean> {
  const user = await database.user.findUnique({
    where: { id: input.userId },
    select: {
      roles: {
        select: {
          role: {
            select: {
              permissions: {
                select: {
                  permission: {
                    select: { key: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const permissionKeys = new Set(
    user?.roles.flatMap((userRole) =>
      userRole.role.permissions.map(
        (rolePermission) => rolePermission.permission.key,
      ),
    ) ?? [],
  );

  return can({ permissionKeys }, input.permission);
}

export async function requirePermission(input: {
  userId: string;
  permission: PermissionKey;
}): Promise<void> {
  if (await hasPermission(input)) {
    return;
  }

  const requestContext = getRequestContext();
  await database.auditEvent.create({
    data: {
      actorId: input.userId,
      action: input.permission,
      targetType: "permission",
      targetId: input.permission,
      outcome: "DENIED",
      requestId: requestContext?.requestId ?? null,
    },
  });

  throw new ForbiddenError();
}

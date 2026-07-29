import type { PermissionKey } from "@/features/access-control/permissions";

export type AuthorizationPrincipal = {
  permissionKeys: ReadonlySet<string>;
};

export function can(
  principal: AuthorizationPrincipal,
  permission: PermissionKey,
): boolean {
  return principal.permissionKeys.has(permission);
}

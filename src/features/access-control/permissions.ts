export const PERMISSIONS = {
  USER_READ: "user:read",
  USER_MANAGE: "user:manage",
  ROLE_READ: "role:read",
  ROLE_MANAGE: "role:manage",
  INTEGRATION_READ: "integration:read",
  INTEGRATION_MANAGE: "integration:manage",
  AUDIT_READ: "audit:read",
} as const;

export type PermissionKey =
  (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_DEFINITIONS: ReadonlyArray<{
  key: PermissionKey;
  description: string;
}> = [
  {
    key: PERMISSIONS.USER_READ,
    description: "View application users.",
  },
  {
    key: PERMISSIONS.USER_MANAGE,
    description: "Manage application users and their access.",
  },
  {
    key: PERMISSIONS.ROLE_READ,
    description: "View roles and permission assignments.",
  },
  {
    key: PERMISSIONS.ROLE_MANAGE,
    description: "Create roles and assign permissions.",
  },
  {
    key: PERMISSIONS.INTEGRATION_READ,
    description: "View integration and webhook configuration.",
  },
  {
    key: PERMISSIONS.INTEGRATION_MANAGE,
    description: "Configure integrations and webhooks.",
  },
  {
    key: PERMISSIONS.AUDIT_READ,
    description: "Read application audit events.",
  },
];

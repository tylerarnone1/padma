import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@/features/access-control/permissions";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userRoleFindMany: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  database: {
    user: { findUnique: mocks.userFindUnique },
    userRole: { findMany: mocks.userRoleFindMany },
    auditEvent: { create: mocks.auditCreate },
  },
}));

vi.mock("@/lib/logging/request-context", () => ({
  getRequestContext: vi.fn(() => ({
    requestId: "request-1",
    userAgent: "test agent",
  })),
}));

import {
  getAccessSummary,
  hasPermission,
  requirePermission,
} from "@/features/access-control/data/authorization";

describe("authorization data boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auditCreate.mockResolvedValue({});
  });

  it("collapses role assignments into a stable access summary", async () => {
    mocks.userRoleFindMany.mockResolvedValue([
      {
        role: {
          key: "administrator",
          name: "Administrator",
          permissions: [
            { permission: { key: PERMISSIONS.USER_READ } },
            { permission: { key: PERMISSIONS.AUDIT_READ } },
          ],
        },
      },
      {
        role: {
          key: "auditor",
          name: "Auditor",
          permissions: [
            { permission: { key: PERMISSIONS.AUDIT_READ } },
          ],
        },
      },
    ]);

    await expect(getAccessSummary("user-1")).resolves.toEqual({
      roles: [
        { key: "administrator", name: "Administrator" },
        { key: "auditor", name: "Auditor" },
      ],
      permissions: [PERMISSIONS.AUDIT_READ, PERMISSIONS.USER_READ],
    });
  });

  it("allows only an explicitly assigned permission", async () => {
    mocks.userFindUnique.mockResolvedValue({
      roles: [
        {
          role: {
            permissions: [
              { permission: { key: PERMISSIONS.USER_READ } },
            ],
          },
        },
      ],
    });

    await expect(
      hasPermission({
        userId: "user-1",
        permission: PERMISSIONS.USER_READ,
      }),
    ).resolves.toBe(true);
    await expect(
      hasPermission({
        userId: "user-1",
        permission: PERMISSIONS.USER_MANAGE,
      }),
    ).resolves.toBe(false);
  });

  it("defaults to denial and durably audits the decision", async () => {
    mocks.userFindUnique.mockResolvedValue(null);

    await expect(
      requirePermission({
        userId: "user-1",
        permission: PERMISSIONS.INTEGRATION_MANAGE,
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: "user-1",
        action: PERMISSIONS.INTEGRATION_MANAGE,
        outcome: "DENIED",
        requestId: "request-1",
        userAgent: "test agent",
      }),
    });
  });
});

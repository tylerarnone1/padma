import { describe, expect, it } from "vitest";
import { PERMISSIONS } from "@/features/access-control/permissions";
import { can } from "@/features/access-control/policies/permission-policy";

describe("permission policy", () => {
  it("allows a principal with the explicit permission", () => {
    expect(
      can(
        {
          permissionKeys: new Set([PERMISSIONS.USER_READ]),
        },
        PERMISSIONS.USER_READ,
      ),
    ).toBe(true);
  });

  it("defaults to denial when the permission is absent", () => {
    expect(
      can(
        {
          permissionKeys: new Set(),
        },
        PERMISSIONS.USER_READ,
      ),
    ).toBe(false);
  });

  it("does not treat another permission as equivalent", () => {
    expect(
      can(
        {
          permissionKeys: new Set([PERMISSIONS.USER_MANAGE]),
        },
        PERMISSIONS.USER_READ,
      ),
    ).toBe(false);
  });
});

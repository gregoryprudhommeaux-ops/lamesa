import { describe, expect, it } from "vitest";
import {
  safeAdminNextPath,
  safeMemberNextPath,
  withNextQuery,
} from "@/lib/auth/safe-next-path";

describe("safeMemberNextPath", () => {
  it("accepts relative member paths", () => {
    expect(safeMemberNextPath("/compte?tab=profil")).toBe("/compte?tab=profil");
    expect(safeMemberNextPath("/e/foo")).toBe("/e/foo");
  });

  it("rejects open redirects and admin", () => {
    expect(safeMemberNextPath(null)).toBeNull();
    expect(safeMemberNextPath("//evil.com")).toBeNull();
    expect(safeMemberNextPath("https://evil.com")).toBeNull();
    expect(safeMemberNextPath("/admin/dashboard")).toBeNull();
  });
});

describe("safeAdminNextPath", () => {
  it("accepts admin deep links", () => {
    expect(safeAdminNextPath("/admin/evenements")).toBe("/admin/evenements");
    expect(safeAdminNextPath("/admin/templates?x=1")).toBe("/admin/templates?x=1");
  });

  it("rejects login loops and non-admin", () => {
    expect(safeAdminNextPath("/admin/login")).toBeNull();
    expect(safeAdminNextPath("/compte")).toBeNull();
    expect(safeAdminNextPath("//evil")).toBeNull();
  });
});

describe("withNextQuery", () => {
  it("appends next safely", () => {
    expect(withNextQuery("/admin/login", "/admin/dashboard")).toBe(
      "/admin/login?next=%2Fadmin%2Fdashboard",
    );
    expect(withNextQuery("/admin/login?error=forbidden", "/admin/x")).toBe(
      "/admin/login?error=forbidden&next=%2Fadmin%2Fx",
    );
  });
});

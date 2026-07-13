import { describe, expect, it } from "vitest";
import { isSoftDeleted, withoutSoftDeleted } from "./soft-delete";

describe("soft-delete", () => {
  it("detects deletedAt", () => {
    expect(isSoftDeleted({ deletedAt: "2026-01-01T00:00:00.000Z" })).toBe(true);
    expect(isSoftDeleted({})).toBe(false);
    expect(isSoftDeleted({ deletedAt: "" })).toBe(false);
  });

  it("filters soft-deleted rows", () => {
    const rows = [
      { id: "a" },
      { id: "b", deletedAt: "2026-01-01T00:00:00.000Z" },
    ];
    expect(withoutSoftDeleted(rows).map((r) => r.id)).toEqual(["a"]);
  });
});

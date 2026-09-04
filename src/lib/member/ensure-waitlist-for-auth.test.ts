import { describe, expect, it } from "vitest";
import { waitlistStubFullNameForAuth } from "./ensure-waitlist-for-auth";

describe("waitlistStubFullNameForAuth", () => {
  it("prefers Auth display name", () => {
    expect(waitlistStubFullNameForAuth("ada@example.com", "Ada Lovelace")).toBe(
      "Ada Lovelace",
    );
  });

  it("falls back to email local-part", () => {
    expect(waitlistStubFullNameForAuth("chinois2001@gmail.com", null)).toBe(
      "chinois2001",
    );
  });

  it("trims and caps length", () => {
    const long = "A".repeat(200);
    expect(waitlistStubFullNameForAuth("x@y.com", long).length).toBe(120);
  });
});

import { describe, expect, it } from "vitest";
import { isFranconetworkMember } from "./franconetwork-member";

describe("isFranconetworkMember", () => {
  it("matches source", () => {
    expect(isFranconetworkMember({ source: "franconetwork", tags: [] })).toBe(true);
  });

  it("matches tags", () => {
    expect(
      isFranconetworkMember({ source: "waitlist", tags: ["la-mesa", "franconetwork"] }),
    ).toBe(true);
  });

  it("rejects others", () => {
    expect(isFranconetworkMember({ source: "waitlist", tags: ["la-mesa"] })).toBe(false);
  });
});

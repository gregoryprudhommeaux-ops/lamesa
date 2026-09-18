import { describe, expect, it } from "vitest";
import { interestProspectListNames } from "./interest-prospect-lists";

describe("formal invite OUI list naming", () => {
  it("uses the STD OUI playlist for the event slug", () => {
    const slug = "dirigeants-fr-2026-09-24";
    expect(interestProspectListNames(slug).yes).toBe(`STD ${slug} — OUI`);
  });
});

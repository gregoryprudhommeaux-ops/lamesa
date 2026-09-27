import { describe, expect, it } from "vitest";
import { appendOpsNotes, formatTableCurationNote, OPS_NOTES_MAX_LENGTH } from "./ops-notes";

describe("formatTableCurationNote", () => {
  it("formats a primary removal with theme and date", () => {
    expect(
      formatTableCurationNote({
        comment: "  Trop junior pour  PE / FO  ",
        action: "removed_from_primary",
        themeTitle: "  Family Offices & PE  ",
        at: new Date("2026-09-27T15:00:00.000Z"),
      }),
    ).toBe(
      "[Table 2026-09-27 — retiré des titulaires · thème « Family Offices & PE »] Trop junior pour PE / FO",
    );
  });

  it("formats alternate removal without theme", () => {
    expect(
      formatTableCurationNote({
        comment: "Doublon secteur",
        action: "removed_from_alternate",
        at: new Date("2026-09-27T15:00:00.000Z"),
      }),
    ).toBe("[Table 2026-09-27 — retiré des remplaçants] Doublon secteur");
  });
});

describe("appendOpsNotes", () => {
  it("appends with a blank line separator", () => {
    expect(appendOpsNotes("Existing note", "New line")).toBe("Existing note\n\nNew line");
  });

  it("keeps newest content when over the max length", () => {
    const old = "A".repeat(OPS_NOTES_MAX_LENGTH - 10);
    const result = appendOpsNotes(old, "brand-new curation");
    expect(result.length).toBeLessThanOrEqual(OPS_NOTES_MAX_LENGTH);
    expect(result.endsWith("brand-new curation")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { mergeProspects, prospectFromInput } from "@/lib/prospects/normalize";
import {
  googleSheetToCsvExportUrl,
  parseProspectImportText,
} from "@/lib/prospects/parse-import";
import type { Prospect } from "@/lib/types/prospects";

describe("prospectFromInput", () => {
  it("rejects missing email", () => {
    expect(prospectFromInput({ email: "" })).toEqual({ error: "email_required" });
    expect(prospectFromInput({ email: "not-an-email" })).toEqual({ error: "email_required" });
  });

  it("creates a prospect with defaults", () => {
    const p = prospectFromInput(
      { email: "  Ada@Example.com ", fullName: "Ada" },
      { id: "x", now: "2026-01-01T00:00:00.000Z" },
    );
    expect(p).toMatchObject({
      id: "x",
      email: "ada@example.com",
      fullName: "Ada",
      status: "to_contact",
    });
  });

  it("merges fill-empty on existing", () => {
    const existing = prospectFromInput(
      { email: "a@b.com", fullName: "Ada", company: "X" },
      { id: "1", now: "t0" },
    ) as Prospect;
    const merged = prospectFromInput(
      { email: "a@b.com", fullName: "Ignored", company: "", position: "CEO" },
      { existing, now: "t1" },
    ) as Prospect;
    expect(merged.fullName).toBe("Ada");
    expect(merged.company).toBe("X");
    expect(merged.position).toBe("CEO");
  });
});

describe("mergeProspects", () => {
  it("keeps richer fields and unions tags", () => {
    const a = prospectFromInput(
      { email: "a@b.com", fullName: "A", tags: ["x"], status: "to_contact" },
      { id: "1", now: "t0" },
    ) as Prospect;
    const b = prospectFromInput(
      { email: "a@b.com", company: "Co", tags: ["y"], status: "contacted" },
      { id: "2", now: "t1" },
    ) as Prospect;
    const m = mergeProspects(a, b, "1");
    expect(m.id).toBe("1");
    expect(m.fullName).toBe("A");
    expect(m.company).toBe("Co");
    expect(m.status).toBe("contacted");
    expect(m.tags.sort()).toEqual(["x", "y"]);
  });
});

describe("parseProspectImportText", () => {
  it("parses header CSV and skips rows without email", () => {
    const rows = parseProspectImportText(
      `Nom,Email,Société,Poste,Secteur
Ada Lovelace,ada@example.com,Analytical,Engineer,Tech
No Email,,,
Bob,bob@x.com,Y,Sales,Retail`,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      email: "ada@example.com",
      fullName: "Ada Lovelace",
      company: "Analytical",
      position: "Engineer",
      sector: "Tech",
    });
  });

  it("dedupes emails in file", () => {
    const rows = parseProspectImportText(`a@x.com\na@x.com\nb@x.com`);
    expect(rows.map((r) => r.email)).toEqual(["a@x.com", "b@x.com"]);
  });
});

describe("googleSheetToCsvExportUrl", () => {
  it("builds export URL with gid", () => {
    const url =
      "https://docs.google.com/spreadsheets/d/1RkhgsUVuluPWQN4L_US06wlkVzcQN8coTEH7TfUQXbI/edit?gid=0#gid=0";
    expect(googleSheetToCsvExportUrl(url)).toBe(
      "https://docs.google.com/spreadsheets/d/1RkhgsUVuluPWQN4L_US06wlkVzcQN8coTEH7TfUQXbI/export?format=csv&gid=0",
    );
  });
});

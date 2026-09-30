import { describe, expect, it } from "vitest";
import { tableThemeProspectListName } from "./table-theme-prospect-list";

describe("tableThemeProspectListName", () => {
  it("builds a short list name under 60 chars", () => {
    const name = tableThemeProspectListName({
      city: "Guadalajara",
      theme:
        "Fonds d'investissements, Family Offices, Banques, Investment Banker, Private Equity, VC / Venture Capitalist, Leveur de fonds",
    });
    expect(name.length).toBeLessThanOrEqual(60);
    expect(name.startsWith("Table · Guadalajara · ")).toBe(true);
  });

  it("falls back to title when theme is empty", () => {
    expect(tableThemeProspectListName({ title: "Table finance", city: "CDMX" })).toBe(
      "Table · CDMX · Table finance",
    );
  });
});

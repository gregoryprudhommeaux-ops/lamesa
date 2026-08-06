import { describe, expect, it } from "vitest";
import { parseContacterImportText } from "./parse-contacter-import";

describe("parseContacterImportText", () => {
  it("parses one email per line", () => {
    const rows = parseContacterImportText("a@ex.com\nb@ex.com\na@ex.com\n");
    expect(rows).toEqual([{ email: "a@ex.com" }, { email: "b@ex.com" }]);
  });

  it("parses CSV with header", () => {
    const rows = parseContacterImportText(
      "Nombre,Email,Empresa\nAda Lovelace,ada@ex.com,Analytical\n",
    );
    expect(rows).toEqual([
      { email: "ada@ex.com", fullName: "Ada Lovelace", company: "Analytical" },
    ]);
  });

  it("parses name <email> lines", () => {
    const rows = parseContacterImportText("Jean Dupont <jean@acme.com>");
    expect(rows[0]?.email).toBe("jean@acme.com");
  });
});

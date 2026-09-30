import { describe, expect, it } from "vitest";
import { applyTemplateVars } from "@/lib/email/templates";

describe("applyTemplateVars themesUrl", () => {
  it("substitutes themesUrl for profile-incomplete templates", () => {
    const out = applyTemplateVars(
      "Profil: {{loginUrl}}\nTemas: {{themesUrl}}",
      {
        fullName: "Ada",
        loginUrl: "https://lamesasecreta.com/es/connexion",
        themesUrl: "https://lamesasecreta.com/es/themes",
        eventTitle: "",
        when: "",
        where: "",
        eventUrl: "",
      },
    );
    expect(out).toContain("https://lamesasecreta.com/es/themes");
    expect(out).not.toContain("{{themesUrl}}");
  });
});

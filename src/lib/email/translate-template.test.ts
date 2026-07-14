import { describe, expect, it } from "vitest";
import { maskTemplateVars, unmaskTemplateVars } from "./translate-template";

describe("translate-template var masking", () => {
  it("round-trips placeholders", () => {
    const src =
      "Hola {{fullName}}, evento {{eventTitle}} — {{surveyUrl}} y precio {{totalWithIva}}.";
    const { masked, tokens } = maskTemplateVars(src);
    expect(masked).not.toContain("{{");
    expect(tokens).toEqual([
      "{{fullName}}",
      "{{eventTitle}}",
      "{{surveyUrl}}",
      "{{totalWithIva}}",
    ]);
    expect(unmaskTemplateVars(masked, tokens)).toBe(src);
  });

  it("tolerates spaced LMVAR tokens from translators", () => {
    const tokens = ["{{inviteUrl}}"];
    expect(unmaskTemplateVars("Click __ LMVAR 0 __ here", tokens)).toBe(
      "Click {{inviteUrl}} here",
    );
  });
});

import { describe, expect, it } from "vitest";
import { isEligibleForTemplateCampaign } from "./campaign-eligibility";

describe("isEligibleForTemplateCampaign", () => {
  it("excludes a prospect already sent the selected template", () => {
    expect(
      isEligibleForTemplateCampaign(
        { sentTemplateKeys: ["custom_cold-september"] },
        "custom_cold-september",
      ),
    ).toBe(false);
  });

  it("keeps a prospect sent with another template", () => {
    expect(
      isEligibleForTemplateCampaign(
        { sentTemplateKeys: ["custom_cold-august"] },
        "custom_cold-september",
      ),
    ).toBe(true);
  });
});

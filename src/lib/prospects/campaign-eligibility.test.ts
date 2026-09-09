import { describe, expect, it } from "vitest";
import { isEligibleForTemplateCampaign } from "./campaign-eligibility";

describe("isEligibleForTemplateCampaign", () => {
  it("excludes a prospect already sent the selected generic template", () => {
    expect(
      isEligibleForTemplateCampaign(
        { sentTemplateKeys: ["custom_cold-september"] },
        "custom_cold-september",
      ),
    ).toBe(false);
  });

  it("keeps a prospect sent with another generic template", () => {
    expect(
      isEligibleForTemplateCampaign(
        { sentTemplateKeys: ["custom_cold-august"] },
        "custom_cold-september",
      ),
    ).toBe(true);
  });

  it("excludes won / NON CRM statuses and STD OUI playlists for event STD", () => {
    const slug = "dirigeants-fr-2026-09-24";
    const pair = {
      yes: `STD ${slug} — OUI`,
      noOther: `STD ${slug} — NON/AUTRE`,
    };
    expect(
      isEligibleForTemplateCampaign(
        { status: "won", lists: [pair.yes] },
        `custom_${slug.replace(/-/g, "_")}`,
      ),
    ).toBe(false);
    expect(
      isEligibleForTemplateCampaign(
        { status: "no_not_interested", lists: [pair.noOther] },
        `custom_${slug.replace(/-/g, "_")}`,
      ),
    ).toBe(false);
  });

  it("excludes OUI/NON for relance; allows sans réponse re-relance", () => {
    const slug = "dirigeants-fr-2026-09-24";
    expect(
      isEligibleForTemplateCampaign(
        {
          status: "to_follow",
          lists: [`STD ${slug} — OUI`],
        },
        "custom_relance_a_suivre_std_24_sept",
      ),
    ).toBe(false);
    expect(
      isEligibleForTemplateCampaign(
        {
          status: "no_response",
          lists: [`STD ${slug} — SANS RÉPONSE`],
          sentTemplateKeys: ["custom_relance_a_suivre_std_24_sept"],
        },
        "custom_relance_a_suivre_std_24_sept",
      ),
    ).toBe(true);
  });
});

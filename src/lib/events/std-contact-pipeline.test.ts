import { describe, expect, it } from "vitest";
import {
  classifyOutreachTemplate,
  isEligibleForStdPipelineCampaign,
  stdPipelineBucketForProspect,
} from "./std-contact-pipeline";

const SLUG = "dirigeants-fr-2026-09-24";
const OUI = `STD ${SLUG} — OUI`;
const NON = `STD ${SLUG} — NON/AUTRE`;
const SANS = `STD ${SLUG} — SANS RÉPONSE`;
const SHORT = `STD ${SLUG} — SHORTLIST FR`;
const STD_TPL = `custom_${SLUG.replace(/-/g, "_")}`;
const RELANCE = "custom_relance_a_suivre_std_24_sept";
const TICKET = "custom_invitation_ticket_dirigeants_fr_2026_09_24";

describe("classifyOutreachTemplate", () => {
  it("classifies STD / relance / ticket / generic", () => {
    expect(classifyOutreachTemplate(STD_TPL)).toBe("std_initial");
    expect(classifyOutreachTemplate(RELANCE)).toBe("std_relance");
    expect(classifyOutreachTemplate(TICKET)).toBe("ticket_invite");
    expect(classifyOutreachTemplate("custom_newsletter")).toBe("generic");
  });
});

describe("stdPipelineBucketForProspect", () => {
  it("maps lists and status to buckets", () => {
    expect(stdPipelineBucketForProspect({ lists: [OUI], status: "won" }, SLUG)).toBe("oui");
    expect(
      stdPipelineBucketForProspect({ lists: [NON], status: "no_not_available" }, SLUG),
    ).toBe("non");
    expect(
      stdPipelineBucketForProspect({ lists: [SANS], status: "no_response" }, SLUG),
    ).toBe("sans_reponse");
    expect(
      stdPipelineBucketForProspect({ lists: [SHORT], status: "to_contact" }, SLUG),
    ).toBe("shortlist");
  });
});

describe("isEligibleForStdPipelineCampaign", () => {
  it("blocks OUI and NON for STD and relance", () => {
    expect(
      isEligibleForStdPipelineCampaign({ status: "won", lists: [OUI] }, STD_TPL),
    ).toBe(false);
    expect(
      isEligibleForStdPipelineCampaign(
        { status: "no_not_interested", lists: [NON] },
        RELANCE,
      ),
    ).toBe(false);
  });

  it("allows sans réponse to be relaunched even with same relance key already sent", () => {
    expect(
      isEligibleForStdPipelineCampaign(
        {
          status: "no_response",
          lists: [SANS],
          sentTemplateKeys: [STD_TPL, RELANCE],
        },
        RELANCE,
      ),
    ).toBe(true);
  });

  it("blocks initial STD for people already in sans réponse", () => {
    expect(
      isEligibleForStdPipelineCampaign(
        { status: "no_response", lists: [SANS], sentTemplateKeys: [STD_TPL] },
        STD_TPL,
      ),
    ).toBe(false);
  });

  it("allows ticket invite only for OUI", () => {
    expect(
      isEligibleForStdPipelineCampaign({ status: "won", lists: [OUI] }, TICKET),
    ).toBe(true);
    expect(
      isEligibleForStdPipelineCampaign(
        { status: "no_response", lists: [SANS] },
        TICKET,
      ),
    ).toBe(false);
    expect(
      isEligibleForStdPipelineCampaign(
        { status: "no_not_available", lists: [NON] },
        TICKET,
      ),
    ).toBe(false);
  });

  it("allows generic cold recontact for approached-but-pending", () => {
    expect(
      isEligibleForStdPipelineCampaign(
        { status: "contacted", sentTemplateKeys: ["custom_old"] },
        "custom_newsletter",
      ),
    ).toBe(true);
    expect(
      isEligibleForStdPipelineCampaign(
        { status: "won", lists: [OUI] },
        "custom_newsletter",
      ),
    ).toBe(false);
    expect(
      isEligibleForStdPipelineCampaign(
        { status: "do_not_contact" },
        "custom_newsletter",
      ),
    ).toBe(false);
  });
});

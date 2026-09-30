import { describe, expect, it } from "vitest";
import {
  eventSlugFromOutreachTemplateKey,
  isRsvpButtonCampaignKey,
  hasStdRelanceStamp,
  isStdRelanceTemplateKey,
  stdRelanceStampKey,
  templateKeyMatchesEventSlug,
} from "./std-outreach-templates";

const SLUG = "dirigeants-fr-2026-09-24";

describe("std-outreach-templates", () => {
  it("matches event slug and relance keys", () => {
    expect(templateKeyMatchesEventSlug("save_the_date", SLUG)).toBe(true);
    expect(templateKeyMatchesEventSlug("custom_dirigeants_fr_2026_09_24", SLUG)).toBe(true);
    expect(templateKeyMatchesEventSlug("custom_relance_a_suivre_std_24_sept", SLUG)).toBe(true);
    expect(templateKeyMatchesEventSlug("custom_newsletter", SLUG)).toBe(false);
  });

  it("infers slug from event templates, not generic custom keys", () => {
    expect(eventSlugFromOutreachTemplateKey("custom_dirigeants_fr_2026_09_24")).toBe(SLUG);
    expect(eventSlugFromOutreachTemplateKey("custom_relance_a_suivre_std_24_sept")).toBe(SLUG);
    expect(eventSlugFromOutreachTemplateKey("custom_newsletter")).toBeNull();
    expect(eventSlugFromOutreachTemplateKey(`places_available:${SLUG}`)).toBe(SLUG);
    expect(eventSlugFromOutreachTemplateKey(stdRelanceStampKey(SLUG))).toBe(SLUG);
  });

  it("detects STD relance template keys", () => {
    expect(isStdRelanceTemplateKey("custom_relance_a_suivre_std_24_sept")).toBe(true);
    expect(isStdRelanceTemplateKey("std_relance")).toBe(true);
    expect(isStdRelanceTemplateKey(stdRelanceStampKey(SLUG))).toBe(true);
    expect(isStdRelanceTemplateKey("custom_dirigeants_fr_2026_09_24")).toBe(false);
    expect(hasStdRelanceStamp([stdRelanceStampKey(SLUG)], SLUG)).toBe(true);
    expect(hasStdRelanceStamp(["std_relance"], SLUG)).toBe(false);
    expect(templateKeyMatchesEventSlug("std_relance", SLUG)).toBe(true);
    expect(templateKeyMatchesEventSlug(stdRelanceStampKey(SLUG), SLUG)).toBe(true);
    expect(templateKeyMatchesEventSlug(stdRelanceStampKey("other-event"), SLUG)).toBe(false);
  });

  it("detects RSVP-button campaigns (places available / formal invite)", () => {
    expect(isRsvpButtonCampaignKey(`places_available:${SLUG}`)).toBe(true);
    expect(isRsvpButtonCampaignKey("places_available")).toBe(true);
    expect(isRsvpButtonCampaignKey("calendar_invite")).toBe(true);
    expect(isRsvpButtonCampaignKey("custom_newsletter")).toBe(false);
  });
});

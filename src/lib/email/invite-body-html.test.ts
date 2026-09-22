import { describe, expect, it } from "vitest";
import { inviteBodyToHtml, rsvpYesNoButtonsHtml } from "@/lib/email/send-calendar-invite";

describe("inviteBodyToHtml", () => {
  it("strips YES/NO URL lines from the body (buttons carry the CTA)", () => {
    const yes = "https://example.com/api/rsvp/go?t=abc&r=yes&l=fr";
    const no = "https://example.com/api/rsvp/go?t=abc&r=no&l=fr";
    const event = "https://example.com/fr/e/slug";
    const body = [
      "Confirme ta présence :",
      `YES : ${yes}`,
      `NO : ${no}`,
      "",
      `Page de l’événement : ${event}`,
    ].join("\n");

    const html = inviteBodyToHtml(body, yes, no, event, "fr");
    expect(html).not.toContain("api/rsvp/go");
    expect(html).not.toContain("YES :");
    expect(html).not.toContain("NO :");
    expect(html).toContain(`href="${event}"`);
  });

  it("renders FR pill labels OUI / NON", () => {
    const html = rsvpYesNoButtonsHtml({
      yesUrl: "https://example.com/yes",
      noUrl: "https://example.com/no",
      locale: "fr",
    });
    expect(html).toContain(">OUI</a>");
    expect(html).toContain(">NON</a>");
  });

  it("renders <bold> like test emails (not escaped)", () => {
    const html = inviteBodyToHtml(
      "Quand : <bold>24 sept. 2026, 20:00</bold>\nPrix : <bold>1300,00 $MX</bold>",
      "https://example.com/yes",
      "https://example.com/no",
      "https://example.com/e",
      "fr",
    );
    expect(html).toContain("<b>24 sept. 2026, 20:00</b>");
    expect(html).toContain("<b>1300,00 $MX</b>");
    expect(html).not.toContain("<bold>");
    expect(html).not.toContain("&lt;bold");
  });
});

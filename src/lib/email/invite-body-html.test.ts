import { describe, expect, it } from "vitest";
import { inviteBodyToHtml } from "@/lib/email/send-calendar-invite";

describe("inviteBodyToHtml", () => {
  it("turns YES/NO URLs into short hyperlinks", () => {
    const yes = "https://example.com/api/rsvp/token?response=yes&locale=fr";
    const no = "https://example.com/api/rsvp/token?response=no&locale=fr";
    const event = "https://example.com/fr/e/slug";
    const body = [
      "Confirme ta présence :",
      `YES : ${yes}`,
      `NO : ${no}`,
      "",
      `Page de l’événement : ${event}`,
    ].join("\n");

    const html = inviteBodyToHtml(body, yes, no, event);
    expect(html).toContain(`href="${yes.replace(/&/g, "&amp;")}"`);
    expect(html).toContain(">YES</a>");
    expect(html).toContain(">NO</a>");
    expect(html).not.toContain("YES : https://");
    expect(html).not.toContain("NO : https://");
  });

  it("renders <bold> like test emails (not escaped)", () => {
    const html = inviteBodyToHtml(
      "Quand : <bold>24 sept. 2026, 20:00</bold>\nPrix : <bold>1300,00 $MX</bold>",
      "https://example.com/yes",
      "https://example.com/no",
      "https://example.com/e",
    );
    expect(html).toContain("<b>24 sept. 2026, 20:00</b>");
    expect(html).toContain("<b>1300,00 $MX</b>");
    expect(html).not.toContain("<bold>");
    expect(html).not.toContain("&lt;bold");
  });
});

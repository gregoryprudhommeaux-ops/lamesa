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
});

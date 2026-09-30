import { describe, expect, it } from "vitest";
import {
  buildAdminRsvpYesNotifyContent,
  RSVP_YES_NOTIFY_TO,
} from "./send-admin-rsvp-yes";

describe("send-admin-rsvp-yes", () => {
  it("notifies gregory.prudhommeaux@gmail.com", () => {
    expect(RSVP_YES_NOTIFY_TO).toBe("gregory.prudhommeaux@gmail.com");
  });

  it("builds a clear OUI subject and body", () => {
    const content = buildAdminRsvpYesNotifyContent({
      fullName: "Alice Martin",
      email: "alice@example.com",
      company: "Acme",
      phone: "+52 1 33",
      eventTitle: "Dirigeants FR",
      eventSlug: "dirigeants-fr-2026-09-24",
      channel: "rsvp_button",
      status: "attending",
    });

    expect(content.subject).toBe(
      "[LA MESA] OUI — Alice Martin · Dirigeants FR",
    );
    expect(content.html).toContain("Nouveau OUI");
    expect(content.html).toContain("Alice Martin");
    expect(content.html).toContain("Bouton RSVP email");
    expect(content.text).toContain("alice@example.com");
    expect(content.text).toContain("Dirigeants FR");
  });

  it("labels interest form channel", () => {
    const content = buildAdminRsvpYesNotifyContent({
      fullName: "Bob",
      email: "bob@x.com",
      eventTitle: "Dîner",
      channel: "interest_form",
    });
    expect(content.html).toContain("Formulaire intérêt");
    expect(content.text).toContain("Formulaire intérêt");
  });
});

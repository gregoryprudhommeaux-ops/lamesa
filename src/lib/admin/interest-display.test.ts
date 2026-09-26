import { describe, expect, it } from "vitest";
import {
  buildInterestDisplayByEmail,
  resolveInterestDisplay,
} from "./interest-display";
import type { InterestRsvpEmailSets } from "./next-event-rsvp";

function sets(partial: Partial<InterestRsvpEmailSets>): InterestRsvpEmailSets {
  return {
    yesEmails: new Set(),
    noEmails: new Set(),
    otherEmails: new Set(),
    contactedEmails: new Set(),
    pendingEmails: new Set(),
    yesGuestsByEmail: new Map(),
    ...partial,
  };
}

describe("buildInterestDisplayByEmail", () => {
  it("applies oui > non > autre > sans_reponse priority", () => {
    const map = buildInterestDisplayByEmail(
      sets({
        pendingEmails: new Set(["a@x.com", "b@x.com"]),
        otherEmails: new Set(["b@x.com"]),
        noEmails: new Set(["c@x.com"]),
        yesEmails: new Set(["a@x.com"]),
      }),
    );
    expect(map.get("a@x.com")).toBe("oui");
    expect(map.get("b@x.com")).toBe("autre");
    expect(map.get("c@x.com")).toBe("non");
  });
});

describe("resolveInterestDisplay", () => {
  it("looks up normalized email from Map or record", () => {
    const map = new Map([["a@x.com", "oui" as const]]);
    expect(resolveInterestDisplay("A@X.com", map)).toBe("oui");
    expect(resolveInterestDisplay("a@x.com", { "a@x.com": "non" })).toBe("non");
    expect(resolveInterestDisplay("missing@x.com", map)).toBeNull();
  });
});

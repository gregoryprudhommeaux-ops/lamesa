import { describe, expect, it } from "vitest";
import { buildFormalInviteRecipientRows } from "./formal-invite-recipients";

describe("buildFormalInviteRecipientRows", () => {
  it("keeps playlist OUI and enriches from form", () => {
    const rows = buildFormalInviteRecipientRows({
      ouiProspects: [{ email: "a@x.com", fullName: "Ada", company: "Co", phone: "123" }],
      respondents: [
        {
          email: "a@x.com",
          interestResponse: "yes",
          firstName: "Ada",
          lastName: "Lovelace",
          companyName: "Analytical",
          whatsapp: "999",
        },
      ],
      participations: [],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.source).toBe("both");
    expect(rows[0]?.fullName).toBe("Ada");
  });

  it("includes form OUI even when playlist is empty (no Sync yet)", () => {
    const rows = buildFormalInviteRecipientRows({
      ouiProspects: [],
      respondents: [
        {
          email: "b@x.com",
          interestResponse: "yes",
          firstName: "Bob",
          lastName: "Yes",
          companyName: "Inc",
          whatsapp: "555",
        },
        {
          email: "c@x.com",
          interestResponse: "no",
          firstName: "Carl",
          lastName: "No",
        },
      ],
      participations: [
        {
          id: "p1",
          email: "b@x.com",
          status: "invited",
          calendarInviteSentAt: null,
        },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe("b@x.com");
    expect(rows[0]?.source).toBe("respondent");
    expect(rows[0]?.participationId).toBe("p1");
    expect(rows[0]?.fullName).toBe("Bob Yes");
  });

  it("does not duplicate when email is in both pools", () => {
    const rows = buildFormalInviteRecipientRows({
      ouiProspects: [{ email: "A@X.com", fullName: "Ada" }],
      respondents: [{ email: "a@x.com", interestResponse: "yes", firstName: "Ada", lastName: "L" }],
      participations: [],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.source).toBe("both");
  });
});

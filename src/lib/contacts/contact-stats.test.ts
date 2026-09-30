import { describe, expect, it } from "vitest";
import { buildContactStats } from "@/lib/contacts/contact-stats";

describe("buildContactStats", () => {
  it("counts invitations, confirmed, declined and CA with IVA", () => {
    const stats = buildContactStats({
      email: "ada@example.com",
      prospect: {
        id: "p1",
        email: "ada@example.com",
        fullName: "Ada",
        company: "",
        position: "",
        sector: "",
        city: "",
        linkedin: "",
        phone: "",
        notes: "",
        tags: [],
        lists: [],
        status: "contacted",
        seen: false,
        source: "manual",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      waitlist: null,
      events: [
        {
          id: "e1",
          title: "Dîner 1",
          startsAt: "2026-02-01T00:00:00.000Z",
          priceMxn: 1000,
        },
        {
          id: "e2",
          title: "Dîner 2",
          startsAt: "2026-03-01T00:00:00.000Z",
          priceMxn: 1000,
        },
      ],
      participations: [
        {
          id: "part1",
          email: "ada@example.com",
          eventId: "e1",
          status: "confirmed",
          satisfactionSurvey: {
            venueQuality: 5,
            menuQuality: 4,
            guestsQuality: 5,
            wouldReturn: 5,
            wouldRecommend: 5,
            comment: "Très bien",
            submittedAt: "2026-02-02T00:00:00.000Z",
          },
        },
        {
          id: "part2",
          email: "ada@example.com",
          eventId: "e2",
          status: "not_attending",
        },
      ],
      activities: [],
      respondents: [
        {
          id: "r1",
          eventId: "e2",
          email: "ada@example.com",
          interestResponse: "no",
          attendance: "other",
        },
      ],
    });

    expect(stats.invitationsCount).toBe(2);
    expect(stats.confirmedCount).toBe(1);
    expect(stats.declinedCount).toBe(1);
    // 1000 + IVA 16% + service 15%
    expect(stats.revenueMxn).toBe(1310);
    expect(stats.addedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(stats.events).toHaveLength(2);
    expect(stats.surveyCount).toBe(1);
    expect(stats.avgWouldRecommend).toBe(5);
    expect(stats.events.find((e) => e.eventId === "e1")?.revenueMxn).toBe(1310);
    expect(stats.events.find((e) => e.eventId === "e2")?.interestResponse).toBe("no");
    expect(stats.events.find((e) => e.eventId === "e1")?.survey?.comment).toBe("Très bien");
  });

  it("adds interest-only events without participation", () => {
    const stats = buildContactStats({
      email: "bob@example.com",
      prospect: null,
      waitlist: null,
      events: [{ id: "e3", title: "STD", startsAt: "2026-04-01T00:00:00.000Z", priceMxn: 450 }],
      participations: [],
      activities: [],
      respondents: [
        {
          id: "r2",
          eventId: "e3",
          email: "bob@example.com",
          interestResponse: "yes",
          attendance: "other",
          createdAt: "2026-03-20T00:00:00.000Z",
        },
      ],
    });
    expect(stats.events).toHaveLength(1);
    expect(stats.events[0].status).toBe("interest_yes");
    expect(stats.events[0].participationId).toBeNull();
    expect(stats.revenueMxn).toBe(0);
  });
});

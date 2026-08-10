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
        },
        {
          id: "part2",
          email: "ada@example.com",
          eventId: "e2",
          status: "not_attending",
        },
      ],
      activities: [],
    });

    expect(stats.invitationsCount).toBe(2);
    expect(stats.confirmedCount).toBe(1);
    expect(stats.declinedCount).toBe(1);
    // 1000 + 16% IVA
    expect(stats.revenueMxn).toBe(1160);
    expect(stats.addedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(stats.events).toHaveLength(2);
  });
});

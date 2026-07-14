import { describe, expect, it } from "vitest";
import { computeEventIva } from "@/lib/events/pricing";
import { buildMemberEngagementIndex } from "./member-engagement";

describe("buildMemberEngagementIndex", () => {
  const member = {
    id: "m1",
    email: "ada@example.com",
    referralCode: "ADA123",
  };

  it("counts invitations, confirmations, revenue and referrals", () => {
    const index = buildMemberEngagementIndex({
      members: [member],
      events: [
        { id: "e1", priceMxn: 1000 },
        { id: "e2", priceMxn: 2000 },
      ],
      participations: [
        {
          id: "p1",
          email: "ada@example.com",
          contactId: "m1",
          status: "invited",
          eventId: "e1",
        },
        {
          id: "p2",
          email: "ada@example.com",
          status: "confirmed",
          eventId: "e2",
        },
        {
          id: "p3",
          email: "ada@example.com",
          status: "waitlist",
          eventId: "e1",
        },
        {
          id: "p-org",
          email: "ada@example.com",
          status: "confirmed",
          eventId: "e1",
          isOrganizer: true,
        },
      ],
      waitlist: [
        {
          id: "r1",
          referredById: "m1",
          referredByCode: "ADA123",
          referralAcceptedAt: "2026-01-01",
        },
        {
          id: "r2",
          referredByCode: "ADA123",
          referralAcceptedAt: "2026-01-02",
        },
        {
          id: "r3",
          referredById: "m1",
        },
      ],
    });

    expect(index.get("m1")).toEqual({
      invitationsSent: 2,
      eventsConfirmed: 1,
      revenueMxn: computeEventIva(2000).totalWithIva,
      referralsMade: 2,
    });
  });
});

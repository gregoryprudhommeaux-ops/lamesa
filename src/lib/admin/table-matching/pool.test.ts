import { describe, expect, it, vi } from "vitest";
import type {
  AdminEvent,
  AdminEventParticipation,
  WaitlistRegistration,
} from "@/lib/types/events";
import { buildEligiblePool } from "./pool";

const member = (
  overrides: Partial<WaitlistRegistration> = {},
): WaitlistRegistration => ({
  id: "member-1",
  fullName: "Ada Lovelace",
  linkedinUrl: "https://linkedin.com/in/ada",
  email: "ada@example.com",
  company: "Analytical Engines",
  sector: "Technology",
  position: "Founder",
  extraActivities: ["Mentoring"],
  city: "Mexico City",
  phone: "+52 55 0000 0000",
  invitationMotivation: "Meet other founders",
  canBring: "Introductions to investors",
  isSeeking: "A technical cofounder",
  locale: "fr",
  source: "waitlist",
  tags: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const event = (overrides: Partial<AdminEvent> = {}): AdminEvent => ({
  id: "event-1",
  slug: "event-1",
  title: "LA MESA",
  startsAt: "2026-01-01T18:00:00.000Z",
  ...overrides,
});

const participation = (
  overrides: Partial<AdminEventParticipation> = {},
): AdminEventParticipation => ({
  id: "participation-1",
  eventId: "event-1",
  email: "ada@example.com",
  status: "invited",
  statusSource: "admin",
  ...overrides,
});

describe("buildEligiblePool", () => {
  it("filters by normalized city and soft deletion", () => {
    const result = buildEligiblePool({
      members: [
        member(),
        member({ id: "member-2", email: "grace@example.com", city: "  MEXICO CITY  " }),
        member({ id: "member-3", email: "alan@example.com", city: "Paris" }),
        member({ id: "member-4", email: "deleted@example.com", deletedAt: "2026-01-02" }),
      ],
      participations: [],
      events: [],
      city: " mexico city ",
    });

    expect(result.candidates.map(({ id }) => id)).toEqual(["member-1", "member-2"]);
  });

  it("marks members invited to the latest past event", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T12:00:00.000Z"));

    try {
      const result = buildEligiblePool({
        members: [member()],
        participations: [
          participation({ id: "old", eventId: "old-event" }),
          participation({ id: "latest", eventId: "latest-event" }),
          participation({ id: "future", eventId: "future-event" }),
        ],
        events: [
          event({ id: "old-event", startsAt: "2026-05-01T18:00:00.000Z" }),
          event({ id: "latest-event", startsAt: "2026-07-01T18:00:00.000Z" }),
          event({ id: "future-event", startsAt: "2026-08-01T18:00:00.000Z" }),
        ],
        city: "Mexico City",
      });

      expect(result.previousEventId).toBe("latest-event");
      expect(result.candidates[0]).toMatchObject({
        invitationCount: 2,
        invitedToPreviousEvent: true,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("matches participation by contactId before normalized email", () => {
    const result = buildEligiblePool({
      members: [
        member(),
        member({
          id: "member-2",
          fullName: "Grace Hopper",
          email: " grace@example.com ",
        }),
      ],
      participations: [
        participation({
          contactId: "member-1",
          email: " GRACE@EXAMPLE.COM ",
        }),
      ],
      events: [event()],
      city: "Mexico City",
    });

    expect(result.candidates.map(({ id, invitationCount }) => ({ id, invitationCount }))).toEqual([
      { id: "member-1", invitationCount: 1 },
      { id: "member-2", invitationCount: 0 },
    ]);
  });

  it("builds co-presence only from confirmed or attending guests", () => {
    const members = [
      member(),
      member({ id: "confirmed", email: "confirmed@example.com" }),
      member({ id: "attending", email: "attending@example.com" }),
      member({ id: "invited", email: "invited@example.com" }),
      member({ id: "organizer", email: "organizer@example.com" }),
    ];
    const participations = [
      participation({ id: "p-1", contactId: "member-1", status: "confirmed" }),
      participation({
        id: "p-2",
        contactId: "confirmed",
        email: "confirmed@example.com",
        status: "confirmed",
      }),
      participation({
        id: "p-3",
        contactId: "attending",
        email: "attending@example.com",
        status: "attending",
      }),
      participation({
        id: "p-4",
        contactId: "invited",
        email: "invited@example.com",
        status: "invited",
      }),
      participation({
        id: "p-5",
        contactId: "organizer",
        email: "organizer@example.com",
        status: "confirmed",
        isOrganizer: true,
      }),
    ];

    const result = buildEligiblePool({
      members,
      participations,
      events: [event()],
      city: "Mexico City",
    });

    expect(result.candidates.find(({ id }) => id === "member-1")?.coPresentMemberIds).toEqual([
      "confirmed",
      "attending",
    ]);
  });

  it("omits PII and locale from AI cards", () => {
    const longText = "x".repeat(1_000);
    const result = buildEligiblePool({
      members: [
        member({
          uid: "firebase-auth-uid",
          databasePersoContactId: "firebase-contact-id",
          invitationMotivation: longText,
        }),
      ],
      participations: [],
      events: [],
      city: "Mexico City",
    });
    const aiCard = result.aiCards[0];

    expect(aiCard).not.toHaveProperty("email");
    expect(aiCard).not.toHaveProperty("fullName");
    expect(aiCard).not.toHaveProperty("phone");
    expect(aiCard).not.toHaveProperty("linkedinUrl");
    expect(aiCard).not.toHaveProperty("locale");
    expect(aiCard).not.toHaveProperty("uid");
    expect(aiCard).not.toHaveProperty("databasePersoContactId");
    expect(aiCard.invitationMotivation.length).toBeLessThan(longText.length);
  });

  it("scrubs embedded email, phone, and LinkedIn URLs from AI card free text", () => {
    const result = buildEligiblePool({
      members: [
        member({
          company: "Acme Corp contact me at leak@example.com please",
          sector: "Fintech +52 55 1234 5678",
          position: "Founder https://www.linkedin.com/in/ada-lovelace/",
          city: "Mexico City",
          invitationMotivation:
            "Reach me at founder@acme.io or linkedin.com/in/ada — otherwise happy to meet peers. Call +1-415-555-0199",
          extraActivities: ["Mentoring (email: mentor@example.org)"],
          canBring: "Intros; WhatsApp +525512345678",
          isSeeking: "Cofounder — my LI https://linkedin.com/in/ada",
        }),
      ],
      participations: [],
      events: [],
      city: "Mexico City",
    });
    expect(result.aiCards).toHaveLength(1);
    const aiCard = result.aiCards[0];
    const serialized = JSON.stringify(aiCard);

    expect(serialized).not.toMatch(/leak@example\.com/i);
    expect(serialized).not.toMatch(/founder@acme\.io/i);
    expect(serialized).not.toMatch(/mentor@example\.org/i);
    expect(serialized).not.toMatch(/\+52\s*55\s*1234\s*5678/);
    expect(serialized).not.toMatch(/\+1-415-555-0199/);
    expect(serialized).not.toMatch(/\+525512345678/);
    expect(serialized).not.toMatch(/linkedin\.com\/in/i);
    expect(aiCard.company).toContain("Acme Corp");
    expect(aiCard.invitationMotivation).toContain("happy to meet peers");
    expect(aiCard.extraActivities[0]).toContain("Mentoring");
  });

  it("honors explicit excludeMemberIds", () => {
    const result = buildEligiblePool({
      members: [member(), member({ id: "member-2", email: "grace@example.com" })],
      participations: [],
      events: [],
      city: "Mexico City",
      excludeMemberIds: ["member-1"],
    });

    expect(result.candidates.map(({ id }) => id)).toEqual(["member-2"]);
  });

  it("returns an empty pool when the selected city is blank", () => {
    const result = buildEligiblePool({
      members: [
        member(),
        member({ id: "empty-city", email: "empty@example.com", city: "   " }),
      ],
      participations: [],
      events: [],
      city: "  ",
    });

    expect(result.candidates).toEqual([]);
    expect(result.aiCards).toEqual([]);
    expect(result.previousEventId).toBeNull();
  });

  it("resolves email ownership from eligible members, not soft-deleted or out-of-city duplicates", () => {
    const result = buildEligiblePool({
      members: [
        member({
          id: "deleted-first",
          email: "shared@example.com",
          deletedAt: "2026-01-02",
        }),
        member({
          id: "other-city",
          email: "shared@example.com",
          city: "Paris",
        }),
        member({
          id: "eligible",
          email: " SHARED@example.com ",
        }),
      ],
      participations: [
        participation({
          id: "p-shared",
          email: "shared@example.com",
          status: "invited",
        }),
      ],
      events: [event()],
      city: "Mexico City",
    });

    expect(result.candidates.map(({ id, invitationCount }) => ({ id, invitationCount }))).toEqual([
      { id: "eligible", invitationCount: 1 },
    ]);
  });

  it("does not assign history when multiple eligible members share the same email", () => {
    const result = buildEligiblePool({
      members: [
        member({ id: "eligible-a", email: "shared@example.com" }),
        member({ id: "eligible-b", email: " SHARED@EXAMPLE.COM " }),
      ],
      participations: [
        participation({
          id: "p-shared",
          email: "shared@example.com",
          status: "invited",
        }),
      ],
      events: [event()],
      city: "Mexico City",
    });

    expect(result.candidates.map(({ id, invitationCount }) => ({ id, invitationCount }))).toEqual([
      { id: "eligible-a", invitationCount: 0 },
      { id: "eligible-b", invitationCount: 0 },
    ]);
  });

  it("falls back to normalized email when contactId is unknown", () => {
    const result = buildEligiblePool({
      members: [member({ id: "eligible", email: "ada@example.com" })],
      participations: [
        participation({
          contactId: "missing-contact",
          email: " ADA@example.com ",
          status: "invited",
        }),
      ],
      events: [event()],
      city: "Mexico City",
    });

    expect(result.candidates[0]).toMatchObject({
      id: "eligible",
      invitationCount: 1,
    });
  });

  it("ignores events with invalid startsAt when selecting previous history", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T12:00:00.000Z"));

    try {
      const result = buildEligiblePool({
        members: [member()],
        participations: [
          participation({ id: "invalid-part", eventId: "invalid-event" }),
          participation({ id: "valid-part", eventId: "valid-event" }),
        ],
        events: [
          event({ id: "invalid-event", startsAt: "not-a-date" }),
          event({ id: "valid-event", startsAt: "2026-07-01T18:00:00.000Z" }),
        ],
        city: "Mexico City",
      });

      expect(result.previousEventId).toBe("valid-event");
      expect(result.candidates[0]).toMatchObject({
        invitationCount: 1,
        invitedToPreviousEvent: true,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("prefers same-city previous event and falls back to the latest global past event", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T12:00:00.000Z"));

    try {
      const withCityMatch = buildEligiblePool({
        members: [member()],
        participations: [
          participation({ id: "city-part", eventId: "city-event" }),
          participation({ id: "global-part", eventId: "global-newer" }),
        ],
        events: [
          event({
            id: "city-event",
            city: "Mexico City",
            startsAt: "2026-06-01T18:00:00.000Z",
          }),
          event({
            id: "global-newer",
            city: "Paris",
            startsAt: "2026-07-01T18:00:00.000Z",
          }),
        ],
        city: "Mexico City",
      });

      expect(withCityMatch.previousEventId).toBe("city-event");
      expect(withCityMatch.candidates[0]).toMatchObject({
        invitationCount: 2,
        invitedToPreviousEvent: true,
      });

      const globalFallback = buildEligiblePool({
        members: [member()],
        participations: [
          participation({ id: "older-part", eventId: "older-global" }),
          participation({ id: "newer-part", eventId: "newer-global" }),
        ],
        events: [
          event({
            id: "older-global",
            city: "Paris",
            startsAt: "2026-05-01T18:00:00.000Z",
          }),
          event({
            id: "newer-global",
            city: "Guadalajara",
            startsAt: "2026-07-01T18:00:00.000Z",
          }),
        ],
        city: "Mexico City",
      });

      expect(globalFallback.previousEventId).toBe("newer-global");
      expect(globalFallback.candidates[0]).toMatchObject({
        invitationCount: 2,
        invitedToPreviousEvent: true,
      });
    } finally {
      vi.useRealTimers();
    }
  });
});

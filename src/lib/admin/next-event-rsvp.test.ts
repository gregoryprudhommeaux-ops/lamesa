import { describe, expect, it } from "vitest";
import {
  buildNextEventRsvpSummary,
  pickNextUpcomingEvent,
} from "./next-event-rsvp";
import type {
  AdminEvent,
  AdminEventParticipation,
  EventRespondent,
} from "@/lib/types/events";

const NOW = new Date("2026-09-05T18:00:00.000Z").getTime();

function event(overrides: Partial<AdminEvent> & Pick<AdminEvent, "id" | "slug" | "title" | "startsAt">): AdminEvent {
  return {
    address: "",
    status: "published",
    responseMode: "interest",
    ...overrides,
  };
}

function part(
  overrides: Partial<AdminEventParticipation> &
    Pick<AdminEventParticipation, "id" | "eventId" | "email" | "status">,
): AdminEventParticipation {
  return {
    statusSource: "admin",
    ...overrides,
  };
}

function respondent(
  overrides: Partial<EventRespondent> & Pick<EventRespondent, "id" | "eventId" | "email">,
): EventRespondent {
  return {
    firstName: "A",
    lastName: "B",
    attendance: "yes",
    ...overrides,
  };
}

describe("pickNextUpcomingEvent", () => {
  it("picks the earliest upcoming non-closed event", () => {
    const next = pickNextUpcomingEvent(
      [
        event({
          id: "past",
          slug: "past",
          title: "Past",
          startsAt: "2026-08-01T02:00:00.000Z",
        }),
        event({
          id: "later",
          slug: "later",
          title: "Later",
          startsAt: "2026-10-01T02:00:00.000Z",
        }),
        event({
          id: "soon",
          slug: "soon",
          title: "Soon",
          startsAt: "2026-09-24T02:00:00.000Z",
        }),
        event({
          id: "closed",
          slug: "closed",
          title: "Closed",
          startsAt: "2026-09-20T02:00:00.000Z",
          status: "closed",
        }),
      ],
      NOW,
    );
    expect(next?.id).toBe("soon");
  });
});

describe("buildNextEventRsvpSummary", () => {
  it("counts interest STD contacted / yes / no / pending and lists yes guests", () => {
    const eventId = "ev1";
    const summary = buildNextEventRsvpSummary({
      nowMs: NOW,
      events: [
        event({
          id: eventId,
          slug: "dirigeants-fr-2026-09-24",
          title: "Dirigeants FR",
          startsAt: "2026-09-25T02:00:00.000Z",
          responseMode: "interest",
        }),
      ],
      participations: [
        part({
          id: "p1",
          eventId,
          email: "yes@example.com",
          status: "invited",
          fullName: "Oui Person",
          saveTheDateSentAt: "2026-09-01T00:00:00.000Z",
        }),
        part({
          id: "p2",
          eventId,
          email: "no@example.com",
          status: "invited",
          saveTheDateSentAt: "2026-09-01T00:00:00.000Z",
        }),
        part({
          id: "p3",
          eventId,
          email: "silent@example.com",
          status: "invited",
          saveTheDateSentAt: "2026-09-01T00:00:00.000Z",
        }),
        part({
          id: "org",
          eventId,
          email: "greg@nextstep-services.com",
          status: "confirmed",
          isOrganizer: true,
          saveTheDateSentAt: "2026-09-01T00:00:00.000Z",
        }),
      ],
      respondents: [
        respondent({
          id: "r1",
          eventId,
          email: "yes@example.com",
          firstName: "Marie",
          lastName: "Dupont",
          companyName: "Acme",
          interestResponse: "yes",
        }),
        respondent({
          id: "r2",
          eventId,
          email: "no@example.com",
          interestResponse: "no",
        }),
      ],
    });

    expect(summary).toMatchObject({
      eventId,
      contacted: 3,
      yes: 1,
      no: 1,
      other: 0,
      pending: 1,
    });
    expect(summary?.yesGuests).toEqual([
      {
        id: "r1",
        fullName: "Marie Dupont",
        email: "yes@example.com",
        company: "Acme",
      },
    ]);
  });

  it("uses classic RSVP statuses when responseMode is rsvp", () => {
    const eventId = "ev2";
    const summary = buildNextEventRsvpSummary({
      nowMs: NOW,
      events: [
        event({
          id: eventId,
          slug: "dinner",
          title: "Dinner",
          startsAt: "2026-09-30T02:00:00.000Z",
          responseMode: "rsvp",
        }),
      ],
      participations: [
        part({
          id: "a",
          eventId,
          email: "a@x.com",
          status: "confirmed",
          fullName: "A",
          calendarInviteSentAt: "2026-09-01T00:00:00.000Z",
        }),
        part({
          id: "b",
          eventId,
          email: "b@x.com",
          status: "not_attending",
          calendarInviteSentAt: "2026-09-01T00:00:00.000Z",
        }),
        part({
          id: "c",
          eventId,
          email: "c@x.com",
          status: "invited",
          calendarInviteSentAt: "2026-09-01T00:00:00.000Z",
        }),
      ],
      respondents: [],
    });

    expect(summary).toMatchObject({
      responseMode: "rsvp",
      contacted: 3,
      yes: 1,
      no: 1,
      pending: 1,
    });
    expect(summary?.yesGuests[0]?.fullName).toBe("A");
  });

  it("merges Prospects CRM NON pas disponible into interest no count", () => {
    const eventId = "ev3";
    const slug = "dirigeants-fr-2026-09-24";
    const summary = buildNextEventRsvpSummary({
      nowMs: NOW,
      events: [
        event({
          id: eventId,
          slug,
          title: "Dirigeants",
          startsAt: "2026-09-25T02:00:00.000Z",
          responseMode: "interest",
        }),
      ],
      participations: [],
      respondents: [
        respondent({
          id: "r-yes",
          eventId,
          email: "yes@example.com",
          firstName: "Yes",
          lastName: "One",
          interestResponse: "yes",
        }),
      ],
      prospects: [
        {
          id: "p1",
          email: "no1@example.com",
          fullName: "No One",
          company: "Co",
          status: "no_not_available",
          lists: [`STD ${slug} — SHORTLIST FR`],
          deletedAt: null,
          sentTemplateKeys: [],
          lastContactedAt: null,
        },
        {
          id: "p2",
          email: "no2@example.com",
          fullName: "No Two",
          company: "",
          status: "no_not_interested",
          lists: [`STD ${slug} — SHORTLIST FR`],
          deletedAt: null,
          sentTemplateKeys: [`custom_${slug.replace(/-/g, "_")}`],
          lastContactedAt: "2026-09-01T00:00:00.000Z",
        },
        {
          id: "p-yes-list",
          email: "yes@example.com",
          fullName: "Yes One",
          company: "Acme",
          status: "won",
          lists: [`STD ${slug} — OUI`],
          deletedAt: null,
          sentTemplateKeys: [`custom_${slug.replace(/-/g, "_")}`],
          lastContactedAt: "2026-09-01T00:00:00.000Z",
        },
        {
          id: "p-shortlist-only",
          email: "idle@example.com",
          fullName: "Not Contacted",
          company: "",
          status: "to_contact",
          lists: [`STD ${slug} — SHORTLIST FR`],
          deletedAt: null,
          sentTemplateKeys: [],
          lastContactedAt: null,
        },
        {
          id: "p-deleted",
          email: "gone@example.com",
          fullName: "Gone",
          company: "",
          status: "no_not_available",
          lists: [`STD ${slug} — SHORTLIST FR`],
          deletedAt: "2026-09-01T00:00:00.000Z",
          sentTemplateKeys: [],
          lastContactedAt: null,
        },
      ],
    });

    expect(summary).toMatchObject({
      yes: 1,
      no: 2,
      other: 0,
      // mailed/approached only — idle shortlist excluded
      contacted: 3,
      pending: 0,
    });
  });

  it("counts contacted as STD mail ∪ direct NON, not full shortlist", () => {
    const eventId = "ev4";
    const slug = "dirigeants-fr-2026-09-24";
    const tpl = "custom_dirigeants_fr_2026_09_24";
    const short = `STD ${slug} — SHORTLIST FR`;
    const prospects = [
      ...Array.from({ length: 50 }, (_, i) => ({
        id: `m${i}`,
        email: `mail${i}@example.com`,
        fullName: `Mail ${i}`,
        company: "",
        status: "to_follow" as const,
        lists: [short],
        deletedAt: null as string | null,
        sentTemplateKeys: [tpl],
        lastContactedAt: "2026-09-01T00:00:00.000Z" as string | null,
      })),
      {
        id: "direct-no",
        email: "direct@example.com",
        fullName: "Direct No",
        company: "",
        status: "no_not_available" as const,
        lists: [short],
        deletedAt: null as string | null,
        sentTemplateKeys: [] as string[],
        lastContactedAt: null as string | null,
      },
      {
        id: "not-yet",
        email: "waiting@example.com",
        fullName: "Waiting",
        company: "",
        status: "to_contact" as const,
        lists: [short],
        deletedAt: null as string | null,
        sentTemplateKeys: [] as string[],
        lastContactedAt: null as string | null,
      },
    ];

    const summary = buildNextEventRsvpSummary({
      nowMs: NOW,
      events: [
        event({
          id: eventId,
          slug,
          title: "Dirigeants",
          startsAt: "2026-09-25T02:00:00.000Z",
          responseMode: "interest",
        }),
      ],
      participations: [],
      respondents: [],
      prospects,
    });

    expect(summary?.contacted).toBe(51);
    expect(summary?.no).toBe(1);
    expect(summary?.pending).toBe(50);
  });
});

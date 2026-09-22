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
  it("counts interest STD contacted / yes / no / pending from CRM lists", () => {
    const eventId = "ev1";
    const slug = "dirigeants-fr-2026-09-24";
    const summary = buildNextEventRsvpSummary({
      nowMs: NOW,
      events: [
        event({
          id: eventId,
          slug,
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
      prospects: [
        {
          id: "crm-yes",
          email: "yes@example.com",
          fullName: "Marie Dupont",
          company: "Acme",
          status: "won",
          lists: [`STD ${slug} — OUI`],
          deletedAt: null,
          sentTemplateKeys: [`custom_${slug.replace(/-/g, "_")}`],
          lastContactedAt: "2026-09-01T00:00:00.000Z",
        },
        {
          id: "crm-no",
          email: "no@example.com",
          fullName: "No Person",
          company: "",
          status: "no_not_available",
          lists: [`STD ${slug} — NON/AUTRE`],
          deletedAt: null,
          sentTemplateKeys: [`custom_${slug.replace(/-/g, "_")}`],
          lastContactedAt: "2026-09-01T00:00:00.000Z",
        },
      ],
    });

    expect(summary).toMatchObject({
      eventId,
      contacted: 3,
      yes: 1,
      no: 1,
      other: 0,
      pending: 1,
      confirmed: 0,
      inviteSent: 0,
    });
    expect(summary?.yesGuests).toEqual([
      {
        id: "crm-yes",
        fullName: "Marie Dupont",
        email: "yes@example.com",
        company: "Acme",
        seat: "oui",
      },
    ]);
  });

  it("separates interest OUI from confirmed/paid seats", () => {
    const eventId = "ev-paid";
    const slug = "dirigeants-fr-2026-09-24";
    const summary = buildNextEventRsvpSummary({
      nowMs: NOW,
      events: [
        event({
          id: eventId,
          slug,
          title: "Dirigeants FR",
          startsAt: "2026-09-25T02:00:00.000Z",
          responseMode: "interest",
        }),
      ],
      participations: [
        part({
          id: "p-paid",
          eventId,
          email: "paid@example.com",
          status: "confirmed",
          fullName: "Paid Person",
          companyName: "Co",
          calendarInviteSentAt: "2026-09-10T00:00:00.000Z",
        }),
        part({
          id: "p-invited",
          eventId,
          email: "invited@example.com",
          status: "invited",
          fullName: "Invited Person",
          calendarInviteSentAt: "2026-09-10T00:00:00.000Z",
        }),
        part({
          id: "p-oui-only",
          eventId,
          email: "oui-only@example.com",
          status: "invited",
          fullName: "Oui Only",
        }),
      ],
      respondents: [],
      prospects: [
        {
          id: "1",
          email: "paid@example.com",
          fullName: "Paid Person",
          company: "Co",
          status: "won",
          lists: [`STD ${slug} — OUI`],
          deletedAt: null,
          sentTemplateKeys: [],
          lastContactedAt: "2026-09-01T00:00:00.000Z",
        },
        {
          id: "2",
          email: "invited@example.com",
          fullName: "Invited Person",
          company: "",
          status: "won",
          lists: [`STD ${slug} — OUI`],
          deletedAt: null,
          sentTemplateKeys: [],
          lastContactedAt: "2026-09-01T00:00:00.000Z",
        },
        {
          id: "3",
          email: "oui-only@example.com",
          fullName: "Oui Only",
          company: "",
          status: "won",
          lists: [`STD ${slug} — OUI`],
          deletedAt: null,
          sentTemplateKeys: [],
          lastContactedAt: "2026-09-01T00:00:00.000Z",
        },
      ],
    });

    expect(summary).toMatchObject({
      yes: 3,
      confirmed: 1,
      inviteSent: 1,
    });
    expect(summary?.yesGuests.map((g) => ({ email: g.email, seat: g.seat }))).toEqual([
      { email: "paid@example.com", seat: "confirmed" },
      { email: "invited@example.com", seat: "invite_sent" },
      { email: "oui-only@example.com", seat: "oui" },
    ]);
  });

  it("does not count CRM won on shortlist as OUI without OUI playlist", () => {
    const eventId = "ev-sophie";
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
      respondents: [],
      prospects: [
        {
          id: "sophie",
          email: "sophie@tequilacalle23.com",
          fullName: "Sophie Decobecq",
          company: "Calle 23 Tequila",
          status: "won",
          lists: [`STD ${slug} — SHORTLIST FR`],
          deletedAt: null,
          sentTemplateKeys: [`custom_${slug.replace(/-/g, "_")}`],
          lastContactedAt: "2026-09-01T00:00:00.000Z",
        },
        {
          id: "real-oui",
          email: "oui@example.com",
          fullName: "Real Oui",
          company: "",
          status: "won",
          lists: [`STD ${slug} — OUI`],
          deletedAt: null,
          sentTemplateKeys: [`custom_${slug.replace(/-/g, "_")}`],
          lastContactedAt: "2026-09-01T00:00:00.000Z",
        },
      ],
    });

    expect(summary?.yes).toBe(1);
    expect(summary?.yesGuests.map((g) => g.email)).toEqual(["oui@example.com"]);
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
      confirmed: 1,
    });
    expect(summary?.yesGuests[0]?.fullName).toBe("A");
    expect(summary?.yesGuests[0]?.seat).toBe("confirmed");
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

  it("lets CRM NON override a stale form YES / OUI list", () => {
    const eventId = "ev5";
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
          id: "r1",
          eventId,
          email: "arthur@example.com",
          firstName: "Arthur",
          lastName: "Blondeau",
          interestResponse: "yes",
        }),
      ],
      prospects: [
        {
          id: "p-arthur",
          email: "arthur@example.com",
          fullName: "Arthur Blondeau",
          company: "Inventec",
          status: "no_not_available",
          lists: [`STD ${slug} — SHORTLIST FR`, `STD ${slug} — OUI`],
          deletedAt: null,
          sentTemplateKeys: [`custom_${slug.replace(/-/g, "_")}`],
          lastContactedAt: "2026-09-01T00:00:00.000Z",
        },
      ],
    });

    expect(summary).toMatchObject({ yes: 0, no: 1 });
    expect(summary?.yesGuests).toEqual([]);
  });

  it("excludes soft-deleted emails even if an active twin remains on OUI", () => {
    const eventId = "ev-soft";
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
          id: "r-test",
          eventId,
          email: "test@example.com",
          firstName: "Test",
          lastName: "DOMO",
          interestResponse: "yes",
        }),
      ],
      prospects: [
        {
          id: "alive",
          email: "test@example.com",
          fullName: "Test DOMO",
          company: "TEST CO",
          status: "won",
          lists: [`STD ${slug} — OUI`],
          deletedAt: null,
          sentTemplateKeys: [],
          lastContactedAt: null,
        },
        {
          id: "ghost",
          email: "test@example.com",
          fullName: "Test DOMO",
          company: "TEST CO",
          status: "won",
          lists: [`STD ${slug} — OUI`],
          deletedAt: "2026-09-01T00:00:00.000Z",
          sentTemplateKeys: [],
          lastContactedAt: null,
        },
      ],
    });

    expect(summary?.yes).toBe(0);
    expect(summary?.yesGuests).toEqual([]);
  });

  it("includes to_follow and no_response in pending; relance template counts as contact", () => {
    const eventId = "ev6";
    const slug = "dirigeants-fr-2026-09-24";
    const short = `STD ${slug} — SHORTLIST FR`;
    const tpl = "custom_dirigeants_fr_2026_09_24";
    const relance = "custom_relance_a_suivre_std_24_sept";
    const prospects = [
      ...Array.from({ length: 30 }, (_, i) => ({
        id: `follow-${i}`,
        email: `follow${i}@example.com`,
        fullName: `Follow ${i}`,
        company: "",
        status: "to_follow" as const,
        lists: [short],
        deletedAt: null as string | null,
        sentTemplateKeys: [tpl, relance],
        lastContactedAt: "2026-09-08T00:00:00.000Z" as string | null,
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `nores-${i}`,
        email: `nores${i}@example.com`,
        fullName: `NoRes ${i}`,
        company: "",
        status: "no_response" as const,
        lists: [short],
        deletedAt: null as string | null,
        sentTemplateKeys: [tpl],
        lastContactedAt: "2026-09-01T00:00:00.000Z" as string | null,
      })),
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

    expect(summary?.pending).toBe(35);
    expect(summary?.sansReponseListName).toBe(`STD ${slug} — SANS RÉPONSE`);
  });
});

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
});

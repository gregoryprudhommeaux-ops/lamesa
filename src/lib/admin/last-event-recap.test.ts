import { describe, expect, it } from "vitest";
import { buildLastEventRecap, pickLastPastEvent } from "./last-event-recap";
import type { AdminEvent, AdminEventParticipation } from "@/lib/types/events";

const NOW = new Date("2026-09-26T12:00:00.000Z").getTime();

function event(
  overrides: Partial<AdminEvent> & Pick<AdminEvent, "id" | "slug" | "title" | "startsAt">,
): AdminEvent {
  return {
    address: "",
    status: "published",
    responseMode: "interest",
    priceMxn: 450,
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

describe("pickLastPastEvent", () => {
  it("keeps the latest dinner that already started and skips drafts", () => {
    const past = event({
      id: "past",
      slug: "past",
      title: "Passé",
      startsAt: "2026-09-24T02:00:00.000Z",
    });
    const older = event({
      id: "older",
      slug: "older",
      title: "Plus vieux",
      startsAt: "2026-08-01T02:00:00.000Z",
    });
    const upcoming = event({
      id: "next",
      slug: "next",
      title: "À venir",
      startsAt: "2026-10-01T02:00:00.000Z",
    });
    const draft = event({
      id: "draft",
      slug: "draft",
      title: "Brouillon",
      startsAt: "2026-09-25T02:00:00.000Z",
      status: "draft",
    });
    expect(pickLastPastEvent([older, upcoming, draft, past], NOW)?.id).toBe("past");
  });
});

describe("buildLastEventRecap", () => {
  const dinner = event({
    id: "ev1",
    slug: "dirigeants-fr-2026-09-24",
    title: "Dirigeants FR",
    startsAt: "2026-09-24T02:00:00.000Z",
    priceMxn: 450,
  });

  it("counts contacted once, paid seats, TTC revenue and survey notes", () => {
    const recap = buildLastEventRecap(
      [dinner],
      [
        part({
          id: "paid",
          eventId: "ev1",
          email: "sophie@x.com",
          fullName: "Sophie Decobecq",
          companyName: "Calle 23 Tequila",
          status: "confirmed",
          placesAvailableSentAt: "2026-09-22T21:56:00.000Z",
          calendarInviteSentAt: "2026-09-22T21:56:00.000Z",
          confirmationEmailSentAt: "2026-09-23T18:00:00.000Z",
          satisfactionSurvey: {
            venueQuality: 5,
            menuQuality: 4,
            guestsQuality: 5,
            wouldReturn: 5,
            wouldRecommend: 5,
            valueForMoney: 4,
            comment: "Table très juste.",
            submittedAt: "2026-09-25T16:00:00.000Z",
          },
        }),
        part({
          id: "silent",
          eventId: "ev1",
          email: "silent@x.com",
          fullName: "Silent",
          status: "invited",
          saveTheDateSentAt: "2026-09-08T00:00:00.000Z",
        }),
        part({
          id: "unpaid",
          eventId: "ev1",
          email: "oui@x.com",
          fullName: "Oui Impayé",
          status: "attending",
          calendarInviteSentAt: "2026-09-20T00:00:00.000Z",
        }),
        part({
          id: "org",
          eventId: "ev1",
          email: "org@x.com",
          fullName: "Organisateur",
          status: "confirmed",
          isOrganizer: true,
          calendarInviteSentAt: "2026-09-20T00:00:00.000Z",
        }),
      ],
      NOW,
    );

    expect(recap?.contacted).toBe(3);
    expect(recap?.contactedPeople.map((p) => p.email)).toEqual([
      "oui@x.com",
      "silent@x.com",
      "sophie@x.com",
    ]);
    expect(recap?.contactedPeople.find((p) => p.id === "paid")?.channels).toEqual([
      "Invitation",
      "Places",
      "Confirmation",
    ]);
    expect(recap?.registered).toBe(1);
    expect(recap?.registeredPeople.map((p) => p.fullName)).toEqual(["Sophie Decobecq"]);
    expect(recap?.coverCount).toBe(2);
    expect(recap?.revenueBeforeTaxMxn).toBe(450);
    expect(recap?.ivaMxn).toBe(72);
    expect(recap?.revenueMxn).toBe(522);
    expect(recap?.costMxn).toBe(1044);
    expect(recap?.profitMxn).toBe(-522);
    expect(recap?.satisfactionResponses).toBe(1);
    expect(recap?.satisfactionOverall).toBe(4.7);
    expect(recap?.surveyRows[0]?.comment).toBe("Table très juste.");
  });

  it("returns zero revenue when the ticket price is missing", () => {
    const recap = buildLastEventRecap(
      [event({ ...dinner, priceMxn: null })],
      [
        part({
          id: "paid",
          eventId: "ev1",
          email: "sophie@x.com",
          status: "present",
          confirmationEmailSentAt: "2026-09-23T18:00:00.000Z",
        }),
      ],
      NOW,
    );
    expect(recap?.registered).toBe(1);
    expect(recap?.priceMxn).toBeNull();
    expect(recap?.revenueMxn).toBe(0);
    expect(recap?.coverCount).toBe(1);
    expect(recap?.profitMxn).toBe(0);
  });

  it("keeps CA on payers and cost on payers plus one organizer seat", () => {
    const recap = buildLastEventRecap(
      [event({ ...dinner, priceMxn: 1300 })],
      [
        ...Array.from({ length: 10 }, (_, index) =>
          part({
            id: `paid-${index}`,
            eventId: "ev1",
            email: `payer-${index}@x.com`,
            fullName: `Payer ${index}`,
            status: "confirmed",
          }),
        ),
        part({
          id: "host-gmail",
          eventId: "ev1",
          email: "gregory.prudhommeaux@gmail.com",
          fullName: "Gregory Prudhommeaux",
          status: "confirmed",
          isOrganizer: true,
        }),
        part({
          id: "host-mesa",
          eventId: "ev1",
          email: "greg@nextstep-services.com",
          fullName: "Greg",
          status: "confirmed",
        }),
      ],
      NOW,
    );

    expect(recap?.registered).toBe(10);
    expect(recap?.coverCount).toBe(11);
    expect(recap?.revenueMxn).toBe(15080);
    expect(recap?.costMxn).toBe(16588);
    expect(recap?.profitMxn).toBe(-1508);
    expect(recap?.registeredPeople.some((p) => p.email.includes("greg"))).toBe(false);
  });
});

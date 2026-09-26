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
    expect(recap?.revenueBeforeTaxMxn).toBe(450);
    expect(recap?.ivaMxn).toBe(72);
    expect(recap?.serviceMxn).toBe(67.5);
    expect(recap?.revenueMxn).toBe(589.5);
    expect(recap?.saleFormula).toBe("TTC · HT + IVA 16% + svc 15%");
    expect(recap?.priceIncludesIva).toBe(true);
    expect(recap?.priceIncludesService).toBe(true);
    // Organizer seat counts as Invité (COST) even if legacy status was confirmed.
    expect(recap?.complimentary).toBe(1);
    expect(recap?.complimentaryPeople.map((p) => p.email)).toEqual(["org@x.com"]);
    expect(recap?.complimentaryPeople[0]?.status).toBe("comped");
    expect(recap?.complimentaryPeople[0]?.amountMxn).toBe(0);
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
  });

  it("counts complimentary Invité seats with cost but zero CA", () => {
    const recap = buildLastEventRecap(
      [event({ ...dinner, priceMxn: 2000, costMxn: 1000 })],
      [
        part({
          id: "paid",
          eventId: "ev1",
          email: "paid@x.com",
          fullName: "Payé",
          status: "confirmed",
          calendarInviteSentAt: "2026-09-20T00:00:00.000Z",
        }),
        part({
          id: "guest",
          eventId: "ev1",
          email: "guest@x.com",
          fullName: "Invité offert",
          status: "comped",
          calendarInviteSentAt: "2026-09-20T00:00:00.000Z",
        }),
      ],
      NOW,
    );
    expect(recap?.registered).toBe(1);
    expect(recap?.complimentary).toBe(1);
    expect(recap?.revenueMxn).toBe(2620);
    expect(recap?.costTotalMxn).toBe(2620);
    expect(recap?.marginMxn).toBe(0);
    expect(recap?.complimentaryPeople[0]?.amountMxn).toBe(0);
  });

  it("organizer seat is Invité COST (no CA) even when status was Payé", () => {
    const recap = buildLastEventRecap(
      [event({ ...dinner, priceMxn: 2000, costMxn: 1000 })],
      [
        part({
          id: "paid",
          eventId: "ev1",
          email: "paid@x.com",
          fullName: "Payé",
          status: "confirmed",
          calendarInviteSentAt: "2026-09-20T00:00:00.000Z",
        }),
        part({
          id: "org",
          eventId: "ev1",
          email: "gregory@x.com",
          fullName: "Gregory Prudhommeaux",
          status: "confirmed",
          isOrganizer: true,
          calendarInviteSentAt: "2026-09-20T00:00:00.000Z",
        }),
      ],
      NOW,
    );
    expect(recap?.registered).toBe(1);
    expect(recap?.revenueMxn).toBe(2620);
    expect(recap?.complimentary).toBe(1);
    expect(recap?.complimentaryPeople[0]?.fullName).toBe("Gregory Prudhommeaux");
    expect(recap?.complimentaryPeople[0]?.status).toBe("comped");
    expect(recap?.complimentaryPeople[0]?.amountMxn).toBe(0);
    // COST = (1 paid + 1 org Invité) × 1310
    expect(recap?.costTotalMxn).toBe(2620);
    expect(recap?.marginMxn).toBe(0);
  });

  it("CA follows negotiation flags (no invented service)", () => {
    const recap = buildLastEventRecap(
      [
        event({
          ...dinner,
          priceMxn: 1300,
          priceIncludesService: false,
          priceIncludesIva: true,
        }),
      ],
      [
        part({
          id: "paid",
          eventId: "ev1",
          email: "a@x.com",
          status: "confirmed",
          calendarInviteSentAt: "2026-09-20T00:00:00.000Z",
        }),
      ],
      NOW,
    );
    // 1300 + IVA 208 = 1508 — no service
    expect(recap?.revenueMxn).toBe(1508);
    expect(recap?.serviceMxn).toBe(0);
    expect(recap?.saleFormula).toBe("TTC · HT + IVA 16%");
    expect(recap?.priceIncludesService).toBe(false);
  });
});

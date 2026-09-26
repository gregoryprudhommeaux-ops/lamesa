import { describe, expect, it } from "vitest";
import {
  buildLastEmailResultsSummary,
  inferLastEmailCampaignFromEvents,
  inferLastEmailCampaignFromProspects,
  inferLatestOutboundEmail,
  mergeCampaignHistory,
  normalizeLastEmailCampaignRecord,
  pickLatestCampaign,
  type LastEmailCampaignRecord,
} from "./last-email-campaign";
import type {
  AdminEvent,
  AdminEventParticipation,
  EventRespondent,
} from "@/lib/types/events";

function event(
  overrides: Partial<AdminEvent> & Pick<AdminEvent, "id" | "slug" | "title" | "startsAt">,
): AdminEvent {
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

const SLUG = "dirigeants-fr-2026-09-24";
const TPL = `custom_${SLUG.replace(/-/g, "_")}`;

function campaign(
  overrides: Partial<LastEmailCampaignRecord> = {},
): LastEmailCampaignRecord {
  return {
    templateKey: TPL,
    templateLabel: "Dirigeants FR",
    sentAt: "2026-09-10T12:00:00.000Z",
    recipientCount: 3,
    recipientEmails: ["a@x.com", "b@x.com", "c@x.com"],
    eventSlug: SLUG,
    eventId: "ev1",
    eventTitle: "Dirigeants FR",
    source: "cold_outreach",
    updatedAt: "2026-09-10T12:00:00.000Z",
    ...overrides,
  };
}

describe("normalizeLastEmailCampaignRecord", () => {
  it("rejects incomplete docs", () => {
    expect(normalizeLastEmailCampaignRecord({})).toBeNull();
    expect(normalizeLastEmailCampaignRecord({ templateKey: "x" })).toBeNull();
  });

  it("normalizes emails and counts", () => {
    const row = normalizeLastEmailCampaignRecord({
      templateKey: TPL,
      sentAt: "2026-09-10T12:00:00.000Z",
      recipientEmails: ["A@x.com", "a@x.com", "b@x.com"],
      recipientCount: 2,
      source: "cold_outreach",
    });
    expect(row?.recipientEmails).toEqual(["a@x.com", "b@x.com"]);
    expect(row?.recipientCount).toBe(2);
  });
});

describe("inferLastEmailCampaignFromProspects", () => {
  it("picks the latest wave and last template key", () => {
    const inferred = inferLastEmailCampaignFromProspects(
      [
        {
          id: "1",
          email: "a@x.com",
          fullName: "A",
          company: "",
          status: "no_response",
          lists: [`STD ${SLUG} — SANS RÉPONSE`],
          sentTemplateKeys: [TPL],
          lastContactedAt: "2026-09-10T12:00:00.000Z",
        },
        {
          id: "2",
          email: "b@x.com",
          fullName: "B",
          company: "",
          status: "no_response",
          lists: [`STD ${SLUG} — SANS RÉPONSE`],
          sentTemplateKeys: [TPL, "custom_relance_a_suivre_std_24_sept"],
          lastContactedAt: "2026-09-10T12:05:00.000Z",
        },
        {
          id: "3",
          email: "old@x.com",
          fullName: "Old",
          company: "",
          status: "contacted",
          lists: [],
          sentTemplateKeys: ["custom_old"],
          lastContactedAt: "2026-08-01T12:00:00.000Z",
        },
      ],
      [event({ id: "ev1", slug: SLUG, title: "Dirigeants", startsAt: "2026-09-24T02:00:00.000Z" })],
    );
    expect(inferred?.templateKey).toBe("custom_relance_a_suivre_std_24_sept");
    // Whole wave that received the relance template (here only Bob).
    expect(inferred?.recipientEmails).toEqual(["b@x.com"]);
    expect(inferred?.eventSlug).toBe(SLUG);
    expect(inferred?.source).toBe("inferred");
  });
});

describe("inferLastEmailCampaignFromEvents", () => {
  it("uses the newest saveTheDateSentAt", () => {
    const inferred = inferLastEmailCampaignFromEvents(
      [
        event({
          id: "old",
          slug: "old",
          title: "Old",
          startsAt: "2026-08-01T02:00:00.000Z",
          saveTheDateSentAt: "2026-07-01T00:00:00.000Z",
        }),
        event({
          id: "ev1",
          slug: SLUG,
          title: "Dirigeants",
          startsAt: "2026-09-24T02:00:00.000Z",
          saveTheDateSentAt: "2026-09-08T00:00:00.000Z",
        }),
      ],
      [
        part({
          id: "p1",
          eventId: "ev1",
          email: "a@x.com",
          status: "invited",
          saveTheDateSentAt: "2026-09-08T00:00:00.000Z",
        }),
        part({
          id: "p2",
          eventId: "ev1",
          email: "b@x.com",
          status: "invited",
          saveTheDateSentAt: "2026-09-08T00:00:00.000Z",
        }),
      ],
    );
    expect(inferred?.templateKey).toBe("save_the_date");
    expect(inferred?.eventId).toBe("ev1");
    expect(inferred?.recipientEmails).toEqual(["a@x.com", "b@x.com"]);
  });
});

describe("pickLatestCampaign", () => {
  it("returns the newest by sentAt", () => {
    const a = campaign({ sentAt: "2026-09-01T00:00:00.000Z" });
    const b = campaign({
      sentAt: "2026-09-11T00:00:00.000Z",
      templateKey: "custom_newer",
    });
    expect(pickLatestCampaign(a, b)?.templateKey).toBe("custom_newer");
  });

  it("lets a later participation stamp beat the stored places archive", () => {
    const stored = campaign({
      templateKey: `places_available:${SLUG}`,
      sentAt: "2026-09-22T21:56:00.000Z",
      source: "places_available",
    });
    const survey = campaign({
      templateKey: "satisfaction_survey",
      sentAt: "2026-09-25T16:00:00.000Z",
      source: "inferred",
    });
    expect(pickLatestCampaign(stored, survey)?.templateKey).toBe("satisfaction_survey");
  });
});

describe("inferLatestOutboundEmail", () => {
  const dinner = event({
    id: "ev1",
    slug: SLUG,
    title: "Dirigeants",
    startsAt: "2026-09-24T02:00:00.000Z",
  });

  it("prefers a later survey over the places blast", () => {
    const inferred = inferLatestOutboundEmail(
      [dinner],
      [
        part({
          id: "p1",
          eventId: "ev1",
          email: "a@x.com",
          status: "confirmed",
          placesAvailableSentAt: "2026-09-22T21:56:00.000Z",
          calendarInviteSentAt: "2026-09-22T21:56:00.000Z",
          satisfactionSurveySentAt: "2026-09-25T16:00:00.000Z",
        }),
        part({
          id: "p2",
          eventId: "ev1",
          email: "b@x.com",
          status: "confirmed",
          placesAvailableSentAt: "2026-09-22T21:56:00.000Z",
          satisfactionSurveySentAt: "2026-09-25T16:02:00.000Z",
        }),
      ],
    );
    expect(inferred?.templateKey).toBe("satisfaction_survey");
    expect(inferred?.sentAt).toBe("2026-09-25T16:02:00.000Z");
    expect(inferred?.recipientEmails).toEqual(["a@x.com", "b@x.com"]);
  });

  it("does not count the places send as a separate formal invite", () => {
    const inferred = inferLatestOutboundEmail(
      [dinner],
      [
        part({
          id: "p1",
          eventId: "ev1",
          email: "a@x.com",
          status: "invited",
          placesAvailableSentAt: "2026-09-22T21:56:00.000Z",
          calendarInviteSentAt: "2026-09-22T21:56:30.000Z",
        }),
      ],
    );
    expect(inferred?.templateKey).toBe(`places_available:${SLUG}`);
  });

  it("keeps a formal invite sent after the places blast", () => {
    const inferred = inferLatestOutboundEmail(
      [dinner],
      [
        part({
          id: "p1",
          eventId: "ev1",
          email: "a@x.com",
          status: "invited",
          placesAvailableSentAt: "2026-09-22T21:56:00.000Z",
          calendarInviteSentAt: "2026-09-23T15:00:00.000Z",
        }),
      ],
    );
    expect(inferred?.templateKey).toBe("calendar_invite");
    expect(inferred?.sentAt).toBe("2026-09-23T15:00:00.000Z");
  });

  it("picks the payment confirmation when it is the newest stamp", () => {
    const inferred = inferLatestOutboundEmail(
      [dinner],
      [
        part({
          id: "p1",
          eventId: "ev1",
          email: "paid@x.com",
          status: "confirmed",
          placesAvailableSentAt: "2026-09-22T21:56:00.000Z",
          confirmationEmailSentAt: "2026-09-23T18:00:00.000Z",
        }),
        part({
          id: "org",
          eventId: "ev1",
          email: "org@x.com",
          status: "confirmed",
          isOrganizer: true,
          satisfactionSurveySentAt: "2026-09-26T12:00:00.000Z",
        }),
      ],
    );
    expect(inferred?.templateKey).toBe("participation_confirmed");
    expect(inferred?.recipientEmails).toEqual(["paid@x.com"]);
  });
});

describe("mergeCampaignHistory", () => {
  it("puts the newest blast first and drops the same wave", () => {
    const places = campaign({
      templateKey: `places_available:${SLUG}`,
      sentAt: "2026-09-22T21:56:00.000Z",
      source: "places_available",
    });
    const survey = campaign({
      templateKey: "satisfaction_survey",
      sentAt: "2026-09-25T16:00:00.000Z",
      source: "inferred",
    });
    const dup = campaign({
      templateKey: "satisfaction_survey",
      sentAt: "2026-09-25T18:00:00.000Z",
      source: "satisfaction_survey",
    });
    expect(mergeCampaignHistory([places], [survey, dup]).map((row) => row.templateKey)).toEqual([
      "satisfaction_survey",
      `places_available:${SLUG}`,
    ]);
  });
});

describe("buildLastEmailResultsSummary", () => {
  it("counts OUI/NON/pending only for the last email cohort", () => {
    const summary = buildLastEmailResultsSummary({
      campaign: campaign({
        recipientEmails: ["a@x.com", "b@x.com", "c@x.com"],
        recipientCount: 3,
      }),
      events: [
        event({
          id: "ev1",
          slug: SLUG,
          title: "Dirigeants",
          startsAt: "2026-09-24T02:00:00.000Z",
        }),
      ],
      participations: [],
      respondents: [
        respondent({
          id: "r1",
          eventId: "ev1",
          email: "a@x.com",
          interestResponse: "yes",
          firstName: "Alice",
          lastName: "Oui",
        }),
      ],
      prospects: [
        {
          id: "1",
          email: "a@x.com",
          fullName: "Alice Oui",
          company: "Co A",
          status: "won",
          lists: [`STD ${SLUG} — OUI`],
          sentTemplateKeys: [TPL],
          lastContactedAt: "2026-09-10T12:00:00.000Z",
        },
        {
          id: "2",
          email: "b@x.com",
          fullName: "Bob Non",
          company: "Co B",
          status: "no_not_interested",
          lists: [`STD ${SLUG} — NON/AUTRE`],
          sentTemplateKeys: [TPL],
          lastContactedAt: "2026-09-10T12:00:00.000Z",
        },
        {
          id: "3",
          email: "c@x.com",
          fullName: "Carla Pending",
          company: "",
          status: "no_response",
          lists: [`STD ${SLUG} — SANS RÉPONSE`],
          sentTemplateKeys: [TPL],
          lastContactedAt: "2026-09-10T12:00:00.000Z",
        },
        {
          id: "4",
          email: "outsider@x.com",
          fullName: "Outsider",
          company: "",
          status: "won",
          lists: [`STD ${SLUG} — OUI`],
          sentTemplateKeys: [TPL],
          lastContactedAt: "2026-09-01T12:00:00.000Z",
        },
      ],
    });

    expect(summary.responseMode).toBe("interest");
    expect(summary.yes).toBe(1);
    expect(summary.no).toBe(1);
    expect(summary.pending).toBe(1);
    expect(summary.confirmed).toBe(0);
    expect(summary.registered).toBe(0);
    expect(summary.responseRate).toBe(67); // 2 answered / 3
    expect(summary.yesRate).toBe(33);
    expect(summary.yesGuests.map((g) => g.email)).toEqual(["a@x.com"]);
    expect(summary.yesGuests[0]?.seat).toBe("oui");
    expect(summary.recipientCount).toBe(3);
    expect(summary.recipients.map((r) => ({ email: r.email, outcome: r.outcome }))).toEqual([
      { email: "a@x.com", outcome: "yes" },
      { email: "b@x.com", outcome: "no" },
      { email: "c@x.com", outcome: "pending" },
    ]);
  });

  it("marks waitlist members as registered in the contacted list", () => {
    const summary = buildLastEmailResultsSummary({
      campaign: campaign({
        recipientEmails: ["new@x.com", "member@x.com"],
        recipientCount: 2,
      }),
      events: [
        event({
          id: "ev1",
          slug: SLUG,
          title: "Dirigeants",
          startsAt: "2026-09-24T02:00:00.000Z",
        }),
      ],
      participations: [],
      respondents: [],
      prospects: [
        {
          id: "1",
          email: "new@x.com",
          fullName: "New",
          company: "",
          status: "no_response",
          lists: [`STD ${SLUG} — SANS RÉPONSE`],
          sentTemplateKeys: [TPL],
          lastContactedAt: "2026-09-10T12:00:00.000Z",
        },
        {
          id: "2",
          email: "member@x.com",
          fullName: "Member",
          company: "",
          status: "contacted",
          lists: [`STD ${SLUG} — SANS RÉPONSE`],
          sentTemplateKeys: [TPL],
          lastContactedAt: "2026-09-10T12:00:00.000Z",
        },
      ],
      waitlistByEmail: new Map([
        [
          "member@x.com",
          {
            email: "member@x.com",
            fullName: "Member",
            company: "",
            source: "inscription",
            profileComplete: true,
          },
        ],
      ]),
    });

    expect(summary.pending).toBe(1);
    expect(summary.registered).toBe(1);
    expect(summary.registeredComplete).toBe(1);
    expect(summary.recipients.map((r) => r.outcome).sort()).toEqual([
      "pending",
      "registered",
    ]);
  });

  it("counts places_available OUI/NON from RSVP participation status", () => {
    const summary = buildLastEmailResultsSummary({
      campaign: {
        templateKey: `places_available:${SLUG}`,
        templateLabel: "Places encore dispo",
        sentAt: "2026-09-22T21:56:00.000Z",
        recipientCount: 3,
        recipientEmails: ["yes@x.com", "no@x.com", "silent@x.com"],
        eventSlug: SLUG,
        eventId: "ev1",
        eventTitle: "Dirigeants",
        source: "places_available",
        updatedAt: "2026-09-22T21:56:00.000Z",
      },
      events: [
        event({
          id: "ev1",
          slug: SLUG,
          title: "Dirigeants",
          startsAt: "2026-09-24T02:00:00.000Z",
          responseMode: "interest",
        }),
      ],
      participations: [
        part({
          id: "p1",
          eventId: "ev1",
          email: "yes@x.com",
          status: "attending",
          fullName: "Yes Person",
          companyName: "Co",
          placesAvailableSentAt: "2026-09-22T21:56:00.000Z",
        }),
        part({
          id: "p2",
          eventId: "ev1",
          email: "no@x.com",
          status: "not_attending",
          fullName: "No Person",
          placesAvailableSentAt: "2026-09-22T21:56:00.000Z",
        }),
        part({
          id: "p3",
          eventId: "ev1",
          email: "silent@x.com",
          status: "invited",
          fullName: "Silent",
          placesAvailableSentAt: "2026-09-22T21:56:00.000Z",
        }),
      ],
      respondents: [],
      prospects: [],
      waitlistByEmail: new Map([
        [
          "silent@x.com",
          {
            email: "silent@x.com",
            fullName: "Silent",
            company: "",
            source: "light",
            profileComplete: false,
          },
        ],
        [
          "yes@x.com",
          {
            email: "yes@x.com",
            fullName: "Yes Person",
            company: "Co",
            source: "inscription",
            profileComplete: true,
          },
        ],
      ]),
    });

    expect(summary.responseMode).toBe("rsvp");
    expect(summary.yes).toBe(1);
    expect(summary.no).toBe(1);
    expect(summary.pending).toBe(1);
    expect(summary.registeredExpress).toBe(1);
    expect(summary.registeredComplete).toBe(1);
    expect(summary.yesGuests.map((g) => g.email)).toEqual(["yes@x.com"]);
    expect(summary.noGuests.map((g) => g.email)).toEqual(["no@x.com"]);
  });

  it("does not count admin-blast waitlist stubs as inscrits", () => {
    const summary = buildLastEmailResultsSummary({
      campaign: {
        templateKey: `places_available:${SLUG}`,
        templateLabel: "Places encore dispo",
        sentAt: "2026-09-22T21:56:00.000Z",
        recipientCount: 2,
        recipientEmails: ["stub@x.com", "real@x.com"],
        eventSlug: SLUG,
        eventId: "ev1",
        eventTitle: "Dirigeants",
        source: "places_available",
        updatedAt: "2026-09-22T21:56:00.000Z",
      },
      events: [
        event({
          id: "ev1",
          slug: SLUG,
          title: "Dirigeants",
          startsAt: "2026-09-24T02:00:00.000Z",
          responseMode: "interest",
        }),
      ],
      participations: [
        part({
          id: "p1",
          eventId: "ev1",
          email: "stub@x.com",
          status: "invited",
          placesAvailableSentAt: "2026-09-22T21:56:00.000Z",
        }),
        part({
          id: "p2",
          eventId: "ev1",
          email: "real@x.com",
          status: "invited",
          placesAvailableSentAt: "2026-09-22T21:56:00.000Z",
        }),
      ],
      respondents: [],
      prospects: [],
      waitlistByEmail: new Map([
        [
          "stub@x.com",
          {
            email: "stub@x.com",
            fullName: "Auto Stub",
            company: "",
            source: "la-mesa-places-available",
            profileComplete: false,
          },
        ],
        [
          "real@x.com",
          {
            email: "real@x.com",
            fullName: "Real Member",
            company: "",
            source: "la-mesa-registration",
            profileComplete: true,
          },
        ],
      ]),
    });

    expect(summary.registered).toBe(1);
    expect(summary.registeredComplete).toBe(1);
    expect(summary.registeredExpress).toBe(0);
    expect(summary.recipients.find((r) => r.email === "stub@x.com")?.signupKind).toBeNull();
    expect(summary.recipients.find((r) => r.email === "real@x.com")?.signupKind).toBe(
      "complete",
    );
  });
});

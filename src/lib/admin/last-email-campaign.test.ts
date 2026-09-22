import { describe, expect, it } from "vitest";
import {
  buildLastEmailResultsSummary,
  inferLastEmailCampaignFromEvents,
  inferLastEmailCampaignFromProspects,
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
    expect(summary.yesGuests.map((g) => g.email)).toEqual(["a@x.com"]);
    expect(summary.recipientCount).toBe(3);
  });
});

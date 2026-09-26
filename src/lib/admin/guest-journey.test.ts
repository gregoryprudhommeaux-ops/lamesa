import { describe, expect, it } from "vitest";
import { resolveGuestJourneyStage } from "./guest-journey";
import type { AdminEventParticipation } from "@/lib/types/events";

function part(
  overrides: Partial<AdminEventParticipation> & Pick<AdminEventParticipation, "id" | "email">,
): AdminEventParticipation {
  return {
    eventId: "e1",
    status: "invited",
    statusSource: "admin",
    ...overrides,
  };
}

describe("resolveGuestJourneyStage", () => {
  it("maps the dinner journey from selected → paid → present → surveyed", () => {
    expect(resolveGuestJourneyStage(part({ id: "1", email: "a@x.com" })).id).toBe("selected");
    expect(
      resolveGuestJourneyStage(
        part({ id: "2", email: "a@x.com", saveTheDateSentAt: "2026-09-01T00:00:00.000Z" }),
      ).id,
    ).toBe("std_sent");
    expect(
      resolveGuestJourneyStage(
        part({
          id: "3",
          email: "a@x.com",
          status: "attending",
          saveTheDateSentAt: "2026-09-01T00:00:00.000Z",
        }),
      ).id,
    ).toBe("interested");
    expect(
      resolveGuestJourneyStage(
        part({
          id: "4",
          email: "a@x.com",
          status: "attending",
          calendarInviteSentAt: "2026-09-10T00:00:00.000Z",
        }),
      ).id,
    ).toBe("to_pay");
    expect(
      resolveGuestJourneyStage(
        part({ id: "5", email: "a@x.com", status: "confirmed" }),
      ).id,
    ).toBe("paid");
    expect(
      resolveGuestJourneyStage(
        part({
          id: "6",
          email: "a@x.com",
          status: "confirmed",
          checkedInAt: "2026-09-20T02:00:00.000Z",
        }),
      ).id,
    ).toBe("checked_in");
    expect(
      resolveGuestJourneyStage(
        part({
          id: "7",
          email: "a@x.com",
          status: "confirmed",
          checkedInAt: "2026-09-20T02:00:00.000Z",
          satisfactionSurvey: {
            venueQuality: 5,
            menuQuality: 5,
            guestsQuality: 5,
            wouldReturn: 5,
            submittedAt: "2026-09-21T00:00:00.000Z",
          },
        }),
      ).id,
    ).toBe("surveyed");
  });

  it("labels organizer and complimentary seats", () => {
    expect(
      resolveGuestJourneyStage(
        part({ id: "o", email: "g@x.com", isOrganizer: true, status: "confirmed" }),
      ).id,
    ).toBe("organizer");
    expect(
      resolveGuestJourneyStage(part({ id: "c", email: "c@x.com", status: "comped" })).label,
    ).toBe("Invité (offert)");
  });
});

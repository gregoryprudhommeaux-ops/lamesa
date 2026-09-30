import { describe, expect, it } from "vitest";
import { suggestOpsPhase } from "./suggest-ops-phase";
import type { AdminEventParticipation } from "@/lib/types/events";

const baseEvent = {
  title: "Dîner test",
  startsAt: "2026-10-01T19:30:00.000Z",
  venueName: "",
  address: "",
  status: "draft" as const,
  responseMode: "interest" as const,
  capacity: 14,
};

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

describe("suggestOpsPhase", () => {
  it("points to prep when title/date missing", () => {
    const result = suggestOpsPhase({
      event: { ...baseEvent, title: "" },
      draft: { title: "", eventDate: "" },
      participations: [],
    });
    expect(result.phaseId).toBe("prep");
    expect(result.nextBestAction.id).toBe("fill_basics");
    expect(result.blockers.length).toBeGreaterThan(0);
  });

  it("interest: empty roster → audience before STD", () => {
    const result = suggestOpsPhase({
      event: baseEvent,
      draft: { title: "Dîner test", eventDate: "2026-10-01" },
      participations: [],
    });
    expect(result.phaseId).toBe("audience");
    expect(result.nextBestAction.id).toBe("add_audience");
  });

  it("interest: suggests send STD when roster ready and STD not sent", () => {
    const result = suggestOpsPhase({
      event: baseEvent,
      draft: { title: "Dîner test", eventDate: "2026-10-01" },
      participations: [part({ id: "1", email: "a@x.com" })],
    });
    expect(result.phaseId).toBe("save_the_date");
    expect(result.nextBestAction.id).toBe("send_std");
    expect(result.kpis.stdSent).toBe(false);
  });

  it("interest: after STD, unpaid formal invites → payment", () => {
    const result = suggestOpsPhase({
      event: { ...baseEvent, saveTheDateSentAt: "2026-09-01T00:00:00.000Z", venueName: "X" },
      participations: [
        part({
          id: "1",
          email: "a@x.com",
          calendarInviteSentAt: "2026-09-10T00:00:00.000Z",
          status: "attending",
        }),
        part({
          id: "2",
          email: "b@x.com",
          calendarInviteSentAt: "2026-09-10T00:00:00.000Z",
          status: "confirmed",
        }),
      ],
    });
    expect(result.phaseId).toBe("payment");
    expect(result.nextBestAction.id).toBe("payment_relance");
    expect(result.kpis.unpaidAfterInvite).toBe(1);
    expect(result.kpis.paid).toBe(1);
  });

  it("interest: STD sent, no formal invites → qualify (not skip to formal)", () => {
    const result = suggestOpsPhase({
      event: { ...baseEvent, saveTheDateSentAt: "2026-09-01T00:00:00.000Z" },
      participations: [part({ id: "1", email: "a@x.com", saveTheDateSentAt: "2026-09-01T00:00:00.000Z" })],
    });
    expect(result.phaseId).toBe("qualify");
    expect(result.nextBestAction.id).toBe("qualify_responses");
    expect(result.nextBestAction.phaseId).toBe("qualify");
  });

  it("interest: STD sent + OUI pending formal → formal invite", () => {
    const result = suggestOpsPhase({
      event: { ...baseEvent, saveTheDateSentAt: "2026-09-01T00:00:00.000Z" },
      participations: [part({ id: "1", email: "a@x.com", saveTheDateSentAt: "2026-09-01T00:00:00.000Z" })],
      interestSignals: { yesPendingFormal: 3 },
    });
    expect(result.phaseId).toBe("formal");
    expect(result.nextBestAction.id).toBe("formal_invite");
    expect(result.nextBestAction.label).toContain("3 OUI");
  });

  it("interest: unpaid still beats more OUI pending", () => {
    const result = suggestOpsPhase({
      event: { ...baseEvent, saveTheDateSentAt: "2026-09-01T00:00:00.000Z", venueName: "X" },
      participations: [
        part({
          id: "1",
          email: "a@x.com",
          calendarInviteSentAt: "2026-09-10T00:00:00.000Z",
          status: "attending",
        }),
      ],
      interestSignals: { yesPendingFormal: 2 },
    });
    expect(result.phaseId).toBe("payment");
    expect(result.nextBestAction.id).toBe("payment_relance");
  });

  it("interest: declared SPEI unpaid → confirm declared NBA (not email relance)", () => {
    const result = suggestOpsPhase({
      event: { ...baseEvent, saveTheDateSentAt: "2026-09-01T00:00:00.000Z", venueName: "X" },
      participations: [
        part({
          id: "1",
          email: "a@x.com",
          calendarInviteSentAt: "2026-09-10T00:00:00.000Z",
          status: "invited",
          paymentDeclaredAt: "2026-09-20T12:00:00.000Z",
        }),
        part({
          id: "2",
          email: "b@x.com",
          calendarInviteSentAt: "2026-09-10T00:00:00.000Z",
          status: "attending",
        }),
      ],
    });
    expect(result.phaseId).toBe("payment");
    expect(result.nextBestAction.id).toBe("payment_confirm_declared");
    expect(result.kpis.paymentDeclared).toBe(1);
    expect(result.nextBestAction.label).toContain("1");
  });

  it("interest: after at least one formal invite and unpaid → payment", () => {
    const result = suggestOpsPhase({
      event: { ...baseEvent, saveTheDateSentAt: "2026-09-01T00:00:00.000Z", venueName: "X" },
      participations: [
        part({
          id: "1",
          email: "a@x.com",
          calendarInviteSentAt: "2026-09-10T00:00:00.000Z",
          status: "attending",
        }),
      ],
    });
    expect(result.phaseId).toBe("payment");
  });

  it("soir J: unpaid clear + held seats → check-in (not feedback)", () => {
    const startsAt = "2026-10-01T01:00:00.000Z";
    const nowMs = new Date("2026-10-01T02:00:00.000Z").getTime();
    const result = suggestOpsPhase({
      event: {
        ...baseEvent,
        startsAt,
        saveTheDateSentAt: "2026-09-01T00:00:00.000Z",
        venueName: "Casa",
        capacity: 14,
        status: "published",
      },
      participations: [
        part({
          id: "1",
          email: "a@x.com",
          status: "confirmed",
          calendarInviteSentAt: "2026-09-10T00:00:00.000Z",
        }),
        part({
          id: "2",
          email: "b@x.com",
          status: "confirmed",
          calendarInviteSentAt: "2026-09-10T00:00:00.000Z",
        }),
        // Fill capacity so dinner_prep wouldn't otherwise win
        ...Array.from({ length: 12 }, (_, i) =>
          part({
            id: `f${i}`,
            email: `f${i}@x.com`,
            status: "confirmed",
            calendarInviteSentAt: "2026-09-10T00:00:00.000Z",
          }),
        ),
      ],
      nowMs,
    });
    expect(result.phaseId).toBe("checkin");
    expect(result.nextBestAction.id).toBe("door_checkin");
    expect(result.kpis.awaitingCheckin).toBe(14);
  });

  it("rsvp: empty roster → audience", () => {
    const result = suggestOpsPhase({
      event: { ...baseEvent, responseMode: "rsvp", title: "X", startsAt: "2026-10-01T19:00:00.000Z" },
      draft: { title: "X", eventDate: "2026-10-01" },
      participations: [],
    });
    expect(result.phaseId).toBe("audience");
    expect(result.nextBestAction.id).toBe("add_invitees");
  });
});

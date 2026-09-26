import { describe, expect, it } from "vitest";
import {
  pickLastPastEvent,
  resolveDashboardMoment,
} from "./dashboard-moment";

describe("resolveDashboardMoment", () => {
  const now = Date.parse("2026-09-26T12:00:00.000Z");

  it("prefers post-event when dinner was yesterday even if older places blast exists", () => {
    const moment = resolveDashboardMoment({
      nowMs: now,
      pastEvent: {
        eventId: "dinner",
        startsAt: "2026-09-25T19:30:00.000Z",
        surveySentCount: 12,
        surveyResponseCount: 3,
      },
      lastEmail: {
        templateKey: "places_available:slug",
        sentAt: "2026-09-22T21:56:00.000Z",
        eventId: "dinner",
      },
      nextEvent: null,
    });
    expect(moment.kind).toBe("post_event");
  });

  it("uses email pulse when last blast is RSVP and no recent past dinner", () => {
    const moment = resolveDashboardMoment({
      nowMs: now,
      pastEvent: {
        eventId: "old",
        startsAt: "2026-08-01T19:00:00.000Z",
        surveySentCount: 0,
        surveyResponseCount: 0,
      },
      lastEmail: {
        templateKey: "places_available:x",
        sentAt: "2026-09-22T15:00:00.000Z",
        eventId: "next",
      },
      nextEvent: { eventId: "next", startsAt: "2026-10-01T19:00:00.000Z" },
    });
    expect(moment.kind).toBe("email_pulse");
  });

  it("keeps post_event when satisfaction mail is for the past dinner", () => {
    const moment = resolveDashboardMoment({
      nowMs: now,
      pastEvent: {
        eventId: "dinner",
        startsAt: "2026-09-25T19:30:00.000Z",
        surveySentCount: 12,
        surveyResponseCount: 1,
      },
      lastEmail: {
        templateKey: "satisfaction_survey",
        sentAt: "2026-09-26T10:00:00.000Z",
        eventId: "dinner",
      },
      nextEvent: null,
    });
    expect(moment.kind).toBe("post_event");
    expect(moment.label).toContain("satisfaction");
  });

  it("falls back to next dinner then idle", () => {
    expect(
      resolveDashboardMoment({
        nowMs: now,
        pastEvent: null,
        lastEmail: null,
        nextEvent: { eventId: "n", startsAt: "2026-10-01T19:00:00.000Z" },
      }).kind,
    ).toBe("next_dinner");

    expect(
      resolveDashboardMoment({
        nowMs: now,
        pastEvent: null,
        lastEmail: null,
        nextEvent: null,
      }).kind,
    ).toBe("idle");
  });
});

describe("pickLastPastEvent", () => {
  it("returns the most recent past event", () => {
    const pick = pickLastPastEvent(
      [
        { id: "a", startsAt: "2026-09-01T00:00:00.000Z" },
        { id: "b", startsAt: "2026-09-25T19:00:00.000Z" },
        { id: "c", startsAt: "2026-10-01T19:00:00.000Z" },
      ],
      Date.parse("2026-09-26T12:00:00.000Z"),
    );
    expect(pick?.id).toBe("b");
  });
});

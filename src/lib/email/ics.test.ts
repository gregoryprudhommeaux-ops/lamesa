import { describe, expect, it } from "vitest";
import {
  buildAddToCalendarIcs,
  buildCalendarInviteIcs,
  buildGoogleCalendarUrl,
  plainTextFromRichMarkers,
  toIcsUtc,
} from "@/lib/email/ics";
import {
  signRsvpToken,
  signSurveyToken,
  verifyRsvpToken,
  verifySurveyToken,
} from "@/lib/email/rsvp-token";

describe("ics", () => {
  it("formats utc timestamps", () => {
    expect(toIcsUtc("2026-07-20T19:00:00.000Z")).toBe("20260720T190000Z");
  });

  it("builds METHOD:REQUEST calendar", () => {
    const ics = buildCalendarInviteIcs({
      uid: "evt-part@lamesa",
      title: "LA MESA — Test",
      description: "Hello",
      location: "Somewhere",
      startsAt: "2026-07-20T19:00:00.000Z",
      organizerEmail: "host@example.com",
      attendeeEmail: "guest@example.com",
      attendeeName: "Guest",
    });
    expect(ics).toContain("METHOD:REQUEST");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:evt-part@lamesa");
    expect(ics).toContain("ATTENDEE;");
    expect(ics).toContain("BEGIN:VALARM");
    expect(ics).toContain("TRIGGER:-P7D");
    expect(ics).toContain("TRIGGER:-PT36H");
    expect(ics).toContain("TRIGGER:-PT90M");
  });

  it("builds METHOD:PUBLISH hold for interest YES", () => {
    const ics = buildAddToCalendarIcs({
      uid: "interest-evt@lamesa",
      title: "LA MESA | Dîner des Dirigeants et Entrepreneurs Français (GDL)",
      description: "Contexte du dîner",
      location: "À préciser",
      startsAt: "2026-09-25T02:00:00.000Z",
      endsAt: "2026-09-25T05:00:00.000Z",
      organizerEmail: "host@example.com",
    });
    expect(ics).toContain("METHOD:PUBLISH");
    expect(ics).toContain("STATUS:TENTATIVE");
    expect(ics).toContain("SUMMARY:LA MESA | Dîner des Dirigeants et Entrepreneurs Français (GDL)");
    expect(ics).toContain("LOCATION:À préciser");
    expect(ics).not.toContain("ATTENDEE;");
  });

  it("builds Google Calendar template URLs", () => {
    const url = buildGoogleCalendarUrl({
      title: "LA MESA | Test",
      description: "Hello",
      location: "À préciser",
      startsAt: "2026-09-25T02:00:00.000Z",
      endsAt: "2026-09-25T05:00:00.000Z",
    });
    expect(url).toContain("calendar.google.com/calendar/render");
    expect(url).toContain("action=TEMPLATE");
    expect(url).toContain("20260925T020000Z");
  });

  it("strips bold markers for calendar descriptions", () => {
    expect(plainTextFromRichMarkers("Soirée du <bold>24 septembre</bold>")).toBe(
      "Soirée du 24 septembre",
    );
  });
});

describe("rsvp-token", () => {
  it("round-trips", () => {
    const token = signRsvpToken({
      participationId: "p1",
      eventId: "e1",
      email: "a@b.com",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const payload = verifyRsvpToken(token);
    expect(payload?.participationId).toBe("p1");
    expect(payload?.eventId).toBe("e1");
    expect(payload?.email).toBe("a@b.com");
  });

  it("round-trips survey tokens separately from rsvp", () => {
    const survey = signSurveyToken({
      participationId: "p1",
      eventId: "e1",
      email: "a@b.com",
    });
    expect(verifySurveyToken(survey)?.purpose).toBe("survey");
    expect(verifyRsvpToken(survey)).toBeNull();

    const rsvp = signRsvpToken({
      participationId: "p1",
      eventId: "e1",
      email: "a@b.com",
    });
    expect(verifyRsvpToken(rsvp)?.purpose).toBe("rsvp");
    expect(verifySurveyToken(rsvp)).toBeNull();
  });

  it("rejects tampered token", () => {
    const token = signRsvpToken({
      participationId: "p1",
      eventId: "e1",
      email: "a@b.com",
    });
    expect(verifyRsvpToken(`${token}x`)).toBeNull();
  });
});

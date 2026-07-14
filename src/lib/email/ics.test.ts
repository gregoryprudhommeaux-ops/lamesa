import { describe, expect, it } from "vitest";
import { buildCalendarInviteIcs, toIcsUtc } from "@/lib/email/ics";
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

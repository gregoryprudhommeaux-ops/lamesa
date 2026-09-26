import { describe, expect, it } from "vitest";
import { buildAudienceFitIndex, resolveAudienceFitSignals } from "./audience-fit";
import type { AdminEventParticipation, WaitlistRegistration } from "@/lib/types/events";

function member(
  overrides: Partial<WaitlistRegistration> & Pick<WaitlistRegistration, "id" | "email" | "fullName">,
): WaitlistRegistration {
  return {
    company: "Acme",
    phone: "+52 1 33 0000 0000",
    sector: "tech",
    position: "ceo",
    city: "Guadalajara",
    linkedinUrl: "https://linkedin.com/in/x",
    invitationMotivation: "Network",
    extraActivities: ["sport"],
    canBring: "Intros",
    isSeeking: "Clients",
    locale: "fr",
    source: "web",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function part(
  overrides: Partial<AdminEventParticipation> &
    Pick<AdminEventParticipation, "id" | "email" | "eventId" | "status">,
): AdminEventParticipation {
  return { statusSource: "admin", ...overrides };
}

describe("resolveAudienceFitSignals", () => {
  it("flags never-invited members positively", () => {
    const fit = resolveAudienceFitSignals({
      member: member({ id: "1", email: "a@x.com", fullName: "Ada" }),
      participations: [],
      eventCity: "Guadalajara",
    });
    expect(fit.signals.map((s) => s.id)).toContain("never_invited");
    expect(fit.signals.map((s) => s.id)).toContain("same_city");
    expect(fit.hint).toContain("Jamais invité");
  });

  it("shows returning guests and high sat", () => {
    const fit = resolveAudienceFitSignals({
      member: member({ id: "1", email: "a@x.com", fullName: "Ada", city: "CDMX" }),
      participations: [
        part({ id: "p1", email: "a@x.com", eventId: "e1", status: "confirmed" }),
        part({
          id: "p2",
          email: "a@x.com",
          eventId: "e2",
          status: "confirmed",
          satisfactionSurvey: {
            venueQuality: 5,
            menuQuality: 5,
            guestsQuality: 5,
            wouldReturn: 5,
            wouldRecommend: 5,
            submittedAt: "2026-09-01T00:00:00.000Z",
          },
        }),
      ],
      eventCity: "Guadalajara",
    });
    expect(fit.signals.map((s) => s.id)).toContain("returning");
    expect(fit.signals.some((s) => s.id === "high_sat")).toBe(true);
  });

  it("cautions when invited but never paid", () => {
    const fit = resolveAudienceFitSignals({
      member: member({ id: "1", email: "a@x.com", fullName: "Ada" }),
      participations: [
        part({ id: "p1", email: "a@x.com", eventId: "e1", status: "invited" }),
      ],
    });
    expect(fit.signals.map((s) => s.id)).toContain("invited_never_paid");
  });
});

describe("buildAudienceFitIndex", () => {
  it("indexes by email", () => {
    const index = buildAudienceFitIndex({
      waitlist: [member({ id: "1", email: "A@X.com", fullName: "Ada" })],
      participations: [],
      eventCity: "Guadalajara",
    });
    expect(index.get("a@x.com")?.hint).toContain("Jamais invité");
  });
});

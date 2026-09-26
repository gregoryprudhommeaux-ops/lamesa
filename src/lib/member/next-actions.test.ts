import { describe, expect, it } from "vitest";
import { resolveMemberNextActions } from "./next-actions";
import type { AdminEvent, AdminEventParticipation, WaitlistRegistration } from "@/lib/types/events";

function event(partial: Partial<AdminEvent> & Pick<AdminEvent, "id" | "slug" | "startsAt">): AdminEvent {
  return {
    title: partial.title ?? partial.slug,
    status: "published",
    responseMode: "interest",
    ...partial,
  } as AdminEvent;
}

function part(
  partial: Partial<AdminEventParticipation> & Pick<AdminEventParticipation, "id" | "eventId" | "status">,
): AdminEventParticipation & { id: string } {
  return {
    email: "m@ex.com",
    statusSource: "admin",
    ...partial,
  };
}

describe("resolveMemberNextActions", () => {
  const now = Date.parse("2026-09-26T12:00:00.000Z");
  const base = {
    email: "m@ex.com",
    locale: "fr" as const,
    siteBaseUrl: "https://lamesasecreta.com",
    nowMs: now,
  };

  it("prioritizes pending survey over unpaid invite", () => {
    const past = event({
      id: "past",
      slug: "past",
      title: "Hier",
      startsAt: "2026-09-25T19:00:00.000Z",
    });
    const next = event({
      id: "next",
      slug: "next",
      title: "Prochain",
      startsAt: "2026-10-10T19:00:00.000Z",
      priceMxn: 2000,
    });
    const actions = resolveMemberNextActions({
      ...base,
      profile: { id: "w1", fullName: "M", email: "m@ex.com" } as WaitlistRegistration,
      eventsById: new Map([
        ["past", past],
        ["next", next],
      ]),
      participations: [
        part({
          id: "p1",
          eventId: "past",
          status: "confirmed",
          satisfactionSurveySentAt: "2026-09-26T08:00:00.000Z",
        }),
        part({
          id: "p2",
          eventId: "next",
          status: "invited",
          calendarInviteSentAt: "2026-09-20T12:00:00.000Z",
        }),
      ],
    });
    expect(actions[0]?.kind).toBe("fill_survey");
    expect(actions[0]?.href).toContain("/fr/satisfaction?token=");
    const pay = actions.find((a) => a.kind === "pay_access");
    expect(pay?.href).toContain("/e/");
    expect(pay?.href).toContain("#access");
  });

  it("asks to complete an incomplete profile", () => {
    const actions = resolveMemberNextActions({
      ...base,
      profile: {
        id: "w1",
        fullName: "M",
        email: "m@ex.com",
      } as WaitlistRegistration,
      eventsById: new Map(),
      participations: [],
    });
    expect(actions[0]?.kind).toBe("complete_profile");
    expect(actions[0]?.href).toContain("tab=profil");
  });

  it("surfaces next confirmed dinner when nothing urgent", () => {
    const next = event({
      id: "next",
      slug: "next",
      title: "Prochain",
      startsAt: "2026-10-10T19:00:00.000Z",
    });
    const actions = resolveMemberNextActions({
      ...base,
      profile: {
        id: "w1",
        fullName: "Marie Test",
        email: "m@ex.com",
        phone: "+5215512345678",
        company: "Acme",
        sector: "tech",
        position: "ceo",
        city: "Guadalajara",
        linkedinUrl: "https://www.linkedin.com/in/marie",
        invitationMotivation: "network",
        extraActivities: ["sport"],
        canBring: "intros",
        isSeeking: "peers",
      } as WaitlistRegistration,
      eventsById: new Map([["next", next]]),
      participations: [
        part({ id: "p1", eventId: "next", status: "confirmed" }),
      ],
    });
    expect(actions.some((a) => a.kind === "open_event")).toBe(true);
    expect(actions.some((a) => a.kind === "complete_profile")).toBe(false);
  });
});

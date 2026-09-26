import { describe, expect, it } from "vitest";
import { resolvePublicEventGuestSurface } from "./public-event-guest-surface";

describe("resolvePublicEventGuestSurface", () => {
  it("defaults to interest form", () => {
    expect(
      resolvePublicEventGuestSurface({ responseMode: "interest" }).surface,
    ).toBe("interest_form");
  });

  it("shows interest_done when OUI/NON already recorded", () => {
    const r = resolvePublicEventGuestSurface({
      responseMode: "interest",
      interestResponse: "yes",
    });
    expect(r.surface).toBe("interest_done");
    expect(r.interestResponse).toBe("yes");
  });

  it("prioritizes pay_access after formal invite (even if OUI exists)", () => {
    const r = resolvePublicEventGuestSurface({
      responseMode: "interest",
      interestResponse: "yes",
      participation: {
        id: "p1",
        status: "invited",
        calendarInviteSentAt: "2026-09-20T00:00:00.000Z",
      },
    });
    expect(r.surface).toBe("pay_access");
    expect(r.participationId).toBe("p1");
  });

  it("shows confirmed when Payé / Invité", () => {
    expect(
      resolvePublicEventGuestSurface({
        responseMode: "interest",
        interestResponse: "yes",
        participation: {
          id: "p1",
          status: "confirmed",
          calendarInviteSentAt: "2026-09-20T00:00:00.000Z",
        },
      }).surface,
    ).toBe("confirmed");
    expect(
      resolvePublicEventGuestSurface({
        responseMode: "interest",
        participation: { id: "p2", status: "comped" },
      }).surface,
    ).toBe("confirmed");
  });

  it("does not ask for payment when not_attending", () => {
    expect(
      resolvePublicEventGuestSurface({
        responseMode: "interest",
        interestResponse: "no",
        participation: {
          id: "p1",
          status: "not_attending",
          calendarInviteSentAt: "2026-09-20T00:00:00.000Z",
        },
      }).surface,
    ).toBe("interest_done");
  });

  it("rsvp mode: formal invite unpaid → pay_access", () => {
    expect(
      resolvePublicEventGuestSurface({
        responseMode: "rsvp",
        participation: {
          id: "p1",
          status: "invited",
          calendarInviteSentAt: "2026-09-20T00:00:00.000Z",
        },
      }).surface,
    ).toBe("pay_access");
  });
});

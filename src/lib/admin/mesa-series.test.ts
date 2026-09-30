import { describe, expect, it } from "vitest";
import { buildMesaSeries } from "./mesa-series";
import type { AdminEvent, AdminEventParticipation } from "@/lib/types/events";

const NOW = new Date("2026-09-26T12:00:00.000Z").getTime();

function event(
  overrides: Partial<AdminEvent> & Pick<AdminEvent, "id" | "slug" | "title" | "startsAt">,
): AdminEvent {
  return {
    address: "",
    status: "published",
    responseMode: "interest",
    priceMxn: 1300,
    capacity: 10,
    ...overrides,
  };
}

function part(
  overrides: Partial<AdminEventParticipation> &
    Pick<AdminEventParticipation, "id" | "eventId" | "email" | "status">,
): AdminEventParticipation {
  return { statusSource: "admin", ...overrides };
}

describe("buildMesaSeries", () => {
  it("sums CA across past dinners and excludes drafts / future", () => {
    const series = buildMesaSeries(
      [
        event({
          id: "e1",
          slug: "e1",
          title: "Dîner 1",
          startsAt: "2026-09-01T02:00:00.000Z",
          priceMxn: 1300,
          priceIncludesService: false,
          priceIncludesIva: true,
        }),
        event({
          id: "e2",
          slug: "e2",
          title: "Dîner 2",
          startsAt: "2026-09-20T02:00:00.000Z",
          priceMxn: 1300,
          priceIncludesService: false,
          priceIncludesIva: true,
        }),
        event({
          id: "future",
          slug: "future",
          title: "Futur",
          startsAt: "2026-10-10T02:00:00.000Z",
        }),
        event({
          id: "draft",
          slug: "draft",
          title: "Brouillon",
          startsAt: "2026-09-10T02:00:00.000Z",
          status: "draft",
        }),
      ],
      [
        part({
          id: "p1",
          eventId: "e1",
          email: "a@x.com",
          status: "confirmed",
        }),
        part({
          id: "p2",
          eventId: "e2",
          email: "b@x.com",
          status: "confirmed",
        }),
        part({
          id: "p3",
          eventId: "e2",
          email: "c@x.com",
          status: "confirmed",
        }),
        part({
          id: "org",
          eventId: "e2",
          email: "org@x.com",
          fullName: "Gregory Prudhommeaux",
          status: "confirmed",
          isOrganizer: true,
        }),
      ],
      NOW,
    );

    expect(series.dinnerCount).toBe(2);
    expect(series.dinners[0]?.eventId).toBe("e2");
    expect(series.totalPaidSeats).toBe(3);
    // 3 × (1300 + 208) = 4524
    expect(series.revenueMxn).toBe(4524);
    expect(series.dinners[0]?.paidSeats).toBe(2);
    expect(series.dinners[0]?.complimentarySeats).toBe(1);
  });
});

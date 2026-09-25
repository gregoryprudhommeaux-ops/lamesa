import { describe, expect, it } from "vitest";
import {
  countRosterFilters,
  filterParticipationsForRoster,
} from "./event-participant-roster";
import type { AdminEventParticipation } from "@/lib/types/events";

function p(
  overrides: Partial<AdminEventParticipation> & Pick<AdminEventParticipation, "id" | "email">,
): AdminEventParticipation {
  return {
    eventId: "e1",
    status: "invited",
    statusSource: "admin",
    ...overrides,
  };
}

describe("event-participant-roster filters", () => {
  const rows = [
    p({ id: "1", email: "a@x.com", status: "waitlist" }),
    p({ id: "2", email: "b@x.com", status: "invited" }),
    p({
      id: "3",
      email: "c@x.com",
      status: "attending",
      calendarInviteSentAt: "2026-01-01T00:00:00.000Z",
    }),
    p({ id: "4", email: "d@x.com", status: "confirmed" }),
    p({ id: "5", email: "e@x.com", status: "not_attending" }),
    p({ id: "6", email: "org@x.com", status: "confirmed", isOrganizer: true }),
  ];

  it("excludes organizers from all filters", () => {
    expect(filterParticipationsForRoster(rows, "all")).toHaveLength(5);
    expect(countRosterFilters(rows).all).toBe(5);
  });

  it("filters unpaid after formal invite", () => {
    const unpaid = filterParticipationsForRoster(rows, "unpaid_invite");
    expect(unpaid.map((x) => x.id)).toEqual(["3"]);
  });

  it("filters paid and waitlist", () => {
    expect(filterParticipationsForRoster(rows, "paid").map((x) => x.id)).toEqual(["4"]);
    expect(filterParticipationsForRoster(rows, "waitlist").map((x) => x.id)).toEqual(["1"]);
  });
});

import { describe, expect, it } from "vitest";
import { computeDashboardStats } from "./dashboard-stats";

describe("dashboard-stats", () => {
  const nowMs = new Date("2026-06-15T12:00:00.000Z").getTime();

  it("computes all four counters from mixed invitations", () => {
    const invitations = [
      {
        status: "confirmed",
        event: { startsAt: "2026-01-10T18:00:00.000Z" },
      },
      {
        status: "invited",
        event: { startsAt: "2026-03-01T18:00:00.000Z" },
      },
      {
        status: "not_attending",
        event: { startsAt: "2026-02-01T18:00:00.000Z" },
      },
      {
        status: "invited",
        event: { startsAt: "2026-08-01T18:00:00.000Z" },
      },
      {
        status: "attending",
        event: { startsAt: "2026-09-15T18:00:00.000Z" },
      },
    ];

    const stats = computeDashboardStats({
      invitations,
      friendsReferred: 3,
      nowMs,
    });

    expect(stats).toEqual({
      invitationsReceived: 5,
      pastParticipations: 2,
      upcomingInvitations: 2,
      friendsReferred: 3,
    });
  });
});

import { describe, expect, it } from "vitest";
import { buildOpsQueues } from "./ops-queues";
import type { AdminEventParticipation, WaitlistRegistration } from "@/lib/types/events";

const member = (
  overrides: Partial<WaitlistRegistration> & Pick<WaitlistRegistration, "id" | "email">,
): WaitlistRegistration => ({
  fullName: "Test",
  linkedinUrl: "",
  company: "",
  sector: "tech",
  position: "founder",
  extraActivities: [],
  city: "Guadalajara",
  phone: "+521111111111",
  invitationMotivation: "x".repeat(20),
  locale: "es",
  source: "waitlist",
  tags: [],
  createdAt: "2026-07-01T00:00:00.000Z",
  profileComplete: true,
  ...overrides,
});

describe("buildOpsQueues", () => {
  it("buckets incomplete, never invited, review, priority, no-show", () => {
    const members = [
      member({
        id: "express",
        email: "e@example.com",
        profileComplete: false,
        company: "",
        sector: "",
        position: "",
        invitationMotivation: "",
        createdAt: "2026-07-10T00:00:00.000Z",
      }),
      member({
        id: "ready",
        email: "r@example.com",
        createdAt: "2026-07-09T00:00:00.000Z",
      }),
      member({
        id: "review",
        email: "v@example.com",
        opsPriority: "review",
        createdAt: "2026-07-08T00:00:00.000Z",
      }),
      member({
        id: "prio",
        email: "p@example.com",
        opsPriority: "priority",
        createdAt: "2026-07-07T00:00:00.000Z",
      }),
      member({
        id: "noshow",
        email: "n@example.com",
        opsTags: ["no-show"],
        createdAt: "2026-07-06T00:00:00.000Z",
      }),
    ];

    const participations: AdminEventParticipation[] = [
      {
        id: "part-1",
        eventId: "ev-1",
        email: "v@example.com",
        contactId: "review",
        status: "invited",
        statusSource: "admin",
      },
    ];

    const queues = buildOpsQueues({ members, participations });

    expect(queues.incomplete.map((m) => m.id)).toContain("express");
    expect(queues.neverInvited.map((m) => m.id)).toEqual(
      expect.arrayContaining(["ready", "prio", "noshow"]),
    );
    expect(queues.neverInvited.map((m) => m.id)).not.toContain("review");
    expect(queues.review.map((m) => m.id)).toEqual(["review"]);
    expect(queues.priority.map((m) => m.id)).toEqual(["prio"]);
    expect(queues.noShow.map((m) => m.id)).toEqual(["noshow"]);
  });
});

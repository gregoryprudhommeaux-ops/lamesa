import { describe, expect, it } from "vitest";
import {
  planOuiParticipationUpsert,
  planOuiParticipationUpserts,
  summarizeOuiUpsertPlans,
} from "./sync-interest-oui-to-participations";

describe("planOuiParticipationUpsert", () => {
  it("creates when missing", () => {
    expect(planOuiParticipationUpsert("a@x.com", null)).toEqual({
      action: "create",
      email: "a@x.com",
    });
  });

  it("promotes waitlist and invited without formal invite", () => {
    expect(
      planOuiParticipationUpsert("a@x.com", {
        id: "1",
        email: "a@x.com",
        status: "waitlist",
      }),
    ).toMatchObject({ action: "promote", from: "waitlist" });
    expect(
      planOuiParticipationUpsert("a@x.com", {
        id: "1",
        email: "a@x.com",
        status: "invited",
      }),
    ).toMatchObject({ action: "promote", from: "invited" });
  });

  it("does not demote paid, comped, out, formal, or attending", () => {
    expect(
      planOuiParticipationUpsert("a@x.com", {
        id: "1",
        email: "a@x.com",
        status: "confirmed",
      }).action,
    ).toBe("noop");
    expect(
      planOuiParticipationUpsert("a@x.com", {
        id: "1",
        email: "a@x.com",
        status: "comped",
      }).action,
    ).toBe("noop");
    expect(
      planOuiParticipationUpsert("a@x.com", {
        id: "1",
        email: "a@x.com",
        status: "not_attending",
      }).action,
    ).toBe("noop");
    expect(
      planOuiParticipationUpsert("a@x.com", {
        id: "1",
        email: "a@x.com",
        status: "invited",
        calendarInviteSentAt: "2026-09-01",
      }).action,
    ).toBe("noop");
    expect(
      planOuiParticipationUpsert("a@x.com", {
        id: "1",
        email: "a@x.com",
        status: "attending",
      }).action,
    ).toBe("noop");
  });
});

describe("planOuiParticipationUpserts", () => {
  it("dedupes emails and summarizes", () => {
    const plans = planOuiParticipationUpserts({
      ouiEmails: ["A@x.com", "a@x.com", "b@x.com"],
      participations: [
        { id: "1", email: "b@x.com", status: "waitlist" },
      ],
    });
    expect(summarizeOuiUpsertPlans(plans)).toEqual({
      create: 1,
      promote: 1,
      noop: 0,
    });
  });
});

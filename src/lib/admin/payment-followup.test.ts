import { describe, expect, it } from "vitest";
import {
  countPaymentDeclaredUnpaid,
  defaultPaymentFilter,
  inviteMemberStatusToParticipation,
  toInviteMemberStatus,
} from "./payment-followup";

describe("toInviteMemberStatus", () => {
  it("maps confirmed / comped / out first", () => {
    expect(toInviteMemberStatus({ status: "confirmed", paymentDeclaredAt: "x" })).toBe("paid");
    expect(toInviteMemberStatus({ status: "comped" })).toBe("comped");
    expect(toInviteMemberStatus({ status: "not_attending" })).toBe("out");
  });

  it("maps paymentDeclaredAt to declared before relance", () => {
    expect(
      toInviteMemberStatus({
        status: "invited",
        paymentDeclaredAt: "2026-09-26T10:00:00.000Z",
      }),
    ).toBe("declared");
    expect(toInviteMemberStatus({ status: "invited" })).toBe("relance");
    expect(toInviteMemberStatus({ status: "attending" })).toBe("relance");
  });
});

describe("inviteMemberStatusToParticipation", () => {
  it("maps paid/comped/out and keeps declared as invited", () => {
    expect(inviteMemberStatusToParticipation("paid")).toBe("confirmed");
    expect(inviteMemberStatusToParticipation("comped")).toBe("comped");
    expect(inviteMemberStatusToParticipation("out")).toBe("not_attending");
    expect(inviteMemberStatusToParticipation("declared")).toBe("invited");
    expect(inviteMemberStatusToParticipation("relance")).toBe("invited");
  });
});

describe("defaultPaymentFilter", () => {
  it("opens on declared when any SPEI declared", () => {
    expect(defaultPaymentFilter({ declared: 2, relance: 5 })).toBe("declared");
    expect(defaultPaymentFilter({ declared: 0, relance: 3 })).toBe("relance");
    expect(defaultPaymentFilter({ declared: 0, relance: 0 })).toBe("relance");
  });
});

describe("countPaymentDeclaredUnpaid", () => {
  it("counts invited/attending with declaration after formal invite", () => {
    expect(
      countPaymentDeclaredUnpaid([
        {
          status: "invited",
          calendarInviteSentAt: "2026-09-01",
          paymentDeclaredAt: "2026-09-10",
        },
        {
          status: "confirmed",
          calendarInviteSentAt: "2026-09-01",
          paymentDeclaredAt: "2026-09-10",
        },
        {
          status: "invited",
          calendarInviteSentAt: "2026-09-01",
        },
        {
          status: "attending",
          calendarInviteSentAt: "2026-09-01",
          paymentDeclaredAt: "2026-09-11",
        },
      ]),
    ).toBe(2);
  });
});

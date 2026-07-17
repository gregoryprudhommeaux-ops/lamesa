import { describe, expect, it } from "vitest";
import {
  tableMembersToInviteEmails,
  tableMembersToPendingInvitees,
  type TableIdeaMember,
} from "./pending-invitees";

function member(overrides: Partial<TableIdeaMember> = {}): TableIdeaMember {
  return {
    id: "member-1",
    fullName: "Ana García",
    email: "ana@example.com",
    company: "Mesa Labs",
    sector: "Technology",
    position: "Founder",
    city: "Guadalajara",
    ...overrides,
  };
}

describe("tableMembersToPendingInvitees", () => {
  it("converts only primary members to waitlist pending invitees", () => {
    const primary = [member()];

    expect(tableMembersToPendingInvitees(primary)).toEqual([
      {
        email: "ana@example.com",
        fullName: "Ana García",
        companyName: "Mesa Labs",
        contactId: "member-1",
        source: "waitlist",
        inviteAs: "invited",
      },
    ]);
  });

  it("excludes members with a missing email", () => {
    const members = [member({ email: "" })];

    expect(tableMembersToPendingInvitees(members)).toEqual([]);
  });

  it("excludes members with an invalid email", () => {
    const members = [member({ email: "not-an-email" })];

    expect(tableMembersToPendingInvitees(members)).toEqual([]);
  });

  it("keeps valid members when mixed with invalid emails", () => {
    const members = [
      member({ id: "valid", email: "valid@example.com" }),
      member({ id: "invalid", email: "not-an-email" }),
    ];

    expect(tableMembersToInviteEmails(members)).toEqual([
      {
        email: "valid@example.com",
        fullName: "Ana García",
        companyName: "Mesa Labs",
        contactId: "valid",
      },
    ]);
  });
});

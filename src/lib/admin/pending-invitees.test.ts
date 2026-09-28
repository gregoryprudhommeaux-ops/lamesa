import { afterEach, describe, expect, it, vi } from "vitest";
import {
  consumePendingEventSeed,
  setPendingEventSeed,
  tableMembersToInviteEmails,
  tableMembersToPendingInvitees,
  type TableIdeaMember,
} from "./pending-invitees";

afterEach(() => {
  try {
    sessionStorage.clear();
  } catch {
    // no sessionStorage in node until stubbed
  }
  vi.unstubAllGlobals();
});

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

describe("setPendingEventSeed / consumePendingEventSeed", () => {
  it("stores title, city, subtitle, date and format for Nouveau dîner", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => store.clear(),
    });

    setPendingEventSeed({
      title: "CEO et Entrepreneurs Français à Guadalajara",
      city: "Guadalajara",
      format: "dinner",
      subtitle: "Pairs dirigeants",
      date: "2026-11-15",
    });

    expect(consumePendingEventSeed()).toEqual({
      invitees: [],
      title: "CEO et Entrepreneurs Français à Guadalajara",
      city: "Guadalajara",
      format: "dinner",
      subtitle: "Pairs dirigeants",
      date: "2026-11-15",
    });
    // consumed once
    expect(consumePendingEventSeed()).toEqual({ invitees: [] });
  });
});

import { describe, expect, it } from "vitest";
import {
  countCheckin,
  filterCheckinRows,
  isCheckinEligible,
  isCheckedIn,
} from "./checkin";
import type { AdminEventParticipation } from "@/lib/types/events";

function row(
  partial: Partial<AdminEventParticipation> & Pick<AdminEventParticipation, "id" | "status">,
): AdminEventParticipation {
  return {
    eventId: "e1",
    email: `${partial.id}@ex.com`,
    fullName: partial.fullName ?? partial.id,
    statusSource: "admin",
    ...partial,
  };
}

describe("checkin helpers", () => {
  it("paid and complimentary non-organizer seats are eligible", () => {
    expect(isCheckinEligible(row({ id: "a", status: "confirmed" }))).toBe(true);
    expect(isCheckinEligible(row({ id: "comp", status: "comped" }))).toBe(true);
    expect(isCheckinEligible(row({ id: "b", status: "invited" }))).toBe(false);
    expect(
      isCheckinEligible(row({ id: "c", status: "confirmed", isOrganizer: true })),
    ).toBe(false);
  });

  it("counts present vs pending", () => {
    const rows = [
      row({ id: "a", status: "confirmed", checkedInAt: "2026-09-25T19:00:00.000Z" }),
      row({ id: "b", status: "confirmed" }),
      row({ id: "comp", status: "comped" }),
      row({ id: "c", status: "invited" }),
    ];
    expect(countCheckin(rows)).toEqual({ paid: 3, present: 1, pending: 2 });
    expect(filterCheckinRows(rows, "pending").map((p) => p.id)).toEqual(["b", "comp"]);
    expect(isCheckedIn(rows[0]!)).toBe(true);
  });
});

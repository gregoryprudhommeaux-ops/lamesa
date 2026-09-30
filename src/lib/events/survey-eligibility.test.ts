import { describe, expect, it } from "vitest";
import { isPaidGuestStatus } from "@/lib/events/survey-eligibility";

describe("isPaidGuestStatus", () => {
  it("accepts paid and present seats", () => {
    expect(isPaidGuestStatus("confirmed")).toBe(true);
    expect(isPaidGuestStatus("present")).toBe(true);
  });

  it("rejects an unpaid yes", () => {
    expect(isPaidGuestStatus("attending")).toBe(false);
    expect(isPaidGuestStatus("invited")).toBe(false);
    expect(isPaidGuestStatus("waitlist")).toBe(false);
  });
});

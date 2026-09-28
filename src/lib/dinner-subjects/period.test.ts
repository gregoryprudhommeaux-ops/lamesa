import { describe, expect, it } from "vitest";
import {
  currentPeriodMonth,
  formatPeriodMonthLabel,
  isValidPeriodMonth,
  subjectTimingBucket,
} from "@/lib/dinner-subjects/period";

describe("dinner-subjects/period", () => {
  it("validates YYYY-MM", () => {
    expect(isValidPeriodMonth("2026-09")).toBe(true);
    expect(isValidPeriodMonth("2026-13")).toBe(false);
    expect(isValidPeriodMonth("26-09")).toBe(false);
  });

  it("buckets past vs upcoming against Mexico City month", () => {
    const now = new Date("2026-09-15T12:00:00Z");
    expect(subjectTimingBucket("2026-08", now)).toBe("past");
    expect(subjectTimingBucket("2026-09", now)).toBe("upcoming");
    expect(subjectTimingBucket("2026-10", now)).toBe("upcoming");
  });

  it("formats period labels", () => {
    expect(formatPeriodMonthLabel("2026-09", "fr").toLowerCase()).toContain("2026");
    expect(formatPeriodMonthLabel("2026-09", "en").toLowerCase()).toContain("september");
  });

  it("returns current period as YYYY-MM", () => {
    expect(currentPeriodMonth(new Date("2026-03-01T18:00:00Z"))).toMatch(/^\d{4}-\d{2}$/);
  });
});

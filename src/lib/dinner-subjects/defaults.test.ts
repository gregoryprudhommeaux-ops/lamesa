import { describe, expect, it } from "vitest";
import { buildDefaultDinnerSubjectSeeds } from "@/lib/dinner-subjects/defaults";
import { isValidPeriodMonth, subjectTimingBucket } from "@/lib/dinner-subjects/period";

describe("dinner-subjects/defaults", () => {
  it("seeds published subjects with valid periods spanning past and upcoming", () => {
    const now = new Date("2026-09-15T12:00:00Z");
    const seeds = buildDefaultDinnerSubjectSeeds(now);
    expect(seeds.length).toBeGreaterThanOrEqual(4);
    expect(seeds.every((s) => s.status === "published")).toBe(true);
    expect(seeds.every((s) => isValidPeriodMonth(s.periodMonth))).toBe(true);
    const buckets = new Set(seeds.map((s) => subjectTimingBucket(s.periodMonth, now)));
    expect(buckets.has("past")).toBe(true);
    expect(buckets.has("upcoming")).toBe(true);
  });
});

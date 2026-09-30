import { describe, expect, it } from "vitest";
import {
  normalizeOpsPhaseId,
  opsPhasesForMode,
  RSVP_OPS_PHASES,
  INTEREST_OPS_PHASES,
} from "./ops-phases";

describe("ops-phases", () => {
  it("exposes 9 interest phases and fewer RSVP phases", () => {
    expect(INTEREST_OPS_PHASES).toHaveLength(9);
    expect(RSVP_OPS_PHASES.length).toBeLessThan(9);
    expect(opsPhasesForMode(true).map((p) => p.id)).toContain("save_the_date");
    expect(opsPhasesForMode(false).map((p) => p.id)).not.toContain("save_the_date");
  });

  it("normalizes legacy phase ids", () => {
    expect(normalizeOpsPhaseId("std")).toBe("prep");
    expect(normalizeOpsPhaseId("definitive")).toBe("prep");
    expect(normalizeOpsPhaseId("std_email")).toBe("save_the_date");
    expect(normalizeOpsPhaseId("auto")).toBe("feedback");
    expect(normalizeOpsPhaseId("payment")).toBe("payment");
  });

  it("maps interest-only phases away in RSVP mode", () => {
    expect(normalizeOpsPhaseId("save_the_date", { interestMode: false })).toBe("audience");
    expect(normalizeOpsPhaseId("qualify", { interestMode: false })).toBe("audience");
  });
});

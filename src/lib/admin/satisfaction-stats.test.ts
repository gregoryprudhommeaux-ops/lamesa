import { describe, expect, it } from "vitest";
import {
  computeEventSatisfaction,
  computeSatisfactionAverages,
} from "./satisfaction-stats";

describe("satisfaction-stats", () => {
  it("returns empty averages with no surveys", () => {
    const a = computeSatisfactionAverages([]);
    expect(a.responseCount).toBe(0);
    expect(a.overall).toBeNull();
  });

  it("averages category scores", () => {
    const a = computeSatisfactionAverages([
      {
        venueQuality: 5,
        menuQuality: 4,
        guestsQuality: 5,
        wouldReturn: 4,
        wantInviteOther: true,
        submittedAt: "2026-01-01",
      },
      {
        venueQuality: 3,
        menuQuality: 4,
        guestsQuality: 3,
        wouldReturn: 2,
        wantInviteOther: false,
        submittedAt: "2026-01-02",
      },
    ]);
    expect(a.responseCount).toBe(2);
    expect(a.venueQuality).toBe(4);
    expect(a.menuQuality).toBe(4);
    expect(a.guestsQuality).toBe(4);
    expect(a.wouldReturn).toBe(3);
    expect(a.inviteYesCount).toBe(1);
    expect(a.inviteYesRate).toBe(50);
    expect(a.overall).toBe(3.8);
  });

  it("counts sent surveys separately", () => {
    const r = computeEventSatisfaction([
      { satisfactionSurveySentAt: "x" },
      {
        satisfactionSurveySentAt: "y",
        satisfactionSurvey: {
          venueQuality: 5,
          menuQuality: 5,
          guestsQuality: 5,
          wouldReturn: 5,
          wantInviteOther: false,
          submittedAt: "z",
        },
      },
    ]);
    expect(r.sentCount).toBe(2);
    expect(r.responseCount).toBe(1);
    expect(r.overall).toBe(5);
  });
});

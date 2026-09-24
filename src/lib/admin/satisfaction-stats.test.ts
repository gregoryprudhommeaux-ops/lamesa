import { describe, expect, it } from "vitest";
import {
  computeEventSatisfaction,
  computeSatisfactionAverages,
} from "./satisfaction-stats";

describe("satisfaction-stats", () => {
  it("averages category scores including wouldRecommend", () => {
    const a = computeSatisfactionAverages([
      {
        venueQuality: 5,
        menuQuality: 4,
        guestsQuality: 5,
        wouldReturn: 4,
        wouldRecommend: 5,
        submittedAt: "2026-01-01",
      },
      {
        venueQuality: 3,
        menuQuality: 2,
        guestsQuality: 3,
        wouldReturn: 2,
        wouldRecommend: 3,
        submittedAt: "2026-01-02",
      },
    ]);
    expect(a.responseCount).toBe(2);
    expect(a.venueQuality).toBe(4);
    expect(a.menuQuality).toBe(3);
    expect(a.guestsQuality).toBe(4);
    expect(a.wouldReturn).toBe(3);
    expect(a.wouldRecommend).toBe(4);
    expect(a.overall).toBe(3.6);
  });

  it("maps legacy wantInviteOther into wouldRecommend average", () => {
    const a = computeSatisfactionAverages([
      {
        venueQuality: 5,
        menuQuality: 5,
        guestsQuality: 5,
        wouldReturn: 5,
        wantInviteOther: true,
        submittedAt: "2026-01-01",
      } as never,
    ]);
    expect(a.wouldRecommend).toBe(5);
  });

  it("counts sent surveys on event", () => {
    const e = computeEventSatisfaction([
      { satisfactionSurveySentAt: "x" },
      {
        satisfactionSurveySentAt: "y",
        satisfactionSurvey: {
          venueQuality: 5,
          menuQuality: 5,
          guestsQuality: 5,
          wouldReturn: 5,
          wouldRecommend: 5,
          submittedAt: "z",
        },
      },
    ]);
    expect(e.sentCount).toBe(2);
    expect(e.responseCount).toBe(1);
  });
});

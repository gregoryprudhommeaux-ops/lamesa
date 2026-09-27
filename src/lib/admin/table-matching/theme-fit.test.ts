import { describe, expect, it } from "vitest";
import type { TableCandidate } from "./types";
import { scoreThemeFit, tokenizeTheme, THEME_SCORE } from "./theme-fit";

const candidate = (overrides: Partial<TableCandidate> = {}): TableCandidate => ({
  id: "m1",
  fullName: "Ada",
  email: "ada@example.com",
  company: "Acme",
  sector: "consulting",
  position: "director",
  city: "Guadalajara",
  invitationMotivation: "",
  extraActivities: [],
  canBring: "",
  isSeeking: "",
  dinnerThemesInterest: "",
  opsNotes: "",
  completionPercent: 80,
  completionBand: "high",
  invitationCount: 0,
  invitedToPreviousEvent: false,
  coPresentMemberIds: [],
  ...overrides,
});

describe("tokenizeTheme", () => {
  it("keeps multi-word finance phrases", () => {
    const tokens = tokenizeTheme(
      "Family Offices, VC, Private Equity, Investment banking, Investissement, Levée de fonds",
    );
    expect(tokens).toEqual(
      expect.arrayContaining([
        "family offices",
        "vc",
        "private equity",
        "investment banking",
        "investissement",
        "levee de fonds",
      ]),
    );
  });
});

describe("scoreThemeFit", () => {
  const theme =
    "Family Offices, VC, Private Equity, Investment banking, Investissement, Levée de fonds";

  it("scores finance sector + investor position as strong fit", () => {
    const fit = scoreThemeFit(
      candidate({
        sector: "finance",
        position: "investor",
        dinnerThemesInterest: "Private equity and family offices in LatAm",
      }),
      theme,
    );
    expect(fit.band).toBe("strong");
    expect(fit.score).toBe(THEME_SCORE.strong);
  });

  it("penalizes unrelated consulting/tech profiles", () => {
    const fit = scoreThemeFit(
      candidate({
        sector: "tech",
        position: "founder",
        dinnerThemesInterest: "Product-led growth SaaS",
      }),
      theme,
    );
    expect(fit.band).toBe("none");
    expect(fit.score).toBe(THEME_SCORE.nonePenalty);
  });

  it("uses opsNotes as a theme signal", () => {
    const fit = scoreThemeFit(
      candidate({
        sector: "other",
        opsNotes: "[Table 2026-01-01] Excellent for PE / family office tables",
      }),
      theme,
    );
    expect(["weak", "medium", "strong"]).toContain(fit.band);
    expect(fit.score).toBeGreaterThan(THEME_SCORE.nonePenalty);
  });
});

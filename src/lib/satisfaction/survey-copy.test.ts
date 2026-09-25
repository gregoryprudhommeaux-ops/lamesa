import { describe, expect, it } from "vitest";
import {
  SURVEY_COPY,
  surveyLocaleFrom,
  surveyQuestionsList,
} from "./survey-copy";

describe("survey-copy", () => {
  it("resolves locales with fallback to es", () => {
    expect(surveyLocaleFrom("fr")).toBe("fr");
    expect(surveyLocaleFrom("EN")).toBe("en");
    expect(surveyLocaleFrom("xx")).toBe("es");
  });

  it("exposes 6 scored questions + title in each locale", () => {
    for (const locale of ["es", "fr", "en"] as const) {
      const list = surveyQuestionsList(locale);
      expect(list).toHaveLength(6);
      expect(SURVEY_COPY[locale].title.length).toBeGreaterThan(5);
      expect(list.every((q) => q.label.trim().length > 0)).toBe(true);
    }
    expect(SURVEY_COPY.fr.questions.valueForMoney).toContain("prix payé");
  });

  it("keeps FR recommend question distinct from ES", () => {
    expect(SURVEY_COPY.fr.questions.wouldRecommend).toContain("LA MESA");
    expect(SURVEY_COPY.es.questions.wouldRecommend).toContain("LA MESA");
    expect(SURVEY_COPY.fr.questions.wouldRecommend).not.toBe(
      SURVEY_COPY.es.questions.wouldRecommend,
    );
  });
});

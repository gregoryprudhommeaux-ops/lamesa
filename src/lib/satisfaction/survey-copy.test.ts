import { describe, expect, it } from "vitest";
import {
  SURVEY_COPY,
  SURVEY_SCORE_FIELDS,
  countMissingSurveyScores,
  incompleteSurveyMessage,
  surveyLocaleFrom,
  surveyQuestionsList,
  type SurveyScoreField,
} from "./survey-copy";

function emptyScores(): Record<SurveyScoreField, number | null> {
  return {
    venueQuality: null,
    menuQuality: null,
    guestsQuality: null,
    valueForMoney: null,
    wouldReturn: null,
    wouldRecommend: null,
  };
}

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

  it("keeps FR word-of-mouth question distinct from ES", () => {
    expect(SURVEY_COPY.fr.questions.wouldRecommend).toContain("expérience");
    expect(SURVEY_COPY.es.questions.wouldRecommend).toContain("experiencia");
    expect(SURVEY_COPY.fr.questions.wouldRecommend).not.toBe(
      SURVEY_COPY.es.questions.wouldRecommend,
    );
  });

  it("counts missing scored answers (comment not counted)", () => {
    expect(countMissingSurveyScores(emptyScores())).toBe(SURVEY_SCORE_FIELDS.length);

    const oneAnswered = { ...emptyScores(), venueQuality: 4 };
    expect(countMissingSurveyScores(oneAnswered)).toBe(5);

    const allAnswered = Object.fromEntries(
      SURVEY_SCORE_FIELDS.map((k) => [k, 3]),
    ) as Record<SurveyScoreField, number | null>;
    expect(countMissingSurveyScores(allAnswered)).toBe(0);
  });

  it("builds an incomplete-submit guide with the missing count", () => {
    expect(incompleteSurveyMessage("fr", 1)).toMatch(/1 réponse/);
    expect(incompleteSurveyMessage("fr", 3)).toMatch(/3 réponses/);
    expect(incompleteSurveyMessage("fr", 3)).toMatch(/Impossible de valider/i);
    expect(incompleteSurveyMessage("es", 2)).toMatch(/2 respuesta/);
    expect(incompleteSurveyMessage("en", 2)).toMatch(/2 answer/);
  });
});

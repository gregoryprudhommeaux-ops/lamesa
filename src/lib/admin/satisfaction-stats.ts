import type { AdminEventParticipation, SatisfactionSurveyAnswers } from "@/lib/types/events";

export type SatisfactionAverages = {
  overall: number | null;
  venueQuality: number | null;
  menuQuality: number | null;
  guestsQuality: number | null;
  valueForMoney: number | null;
  wouldReturn: number | null;
  wouldRecommend: number | null;
  responseCount: number;
  /** @deprecated Kept for older dashboard payloads; always 0 for new surveys. */
  inviteYesCount: number;
  inviteYesRate: number | null;
};

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function recommendScore(s: SatisfactionSurveyAnswers): number | null {
  if (typeof s.wouldRecommend === "number") return s.wouldRecommend;
  // Legacy boolean invite → map yes=5 / no=0 for historical averages only
  if (typeof s.wantInviteOther === "boolean") return s.wantInviteOther ? 5 : 0;
  return null;
}

function surveyParts(s: SatisfactionSurveyAnswers): number[] {
  const parts = [s.venueQuality, s.menuQuality, s.guestsQuality, s.wouldReturn];
  if (typeof s.valueForMoney === "number") parts.push(s.valueForMoney);
  const rec = recommendScore(s);
  if (rec !== null) parts.push(rec);
  return parts;
}

export function surveysFromParticipations(
  parts: Array<Pick<AdminEventParticipation, "satisfactionSurvey">>,
): SatisfactionSurveyAnswers[] {
  return parts
    .map((p) => p.satisfactionSurvey)
    .filter((s): s is SatisfactionSurveyAnswers => Boolean(s?.submittedAt));
}

export function computeSatisfactionAverages(
  surveys: SatisfactionSurveyAnswers[],
): SatisfactionAverages {
  const responseCount = surveys.length;
  if (responseCount === 0) {
    return {
      overall: null,
      venueQuality: null,
      menuQuality: null,
      guestsQuality: null,
      valueForMoney: null,
      wouldReturn: null,
      wouldRecommend: null,
      responseCount: 0,
      inviteYesCount: 0,
      inviteYesRate: null,
    };
  }

  const venue = surveys.map((s) => s.venueQuality);
  const menu = surveys.map((s) => s.menuQuality);
  const guests = surveys.map((s) => s.guestsQuality);
  const ret = surveys.map((s) => s.wouldReturn);
  const value = surveys
    .map((s) => s.valueForMoney)
    .filter((n): n is number => typeof n === "number");
  const recommend = surveys
    .map((s) => recommendScore(s))
    .filter((n): n is number => n !== null);

  const perSurveyOverall = surveys.map((s) => {
    const parts = surveyParts(s);
    return parts.reduce((a, b) => a + b, 0) / parts.length;
  });

  return {
    overall: avg(perSurveyOverall),
    venueQuality: avg(venue),
    menuQuality: avg(menu),
    guestsQuality: avg(guests),
    valueForMoney: avg(value),
    wouldReturn: avg(ret),
    wouldRecommend: avg(recommend),
    responseCount,
    inviteYesCount: 0,
    inviteYesRate: null,
  };
}

export function computeEventSatisfaction(
  parts: Array<
    Pick<AdminEventParticipation, "satisfactionSurvey" | "satisfactionSurveySentAt">
  >,
): SatisfactionAverages & { sentCount: number } {
  const sentCount = parts.filter((p) => Boolean(p.satisfactionSurveySentAt)).length;
  return {
    ...computeSatisfactionAverages(surveysFromParticipations(parts)),
    sentCount,
  };
}

/** Mean of the scores actually answered on one survey (same mix as the event average). */
export function surveyOverallScore(survey: SatisfactionSurveyAnswers): number | null {
  const parts = surveyParts(survey);
  if (parts.length === 0) return null;
  return Math.round((parts.reduce((sum, n) => sum + n, 0) / parts.length) * 10) / 10;
}

export function formatScore(n: number | null): string {
  if (n === null) return "—";
  return n.toFixed(1);
}

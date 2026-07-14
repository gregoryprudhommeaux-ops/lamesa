import type { AdminEventParticipation, SatisfactionSurveyAnswers } from "@/lib/types/events";

export type SatisfactionAverages = {
  overall: number | null;
  venueQuality: number | null;
  menuQuality: number | null;
  guestsQuality: number | null;
  wouldReturn: number | null;
  responseCount: number;
  inviteYesCount: number;
  inviteYesRate: number | null;
};

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
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
      wouldReturn: null,
      responseCount: 0,
      inviteYesCount: 0,
      inviteYesRate: null,
    };
  }

  const venue = surveys.map((s) => s.venueQuality);
  const menu = surveys.map((s) => s.menuQuality);
  const guests = surveys.map((s) => s.guestsQuality);
  const ret = surveys.map((s) => s.wouldReturn);
  const inviteYesCount = surveys.filter((s) => s.wantInviteOther).length;

  const perSurveyOverall = surveys.map(
    (s) => (s.venueQuality + s.menuQuality + s.guestsQuality + s.wouldReturn) / 4,
  );

  return {
    overall: avg(perSurveyOverall),
    venueQuality: avg(venue),
    menuQuality: avg(menu),
    guestsQuality: avg(guests),
    wouldReturn: avg(ret),
    responseCount,
    inviteYesCount,
    inviteYesRate: Math.round((inviteYesCount / responseCount) * 100),
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

export function formatScore(n: number | null): string {
  if (n === null) return "—";
  return n.toFixed(1);
}

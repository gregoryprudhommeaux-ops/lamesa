import {
  countsAsConfirmed,
  countsAsInvitation,
} from "@/lib/admin/member-engagement";
import { isOrganizerParticipation } from "@/lib/events/capacity";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import { computeEventIva } from "@/lib/events/pricing";
import { normalizeProspectEmail } from "@/lib/prospects/normalize";
import type {
  ContactActivity,
  ContactEventRow,
  ContactStats,
  ContactSurveySnapshot,
} from "@/lib/types/contact-activities";
import type {
  AdminEvent,
  AdminEventParticipation,
  EventRespondent,
  SatisfactionSurveyAnswers,
  WaitlistRegistration,
} from "@/lib/types/events";
import type { Prospect } from "@/lib/types/prospects";

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

export function surveySnapshot(
  survey: SatisfactionSurveyAnswers | null | undefined,
): ContactSurveySnapshot | null {
  if (!survey?.submittedAt) return null;
  const recommend =
    typeof survey.wouldRecommend === "number"
      ? survey.wouldRecommend
      : typeof survey.wantInviteOther === "boolean"
        ? survey.wantInviteOther
          ? 5
          : 0
        : null;
  const parts = [
    survey.venueQuality,
    survey.menuQuality,
    survey.guestsQuality,
    survey.wouldReturn,
    ...(recommend === null ? [] : [recommend]),
  ];
  const overall = Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 10) / 10;
  return {
    venueQuality: survey.venueQuality,
    menuQuality: survey.menuQuality,
    guestsQuality: survey.guestsQuality,
    wouldReturn: survey.wouldReturn,
    wouldRecommend: recommend,
    comment: survey.comment?.trim() || undefined,
    submittedAt: survey.submittedAt,
    overall,
  };
}

export function buildContactStats(input: {
  email: string;
  prospect: Prospect | null;
  waitlist: WaitlistRegistration | null;
  participations: Array<
    Pick<
      AdminEventParticipation,
      | "id"
      | "email"
      | "eventId"
      | "status"
      | "isOrganizer"
      | "contactId"
      | "rsvpAt"
      | "calendarInviteSentAt"
      | "saveTheDateSentAt"
      | "createdAt"
      | "satisfactionSurvey"
    >
  >;
  events: Array<Pick<AdminEvent, "id" | "title" | "startsAt" | "priceMxn">>;
  activities: ContactActivity[];
  /** Interest / STD form rows for this email (optional). */
  respondents?: Array<
    Pick<
      EventRespondent,
      "id" | "eventId" | "email" | "interestResponse" | "attendance" | "createdAt" | "updatedAt"
    >
  >;
}): ContactStats {
  const email = normalizeProspectEmail(input.email);
  const waitlistId = input.waitlist?.id;

  const byId = new Map<string, (typeof input.participations)[number]>();
  for (const p of input.participations) {
    if (isOrganizerParticipation(p)) continue;
    const matchEmail = normalizeProspectEmail(p.email) === email;
    const matchContact = Boolean(waitlistId && p.contactId === waitlistId);
    if (!matchEmail && !matchContact) continue;
    byId.set(p.id, p);
  }

  const eventById = new Map(input.events.map((e) => [e.id, e]));
  const interestByEvent = new Map<string, string>();
  for (const r of input.respondents ?? []) {
    if (normalizeProspectEmail(r.email) !== email) continue;
    const answer = (r.interestResponse || r.attendance || "").trim().toLowerCase();
    if (!answer || !r.eventId) continue;
    interestByEvent.set(r.eventId, answer);
  }

  let invitationsCount = 0;
  let confirmedCount = 0;
  let declinedCount = 0;
  let revenueMxn = 0;
  const events: ContactEventRow[] = [];
  const coveredEventIds = new Set<string>();

  for (const part of byId.values()) {
    const status = normalizeParticipationStatus(part.status);
    if (countsAsInvitation(status)) invitationsCount += 1;
    if (status === "not_attending") declinedCount += 1;

    const ev = eventById.get(part.eventId);
    let rowRevenue = 0;
    if (countsAsConfirmed(status)) {
      confirmedCount += 1;
      const price = ev?.priceMxn ?? 0;
      const priceBeforeTax =
        typeof price === "number" && Number.isFinite(price) ? price : 0;
      rowRevenue = computeEventIva(priceBeforeTax).totalWithIva;
      revenueMxn += rowRevenue;
    }

    const survey = surveySnapshot(part.satisfactionSurvey);
    coveredEventIds.add(part.eventId);
    events.push({
      eventId: part.eventId,
      title: ev?.title?.trim() || part.eventId,
      startsAt: ev?.startsAt ?? null,
      status,
      participationId: part.id,
      revenueMxn: Math.round(rowRevenue * 100) / 100,
      rsvpAt: part.rsvpAt ?? null,
      inviteSentAt: part.calendarInviteSentAt || part.saveTheDateSentAt || part.createdAt || null,
      interestResponse: interestByEvent.get(part.eventId) ?? null,
      survey,
    });
  }

  // Interest-only responses (no participation row yet)
  for (const r of input.respondents ?? []) {
    if (normalizeProspectEmail(r.email) !== email) continue;
    if (!r.eventId || coveredEventIds.has(r.eventId)) continue;
    const answer = (r.interestResponse || r.attendance || "").trim().toLowerCase();
    if (!answer) continue;
    const ev = eventById.get(r.eventId);
    events.push({
      eventId: r.eventId,
      title: ev?.title?.trim() || r.eventId,
      startsAt: ev?.startsAt ?? null,
      status: `interest_${answer}`,
      participationId: null,
      revenueMxn: 0,
      rsvpAt: r.updatedAt || r.createdAt || null,
      inviteSentAt: null,
      interestResponse: answer,
      survey: null,
    });
  }

  events.sort((a, b) => String(b.startsAt ?? "").localeCompare(String(a.startsAt ?? "")));

  const surveys = events.map((e) => e.survey).filter((s): s is ContactSurveySnapshot => Boolean(s));
  const recommendScores = surveys
    .map((s) => s.wouldRecommend)
    .filter((n): n is number => typeof n === "number");

  const outreachDates = [
    input.prospect?.lastContactedAt,
    ...input.activities.filter((a) => a.type === "email_sent").map((a) => a.at),
  ].filter((x): x is string => Boolean(x && String(x).trim()));
  outreachDates.sort();
  const lastOutreachAt = outreachDates.at(-1) ?? null;

  return {
    addedAt: input.prospect?.createdAt ?? null,
    registeredAt: input.waitlist?.createdAt ?? null,
    invitationsCount,
    confirmedCount,
    declinedCount,
    revenueMxn: Math.round(revenueMxn * 100) / 100,
    surveyCount: surveys.length,
    avgOverall: avg(surveys.map((s) => s.overall)),
    avgWouldRecommend: avg(recommendScores),
    lastOutreachAt,
    events,
  };
}

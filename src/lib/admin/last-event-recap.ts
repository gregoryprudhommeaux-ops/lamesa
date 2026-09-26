/**
 * Recap of the latest dinner that has already started.
 * Counts are observed (email stamps, paid seat, ticket price, submitted survey).
 */
import { countsAsConfirmed } from "@/lib/admin/member-engagement";
import {
  computeEventSatisfaction,
  surveyOverallScore,
  type SatisfactionAverages,
} from "@/lib/admin/satisfaction-stats";
import { isOrganizerParticipation } from "@/lib/events/capacity";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import { computeEventIva } from "@/lib/events/pricing";
import type { AdminEvent, AdminEventParticipation } from "@/lib/types/events";

const CHANNELS: Array<{
  field: keyof AdminEventParticipation;
  label: string;
}> = [
  { field: "saveTheDateSentAt", label: "STD" },
  { field: "calendarInviteSentAt", label: "Invitation" },
  { field: "placesAvailableSentAt", label: "Places" },
  { field: "paymentRelanceSentAt", label: "Relance paiement" },
  { field: "confirmationEmailSentAt", label: "Confirmation" },
  { field: "satisfactionSurveySentAt", label: "Questionnaire" },
];

export type LastEventRecapPerson = {
  id: string;
  contactId: string | null;
  fullName: string;
  email: string;
  company: string;
  status: string;
  channels: string[];
  amountMxn: number;
};

export type LastEventSurveyRow = {
  id: string;
  contactId: string | null;
  fullName: string;
  email: string;
  company: string;
  overall: number | null;
  venueQuality: number;
  menuQuality: number;
  guestsQuality: number;
  valueForMoney: number | null;
  wouldReturn: number;
  wouldRecommend: number | null;
  comment: string;
  submittedAt: string;
};

export type LastEventRecap = {
  eventId: string;
  eventSlug: string;
  title: string;
  startsAt: string;
  priceMxn: number | null;
  contacted: number;
  /** Paying seats. The organizer is not in this count. */
  registered: number;
  /** People at the table the restaurant charges for: payers + seated organizer. */
  coverCount: number;
  revenueMxn: number;
  revenueBeforeTaxMxn: number;
  ivaMxn: number;
  /** Cover count × ticket TTC. The organizer eats and does not pay. */
  costMxn: number;
  /** Collected from payers, minus the cost of every cover. */
  profitMxn: number;
  satisfactionOverall: number | null;
  satisfactionResponses: number;
  satisfactionSent: number;
  satisfaction: SatisfactionAverages;
  contactedPeople: LastEventRecapPerson[];
  registeredPeople: LastEventRecapPerson[];
  surveyRows: LastEventSurveyRow[];
};

function byName(
  a: { fullName: string; email: string },
  b: { fullName: string; email: string },
): number {
  return (a.fullName || a.email).localeCompare(b.fullName || b.email, "fr", {
    sensitivity: "base",
  });
}

function channelsFor(p: AdminEventParticipation): string[] {
  return CHANNELS.filter((channel) => Boolean(p[channel.field])).map((channel) => channel.label);
}

function ticketPrice(event: AdminEvent): number | null {
  const price = event.priceMxn;
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) return null;
  return price;
}

/** Latest non-draft event whose start is already in the past. */
export function pickLastPastEvent(
  events: AdminEvent[],
  nowMs = Date.now(),
): AdminEvent | null {
  let best: AdminEvent | null = null;
  let bestMs = -Infinity;
  for (const event of events) {
    if (event.status === "draft") continue;
    const ms = new Date(event.startsAt).getTime();
    if (!Number.isFinite(ms) || ms > nowMs) continue;
    if (ms > bestMs) {
      best = event;
      bestMs = ms;
    }
  }
  return best;
}

export function buildLastEventRecap(
  events: AdminEvent[],
  participations: AdminEventParticipation[],
  nowMs = Date.now(),
): LastEventRecap | null {
  const event = pickLastPastEvent(events, nowMs);
  if (!event) return null;

  const onEvent = participations.filter((p) => p.eventId === event.id);
  const guests = onEvent.filter((p) => !isOrganizerParticipation(p));
  const hostSeated = onEvent.some(
    (p) => isOrganizerParticipation(p) && countsAsConfirmed(normalizeParticipationStatus(p.status)),
  );
  const price = ticketPrice(event);
  const line = computeEventIva(price ?? 0);

  const contactedPeople: LastEventRecapPerson[] = [];
  const registeredPeople: LastEventRecapPerson[] = [];
  let revenue = 0;
  let beforeTax = 0;
  let iva = 0;

  for (const p of guests) {
    const channels = channelsFor(p);
    const status = normalizeParticipationStatus(p.status);
    const paid = countsAsConfirmed(status);
    const amountMxn = paid ? line.totalWithIva : 0;
    const person: LastEventRecapPerson = {
      id: p.id,
      contactId: p.contactId?.trim() || null,
      fullName: p.fullName?.trim() || p.email || "Sans nom",
      email: p.email ?? "",
      company: p.companyName?.trim() || "",
      status,
      channels,
      amountMxn,
    };
    if (channels.length > 0) contactedPeople.push(person);
    if (paid) {
      registeredPeople.push(person);
      revenue += line.totalWithIva;
      beforeTax += line.priceBeforeTax;
      iva += line.iva;
    }
  }

  contactedPeople.sort(byName);
  registeredPeople.sort(byName);

  const coverCount = registeredPeople.length + (hostSeated ? 1 : 0);
  const cost = line.totalWithIva * coverCount;
  const profit = revenue - cost;

  const satisfaction = computeEventSatisfaction(guests);
  const surveyRows: LastEventSurveyRow[] = guests
    .filter((p) => Boolean(p.satisfactionSurvey?.submittedAt))
    .map((p) => {
      const survey = p.satisfactionSurvey!;
      return {
        id: p.id,
        contactId: p.contactId?.trim() || null,
        fullName: p.fullName?.trim() || p.email || "Sans nom",
        email: p.email ?? "",
        company: p.companyName?.trim() || "",
        overall: surveyOverallScore(survey),
        venueQuality: survey.venueQuality,
        menuQuality: survey.menuQuality,
        guestsQuality: survey.guestsQuality,
        valueForMoney: typeof survey.valueForMoney === "number" ? survey.valueForMoney : null,
        wouldReturn: survey.wouldReturn,
        wouldRecommend:
          typeof survey.wouldRecommend === "number" ? survey.wouldRecommend : null,
        comment: survey.comment?.trim() || "",
        submittedAt: survey.submittedAt,
      };
    })
    .sort(byName);

  return {
    eventId: event.id,
    eventSlug: event.slug,
    title: event.title,
    startsAt: event.startsAt,
    priceMxn: price,
    contacted: contactedPeople.length,
    registered: registeredPeople.length,
    coverCount,
    revenueMxn: Math.round(revenue * 100) / 100,
    revenueBeforeTaxMxn: Math.round(beforeTax * 100) / 100,
    ivaMxn: Math.round(iva * 100) / 100,
    costMxn: Math.round(cost * 100) / 100,
    profitMxn: Math.round(profit * 100) / 100,
    satisfactionOverall: satisfaction.overall,
    satisfactionResponses: satisfaction.responseCount,
    satisfactionSent: satisfaction.sentCount,
    satisfaction,
    contactedPeople,
    registeredPeople,
    surveyRows,
  };
}

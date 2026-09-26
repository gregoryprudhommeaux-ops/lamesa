/**
 * Recap of the latest dinner that has already started.
 * Counts are observed (email stamps, paid seat, ticket price, submitted survey).
 * CA = paid seats only; complimentary (Invité) seats add COST, zero revenue.
 * Organizer (Gregory) is always Invité for P&L: COST yes, CA no — absorbed by margin.
 */
import { countsAsConfirmed, countsAsComplimentary } from "@/lib/admin/member-engagement";
import {
  computeEventSatisfaction,
  surveyOverallScore,
  type SatisfactionAverages,
} from "@/lib/admin/satisfaction-stats";
import { isOrganizerParticipation } from "@/lib/events/capacity";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import { computeEventEconomics, computeSeatPriceBreakdown, resolveIncludesFlag } from "@/lib/events/pricing";
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
  costMxn: number | null;
  contacted: number;
  registered: number;
  complimentary: number;
  revenueMxn: number;
  revenueBeforeTaxMxn: number;
  ivaMxn: number;
  serviceMxn: number;
  /** Negotiated sale formula, e.g. "TTC · HT + IVA 16%". */
  saleFormula: string;
  priceIncludesIva: boolean;
  priceIncludesService: boolean;
  costTotalMxn: number;
  marginMxn: number;
  satisfactionOverall: number | null;
  satisfactionResponses: number;
  satisfactionSent: number;
  satisfaction: SatisfactionAverages;
  contactedPeople: LastEventRecapPerson[];
  registeredPeople: LastEventRecapPerson[];
  complimentaryPeople: LastEventRecapPerson[];
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

function ticketCost(event: AdminEvent): number | null {
  const cost = event.costMxn;
  if (typeof cost !== "number" || !Number.isFinite(cost) || cost <= 0) return null;
  return cost;
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

  const eventParts = participations.filter((p) => p.eventId === event.id);
  const guests = eventParts.filter((p) => !isOrganizerParticipation(p));
  const organizers = eventParts.filter((p) => isOrganizerParticipation(p));
  const price = ticketPrice(event);
  const cost = ticketCost(event);
  const priceIncludesIva = resolveIncludesFlag(event.priceIncludesIva);
  const priceIncludesService = resolveIncludesFlag(event.priceIncludesService);
  const costIncludesIva = resolveIncludesFlag(event.costIncludesIva);
  const costIncludesService = resolveIncludesFlag(event.costIncludesService);
  const saleLine = computeSeatPriceBreakdown(price ?? 0, {
    includeIva: priceIncludesIva,
    includeService: priceIncludesService,
  });

  const contactedPeople: LastEventRecapPerson[] = [];
  const registeredPeople: LastEventRecapPerson[] = [];
  const complimentaryPeople: LastEventRecapPerson[] = [];
  let paidCount = 0;
  let compCount = 0;

  for (const p of guests) {
    const channels = channelsFor(p);
    const status = normalizeParticipationStatus(p.status);
    const paid = countsAsConfirmed(status);
    const complimentary = countsAsComplimentary(status);
    const amountMxn = paid ? saleLine.total : 0;
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
      paidCount += 1;
    }
    if (complimentary) {
      complimentaryPeople.push(person);
      compCount += 1;
    }
  }

  // One host cover for COST, even if gmail + LA MESA mailbox are both seated.
  // Legacy `confirmed` on that seat is still COST, never CA.
  if (organizers.length > 0) {
    compCount += 1;
    for (const p of organizers) {
      complimentaryPeople.push({
        id: p.id,
        contactId: p.contactId?.trim() || null,
        fullName: p.fullName?.trim() || p.email || "Sans nom",
        email: p.email ?? "",
        company: p.companyName?.trim() || "",
        status: "comped",
        channels: channelsFor(p),
        amountMxn: 0,
      });
    }
  }

  contactedPeople.sort(byName);
  registeredPeople.sort(byName);
  complimentaryPeople.sort(byName);

  const econ = computeEventEconomics({
    costMxn: cost,
    priceMxn: price,
    paidSeatCount: paidCount,
    complimentarySeatCount: compCount,
    priceIncludesIva,
    priceIncludesService,
    costIncludesIva,
    costIncludesService,
  });

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
    costMxn: cost,
    contacted: contactedPeople.length,
    registered: registeredPeople.length,
    complimentary: compCount,
    revenueMxn: econ.revenueMxn,
    revenueBeforeTaxMxn: Math.round(saleLine.base * paidCount * 100) / 100,
    ivaMxn: Math.round(saleLine.iva * paidCount * 100) / 100,
    serviceMxn: Math.round(saleLine.service * paidCount * 100) / 100,
    saleFormula: econ.saleFormula,
    priceIncludesIva,
    priceIncludesService,
    costTotalMxn: econ.costTotalMxn,
    marginMxn: econ.marginMxn,
    satisfactionOverall: satisfaction.overall,
    satisfactionResponses: satisfaction.responseCount,
    satisfactionSent: satisfaction.sentCount,
    satisfaction,
    contactedPeople,
    registeredPeople,
    complimentaryPeople,
    surveyRows,
  };
}

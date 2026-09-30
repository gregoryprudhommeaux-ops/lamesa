/**
 * Cumulative LA MESA dinner series — CA, COST, margin, fill, satisfaction over time.
 * Observed P&L only (paid = CA; complimentary + organizer = COST, no CA).
 */
import { countsAsConfirmed, countsAsComplimentary } from "@/lib/admin/member-engagement";
import { computeEventSatisfaction } from "@/lib/admin/satisfaction-stats";
import { isOrganizerParticipation } from "@/lib/events/capacity";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import {
  computeEventEconomics,
  resolveIncludesFlag,
} from "@/lib/events/pricing";
import type { AdminEvent, AdminEventParticipation } from "@/lib/types/events";

export type MesaSeriesDinner = {
  eventId: string;
  eventSlug: string;
  title: string;
  startsAt: string;
  paidSeats: number;
  complimentarySeats: number;
  capacity: number;
  /** (paid + complimentary guests) / capacity — organizer excluded from capacity denom. */
  fillRate: number | null;
  revenueMxn: number;
  costTotalMxn: number;
  marginMxn: number;
  satisfactionOverall: number | null;
  satisfactionResponses: number;
};

export type MesaSeriesSummary = {
  dinnerCount: number;
  totalPaidSeats: number;
  totalComplimentarySeats: number;
  revenueMxn: number;
  costTotalMxn: number;
  marginMxn: number;
  avgSatisfaction: number | null;
  dinners: MesaSeriesDinner[];
};

const MAX_DINNERS = 12;

function ticketAmount(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

function summarizeDinner(
  event: AdminEvent,
  participations: AdminEventParticipation[],
): MesaSeriesDinner {
  const eventParts = participations.filter((p) => p.eventId === event.id);
  const guests = eventParts.filter((p) => !isOrganizerParticipation(p));
  const organizers = eventParts.filter((p) => isOrganizerParticipation(p));

  let paidSeats = 0;
  let complimentarySeats = 0;
  for (const p of guests) {
    const status = normalizeParticipationStatus(p.status);
    if (countsAsConfirmed(status)) paidSeats += 1;
    if (countsAsComplimentary(status)) complimentarySeats += 1;
  }
  // Organizer always counts as Invité COST.
  complimentarySeats += organizers.length;

  const price = ticketAmount(event.priceMxn);
  const cost = ticketAmount(event.costMxn);
  const econ = computeEventEconomics({
    costMxn: cost,
    priceMxn: price,
    paidSeatCount: paidSeats,
    complimentarySeatCount: complimentarySeats,
    priceIncludesIva: resolveIncludesFlag(event.priceIncludesIva),
    priceIncludesService: resolveIncludesFlag(event.priceIncludesService),
    costIncludesIva: resolveIncludesFlag(event.costIncludesIva),
    costIncludesService: resolveIncludesFlag(event.costIncludesService),
  });

  const sat = computeEventSatisfaction(guests);
  const capacity =
    typeof event.capacity === "number" && event.capacity > 0 ? event.capacity : 0;
  const guestComplimentary = guests.filter((p) =>
    countsAsComplimentary(normalizeParticipationStatus(p.status)),
  ).length;
  const guestHeld = paidSeats + guestComplimentary;
  const fillRate = capacity > 0 ? Math.round((guestHeld / capacity) * 1000) / 1000 : null;

  return {
    eventId: event.id,
    eventSlug: event.slug,
    title: event.title,
    startsAt: event.startsAt,
    paidSeats,
    complimentarySeats,
    capacity,
    fillRate,
    revenueMxn: econ.revenueMxn,
    costTotalMxn: econ.costTotalMxn,
    marginMxn: econ.marginMxn,
    satisfactionOverall: sat.overall,
    satisfactionResponses: sat.responseCount,
  };
}

/**
 * Past non-draft dinners, newest first (capped).
 * Totals = sum of the included dinners (not unlimited history beyond the cap).
 */
export function buildMesaSeries(
  events: AdminEvent[],
  participations: AdminEventParticipation[],
  nowMs = Date.now(),
  limit = MAX_DINNERS,
): MesaSeriesSummary {
  const past = events
    .filter((event) => {
      if (event.status === "draft") return false;
      const ms = new Date(event.startsAt).getTime();
      return Number.isFinite(ms) && ms <= nowMs;
    })
    .sort(
      (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
    )
    .slice(0, Math.max(1, limit));

  const dinners = past.map((event) => summarizeDinner(event, participations));

  let totalPaidSeats = 0;
  let totalComplimentarySeats = 0;
  let revenueMxn = 0;
  let costTotalMxn = 0;
  let marginMxn = 0;
  let satSum = 0;
  let satWeight = 0;

  for (const d of dinners) {
    totalPaidSeats += d.paidSeats;
    totalComplimentarySeats += d.complimentarySeats;
    revenueMxn += d.revenueMxn;
    costTotalMxn += d.costTotalMxn;
    marginMxn += d.marginMxn;
    if (d.satisfactionOverall != null && d.satisfactionResponses > 0) {
      satSum += d.satisfactionOverall * d.satisfactionResponses;
      satWeight += d.satisfactionResponses;
    }
  }

  return {
    dinnerCount: dinners.length,
    totalPaidSeats,
    totalComplimentarySeats,
    revenueMxn: Math.round(revenueMxn * 100) / 100,
    costTotalMxn: Math.round(costTotalMxn * 100) / 100,
    marginMxn: Math.round(marginMxn * 100) / 100,
    avgSatisfaction:
      satWeight > 0 ? Math.round((satSum / satWeight) * 10) / 10 : null,
    dinners,
  };
}

import type { EventParticipationStatus } from "@/lib/types/events";

const CANONICAL: EventParticipationStatus[] = [
  "invited",
  "attending",
  "confirmed",
  "comped",
  "not_attending",
  "waitlist",
];

/** Map legacy Firestore values to the current status vocabulary. */
export function normalizeParticipationStatus(
  raw: string | null | undefined,
): EventParticipationStatus {
  const s = String(raw ?? "invited");
  if (s === "present") return "confirmed";
  if (s === "declined") return "not_attending";
  if ((CANONICAL as string[]).includes(s)) return s as EventParticipationStatus;
  return "invited";
}

export const PARTICIPATION_STATUSES: EventParticipationStatus[] = [
  "invited",
  "attending",
  "confirmed",
  "comped",
  "not_attending",
  "waitlist",
];

/** Paid seat — generates CA. */
export function isPaidSeatStatus(status: string | null | undefined): boolean {
  return normalizeParticipationStatus(status) === "confirmed";
}

/** Complimentary “Invité” — seated, COST yes, CA no. */
export function isComplimentarySeatStatus(status: string | null | undefined): boolean {
  return normalizeParticipationStatus(status) === "comped";
}

/** Seat held at the table (paid or complimentary), excluding waitlist / out. */
export function isHeldSeatStatus(status: string | null | undefined): boolean {
  const s = normalizeParticipationStatus(status);
  return s === "confirmed" || s === "comped";
}

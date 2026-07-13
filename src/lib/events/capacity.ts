import type { AdminEventParticipation, EventParticipationStatus } from "@/lib/types/events";

/** Places taken at the table (excludes declined + waitlist). Admin seat is separate. */
export function isSeatedStatus(status: string | undefined): boolean {
  return status === "invited" || status === "present";
}

export function countSeatedParticipations(
  parts: Array<Pick<AdminEventParticipation, "status">>,
): number {
  return parts.filter((p) => isSeatedStatus(p.status)).length;
}

/** Next status when adding a guest: fill seats first, then waitlist. */
export function nextInviteStatus(
  capacity: number,
  currentlySeated: number,
): Extract<EventParticipationStatus, "invited" | "waitlist"> {
  const cap = Number.isFinite(capacity) && capacity > 0 ? capacity : 15;
  return currentlySeated < cap ? "invited" : "waitlist";
}

/** Total covers including the organizing admin. */
export function totalCoversWithAdmin(guestCapacity: number): number {
  return Math.max(0, guestCapacity) + 1;
}

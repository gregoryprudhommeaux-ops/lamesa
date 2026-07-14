import type { AdminEventParticipation, EventParticipationStatus } from "@/lib/types/events";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import { isPlatformAdminEmail } from "@/lib/auth/platform-admin";

/** Guest seats at a standard LA MESA dinner (organizer is separate). */
export const DEFAULT_GUEST_CAPACITY = 15;
/** Total people at the table including Gregory (organizer). */
export const DEFAULT_TOTAL_COVERS = DEFAULT_GUEST_CAPACITY + 1; // 16

/** Places reserved at the table (excludes not_attending + waitlist). Admin seat is separate. */
export function isSeatedStatus(status: string | undefined): boolean {
  const s = normalizeParticipationStatus(status);
  return s === "invited" || s === "attending" || s === "confirmed";
}

export function isOrganizerParticipation(
  p: Pick<AdminEventParticipation, "isOrganizer" | "email">,
): boolean {
  return Boolean(p.isOrganizer) || isPlatformAdminEmail(p.email);
}

export function countSeatedParticipations(
  parts: Array<Pick<AdminEventParticipation, "status" | "isOrganizer" | "email">>,
): number {
  return parts.filter((p) => isSeatedStatus(p.status) && !isOrganizerParticipation(p)).length;
}

/** Next status when adding a guest: fill seats first, then waitlist. */
export function nextInviteStatus(
  capacity: number,
  currentlySeated: number,
): Extract<EventParticipationStatus, "invited" | "waitlist"> {
  const cap =
    Number.isFinite(capacity) && capacity > 0 ? capacity : DEFAULT_GUEST_CAPACITY;
  return currentlySeated < cap ? "invited" : "waitlist";
}

/** Total covers including the organizing admin. */
export function totalCoversWithAdmin(guestCapacity: number): number {
  return Math.max(0, guestCapacity) + 1;
}

/** Form/UI total → stored guest capacity (total includes organizer). */
export function guestCapacityFromTotalCovers(totalCovers: number): number {
  const total =
    Number.isFinite(totalCovers) && totalCovers > 0
      ? Math.floor(totalCovers)
      : DEFAULT_TOTAL_COVERS;
  return Math.max(1, total - 1);
}

/** Stored guest capacity → form/UI total covers. */
export function totalCoversFromGuestCapacity(guestCapacity: number | null | undefined): number {
  const guests =
    typeof guestCapacity === "number" && Number.isFinite(guestCapacity) && guestCapacity > 0
      ? Math.floor(guestCapacity)
      : DEFAULT_GUEST_CAPACITY;
  return guests + 1;
}

/** Fellows shown to guests: people who RSVP'd yes or are confirmed. */
export function isFellowVisibleStatus(status: string | undefined): boolean {
  const s = normalizeParticipationStatus(status);
  return s === "attending" || s === "confirmed";
}

/** Past dashboard "participations" count. */
export function isPastParticipationStatus(status: string | undefined): boolean {
  const s = normalizeParticipationStatus(status);
  return s === "attending" || s === "confirmed" || s === "invited";
}

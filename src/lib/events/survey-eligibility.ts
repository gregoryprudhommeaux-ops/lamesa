import { normalizeParticipationStatus } from "@/lib/events/participation-status";

/**
 * Survey goes to paid seats only.
 * `present` normalizes to `confirmed`. RSVP yes without payment (`attending`) is excluded.
 */
export function isPaidGuestStatus(status: string | null | undefined): boolean {
  return normalizeParticipationStatus(status) === "confirmed";
}

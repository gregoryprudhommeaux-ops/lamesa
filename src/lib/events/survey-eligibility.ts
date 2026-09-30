import {
  isComplimentarySeatStatus,
  isPaidSeatStatus,
} from "@/lib/events/participation-status";

/**
 * Survey goes to seats that held a place at the table:
 * paid (`confirmed`) and complimentary (`comped`).
 * RSVP yes without payment (`attending`) is excluded.
 */
export function isPaidGuestStatus(status: string | null | undefined): boolean {
  return isPaidSeatStatus(status) || isComplimentarySeatStatus(status);
}

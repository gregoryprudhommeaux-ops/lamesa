import { isOrganizerParticipation } from "@/lib/events/capacity";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import type { AdminEventParticipation } from "@/lib/types/events";

/** Held seat (paid or complimentary) eligible for door check-in (excludes organizer). */
export function isCheckinEligible(
  p: Pick<AdminEventParticipation, "status" | "isOrganizer" | "email">,
): boolean {
  if (isOrganizerParticipation(p)) return false;
  const s = normalizeParticipationStatus(p.status);
  return s === "confirmed" || s === "comped";
}

export function isCheckedIn(
  p: Pick<AdminEventParticipation, "checkedInAt">,
): boolean {
  return Boolean(p.checkedInAt);
}

export type CheckinFilterId = "all" | "pending" | "present";

export function filterCheckinRows(
  participations: AdminEventParticipation[],
  filter: CheckinFilterId,
): AdminEventParticipation[] {
  const eligible = participations
    .filter(isCheckinEligible)
    .sort((a, b) =>
      (a.fullName || a.email).localeCompare(b.fullName || b.email, "fr", {
        sensitivity: "base",
      }),
    );
  if (filter === "pending") return eligible.filter((p) => !isCheckedIn(p));
  if (filter === "present") return eligible.filter(isCheckedIn);
  return eligible;
}

export function countCheckin(participations: AdminEventParticipation[]): {
  paid: number;
  present: number;
  pending: number;
} {
  const eligible = participations.filter(isCheckinEligible);
  const present = eligible.filter(isCheckedIn).length;
  return {
    paid: eligible.length,
    present,
    pending: eligible.length - present,
  };
}

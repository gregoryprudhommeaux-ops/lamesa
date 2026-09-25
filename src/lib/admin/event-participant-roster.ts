import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import { isOrganizerParticipation } from "@/lib/events/capacity";
import type { AdminEventParticipation, EventParticipationStatus } from "@/lib/types/events";

export type RosterFilterId =
  | "all"
  | "waitlist"
  | "invited"
  | "attending"
  | "paid"
  | "unpaid_invite"
  | "out";

export const ROSTER_FILTERS: Array<{ id: RosterFilterId; label: string }> = [
  { id: "all", label: "Tous" },
  { id: "waitlist", label: "Waitlist" },
  { id: "invited", label: "Invités" },
  { id: "attending", label: "Présents (RSVP)" },
  { id: "paid", label: "Payés" },
  { id: "unpaid_invite", label: "À relancer €" },
  { id: "out", label: "Ne vient pas" },
];

export function rosterCanonicalStatus(
  status: EventParticipationStatus,
): EventParticipationStatus {
  return normalizeParticipationStatus(status);
}

export function participationMatchesRosterFilter(
  p: AdminEventParticipation,
  filter: RosterFilterId,
): boolean {
  if (isOrganizerParticipation(p)) return false;
  const status = rosterCanonicalStatus(p.status);
  switch (filter) {
    case "all":
      return true;
    case "waitlist":
      return status === "waitlist";
    case "invited":
      return status === "invited";
    case "attending":
      return status === "attending";
    case "paid":
      return status === "confirmed";
    case "unpaid_invite":
      return (
        Boolean(p.calendarInviteSentAt) &&
        (status === "invited" || status === "attending" || status === "waitlist")
      );
    case "out":
      return status === "not_attending";
    default:
      return true;
  }
}

export function filterParticipationsForRoster(
  participations: AdminEventParticipation[],
  filter: RosterFilterId,
): AdminEventParticipation[] {
  return participations.filter((p) => participationMatchesRosterFilter(p, filter));
}

export function countRosterFilters(
  participations: AdminEventParticipation[],
): Record<RosterFilterId, number> {
  const ids = ROSTER_FILTERS.map((f) => f.id);
  const out = {} as Record<RosterFilterId, number>;
  for (const id of ids) {
    out[id] = filterParticipationsForRoster(participations, id).length;
  }
  return out;
}

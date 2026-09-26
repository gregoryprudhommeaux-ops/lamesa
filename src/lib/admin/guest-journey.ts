/**
 * Unified person×dinner journey stage — one business label across ops phases.
 * Observed from participation status + email stamps (not inferred fit scores).
 */
import { isOrganizerParticipation } from "@/lib/events/capacity";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import type { AdminEventParticipation } from "@/lib/types/events";

export type GuestJourneyStageId =
  | "organizer"
  | "waitlist"
  | "out"
  | "surveyed"
  | "checked_in"
  | "paid"
  | "comped"
  | "to_pay"
  | "invited_formal"
  | "interested"
  | "std_sent"
  | "selected";

export type GuestJourneyStage = {
  id: GuestJourneyStageId;
  /** Short FR label for roster / lists. */
  label: string;
};

const LABELS: Record<GuestJourneyStageId, string> = {
  organizer: "Organisateur",
  waitlist: "Waitlist",
  out: "Ne vient pas",
  surveyed: "Feedback reçu",
  checked_in: "Présent (soir J)",
  paid: "Payé",
  comped: "Invité (offert)",
  to_pay: "À payer",
  invited_formal: "Invité formel",
  interested: "OUI / intéressé",
  std_sent: "STD envoyé",
  selected: "Sélectionné",
};

/**
 * Resolve where a guest sits in the dinner journey.
 * Priority: terminal states → presence → payment → invite → interest → STD → selected.
 */
export function resolveGuestJourneyStage(
  p: Pick<
    AdminEventParticipation,
    | "status"
    | "isOrganizer"
    | "email"
    | "fullName"
    | "saveTheDateSentAt"
    | "calendarInviteSentAt"
    | "checkedInAt"
    | "satisfactionSurvey"
  >,
): GuestJourneyStage {
  if (isOrganizerParticipation(p)) {
    return { id: "organizer", label: LABELS.organizer };
  }

  const status = normalizeParticipationStatus(p.status);

  if (status === "waitlist") return { id: "waitlist", label: LABELS.waitlist };
  if (status === "not_attending") return { id: "out", label: LABELS.out };

  if (p.satisfactionSurvey?.submittedAt) {
    return { id: "surveyed", label: LABELS.surveyed };
  }
  if (p.checkedInAt) {
    return { id: "checked_in", label: LABELS.checked_in };
  }
  if (status === "confirmed") return { id: "paid", label: LABELS.paid };
  if (status === "comped") return { id: "comped", label: LABELS.comped };

  if (p.calendarInviteSentAt) {
    if (status === "invited" || status === "attending") {
      return { id: "to_pay", label: LABELS.to_pay };
    }
    return { id: "invited_formal", label: LABELS.invited_formal };
  }

  if (status === "attending") {
    return { id: "interested", label: LABELS.interested };
  }

  if (p.saveTheDateSentAt) {
    return { id: "std_sent", label: LABELS.std_sent };
  }

  return { id: "selected", label: LABELS.selected };
}

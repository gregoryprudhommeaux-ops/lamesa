import type { EventInterestDeclineReason, EventInterestResponse } from "@/lib/types/events";
import type { ProspectStatus } from "@/lib/types/prospects";

/**
 * Map a Save-the-Date interest answer → prospect CRM status.
 * Preserves do_not_contact when already set.
 */
export function prospectStatusFromInterest(input: {
  interestResponse: EventInterestResponse;
  declineReason?: EventInterestDeclineReason | string | null;
  existingStatus?: ProspectStatus | null;
}): ProspectStatus | undefined {
  if (input.existingStatus === "do_not_contact") return undefined;

  if (input.interestResponse === "yes") return "won";

  if (input.interestResponse === "no") {
    const reason = String(input.declineReason ?? "").trim();
    if (reason === "not_available") return "no_not_available";
    if (reason === "want_to_know_more") return "to_follow";
    // not_interested_format | not_interested_theme | other | too_expensive (legacy)
    return "no_not_interested";
  }

  // interestResponse === "other"
  return "to_follow";
}

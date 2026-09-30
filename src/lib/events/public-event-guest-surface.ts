/**
 * Resolve what the public `/e/[slug]` page should show a visitor
 * (interest OUI/NON vs already answered vs ACCESS payment).
 * Epistemic: observed from respondent + participation rows only.
 */
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import { isPaidGuestStatus } from "@/lib/events/survey-eligibility";
import type { EventInterestResponse } from "@/lib/types/events";

export type PublicEventGuestSurface =
  | "interest_form"
  | "interest_done"
  | "pay_access"
  | "confirmed";

export type PublicEventGuestParticipation = {
  id?: string;
  status?: string | null;
  calendarInviteSentAt?: string | null;
  paymentDeclaredAt?: string | null;
};

export function resolvePublicEventGuestSurface(input: {
  responseMode: "interest" | "rsvp" | string | null | undefined;
  interestResponse?: EventInterestResponse | string | null;
  participation?: PublicEventGuestParticipation | null;
}): {
  surface: PublicEventGuestSurface;
  interestResponse: EventInterestResponse | null;
  participationId: string | null;
  paymentDeclaredAt: string | null;
} {
  const interest =
    input.interestResponse === "yes" ||
    input.interestResponse === "no" ||
    input.interestResponse === "other"
      ? input.interestResponse
      : null;

  const part = input.participation ?? null;
  const participationId = part?.id?.trim() || null;
  const paymentDeclaredAt = part?.paymentDeclaredAt?.trim() || null;
  const status = part?.status ? normalizeParticipationStatus(part.status) : null;

  if (status === "not_attending") {
    return {
      surface: interest ? "interest_done" : "interest_form",
      interestResponse: interest,
      participationId,
      paymentDeclaredAt,
    };
  }

  if (status && isPaidGuestStatus(status)) {
    return {
      surface: "confirmed",
      interestResponse: interest,
      participationId,
      paymentDeclaredAt,
    };
  }

  if (part?.calendarInviteSentAt) {
    return {
      surface: "pay_access",
      interestResponse: interest,
      participationId,
      paymentDeclaredAt,
    };
  }

  if (input.responseMode === "interest" && interest) {
    return {
      surface: "interest_done",
      interestResponse: interest,
      participationId,
      paymentDeclaredAt,
    };
  }

  return {
    surface: "interest_form",
    interestResponse: interest,
    participationId,
    paymentDeclaredAt,
  };
}

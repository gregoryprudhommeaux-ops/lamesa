/**
 * Bridge interest OUI/NON/sans réponse → email map for Audience/roster.
 * Does not merge Firestore collections — join by email only.
 */
import type { InterestRsvpEmailSets } from "@/lib/admin/next-event-rsvp";

export type InterestDisplayStatus = "oui" | "non" | "autre" | "sans_reponse";

export const INTEREST_DISPLAY_LABELS: Record<InterestDisplayStatus, string> = {
  oui: "OUI",
  non: "NON",
  autre: "AUTRE",
  sans_reponse: "Sans réponse",
};

/**
 * Priority: oui > non > autre > sans_reponse.
 * Only emails present in the interest sets are mapped (null elsewhere).
 */
export function buildInterestDisplayByEmail(
  sets: InterestRsvpEmailSets,
): Map<string, InterestDisplayStatus> {
  const map = new Map<string, InterestDisplayStatus>();
  for (const email of sets.pendingEmails) {
    map.set(email, "sans_reponse");
  }
  for (const email of sets.otherEmails) {
    map.set(email, "autre");
  }
  for (const email of sets.noEmails) {
    map.set(email, "non");
  }
  for (const email of sets.yesEmails) {
    map.set(email, "oui");
  }
  return map;
}

export function resolveInterestDisplay(
  email: string | null | undefined,
  byEmail: Map<string, InterestDisplayStatus> | Record<string, InterestDisplayStatus> | null | undefined,
): InterestDisplayStatus | null {
  if (!email || !byEmail) return null;
  const key = email.trim().toLowerCase();
  if (!key) return null;
  if (byEmail instanceof Map) return byEmail.get(key) ?? null;
  return byEmail[key] ?? null;
}

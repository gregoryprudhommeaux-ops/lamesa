import type { EventParticipationStatus } from "@/lib/types/events";

const CANONICAL: EventParticipationStatus[] = [
  "invited",
  "attending",
  "confirmed",
  "not_attending",
  "waitlist",
];

/** Map legacy Firestore values to the current status vocabulary. */
export function normalizeParticipationStatus(
  raw: string | null | undefined,
): EventParticipationStatus {
  const s = String(raw ?? "invited");
  if (s === "present") return "confirmed";
  if (s === "declined") return "not_attending";
  if ((CANONICAL as string[]).includes(s)) return s as EventParticipationStatus;
  return "invited";
}

export const PARTICIPATION_STATUSES: EventParticipationStatus[] = [
  "invited",
  "attending",
  "confirmed",
  "not_attending",
  "waitlist",
];

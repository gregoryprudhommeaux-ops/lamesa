/**
 * Vague 3 — promote interest OUI into event participations (Audience roster).
 * Join-by-email only; does not delete or demote paid / formal / out seats.
 */
import { normalizeEmail } from "@/lib/auth/platform-admin";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import type { EventParticipationStatus } from "@/lib/types/events";

export type OuiParticipationInput = {
  id: string;
  email: string;
  status?: string | null;
  calendarInviteSentAt?: string | null;
  isOrganizer?: boolean;
};

export type OuiUpsertPlan =
  | { action: "create"; email: string }
  | { action: "promote"; participationId: string; email: string; from: EventParticipationStatus }
  | { action: "noop"; email: string; reason: string };

/**
 * Decide how to land an OUI email on the Audience roster.
 */
export function planOuiParticipationUpsert(
  emailRaw: string,
  existing: OuiParticipationInput | null | undefined,
): OuiUpsertPlan {
  const email = normalizeEmail(emailRaw);
  if (!email.includes("@")) {
    return { action: "noop", email: emailRaw, reason: "invalid_email" };
  }
  if (!existing) {
    return { action: "create", email };
  }
  if (existing.isOrganizer) {
    return { action: "noop", email, reason: "organizer" };
  }
  const status = normalizeParticipationStatus(existing.status);
  if (status === "confirmed" || status === "comped" || status === "not_attending") {
    return { action: "noop", email, reason: `terminal:${status}` };
  }
  if (existing.calendarInviteSentAt) {
    return { action: "noop", email, reason: "formal_invite_sent" };
  }
  if (status === "attending") {
    return { action: "noop", email, reason: "already_attending" };
  }
  if (status === "waitlist" || status === "invited") {
    return {
      action: "promote",
      participationId: existing.id,
      email,
      from: status,
    };
  }
  return { action: "noop", email, reason: `status:${status}` };
}

export function planOuiParticipationUpserts(input: {
  ouiEmails: string[];
  participations: OuiParticipationInput[];
}): OuiUpsertPlan[] {
  const byEmail = new Map<string, OuiParticipationInput>();
  for (const p of input.participations) {
    const email = normalizeEmail(p.email);
    if (!email.includes("@")) continue;
    byEmail.set(email, { ...p, email });
  }
  const seen = new Set<string>();
  const plans: OuiUpsertPlan[] = [];
  for (const raw of input.ouiEmails) {
    const email = normalizeEmail(raw);
    if (!email.includes("@") || seen.has(email)) continue;
    seen.add(email);
    plans.push(planOuiParticipationUpsert(email, byEmail.get(email)));
  }
  return plans;
}

export function summarizeOuiUpsertPlans(plans: OuiUpsertPlan[]): {
  create: number;
  promote: number;
  noop: number;
} {
  let create = 0;
  let promote = 0;
  let noop = 0;
  for (const p of plans) {
    if (p.action === "create") create += 1;
    else if (p.action === "promote") promote += 1;
    else noop += 1;
  }
  return { create, promote, noop };
}

/**
 * Pure helpers for Confirmation & paiement follow-up (declared ≠ paid).
 */
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import type { AdminEventParticipation, EventParticipationStatus } from "@/lib/types/events";

export type InviteMemberStatus = "declared" | "relance" | "paid" | "comped" | "out";

export type PaymentFollowupCounts = {
  all: number;
  declared: number;
  relance: number;
  paid: number;
  comped: number;
  out: number;
};

export function toInviteMemberStatus(
  p: Pick<AdminEventParticipation, "status" | "paymentDeclaredAt">,
): InviteMemberStatus {
  const status = normalizeParticipationStatus(p.status);
  if (status === "confirmed") return "paid";
  if (status === "comped") return "comped";
  if (status === "not_attending") return "out";
  if (p.paymentDeclaredAt) return "declared";
  return "relance";
}

export function inviteMemberStatusToParticipation(
  s: InviteMemberStatus,
): EventParticipationStatus {
  if (s === "paid") return "confirmed";
  if (s === "comped") return "comped";
  if (s === "out") return "not_attending";
  // declared stays invited until admin confirms Payé
  return "invited";
}

/** Prefer bank-check queue when anyone declared SPEI. */
export function defaultPaymentFilter(
  counts: Pick<PaymentFollowupCounts, "declared" | "relance">,
): InviteMemberStatus {
  if (counts.declared > 0) return "declared";
  return "relance";
}

export function countPaymentDeclaredUnpaid(
  parts: Array<Pick<AdminEventParticipation, "status" | "paymentDeclaredAt" | "calendarInviteSentAt">>,
): number {
  return parts.filter((p) => {
    if (!p.paymentDeclaredAt) return false;
    if (!p.calendarInviteSentAt) return false;
    const s = normalizeParticipationStatus(p.status);
    return s === "invited" || s === "attending";
  }).length;
}

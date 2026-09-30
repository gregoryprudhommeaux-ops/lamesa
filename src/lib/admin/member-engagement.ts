import { isOrganizerParticipation } from "@/lib/events/capacity";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import { computeEventIva } from "@/lib/events/pricing";
import type { AdminEvent, AdminEventParticipation, WaitlistRegistration } from "@/lib/types/events";

export type MemberEngagement = {
  invitationsSent: number;
  eventsConfirmed: number;
  revenueMxn: number;
  referralsMade: number;
};

export type EngagementParticipation = Pick<
  AdminEventParticipation,
  "id" | "email" | "contactId" | "status" | "isOrganizer" | "eventId"
>;

export type EngagementEvent = Pick<
  AdminEvent,
  "id" | "priceMxn" | "priceIncludesIva" | "priceIncludesService"
>;

export type EngagementMember = Pick<WaitlistRegistration, "id" | "email" | "referralCode">;

function normalizeEmail(email: string | null | undefined): string {
  return String(email ?? "")
    .trim()
    .toLowerCase();
}

/** Invitation pathway: guest was invited (not merely put on event waitlist). */
export function countsAsInvitation(status: string | null | undefined): boolean {
  const s = normalizeParticipationStatus(status);
  return (
    s === "invited" ||
    s === "attending" ||
    s === "confirmed" ||
    s === "comped" ||
    s === "not_attending"
  );
}

/** Paid seat — generates CA. */
export function countsAsConfirmed(status: string | null | undefined): boolean {
  return normalizeParticipationStatus(status) === "confirmed";
}

/** Complimentary “Invité” — seated, COST yes, CA no. */
export function countsAsComplimentary(status: string | null | undefined): boolean {
  return normalizeParticipationStatus(status) === "comped";
}

export function countReferralsMade(
  member: EngagementMember,
  waitlist: Array<
    Pick<
      WaitlistRegistration,
      "id" | "referredById" | "referredByCode" | "referralAcceptedAt" | "deletedAt"
    >
  >,
): number {
  const code = member.referralCode?.trim().toUpperCase() ?? "";
  const seen = new Set<string>();
  for (const row of waitlist) {
    if (row.deletedAt) continue;
    if (!row.referralAcceptedAt) continue;
    const matchId = row.referredById === member.id;
    const matchCode = Boolean(code && row.referredByCode?.trim().toUpperCase() === code);
    if (matchId || matchCode) seen.add(row.id);
  }
  return seen.size;
}

export function buildMemberEngagementIndex(input: {
  members: EngagementMember[];
  participations: EngagementParticipation[];
  events: EngagementEvent[];
  waitlist: Array<
    Pick<
      WaitlistRegistration,
      "id" | "referredById" | "referredByCode" | "referralAcceptedAt" | "deletedAt"
    >
  >;
}): Map<string, MemberEngagement> {
  const priceByEvent = new Map<
    string,
    { price: number; includeIva: boolean; includeService: boolean }
  >();
  for (const ev of input.events) {
    const price = typeof ev.priceMxn === "number" && Number.isFinite(ev.priceMxn) ? ev.priceMxn : 0;
    priceByEvent.set(ev.id, {
      price,
      includeIva: ev.priceIncludesIva !== false,
      includeService: ev.priceIncludesService !== false,
    });
  }

  const partsByEmail = new Map<string, EngagementParticipation[]>();
  const partsByContactId = new Map<string, EngagementParticipation[]>();
  for (const part of input.participations) {
    if (isOrganizerParticipation(part)) continue;
    const email = normalizeEmail(part.email);
    if (email) {
      const list = partsByEmail.get(email) ?? [];
      list.push(part);
      partsByEmail.set(email, list);
    }
    const contactId = part.contactId?.trim();
    if (contactId) {
      const list = partsByContactId.get(contactId) ?? [];
      list.push(part);
      partsByContactId.set(contactId, list);
    }
  }

  const result = new Map<string, MemberEngagement>();

  for (const member of input.members) {
    const byId = new Map<string, EngagementParticipation>();
    for (const p of partsByContactId.get(member.id) ?? []) byId.set(p.id, p);
    for (const p of partsByEmail.get(normalizeEmail(member.email)) ?? []) byId.set(p.id, p);

    let invitationsSent = 0;
    let eventsConfirmed = 0;
    let revenueMxn = 0;

    for (const part of byId.values()) {
      if (countsAsInvitation(part.status)) invitationsSent += 1;
      if (countsAsConfirmed(part.status)) {
        eventsConfirmed += 1;
        const ticket = priceByEvent.get(part.eventId);
        revenueMxn += computeEventIva(ticket?.price ?? 0, {
          includeIva: ticket?.includeIva !== false,
          includeService: ticket?.includeService !== false,
        }).totalWithIva;
      }
    }

    result.set(member.id, {
      invitationsSent,
      eventsConfirmed,
      revenueMxn: Math.round(revenueMxn * 100) / 100,
      referralsMade: countReferralsMade(member, input.waitlist),
    });
  }

  return result;
}

import {
  countsAsConfirmed,
  countsAsInvitation,
} from "@/lib/admin/member-engagement";
import { isOrganizerParticipation } from "@/lib/events/capacity";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import { computeEventIva } from "@/lib/events/pricing";
import { normalizeProspectEmail } from "@/lib/prospects/normalize";
import type { ContactActivity, ContactStats } from "@/lib/types/contact-activities";
import type { AdminEvent, AdminEventParticipation, WaitlistRegistration } from "@/lib/types/events";
import type { Prospect } from "@/lib/types/prospects";

export function buildContactStats(input: {
  email: string;
  prospect: Prospect | null;
  waitlist: WaitlistRegistration | null;
  participations: Array<
    Pick<
      AdminEventParticipation,
      "id" | "email" | "eventId" | "status" | "isOrganizer" | "contactId"
    >
  >;
  events: Array<Pick<AdminEvent, "id" | "title" | "startsAt" | "priceMxn">>;
  activities: ContactActivity[];
}): ContactStats {
  const email = normalizeProspectEmail(input.email);
  const waitlistId = input.waitlist?.id;

  const byId = new Map<string, (typeof input.participations)[number]>();
  for (const p of input.participations) {
    if (isOrganizerParticipation(p)) continue;
    const matchEmail = normalizeProspectEmail(p.email) === email;
    const matchContact = Boolean(waitlistId && p.contactId === waitlistId);
    if (!matchEmail && !matchContact) continue;
    byId.set(p.id, p);
  }

  const eventById = new Map(input.events.map((e) => [e.id, e]));
  let invitationsCount = 0;
  let confirmedCount = 0;
  let declinedCount = 0;
  let revenueMxn = 0;
  const events: ContactStats["events"] = [];

  for (const part of byId.values()) {
    const status = normalizeParticipationStatus(part.status);
    if (countsAsInvitation(status)) invitationsCount += 1;
    if (status === "not_attending") declinedCount += 1;
    if (countsAsConfirmed(status)) {
      confirmedCount += 1;
      const price = eventById.get(part.eventId)?.priceMxn ?? 0;
      const priceBeforeTax =
        typeof price === "number" && Number.isFinite(price) ? price : 0;
      revenueMxn += computeEventIva(priceBeforeTax).totalWithIva;
    }
    const ev = eventById.get(part.eventId);
    events.push({
      eventId: part.eventId,
      title: ev?.title?.trim() || part.eventId,
      startsAt: ev?.startsAt ?? null,
      status,
      participationId: part.id,
    });
  }

  events.sort((a, b) => String(b.startsAt ?? "").localeCompare(String(a.startsAt ?? "")));

  const outreachDates = [
    input.prospect?.lastContactedAt,
    ...input.activities.filter((a) => a.type === "email_sent").map((a) => a.at),
  ].filter((x): x is string => Boolean(x && String(x).trim()));
  outreachDates.sort();
  const lastOutreachAt = outreachDates.at(-1) ?? null;

  return {
    addedAt: input.prospect?.createdAt ?? null,
    registeredAt: input.waitlist?.createdAt ?? null,
    invitationsCount,
    confirmedCount,
    declinedCount,
    revenueMxn: Math.round(revenueMxn * 100) / 100,
    lastOutreachAt,
    events,
  };
}

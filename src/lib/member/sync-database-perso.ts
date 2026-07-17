import {
  isDatabasePersoConfigured,
  upsertContact,
  type UpsertContactPayload,
} from "@/lib/database-perso";
import type { WaitlistRegistration } from "@/lib/types/events";

export type WaitlistSyncInput = Pick<
  WaitlistRegistration,
  | "fullName"
  | "email"
  | "phone"
  | "company"
  | "sector"
  | "position"
  | "city"
  | "linkedinUrl"
  | "extraActivities"
  | "invitationMotivation"
  | "canBring"
  | "isSeeking"
  | "locale"
  | "source"
  | "tags"
  | "referredByCode"
>;

function buildNotes(member: WaitlistSyncInput): string {
  const lines = [
    member.linkedinUrl?.trim() ? `LinkedIn: ${member.linkedinUrl.trim()}` : null,
    member.sector?.trim() ? `Secteur: ${member.sector.trim()}` : null,
    member.position?.trim() ? `Poste: ${member.position.trim()}` : null,
    member.extraActivities?.length
      ? `Activités: ${member.extraActivities.join(", ")}`
      : null,
    member.city?.trim() ? `Ville: ${member.city.trim()}` : null,
    member.invitationMotivation?.trim()
      ? `Motivation: ${member.invitationMotivation.trim()}`
      : null,
    member.canBring?.trim() ? `Puede aportar: ${member.canBring.trim()}` : null,
    member.isSeeking?.trim() ? `Busca: ${member.isSeeking.trim()}` : null,
    member.referredByCode?.trim() ? `Parrainé via: ${member.referredByCode.trim()}` : null,
    member.source?.includes("express") || member.source?.includes("light")
      ? "Inscription express (/light)"
      : null,
  ].filter(Boolean);
  return lines.join("\n");
}

export function toDatabasePersoUpsertPayload(member: WaitlistSyncInput): UpsertContactPayload {
  const email = member.email?.trim() ?? "";
  const phone = member.phone?.trim() ?? "";
  return {
    fullName: member.fullName?.trim() || "Inconnu",
    linkedinUrl: member.linkedinUrl?.trim() || undefined,
    emails: email ? [email] : [],
    phones: phone ? [phone] : [],
    company: member.company?.trim() || undefined,
    sector: member.sector?.trim() || undefined,
    position: member.position?.trim() || undefined,
    extraActivities: member.extraActivities?.length ? member.extraActivities : undefined,
    city: member.city?.trim() || undefined,
    tags: member.tags?.length ? member.tags : ["la-mesa", "waitlist"],
    source: member.source?.trim() || "la-mesa-registration",
    locale: member.locale?.trim() || "es",
    notes: buildNotes(member) || undefined,
  };
}

/**
 * Soft sync: never throws. Registration/profile must succeed even if Database Perso is down.
 */
export async function syncWaitlistMemberToDatabasePerso(
  member: WaitlistSyncInput,
  logPrefix = "[database-perso]",
): Promise<{ ok: boolean; id?: string; skipped?: boolean }> {
  if (!isDatabasePersoConfigured()) {
    return { ok: false, skipped: true };
  }

  const payload = toDatabasePersoUpsertPayload(member);
  if (payload.emails.length === 0 && payload.phones.length === 0) {
    console.warn(`${logPrefix} skip upsert — missing email and phone`);
    return { ok: false, skipped: true };
  }

  try {
    const result = await upsertContact(payload);
    if (!result.ok) {
      console.warn(`${logPrefix} upsert returned not ok`, result);
    }
    return result;
  } catch (error) {
    console.error(`${logPrefix} upsert failed:`, error);
    return { ok: false };
  }
}

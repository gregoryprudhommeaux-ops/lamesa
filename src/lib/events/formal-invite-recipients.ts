import { normalizeEmail } from "@/lib/auth/platform-admin";
import { interestProspectListNames } from "@/lib/events/interest-prospect-lists";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import { COLLECTIONS, getAdminFirestore } from "@/lib/firebase/admin";
import { isSoftDeleted } from "@/lib/member/soft-delete";
import { listProspects } from "@/lib/prospects/store";
import type { AdminEventParticipation, EventRespondent } from "@/lib/types/events";

export type FormalInviteRecipient = {
  email: string;
  fullName: string;
  company: string;
  phone: string;
  source: "respondent" | "prospect" | "both";
  participationId: string | null;
  participationStatus: string | null;
  calendarInviteSentAt: string | null;
  confirmationEmailSentAt: string | null;
};

function displayName(input: {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
}): string {
  const joined = [input.firstName, input.lastName]
    .map((p) => String(p ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return input.fullName?.trim() || joined || input.email;
}

/**
 * OUI pool for formal invites: CRM playlist `STD {slug} — OUI` only
 * (sync formulaire + ajouts manuels). Enrichit nom/téléphone depuis le formulaire si présent.
 */
export async function listFormalInviteRecipients(input: {
  eventId: string;
  eventSlug: string;
}): Promise<FormalInviteRecipient[]> {
  const db = getAdminFirestore();
  const ouiList = interestProspectListNames(input.eventSlug).yes;

  const [respondentsSnap, partsSnap, ouiProspects] = await Promise.all([
    db
      .collection(COLLECTIONS.respondents)
      .where("eventId", "==", input.eventId)
      .limit(500)
      .get(),
    db
      .collection(COLLECTIONS.participations)
      .where("eventId", "==", input.eventId)
      .limit(500)
      .get(),
    listProspects({ list: ouiList, limit: 500 }),
  ]);

  const respondentsByEmail = new Map<string, EventRespondent & { id: string }>();
  for (const d of respondentsSnap.docs) {
    const r = { id: d.id, ...(d.data() as Omit<EventRespondent, "id">) };
    const email = normalizeEmail(r.email);
    if (!email.includes("@")) continue;
    respondentsByEmail.set(email, r);
  }

  const partsByEmail = new Map<string, AdminEventParticipation>();
  for (const d of partsSnap.docs) {
    const p = { id: d.id, ...(d.data() as Omit<AdminEventParticipation, "id">) };
    const email = normalizeEmail(p.email);
    if (!email.includes("@")) continue;
    partsByEmail.set(email, p);
  }

  const rows: FormalInviteRecipient[] = [];
  for (const p of ouiProspects) {
    if (isSoftDeleted(p)) continue;
    const email = normalizeEmail(p.email);
    if (!email.includes("@")) continue;
    const form = respondentsByEmail.get(email);
    const part = partsByEmail.get(email);
    const fromRespondent = Boolean(form && form.interestResponse === "yes");
    rows.push({
      email,
      fullName:
        p.fullName?.trim() ||
        (form
          ? displayName({
              firstName: form.firstName,
              lastName: form.lastName,
              email,
            })
          : email),
      company: p.company?.trim() || form?.companyName?.trim() || "",
      phone: p.phone?.trim() || form?.whatsapp?.trim() || "",
      source: fromRespondent ? "both" : "prospect",
      participationId: part?.id ?? null,
      participationStatus: part ? normalizeParticipationStatus(part.status) : null,
      calendarInviteSentAt: part?.calendarInviteSentAt ?? null,
      confirmationEmailSentAt: part?.confirmationEmailSentAt ?? null,
    });
  }

  rows.sort((a, b) => a.fullName.localeCompare(b.fullName, "fr"));
  return rows;
}

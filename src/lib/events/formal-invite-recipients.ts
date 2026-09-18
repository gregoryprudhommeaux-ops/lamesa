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
 * OUI pool for an interest-mode event: form respondents + STD OUI playlist,
 * merged with existing participations (invite / confirmation mail timestamps).
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

  const respondents = respondentsSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<EventRespondent, "id">),
  }));

  const partsByEmail = new Map<string, AdminEventParticipation>();
  for (const d of partsSnap.docs) {
    const p = { id: d.id, ...(d.data() as Omit<AdminEventParticipation, "id">) };
    const email = normalizeEmail(p.email);
    if (!email.includes("@")) continue;
    partsByEmail.set(email, p);
  }

  type Acc = {
    email: string;
    fullName: string;
    company: string;
    phone: string;
    fromRespondent: boolean;
    fromProspect: boolean;
  };
  const byEmail = new Map<string, Acc>();

  for (const r of respondents) {
    if (r.interestResponse !== "yes") continue;
    const email = normalizeEmail(r.email);
    if (!email.includes("@")) continue;
    byEmail.set(email, {
      email,
      fullName: displayName({
        firstName: r.firstName,
        lastName: r.lastName,
        email,
      }),
      company: r.companyName?.trim() || "",
      phone: r.whatsapp?.trim() || "",
      fromRespondent: true,
      fromProspect: false,
    });
  }

  for (const p of ouiProspects) {
    if (isSoftDeleted(p)) continue;
    const email = normalizeEmail(p.email);
    if (!email.includes("@")) continue;
    const existing = byEmail.get(email);
    if (existing) {
      existing.fromProspect = true;
      if (!existing.fullName || existing.fullName === email) {
        existing.fullName = p.fullName?.trim() || existing.fullName;
      }
      if (!existing.company) existing.company = p.company?.trim() || "";
      if (!existing.phone) existing.phone = p.phone?.trim() || "";
    } else {
      byEmail.set(email, {
        email,
        fullName: p.fullName?.trim() || email,
        company: p.company?.trim() || "",
        phone: p.phone?.trim() || "",
        fromRespondent: false,
        fromProspect: true,
      });
    }
  }

  const rows: FormalInviteRecipient[] = [...byEmail.values()]
    .map((row) => {
      const part = partsByEmail.get(row.email);
      const source: FormalInviteRecipient["source"] =
        row.fromRespondent && row.fromProspect
          ? "both"
          : row.fromRespondent
            ? "respondent"
            : "prospect";
      return {
        email: row.email,
        fullName: row.fullName,
        company: row.company,
        phone: row.phone,
        source,
        participationId: part?.id ?? null,
        participationStatus: part
          ? normalizeParticipationStatus(part.status)
          : null,
        calendarInviteSentAt: part?.calendarInviteSentAt ?? null,
        confirmationEmailSentAt: part?.confirmationEmailSentAt ?? null,
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "fr"));

  return rows;
}

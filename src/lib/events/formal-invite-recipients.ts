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

export type FormalInviteProspectInput = {
  email: string;
  fullName?: string | null;
  company?: string | null;
  phone?: string | null;
};

export type FormalInviteRespondentInput = {
  email: string;
  interestResponse?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  whatsapp?: string | null;
};

export type FormalInviteParticipationInput = {
  id: string;
  email: string;
  status?: string | null;
  calendarInviteSentAt?: string | null;
  confirmationEmailSentAt?: string | null;
};

/**
 * Union playlist OUI + formulaire OUI (join email).
 * Sync playlist remains useful for CRM hygiene; Formal no longer hard-gates on it.
 */
export function buildFormalInviteRecipientRows(input: {
  ouiProspects: FormalInviteProspectInput[];
  respondents: FormalInviteRespondentInput[];
  participations: FormalInviteParticipationInput[];
}): FormalInviteRecipient[] {
  const respondentsByEmail = new Map<string, FormalInviteRespondentInput>();
  for (const r of input.respondents) {
    const email = normalizeEmail(r.email);
    if (!email.includes("@")) continue;
    respondentsByEmail.set(email, { ...r, email });
  }

  const partsByEmail = new Map<string, FormalInviteParticipationInput>();
  for (const p of input.participations) {
    const email = normalizeEmail(p.email);
    if (!email.includes("@")) continue;
    partsByEmail.set(email, { ...p, email });
  }

  const rowsByEmail = new Map<string, FormalInviteRecipient>();

  for (const p of input.ouiProspects) {
    const email = normalizeEmail(p.email);
    if (!email.includes("@")) continue;
    const form = respondentsByEmail.get(email);
    const part = partsByEmail.get(email);
    const fromRespondent = Boolean(form && form.interestResponse === "yes");
    rowsByEmail.set(email, {
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
      participationStatus: part?.status ? normalizeParticipationStatus(part.status) : null,
      calendarInviteSentAt: part?.calendarInviteSentAt ?? null,
      confirmationEmailSentAt: part?.confirmationEmailSentAt ?? null,
    });
  }

  for (const form of respondentsByEmail.values()) {
    if (form.interestResponse !== "yes") continue;
    const email = normalizeEmail(form.email);
    if (rowsByEmail.has(email)) continue;
    const part = partsByEmail.get(email);
    rowsByEmail.set(email, {
      email,
      fullName: displayName({
        firstName: form.firstName,
        lastName: form.lastName,
        email,
      }),
      company: form.companyName?.trim() || "",
      phone: form.whatsapp?.trim() || "",
      source: "respondent",
      participationId: part?.id ?? null,
      participationStatus: part?.status ? normalizeParticipationStatus(part.status) : null,
      calendarInviteSentAt: part?.calendarInviteSentAt ?? null,
      confirmationEmailSentAt: part?.confirmationEmailSentAt ?? null,
    });
  }

  const rows = [...rowsByEmail.values()];
  rows.sort((a, b) => a.fullName.localeCompare(b.fullName, "fr"));
  return rows;
}

/**
 * OUI pool for formal invites: CRM playlist `STD {slug} — OUI`
 * ∪ respondents with interestResponse=yes (formulaire), join by email.
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
  const participations = partsSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<AdminEventParticipation, "id">),
  }));

  return buildFormalInviteRecipientRows({
    ouiProspects: ouiProspects
      .filter((p) => !isSoftDeleted(p))
      .map((p) => ({
        email: p.email,
        fullName: p.fullName,
        company: p.company,
        phone: p.phone,
      })),
    respondents: respondents.map((r) => ({
      email: r.email,
      interestResponse: r.interestResponse,
      firstName: r.firstName,
      lastName: r.lastName,
      companyName: r.companyName,
      whatsapp: r.whatsapp,
    })),
    participations: participations.map((p) => ({
      id: p.id,
      email: p.email,
      status: p.status,
      calendarInviteSentAt: p.calendarInviteSentAt,
      confirmationEmailSentAt: p.confirmationEmailSentAt,
    })),
  });
}

import { normalizeEmail } from "@/lib/auth/platform-admin";
import { isOrganizerParticipation } from "@/lib/events/capacity";
import {
  interestProspectListNames,
  interestSansReponseListName,
} from "@/lib/events/interest-prospect-lists";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import { COLLECTIONS, getAdminFirestore } from "@/lib/firebase/admin";
import { isFrenchSignal } from "@/lib/member/french-signal";
import { isSoftDeleted } from "@/lib/member/soft-delete";
import { listProspects } from "@/lib/prospects/store";
import type { AdminEventParticipation, EventRespondent, WaitlistRegistration } from "@/lib/types/events";
import type { Prospect } from "@/lib/types/prospects";

export type PlacesAvailableBucket =
  | "french"
  | "sans_reponse"
  | "oui"
  | "eligible";

export type PlacesAvailableCandidate = {
  email: string;
  fullName: string;
  company: string;
  phone: string;
  /** Where we found them */
  sources: Array<"waitlist" | "prospect" | "respondent" | "participation">;
  buckets: PlacesAvailableBucket[];
  onMesa: boolean;
  participationId: string | null;
  participationStatus: string | null;
  placesAvailableSentAt: string | null;
  calendarInviteSentAt: string | null;
  prospectStatus: string | null;
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

function listHas(lists: string[] | undefined, name: string): boolean {
  const key = name.trim().toLowerCase();
  return (lists ?? []).some((l) => l.trim().toLowerCase() === key);
}

/**
 * Candidate pool for “places still available” outreach.
 * Always excludes: NON (pas intéressés), do_not_contact, confirmed paid, organizer.
 */
export async function listPlacesAvailableCandidates(input: {
  eventId: string;
  eventSlug: string;
}): Promise<PlacesAvailableCandidate[]> {
  const db = getAdminFirestore();
  const slug = input.eventSlug.trim();
  const ouiList = interestProspectListNames(slug).yes;
  const nonList = interestProspectListNames(slug).noOther;
  const sansList = interestSansReponseListName(slug);

  const [waitSnap, prospects, respondentsSnap, partsSnap] = await Promise.all([
    db.collection(COLLECTIONS.waitlist).limit(3000).get(),
    listProspects({ limit: 3000 }),
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
  ]);

  const partsByEmail = new Map<string, AdminEventParticipation>();
  for (const d of partsSnap.docs) {
    const p = { id: d.id, ...(d.data() as Omit<AdminEventParticipation, "id">) };
    const email = normalizeEmail(p.email);
    if (!email.includes("@")) continue;
    partsByEmail.set(email, p);
  }

  const respondentsByEmail = new Map<string, EventRespondent & { id: string }>();
  for (const d of respondentsSnap.docs) {
    const r = { id: d.id, ...(d.data() as Omit<EventRespondent, "id">) };
    const email = normalizeEmail(r.email);
    if (!email.includes("@")) continue;
    respondentsByEmail.set(email, r);
  }

  const waitByEmail = new Map<string, WaitlistRegistration & { id: string }>();
  for (const d of waitSnap.docs) {
    const w = { id: d.id, ...(d.data() as Omit<WaitlistRegistration, "id">) };
    if (isSoftDeleted(w)) continue;
    const email = normalizeEmail(w.email);
    if (!email.includes("@")) continue;
    waitByEmail.set(email, w);
  }

  const prospectByEmail = new Map<string, Prospect>();
  for (const p of prospects) {
    if (isSoftDeleted(p)) continue;
    const email = normalizeEmail(p.email);
    if (!email.includes("@")) continue;
    prospectByEmail.set(email, p);
  }

  const emails = new Set<string>([
    ...waitByEmail.keys(),
    ...prospectByEmail.keys(),
    ...respondentsByEmail.keys(),
    ...partsByEmail.keys(),
  ]);

  const rows: PlacesAvailableCandidate[] = [];

  for (const email of emails) {
    if (isOrganizerParticipation({ email })) continue;

    const wait = waitByEmail.get(email);
    const prospect = prospectByEmail.get(email);
    const form = respondentsByEmail.get(email);
    const part = partsByEmail.get(email);

    if (prospect?.status === "do_not_contact") continue;
    if (prospect?.status === "no_not_interested") continue;
    if (listHas(prospect?.lists, nonList)) continue;
    if (form?.interestResponse === "no") {
      const reason = form.declineReason;
      if (reason === "not_interested_format" || reason === "not_interested_theme") continue;
      // Soft declines (indispo / want_to_know_more) stay eligible for a last seats ping.
      if (!reason || reason === "other") continue;
    }

    const partStatus = part ? normalizeParticipationStatus(part.status) : null;
    if (partStatus === "confirmed") continue;
    if (partStatus === "not_attending") continue;

    const french =
      (wait ? isFrenchSignal(wait) : false) ||
      (prospect
        ? isFrenchSignal({
            source: prospect.source,
            tags: prospect.tags,
            lists: prospect.lists,
          })
        : false) ||
      Boolean(form?.frenchFounderAttested);

    const onOui = listHas(prospect?.lists, ouiList) || form?.interestResponse === "yes";
    const onSans =
      listHas(prospect?.lists, sansList) ||
      prospect?.status === "no_response" ||
      (Boolean(part?.saveTheDateSentAt) && !form?.interestResponse && !onOui);

    // Eligible = French base ∪ sans réponse ∪ OUI (intéressés) — never NON.
    const buckets: PlacesAvailableBucket[] = [];
    if (french) buckets.push("french");
    if (onSans) buckets.push("sans_reponse");
    if (onOui) buckets.push("oui");
    if (buckets.length === 0) continue;
    buckets.push("eligible");

    const sources: PlacesAvailableCandidate["sources"] = [];
    if (wait) sources.push("waitlist");
    if (prospect) sources.push("prospect");
    if (form) sources.push("respondent");
    if (part) sources.push("participation");

    rows.push({
      email,
      fullName: displayName({
        fullName: prospect?.fullName || wait?.fullName || part?.fullName,
        firstName: form?.firstName,
        lastName: form?.lastName,
        email,
      }),
      company:
        prospect?.company?.trim() ||
        wait?.company?.trim() ||
        form?.companyName?.trim() ||
        part?.companyName?.trim() ||
        "",
      phone:
        prospect?.phone?.trim() ||
        wait?.phone?.trim() ||
        form?.whatsapp?.trim() ||
        part?.phone?.trim() ||
        "",
      sources,
      buckets,
      onMesa: Boolean(wait),
      participationId: part?.id ?? null,
      participationStatus: partStatus,
      placesAvailableSentAt: part?.placesAvailableSentAt ?? null,
      calendarInviteSentAt: part?.calendarInviteSentAt ?? null,
      prospectStatus: prospect?.status ?? null,
    });
  }

  rows.sort((a, b) => a.fullName.localeCompare(b.fullName, "fr"));
  return rows;
}

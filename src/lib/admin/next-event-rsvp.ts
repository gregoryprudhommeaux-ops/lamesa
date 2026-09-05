/**
 * Next-event RSVP cockpit snapshot.
 *
 * Interim heuristic (good enough to operate the dinner; refine CRM later):
 * - Contactés = mail STD de cet événement ∪ approches CRM (NON / OUI / sans réponse)
 *   ∪ réponses formulaire — pas toute la shortlist « À contacter ».
 * - OUI / NON = formulaire ∪ listes STD ∪ statuts CRM (won, no_not_*).
 * - Sans réponse = contactés sans OUI ni NON (souvent « À suivre » et assimilés).
 *
 * Lessons later: cleaner tags, exclusive STD lists, and fewer dual sources
 * (Prospects vs event_respondents). Do not invent a perfect taxonomy mid-edition.
 */
import { isOrganizerParticipation } from "@/lib/events/capacity";
import { interestProspectListNames } from "@/lib/events/interest-prospect-lists";
import { isSoftDeleted } from "@/lib/member/soft-delete";
import type {
  AdminEvent,
  AdminEventParticipation,
  EventRespondent,
} from "@/lib/types/events";
import type { Prospect, ProspectStatus } from "@/lib/types/prospects";

export type NextEventRsvpYesGuest = {
  id: string;
  fullName: string;
  email: string;
  company: string;
};

export type NextEventRsvpSummary = {
  eventId: string;
  eventSlug: string;
  title: string;
  startsAt: string;
  responseMode: "interest" | "rsvp";
  contacted: number;
  yes: number;
  no: number;
  /** Interest-only: réponses « autre » (hors oui/non strict). */
  other: number;
  pending: number;
  yesGuests: NextEventRsvpYesGuest[];
};

/** Minimal prospect shape for RSVP merge (CRM + list membership). */
export type RsvpProspectSlice = Pick<
  Prospect,
  | "id"
  | "email"
  | "fullName"
  | "company"
  | "status"
  | "lists"
  | "deletedAt"
  | "sentTemplateKeys"
  | "lastContactedAt"
>;

const PROSPECT_NO_STATUSES: ReadonlySet<ProspectStatus> = new Set([
  "no_not_available",
  "no_not_interested",
]);

const PROSPECT_YES_STATUSES: ReadonlySet<ProspectStatus> = new Set(["won"]);

function normalizeEmail(email: string | null | undefined): string {
  return String(email ?? "")
    .trim()
    .toLowerCase();
}

function respondentName(r: EventRespondent): string {
  const joined = [r.firstName, r.lastName].map((p) => String(p ?? "").trim()).filter(Boolean);
  if (joined.length) return joined.join(" ");
  return r.email?.trim() || "Sans nom";
}

/** True when a playlist belongs to this Save the Date slug. */
export function isStdListForEvent(listName: string, eventSlug: string): boolean {
  const slug = eventSlug.trim().toLowerCase();
  if (!slug) return false;
  return listName.trim().toLowerCase().startsWith(`std ${slug}`);
}

/** Template keys that count as STD / event outreach for this slug. */
export function hasEventOutreachTemplate(
  sentTemplateKeys: string[] | undefined,
  eventSlug: string,
): boolean {
  const keys = sentTemplateKeys ?? [];
  if (!keys.length) return false;
  const slug = eventSlug.trim().toLowerCase();
  if (!slug) return false;
  const slugUnderscore = slug.replace(/-/g, "_");
  return keys.some((raw) => {
    const key = raw.trim().toLowerCase();
    if (!key) return false;
    if (key === "save_the_date") return true;
    return key.includes(slug) || key.includes(slugUnderscore);
  });
}

/**
 * Approached for this dinner: STD mail for this event, CRM NON/OUI / sans réponse.
 * Direct NON counts even without mail. Generic lastContactedAt alone is ignored
 * (cold mail unrelated would inflate the counter).
 */
export function wasProspectApproachedForEvent(
  p: RsvpProspectSlice,
  eventSlug: string,
): boolean {
  if (PROSPECT_NO_STATUSES.has(p.status)) return true;
  if (PROSPECT_YES_STATUSES.has(p.status)) return true;
  if (p.status === "no_response") return true;
  return hasEventOutreachTemplate(p.sentTemplateKeys, eventSlug);
}

/** Earliest upcoming non-closed event; published preferred when dates are equal. */
export function pickNextUpcomingEvent(
  events: AdminEvent[],
  nowMs = Date.now(),
): AdminEvent | null {
  const upcoming = events
    .filter((e) => e.status !== "closed")
    .filter((e) => {
      const t = new Date(e.startsAt).getTime();
      return Number.isFinite(t) && t > nowMs;
    })
    .sort((a, b) => {
      const da = new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
      if (da !== 0) return da;
      const ap = a.status === "published" ? 0 : 1;
      const bp = b.status === "published" ? 0 : 1;
      return ap - bp;
    });
  return upcoming[0] ?? null;
}

function guestParticipations(
  eventId: string,
  participations: AdminEventParticipation[],
): AdminEventParticipation[] {
  return participations.filter(
    (p) => p.eventId === eventId && !isOrganizerParticipation(p),
  );
}

function wasContacted(p: AdminEventParticipation): boolean {
  return Boolean(p.saveTheDateSentAt || p.calendarInviteSentAt);
}

function listKeyMatch(lists: string[] | undefined, target: string): boolean {
  const key = target.trim().toLowerCase();
  return (lists ?? []).some((l) => l.trim().toLowerCase() === key);
}

/**
 * RSVP / interest snapshot for the next dinner to finalize.
 * Interest mode merges event_respondents + Prospects CRM (listes STD / statuts NON).
 * Classic RSVP uses participation statuses.
 */
export function buildNextEventRsvpSummary(input: {
  events: AdminEvent[];
  participations: AdminEventParticipation[];
  respondents: EventRespondent[];
  /** Prospects on STD playlists for this event (shortlist / OUI / NON…). */
  prospects?: RsvpProspectSlice[];
  nowMs?: number;
  yesLimit?: number;
}): NextEventRsvpSummary | null {
  const event = pickNextUpcomingEvent(input.events, input.nowMs ?? Date.now());
  if (!event) return null;

  const mode: "interest" | "rsvp" =
    event.responseMode === "interest" ? "interest" : "rsvp";
  const guests = guestParticipations(event.id, input.participations);
  const contactedRows = guests.filter(wasContacted);
  const contactedFromParts =
    contactedRows.length > 0
      ? contactedRows.length
      : // Avant envoi STD / ICS : taille de la liste invitees.
        guests.length;

  const eventRespondents = input.respondents.filter((r) => r.eventId === event.id);
  const yesLimit = input.yesLimit ?? 12;

  if (mode === "interest") {
    const listNames = interestProspectListNames(event.slug);
    const relatedProspects = (input.prospects ?? []).filter(
      (p) =>
        !isSoftDeleted(p) &&
        (p.lists ?? []).some((l) => isStdListForEvent(l, event.slug)),
    );

    const yesEmails = new Set<string>();
    const noEmails = new Set<string>();
    const otherEmails = new Set<string>();
    const contactedEmails = new Set<string>();
    const yesGuestsByEmail = new Map<string, NextEventRsvpYesGuest>();

    const softDeletedEmails = new Set(
      (input.prospects ?? [])
        .filter((p) => isSoftDeleted(p))
        .map((p) => normalizeEmail(p.email))
        .filter((e) => e.includes("@")),
    );

    for (const r of eventRespondents) {
      const email = normalizeEmail(r.email);
      if (!email.includes("@")) continue;
      if (softDeletedEmails.has(email)) continue;
      contactedEmails.add(email);
      if (r.interestResponse === "yes") {
        yesEmails.add(email);
        yesGuestsByEmail.set(email, {
          id: r.id,
          fullName: respondentName(r),
          email: r.email ?? "",
          company: r.companyName?.trim() || "",
        });
      } else if (r.interestResponse === "no") {
        noEmails.add(email);
      } else if (r.interestResponse === "other") {
        otherEmails.add(email);
      }
    }

    for (const p of relatedProspects) {
      const email = normalizeEmail(p.email);
      if (!email.includes("@")) continue;

      const onOui = listKeyMatch(p.lists, listNames.yes);
      const onNon = listKeyMatch(p.lists, listNames.noOther);

      if (onOui || PROSPECT_YES_STATUSES.has(p.status)) {
        yesEmails.add(email);
        if (!yesGuestsByEmail.has(email)) {
          yesGuestsByEmail.set(email, {
            id: p.id,
            fullName: p.fullName?.trim() || email,
            email: p.email,
            company: p.company?.trim() || "",
          });
        }
      }

      if (onNon || PROSPECT_NO_STATUSES.has(p.status)) {
        noEmails.add(email);
      }

      // Contactés = mail STD / last contact / disposition CRM — pas toute la shortlist.
      if (wasProspectApproachedForEvent(p, event.slug)) {
        contactedEmails.add(email);
      }
    }

    for (const p of contactedRows) {
      const email = normalizeEmail(p.email);
      if (email.includes("@")) contactedEmails.add(email);
    }

    // Un email classé oui et non (incohérence) : privilégier oui.
    for (const email of yesEmails) {
      noEmails.delete(email);
      otherEmails.delete(email);
      contactedEmails.add(email);
    }
    for (const email of noEmails) {
      otherEmails.delete(email);
      contactedEmails.add(email);
    }
    for (const email of otherEmails) {
      contactedEmails.add(email);
    }

    const answered = new Set([...yesEmails, ...noEmails, ...otherEmails]);
    let pending = 0;
    for (const email of contactedEmails) {
      if (!answered.has(email)) pending += 1;
    }

    const contacted = Math.max(contactedRows.length, contactedEmails.size);

    return {
      eventId: event.id,
      eventSlug: event.slug,
      title: event.title,
      startsAt: event.startsAt,
      responseMode: "interest",
      contacted,
      yes: yesEmails.size,
      no: noEmails.size,
      other: otherEmails.size,
      pending,
      yesGuests: [...yesGuestsByEmail.values()].slice(0, yesLimit),
    };
  }

  const yesParts = guests.filter(
    (p) => p.status === "attending" || p.status === "confirmed",
  );
  const noParts = guests.filter((p) => p.status === "not_attending");
  const pendingParts = guests.filter(
    (p) => p.status === "invited" || p.status === "waitlist",
  );

  return {
    eventId: event.id,
    eventSlug: event.slug,
    title: event.title,
    startsAt: event.startsAt,
    responseMode: "rsvp",
    contacted: contactedFromParts,
    yes: yesParts.length,
    no: noParts.length,
    other: 0,
    pending: pendingParts.length,
    yesGuests: yesParts.slice(0, yesLimit).map((p) => ({
      id: p.id,
      fullName: p.fullName?.trim() || p.email || "Sans nom",
      email: p.email ?? "",
      company: p.companyName?.trim() || "",
    })),
  };
}

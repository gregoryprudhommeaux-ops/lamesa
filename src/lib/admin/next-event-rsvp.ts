/**
 * Next-event RSVP cockpit snapshot.
 *
 * Pipeline listes STD (aligné Prospects) :
 * - Contactés = mail STD / approches CRM ∪ réponses formulaire
 * - OUI / NON = formulaire ∪ listes STD ∪ statuts CRM (won, no_not_*)
 * - Sans réponse = contactés sans OUI ni NON → liste « SANS RÉPONSE », relançable
 * - OUI : plus de STD ; plus tard invitation ticket
 * - NON : plus d’outreach pour CET événement
 */
import { isOrganizerParticipation } from "@/lib/events/capacity";
import {
  interestProspectListNames,
  interestSansReponseListName,
} from "@/lib/events/interest-prospect-lists";
import { templateKeyMatchesEventSlug } from "@/lib/events/std-outreach-templates";
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
  /** Playlist Prospects alignée sur « sans réponse » (relances STD). */
  sansReponseListName?: string;
  yesGuests: NextEventRsvpYesGuest[];
};

export type InterestRsvpEmailSets = {
  yesEmails: Set<string>;
  noEmails: Set<string>;
  otherEmails: Set<string>;
  contactedEmails: Set<string>;
  pendingEmails: Set<string>;
  yesGuestsByEmail: Map<string, NextEventRsvpYesGuest>;
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
  return keys.some((raw) => templateKeyMatchesEventSlug(raw, eventSlug));
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
 * Shared interest-mode email buckets (dashboard + playlist SANS RÉPONSE).
 * Single source of truth for « contactés / OUI / NON / sans réponse ».
 */
export function computeInterestRsvpEmailSets(input: {
  eventSlug: string;
  eventId: string;
  respondents: EventRespondent[];
  prospects: RsvpProspectSlice[];
  contactedParticipationEmails?: string[];
}): InterestRsvpEmailSets {
  const listNames = interestProspectListNames(input.eventSlug);
  const relatedProspects = input.prospects.filter(
    (p) =>
      !isSoftDeleted(p) &&
      (p.lists ?? []).some((l) => isStdListForEvent(l, input.eventSlug)),
  );

  const yesEmails = new Set<string>();
  const noEmails = new Set<string>();
  const otherEmails = new Set<string>();
  const contactedEmails = new Set<string>();
  const yesGuestsByEmail = new Map<string, NextEventRsvpYesGuest>();

  const softDeletedEmails = new Set(
    input.prospects
      .filter((p) => isSoftDeleted(p))
      .map((p) => normalizeEmail(p.email))
      .filter((e) => e.includes("@")),
  );

  for (const r of input.respondents.filter((row) => row.eventId === input.eventId)) {
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
    // Soft-deleted twin (same email) wins — drop from OUI/NON/contactés.
    if (softDeletedEmails.has(email)) continue;

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

    if (wasProspectApproachedForEvent(p, input.eventSlug)) {
      contactedEmails.add(email);
    }
  }

  for (const p of relatedProspects) {
    const email = normalizeEmail(p.email);
    if (!email.includes("@")) continue;
    if (softDeletedEmails.has(email)) continue;
    if (PROSPECT_NO_STATUSES.has(p.status)) {
      yesEmails.delete(email);
      otherEmails.delete(email);
      noEmails.add(email);
      yesGuestsByEmail.delete(email);
      contactedEmails.add(email);
    } else if (PROSPECT_YES_STATUSES.has(p.status)) {
      noEmails.delete(email);
      otherEmails.delete(email);
      yesEmails.add(email);
      contactedEmails.add(email);
      if (!yesGuestsByEmail.has(email)) {
        yesGuestsByEmail.set(email, {
          id: p.id,
          fullName: p.fullName?.trim() || email,
          email: p.email,
          company: p.company?.trim() || "",
        });
      }
    }
  }

  for (const email of input.contactedParticipationEmails ?? []) {
    if (email.includes("@")) contactedEmails.add(email);
  }

  for (const email of noEmails) {
    yesEmails.delete(email);
    otherEmails.delete(email);
    yesGuestsByEmail.delete(email);
    contactedEmails.add(email);
  }
  for (const email of yesEmails) {
    otherEmails.delete(email);
    contactedEmails.add(email);
  }
  for (const email of otherEmails) {
    contactedEmails.add(email);
  }

  const answered = new Set([...yesEmails, ...noEmails, ...otherEmails]);
  const pendingEmails = new Set<string>();
  for (const email of contactedEmails) {
    if (!answered.has(email)) pendingEmails.add(email);
  }

  return {
    yesEmails,
    noEmails,
    otherEmails,
    contactedEmails,
    pendingEmails,
    yesGuestsByEmail,
  };
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
    const sets = computeInterestRsvpEmailSets({
      eventSlug: event.slug,
      eventId: event.id,
      respondents: eventRespondents,
      prospects: input.prospects ?? [],
      contactedParticipationEmails: contactedRows
        .map((p) => normalizeEmail(p.email))
        .filter((e) => e.includes("@")),
    });

    const contacted = Math.max(contactedRows.length, sets.contactedEmails.size);

    return {
      eventId: event.id,
      eventSlug: event.slug,
      title: event.title,
      startsAt: event.startsAt,
      responseMode: "interest",
      contacted,
      yes: sets.yesEmails.size,
      no: sets.noEmails.size,
      other: sets.otherEmails.size,
      pending: sets.pendingEmails.size,
      sansReponseListName: interestSansReponseListName(event.slug),
      yesGuests: [...sets.yesGuestsByEmail.values()].slice(0, yesLimit),
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

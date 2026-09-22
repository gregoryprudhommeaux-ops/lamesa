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
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import { templateKeyMatchesEventSlug } from "@/lib/events/std-outreach-templates";
import { isSoftDeleted } from "@/lib/member/soft-delete";
import type {
  AdminEvent,
  AdminEventParticipation,
  EventRespondent,
} from "@/lib/types/events";
import type { Prospect, ProspectStatus } from "@/lib/types/prospects";

/** Pipeline after interest OUI → formal invite → paid seat. */
export type NextEventSeatStatus = "oui" | "invite_sent" | "confirmed";

export type NextEventRsvpYesGuest = {
  id: string;
  fullName: string;
  email: string;
  company: string;
  /** Seat progress after saying OUI (interest editions). */
  seat?: NextEventSeatStatus;
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
  /**
   * Places confirmées / payées (participation `confirmed` ou `attending`).
   * Distinct from interest OUI — a “oui” may still be unpaid.
   */
  confirmed: number;
  /** Formal calendar invite sent, not yet paid/confirmed. */
  inviteSent: number;
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

function seatStatusFromParticipation(
  p: AdminEventParticipation | undefined,
): NextEventSeatStatus {
  if (!p) return "oui";
  const status = normalizeParticipationStatus(p.status);
  if (status === "confirmed" || status === "attending") return "confirmed";
  if (p.calendarInviteSentAt) return "invite_sent";
  return "oui";
}

const SEAT_SORT: Record<NextEventSeatStatus, number> = {
  confirmed: 0,
  invite_sent: 1,
  oui: 2,
};

/** Paid / present seats for an event (excludes organizer). */
export function countConfirmedParticipations(
  eventId: string,
  participations: AdminEventParticipation[],
  emailFilter?: Set<string>,
): number {
  let n = 0;
  for (const p of guestParticipations(eventId, participations)) {
    const email = normalizeEmail(p.email);
    if (emailFilter && !emailFilter.has(email)) continue;
    const status = normalizeParticipationStatus(p.status);
    if (status === "confirmed" || status === "attending") n += 1;
  }
  return n;
}

export function countInviteSentNotPaid(
  eventId: string,
  participations: AdminEventParticipation[],
  emailFilter?: Set<string>,
): number {
  let n = 0;
  for (const p of guestParticipations(eventId, participations)) {
    const email = normalizeEmail(p.email);
    if (emailFilter && !emailFilter.has(email)) continue;
    if (seatStatusFromParticipation(p) === "invite_sent") n += 1;
  }
  return n;
}

export function enrichYesGuestsWithSeats(
  guests: NextEventRsvpYesGuest[],
  eventId: string,
  participations: AdminEventParticipation[],
): NextEventRsvpYesGuest[] {
  const partsByEmail = participationByEmail(eventId, participations);
  return guests
    .map((g) => {
      const email = normalizeEmail(g.email);
      const seat = seatStatusFromParticipation(partsByEmail.get(email));
      return { ...g, seat };
    })
    .sort(
      (a, b) =>
        SEAT_SORT[a.seat ?? "oui"] - SEAT_SORT[b.seat ?? "oui"] ||
        (a.fullName || a.email).localeCompare(b.fullName || b.email, "fr", {
          sensitivity: "base",
        }),
    );
}

function participationByEmail(
  eventId: string,
  participations: AdminEventParticipation[],
): Map<string, AdminEventParticipation> {
  const map = new Map<string, AdminEventParticipation>();
  for (const p of guestParticipations(eventId, participations)) {
    const email = normalizeEmail(p.email);
    if (!email.includes("@")) continue;
    map.set(email, p);
  }
  return map;
}

/**
 * Shared interest-mode email buckets (dashboard + playlist SANS RÉPONSE).
 * Source of truth = CRM Prospects for this STD event:
 * - OUI = playlist `STD {slug} — OUI` (sync formulaire + ajouts manuels)
 * - NON = playlist `STD {slug} — NON/AUTRE` ou statut CRM no_*
 * Formulaire seul ne compte plus (il doit être syncé vers le CRM).
 * Statut `won` hors playlist OUI ne compte pas comme OUI (évite shortlist « won » fantôme).
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

  for (const p of relatedProspects) {
    const email = normalizeEmail(p.email);
    if (!email.includes("@")) continue;
    if (softDeletedEmails.has(email)) continue;

    const onOui = listKeyMatch(p.lists, listNames.yes);
    const onNon = listKeyMatch(p.lists, listNames.noOther);

    if (onOui) {
      yesEmails.add(email);
      yesGuestsByEmail.set(email, {
        id: p.id,
        fullName: p.fullName?.trim() || email,
        email: p.email,
        company: p.company?.trim() || "",
      });
    }

    if (onNon || PROSPECT_NO_STATUSES.has(p.status)) {
      noEmails.add(email);
    }

    if (wasProspectApproachedForEvent(p, input.eventSlug) || onOui || onNon) {
      contactedEmails.add(email);
    }
  }

  // CRM NON statuses always win over OUI list / formulaire.
  for (const p of relatedProspects) {
    const email = normalizeEmail(p.email);
    if (!email.includes("@")) continue;
    if (softDeletedEmails.has(email)) continue;
    if (!PROSPECT_NO_STATUSES.has(p.status)) continue;
    yesEmails.delete(email);
    otherEmails.delete(email);
    noEmails.add(email);
    yesGuestsByEmail.delete(email);
    contactedEmails.add(email);
  }

  // Formulaire : enrichit les noms OUI + distingue AUTRE vs NON si déjà sur playlist NON.
  // Ne crée pas d’OUI/NON hors CRM.
  for (const r of input.respondents.filter((row) => row.eventId === input.eventId)) {
    const email = normalizeEmail(r.email);
    if (!email.includes("@")) continue;
    if (softDeletedEmails.has(email)) continue;
    contactedEmails.add(email);

    if (yesEmails.has(email) && r.interestResponse === "yes") {
      yesGuestsByEmail.set(email, {
        id: yesGuestsByEmail.get(email)?.id ?? r.id,
        fullName: respondentName(r),
        email: r.email ?? "",
        company: r.companyName?.trim() || yesGuestsByEmail.get(email)?.company || "",
      });
    }

    if (noEmails.has(email) && r.interestResponse === "other") {
      noEmails.delete(email);
      otherEmails.add(email);
    }
  }

  for (const email of input.contactedParticipationEmails ?? []) {
    if (email.includes("@") && !softDeletedEmails.has(email)) contactedEmails.add(email);
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
 * Interest mode: CRM Prospects (listes STD OUI / NON + statuts no_*) — le formulaire alimente le CRM via sync.
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
  const yesLimit = input.yesLimit ?? 40;

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
    const confirmed = countConfirmedParticipations(event.id, input.participations);
    const inviteSent = countInviteSentNotPaid(event.id, input.participations);
    const yesGuests = enrichYesGuestsWithSeats(
      [...sets.yesGuestsByEmail.values()],
      event.id,
      input.participations,
    ).slice(0, yesLimit);

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
      confirmed,
      inviteSent,
      sansReponseListName: interestSansReponseListName(event.slug),
      yesGuests,
    };
  }

  const yesParts = guests.filter((p) => {
    const s = normalizeParticipationStatus(p.status);
    return s === "attending" || s === "confirmed";
  });
  const noParts = guests.filter(
    (p) => normalizeParticipationStatus(p.status) === "not_attending",
  );
  const pendingParts = guests.filter((p) => {
    const s = normalizeParticipationStatus(p.status);
    return s === "invited" || s === "waitlist";
  });
  const inviteSent = countInviteSentNotPaid(event.id, input.participations);

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
    confirmed: yesParts.length,
    inviteSent,
    yesGuests: enrichYesGuestsWithSeats(
      yesParts.map((p) => ({
        id: p.id,
        fullName: p.fullName?.trim() || p.email || "Sans nom",
        email: p.email ?? "",
        company: p.companyName?.trim() || "",
      })),
      event.id,
      input.participations,
    ).slice(0, yesLimit),
  };
}

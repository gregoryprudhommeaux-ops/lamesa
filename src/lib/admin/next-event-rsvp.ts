import { isOrganizerParticipation } from "@/lib/events/capacity";
import type {
  AdminEvent,
  AdminEventParticipation,
  EventRespondent,
} from "@/lib/types/events";

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

/**
 * RSVP / interest snapshot for the next dinner to finalize.
 * Interest mode uses event_respondents; classic RSVP uses participation statuses.
 */
export function buildNextEventRsvpSummary(input: {
  events: AdminEvent[];
  participations: AdminEventParticipation[];
  respondents: EventRespondent[];
  nowMs?: number;
  yesLimit?: number;
}): NextEventRsvpSummary | null {
  const event = pickNextUpcomingEvent(input.events, input.nowMs ?? Date.now());
  if (!event) return null;

  const mode: "interest" | "rsvp" =
    event.responseMode === "interest" ? "interest" : "rsvp";
  const guests = guestParticipations(event.id, input.participations);
  const contactedRows = guests.filter(wasContacted);
  const contacted =
    contactedRows.length > 0
      ? contactedRows.length
      : // Avant envoi STD / ICS : taille de la liste invitees.
        guests.length;

  const eventRespondents = input.respondents.filter((r) => r.eventId === event.id);
  const yesLimit = input.yesLimit ?? 12;

  if (mode === "interest") {
    const yesRows = eventRespondents.filter((r) => r.interestResponse === "yes");
    const noRows = eventRespondents.filter((r) => r.interestResponse === "no");
    const otherRows = eventRespondents.filter((r) => r.interestResponse === "other");
    const respondedEmails = new Set(
      eventRespondents.map((r) => normalizeEmail(r.email)).filter((e) => e.includes("@")),
    );
    const contactedEmails = new Set(
      (contactedRows.length ? contactedRows : guests)
        .map((p) => normalizeEmail(p.email))
        .filter((e) => e.includes("@")),
    );
    let pending = 0;
    for (const email of contactedEmails) {
      if (!respondedEmails.has(email)) pending += 1;
    }

    return {
      eventId: event.id,
      eventSlug: event.slug,
      title: event.title,
      startsAt: event.startsAt,
      responseMode: "interest",
      contacted,
      yes: yesRows.length,
      no: noRows.length,
      other: otherRows.length,
      pending,
      yesGuests: yesRows.slice(0, yesLimit).map((r) => ({
        id: r.id,
        fullName: respondentName(r),
        email: r.email ?? "",
        company: r.companyName?.trim() || "",
      })),
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
    contacted,
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

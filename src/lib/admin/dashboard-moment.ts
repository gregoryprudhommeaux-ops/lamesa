/**
 * Dashboard “moment T” — what the organizer should look at now.
 * One primary focus; never two competing empty/full columns.
 */

export type DashboardMomentKind = "email_pulse" | "post_event" | "next_dinner" | "idle";

export type DashboardMomentInput = {
  nowMs?: number;
  lastEmail: {
    templateKey: string;
    sentAt: string;
    eventId: string | null;
  } | null;
  nextEvent: { eventId: string; startsAt: string } | null;
  pastEvent: {
    eventId: string;
    startsAt: string;
    surveySentCount: number;
    surveyResponseCount: number;
  } | null;
};

export type DashboardMoment = {
  kind: DashboardMomentKind;
  /** Short FR label for the Maintenant eyebrow. */
  label: string;
  reason: string;
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Post-event window: dinner last night → satisfaction / CA still “now”. */
export const POST_EVENT_FOCUS_MS = 5 * DAY;
/** Last blast stays primary while responses are still landing. */
export const EMAIL_PULSE_MS = 21 * DAY;

function isSatisfactionTemplate(templateKey: string): boolean {
  return templateKey.toLowerCase().includes("satisfaction");
}

/**
 * Resolve a single ops focus for the dashboard porte.
 *
 * Priority (user intent):
 * 1. Just after a dinner → post-event (CA + satisfaction), even if an older blast card exists
 * 2. Else recent outreach blast → email pulse (RSVP / places / STD results)
 * 3. Else upcoming dinner → next dinner
 * 4. Idle
 */
export function resolveDashboardMoment(input: DashboardMomentInput): DashboardMoment {
  const now = input.nowMs ?? Date.now();
  const past = input.pastEvent;
  const email = input.lastEmail;
  const next = input.nextEvent;

  const pastAge = past ? now - new Date(past.startsAt).getTime() : Number.POSITIVE_INFINITY;
  const emailAge = email ? now - new Date(email.sentAt).getTime() : Number.POSITIVE_INFINITY;
  const pastInWindow = Boolean(past && pastAge >= 0 && pastAge <= POST_EVENT_FOCUS_MS);

  if (pastInWindow && past) {
    const emailForFuture =
      email &&
      email.eventId &&
      past.eventId &&
      email.eventId !== past.eventId &&
      emailAge < pastAge;
    const emailIsSat = email ? isSatisfactionTemplate(email.templateKey) : false;

    // Satisfaction blast about this past dinner → still post_event (survey results)
    if (emailIsSat && email?.eventId === past.eventId) {
      return {
        kind: "post_event",
        label: "Après le dîner · satisfaction",
        reason: "Le questionnaire est parti — suivre les réponses et le CA.",
      };
    }

    // A newer blast for another (upcoming) event beats post-event wrap
    if (emailForFuture && emailAge <= EMAIL_PULSE_MS) {
      return {
        kind: "email_pulse",
        label: "Dernier envoi · résultats",
        reason: "Vague en cours — lire les réponses avant autre chose.",
      };
    }

    const satHint =
      past.surveySentCount > 0 || past.surveyResponseCount > 0
        ? "satisfaction + CA"
        : "bilan + CA";
    return {
      kind: "post_event",
      label: `Après le dîner · ${satHint}`,
      reason: "L’événement est passé — résultats et apprentissages d’abord.",
    };
  }

  if (email && emailAge >= 0 && emailAge <= EMAIL_PULSE_MS) {
    return {
      kind: "email_pulse",
      label: isSatisfactionTemplate(email.templateKey)
        ? "Satisfaction · réponses"
        : "Dernier envoi · résultats",
      reason: "C’est le signal le plus frais du process — les réponses d’abord.",
    };
  }

  if (next) {
    return {
      kind: "next_dinner",
      label: "Prochain dîner",
      reason: "Pas de blast frais — piloter le dîner à venir.",
    };
  }

  return {
    kind: "idle",
    label: "Rien en cours",
    reason: "Créer le prochain dîner ou lancer un envoi.",
  };
}

export function pickLastPastEvent<T extends { id: string; startsAt: string }>(
  events: T[],
  nowMs = Date.now(),
): T | null {
  const past = events
    .filter((e) => {
      const t = new Date(e.startsAt).getTime();
      return Number.isFinite(t) && t <= nowMs;
    })
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  return past[0] ?? null;
}

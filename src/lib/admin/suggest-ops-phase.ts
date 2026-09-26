import type { OpsPhaseId } from "@/lib/admin/ops-phases";
import type { AdminEvent, AdminEventParticipation } from "@/lib/types/events";
import { countSeatedParticipations, isOrganizerParticipation } from "@/lib/events/capacity";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";

export type EventOpsKpis = {
  capacity: number;
  seated: number;
  roster: number;
  paid: number;
  unpaidAfterInvite: number;
  invitedFormal: number;
  stdSent: boolean;
  publishStatus: "draft" | "published" | "closed";
  /** Held seats (Payé/Invité) still missing door check-in. */
  awaitingCheckin: number;
};

export type EventNextBestAction = {
  id: string;
  label: string;
  phaseId: OpsPhaseId;
  /** Short why — shown under the CTA. */
  reason: string;
};

export type SuggestOpsPhaseInput = {
  event: Pick<
    AdminEvent,
    | "title"
    | "startsAt"
    | "venueName"
    | "address"
    | "status"
    | "responseMode"
    | "saveTheDateSentAt"
    | "capacity"
  >;
  /** Form draft fields when editing (may differ from saved event). */
  draft?: {
    title?: string;
    eventDate?: string;
    venueName?: string;
    address?: string;
  };
  participations: AdminEventParticipation[];
  /** Override clock (tests / replay). */
  nowMs?: number;
};

export type SuggestOpsPhaseResult = {
  phaseId: OpsPhaseId;
  kpis: EventOpsKpis;
  blockers: string[];
  nextBestAction: EventNextBestAction;
  /** Phases considered done enough to mark on the stepper. */
  completedPhaseIds: OpsPhaseId[];
};

/** Door opens early evening → morning after. */
export const CHECKIN_WINDOW_BEFORE_MS = 6 * 60 * 60 * 1000;
export const CHECKIN_WINDOW_AFTER_MS = 18 * 60 * 60 * 1000;

export function isInCheckinWindow(startsAt: string, nowMs = Date.now()): boolean {
  const start = new Date(startsAt).getTime();
  if (!Number.isFinite(start)) return false;
  return (
    nowMs >= start - CHECKIN_WINDOW_BEFORE_MS &&
    nowMs <= start + CHECKIN_WINDOW_AFTER_MS
  );
}

function heldSeatsAwaitingCheckin(parts: AdminEventParticipation[]): number {
  return parts.filter((p) => {
    if (isOrganizerParticipation(p)) return false;
    const s = normalizeParticipationStatus(p.status);
    if (s !== "confirmed" && s !== "comped") return false;
    return !p.checkedInAt;
  }).length;
}

function checkinNextAction(pending: number): EventNextBestAction {
  return {
    id: "door_checkin",
    label: pending > 0 ? `Check-in porte (${pending})` : "Check-in porte",
    phaseId: "checkin",
    reason: "Soir J — pointer les places Payé / Invité présentes.",
  };
}

function hasTitleAndDate(input: SuggestOpsPhaseInput): boolean {
  const title = (input.draft?.title ?? input.event.title ?? "").trim();
  const date =
    (input.draft?.eventDate ?? "").trim() ||
    (input.event.startsAt ? String(input.event.startsAt).slice(0, 10) : "");
  return Boolean(title) && Boolean(date);
}

function hasVenue(input: SuggestOpsPhaseInput): boolean {
  const venue = (input.draft?.venueName ?? input.event.venueName ?? "").trim();
  const address = (input.draft?.address ?? input.event.address ?? "").trim();
  return Boolean(venue || address);
}

function eventStdSent(event: SuggestOpsPhaseInput["event"], parts: AdminEventParticipation[]): boolean {
  if (event.saveTheDateSentAt) return true;
  return parts.some((p) => Boolean(p.saveTheDateSentAt));
}

function buildKpis(
  event: SuggestOpsPhaseInput["event"],
  parts: AdminEventParticipation[],
): EventOpsKpis {
  const guests = parts.filter((p) => !isOrganizerParticipation(p));
  const paid = guests.filter((p) => {
    const s = normalizeParticipationStatus(p.status);
    return s === "confirmed";
  }).length;
  const unpaidAfterInvite = guests.filter(
    (p) =>
      Boolean(p.calendarInviteSentAt) &&
      (p.status === "invited" || p.status === "attending" || p.status === "waitlist"),
  ).length;
  const invitedFormal = guests.filter((p) => Boolean(p.calendarInviteSentAt)).length;
  return {
    capacity: event.capacity ?? 0,
    seated: countSeatedParticipations(parts),
    roster: guests.length,
    paid,
    unpaidAfterInvite,
    invitedFormal,
    stdSent: eventStdSent(event, parts),
    publishStatus: event.status ?? "draft",
    awaitingCheckin: heldSeatsAwaitingCheckin(parts),
  };
}

function interestPhasesCompleted(
  input: SuggestOpsPhaseInput,
  kpis: EventOpsKpis,
  nowMs: number,
): OpsPhaseId[] {
  const done: OpsPhaseId[] = [];
  if (hasTitleAndDate(input)) done.push("prep");
  if (kpis.roster > 0) done.push("audience");
  if (kpis.stdSent) done.push("save_the_date");
  if (kpis.stdSent && kpis.invitedFormal > 0) done.push("qualify");
  if (kpis.invitedFormal > 0) done.push("formal");
  if (kpis.invitedFormal > 0 && kpis.unpaidAfterInvite === 0) done.push("payment");
  if (kpis.paid > 0 && kpis.unpaidAfterInvite === 0) done.push("dinner_prep");
  const started = new Date(input.event.startsAt).getTime() <= nowMs;
  if (started && kpis.awaitingCheckin === 0 && kpis.paid > 0) done.push("checkin");
  return done;
}

function rsvpPhasesCompleted(
  input: SuggestOpsPhaseInput,
  kpis: EventOpsKpis,
  nowMs: number,
): OpsPhaseId[] {
  const done: OpsPhaseId[] = [];
  if (hasTitleAndDate(input)) done.push("prep");
  if (kpis.roster > 0) done.push("audience");
  if (kpis.invitedFormal > 0) done.push("formal");
  if (kpis.invitedFormal > 0 && kpis.unpaidAfterInvite === 0) done.push("payment");
  if (kpis.paid > 0 && kpis.unpaidAfterInvite === 0) done.push("dinner_prep");
  const started = new Date(input.event.startsAt).getTime() <= nowMs;
  if (started && kpis.awaitingCheckin === 0 && kpis.paid > 0) done.push("checkin");
  return done;
}

function shouldFocusCheckin(input: SuggestOpsPhaseInput, kpis: EventOpsKpis, nowMs: number): boolean {
  if (kpis.unpaidAfterInvite > 0) return false;
  if (kpis.awaitingCheckin <= 0) return false;
  return isInCheckinWindow(input.event.startsAt, nowMs);
}

/**
 * Derive the ops focus phase + next best action from event + participations.
 * Uses the 9 product ops phases (interest) / filtered set (RSVP).
 */
export function suggestOpsPhase(input: SuggestOpsPhaseInput): SuggestOpsPhaseResult {
  const interest = input.event.responseMode === "interest";
  const parts = input.participations;
  const nowMs = input.nowMs ?? Date.now();
  const kpis = buildKpis(input.event, parts);
  const blockers: string[] = [];
  const completedPhaseIds = interest
    ? interestPhasesCompleted(input, kpis, nowMs)
    : rsvpPhasesCompleted(input, kpis, nowMs);

  if (!hasTitleAndDate(input)) {
    blockers.push("Titre ou date manquant");
    return {
      phaseId: "prep",
      kpis,
      blockers,
      completedPhaseIds,
      nextBestAction: {
        id: "fill_basics",
        label: "Compléter titre et date",
        phaseId: "prep",
        reason: "Sans identité calendrier, aucun envoi n’est possible.",
      },
    };
  }

  if (!hasVenue(input) && (kpis.publishStatus === "published" || kpis.stdSent || kpis.invitedFormal > 0)) {
    blockers.push("Lieu / adresse non renseigné");
  }

  if (interest) {
    if (kpis.roster === 0) {
      blockers.push("Aucun participant sur la liste");
      return {
        phaseId: "audience",
        kpis,
        blockers,
        completedPhaseIds,
        nextBestAction: {
          id: "add_audience",
          label: "Ajouter des invités à la liste",
          phaseId: "audience",
          reason: "Sélectionner les contacts avant le Save the Date.",
        },
      };
    }

    if (!kpis.stdSent) {
      return {
        phaseId: "save_the_date",
        kpis,
        blockers,
        completedPhaseIds,
        nextBestAction: {
          id: "send_std",
          label: "Envoyer le Save the Date",
          phaseId: "save_the_date",
          reason: "Annoncer la date aux invités sélectionnés.",
        },
      };
    }

    if (kpis.unpaidAfterInvite > 0) {
      blockers.push(`${kpis.unpaidAfterInvite} invitation(s) formelle(s) sans paiement`);
      return {
        phaseId: "payment",
        kpis,
        blockers,
        completedPhaseIds,
        nextBestAction: {
          id: "payment_relance",
          label: `Relancer les paiements (${kpis.unpaidAfterInvite})`,
          phaseId: "payment",
          reason: "Confirmations bloquées tant que l’ACCESS n’est pas réglé.",
        },
      };
    }

    // After STD: stop on Qualification before formal invites go out.
    if (kpis.invitedFormal === 0) {
      return {
        phaseId: "qualify",
        kpis,
        blockers,
        completedPhaseIds,
        nextBestAction: {
          id: "qualify_responses",
          label: "Qualifier les réponses",
          phaseId: "qualify",
          reason: "STD parti — relancer les sans réponse, puis inviter les OUI.",
        },
      };
    }

    if (!hasVenue(input)) {
      return {
        phaseId: "prep",
        kpis,
        blockers,
        completedPhaseIds,
        nextBestAction: {
          id: "fill_venue",
          label: "Renseigner le lieu et le tarif",
          phaseId: "prep",
          reason: "Invitations parties — verrouiller les éléments définitifs.",
        },
      };
    }

    if (shouldFocusCheckin(input, kpis, nowMs)) {
      return {
        phaseId: "checkin",
        kpis,
        blockers,
        completedPhaseIds,
        nextBestAction: checkinNextAction(kpis.awaitingCheckin),
      };
    }

    if (kpis.capacity > 0 && kpis.seated < kpis.capacity) {
      return {
        phaseId: "dinner_prep",
        kpis,
        blockers,
        completedPhaseIds,
        nextBestAction: {
          id: "places_or_tables",
          label: "Finaliser places & tables",
          phaseId: "dinner_prep",
          reason: "Paiements OK — remplir les dernières places ou composer les tables.",
        },
      };
    }

    return {
      phaseId: "feedback",
      kpis,
      blockers,
      completedPhaseIds,
      nextBestAction: {
        id: "all_clear",
        label: "Suivre relances auto & satisfaction",
        phaseId: "feedback",
        reason: "Pas de paiement en attente — piloter l’après-invitation.",
      },
    };
  }

  // RSVP mode
  if (kpis.roster === 0) {
    blockers.push("Aucun invité sur la liste");
    return {
      phaseId: "audience",
      kpis,
      blockers,
      completedPhaseIds,
      nextBestAction: {
        id: "add_invitees",
        label: "Constituer la liste d’invités",
        phaseId: "audience",
        reason: "Sélectionner les contacts à inviter.",
      },
    };
  }

  if (kpis.unpaidAfterInvite > 0) {
    blockers.push(`${kpis.unpaidAfterInvite} invitation(s) sans paiement`);
    return {
      phaseId: "payment",
      kpis,
      blockers,
      completedPhaseIds,
      nextBestAction: {
        id: "payment_relance",
        label: `Relancer les paiements (${kpis.unpaidAfterInvite})`,
        phaseId: "payment",
        reason: "Places non confirmées financièrement.",
      },
    };
  }

  if (kpis.invitedFormal === 0) {
    return {
      phaseId: "formal",
      kpis,
      blockers,
      completedPhaseIds,
      nextBestAction: {
        id: "send_invites",
        label: "Lancer les invitations",
        phaseId: "formal",
        reason: "Liste prête — envoyer ICS / YES-NO.",
      },
    };
  }

  if (!hasVenue(input)) {
    blockers.push("Lieu / adresse non renseigné");
    return {
      phaseId: "prep",
      kpis,
      blockers,
      completedPhaseIds,
      nextBestAction: {
        id: "fill_venue",
        label: "Renseigner le lieu et le tarif",
        phaseId: "prep",
        reason: "Compléter les éléments définitifs.",
      },
    };
  }

  if (shouldFocusCheckin(input, kpis, nowMs)) {
    return {
      phaseId: "checkin",
      kpis,
      blockers,
      completedPhaseIds,
      nextBestAction: checkinNextAction(kpis.awaitingCheckin),
    };
  }

  if (kpis.capacity > 0 && kpis.seated < kpis.capacity) {
    return {
      phaseId: "dinner_prep",
      kpis,
      blockers,
      completedPhaseIds,
      nextBestAction: {
        id: "places_or_tables",
        label: "Finaliser places & tables",
        phaseId: "dinner_prep",
        reason: "Invitations parties — remplir places ou composer les tables.",
      },
    };
  }

  return {
    phaseId: "feedback",
    kpis,
    blockers,
    completedPhaseIds,
    nextBestAction: {
      id: "all_clear",
      label: "Suivre relances auto & satisfaction",
      phaseId: "feedback",
      reason: "Invitations parties — piloter rappels et feedback.",
    },
  };
}

export function publishStatusLabel(status: EventOpsKpis["publishStatus"]): string {
  switch (status) {
    case "published":
      return "Publié";
    case "closed":
      return "Clôturé";
    default:
      return "Brouillon";
  }
}

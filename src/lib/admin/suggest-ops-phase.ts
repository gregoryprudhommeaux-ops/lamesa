import type { EventPhaseId } from "@/components/admin/admin-event-phase-section";
import type { AdminEvent, AdminEventParticipation } from "@/lib/types/events";
import { countSeatedParticipations } from "@/lib/events/capacity";

export type EventOpsKpis = {
  capacity: number;
  seated: number;
  roster: number;
  paid: number;
  unpaidAfterInvite: number;
  invitedFormal: number;
  stdSent: boolean;
  publishStatus: "draft" | "published" | "closed";
};

export type EventNextBestAction = {
  id: string;
  label: string;
  phaseId: EventPhaseId;
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
};

export type SuggestOpsPhaseResult = {
  phaseId: EventPhaseId;
  kpis: EventOpsKpis;
  blockers: string[];
  nextBestAction: EventNextBestAction;
  /** Phases considered done enough to mark on the stepper. */
  completedPhaseIds: EventPhaseId[];
};

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
  const guests = parts.filter((p) => !p.isOrganizer);
  const paid = guests.filter((p) => p.status === "confirmed" || p.status === "present").length;
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
  };
}

function interestPhasesCompleted(input: SuggestOpsPhaseInput, kpis: EventOpsKpis): EventPhaseId[] {
  const done: EventPhaseId[] = [];
  if (hasTitleAndDate(input)) done.push("std");
  if (hasVenue(input)) done.push("definitive");
  if (kpis.stdSent) done.push("std_email");
  if (kpis.invitedFormal > 0) done.push("formal");
  if (kpis.paid > 0 && kpis.unpaidAfterInvite === 0 && kpis.invitedFormal > 0) {
    // payment follow-up quiet → auto/reminders is next ops focus after formal
  }
  return done;
}

function rsvpPhasesCompleted(input: SuggestOpsPhaseInput, kpis: EventOpsKpis): EventPhaseId[] {
  const done: EventPhaseId[] = [];
  if (hasTitleAndDate(input)) done.push("std");
  if (hasVenue(input)) done.push("definitive");
  if (kpis.roster > 0) done.push("std_email");
  if (kpis.invitedFormal > 0) done.push("formal");
  return done;
}

/**
 * Derive the ops focus phase + next best action from event + participations.
 * Does not require respondents (interest inbox) — qualification nudge is soft.
 */
export function suggestOpsPhase(input: SuggestOpsPhaseInput): SuggestOpsPhaseResult {
  const interest = input.event.responseMode === "interest";
  const parts = input.participations;
  const kpis = buildKpis(input.event, parts);
  const blockers: string[] = [];
  const completedPhaseIds = interest
    ? interestPhasesCompleted(input, kpis)
    : rsvpPhasesCompleted(input, kpis);

  if (!hasTitleAndDate(input)) {
    blockers.push("Titre ou date manquant");
    return {
      phaseId: "std",
      kpis,
      blockers,
      completedPhaseIds,
      nextBestAction: {
        id: "fill_basics",
        label: "Compléter titre et date",
        phaseId: "std",
        reason: "Sans identité calendrier, aucun envoi n’est possible.",
      },
    };
  }

  if (!hasVenue(input) && (kpis.publishStatus === "published" || kpis.stdSent)) {
    blockers.push("Lieu / adresse non renseigné");
  }

  if (interest) {
    if (!kpis.stdSent) {
      return {
        phaseId: "std_email",
        kpis,
        blockers,
        completedPhaseIds,
        nextBestAction: {
          id: "send_std",
          label: "Envoyer le Save the Date",
          phaseId: "std_email",
          reason: "Annoncer la date aux invités sélectionnés.",
        },
      };
    }

    if (kpis.roster === 0) {
      blockers.push("Aucun participant sur la liste");
      return {
        phaseId: "std_email",
        kpis,
        blockers,
        completedPhaseIds,
        nextBestAction: {
          id: "add_audience",
          label: "Ajouter des invités à la liste",
          phaseId: "std_email",
          reason: "STD déjà marqué envoyé — renforcer ou qualifier l’audience.",
        },
      };
    }

    if (kpis.unpaidAfterInvite > 0) {
      blockers.push(`${kpis.unpaidAfterInvite} invitation(s) formelle(s) sans paiement`);
      return {
        phaseId: "formal",
        kpis,
        blockers,
        completedPhaseIds,
        nextBestAction: {
          id: "payment_relance",
          label: `Relancer les paiements (${kpis.unpaidAfterInvite})`,
          phaseId: "formal",
          reason: "Confirmations bloquées tant que l’ACCESS n’est pas réglé.",
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
          id: "formal_invite",
          label: "Envoyer l’invitation formelle",
          phaseId: "formal",
          reason: "STD parti — passer aux OUI / places confirmées.",
        },
      };
    }

    if (!hasVenue(input)) {
      return {
        phaseId: "definitive",
        kpis,
        blockers,
        completedPhaseIds,
        nextBestAction: {
          id: "fill_venue",
          label: "Renseigner le lieu et le tarif",
          phaseId: "definitive",
          reason: "Invitations parties — verrouiller les éléments définitifs.",
        },
      };
    }

    return {
      phaseId: "auto",
      kpis,
      blockers,
      completedPhaseIds,
      nextBestAction: {
        id: "all_clear",
        label: "Suivre relances auto & satisfaction",
        phaseId: "auto",
        reason: "Pas de paiement en attente détecté — piloter l’après-invitation.",
      },
    };
  }

  // RSVP mode
  if (kpis.roster === 0) {
    blockers.push("Aucun invité sur la liste");
    return {
      phaseId: "std_email",
      kpis,
      blockers,
      completedPhaseIds,
      nextBestAction: {
        id: "add_invitees",
        label: "Constituer la liste d’invités",
        phaseId: "std_email",
        reason: "Sélectionner les contacts à inviter.",
      },
    };
  }

  if (kpis.unpaidAfterInvite > 0) {
    blockers.push(`${kpis.unpaidAfterInvite} invitation(s) sans paiement`);
    return {
      phaseId: "formal",
      kpis,
      blockers,
      completedPhaseIds,
      nextBestAction: {
        id: "payment_relance",
        label: `Relancer les paiements (${kpis.unpaidAfterInvite})`,
        phaseId: "formal",
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
      phaseId: "definitive",
      kpis,
      blockers,
      completedPhaseIds,
      nextBestAction: {
        id: "fill_venue",
        label: "Renseigner le lieu et le tarif",
        phaseId: "definitive",
        reason: "Compléter les éléments définitifs.",
      },
    };
  }

  return {
    phaseId: "auto",
    kpis,
    blockers,
    completedPhaseIds,
    nextBestAction: {
      id: "all_clear",
      label: "Suivre relances auto & satisfaction",
      phaseId: "auto",
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

"use client";

import { EventEmailTemplateEditor } from "@/components/admin/admin-event-email-template-editor";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import { interestSansReponseListName } from "@/lib/events/interest-prospect-lists";
import type { AdminEvent, AdminEventParticipation } from "@/lib/types/events";
import { BTN_SECONDARY } from "@/lib/ui/nextstep";
import Link from "next/link";

type StdRelancePanelProps = {
  event: AdminEvent;
};

export function StdRelancePanel({ event }: StdRelancePanelProps) {
  const listName = interestSansReponseListName(event.slug);
  return (
    <div className="space-y-3">
      <p className="text-sm text-ns-secondary">
        Relance les contactés qui n’ont pas encore répondu OUI/NON. L’envoi se fait via un template
        custom dans Prospects (playlist auto-sync « SANS RÉPONSE »).
      </p>
      <div className="rounded-xl border border-ns-alternate bg-white px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wide text-ns-secondary">Playlist</p>
        <p className="mt-1 font-mono text-sm text-ns-tertiary">{listName}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/admin/prospects?list=${encodeURIComponent(listName)}`}
          className={`${BTN_SECONDARY} inline-flex items-center`}
        >
          Ouvrir liste relance →
        </Link>
        <Link href="/admin/templates" className={`${BTN_SECONDARY} inline-flex items-center`}>
          Templates email / custom
        </Link>
      </div>
    </div>
  );
}

type AutoRemindersPanelProps = {
  event: AdminEvent;
  participations: AdminEventParticipation[];
  onEventUpdated?: () => void;
};

export function AutoRemindersPanel({
  event,
  participations,
  onEventUpdated,
}: AutoRemindersPanelProps) {
  const invitesSent = participations.filter((p) => Boolean(p.calendarInviteSentAt)).length;
  const confirmed = participations.filter(
    (p) => normalizeParticipationStatus(p.status) === "confirmed",
  ).length;
  const surveysSent = participations.filter((p) => Boolean(p.satisfactionSurveySentAt)).length;
  const surveysDone = participations.filter((p) =>
    Boolean(p.satisfactionSurvey?.submittedAt),
  ).length;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-ns-alternate bg-white p-4 text-sm text-ns-tertiary">
        <p className="font-bold text-ns-hero">Rappels calendrier (ICS)</p>
        <p className="mt-1 text-xs text-ns-secondary">
          Après l’invitation formelle, les rappels natifs du fichier .ics couvrent{" "}
          <strong>J-7 · H-36 · H-1h30</strong>. Pas d’email séparé requis (templates reminder_* =
          legacy).
        </p>
        <p className="mt-2 text-xs text-ns-secondary">
          ICS / invites déjà envoyés : <strong>{invitesSent}</strong> · Confirmés paiement :{" "}
          <strong>{confirmed}</strong>
        </p>
        <Link href="/admin/templates" className="mt-3 inline-block text-xs font-semibold text-ns-primary hover:underline">
          Voir templates reminder legacy →
        </Link>
      </div>

      <div>
        <p className="mb-2 text-sm font-bold text-ns-hero">Satisfaction (cron +12 h)</p>
        <p className="mb-3 text-xs text-ns-secondary">
          {surveysSent} envoyés · {surveysDone} réponses
        </p>
        <EventEmailTemplateEditor
          event={event}
          templateKey="satisfaction_survey"
          onEventUpdated={onEventUpdated}
          hint="Template envoyé automatiquement après l’événement (si activé)."
        />
      </div>
    </div>
  );
}

"use client";

import { EventEmailTemplateEditor } from "@/components/admin/admin-event-email-template-editor";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import { interestSansReponseListName } from "@/lib/events/interest-prospect-lists";
import type { AdminEvent, AdminEventParticipation } from "@/lib/types/events";
import { BTN_PRIMARY, BTN_SECONDARY, ERROR_TEXT } from "@/lib/ui/nextstep";
import Link from "next/link";
import { useEffect, useState } from "react";

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
  const authFetch = useAuthFetch();
  const [autoSend, setAutoSend] = useState(event.satisfactionSurveyAutoSend === true);
  const [savingAuto, setSavingAuto] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAutoSend(event.satisfactionSurveyAutoSend === true);
  }, [event.id, event.satisfactionSurveyAutoSend]);

  const invitesSent = participations.filter((p) => Boolean(p.calendarInviteSentAt)).length;
  const confirmed = participations.filter(
    (p) => normalizeParticipationStatus(p.status) === "confirmed",
  ).length;
  const surveysSent = participations.filter((p) => Boolean(p.satisfactionSurveySentAt)).length;
  const surveysDone = participations.filter((p) =>
    Boolean(p.satisfactionSurvey?.submittedAt),
  ).length;
  const pendingSurvey = participations.filter((p) => {
    if (p.isOrganizer) return false;
    const status = normalizeParticipationStatus(p.status);
    if (status !== "confirmed" && status !== "attending") return false;
    return !p.satisfactionSurveySentAt;
  }).length;

  async function saveAutoSend(next: boolean) {
    setSavingAuto(true);
    setError(null);
    setMessage(null);
    try {
      const res = await authFetch(`/api/admin/events/${event.id}/satisfaction-settings`, {
        method: "PATCH",
        body: JSON.stringify({ satisfactionSurveyAutoSend: next }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "save_failed");
      setAutoSend(next);
      setMessage(
        next
          ? "Envoi auto activé (cron +12 h)."
          : "Envoi auto désactivé — tu gères à la main.",
      );
      onEventUpdated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingAuto(false);
    }
  }

  async function sendNow() {
    if (
      !window.confirm(
        `Envoyer le questionnaire de satisfaction à ${pendingSurvey} personne(s) éligible(s) ?`,
      )
    ) {
      return;
    }
    setSending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await authFetch(`/api/admin/events/${event.id}/send-satisfaction`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        sent?: number;
        skipped?: number;
        failed?: number;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.detail || json.error || "send_failed");
      }
      setMessage(
        `Envoyé : ${json.sent ?? 0} · ignorés : ${json.skipped ?? 0} · échecs : ${json.failed ?? 0}`,
      );
      onEventUpdated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-ns-alternate bg-white p-4 text-sm text-ns-tertiary">
        <p className="font-bold text-ns-hero">Rappels calendrier (ICS)</p>
        <p className="mt-1 text-xs text-ns-secondary">
          Après l’invitation formelle, les rappels natifs du fichier .ics couvrent{" "}
          <strong>J-7 · H-36 · H-1h30</strong>. Pas d’email séparé requis (templates reminder_* =
          legacy). La présence officielle se confirme via les boutons{" "}
          <strong>YES / NO</strong> du mail (pas le Oui/Non du calendrier Google — celui-ci
          échoue souvent vers le domaine d’envoi Brevo).
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
        <p className="mb-2 text-sm font-bold text-ns-hero">Satisfaction</p>
        <p className="mb-3 text-xs text-ns-secondary">
          {surveysSent} envoyés · {surveysDone} réponses · {pendingSurvey} en attente d’envoi
        </p>

        <div className="mb-4 rounded-xl border border-ns-alternate bg-white p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 accent-ns-primary"
              checked={autoSend}
              disabled={savingAuto}
              onChange={(e) => void saveAutoSend(e.target.checked)}
            />
            <span className="text-sm text-ns-tertiary">
              <span className="font-semibold">Envoi automatique (cron +12 h)</span>
              <span className="mt-0.5 block text-xs text-ns-secondary">
                Désactivé par défaut. Coche seulement si tu veux que le cron envoie tout seul.
              </span>
            </span>
          </label>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={BTN_PRIMARY}
              disabled={sending || pendingSurvey === 0}
              onClick={() => void sendNow()}
            >
              {sending ? "Envoi…" : `Envoyer maintenant (${pendingSurvey})`}
            </button>
            <a
              href={`/${event.eventLanguage ?? "es"}/satisfaction?preview=1`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${BTN_SECONDARY} inline-flex items-center`}
            >
              Voir / valider le questionnaire →
            </a>
          </div>
          {message ? <p className="mt-2 text-xs font-medium text-ns-primary">{message}</p> : null}
          {error ? <p className={`mt-2 ${ERROR_TEXT}`}>{error}</p> : null}
        </div>

        <EventEmailTemplateEditor
          event={event}
          templateKey="satisfaction_survey"
          onEventUpdated={onEventUpdated}
          hint="Template du questionnaire. L’envoi auto est coupé sauf si tu coches la case ci-dessus."
        />
      </div>
    </div>
  );
}

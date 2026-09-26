"use client";

import { EventTemplateDrawer } from "@/components/admin/event-template-drawer";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { isOrganizerParticipation } from "@/lib/events/capacity";
import { interestSansReponseListName } from "@/lib/events/interest-prospect-lists";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import {
  SURVEY_COPY,
  surveyLocaleFrom,
  surveyQuestionsList,
  type SurveyLocale,
} from "@/lib/satisfaction/survey-copy";
import type { AdminEvent, AdminEventParticipation } from "@/lib/types/events";
import { BTN_PRIMARY, BTN_SECONDARY, ERROR_TEXT } from "@/lib/ui/nextstep";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
          href={`/admin/personnes?tab=prospects&list=${encodeURIComponent(listName)}`}
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

const LOCALE_LABELS: Record<SurveyLocale, string> = {
  es: "Español",
  fr: "Français",
  en: "English",
};

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
  const sendLocale = surveyLocaleFrom(event.eventLanguage);
  const [previewLocale, setPreviewLocale] = useState<SurveyLocale>(sendLocale);
  const [autoSend, setAutoSend] = useState(event.satisfactionSurveyAutoSend === true);
  const [validatedAt, setValidatedAt] = useState<string | null>(
    event.satisfactionContentValidatedAt ?? null,
  );
  const [validatedLocale, setValidatedLocale] = useState<SurveyLocale | null>(
    event.satisfactionContentValidatedLocale
      ? surveyLocaleFrom(event.satisfactionContentValidatedLocale)
      : null,
  );
  const [savingAuto, setSavingAuto] = useState(false);
  const [validating, setValidating] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAutoSend(event.satisfactionSurveyAutoSend === true);
    setValidatedAt(event.satisfactionContentValidatedAt ?? null);
    setValidatedLocale(
      event.satisfactionContentValidatedLocale
        ? surveyLocaleFrom(event.satisfactionContentValidatedLocale)
        : null,
    );
    setPreviewLocale(surveyLocaleFrom(event.eventLanguage));
  }, [
    event.id,
    event.satisfactionSurveyAutoSend,
    event.satisfactionContentValidatedAt,
    event.satisfactionContentValidatedLocale,
    event.eventLanguage,
  ]);

  const invitesSent = participations.filter((p) => Boolean(p.calendarInviteSentAt)).length;
  const confirmed = participations.filter(
    (p) => normalizeParticipationStatus(p.status) === "confirmed",
  ).length;
  const surveysSent = participations.filter((p) => Boolean(p.satisfactionSurveySentAt)).length;
  const surveysDone = participations.filter((p) =>
    Boolean(p.satisfactionSurvey?.submittedAt),
  ).length;

  const pendingRecipients = useMemo(() => {
    return participations
      .filter((p) => {
        if (isOrganizerParticipation(p)) return false;
        const status = normalizeParticipationStatus(p.status);
        if (status !== "confirmed" && status !== "attending") return false;
        if (p.satisfactionSurveySentAt) return false;
        return String(p.email ?? "").includes("@");
      })
      .slice()
      .sort((a, b) =>
        String(a.fullName || a.email).localeCompare(String(b.fullName || b.email), "fr"),
      );
  }, [participations]);

  const alreadySentRecipients = useMemo(() => {
    return participations
      .filter((p) => {
        if (isOrganizerParticipation(p)) return false;
        return Boolean(p.satisfactionSurveySentAt);
      })
      .slice()
      .sort((a, b) =>
        String(a.fullName || a.email).localeCompare(String(b.fullName || b.email), "fr"),
      );
  }, [participations]);

  const pendingSurvey = pendingRecipients.length;

  const contentValidated =
    Boolean(validatedAt) && validatedLocale === sendLocale;
  const questions = surveyQuestionsList(previewLocale);
  const previewCopy = SURVEY_COPY[previewLocale];

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

  async function markContentValidated() {
    setValidating(true);
    setError(null);
    setMessage(null);
    try {
      const res = await authFetch(`/api/admin/events/${event.id}/satisfaction-settings`, {
        method: "PATCH",
        body: JSON.stringify({
          validateContent: true,
          validatedLocale: sendLocale,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        satisfactionContentValidatedAt?: string;
        satisfactionContentValidatedLocale?: SurveyLocale;
      };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "save_failed");
      setValidatedAt(json.satisfactionContentValidatedAt ?? new Date().toISOString());
      setValidatedLocale(
        json.satisfactionContentValidatedLocale
          ? surveyLocaleFrom(json.satisfactionContentValidatedLocale)
          : sendLocale,
      );
      setMessage(
        `Contenu validé (${LOCALE_LABELS[sendLocale]}) — tu peux envoyer le questionnaire.`,
      );
      onEventUpdated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setValidating(false);
    }
  }

  async function sendNow() {
    const namesPreview = pendingRecipients
      .slice(0, 8)
      .map((p) => p.fullName?.trim() || p.email)
      .join(", ");
    const more =
      pendingRecipients.length > 8 ? ` (+${pendingRecipients.length - 8} autres)` : "";
    if (!contentValidated) {
      const ok = window.confirm(
        `Tu n’as pas encore validé la langue (${LOCALE_LABELS[sendLocale]}) et les questions.\n\nEnvoyer quand même à ${pendingSurvey} personne(s) ?\n${namesPreview}${more}`,
      );
      if (!ok) return;
    } else if (
      !window.confirm(
        `Envoyer le questionnaire de satisfaction à ${pendingSurvey} personne(s) ?\n${namesPreview}${more}`,
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

        <div className="mb-4">
          <EventTemplateDrawer
            event={event}
            templateKey="satisfaction_survey"
            label="Éditer le modèle email satisfaction"
            onEventUpdated={onEventUpdated}
            hint="Template de l’email (pas des questions). Les questions sont juste en dessous."
          />
        </div>

        <div className="mb-4 space-y-4 rounded-xl border border-ns-alternate bg-white p-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-ns-secondary">
              Langue d’envoi (événement)
            </p>
            <p className="mt-1 text-sm font-semibold text-ns-tertiary">
              {LOCALE_LABELS[sendLocale]}
              <span className="ml-2 text-xs font-normal text-ns-secondary">
                (champ « langue de l’événement » — change-la dans la fiche si besoin)
              </span>
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ns-secondary">
              Questions à valider
            </p>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {(["es", "fr", "en"] as const).map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setPreviewLocale(loc)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    previewLocale === loc
                      ? "bg-[#b4e600] text-[#111]"
                      : "border border-ns-alternate text-ns-tertiary hover:bg-ns-brand-light"
                  }`}
                >
                  {LOCALE_LABELS[loc]}
                  {loc === sendLocale ? " · envoi" : ""}
                </button>
              ))}
            </div>
            <p className="mb-2 text-sm font-semibold text-ns-tertiary">{previewCopy.title}</p>
            <p className="mb-2 text-xs text-ns-secondary">{previewCopy.intro}</p>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ns-tertiary">
              {questions.map((q) => (
                <li key={q.key}>{q.label}</li>
              ))}
              <li className="text-ns-secondary">{previewCopy.commentLabel} (libre)</li>
            </ol>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={`/${previewLocale}/satisfaction?preview=1`}
                target="_blank"
                rel="noopener noreferrer"
                className={`${BTN_SECONDARY} inline-flex items-center`}
              >
                Ouvrir l’aperçu ({LOCALE_LABELS[previewLocale]}) →
              </a>
              <button
                type="button"
                className={BTN_PRIMARY}
                disabled={validating || contentValidated}
                onClick={() => void markContentValidated()}
              >
                {contentValidated
                  ? `Validé (${LOCALE_LABELS[sendLocale]})`
                  : validating
                    ? "Validation…"
                    : `Valider langue + questions (${LOCALE_LABELS[sendLocale]})`}
              </button>
            </div>
            {contentValidated && validatedAt ? (
              <p className="mt-2 text-xs text-ns-secondary">
                Validé le{" "}
                {new Date(validatedAt).toLocaleString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {validatedLocale ? ` · ${LOCALE_LABELS[validatedLocale]}` : ""}
              </p>
            ) : (
              <p className="mt-2 text-xs text-amber-800">
                Première fois : ouvre l’aperçu, vérifie la langue et les questions, puis clique
                Valider avant d’envoyer.
              </p>
            )}
          </div>

          <label className="flex cursor-pointer items-start gap-3 border-t border-gray-100 pt-4">
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

          <div className="space-y-2 border-t border-gray-100 pt-4">
            <p className="text-xs font-bold uppercase tracking-wide text-ns-secondary">
              Destinataires ({pendingSurvey})
            </p>
            <p className="text-xs text-ns-secondary">
              Confirmés / présents, questionnaire pas encore envoyé. Organisateur exclu.
            </p>
            {pendingSurvey === 0 ? (
              <p className="text-sm text-ns-secondary">
                Personne en attente
                {alreadySentRecipients.length > 0
                  ? ` — ${alreadySentRecipients.length} déjà contacté(s).`
                  : "."}
              </p>
            ) : (
              <ul className="max-h-56 overflow-y-auto rounded-xl border border-ns-alternate divide-y divide-gray-100 bg-ns-brand-light/30">
                {pendingRecipients.map((p) => {
                  const status = normalizeParticipationStatus(p.status);
                  return (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-ns-tertiary">
                        {p.fullName?.trim() || "—"}
                      </span>
                      <span className="text-xs text-ns-secondary">{p.email}</span>
                      <span className="w-full text-[11px] text-ns-secondary">
                        {status === "attending" ? "Présent" : "Confirmé"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {alreadySentRecipients.length > 0 ? (
              <details className="text-xs text-ns-secondary">
                <summary className="cursor-pointer font-semibold hover:text-ns-tertiary">
                  Déjà envoyé ({alreadySentRecipients.length})
                </summary>
                <ul className="mt-2 space-y-1 pl-1">
                  {alreadySentRecipients.map((p) => (
                    <li key={p.id}>
                      {(p.fullName?.trim() || "—") + " · " + p.email}
                      {p.satisfactionSurvey?.submittedAt ? " · a répondu" : ""}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={BTN_PRIMARY}
              disabled={sending || pendingSurvey === 0}
              onClick={() => void sendNow()}
            >
              {sending ? "Envoi…" : `Envoyer maintenant (${pendingSurvey})`}
            </button>
          </div>
          {message ? <p className="text-xs font-medium text-ns-primary">{message}</p> : null}
          {error ? <p className={ERROR_TEXT}>{error}</p> : null}
        </div>
      </div>
    </div>
  );
}

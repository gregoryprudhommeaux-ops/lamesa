"use client";

import { useAuthFetch } from "@/hooks/use-auth-fetch";
import {
  defaultLocaleContent,
  TEMPLATE_LOCALE_LABELS,
  TEMPLATE_LOCALES,
} from "@/lib/email/template-defaults";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import type {
  AdminEvent,
  AdminEventParticipation,
  EmailTemplateDoc,
  EmailTemplateKey,
  TemplateLocale,
} from "@/lib/types/events";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  ERROR_TEXT,
  FORM_SECTION_TITLE,
  INPUT_CLASS,
  LABEL_CLASS,
} from "@/lib/ui/nextstep";
import { useCallback, useEffect, useMemo, useState } from "react";

type FunnelStepId = "invitation" | "rsvp" | "confirmed" | "satisfaction";

type FunnelStep = {
  id: FunnelStepId;
  title: string;
  meta: string;
  templateKey?: EmailTemplateKey;
  note?: string;
};

type AdminEventFunnelProps = {
  event: AdminEvent;
  participations: AdminEventParticipation[];
  onEventUpdated?: () => void;
};

function countByStatus(parts: AdminEventParticipation[], status: string): number {
  return parts.filter((p) => normalizeParticipationStatus(p.status) === status).length;
}

export function AdminEventFunnel({
  event,
  participations,
  onEventUpdated,
}: AdminEventFunnelProps) {
  const authFetch = useAuthFetch();
  const [activeStep, setActiveStep] = useState<FunnelStepId>("invitation");
  const eventSendLocale = (event.eventLanguage ?? "es") as TemplateLocale;
  const [editLocale, setEditLocale] = useState<TemplateLocale>(eventSendLocale);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEditLocale((event.eventLanguage ?? "es") as TemplateLocale);
  }, [event.id, event.eventLanguage]);

  const stats = useMemo(() => {
    const invited = countByStatus(participations, "invited");
    const attending = countByStatus(participations, "attending");
    const confirmed = countByStatus(participations, "confirmed");
    const notAttending = countByStatus(participations, "not_attending");
    const waitlist = countByStatus(participations, "waitlist");
    const invitesSent = participations.filter((p) => Boolean(p.calendarInviteSentAt)).length;
    const confirmMails = participations.filter((p) => Boolean(p.confirmationEmailSentAt)).length;
    const surveysSent = participations.filter((p) => Boolean(p.satisfactionSurveySentAt)).length;
    const surveysDone = participations.filter((p) =>
      Boolean(p.satisfactionSurvey?.submittedAt),
    ).length;
    return {
      invited,
      attending,
      confirmed,
      notAttending,
      waitlist,
      invitesSent,
      confirmMails,
      surveysSent,
      surveysDone,
    };
  }, [participations]);

  const steps: FunnelStep[] = useMemo(
    () => [
      {
        id: "invitation",
        title: "1. Invitation",
        meta: `${stats.invited} invited · ${stats.invitesSent} ICS envoyés · ${stats.waitlist} waitlist`,
        templateKey: "calendar_invite",
        note: "Rappels calendrier natifs (ICS) : J-7 · H-36 · H-1h30 — pas d’email séparé.",
      },
      {
        id: "rsvp",
        title: "2. RSVP",
        meta: `${stats.attending} attending · ${stats.notAttending} not attending`,
        note: "Réponse YES/NO via les liens de l’invitation. Pas de template à cette étape.",
      },
      {
        id: "confirmed",
        title: "3. Confirmé",
        meta: `${stats.confirmed} confirmed · ${stats.confirmMails} mails confirmation`,
        templateKey: "participation_confirmed",
      },
      {
        id: "satisfaction",
        title: "4. Satisfaction",
        meta: `${stats.surveysSent} envoyés · ${stats.surveysDone} réponses · cron +12h`,
        templateKey: "satisfaction_survey",
      },
    ],
    [stats],
  );

  const current = steps.find((s) => s.id === activeStep) ?? steps[0]!;

  const loadTemplate = useCallback(async () => {
    if (!current.templateKey) return;
    setError(null);
    try {
      const res = await authFetch(
        `/api/admin/email-templates?locale=${editLocale}&eventId=${encodeURIComponent(event.id)}`,
      );
      const json = (await res.json()) as { ok?: boolean; templates?: EmailTemplateDoc[] };
      if (!res.ok || !json.ok) throw new Error("load_failed");
      const found = json.templates?.find((t) => t.key === current.templateKey);
      const fallback = defaultLocaleContent(current.templateKey, editLocale);
      setSubject(found?.subject ?? fallback.subject);
      setBody(found?.body ?? fallback.body);
    } catch {
      const fallback = defaultLocaleContent(current.templateKey, editLocale);
      setSubject(fallback.subject);
      setBody(fallback.body);
    }
  }, [authFetch, current.templateKey, editLocale, event.id]);

  useEffect(() => {
    void loadTemplate();
    setMessage(null);
  }, [loadTemplate]);

  async function saveOverride(reset = false) {
    if (!current.templateKey) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await authFetch("/api/admin/email-templates", {
        method: "PUT",
        body: JSON.stringify({
          key: current.templateKey,
          locale: editLocale,
          subject: reset ? "xxx" : subject,
          body: reset ? "xxxxxxxxxx" : body,
          reset,
          eventId: event.id,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        template?: EmailTemplateDoc;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.template) throw new Error(json.error ?? "save_failed");
      setSubject(json.template.subject);
      setBody(json.template.body);
      setMessage(
        reset
          ? `Override ${TEMPLATE_LOCALE_LABELS[editLocale]} effacé.`
          : `Template ${TEMPLATE_LOCALE_LABELS[editLocale]} sauvé pour cet event.`,
      );
      onEventUpdated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-100 bg-ns-surface p-5">
      <h3 className={FORM_SECTION_TITLE}>Funnel</h3>
      <p className="mt-1 text-xs text-ns-secondary">
        Templates multilingues. Envoi email / WhatsApp :{" "}
        <strong>{TEMPLATE_LOCALE_LABELS[eventSendLocale]}</strong> (langue de l’événement —
        défaut ES).
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {steps.map((step) => {
          const active = step.id === activeStep;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => setActiveStep(step.id)}
              className={`min-w-[140px] flex-1 rounded-xl border px-3 py-3 text-left ${
                active
                  ? "border-[#b4e600] bg-[#f7ffd6]"
                  : "border-ns-alternate bg-white hover:bg-ns-brand-light"
              }`}
            >
              <span className="block text-xs font-bold text-ns-tertiary">{step.title}</span>
              <span className="mt-1 block text-[11px] leading-snug text-ns-secondary">
                {step.meta}
              </span>
              {step.templateKey ? (
                <span className="mt-2 block text-[11px] font-semibold text-ns-primary">
                  {active ? "Éditer template ↓" : "Template"}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {current.note ? (
        <p className="mt-3 text-xs text-ns-secondary">{current.note}</p>
      ) : null}

      {current.templateKey ? (
        <div className="mt-4 space-y-3 rounded-xl border border-dashed border-ns-alternate bg-white p-4">
          <div className="flex flex-wrap gap-2">
            {TEMPLATE_LOCALES.map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => setEditLocale(loc)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  editLocale === loc
                    ? "bg-[#b4e600] text-[#111]"
                    : "border border-ns-alternate text-ns-tertiary"
                }`}
              >
                {TEMPLATE_LOCALE_LABELS[loc]}
                {loc === eventSendLocale ? " · envoi" : ""}
              </button>
            ))}
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor={`funnel-subject-${current.id}`}>
              Objet ({TEMPLATE_LOCALE_LABELS[editLocale]})
            </label>
            <input
              id={`funnel-subject-${current.id}`}
              className={INPUT_CLASS}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor={`funnel-body-${current.id}`}>
              Corps
            </label>
            <textarea
              id={`funnel-body-${current.id}`}
              className={`${INPUT_CLASS} min-h-[180px] font-mono text-sm`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-ns-secondary">
              Variables : {"{{fullName}}"}, {"{{eventTitle}}"}, {"{{when}}"}, {"{{where}}"},{" "}
              {"{{eventUrl}}"}, {"{{yesUrl}}"}, {"{{noUrl}}"}, {"{{surveyUrl}}"},{" "}
              {"{{priceBeforeTax}}"}, {"{{ivaAmount}}"}, {"{{totalWithIva}}"}, {"{{menuIncluded}}"}
            </p>
          </div>
          {error && <p className={ERROR_TEXT}>{error}</p>}
          {message && <p className="text-sm font-medium text-ns-primary">{message}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={BTN_PRIMARY}
              disabled={saving}
              onClick={() => void saveOverride(false)}
            >
              {saving ? "Enregistrement…" : `Sauver ${TEMPLATE_LOCALE_LABELS[editLocale]}`}
            </button>
            <button
              type="button"
              className={BTN_SECONDARY}
              disabled={saving}
              onClick={() => void saveOverride(true)}
            >
              Réinit. cette langue
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-ns-alternate bg-white p-4 text-sm text-ns-secondary">
          Compteurs live depuis la liste des participants. Les réponses RSVP mettent à jour les
          statuts Attending / Not attending.
        </div>
      )}
    </section>
  );
}

"use client";

import { useAuthFetch } from "@/hooks/use-auth-fetch";
import {
  defaultLocaleContent,
  TEMPLATE_LOCALE_LABELS,
  TEMPLATE_LOCALES,
} from "@/lib/email/template-defaults";
import type {
  AdminEvent,
  EmailTemplateDoc,
  EmailTemplateKey,
  TemplateLocale,
} from "@/lib/types/events";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  ERROR_TEXT,
  INPUT_CLASS,
  LABEL_CLASS,
} from "@/lib/ui/nextstep";
import { useCallback, useEffect, useState } from "react";

type EventEmailTemplateEditorProps = {
  event: AdminEvent;
  templateKey: EmailTemplateKey;
  onEventUpdated?: () => void;
  hint?: string;
};

export function EventEmailTemplateEditor({
  event,
  templateKey,
  onEventUpdated,
  hint,
}: EventEmailTemplateEditorProps) {
  const authFetch = useAuthFetch();
  const eventSendLocale = (event.eventLanguage ?? "es") as TemplateLocale;
  const [editLocale, setEditLocale] = useState<TemplateLocale>(eventSendLocale);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEditLocale((event.eventLanguage ?? "es") as TemplateLocale);
  }, [event.id, event.eventLanguage]);

  const loadTemplate = useCallback(async () => {
    setError(null);
    try {
      const res = await authFetch(
        `/api/admin/email-templates?locale=${editLocale}&eventId=${encodeURIComponent(event.id)}`,
      );
      const json = (await res.json()) as { ok?: boolean; templates?: EmailTemplateDoc[] };
      if (!res.ok || !json.ok) throw new Error("load_failed");
      const found = json.templates?.find((t) => t.key === templateKey);
      const fallback = defaultLocaleContent(templateKey, editLocale);
      setSubject(found?.subject ?? fallback.subject);
      setBody(found?.body ?? fallback.body);
    } catch {
      const fallback = defaultLocaleContent(templateKey, editLocale);
      setSubject(fallback.subject);
      setBody(fallback.body);
    }
  }, [authFetch, editLocale, event.id, templateKey]);

  useEffect(() => {
    void loadTemplate();
    setMessage(null);
  }, [loadTemplate]);

  async function saveOverride(reset = false) {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await authFetch("/api/admin/email-templates", {
        method: "PUT",
        body: JSON.stringify({
          key: templateKey,
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

  async function sendTestEmail() {
    if (!subject.trim() || !body.trim()) {
      setError("Objet et corps requis pour un envoi test.");
      return;
    }
    setSendingTest(true);
    setMessage(null);
    setError(null);
    try {
      const res = await authFetch("/api/admin/email-templates/send-test", {
        method: "POST",
        body: JSON.stringify({
          subject,
          body,
          locale: editLocale,
          eventId: event.id,
          templateKey,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        to?: string;
        error?: string;
      };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "send_failed");
      setMessage(`Email test envoyé à ${json.to ?? "ton adresse admin"}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSendingTest(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-ns-alternate bg-white p-4">
      {hint ? <p className="text-xs text-ns-secondary">{hint}</p> : null}
      <p className="text-[11px] text-ns-secondary">
        Envoi : <strong>{TEMPLATE_LOCALE_LABELS[eventSendLocale]}</strong> (langue de l’événement).
      </p>
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
        <label className={LABEL_CLASS} htmlFor={`tpl-subject-${templateKey}`}>
          Objet ({TEMPLATE_LOCALE_LABELS[editLocale]})
        </label>
        <input
          id={`tpl-subject-${templateKey}`}
          className={INPUT_CLASS}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </div>
      <div>
        <label className={LABEL_CLASS} htmlFor={`tpl-body-${templateKey}`}>
          Corps
        </label>
        <textarea
          id={`tpl-body-${templateKey}`}
          className={`${INPUT_CLASS} min-h-[180px] font-mono text-sm`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <p className="mt-1 text-[11px] text-ns-secondary">
          Variables : {"{{fullName}}"}, {"{{eventTitle}}"}, {"{{when}}"}, {"{{where}}"},{" "}
          {"{{eventUrl}}"}, {"{{yesUrl}}"}, {"{{noUrl}}"}, {"{{surveyUrl}}"},{" "}
          {"{{priceBeforeTax}}"}, {"{{ivaAmount}}"}, {"{{totalWithIva}}"},{" "}
          {"{{accessIncludes}}"}, {"{{menuIncluded}}"}, {"{{paymentDeadline}}"},{" "}
          {"{{paymentDeadlineBlock}}"}, {"{{seatScarcityBlock}}"}
          {" · "}Mise en forme : {"<bold>…</bold>"}, {"<b>"}, {"<i>"}, liens{" "}
          {'<a href="https://…">'}
        </p>
      </div>
      {error && <p className={ERROR_TEXT}>{error}</p>}
      {message && <p className="text-sm font-medium text-ns-primary">{message}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={BTN_PRIMARY}
          disabled={saving || sendingTest}
          onClick={() => void saveOverride(false)}
        >
          {saving ? "Enregistrement…" : `Sauver ${TEMPLATE_LOCALE_LABELS[editLocale]}`}
        </button>
        <button
          type="button"
          className={BTN_SECONDARY}
          disabled={saving || sendingTest}
          onClick={() => void sendTestEmail()}
        >
          {sendingTest ? "Envoi test…" : "Envoyer un email test"}
        </button>
        <button
          type="button"
          className={BTN_SECONDARY}
          disabled={saving || sendingTest}
          onClick={() => void saveOverride(true)}
        >
          Réinit. cette langue
        </button>
      </div>
    </div>
  );
}

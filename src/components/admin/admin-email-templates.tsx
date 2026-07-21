"use client";

import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { wrapLaMesaPlainBody } from "@/lib/email/la-mesa-email-shell";
import {
  DEFAULT_SEND_LOCALE,
  EMAIL_TEMPLATE_LABELS,
  isCustomEmailTemplateKey,
  isSystemEmailTemplateKey,
  SYSTEM_EMAIL_TEMPLATE_KEYS,
  TEMPLATE_LOCALE_LABELS,
  TEMPLATE_LOCALES,
  templateLabel,
} from "@/lib/email/template-defaults";
import type {
  AdminEvent,
  EmailTemplateDoc,
  EmailTemplateKey,
  TemplateLocale,
} from "@/lib/types/events";
import { BTN_PRIMARY, BTN_SECONDARY, ERROR_TEXT, INPUT_CLASS, LABEL_CLASS } from "@/lib/ui/nextstep";
import { useCallback, useEffect, useMemo, useState } from "react";

export function AdminEmailTemplatesPanel() {
  const authFetch = useAuthFetch();
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [templates, setTemplates] = useState<EmailTemplateDoc[]>([]);
  const [activeKey, setActiveKey] = useState<EmailTemplateKey>("calendar_invite");
  const [editLocale, setEditLocale] = useState<TemplateLocale>(DEFAULT_SEND_LOCALE);
  const [eventId, setEventId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const activeMeta = useMemo(
    () => templates.find((t) => t.key === activeKey),
    [templates, activeKey],
  );
  const isCustom = isCustomEmailTemplateKey(activeKey);

  const previewHtml = useMemo(
    () =>
      wrapLaMesaPlainBody(body || "(Aperçu du corps…)", {
        lang: editLocale,
      }),
    [body, editLocale],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ locale: editLocale });
      if (eventId) qs.set("eventId", eventId);
      const [tplRes, evRes] = await Promise.all([
        authFetch(`/api/admin/email-templates?${qs.toString()}`),
        authFetch("/api/admin/events"),
      ]);
      const tplJson = (await tplRes.json()) as {
        ok?: boolean;
        templates?: EmailTemplateDoc[];
        error?: string;
      };
      const evJson = (await evRes.json()) as {
        ok?: boolean;
        events?: AdminEvent[];
        error?: string;
      };
      if (!tplRes.ok || !tplJson.ok) throw new Error(tplJson.error ?? "load_failed");
      const list = tplJson.templates ?? [];
      setTemplates(list);
      setEvents(evJson.events ?? []);
      const current =
        list.find((t) => t.key === activeKey) ??
        list.find((t) => t.key === "calendar_invite") ??
        list[0];
      if (current) {
        if (!list.some((t) => t.key === activeKey)) {
          setActiveKey(current.key);
        }
        setSubject(current.subject);
        setBody(current.body);
        setEnabled(current.enabled !== false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [authFetch, activeKey, editLocale, eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createTemplate() {
    setCreating(true);
    setMessage(null);
    setError(null);
    try {
      const res = await authFetch("/api/admin/email-templates", {
        method: "POST",
        body: JSON.stringify({ label: newLabel.trim() }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        template?: EmailTemplateDoc;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.template) {
        throw new Error(json.error ?? "create_failed");
      }
      setNewLabel("");
      setActiveKey(json.template.key);
      setSubject(json.template.subject);
      setBody(json.template.body);
      setEnabled(true);
      setMessage(`Template « ${json.template.label ?? json.template.key} » créé (ES/FR/EN).`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }

  async function save(opts: { reset?: boolean; asEventOverride?: boolean }) {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      if (opts.asEventOverride && !eventId) {
        throw new Error("Sélectionne un événement pour l’override.");
      }
      if (opts.asEventOverride && isCustom) {
        throw new Error("Les templates custom sont globaux (pas d’override event).");
      }
      const res = await authFetch("/api/admin/email-templates", {
        method: "PUT",
        body: JSON.stringify({
          key: activeKey,
          locale: editLocale,
          subject: opts.reset ? "xxx" : subject,
          body: opts.reset ? "xxxxxxxxxx" : body,
          reset: Boolean(opts.reset),
          ...(opts.asEventOverride ? { eventId } : {}),
          ...(activeMeta?.label ? { label: activeMeta.label } : {}),
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        template?: EmailTemplateDoc;
        error?: string;
        translated?: boolean;
      };
      if (!res.ok || !json.ok || !json.template) throw new Error(json.error ?? "save_failed");
      setSubject(json.template.subject);
      setBody(json.template.body);
      const otherLocales = TEMPLATE_LOCALES.filter((l) => l !== editLocale)
        .map((l) => TEMPLATE_LOCALE_LABELS[l])
        .join(" et ");
      setMessage(
        opts.reset
          ? `Template ${TEMPLATE_LOCALE_LABELS[editLocale]} réinitialisé.`
          : opts.asEventOverride
            ? `Override enregistré pour l’event (${TEMPLATE_LOCALE_LABELS[editLocale]}) — ${otherLocales} mis à jour par traduction.`
            : `Template ${TEMPLATE_LOCALE_LABELS[editLocale]} enregistré (global) — ${otherLocales} mis à jour par traduction.`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const next = !enabled;
      const res = await authFetch("/api/admin/email-templates", {
        method: "PUT",
        body: JSON.stringify({
          key: activeKey,
          locale: editLocale,
          enabled: next,
          ...(eventId && !isCustom ? { eventId } : {}),
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        template?: EmailTemplateDoc;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.template) throw new Error(json.error ?? "toggle_failed");
      setEnabled(json.template.enabled !== false);
      setMessage(
        json.template.enabled !== false
          ? "Template activé — les envois repris."
          : "Template désactivé — aucun envoi pour ce mail.",
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function removeCustomTemplate() {
    const label = templateLabel(activeKey, activeMeta?.label);
    const scopeLabel = isCustom
      ? `le template custom « ${label} » (suppression définitive)`
      : eventId
        ? "l’override de cet événement"
        : "la version personnalisée globale (ES / FR / EN)";
    const ok = window.confirm(
      `Supprimer ${scopeLabel} ?${isCustom ? "" : "\n\nLe texte reviendra aux valeurs par défaut du code."}`,
    );
    if (!ok) return;

    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await authFetch("/api/admin/email-templates", {
        method: "DELETE",
        body: JSON.stringify({
          key: activeKey,
          locale: editLocale,
          ...(eventId && !isCustom ? { eventId } : {}),
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        template?: EmailTemplateDoc;
        error?: string;
        hardDeleted?: boolean;
      };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "delete_failed");
      if (json.hardDeleted) {
        setActiveKey("calendar_invite");
        setMessage("Template custom supprimé.");
      } else if (json.template) {
        setSubject(json.template.subject);
        setBody(json.template.body);
        setMessage(
          eventId
            ? "Override event supprimé — retour au template global / défaut."
            : "Template personnalisé supprimé — retour aux valeurs par défaut.",
        );
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const systemTemplates = templates.filter((t) => isSystemEmailTemplateKey(t.key));
  const customTemplates = templates.filter((t) => isCustomEmailTemplateKey(t.key));

  if (loading) return <p className="text-sm text-ns-secondary">Chargement…</p>;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-100 bg-ns-surface p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ns-secondary">
          Créer un template
        </h2>
        <p className="mt-1 text-xs text-ns-secondary">
          Même design que les mails LA MESA (fond sombre, carte blanche, marque lime). Les
          templates custom sont globaux — utiles pour drafts / campagnes manuelles. Les
          automations (invitation, rappel, etc.) restent dans la liste système.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <label className={LABEL_CLASS} htmlFor="new-tpl-label">
              Nom du template
            </label>
            <input
              id="new-tpl-label"
              className={INPUT_CLASS}
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Ex. Nurture J+7"
            />
          </div>
          <button
            type="button"
            className={BTN_PRIMARY}
            disabled={creating || newLabel.trim().length < 2}
            onClick={() => void createTemplate()}
          >
            {creating ? "Création…" : "Créer"}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-4">
          <div className="space-y-1">
            <p className="px-1 text-[10px] font-bold uppercase tracking-wide text-ns-secondary">
              Automatiques
            </p>
            {(systemTemplates.length
              ? systemTemplates
              : SYSTEM_EMAIL_TEMPLATE_KEYS.map((key) => ({
                  key,
                  enabled: true,
                  label: EMAIL_TEMPLATE_LABELS[key],
                }))
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setActiveKey(t.key);
                  setMessage(null);
                }}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                  activeKey === t.key
                    ? "bg-ns-primary/15 font-semibold text-ns-primary"
                    : "hover:bg-ns-brand-light"
                }`}
              >
                <span className="block">
                  {templateLabel(t.key, "label" in t ? t.label : undefined)}
                </span>
                <span
                  className={`mt-1 inline-block text-[10px] font-bold uppercase tracking-wide ${
                    t.enabled !== false ? "text-ns-primary" : "text-red-600"
                  }`}
                >
                  {t.enabled !== false ? "Actif" : "Désactivé"}
                </span>
              </button>
            ))}
          </div>

          {customTemplates.length > 0 ? (
            <div className="space-y-1 border-t border-gray-100 pt-3">
              <p className="px-1 text-[10px] font-bold uppercase tracking-wide text-ns-secondary">
                Custom
              </p>
              {customTemplates.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    setActiveKey(t.key);
                    setMessage(null);
                  }}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                    activeKey === t.key
                      ? "bg-ns-primary/15 font-semibold text-ns-primary"
                      : "hover:bg-ns-brand-light"
                  }`}
                >
                  <span className="block">{templateLabel(t.key, t.label)}</span>
                  <span className="mt-1 inline-block text-[10px] font-bold uppercase tracking-wide text-ns-secondary">
                    Custom
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </aside>

        <section className="space-y-4 rounded-2xl border border-gray-100 bg-ns-surface p-5">
          <div>
            <h2 className="text-xl font-bold text-ns-hero">
              {templateLabel(activeKey, activeMeta?.label)}
            </h2>
            <p className="mt-1 text-xs text-ns-secondary">
              Multilingue ES / FR / EN. Envoi email & WhatsApp : langue de l’événement (défaut{" "}
              <strong>Español</strong>).
              {isCustom ? " · Template custom (global)." : null}
            </p>
            <p
              className={`mt-2 text-sm font-semibold ${
                enabled ? "text-ns-primary" : "text-red-700"
              }`}
            >
              Statut envoi : {enabled ? "activé" : "désactivé (non envoyé)"}
            </p>
            <p className="mt-1 text-xs text-ns-secondary">
              Variables : {"{{fullName}}"}, {"{{firstName}}"}, {"{{email}}"}, {"{{eventTitle}}"},{" "}
              {"{{format}}"}, {"{{when}}"}, {"{{where}}"}, {"{{eventUrl}}"}, {"{{yesUrl}}"},{" "}
              {"{{noUrl}}"}, {"{{surveyUrl}}"}, {"{{loginUrl}}"}, {"{{sponsorName}}"},{" "}
              {"{{inviteUrl}}"}, prix…
            </p>
          </div>
          {error && <p className={ERROR_TEXT}>{error}</p>}
          {message && <p className="text-sm font-medium text-ns-primary">{message}</p>}

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
                {loc === DEFAULT_SEND_LOCALE ? " · défaut envoi" : ""}
              </button>
            ))}
          </div>
          <p className="text-xs text-ns-secondary">
            À l’enregistrement, ES / FR / EN sont synchronisés par traduction depuis la langue
            active. Les variables {"{{…}}"} sont conservées.
          </p>

          {!isCustom ? (
            <div>
              <label className={LABEL_CLASS}>Événement (override optionnel)</label>
              <select
                className={INPUT_CLASS}
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
              >
                <option value="">— Global (tous les événements) —</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title}
                    {ev.eventLanguage ? ` (${ev.eventLanguage})` : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div>
            <label className={LABEL_CLASS}>Objet ({TEMPLATE_LOCALE_LABELS[editLocale]})</label>
            <input
              className={INPUT_CLASS}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Corps (texte — le design HTML LA MESA s’applique à l’envoi)</label>
            <textarea
              className={`${INPUT_CLASS} min-h-[240px] font-mono text-sm`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={BTN_SECONDARY}
              onClick={() => setShowPreview((v) => !v)}
            >
              {showPreview ? "Masquer l’aperçu" : "Aperçu design"}
            </button>
          </div>

          {showPreview ? (
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <p className="border-b border-gray-100 bg-ns-brand-light px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-ns-secondary">
                Aperçu HTML (shell LA MESA)
              </p>
              <iframe
                title="Aperçu email LA MESA"
                className="h-[420px] w-full bg-[#0f1210]"
                srcDoc={previewHtml}
              />
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={
                enabled
                  ? "inline-flex items-center justify-center rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-amber-900 transition hover:bg-amber-100 disabled:opacity-50"
                  : BTN_PRIMARY
              }
              disabled={saving}
              onClick={() => void toggleEnabled()}
            >
              {enabled ? "Désactiver" : "Activer"}
            </button>
            <button
              type="button"
              className={BTN_PRIMARY}
              disabled={saving}
              onClick={() => void save({ asEventOverride: false })}
            >
              {saving
                ? "Traduction + enregistrement…"
                : `Enregistrer ES/FR/EN depuis ${TEMPLATE_LOCALE_LABELS[editLocale]}`}
            </button>
            {!isCustom ? (
              <button
                type="button"
                className={BTN_SECONDARY}
                disabled={saving || !eventId}
                onClick={() => void save({ asEventOverride: true })}
              >
                Utiliser pour cet event
              </button>
            ) : null}
            <button
              type="button"
              className={BTN_SECONDARY}
              disabled={saving}
              onClick={() => void save({ reset: true, asEventOverride: Boolean(eventId) && !isCustom })}
            >
              Réinit. cette langue
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-red-700 transition hover:bg-red-100 disabled:opacity-50"
              disabled={saving}
              onClick={() => void removeCustomTemplate()}
            >
              Supprimer
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

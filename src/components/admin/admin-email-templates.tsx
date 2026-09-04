"use client";

import { ColdOutreachPanel } from "@/components/admin/cold-outreach-panel";
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
import { Copy, MoreVertical, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function AdminEmailTemplatesPanel() {
  const authFetch = useAuthFetch();
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [templates, setTemplates] = useState<EmailTemplateDoc[]>([]);
  const [activeKey, setActiveKey] = useState<EmailTemplateKey>("calendar_invite");
  const [editLocale, setEditLocale] = useState<TemplateLocale>(DEFAULT_SEND_LOCALE);
  const [eventId, setEventId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [previewBody, setPreviewBody] = useState(body);
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  /** Prevents mid-edit form wipe when authFetch identity changes. */
  const hydratedSelectionRef = useRef<string | null>(null);

  const activeMeta = useMemo(
    () => templates.find((t) => t.key === activeKey),
    [templates, activeKey],
  );
  const isCustom = isCustomEmailTemplateKey(activeKey);
  const selectionKey = `${activeKey}|${editLocale}|${eventId}`;

  // Debounce preview so typing doesn't remount the iframe (layout jump)
  useEffect(() => {
    const t = window.setTimeout(() => setPreviewBody(body), 280);
    return () => window.clearTimeout(t);
  }, [body]);

  const previewHtml = useMemo(
    () =>
      wrapLaMesaPlainBody(previewBody || "(Aperçu du corps…)", {
        lang: editLocale,
      }),
    [previewBody, editLocale],
  );
  const previewFooterHint =
    editLocale === "en"
      ? "How it works"
      : editLocale === "es"
        ? "Funcionamiento"
        : "Fonctionnement";

  const fetchTemplates = useCallback(async (): Promise<EmailTemplateDoc[]> => {
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
    return list;
  }, [authFetch, editLocale, eventId]);

  const hydrateFromList = useCallback(
    (list: EmailTemplateDoc[], force = false) => {
      const current =
        list.find((t) => t.key === activeKey) ??
        list.find((t) => t.key === "calendar_invite") ??
        list[0];
      if (!current) return;
      if (!list.some((t) => t.key === activeKey)) {
        setActiveKey(current.key);
      }
      const keyForCurrent = `${current.key}|${editLocale}|${eventId}`;
      if (!force && hydratedSelectionRef.current === keyForCurrent) return;
      hydratedSelectionRef.current = keyForCurrent;
      setSubject(current.subject);
      setBody(current.body);
      setEnabled(current.enabled !== false);
      setEditLabel(
        (current.label?.trim() || templateLabel(current.key, current.label)).slice(0, 80),
      );
    },
    [activeKey, editLocale, eventId],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await fetchTemplates();
        if (cancelled) return;
        // Always hydrate when selection changes; skip only if same selection re-fetched
        const force = hydratedSelectionRef.current !== selectionKey;
        hydrateFromList(list, force);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchTemplates, hydrateFromList, selectionKey]);

  async function refreshList(rehydrate = false) {
    if (rehydrate) hydratedSelectionRef.current = null;
    const list = await fetchTemplates();
    if (rehydrate) hydrateFromList(list, true);
    return list;
  }

  useEffect(() => {
    if (!menuKey) return;
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuKey(null);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuKey(null);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [menuKey]);

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
      hydratedSelectionRef.current = null;
      setActiveKey(json.template.key);
      setSubject(json.template.subject);
      setBody(json.template.body);
      setEditLabel(
        (json.template.label?.trim() || templateLabel(json.template.key, json.template.label)).slice(
          0,
          80,
        ),
      );
      setEnabled(true);
      setMessage(`Template « ${json.template.label ?? json.template.key} » créé (ES/FR/EN).`);
      await refreshList(true);
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
      const trimmedSubject = subject.trim();
      const trimmedBody = body.trim();
      if (!opts.reset) {
        if (trimmedSubject.length < 3) throw new Error("L’objet (titre) du mail est trop court.");
        if (trimmedBody.length < 10) throw new Error("Le corps du mail est trop court.");
      }
      if (isCustom && editLabel.trim().length < 2) {
        throw new Error("Le nom du template est trop court.");
      }
      const res = await authFetch("/api/admin/email-templates", {
        method: "PUT",
        body: JSON.stringify({
          key: activeKey,
          locale: editLocale,
          subject: opts.reset ? "xxx" : trimmedSubject,
          body: opts.reset ? "xxxxxxxxxx" : trimmedBody,
          reset: Boolean(opts.reset),
          enabled,
          ...(isCustom ? { label: editLabel.trim() } : {}),
          ...(opts.asEventOverride ? { eventId } : {}),
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
      setEnabled(json.template.enabled !== false);
      if (json.template.label?.trim()) {
        setEditLabel(json.template.label.trim().slice(0, 80));
      }
      hydratedSelectionRef.current = selectionKey;
      const otherLocales = TEMPLATE_LOCALES.filter((l) => l !== editLocale)
        .map((l) => TEMPLATE_LOCALE_LABELS[l])
        .join(" et ");
      setMessage(
        opts.reset
          ? `Template ${TEMPLATE_LOCALE_LABELS[editLocale]} réinitialisé.`
          : opts.asEventOverride
            ? `Override enregistré pour l’event (objet + corps + statut) — ${otherLocales} mis à jour par traduction.`
            : `Objet, corps${isCustom ? ", nom" : ""} et statut enregistrés (${TEMPLATE_LOCALE_LABELS[editLocale]}) — ${otherLocales} mis à jour par traduction.`,
      );
      await refreshList(false);
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
      await refreshList(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function removeCustomTemplate(targetKey?: EmailTemplateKey) {
    const key = targetKey ?? activeKey;
    const meta = templates.find((t) => t.key === key);
    const customTarget = isCustomEmailTemplateKey(key);
    const label = templateLabel(key, meta?.label);
    const scopeLabel = customTarget
      ? `le template custom « ${label} » (suppression définitive)`
      : eventId
        ? "l’override de cet événement"
        : "la version personnalisée globale (ES / FR / EN)";
    const ok = window.confirm(
      `Supprimer ${scopeLabel} ?${customTarget ? "" : "\n\nLe texte reviendra aux valeurs par défaut du code."}`,
    );
    if (!ok) return;

    setSaving(true);
    setMessage(null);
    setError(null);
    setMenuKey(null);
    try {
      const res = await authFetch("/api/admin/email-templates", {
        method: "DELETE",
        body: JSON.stringify({
          key,
          locale: editLocale,
          ...(eventId && !customTarget ? { eventId } : {}),
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
        if (activeKey === key) setActiveKey("calendar_invite");
        setMessage("Template custom supprimé.");
      } else if (json.template) {
        if (activeKey === key) {
          setSubject(json.template.subject);
          setBody(json.template.body);
        }
        setMessage(
          eventId
            ? "Override event supprimé — retour au template global / défaut."
            : "Template personnalisé supprimé — retour aux valeurs par défaut.",
        );
      }
      await refreshList(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function duplicateCustomTemplate(source: EmailTemplateDoc) {
    const baseLabel = templateLabel(source.key, source.label).trim() || "Template";
    const suggested = `${baseLabel} (copie)`.slice(0, 80);
    const label = window.prompt("Nom du nouveau template :", suggested)?.trim();
    if (!label || label.length < 2) return;

    setCreating(true);
    setMessage(null);
    setError(null);
    setMenuKey(null);
    try {
      const res = await authFetch("/api/admin/email-templates", {
        method: "POST",
        body: JSON.stringify({
          label,
          duplicateFrom: source.key,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        template?: EmailTemplateDoc;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.template) {
        throw new Error(json.error ?? "duplicate_failed");
      }
      setActiveKey(json.template.key);
      setSubject(json.template.subject);
      setBody(json.template.body);
      setEditLabel(
        (json.template.label?.trim() || templateLabel(json.template.key, json.template.label)).slice(
          0,
          80,
        ),
      );
      setEnabled(true);
      hydratedSelectionRef.current = null;
      setMessage(`Template « ${json.template.label ?? json.template.key} » dupliqué.`);
      await refreshList(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }

  const systemTemplates = templates.filter((t) => isSystemEmailTemplateKey(t.key));
  const customTemplates = templates.filter((t) => isCustomEmailTemplateKey(t.key));

  if (loading) return <p className="text-sm text-ns-secondary">Chargement…</p>;

  return (
    <div className="w-full min-w-0 max-w-full space-y-6 overflow-x-hidden">
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
          <div className="min-w-0 flex-1 basis-[220px]">
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

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          {customTemplates.length > 0 ? (
            <div className="space-y-1">
              <p className="px-1 text-[10px] font-bold uppercase tracking-wide text-ns-secondary">
                Custom
              </p>
              {customTemplates.map((t) => (
                <div
                  key={t.key}
                  className={`relative flex min-w-0 items-stretch rounded-lg ${
                    activeKey === t.key ? "bg-ns-primary/15" : "hover:bg-ns-brand-light"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveKey(t.key);
                      setMessage(null);
                      setMenuKey(null);
                    }}
                    className={`min-w-0 flex-1 px-3 py-2 text-left text-sm ${
                      activeKey === t.key ? "font-semibold text-ns-primary" : ""
                    }`}
                  >
                    <span className="block truncate">{templateLabel(t.key, t.label)}</span>
                    <span className="mt-1 inline-block text-[10px] font-bold uppercase tracking-wide text-ns-secondary">
                      Custom
                    </span>
                  </button>
                  <div className="relative shrink-0 self-center pr-1" ref={menuKey === t.key ? menuRef : undefined}>
                    <button
                      type="button"
                      aria-label={`Actions ${templateLabel(t.key, t.label)}`}
                      aria-expanded={menuKey === t.key}
                      className="rounded-md p-1.5 text-ns-secondary hover:bg-white/80 hover:text-ns-tertiary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuKey((k) => (k === t.key ? null : t.key));
                      }}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {menuKey === t.key ? (
                      <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border border-gray-100 bg-white py-1 shadow-lg">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ns-tertiary hover:bg-ns-brand-light"
                          disabled={creating || saving}
                          onClick={() => void duplicateCustomTemplate(t)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Dupliquer
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                          disabled={creating || saving}
                          onClick={() => void removeCustomTemplate(t.key)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Effacer
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-200 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-ns-secondary">
                Custom
              </p>
              <p className="mt-1 text-xs text-ns-secondary">
                Aucun template custom — crée-en un ci-dessus.
              </p>
            </div>
          )}

          <div className="space-y-1 border-t border-gray-100 pt-3">
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
                className={`w-full min-w-0 rounded-lg px-3 py-2 text-left text-sm ${
                  activeKey === t.key
                    ? "bg-ns-primary/15 font-semibold text-ns-primary"
                    : "hover:bg-ns-brand-light"
                }`}
              >
                <span className="block truncate">
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
        </aside>

        <section className="min-w-0 max-w-full space-y-4 overflow-hidden rounded-2xl border border-gray-100 bg-ns-surface p-5">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-ns-hero">
              {isCustom ? editLabel || templateLabel(activeKey, activeMeta?.label) : templateLabel(activeKey, activeMeta?.label)}
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
            <p className="mt-1 break-words text-xs text-ns-secondary">
              Variables : {"{{fullName}}"}, {"{{firstName}}"}, {"{{email}}"}, {"{{eventTitle}}"},{" "}
              {"{{format}}"}, {"{{when}}"}, {"{{where}}"}, {"{{eventUrl}}"}, {"{{yesUrl}}"},{" "}
              {"{{noUrl}}"}, {"{{surveyUrl}}"}, {"{{loginUrl}}"}, {"{{sponsorName}}"},{" "}
              {"{{inviteUrl}}"}, {"{{priceBeforeTax}}"}, {"{{ivaAmount}}"}, {"{{totalWithIva}}"},{" "}
              {"{{accessIncludes}}"}, {"{{menuIncluded}}"}
              {activeKey === "fn_announcement" ? (
                <>
                  , {"{{profilePercent}}"}, {"{{profileMatchNote}}"}, {"{{profileUrl}}"},{" "}
                  {"{{missingFields}}"}
                </>
              ) : null}
              {activeKey === "profile_incomplete" ? (
                <>, {"{{missingFields}}"}</>
              ) : null}
              …
            </p>
          </div>
          {error && <p className={ERROR_TEXT}>{error}</p>}
          {message && <p className="text-sm font-medium text-ns-primary">{message}</p>}

          <div className="flex flex-wrap gap-2">
            {TEMPLATE_LOCALES.map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => {
                  hydratedSelectionRef.current = null;
                  setEditLocale(loc);
                }}
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
            À l’enregistrement, l’objet + le corps ES / FR / EN sont synchronisés par traduction
            depuis la langue active. Les variables {"{{…}}"} sont conservées. Le nom du template et
            le statut d’envoi sont aussi sauvegardés.
          </p>

          {!isCustom ? (
            <div>
              <label className={LABEL_CLASS}>Événement (override optionnel)</label>
              <select
                className={INPUT_CLASS}
                value={eventId}
                onChange={(e) => {
                  hydratedSelectionRef.current = null;
                  setEventId(e.target.value);
                }}
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
          ) : (
            <div>
              <label className={LABEL_CLASS}>Nom du template (liste Custom)</label>
              <input
                className={INPUT_CLASS}
                value={editLabel}
                maxLength={80}
                onChange={(e) => setEditLabel(e.target.value)}
                placeholder="Ex. STD dirigeants FR — 24 sept. 2026"
              />
            </div>
          )}

          <div>
            <label className={LABEL_CLASS}>
              Objet / titre du mail ({TEMPLATE_LOCALE_LABELS[editLocale]})
            </label>
            <input
              className={INPUT_CLASS}
              value={subject}
              maxLength={300}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Sujet visible dans la boîte mail"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ns-tertiary">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Envois activés pour ce template
          </label>

          <div>
            <label className={LABEL_CLASS}>
              Corps (texte + HTML léger — shell LA MESA à l’envoi)
            </label>
            <p className="mb-1.5 break-words text-[11px] leading-snug text-ns-secondary">
              Liens et emphase :{" "}
              <code className="break-all rounded bg-gray-100 px-1 text-[10px]">
                {'<a href="https://…">texte</a>'}
              </code>
              ,{" "}
              <code className="rounded bg-gray-100 px-1 text-[10px]">{"<bold>…</bold>"}</code>
              {" "}
              (ou <code className="rounded bg-gray-100 px-1 text-[10px]">{"<b>"}</code>),{" "}
              <code className="rounded bg-gray-100 px-1 text-[10px]">{"<i>"}</code>,{" "}
              <code className="rounded bg-gray-100 px-1 text-[10px]">{"<u>"}</code>,{" "}
              <code className="rounded bg-gray-100 px-1 text-[10px]">{"<br>"}</code>
              . Autre HTML ignoré / échappé.
            </p>
            <textarea
              className={`${INPUT_CLASS} min-h-[240px] w-full max-w-full break-words font-mono text-sm`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              wrap="soft"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={BTN_PRIMARY}
              disabled={saving}
              onClick={() => void save({ asEventOverride: false })}
            >
              {saving ? "Enregistrement…" : "Enregistrer les modifications"}
            </button>
            <button
              type="button"
              className={BTN_SECONDARY}
              onClick={() => setShowPreview((v) => !v)}
            >
              {showPreview ? "Masquer l’aperçu" : "Aperçu design"}
            </button>
          </div>

          {showPreview ? (
            <div className="max-w-full overflow-hidden rounded-xl border border-gray-200">
              <p className="border-b border-gray-100 bg-ns-brand-light px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-ns-secondary">
                Aperçu HTML (shell LA MESA)
              </p>
              <p className="border-b border-gray-100 bg-white px-3 py-2 text-xs text-ns-tertiary">
                <span className="font-bold text-ns-secondary">Objet : </span>
                {subject.trim() || "—"}
              </p>
              <iframe
                key={`preview-${editLocale}-${previewFooterHint}`}
                title="Aperçu email LA MESA"
                className="block h-[480px] w-full max-w-full bg-[#0f1210]"
                srcDoc={previewHtml}
              />
              <p className="border-t border-gray-100 bg-ns-brand-light px-3 py-2 text-[11px] text-ns-secondary">
                Pied de page shell : <strong>{previewFooterHint}</strong> ·{" "}
                <strong>www.lamesasecreta.com</strong>
              </p>
            </div>
          ) : null}

          {isCustom ? (
            <div className="min-w-0 max-w-full overflow-hidden">
              <ColdOutreachPanel
                templateKey={activeKey}
                locale={editLocale}
                enabled={enabled}
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

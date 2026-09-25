"use client";

import { useAuthFetch } from "@/hooks/use-auth-fetch";
import type { EmailTemplateKey, TemplateLocale } from "@/lib/types/events";
import { BTN_PRIMARY, BTN_SECONDARY, ERROR_TEXT } from "@/lib/ui/nextstep";
import { useCallback, useEffect, useMemo, useState } from "react";

type IncompleteRecipient = {
  id: string;
  fullName: string;
  email: string;
  percent: number;
  source: string;
  missingFields: string;
};

type Props = {
  templateKey: EmailTemplateKey;
  locale: TemplateLocale;
  subject: string;
  body: string;
  /** When true, show recipient list (opened via Envoyer in the parent). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const SUPPORTED = new Set(["light_signup", "profile_incomplete"]);

export function IncompleteProfilesBlastPanel({
  templateKey,
  locale,
  subject,
  body,
  open,
  onOpenChange,
}: Props) {
  const authFetch = useAuthFetch();
  const [recipients, setRecipients] = useState<IncompleteRecipient[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [batchLimit, setBatchLimit] = useState(80);
  const [scanCapped, setScanCapped] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);

  const supported = SUPPORTED.has(templateKey);

  const load = useCallback(async () => {
    if (!supported) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ templateKey });
      const res = await authFetch(`/api/admin/email-templates/send-incomplete?${qs}`);
      const json = (await res.json()) as {
        ok?: boolean;
        recipients?: IncompleteRecipient[];
        batchLimit?: number;
        scanCapped?: boolean;
        error?: string;
      };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "load_failed");
      const list = json.recipients ?? [];
      const limit = json.batchLimit ?? 80;
      setBatchLimit(limit);
      setScanCapped(Boolean(json.scanCapped));
      setRecipients(list);
      setSelected(new Set(list.slice(0, limit).map((r) => r.id)));
      setLoadedOnce(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [authFetch, supported, templateKey]);

  useEffect(() => {
    if (!open || !supported) return;
    if (!loadedOnce) void load();
  }, [open, supported, loadedOnce, load]);

  useEffect(() => {
    setLoadedOnce(false);
    setRecipients([]);
    setSelected(new Set());
    setMessage(null);
    setError(null);
  }, [templateKey]);

  const selectableIds = useMemo(
    () => recipients.slice(0, batchLimit).map((r) => r.id),
    [recipients, batchLimit],
  );
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const overBatch = selected.size > batchLimit;
  const selectedPreview = useMemo(
    () => recipients.filter((r) => selected.has(r.id)),
    [recipients, selected],
  );

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(selectableIds));
  }

  async function sendNow() {
    if (selected.size === 0) {
      setError("Sélectionne au moins un membre.");
      return;
    }
    if (overBatch) {
      setError(`Max ${batchLimit} destinataires par envoi.`);
      return;
    }
    if (subject.trim().length < 3 || body.trim().length < 10) {
      setError("Objet et corps trop courts — enregistre ou complète le template.");
      return;
    }
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await authFetch("/api/admin/email-templates/send-incomplete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateKey,
          ids: [...selected],
          locale,
          subject: subject.trim(),
          body: body.trim(),
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        sent?: number;
        skipped?: number;
        failed?: number;
        errors?: string[];
        error?: string;
        batchLimit?: number;
      };
      if (!res.ok && json.error === "batch_limit") {
        throw new Error(`Max ${json.batchLimit ?? batchLimit} destinataires.`);
      }
      if (!res.ok && !json.ok && (json.sent ?? 0) === 0) {
        throw new Error(json.error ?? json.errors?.[0] ?? "send_failed");
      }
      const parts = [
        `${json.sent ?? 0} envoyé(s)`,
        (json.skipped ?? 0) > 0 ? `${json.skipped} ignoré(s)` : null,
        (json.failed ?? 0) > 0 ? `${json.failed} échec(s)` : null,
      ].filter(Boolean);
      setMessage(parts.join(" · "));
      if ((json.errors?.length ?? 0) > 0) {
        setError(json.errors!.slice(0, 5).join(" · "));
      }
      setLoadedOnce(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!supported || !open) return null;

  return (
    <div
      id="incomplete-profiles-blast"
      className="mt-4 space-y-3 rounded-2xl border border-ns-alternate bg-ns-brand-light/40 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-ns-hero">
            Destinataires · profils incomplets
          </h3>
          <p className="mt-1 text-xs text-ns-secondary">
            Coche les membres (&lt; 100 %), puis clique <strong>Envoyer</strong>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={BTN_SECONDARY}
            disabled={loading || busy}
            onClick={() => void load()}
          >
            {loading ? "Chargement…" : "Rafraîchir"}
          </button>
          <button
            type="button"
            className={BTN_SECONDARY}
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Fermer
          </button>
        </div>
      </div>

      {error ? <p className={ERROR_TEXT}>{error}</p> : null}
      {message ? <p className="text-sm font-medium text-ns-primary">{message}</p> : null}
      {scanCapped ? (
        <p className="text-xs text-amber-800">
          Scan plafonné — la liste peut être partielle.
        </p>
      ) : null}

      {loading && !loadedOnce ? (
        <p className="text-sm text-ns-secondary">Chargement des profils incomplets…</p>
      ) : recipients.length === 0 ? (
        <p className="text-sm text-ns-secondary">Aucun profil incomplet trouvé.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-ns-tertiary">
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300"
                checked={allSelected}
                onChange={toggleAll}
              />
              Select all ({Math.min(recipients.length, batchLimit)}
              {recipients.length > batchLimit ? ` / ${recipients.length}` : ""})
            </label>
            <span>
              {selected.size} sélectionné(s)
              {overBatch ? ` · max ${batchLimit}` : ""}
            </span>
          </div>

          <div className="max-h-72 overflow-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="sticky top-0 bg-ns-brand-light text-[11px] uppercase tracking-wide text-ns-secondary">
                <tr>
                  <th className="w-10 px-3 py-2" />
                  <th className="px-3 py-2">Membre</th>
                  <th className="px-3 py-2">%</th>
                  <th className="px-3 py-2">Manque</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((r) => {
                  const checked = selected.has(r.id);
                  return (
                    <tr key={r.id} className="border-t border-gray-100">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300"
                          checked={checked}
                          onChange={() => toggleOne(r.id)}
                          aria-label={`Sélectionner ${r.fullName}`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-ns-hero">{r.fullName}</div>
                        <div className="text-xs text-ns-secondary">{r.email}</div>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{r.percent}%</td>
                      <td
                        className="max-w-[220px] truncate px-3 py-2 text-xs text-ns-secondary"
                        title={r.missingFields}
                      >
                        {r.missingFields}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selectedPreview.length > 0 ? (
            <p className="text-[11px] text-ns-secondary">
              Sélection :{" "}
              {selectedPreview
                .slice(0, 5)
                .map((r) => r.email)
                .join(", ")}
              {selectedPreview.length > 5 ? ` (+${selectedPreview.length - 5})` : ""}
            </p>
          ) : null}

          <button
            type="button"
            className={BTN_PRIMARY}
            disabled={busy || loading || selected.size === 0 || overBatch}
            onClick={() => void sendNow()}
          >
            {busy ? "Envoi…" : selected.size > 0 ? `Envoyer (${selected.size})` : "Envoyer"}
          </button>
        </>
      )}
    </div>
  );
}

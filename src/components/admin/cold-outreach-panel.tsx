"use client";

import { useAuthFetch } from "@/hooks/use-auth-fetch";
import type { EmailTemplateKey, TemplateLocale } from "@/lib/types/events";
import { BTN_PRIMARY, BTN_SECONDARY, ERROR_TEXT, INPUT_CLASS, LABEL_CLASS } from "@/lib/ui/nextstep";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Recipient = {
  id: string;
  fullName: string;
  email: string;
  company?: string | null;
  status?: string;
};

type ProspectListOption = {
  id: string;
  name: string;
  contactCount: number;
};

type Props = {
  templateKey: EmailTemplateKey;
  locale: TemplateLocale;
  enabled: boolean;
};

const BATCH_LIMIT = 50;
/** Sentinel: pool « à contacter » (hors listes). */
const LIST_TO_CONTACT = "";

export function ColdOutreachPanel({ templateKey, locale, enabled }: Props) {
  const authFetch = useAuthFetch();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [skippedWaitlist, setSkippedWaitlist] = useState<Recipient[]>([]);
  const [alreadySent, setAlreadySent] = useState<Recipient[]>([]);
  const [lists, setLists] = useState<ProspectListOption[]>([]);
  const [listFilter, setListFilter] = useState(LIST_TO_CONTACT);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [manualEmail, setManualEmail] = useState("");
  const [manualName, setManualName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ templateKey });
      if (listFilter) qs.set("list", listFilter);
      const res = await authFetch(`/api/admin/cold-outreach?${qs.toString()}`);
      const json = (await res.json()) as {
        ok?: boolean;
        recipients?: Recipient[];
        skippedWaitlist?: Recipient[];
        alreadySent?: Recipient[];
        lists?: ProspectListOption[];
        error?: string;
        detail?: string;
        batchLimit?: number;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.detail ? `${json.error}: ${json.detail}` : json.error ?? "load_failed");
      }
      const list = json.recipients ?? [];
      setRecipients(list);
      setSkippedWaitlist(json.skippedWaitlist ?? []);
      setAlreadySent(json.alreadySent ?? []);
      if (json.lists) setLists(json.lists);
      setSelected(new Set(list.slice(0, BATCH_LIMIT).map((r) => r.id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [authFetch, listFilter, templateKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedCount = selected.size;
  const overBatch = selectedCount > BATCH_LIMIT;
  const activeListLabel = listFilter || "À contacter (hors waitlist)";

  const selectedPreview = useMemo(
    () => recipients.filter((r) => selected.has(r.id)).slice(0, BATCH_LIMIT),
    [recipients, selected],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected(new Set(recipients.slice(0, BATCH_LIMIT).map((r) => r.id)));
  }

  async function addManual() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await authFetch("/api/admin/cold-outreach", {
        method: "POST",
        body: JSON.stringify({
          action: "add",
          email: manualEmail.trim(),
          fullName: manualName.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        if (json.error === "already_on_waitlist") {
          throw new Error("Cet email est déjà inscrit sur LA MESA — pas de cold.");
        }
        throw new Error(json.error ?? "add_failed");
      }
      setManualEmail("");
      setManualName("");
      setMessage("Prospect ajouté (statut à contacter).");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function sendSelected() {
    if (selected.size === 0) {
      setError("Aucun destinataire sélectionné.");
      return;
    }
    const ids = [...selected].slice(0, BATCH_LIMIT);
    if (
      !window.confirm(
        `Envoyer « ${templateKey} » (${locale}) à ${ids.length} contact(s) de « ${activeListLabel} » (max ${BATCH_LIMIT}/batch) ?`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await authFetch("/api/admin/cold-outreach", {
        method: "POST",
        body: JSON.stringify({
          action: "send",
          templateKey,
          locale,
          contactIds: ids,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        sent?: number;
        failed?: number;
        skipped?: number;
        error?: string;
      };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "send_failed");
      setMessage(
        `Envoyés : ${json.sent ?? 0} · échecs : ${json.failed ?? 0} · skip : ${json.skipped ?? 0}`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-w-0 max-w-full space-y-4 overflow-hidden rounded-xl border border-dashed border-ns-alternate bg-ns-brand-light/30 p-4">
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-ns-secondary">
          Envoi cold · Prospects LA MESA
        </h3>
        <p className="mt-1 text-xs text-ns-secondary">
          Choisis une <strong>liste Prospects</strong> ou le pool « à contacter ». Après envoi →{" "}
          <strong>contacté</strong> (sauf Gagné / Ne pas contacter). Batch max{" "}
          <strong>{BATCH_LIMIT}</strong>. Gérer les listes →{" "}
          <Link href="/admin/prospects" className="font-semibold text-ns-primary underline">
            Prospects
          </Link>
          .
        </p>
        {!enabled ? (
          <p className="mt-2 text-xs font-semibold text-amber-800">
            Template désactivé — active-le avant d’envoyer.
          </p>
        ) : null}
      </div>

      {error ? <p className={ERROR_TEXT}>{error}</p> : null}
      {message ? <p className="text-sm font-medium text-ns-primary">{message}</p> : null}

      <div>
        <label className={LABEL_CLASS} htmlFor="cold-list-filter">
          Liste Prospects
        </label>
        <select
          id="cold-list-filter"
          className={INPUT_CLASS}
          value={listFilter}
          disabled={busy || loading}
          onChange={(e) => setListFilter(e.target.value)}
        >
          <option value={LIST_TO_CONTACT}>À contacter (défaut · hors waitlist)</option>
          {lists.map((l) => (
            <option key={l.id} value={l.name}>
              {l.name} ({l.contactCount})
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-ns-secondary">
          {listFilter
            ? `Liste « ${listFilter} » — tous statuts, inscrits inclus.`
            : "Pool cold classique : statut « à contacter », emails déjà inscrits exclus."}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <div>
          <label className={LABEL_CLASS} htmlFor="cold-manual-email">
            Ajouter un email
          </label>
          <input
            id="cold-manual-email"
            className={INPUT_CLASS}
            type="email"
            value={manualEmail}
            onChange={(e) => setManualEmail(e.target.value)}
            placeholder="nombre@empresa.com"
          />
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="cold-manual-name">
            Nom (optionnel)
          </label>
          <input
            id="cold-manual-name"
            className={INPUT_CLASS}
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            placeholder="Nombre completo"
          />
        </div>
        <div className="flex items-end">
          <button
            type="button"
            className={BTN_SECONDARY}
            disabled={busy || !manualEmail.includes("@")}
            onClick={() => void addManual()}
          >
            Ajouter
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={BTN_SECONDARY} disabled={busy || loading} onClick={() => void load()}>
          Rafraîchir
        </button>
        <button
          type="button"
          className={BTN_SECONDARY}
          disabled={busy || loading || recipients.length === 0}
          onClick={selectAllVisible}
        >
          Tout sélectionner
        </button>
        <button
          type="button"
          className={BTN_SECONDARY}
          disabled={busy || selectedCount === 0}
          onClick={() => setSelected(new Set())}
        >
          Effacer la sélection
        </button>
        <button
          type="button"
          className={BTN_PRIMARY}
          disabled={busy || loading || !enabled || selectedCount === 0}
          onClick={() => void sendSelected()}
          title={!enabled ? "Active d’abord ce template avec le bouton « Activer » ci-dessous." : undefined}
        >
          {busy
            ? "Envoi…"
            : !enabled
              ? "Active le template pour envoyer"
              : `Envoyer à ${Math.min(selectedCount, BATCH_LIMIT)} contact(s)`}
        </button>
        {overBatch ? (
          <p className="self-center text-[11px] text-amber-800">
            {selectedCount} sélectionnés — seuls les {BATCH_LIMIT} premiers seront envoyés.
          </p>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-ns-secondary">Chargement prospects…</p>
      ) : recipients.length === 0 ? (
        <p className="text-sm text-ns-secondary">
          {listFilter
            ? `Aucun contact dans « ${listFilter} ».`
            : "Aucun prospect « à contacter »."}{" "}
          Gère les listes sur{" "}
          <Link href="/admin/prospects" className="font-semibold underline">
            Prospects
          </Link>
          .
        </p>
      ) : (
        <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
          {recipients.map((r) => (
            <li key={r.id}>
              <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-white/70">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.has(r.id)}
                  onChange={() => toggle(r.id)}
                />
                <span className="min-w-0">
                  <span className="block font-semibold text-ns-tertiary">{r.fullName}</span>
                  <span className="block truncate text-xs text-ns-secondary">
                    {r.email}
                    {r.company ? ` · ${r.company}` : ""}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {selectedPreview.length > 0 && overBatch ? (
        <p className="text-[11px] text-ns-secondary">
          Ce batch : {selectedPreview.map((r) => r.email).slice(0, 3).join(", ")}
          {selectedPreview.length > 3 ? "…" : ""}
        </p>
      ) : null}

      {skippedWaitlist.length > 0 ? (
        <p className="text-[11px] text-ns-secondary">
          {skippedWaitlist.length} déjà sur la waitlist (exclus) :{" "}
          {skippedWaitlist
            .slice(0, 5)
            .map((r) => r.email)
            .join(", ")}
          {skippedWaitlist.length > 5 ? "…" : ""}
        </p>
      ) : null}

      {alreadySent.length > 0 ? (
        <p className="text-[11px] font-medium text-ns-secondary">
          {alreadySent.length} contact(s) déjà destinataire(s) de ce template — exclus
          automatiquement de cette sélection.
        </p>
      ) : null}
    </div>
  );
}

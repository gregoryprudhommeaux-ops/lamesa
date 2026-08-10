"use client";

import { useAuthFetch } from "@/hooks/use-auth-fetch";
import type { Prospect, ProspectStatus } from "@/lib/types/prospects";
import { PROSPECT_STATUSES } from "@/lib/types/prospects";
import { BTN_PRIMARY, BTN_SECONDARY, ERROR_TEXT, INPUT_CLASS, LABEL_CLASS } from "@/lib/ui/nextstep";
import { useCallback, useEffect, useMemo, useState } from "react";

const STATUS_LABEL: Record<ProspectStatus, string> = {
  to_contact: "À contacter",
  contacted: "Contacté",
  nurture: "Nurture",
  won: "Gagné / inscrit",
  do_not_contact: "Ne pas contacter",
};

const emptyDraft = {
  email: "",
  fullName: "",
  company: "",
  position: "",
  sector: "",
  city: "",
  linkedin: "",
  phone: "",
  notes: "",
  status: "to_contact" as ProspectStatus,
};

export function AdminProspectsPanel() {
  const authFetch = useAuthFetch();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | "all">("to_contact");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sheetUrl, setSheetUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [mergeOtherId, setMergeOtherId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs =
        statusFilter === "all" ? "" : `?status=${encodeURIComponent(statusFilter)}`;
      const res = await authFetch(`/api/admin/prospects${qs}`);
      const json = (await res.json()) as {
        ok?: boolean;
        prospects?: Prospect[];
        error?: string;
      };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "load_failed");
      setProspects(json.prospects ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [authFetch, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return prospects;
    return prospects.filter((p) =>
      [p.fullName, p.email, p.company, p.position, p.sector, p.city]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [prospects, query]);

  const selected = selectedId ? prospects.find((p) => p.id === selectedId) ?? null : null;

  useEffect(() => {
    if (!selected) {
      setDraft(emptyDraft);
      return;
    }
    setDraft({
      email: selected.email,
      fullName: selected.fullName,
      company: selected.company,
      position: selected.position,
      sector: selected.sector,
      city: selected.city,
      linkedin: selected.linkedin,
      phone: selected.phone,
      notes: selected.notes,
      status: selected.status,
    });
    setMergeOtherId("");
  }, [selected]);

  async function importSheetOrPaste() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await authFetch("/api/admin/prospects", {
        method: "POST",
        body: JSON.stringify({
          action: "import",
          sheetUrl: sheetUrl.trim() || undefined,
          text: pasteText.trim() || undefined,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        parsed?: number;
        created?: number;
        merged?: number;
        failed?: number;
        error?: string;
        detail?: string;
        limit?: number;
        count?: number;
      };
      if (!res.ok || !json.ok) {
        if (json.error === "sheet_not_public") {
          throw new Error(json.detail ?? "Sheet non public — partage en lecteur ou colle le CSV.");
        }
        if (json.error === "too_many") {
          throw new Error(`Trop de lignes (${json.count}). Limite ${json.limit}.`);
        }
        if (json.error === "no_emails_parsed") {
          throw new Error("Aucun email trouvé (email obligatoire).");
        }
        throw new Error(json.detail ? `${json.error}: ${json.detail}` : json.error ?? "import_failed");
      }
      setPasteText("");
      setMessage(
        `Import — lus ${json.parsed} · créés ${json.created} · fusionnés ${json.merged} · échecs ${json.failed}`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function createManual() {
    if (!draft.email.includes("@")) {
      setError("Email obligatoire.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await authFetch("/api/admin/prospects", {
        method: "POST",
        body: JSON.stringify({ ...draft, source: "manual" }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        prospect?: Prospect;
        action?: string;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.prospect) {
        throw new Error(json.error ?? "create_failed");
      }
      setMessage(json.action === "merged" ? "Email existant — fiche fusionnée." : "Prospect créé.");
      setSelectedId(json.prospect.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveSelected() {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await authFetch(`/api/admin/prospects/${encodeURIComponent(selectedId)}`, {
        method: "PATCH",
        body: JSON.stringify(draft),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "save_failed");
      setMessage("Fiche enregistrée.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelected() {
    if (!selectedId) return;
    if (!window.confirm("Supprimer ce prospect (soft delete) ?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch(`/api/admin/prospects/${encodeURIComponent(selectedId)}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "delete_failed");
      setSelectedId(null);
      setMessage("Prospect supprimé.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function mergeIntoSelected() {
    if (!selectedId || !mergeOtherId.trim()) return;
    if (
      !window.confirm(
        "Fusionner l’autre fiche dans celle-ci ? L’autre sera soft-deleted.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch("/api/admin/prospects/merge", {
        method: "POST",
        body: JSON.stringify({ keepId: selectedId, dropId: mergeOtherId.trim() }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "merge_failed");
      setMessage("Fusion OK.");
      setMergeOtherId("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-ns-secondary">
        CRM outreach interne (invisible aux membres). Email obligatoire. Dedup automatique à
        l’import. Envoi cold depuis Templates → Cold Mail (batch 50).
      </p>

      {error ? <p className={ERROR_TEXT}>{error}</p> : null}
      {message ? <p className="text-sm font-medium text-ns-primary">{message}</p> : null}

      <section className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ns-secondary">
          Import Sheet / CSV
        </h2>
        <div>
          <label className={LABEL_CLASS} htmlFor="prospect-sheet-url">
            Lien Google Sheet (public lecteur)
          </label>
          <input
            id="prospect-sheet-url"
            className={INPUT_CLASS}
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/…/edit?gid=0"
          />
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="prospect-paste">
            Ou coller CSV
          </label>
          <textarea
            id="prospect-paste"
            className={`${INPUT_CLASS} min-h-[100px] font-mono text-xs`}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={"Nom,Email,Société,Poste,Secteur\nAda,ada@ex.com,Acme,CEO,Tech"}
          />
        </div>
        <button
          type="button"
          className={BTN_PRIMARY}
          disabled={busy || (!sheetUrl.trim() && !pasteText.trim())}
          onClick={() => void importSheetOrPaste()}
        >
          Importer (sans email = ignoré)
        </button>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[140px] flex-1">
              <label className={LABEL_CLASS} htmlFor="prospect-search">
                Recherche
              </label>
              <input
                id="prospect-search"
                className={INPUT_CLASS}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nom, email, société…"
              />
            </div>
            <div>
              <label className={LABEL_CLASS} htmlFor="prospect-status-filter">
                Statut
              </label>
              <select
                id="prospect-status-filter"
                className={INPUT_CLASS}
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as ProspectStatus | "all")
                }
              >
                <option value="all">Tous</option>
                {PROSPECT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className={BTN_SECONDARY} disabled={loading || busy} onClick={() => void load()}>
              Rafraîchir
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-ns-secondary">Chargement…</p>
          ) : (
            <ul className="max-h-[28rem] divide-y divide-gray-100 overflow-y-auto text-sm">
              {filtered.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={`w-full px-2 py-2 text-left hover:bg-ns-brand-light/60 ${
                      selectedId === p.id ? "bg-ns-primary/15" : ""
                    }`}
                  >
                    <span className="block font-semibold text-ns-tertiary">
                      {p.fullName || p.email}
                    </span>
                    <span className="block truncate text-xs text-ns-secondary">
                      {p.email}
                      {p.company ? ` · ${p.company}` : ""}
                      {p.position ? ` · ${p.position}` : ""}
                    </span>
                    <span className="mt-0.5 inline-block text-[10px] font-semibold uppercase tracking-wide text-ns-secondary">
                      {STATUS_LABEL[p.status]}
                    </span>
                  </button>
                </li>
              ))}
              {filtered.length === 0 ? (
                <li className="px-2 py-4 text-ns-secondary">Aucun prospect.</li>
              ) : null}
            </ul>
          )}
          <p className="text-[11px] text-ns-secondary">{filtered.length} affiché(s)</p>
        </section>

        <section className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ns-secondary">
            {selected ? "Fiche prospect" : "Nouveau prospect"}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["email", "Email *"],
                ["fullName", "Nom"],
                ["company", "Société"],
                ["position", "Poste"],
                ["sector", "Secteur"],
                ["city", "Ville"],
                ["linkedin", "LinkedIn"],
                ["phone", "Tél."],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className={key === "email" || key === "linkedin" ? "sm:col-span-2" : ""}>
                <label className={LABEL_CLASS} htmlFor={`pf-${key}`}>
                  {label}
                </label>
                <input
                  id={`pf-${key}`}
                  className={INPUT_CLASS}
                  value={draft[key]}
                  onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                />
              </div>
            ))}
            <div className="sm:col-span-2">
              <label className={LABEL_CLASS} htmlFor="pf-status">
                Statut
              </label>
              <select
                id="pf-status"
                className={INPUT_CLASS}
                value={draft.status}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, status: e.target.value as ProspectStatus }))
                }
              >
                {PROSPECT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={LABEL_CLASS} htmlFor="pf-notes">
                Notes
              </label>
              <textarea
                id="pf-notes"
                className={`${INPUT_CLASS} min-h-[80px]`}
                value={draft.notes}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {selected ? (
              <>
                <button
                  type="button"
                  className={BTN_PRIMARY}
                  disabled={busy}
                  onClick={() => void saveSelected()}
                >
                  Enregistrer
                </button>
                <button
                  type="button"
                  className={BTN_SECONDARY}
                  disabled={busy}
                  onClick={() => {
                    setSelectedId(null);
                    setDraft(emptyDraft);
                  }}
                >
                  Nouvelle fiche
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                  disabled={busy}
                  onClick={() => void deleteSelected()}
                >
                  Supprimer
                </button>
              </>
            ) : (
              <button
                type="button"
                className={BTN_PRIMARY}
                disabled={busy || !draft.email.includes("@")}
                onClick={() => void createManual()}
              >
                Créer
              </button>
            )}
          </div>

          {selected ? (
            <div className="space-y-2 border-t border-gray-100 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ns-secondary">
                Fusionner un doublon
              </p>
              <p className="text-[11px] text-ns-secondary">
                Colle l’ID de l’autre fiche (soft-delete). Celle-ci garde les champs remplis.
              </p>
              <div className="flex flex-wrap gap-2">
                <input
                  className={`${INPUT_CLASS} min-w-[12rem] flex-1`}
                  value={mergeOtherId}
                  onChange={(e) => setMergeOtherId(e.target.value)}
                  placeholder="ID prospect à fusionner"
                />
                <button
                  type="button"
                  className={BTN_SECONDARY}
                  disabled={busy || !mergeOtherId.trim()}
                  onClick={() => void mergeIntoSelected()}
                >
                  Fusionner ici
                </button>
              </div>
              <p className="text-[10px] text-ns-secondary/80">ID courant : {selected.id}</p>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

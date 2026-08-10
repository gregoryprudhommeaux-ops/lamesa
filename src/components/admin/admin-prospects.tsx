"use client";

import { useAuthFetch } from "@/hooks/use-auth-fetch";
import type { Prospect, ProspectStatus } from "@/lib/types/prospects";
import { PROSPECT_STATUSES } from "@/lib/types/prospects";
import { BTN_PRIMARY, BTN_SECONDARY, ERROR_TEXT, INPUT_CLASS, LABEL_CLASS } from "@/lib/ui/nextstep";
import { Download, ExternalLink, Link2, Plus, Upload, X } from "lucide-react";
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

type Draft = typeof emptyDraft;

export function AdminProspectsPanel() {
  const authFetch = useAuthFetch();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | "all">("to_contact");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");

  const [contactOpen, setContactOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
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

  function openImport() {
    setError(null);
    setSheetUrl("");
    setImportOpen(true);
  }

  function openCreate() {
    setEditingId(null);
    setDraft(emptyDraft);
    setMergeOtherId("");
    setError(null);
    setContactOpen(true);
  }

  function openEdit(p: Prospect) {
    setEditingId(p.id);
    setDraft({
      email: p.email,
      fullName: p.fullName,
      company: p.company,
      position: p.position,
      sector: p.sector,
      city: p.city,
      linkedin: p.linkedin,
      phone: p.phone,
      notes: p.notes,
      status: p.status,
    });
    setMergeOtherId("");
    setError(null);
    setContactOpen(true);
  }

  function closeContact() {
    setContactOpen(false);
    setEditingId(null);
    setDraft(emptyDraft);
    setMergeOtherId("");
  }

  async function importSheet() {
    if (!sheetUrl.trim()) {
      setError("Colle l’URL du Google Sheet.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await authFetch("/api/admin/prospects", {
        method: "POST",
        body: JSON.stringify({
          action: "import",
          sheetUrl: sheetUrl.trim(),
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
          throw new Error(json.detail ?? "Sheet non public — partage en lecteur.");
        }
        if (json.error === "too_many") {
          throw new Error(`Trop de lignes (${json.count}). Limite ${json.limit}.`);
        }
        if (json.error === "no_emails_parsed") {
          throw new Error("Aucun email trouvé (email obligatoire).");
        }
        throw new Error(json.detail ? `${json.error}: ${json.detail}` : json.error ?? "import_failed");
      }
      setImportOpen(false);
      setSheetUrl("");
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

  async function saveContact() {
    if (!draft.email.includes("@")) {
      setError("Email obligatoire.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (editingId) {
        const res = await authFetch(`/api/admin/prospects/${encodeURIComponent(editingId)}`, {
          method: "PATCH",
          body: JSON.stringify(draft),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !json.ok) throw new Error(json.error ?? "save_failed");
        setMessage("Fiche enregistrée.");
      } else {
        const res = await authFetch("/api/admin/prospects", {
          method: "POST",
          body: JSON.stringify({ ...draft, source: "manual" }),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          action?: string;
          error?: string;
        };
        if (!res.ok || !json.ok) throw new Error(json.error ?? "create_failed");
        setMessage(json.action === "merged" ? "Email existant — fiche fusionnée." : "Contact créé.");
      }
      closeContact();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteEditing() {
    if (!editingId) return;
    if (!window.confirm("Supprimer ce prospect (soft delete) ?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch(`/api/admin/prospects/${encodeURIComponent(editingId)}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "delete_failed");
      setMessage("Prospect supprimé.");
      closeContact();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function mergeIntoEditing() {
    if (!editingId || !mergeOtherId.trim()) return;
    if (!window.confirm("Fusionner l’autre fiche dans celle-ci ? L’autre sera soft-deleted.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch("/api/admin/prospects/merge", {
        method: "POST",
        body: JSON.stringify({ keepId: editingId, dropId: mergeOtherId.trim() }),
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
    <div className="space-y-5">
      <p className="text-sm text-ns-secondary">
        CRM outreach interne (invisible aux membres). Email obligatoire. Dedup à l’import. Envoi
        cold : Templates → Cold Mail (batch 50).
      </p>

      {error && !importOpen && !contactOpen ? <p className={ERROR_TEXT}>{error}</p> : null}
      {message ? <p className="text-sm font-medium text-ns-primary">{message}</p> : null}

      {/* Toolbar — 2 boutons comme Perso */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={openImport}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-ns-tertiary shadow-sm transition hover:bg-ns-brand-light"
        >
          <Link2 className="h-4 w-4 text-ns-secondary" aria-hidden />
          Lien Feuille
        </button>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-ns-tertiary shadow-sm transition hover:bg-ns-brand-light"
        >
          <Plus className="h-4 w-4 text-ns-secondary" aria-hidden />
          Ajouter un contact
        </button>
      </div>

      <section className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[180px] flex-1">
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
              onChange={(e) => setStatusFilter(e.target.value as ProspectStatus | "all")}
            >
              <option value="all">Tous</option>
              {PROSPECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className={BTN_SECONDARY}
            disabled={loading || busy}
            onClick={() => void load()}
          >
            Rafraîchir
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-ns-secondary">Chargement…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-ns-secondary">
                  <th className="px-2 py-2">Nom</th>
                  <th className="px-2 py-2">Email</th>
                  <th className="px-2 py-2">Société / poste</th>
                  <th className="px-2 py-2">Secteur</th>
                  <th className="px-2 py-2">Statut</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="cursor-pointer border-b border-gray-50 hover:bg-ns-brand-light/60"
                    onClick={() => openEdit(p)}
                  >
                    <td className="px-2 py-2.5 font-semibold text-ns-tertiary">
                      {p.fullName || "—"}
                    </td>
                    <td className="px-2 py-2.5 text-ns-secondary">{p.email}</td>
                    <td className="px-2 py-2.5 text-ns-secondary">
                      {[p.company, p.position].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-2 py-2.5 text-ns-secondary">{p.sector || "—"}</td>
                    <td className="px-2 py-2.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-ns-secondary">
                        {STATUS_LABEL[p.status]}
                      </span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-2 py-8 text-center text-ns-secondary">
                      Aucun prospect. Utilise Lien Feuille ou Ajouter un contact.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-ns-secondary">{filtered.length} affiché(s) · clic pour éditer</p>
      </section>

      {/* Modal Import — Lien Feuille */}
      {importOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setImportOpen(false);
          }}
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2
                id="import-modal-title"
                className="flex items-center gap-2 text-base font-bold text-ns-tertiary"
              >
                <Upload className="h-5 w-5 text-ns-secondary" aria-hidden />
                Importer des contacts
              </h2>
              <button
                type="button"
                className="rounded-lg p-1.5 text-ns-secondary hover:bg-gray-100"
                onClick={() => setImportOpen(false)}
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 inline-flex rounded-xl bg-gray-100 p-1 text-sm font-semibold">
              <span className="rounded-lg bg-white px-3 py-1.5 text-ns-tertiary shadow-sm">
                Lien feuille
              </span>
            </div>

            <div className="space-y-3 rounded-2xl border border-gray-100 bg-ns-brand-light/40 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                <ExternalLink className="h-6 w-6" aria-hidden />
              </div>
              <h3 className="text-sm font-bold text-ns-tertiary">Google Sheet via lien copié</h3>
              <p className="text-xs leading-relaxed text-ns-secondary">
                Colle l’URL d’un Sheet partagé en lecteur. Colonnes reconnues : email, nom, société,
                poste, secteur… Sans email = ligne ignorée. Dedup automatique sur l’e-mail.
              </p>
              <input
                className={INPUT_CLASS}
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder="Collez l’URL du Google Sheet…"
                autoFocus
              />
              {error && importOpen ? <p className={ERROR_TEXT}>{error}</p> : null}
              <button
                type="button"
                className={`${BTN_PRIMARY} inline-flex w-full items-center justify-center gap-2`}
                disabled={busy || !sheetUrl.trim()}
                onClick={() => void importSheet()}
              >
                <Download className="h-4 w-4" aria-hidden />
                {busy ? "Import…" : "Extraire les données"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal contact — Ajouter / éditer */}
      {contactOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="contact-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeContact();
          }}
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2
                id="contact-modal-title"
                className="flex items-center gap-2 text-base font-bold text-ns-tertiary"
              >
                <Plus className="h-5 w-5" aria-hidden />
                {editingId ? "Modifier le contact" : "Nouveau contact"}
              </h2>
              <button
                type="button"
                className="rounded-lg p-1.5 text-ns-secondary hover:bg-gray-100"
                onClick={closeContact}
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && contactOpen ? <p className={`${ERROR_TEXT} mb-3`}>{error}</p> : null}

            <div className="space-y-3">
              <div>
                <label className={LABEL_CLASS} htmlFor="pf-fullName">
                  Nom complet
                </label>
                <input
                  id="pf-fullName"
                  className={INPUT_CLASS}
                  value={draft.fullName}
                  onChange={(e) => setDraft((d) => ({ ...d, fullName: e.target.value }))}
                  autoFocus={!editingId}
                />
              </div>
              <div>
                <label className={LABEL_CLASS} htmlFor="pf-email">
                  Email *
                </label>
                <input
                  id="pf-email"
                  className={INPUT_CLASS}
                  type="email"
                  value={draft.email}
                  onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={LABEL_CLASS} htmlFor="pf-company">
                    Société
                  </label>
                  <input
                    id="pf-company"
                    className={INPUT_CLASS}
                    value={draft.company}
                    onChange={(e) => setDraft((d) => ({ ...d, company: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS} htmlFor="pf-position">
                    Poste
                  </label>
                  <input
                    id="pf-position"
                    className={INPUT_CLASS}
                    value={draft.position}
                    onChange={(e) => setDraft((d) => ({ ...d, position: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={LABEL_CLASS} htmlFor="pf-city">
                    Ville
                  </label>
                  <input
                    id="pf-city"
                    className={INPUT_CLASS}
                    value={draft.city}
                    onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS} htmlFor="pf-sector">
                    Secteur
                  </label>
                  <input
                    id="pf-sector"
                    className={INPUT_CLASS}
                    value={draft.sector}
                    onChange={(e) => setDraft((d) => ({ ...d, sector: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className={LABEL_CLASS} htmlFor="pf-linkedin">
                  Lien LinkedIn
                </label>
                <input
                  id="pf-linkedin"
                  className={INPUT_CLASS}
                  value={draft.linkedin}
                  onChange={(e) => setDraft((d) => ({ ...d, linkedin: e.target.value }))}
                  placeholder="https://linkedin.com/in/…"
                />
              </div>
              <div>
                <label className={LABEL_CLASS} htmlFor="pf-phone">
                  Tél.
                </label>
                <input
                  id="pf-phone"
                  className={INPUT_CLASS}
                  value={draft.phone}
                  onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                />
              </div>
              <div>
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
              <div>
                <label className={LABEL_CLASS} htmlFor="pf-notes">
                  Notes
                </label>
                <textarea
                  id="pf-notes"
                  className={`${INPUT_CLASS} min-h-[72px]`}
                  value={draft.notes}
                  onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                />
              </div>
            </div>

            <button
              type="button"
              className={`${BTN_PRIMARY} mt-5 inline-flex w-full items-center justify-center gap-2`}
              disabled={busy || !draft.email.includes("@")}
              onClick={() => void saveContact()}
            >
              {busy ? "…" : editingId ? "Enregistrer" : "Créer le contact"}
            </button>

            {editingId ? (
              <div className="mt-4 space-y-2 border-t border-gray-100 pt-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                    disabled={busy}
                    onClick={() => void deleteEditing()}
                  >
                    Supprimer
                  </button>
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ns-secondary">
                  Fusionner un doublon
                </p>
                <div className="flex flex-wrap gap-2">
                  <input
                    className={`${INPUT_CLASS} min-w-[10rem] flex-1`}
                    value={mergeOtherId}
                    onChange={(e) => setMergeOtherId(e.target.value)}
                    placeholder="ID à fusionner"
                  />
                  <button
                    type="button"
                    className={BTN_SECONDARY}
                    disabled={busy || !mergeOtherId.trim()}
                    onClick={() => void mergeIntoEditing()}
                  >
                    Fusionner
                  </button>
                </div>
                <p className="text-[10px] text-ns-secondary/80">ID : {editingId}</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

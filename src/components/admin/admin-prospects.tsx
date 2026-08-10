"use client";

import { useAuthFetch } from "@/hooks/use-auth-fetch";
import type { ProspectListWithCount } from "@/lib/types/prospect-lists";
import type { Prospect, ProspectStatus } from "@/lib/types/prospects";
import { PROSPECT_STATUSES } from "@/lib/types/prospects";
import { BTN_PRIMARY, BTN_SECONDARY, ERROR_TEXT, INPUT_CLASS, LABEL_CLASS } from "@/lib/ui/nextstep";
import {
  CheckSquare,
  Download,
  ExternalLink,
  Link2,
  ListMusic,
  ListPlus,
  MoreVertical,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const STATUS_LABEL: Record<ProspectStatus, string> = {
  to_contact: "À contacter",
  contacted: "Contacté",
  nurture: "Nurture",
  won: "Gagné / inscrit",
  do_not_contact: "Ne pas contacter",
};

const CRITERIA: Array<{ status: ProspectStatus; label: string }> = [
  { status: "to_contact", label: "À CONTACTER" },
  { status: "contacted", label: "CONTACTÉ" },
  { status: "nurture", label: "NURTURE" },
];

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
  tags: "",
  lists: "",
  status: "to_contact" as ProspectStatus,
  seen: false,
};

type Draft = typeof emptyDraft;

function parseCsvField(raw: string): string[] {
  return [...new Set(raw.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean))];
}

function formatShortDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function AdminProspectsPanel() {
  const authFetch = useAuthFetch();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [lists, setLists] = useState<ProspectListWithCount[]>([]);
  const [activeListName, setActiveListName] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [addToListOpen, setAddToListOpen] = useState(false);
  const [addToListPicked, setAddToListPicked] = useState<Set<string>>(new Set());
  const [listFormOpen, setListFormOpen] = useState(false);
  const [listFormMode, setListFormMode] = useState<"create" | "rename">("create");
  const [listFormName, setListFormName] = useState("");
  const [listFormId, setListFormId] = useState<string | null>(null);
  const [criterionOpen, setCriterionOpen] = useState(false);
  const [criterionStatus, setCriterionStatus] = useState<ProspectStatus>("contacted");

  const [importOpen, setImportOpen] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");

  const [contactOpen, setContactOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [mergeOtherId, setMergeOtherId] = useState("");

  const loadLists = useCallback(async () => {
    const res = await authFetch("/api/admin/prospects/lists");
    const json = (await res.json()) as {
      ok?: boolean;
      lists?: ProspectListWithCount[];
      error?: string;
    };
    if (!res.ok || !json.ok) throw new Error(json.error ?? "lists_failed");
    setLists(json.lists ?? []);
  }, [authFetch]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const qs = params.toString() ? `?${params}` : "";
      const [prosRes] = await Promise.all([
        authFetch(`/api/admin/prospects${qs}`),
        loadLists(),
      ]);
      const json = (await prosRes.json()) as {
        ok?: boolean;
        prospects?: Prospect[];
        error?: string;
      };
      if (!prosRes.ok || !json.ok) throw new Error(json.error ?? "load_failed");
      const rows = (json.prospects ?? []).map((p) => ({
        ...p,
        tags: p.tags ?? [],
        lists: p.lists ?? [],
        seen: Boolean(p.seen),
      }));
      setProspects(rows);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [authFetch, loadLists, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const listQ = activeListName?.trim().toLowerCase() ?? "";
    return prospects.filter((p) => {
      if (listQ && !p.lists.some((l) => l.toLowerCase() === listQ)) return false;
      if (!q) return true;
      return [
        p.fullName,
        p.email,
        p.company,
        p.position,
        p.sector,
        p.city,
        ...(p.tags ?? []),
        ...(p.lists ?? []),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [prospects, query, activeListName]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const someSelected = selected.size > 0;

  const activeList = useMemo(
    () =>
      activeListName
        ? lists.find((l) => l.name.toLowerCase() === activeListName.toLowerCase()) ?? null
        : null,
    [lists, activeListName],
  );

  function toggleAllFiltered() {
    if (allFilteredSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(filtered.map((p) => p.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
      tags: (p.tags ?? []).join(", "),
      lists: (p.lists ?? []).join(", "),
      status: p.status,
      seen: Boolean(p.seen),
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
        body: JSON.stringify({ action: "import", sheetUrl: sheetUrl.trim() }),
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
    const payload = {
      email: draft.email,
      fullName: draft.fullName,
      company: draft.company,
      position: draft.position,
      sector: draft.sector,
      city: draft.city,
      linkedin: draft.linkedin,
      phone: draft.phone,
      notes: draft.notes,
      tags: parseCsvField(draft.tags),
      lists: parseCsvField(draft.lists),
      status: draft.status,
      seen: draft.seen,
    };
    try {
      if (editingId) {
        const res = await authFetch(`/api/admin/prospects/${encodeURIComponent(editingId)}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !json.ok) throw new Error(json.error ?? "save_failed");
        setMessage("Fiche enregistrée.");
      } else {
        const res = await authFetch("/api/admin/prospects", {
          method: "POST",
          body: JSON.stringify({ ...payload, source: "manual" }),
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

  async function patchProspect(id: string, patch: Partial<Prospect>) {
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch(`/api/admin/prospects/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      const json = (await res.json()) as { ok?: boolean; prospect?: Prospect; error?: string };
      if (!res.ok || !json.ok || !json.prospect) throw new Error(json.error ?? "patch_failed");
      setProspects((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                ...json.prospect!,
                lists: json.prospect!.lists ?? [],
                tags: json.prospect!.tags ?? [],
              }
            : p,
        ),
      );
      void loadLists();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function runBulk(body: Record<string, unknown>) {
    const ids = [...selected];
    if (ids.length === 0) {
      setError("Sélectionne au moins un contact.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await authFetch("/api/admin/prospects", {
        method: "POST",
        body: JSON.stringify({ action: "bulk", ids, ...body }),
      });
      const json = (await res.json()) as { ok?: boolean; updated?: number; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "bulk_failed");
      setMessage(`${json.updated} contact(s) mis à jour.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitListForm() {
    const name = listFormName.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      if (listFormMode === "create") {
        const res = await authFetch("/api/admin/prospects/lists", {
          method: "POST",
          body: JSON.stringify({ name }),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          list?: { name: string };
          error?: string;
        };
        if (!res.ok || !json.ok || !json.list) throw new Error(json.error ?? "create_list_failed");
        const createdName = json.list.name;
        const selectedCount = selected.size;
        setListFormOpen(false);
        setListFormName("");
        setActiveListName(createdName);
        if (selectedCount > 0) {
          setBusy(false);
          await runBulk({ addLists: [createdName] });
          setMessage(`Liste « ${createdName} » créée · ${selectedCount} contact(s) ajouté(s).`);
        } else {
          setMessage(`Liste « ${createdName} » créée.`);
          await loadLists();
        }
      } else if (listFormId) {
        const res = await authFetch("/api/admin/prospects/lists", {
          method: "PATCH",
          body: JSON.stringify({ id: listFormId, name }),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          list?: { name: string };
          error?: string;
        };
        if (!res.ok || !json.ok || !json.list) throw new Error(json.error ?? "rename_failed");
        setMessage(`Liste renommée « ${json.list.name} ».`);
        setListFormOpen(false);
        setActiveListName(json.list.name);
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirmAddToLists() {
    const names = [...addToListPicked];
    if (names.length === 0) return;
    setAddToListOpen(false);
    await runBulk({ addLists: names });
    setAddToListPicked(new Set());
  }

  async function deleteActiveList() {
    if (!activeList) return;
    if (
      !window.confirm(
        `Supprimer la liste « ${activeList.name} » et retirer les contacts de cette liste ?`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch("/api/admin/prospects/lists", {
        method: "DELETE",
        body: JSON.stringify({ id: activeList.id, removeFromContacts: true }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "delete_list_failed");
      setMessage(`Liste « ${activeList.name} » supprimée.`);
      setActiveListName(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`space-y-4 ${someSelected ? "pb-36" : ""}`}>
      <p className="text-sm text-ns-secondary">
        CRM outreach interne style Database Perso : listes à gauche, sélection → bandeau jaune
        (listes / critères / suppressions). Cold Mail = statut « À contacter », batch 50.
      </p>

      {error && !importOpen && !contactOpen && !listFormOpen && !addToListOpen ? (
        <p className={ERROR_TEXT}>{error}</p>
      ) : null}
      {message ? <p className="text-sm font-medium text-ns-primary">{message}</p> : null}

      <div className="flex min-h-[70vh] flex-col gap-4 lg:flex-row">
        {/* Sidebar listes */}
        <aside className="flex w-full shrink-0 flex-col rounded-2xl border border-gray-100 bg-white shadow-sm lg:w-64">
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-ns-secondary">
              Vos listes
            </p>
            <button
              type="button"
              className="rounded-lg p-1.5 text-ns-secondary hover:bg-ns-brand-light"
              aria-label="Nouvelle liste"
              title="Nouvelle liste"
              onClick={() => {
                setListFormMode("create");
                setListFormId(null);
                setListFormName("");
                setListFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[50vh] flex-1 overflow-y-auto p-2 lg:max-h-none">
            <button
              type="button"
              onClick={() => setActiveListName(null)}
              className={`mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                !activeListName
                  ? "bg-ns-primary/15 font-semibold text-ns-tertiary"
                  : "text-ns-secondary hover:bg-gray-50"
              }`}
            >
              <ListMusic className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">Tous les contacts</span>
              <span className="text-[11px] text-ns-secondary/80">{prospects.length}</span>
            </button>
            {lists.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setActiveListName(l.name)}
                className={`mb-0.5 flex w-full flex-col rounded-xl px-3 py-2 text-left transition ${
                  activeListName?.toLowerCase() === l.name.toLowerCase()
                    ? "bg-ns-primary/15 text-ns-tertiary"
                    : "text-ns-secondary hover:bg-gray-50"
                }`}
              >
                <span className="truncate text-sm font-semibold">{l.name}</span>
                <span className="text-[10px] text-ns-secondary/80">
                  {l.contactCount} contact{l.contactCount > 1 ? "s" : ""}
                  {l.updatedAt ? ` · ${formatShortDate(l.updatedAt)}` : ""}
                </span>
              </button>
            ))}
            {lists.length === 0 ? (
              <p className="px-2 py-4 text-xs text-ns-secondary">
                Aucune liste. Crée-en une avec + ou via le bandeau jaune.
              </p>
            ) : null}
          </div>
        </aside>

        {/* Main */}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-ns-tertiary">
                {activeListName ?? "Tous les contacts"}
              </h2>
              <p className="text-xs text-ns-secondary">
                {filtered.length} contact{filtered.length > 1 ? "s" : ""}
                {activeList ? ` · liste` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={openImport}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-ns-tertiary shadow-sm hover:bg-ns-brand-light"
              >
                <Link2 className="h-4 w-4" />
                Lien Feuille
              </button>
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-2 rounded-xl bg-ns-primary px-3 py-2 text-sm font-semibold text-black shadow-sm hover:brightness-95"
              >
                <Plus className="h-4 w-4" />
                Ajouter des contacts
              </button>
              {activeList ? (
                <>
                  <button
                    type="button"
                    className={BTN_SECONDARY}
                    onClick={() => {
                      setListFormMode("rename");
                      setListFormId(activeList.id);
                      setListFormName(activeList.name);
                      setListFormOpen(true);
                    }}
                  >
                    Renommer
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                    disabled={busy}
                    onClick={() => void deleteActiveList()}
                  >
                    Supprimer liste
                  </button>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
            <div className="min-w-[180px] flex-1">
              <label className={LABEL_CLASS} htmlFor="prospect-search">
                Recherche
              </label>
              <input
                id="prospect-search"
                className={INPUT_CLASS}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nom, email, société, tag…"
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

          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            {loading ? (
              <p className="p-6 text-sm text-ns-secondary">Chargement…</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-ns-secondary">
                      <th className="w-10 px-2 py-2">
                        <input
                          type="checkbox"
                          checked={allFilteredSelected}
                          onChange={toggleAllFiltered}
                          aria-label="Tout sélectionner"
                          className="h-4 w-4 accent-sky-600"
                        />
                      </th>
                      <th className="px-2 py-2">Membre</th>
                      <th className="px-2 py-2">Société &amp; poste</th>
                      <th className="px-2 py-2">Contact</th>
                      <th className="px-2 py-2">Lieu</th>
                      <th className="px-2 py-2">Tél.</th>
                      <th className="px-2 py-2">Listes / tags</th>
                      <th className="px-2 py-2">Critères</th>
                      <th className="px-2 py-2">Vu!</th>
                      <th className="w-10 px-2 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <tr
                        key={p.id}
                        className={`border-b border-gray-50 hover:bg-ns-brand-light/60 ${
                          selected.has(p.id) ? "bg-sky-50/80" : ""
                        }`}
                      >
                        <td className="px-2 py-2.5 align-top">
                          <input
                            type="checkbox"
                            checked={selected.has(p.id)}
                            onChange={() => toggleOne(p.id)}
                            aria-label={`Sélectionner ${p.fullName || p.email}`}
                            className="h-4 w-4 accent-sky-600"
                          />
                        </td>
                        <td
                          className="cursor-pointer px-2 py-2.5 align-top"
                          onClick={() => openEdit(p)}
                          title="Clique pour éditer"
                        >
                          <div className="font-semibold text-ns-tertiary">{p.fullName || "—"}</div>
                          {p.sector ? (
                            <div className="text-[11px] text-ns-secondary">{p.sector}</div>
                          ) : null}
                        </td>
                        <td
                          className="cursor-pointer px-2 py-2.5 align-top"
                          onClick={() => openEdit(p)}
                        >
                          <div className="font-semibold text-ns-tertiary">{p.company || "—"}</div>
                          {p.position ? (
                            <div className="text-[11px] uppercase tracking-wide text-ns-secondary">
                              {p.position}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-2 py-2.5 align-top">
                          <a
                            href={`mailto:${p.email}`}
                            className="text-sky-700 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {p.email}
                          </a>
                          {p.linkedin ? (
                            <a
                              href={p.linkedin}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-ns-secondary hover:text-ns-tertiary"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Profil <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : null}
                        </td>
                        <td
                          className="cursor-pointer px-2 py-2.5 align-top text-ns-secondary"
                          onClick={() => openEdit(p)}
                        >
                          {p.city || "—"}
                        </td>
                        <td
                          className="cursor-pointer px-2 py-2.5 align-top text-ns-secondary"
                          onClick={() => openEdit(p)}
                        >
                          {p.phone || (
                            <span className="italic text-ns-secondary/70">Non renseigné</span>
                          )}
                        </td>
                        <td className="px-2 py-2.5 align-top">
                          <div className="flex max-w-[160px] flex-wrap gap-1">
                            {(p.lists ?? []).map((l) => (
                              <span
                                key={`l-${l}`}
                                className="rounded bg-lime-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-lime-900"
                              >
                                {l}
                              </span>
                            ))}
                            {(p.tags ?? []).map((t) => (
                              <span
                                key={`t-${t}`}
                                className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-ns-secondary"
                              >
                                {t}
                              </span>
                            ))}
                            {!p.lists?.length && !p.tags?.length ? (
                              <span className="text-[11px] italic text-ns-secondary/60">—</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-2 py-2.5 align-top">
                          <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                            {CRITERIA.map(({ status, label }) => (
                              <label
                                key={status}
                                className="inline-flex cursor-pointer items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ns-secondary"
                              >
                                <input
                                  type="checkbox"
                                  checked={p.status === status}
                                  disabled={busy}
                                  onChange={() => {
                                    if (p.status !== status) void patchProspect(p.id, { status });
                                  }}
                                  className="h-3.5 w-3.5 accent-sky-600"
                                />
                                {label}
                              </label>
                            ))}
                          </div>
                        </td>
                        <td className="px-2 py-2.5 align-top" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={Boolean(p.seen)}
                            disabled={busy}
                            aria-label="Vu"
                            onChange={() => void patchProspect(p.id, { seen: !p.seen })}
                            className="h-4 w-4 accent-sky-600"
                          />
                        </td>
                        <td className="px-2 py-2.5 align-top">
                          <div className="flex items-center gap-1">
                            <Link
                              href={`/admin/contacts?email=${encodeURIComponent(p.email)}`}
                              className="rounded-lg px-2 py-1 text-[11px] font-semibold text-sky-800 hover:bg-sky-50"
                              onClick={(e) => e.stopPropagation()}
                              title="Mémoire contact"
                            >
                              Mémoire
                            </Link>
                            <button
                              type="button"
                              className="rounded-lg p-1.5 text-ns-secondary hover:bg-gray-100"
                              aria-label="Éditer"
                              onClick={() => openEdit(p)}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-2 py-8 text-center text-ns-secondary">
                          Aucun prospect. Utilise Lien Feuille ou Ajouter des contacts.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            )}
            <p className="border-t border-gray-50 px-3 py-2 text-[11px] text-ns-secondary">
              {filtered.length} affiché(s) · coche pour ouvrir le bandeau jaune
            </p>
          </div>
        </div>
      </div>

      {/* Bandeau jaune — sélection (style Perso) */}
      {someSelected ? (
        <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 lg:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col gap-3 rounded-2xl border border-amber-100 bg-amber-50/95 px-3 py-3 shadow-lg backdrop-blur sm:px-4">
              <span className="shrink-0 text-sm font-medium text-ns-tertiary">
                {selected.size} contact{selected.size > 1 ? "s" : ""} sélectionné
                {selected.size > 1 ? "s" : ""}
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="shrink-0 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-medium text-ns-tertiary transition-colors hover:bg-amber-100/60"
                >
                  Tout désélectionner
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setAddToListPicked(new Set());
                    setAddToListOpen(true);
                  }}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-medium text-ns-tertiary transition-colors hover:bg-amber-50/80"
                >
                  <ListPlus className="h-4 w-4" />
                  Ajouter à une liste
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setCriterionOpen(true)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-medium text-ns-tertiary transition-colors hover:bg-amber-50/80"
                >
                  <CheckSquare className="h-4 w-4" />
                  Appliquer un critère
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runBulk({ seen: true })}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-medium text-ns-tertiary transition-colors hover:bg-amber-50/80"
                >
                  Marquer Vu!
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Supprimer ${selected.size} contact(s) sélectionné(s) (soft delete) ?`,
                      )
                    ) {
                      void runBulk({ softDelete: true });
                    }
                  }}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal Ajouter à une liste */}
      {addToListOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAddToListOpen(false);
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-ns-tertiary">
                <ListPlus className="h-5 w-5" />
                Ajouter à une liste
              </h2>
              <button
                type="button"
                className="rounded-full p-2 hover:bg-gray-100"
                onClick={() => setAddToListOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <p className="text-sm text-ns-secondary">
                {selected.size} contact{selected.size > 1 ? "s" : ""} sélectionné
                {selected.size > 1 ? "s" : ""}
              </p>
              {lists.length === 0 ? (
                <p className="text-sm text-ns-secondary">
                  Aucune liste — crée-en une ci-dessous.
                </p>
              ) : (
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-gray-100 p-2">
                  {lists.map((l) => (
                    <label
                      key={l.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-50 ${
                        addToListPicked.has(l.name) ? "bg-ns-primary/10" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={addToListPicked.has(l.name)}
                        onChange={() => {
                          setAddToListPicked((prev) => {
                            const next = new Set(prev);
                            if (next.has(l.name)) next.delete(l.name);
                            else next.add(l.name);
                            return next;
                          });
                        }}
                        className="rounded border-gray-300"
                      />
                      <span className="truncate text-sm font-medium text-ns-tertiary">
                        {l.name}
                      </span>
                      <span className="ml-auto shrink-0 text-xs text-ns-secondary/70">
                        {l.contactCount}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <button
                type="button"
                className="w-full py-2 text-sm font-semibold text-ns-secondary hover:text-ns-tertiary"
                onClick={() => {
                  setAddToListOpen(false);
                  setListFormMode("create");
                  setListFormId(null);
                  setListFormName("");
                  setListFormOpen(true);
                }}
              >
                + Créer une nouvelle liste
              </button>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">
              <button type="button" className={BTN_SECONDARY} onClick={() => setAddToListOpen(false)}>
                Annuler
              </button>
              <button
                type="button"
                className={BTN_PRIMARY}
                disabled={busy || addToListPicked.size === 0}
                onClick={() => void confirmAddToLists()}
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal créer / renommer liste */}
      {listFormOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setListFormOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-ns-tertiary">
              <ListMusic className="h-5 w-5" />
              {listFormMode === "create" ? "Nouvelle liste" : "Renommer la liste"}
            </h2>
            {error && listFormOpen ? <p className={`${ERROR_TEXT} mb-3`}>{error}</p> : null}
            <label className={LABEL_CLASS} htmlFor="list-name">
              Nom
            </label>
            <input
              id="list-name"
              className={INPUT_CLASS}
              value={listFormName}
              onChange={(e) => setListFormName(e.target.value)}
              placeholder="ex. LA MESA - CONTACTER"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitListForm();
              }}
            />
            {listFormMode === "create" && selected.size > 0 ? (
              <p className="mt-2 text-xs text-ns-secondary">
                Les {selected.size} contact(s) sélectionné(s) seront ajoutés à cette liste.
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className={BTN_SECONDARY} onClick={() => setListFormOpen(false)}>
                Annuler
              </button>
              <button
                type="button"
                className={BTN_PRIMARY}
                disabled={busy || !listFormName.trim()}
                onClick={() => void submitListForm()}
              >
                {listFormMode === "create" ? "Créer" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal appliquer critère */}
      {criterionOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCriterionOpen(false);
          }}
        >
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-ns-tertiary">
              <CheckSquare className="h-5 w-5" />
              Appliquer un critère
            </h2>
            <p className="mb-4 text-sm text-ns-secondary">
              Statut pour les {selected.size} contact(s) sélectionné(s).
            </p>
            <select
              className={INPUT_CLASS}
              value={criterionStatus}
              onChange={(e) => setCriterionStatus(e.target.value as ProspectStatus)}
            >
              {PROSPECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className={BTN_SECONDARY} onClick={() => setCriterionOpen(false)}>
                Annuler
              </button>
              <button
                type="button"
                className={BTN_PRIMARY}
                disabled={busy}
                onClick={() => {
                  setCriterionOpen(false);
                  void runBulk({ status: criterionStatus });
                }}
              >
                Appliquer
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal Import */}
      {importOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setImportOpen(false);
          }}
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="flex items-center gap-2 text-base font-bold text-ns-tertiary">
                <Upload className="h-5 w-5 text-ns-secondary" />
                Importer des contacts
              </h2>
              <button
                type="button"
                className="rounded-lg p-1.5 text-ns-secondary hover:bg-gray-100"
                onClick={() => setImportOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 rounded-2xl border border-gray-100 bg-ns-brand-light/40 p-4">
              <p className="text-xs leading-relaxed text-ns-secondary">
                Sheet partagé en lecteur. Colonnes : email, nom, société… Dedup sur l’e-mail.
              </p>
              <input
                className={INPUT_CLASS}
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder="URL Google Sheet…"
                autoFocus
              />
              {error && importOpen ? <p className={ERROR_TEXT}>{error}</p> : null}
              <button
                type="button"
                className={`${BTN_PRIMARY} inline-flex w-full items-center justify-center gap-2`}
                disabled={busy || !sheetUrl.trim()}
                onClick={() => void importSheet()}
              >
                <Download className="h-4 w-4" />
                {busy ? "Import…" : "Extraire les données"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal contact */}
      {contactOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeContact();
          }}
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="flex items-center gap-2 text-base font-bold text-ns-tertiary">
                <Plus className="h-5 w-5" />
                {editingId ? "Modifier le contact" : "Nouveau contact"}
              </h2>
              <button
                type="button"
                className="rounded-lg p-1.5 text-ns-secondary hover:bg-gray-100"
                onClick={closeContact}
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
                <label className={LABEL_CLASS} htmlFor="pf-lists">
                  Listes (virgules)
                </label>
                <input
                  id="pf-lists"
                  className={INPUT_CLASS}
                  value={draft.lists}
                  onChange={(e) => setDraft((d) => ({ ...d, lists: e.target.value }))}
                />
              </div>
              <div>
                <label className={LABEL_CLASS} htmlFor="pf-tags">
                  Tags (virgules)
                </label>
                <input
                  id="pf-tags"
                  className={INPUT_CLASS}
                  value={draft.tags}
                  onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))}
                />
              </div>
              <label className="inline-flex items-center gap-2 text-sm font-medium text-ns-tertiary">
                <input
                  type="checkbox"
                  checked={draft.seen}
                  onChange={(e) => setDraft((d) => ({ ...d, seen: e.target.checked }))}
                  className="h-4 w-4 accent-sky-600"
                />
                Vu!
              </label>
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
              className={`${BTN_PRIMARY} mt-5 w-full`}
              disabled={busy || !draft.email.includes("@")}
              onClick={() => void saveContact()}
            >
              {busy ? "…" : editingId ? "Enregistrer" : "Créer le contact"}
            </button>
            {editingId ? (
              <div className="mt-4 space-y-2 border-t border-gray-100 pt-3">
                <button
                  type="button"
                  className="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                  disabled={busy}
                  onClick={() => void deleteEditing()}
                >
                  Supprimer
                </button>
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

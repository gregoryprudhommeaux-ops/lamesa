"use client";

import { useAuthFetch } from "@/hooks/use-auth-fetch";
import type { ProspectListWithCount } from "@/lib/types/prospect-lists";
import type { Prospect, ProspectStatus } from "@/lib/types/prospects";
import { PROSPECT_STATUSES } from "@/lib/types/prospects";
import { BTN_PRIMARY, BTN_SECONDARY, ERROR_TEXT, INPUT_CLASS, LABEL_CLASS } from "@/lib/ui/nextstep";
import {
  CheckSquare,
  Download,
  Link2,
  ListMusic,
  ListPlus,
  Mail,
  Plus,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { EmailTemplateDoc, TemplateLocale } from "@/lib/types/events";
import { isCustomEmailTemplateKey } from "@/lib/email/template-defaults";

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
  tags: "",
  lists: "",
  status: "to_contact" as ProspectStatus,
  seen: false,
};

type Draft = typeof emptyDraft;

type SortKey = "fullName" | "company" | "email" | "city" | "lists" | "status" | "updatedAt";
type SortDir = "asc" | "desc";

const STATUS_SORT_RANK: Record<ProspectStatus, number> = {
  to_contact: 0,
  contacted: 1,
  nurture: 2,
  won: 3,
  do_not_contact: 4,
};

function parseCsvField(raw: string): string[] {
  return [...new Set(raw.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean))];
}

function compareProspects(a: Prospect, b: Prospect, key: SortKey, dir: SortDir): number {
  const mul = dir === "asc" ? 1 : -1;
  const str = (v: string) => v.trim().toLowerCase();
  let cmp = 0;
  switch (key) {
    case "fullName":
      cmp = str(a.fullName || a.email).localeCompare(str(b.fullName || b.email), "fr", {
        sensitivity: "base",
      });
      break;
    case "company":
      cmp = str(a.company).localeCompare(str(b.company), "fr", { sensitivity: "base" });
      if (cmp === 0) {
        cmp = str(a.position).localeCompare(str(b.position), "fr", { sensitivity: "base" });
      }
      break;
    case "email":
      cmp = str(a.email).localeCompare(str(b.email), "fr");
      break;
    case "city":
      cmp = str(a.city).localeCompare(str(b.city), "fr", { sensitivity: "base" });
      break;
    case "lists": {
      const la = (a.lists ?? []).slice().sort((x, y) => x.localeCompare(y, "fr"))[0] ?? "";
      const lb = (b.lists ?? []).slice().sort((x, y) => x.localeCompare(y, "fr"))[0] ?? "";
      cmp = str(la).localeCompare(str(lb), "fr", { sensitivity: "base" });
      if (cmp === 0) cmp = (a.lists?.length ?? 0) - (b.lists?.length ?? 0);
      break;
    }
    case "status":
      cmp = STATUS_SORT_RANK[a.status] - STATUS_SORT_RANK[b.status];
      break;
    case "updatedAt":
      cmp = String(a.updatedAt ?? "").localeCompare(String(b.updatedAt ?? ""));
      break;
    default:
      cmp = 0;
  }
  if (cmp !== 0) return cmp * mul;
  return str(a.email).localeCompare(str(b.email), "fr") * mul;
}

function formatShortDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "2-digit",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export function AdminProspectsPanel() {
  const authFetch = useAuthFetch();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [lists, setLists] = useState<ProspectListWithCount[]>([]);
  const [activeListName, setActiveListName] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [addToListOpen, setAddToListOpen] = useState(false);
  const [addToListPicked, setAddToListPicked] = useState<Set<string>>(new Set());
  const [listBulkMode, setListBulkMode] = useState<"add" | "remove">("add");
  const [listFormOpen, setListFormOpen] = useState(false);
  const [listFormMode, setListFormMode] = useState<"create" | "rename">("create");
  const [listFormName, setListFormName] = useState("");
  const [listFormId, setListFormId] = useState<string | null>(null);
  const [criterionOpen, setCriterionOpen] = useState(false);
  const [criterionStatus, setCriterionStatus] = useState<ProspectStatus>("contacted");

  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTemplates, setEmailTemplates] = useState<
    Array<{ key: string; label: string; enabled: boolean }>
  >([]);
  const [emailTemplateKey, setEmailTemplateKey] = useState("");
  const [emailLocale, setEmailLocale] = useState<TemplateLocale>("es");
  const [emailLoadingTemplates, setEmailLoadingTemplates] = useState(false);

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
    const rows = prospects.filter((p) => {
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
    return [...rows].sort((a, b) => compareProspects(a, b, sortKey, sortDir));
  }, [prospects, query, activeListName, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    // Dates: newest first by default; text: A→Z
    setSortDir(key === "updatedAt" ? "desc" : "asc");
  }

  function sortIndicator(key: SortKey): string {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

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

  const emailRecipients = useMemo(() => {
    const pool = someSelected
      ? filtered.filter((p) => selected.has(p.id))
      : filtered;
    return pool.filter((p) => p.email.includes("@")).slice(0, 50);
  }, [filtered, selected, someSelected]);

  async function openEmailModal() {
    setError(null);
    setEmailOpen(true);
    setEmailLoadingTemplates(true);
    try {
      const res = await authFetch("/api/admin/email-templates?locale=es");
      const json = (await res.json()) as {
        ok?: boolean;
        templates?: EmailTemplateDoc[];
        error?: string;
      };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "templates_failed");
      const custom = (json.templates ?? [])
        .filter((t) => isCustomEmailTemplateKey(t.key))
        .map((t) => ({
          key: t.key,
          label: t.label?.trim() || t.key.replace(/^custom_/, ""),
          enabled: t.enabled !== false,
        }));
      setEmailTemplates(custom);
      const firstEnabled = custom.find((t) => t.enabled)?.key ?? custom[0]?.key ?? "";
      setEmailTemplateKey(firstEnabled);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setEmailOpen(false);
    } finally {
      setEmailLoadingTemplates(false);
    }
  }

  async function sendListEmail() {
    if (!emailTemplateKey || emailRecipients.length === 0) return;
    const tpl = emailTemplates.find((t) => t.key === emailTemplateKey);
    if (tpl && !tpl.enabled) {
      setError("Template désactivé — active-le dans Templates.");
      return;
    }
    if (
      !window.confirm(
        `Envoyer « ${tpl?.label ?? emailTemplateKey} » (${emailLocale}) à ${emailRecipients.length} contact(s) ? Ils passeront en « contacté ».`,
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
          templateKey: emailTemplateKey,
          locale: emailLocale,
          contactIds: emailRecipients.map((p) => p.id),
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
      setEmailOpen(false);
      setMessage(
        `Email envoyé — ok ${json.sent ?? 0} · échecs ${json.failed ?? 0} · skip ${json.skipped ?? 0}`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function syncInscritsFromWaitlist() {
    if (
      !window.confirm(
        "Importer tous les membres inscrits dans Prospects (liste « MEMBRES INSCRITS », statut Gagné) ? Les fiches existantes seront fusionnées.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await authFetch("/api/admin/prospects", {
        method: "POST",
        body: JSON.stringify({ action: "sync-waitlist" }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        scanned?: number;
        created?: number;
        merged?: number;
        skipped?: number;
        failed?: number;
        listName?: string;
        error?: string;
      };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "sync_failed");
      setMessage(
        `MEMBRES INSCRITS — scannés ${json.scanned ?? 0} · créés ${json.created ?? 0} · fusionnés ${json.merged ?? 0} · skip ${json.skipped ?? 0} · échecs ${json.failed ?? 0}`,
      );
      setActiveListName(json.listName ?? "MEMBRES INSCRITS");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirmListBulk() {
    const names = [...addToListPicked];
    if (names.length === 0) return;
    const count = selected.size;
    setAddToListOpen(false);
    if (listBulkMode === "remove") {
      await runBulk({ removeLists: names });
      setMessage(`${count} contact(s) retiré(s) de ${names.length} liste(s).`);
    } else {
      await runBulk({ addLists: names });
    }
    setAddToListPicked(new Set());
    setListBulkMode("add");
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
    <div className={`space-y-2 ${someSelected ? "pb-28" : ""}`}>
      {error && !importOpen && !contactOpen && !listFormOpen && !addToListOpen && !emailOpen ? (
        <p className={ERROR_TEXT}>{error}</p>
      ) : null}
      {message ? <p className="text-xs font-medium text-ns-primary">{message}</p> : null}

      <div className="flex h-[calc(100vh-5.5rem)] min-h-[28rem] flex-col gap-2 lg:flex-row">
        <aside className="flex max-h-40 w-full shrink-0 flex-col overflow-hidden rounded-xl border border-gray-200/80 bg-white lg:max-h-none lg:w-44 xl:w-52">
          <div className="flex items-center justify-between border-b border-gray-100 px-2 py-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-ns-secondary">Listes</p>
            <button
              type="button"
              className="rounded-md p-1 text-ns-secondary hover:bg-ns-brand-light"
              aria-label="Nouvelle liste"
              title="Nouvelle liste"
              onClick={() => {
                setListFormMode("create");
                setListFormId(null);
                setListFormName("");
                setListFormOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-1">
            <button
              type="button"
              onClick={() => setActiveListName(null)}
              className={`mb-0.5 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs transition ${
                !activeListName
                  ? "bg-ns-primary/15 font-semibold text-ns-tertiary"
                  : "text-ns-secondary hover:bg-gray-50"
              }`}
            >
              <ListMusic className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">Tous</span>
              <span className="tabular-nums text-[10px] text-ns-secondary/80">{prospects.length}</span>
            </button>
            {lists.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setActiveListName(l.name)}
                className={`mb-0.5 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left transition ${
                  activeListName?.toLowerCase() === l.name.toLowerCase()
                    ? "bg-ns-primary/15 text-ns-tertiary"
                    : "text-ns-secondary hover:bg-gray-50"
                }`}
                title={`${l.contactCount} contacts`}
              >
                <span className="min-w-0 flex-1 truncate text-xs font-semibold">{l.name}</span>
                <span className="shrink-0 tabular-nums text-[10px] text-ns-secondary/80">{l.contactCount}</span>
              </button>
            ))}
            {lists.length === 0 ? (
              <p className="px-2 py-2 text-[10px] leading-snug text-ns-secondary">+ pour créer une liste</p>
            ) : null}
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 truncate text-sm font-bold text-ns-tertiary">
              {activeListName ?? "Tous les contacts"}
              <span className="ml-1.5 font-medium text-ns-secondary">· {filtered.length}</span>
            </h2>
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <input
                id="prospect-search"
                className="h-8 min-w-[10rem] flex-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-ns-tertiary placeholder:text-ns-secondary/60 focus:border-ns-primary focus:outline-none sm:min-w-[14rem] sm:flex-none"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher…"
                aria-label="Recherche"
              />
              <button type="button" className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-ns-tertiary hover:bg-ns-brand-light" onClick={openImport}>
                <Link2 className="h-3.5 w-3.5" /> Feuille
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-ns-tertiary hover:bg-ns-brand-light disabled:opacity-50"
                disabled={busy || loading}
                title="Importer les membres inscrits dans Prospects (liste MEMBRES INSCRITS)"
                onClick={() => void syncInscritsFromWaitlist()}
              >
                <Users className="h-3.5 w-3.5" /> MEMBRES INSCRITS
              </button>
              <button type="button" className="inline-flex h-8 items-center gap-1 rounded-lg bg-ns-primary px-2.5 text-xs font-semibold text-black hover:brightness-95" onClick={openCreate}>
                <Plus className="h-3.5 w-3.5" /> Ajouter
              </button>
              {activeListName || someSelected ? (
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-ns-tertiary hover:bg-ns-brand-light disabled:opacity-50"
                  disabled={busy || loading || emailRecipients.length === 0}
                  title={
                    someSelected
                      ? `Email aux ${Math.min(selected.size, 50)} sélectionné(s)`
                      : `Email à la liste (max 50)`
                  }
                  onClick={() => void openEmailModal()}
                >
                  <Mail className="h-3.5 w-3.5" /> Email
                </button>
              ) : null}
              {activeList ? (
                <>
                  <button type="button" className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs font-semibold text-ns-tertiary hover:bg-gray-50" onClick={() => { setListFormMode("rename"); setListFormId(activeList.id); setListFormName(activeList.name); setListFormOpen(true); }}>Renommer</button>
                  <button type="button" className="h-8 rounded-lg border border-red-200 px-2 text-xs font-semibold text-red-700 hover:bg-red-50" disabled={busy} onClick={() => void deleteActiveList()}>Suppr. liste</button>
                </>
              ) : null}
              <button type="button" className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs font-medium text-ns-secondary hover:bg-gray-50" disabled={loading || busy} onClick={() => void load()} aria-label="Rafraîchir">↻</button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200/80 bg-white">
            {loading ? (
              <p className="p-4 text-sm text-ns-secondary">Chargement…</p>
            ) : (
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full min-w-[920px] border-collapse text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                    <tr className="text-[10px] font-semibold uppercase tracking-wide text-ns-secondary">
                      <th className="w-8 px-1.5 py-1.5">
                        <input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} aria-label="Tout sélectionner" className="h-3.5 w-3.5 accent-sky-600" />
                      </th>
                      <th className="px-1.5 py-1.5">
                        <button type="button" className="hover:text-ns-tertiary" onClick={() => toggleSort("fullName")}>
                          Membre{sortIndicator("fullName")}
                        </button>
                      </th>
                      <th className="px-1.5 py-1.5">
                        <button type="button" className="hover:text-ns-tertiary" onClick={() => toggleSort("company")}>
                          Société{sortIndicator("company")}
                        </button>
                      </th>
                      <th className="px-1.5 py-1.5">
                        <button type="button" className="hover:text-ns-tertiary" onClick={() => toggleSort("email")}>
                          Contact{sortIndicator("email")}
                        </button>
                      </th>
                      <th className="hidden px-1.5 py-1.5 xl:table-cell">
                        <button type="button" className="hover:text-ns-tertiary" onClick={() => toggleSort("city")}>
                          Lieu{sortIndicator("city")}
                        </button>
                      </th>
                      <th className="px-1.5 py-1.5">
                        <button type="button" className="hover:text-ns-tertiary" onClick={() => toggleSort("lists")}>
                          Listes{sortIndicator("lists")}
                        </button>
                      </th>
                      <th className="w-[8.5rem] px-1.5 py-1.5">
                        <label className="sr-only" htmlFor="prospect-status-col-filter">
                          Filtrer par statut
                        </label>
                        <select
                          id="prospect-status-col-filter"
                          className="h-7 w-full max-w-[8.5rem] rounded border border-gray-200 bg-white px-1 text-[10px] font-semibold uppercase tracking-wide text-ns-secondary"
                          value={statusFilter}
                          onChange={(e) =>
                            setStatusFilter(e.target.value as ProspectStatus | "all")
                          }
                          onClick={(e) => e.stopPropagation()}
                          title="Filtrer les contacts par statut"
                        >
                          <option value="all">Statut · tous</option>
                          {PROSPECT_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      </th>
                      <th className="w-[4.5rem] px-1.5 py-1.5">
                        <button type="button" className="hover:text-ns-tertiary" onClick={() => toggleSort("updatedAt")} title="Date de mise à jour">
                          Maj.{sortIndicator("updatedAt")}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <tr
                        key={p.id}
                        className={`cursor-pointer border-t border-gray-50 hover:bg-ns-brand-light/50 ${selected.has(p.id) ? "bg-sky-50/70" : ""}`}
                        onClick={() => openEdit(p)}
                      >
                        <td className="px-1.5 py-1 align-middle" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} aria-label={`Sélectionner ${p.fullName || p.email}`} className="h-3.5 w-3.5 accent-sky-600" />
                        </td>
                        <td className="max-w-[11rem] truncate px-1.5 py-1 align-middle font-semibold text-ns-tertiary" title={[p.fullName, p.sector].filter(Boolean).join(" · ")}>{p.fullName || "—"}</td>
                        <td className="max-w-[12rem] truncate px-1.5 py-1 align-middle text-ns-secondary" title={[p.company, p.position].filter(Boolean).join(" · ")}>
                          <span className="font-medium text-ns-tertiary">{p.company || "—"}</span>
                          {p.position ? <span className="text-ns-secondary/80"> · {p.position}</span> : null}
                        </td>
                        <td className="max-w-[14rem] truncate px-1.5 py-1 align-middle text-sky-800" title={p.email}>
                          {p.email}
                        </td>
                        <td className="hidden max-w-[6rem] truncate px-1.5 py-1 align-middle text-ns-secondary xl:table-cell" title={[p.city, p.phone].filter(Boolean).join(" · ") || undefined}>
                          {p.city || (p.phone ? p.phone : "—")}
                        </td>
                        <td className="max-w-[8rem] px-1.5 py-1 align-middle">
                          <div className="flex flex-wrap gap-0.5">
                            {(p.lists ?? []).slice(0, 2).map((l) => (
                              <span key={`l-${l}`} className="max-w-[4.5rem] truncate rounded bg-lime-100 px-1 py-px text-[9px] font-semibold uppercase text-lime-900" title={l}>{l}</span>
                            ))}
                            {(p.lists?.length ?? 0) > 2 ? <span className="text-[9px] text-ns-secondary">+{(p.lists?.length ?? 0) - 2}</span> : null}
                            {!p.lists?.length ? <span className="text-[10px] text-ns-secondary/50">—</span> : null}
                          </div>
                        </td>
                        <td className="px-1.5 py-1 align-middle" onClick={(e) => e.stopPropagation()}>
                          <select
                            className="h-7 w-full max-w-[7.5rem] rounded border border-gray-200 bg-white px-1 text-[10px] font-semibold text-ns-tertiary"
                            value={p.status}
                            disabled={busy}
                            aria-label="Statut"
                            onChange={(e) => {
                              const next = e.target.value as ProspectStatus;
                              if (next !== p.status) void patchProspect(p.id, { status: next });
                            }}
                          >
                            {PROSPECT_STATUSES.map((s) => (
                              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                            ))}
                          </select>
                        </td>
                        <td className="whitespace-nowrap px-1.5 py-1 align-middle text-[10px] text-ns-secondary" title={p.updatedAt || undefined}>
                          {formatShortDate(p.updatedAt)}
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 ? (
                      <tr><td colSpan={8} className="px-2 py-6 text-center text-ns-secondary">Aucun prospect. Feuille ou Ajouter.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {someSelected ? (
        <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
          <div className="mx-auto max-w-[1600px]">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-100 bg-amber-50/95 px-3 py-2 shadow-lg backdrop-blur">
              <span className="shrink-0 text-xs font-semibold text-ns-tertiary">{selected.size} sélectionné{selected.size > 1 ? "s" : ""}</span>
              <button type="button" onClick={() => setSelected(new Set())} className="rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ns-tertiary hover:bg-amber-100/60">Désélectionner</button>
              <button type="button" disabled={busy} onClick={() => { setAddToListPicked(new Set()); setListBulkMode("add"); setAddToListOpen(true); }} className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ns-tertiary hover:bg-amber-50/80"><ListPlus className="h-3.5 w-3.5" /> Liste</button>
              <button type="button" disabled={busy || emailRecipients.length === 0} onClick={() => void openEmailModal()} className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ns-tertiary hover:bg-amber-50/80"><Mail className="h-3.5 w-3.5" /> Email</button>
              <button type="button" disabled={busy} onClick={() => setCriterionOpen(true)} className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ns-tertiary hover:bg-amber-50/80"><CheckSquare className="h-3.5 w-3.5" /> Critère</button>
              <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Supprimer ${selected.size} contact(s) sélectionné(s) (soft delete) ?`)) void runBulk({ softDelete: true }); }} className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /> Suppr.</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal Gérer listes — ajouter / retirer */}
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
                Gérer les listes
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
              <div className="inline-flex rounded-xl bg-gray-100 p-1 text-sm font-semibold">
                <button
                  type="button"
                  className={`rounded-lg px-3 py-1.5 ${
                    listBulkMode === "add"
                      ? "bg-white text-ns-tertiary shadow-sm"
                      : "text-ns-secondary"
                  }`}
                  onClick={() => setListBulkMode("add")}
                >
                  Ajouter
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-3 py-1.5 ${
                    listBulkMode === "remove"
                      ? "bg-white text-ns-tertiary shadow-sm"
                      : "text-ns-secondary"
                  }`}
                  onClick={() => setListBulkMode("remove")}
                >
                  Retirer
                </button>
              </div>
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
              {listBulkMode === "add" ? (
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
              ) : (
                <p className="text-xs text-ns-secondary">
                  Les contacts seront retirés des listes cochées (la liste elle-même reste).
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">
              <button type="button" className={BTN_SECONDARY} onClick={() => setAddToListOpen(false)}>
                Annuler
              </button>
              <button
                type="button"
                className={BTN_PRIMARY}
                disabled={busy || addToListPicked.size === 0}
                onClick={() => void confirmListBulk()}
              >
                {listBulkMode === "remove" ? "Retirer" : "Ajouter"}
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

      {/* Modal email template */}
      {emailOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEmailOpen(false);
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-ns-tertiary">
                <Mail className="h-5 w-5" />
                Envoyer un email
              </h2>
              <button
                type="button"
                className="rounded-full p-2 hover:bg-gray-100"
                onClick={() => setEmailOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <p className="text-sm text-ns-secondary">
                {someSelected
                  ? `${emailRecipients.length} contact(s) sélectionné(s)`
                  : activeListName
                    ? `Liste « ${activeListName} » · ${emailRecipients.length} destinataire(s)`
                    : `${emailRecipients.length} destinataire(s)`}
                {filtered.length > 50 && !someSelected ? (
                  <span className="block text-xs text-amber-800">Max 50 par envoi — premiers de la vue.</span>
                ) : null}
                {someSelected && selected.size > 50 ? (
                  <span className="block text-xs text-amber-800">Max 50 — seuls les 50 premiers sélectionnés.</span>
                ) : null}
              </p>
              {error && emailOpen ? <p className={ERROR_TEXT}>{error}</p> : null}
              {emailLoadingTemplates ? (
                <p className="text-sm text-ns-secondary">Chargement des templates…</p>
              ) : emailTemplates.length === 0 ? (
                <p className="text-sm text-ns-secondary">
                  Aucun template custom. Crée-en un dans{" "}
                  <Link href="/admin/templates" className="font-semibold text-ns-tertiary underline">
                    Templates
                  </Link>
                  .
                </p>
              ) : (
                <>
                  <div>
                    <label className={LABEL_CLASS} htmlFor="prospect-email-template">
                      Template
                    </label>
                    <select
                      id="prospect-email-template"
                      className={INPUT_CLASS}
                      value={emailTemplateKey}
                      onChange={(e) => setEmailTemplateKey(e.target.value)}
                    >
                      {emailTemplates.map((t) => (
                        <option key={t.key} value={t.key} disabled={!t.enabled}>
                          {t.label}
                          {!t.enabled ? " (désactivé)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL_CLASS} htmlFor="prospect-email-locale">
                      Langue
                    </label>
                    <select
                      id="prospect-email-locale"
                      className={INPUT_CLASS}
                      value={emailLocale}
                      onChange={(e) => setEmailLocale(e.target.value as TemplateLocale)}
                    >
                      <option value="es">Español</option>
                      <option value="fr">Français</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                  <p className="text-xs text-ns-secondary">
                    Templates custom uniquement. Les destinataires passent en statut « contacté ».
                  </p>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">
              <button type="button" className={BTN_SECONDARY} onClick={() => setEmailOpen(false)}>
                Annuler
              </button>
              <button
                type="button"
                className={BTN_PRIMARY}
                disabled={
                  busy ||
                  emailLoadingTemplates ||
                  !emailTemplateKey ||
                  emailRecipients.length === 0
                }
                onClick={() => void sendListEmail()}
              >
                Envoyer
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
                <Link
                  href={`/admin/contacts?email=${encodeURIComponent(draft.email)}`}
                  className="inline-flex text-sm font-semibold text-sky-800 hover:underline"
                >
                  Voir la mémoire contact
                </Link>
                {draft.linkedin?.trim() ? (
                  <a
                    href={draft.linkedin.trim()}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-sm font-medium text-ns-secondary hover:text-ns-tertiary"
                  >
                    Ouvrir LinkedIn
                  </a>
                ) : null}
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

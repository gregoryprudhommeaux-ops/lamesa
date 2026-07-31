"use client";

import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { setPendingInvitees } from "@/lib/admin/pending-invitees";
import { labelCityHubFr, labelPositionFr, labelSectorFr } from "@/lib/admin/waitlist-labels-fr";
import { POSITIONS, SECTORS } from "@/lib/constants/form-options";
import {
  OPS_PRIORITIES,
  OPS_PRIORITY_LABELS_FR,
  OPS_SUGGESTED_TAGS,
  normalizeOpsTags,
  resolveOpsPriority,
  type OpsPriority,
} from "@/lib/constants/ops-priority";
import {
  computeProfileCompletionPercent,
  isExpressSignup,
  isProfileIncomplete,
  listMissingProfileFieldsFr,
} from "@/lib/member/profile-completion";
import { isFranconetworkMember } from "@/lib/member/franconetwork-member";
import { isSoftDeleted } from "@/lib/member/soft-delete";
import type { AdminEvent, WaitlistRegistration } from "@/lib/types/events";
import { BTN_PRIMARY, BTN_SECONDARY, ERROR_TEXT, INPUT_CLASS, LABEL_CLASS } from "@/lib/ui/nextstep";
import {
  CompletionCell,
  WelcomeEmailCell,
  formatRegistrantDate,
  registrantSubtitle as buildRegistrantSubtitle,
} from "@/components/admin/registrant-table-cells";
import { CalendarPlus, Mail, Trash2, UserPlus, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type ProfileReminderDraft = {
  memberId: string;
  memberName: string;
  to: string;
  subject: string;
  body: string;
  force: boolean;
  alreadySentThisMonth: boolean;
};

function persoSyncStatus(
  r: Pick<WaitlistRegistration, "databasePersoSyncStatus" | "databasePersoContactId">,
): "synced" | "failed" | "skipped" | null {
  if (r.databasePersoSyncStatus) return r.databasePersoSyncStatus;
  if (r.databasePersoContactId) return "synced";
  return null;
}

function truncatePersoId(id: string, max = 10): string {
  const t = id.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function OpsMemberEditor({
  member,
  onSaved,
}: {
  member: WaitlistRegistration;
  onSaved: (patch: {
    opsNotes?: string;
    opsPriority?: OpsPriority;
    opsTags?: string[];
    opsTouchedAt?: string;
  }) => void;
}) {
  const authFetch = useAuthFetch();
  const [notes, setNotes] = useState(member.opsNotes ?? "");
  const [priority, setPriority] = useState<OpsPriority>(resolveOpsPriority(member.opsPriority));
  const [tagsText, setTagsText] = useState((member.opsTags ?? []).join(", "));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setNotes(member.opsNotes ?? "");
    setPriority(resolveOpsPriority(member.opsPriority));
    setTagsText((member.opsTags ?? []).join(", "));
    setMsg(null);
    setErr(null);
  }, [member.id, member.opsNotes, member.opsPriority, member.opsTags]);

  async function save() {
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      const opsTags = normalizeOpsTags(
        tagsText
          .split(/[,;\n]/)
          .map((t) => t.trim())
          .filter(Boolean),
      );
      const res = await authFetch(`/api/admin/waitlist/${encodeURIComponent(member.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opsNotes: notes.trim(),
          opsPriority: priority,
          opsTags,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        opsNotes?: string;
        opsPriority?: OpsPriority;
        opsTags?: string[];
        opsTouchedAt?: string;
      };
      if (!res.ok || !json.ok) {
        setErr(json.error ?? "save_failed");
        return;
      }
      onSaved({
        opsNotes: typeof json.opsNotes === "string" ? json.opsNotes : notes.trim(),
        opsPriority: resolveOpsPriority(json.opsPriority ?? priority),
        opsTags: Array.isArray(json.opsTags) ? json.opsTags : opsTags,
        opsTouchedAt: json.opsTouchedAt,
      });
      setTagsText((Array.isArray(json.opsTags) ? json.opsTags : opsTags).join(", "));
      setMsg("Notes ops enregistrées");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function toggleSuggested(tag: string) {
    const current = normalizeOpsTags(
      tagsText
        .split(/[,;\n]/)
        .map((t) => t.trim())
        .filter(Boolean),
    );
    const next = current.includes(tag)
      ? current.filter((t) => t !== tag)
      : [...current, tag];
    setTagsText(next.join(", "));
  }

  return (
    <div className="space-y-3 border-t border-gray-100 pt-4">
      <p className="text-xs font-bold uppercase text-ns-secondary">Ops (CRM table)</p>
      <div>
        <label className={LABEL_CLASS} htmlFor={`ops-priority-${member.id}`}>
          Priorité
        </label>
        <select
          id={`ops-priority-${member.id}`}
          className={INPUT_CLASS}
          value={priority}
          onChange={(e) => setPriority(e.target.value as OpsPriority)}
        >
          {OPS_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {OPS_PRIORITY_LABELS_FR[p]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={LABEL_CLASS} htmlFor={`ops-notes-${member.id}`}>
          Notes
        </label>
        <textarea
          id={`ops-notes-${member.id}`}
          className={`${INPUT_CLASS} min-h-[88px]`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Bien à table, à revoir, contexte post-dîner…"
          maxLength={4000}
        />
      </div>
      <div>
        <label className={LABEL_CLASS} htmlFor={`ops-tags-${member.id}`}>
          Tags (virgules)
        </label>
        <input
          id={`ops-tags-${member.id}`}
          className={INPUT_CLASS}
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          placeholder="no-show, vip…"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {OPS_SUGGESTED_TAGS.map((tag) => {
            const active = normalizeOpsTags(
              tagsText
                .split(/[,;\n]/)
                .map((t) => t.trim())
                .filter(Boolean),
            ).includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleSuggested(tag)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  active
                    ? "bg-ns-primary text-white"
                    : "bg-ns-brand-light text-ns-secondary hover:bg-ns-brand-light/80"
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>
      {err ? <p className={ERROR_TEXT}>{err}</p> : null}
      {msg ? <p className="text-xs font-semibold text-emerald-700">{msg}</p> : null}
      <button
        type="button"
        className={`${BTN_PRIMARY} w-full text-sm`}
        disabled={saving || isSoftDeleted(member)}
        onClick={() => void save()}
      >
        {saving ? "Enregistrement…" : "Enregistrer ops"}
      </button>
      {member.opsTouchedAt ? (
        <p className="text-[11px] text-ns-secondary">
          Dernière édition {new Date(member.opsTouchedAt).toLocaleString("fr-FR")}
        </p>
      ) : null}
    </div>
  );
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(values.map((v) => (v ?? "").trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
}

type ContextMenuState = { x: number; y: number } | null;
type ReferralFilter = "all" | "with_referrer" | "without_referrer" | "deactivated";
type ProfileFilter = "all" | "incomplete";
type SourceFilter = "all" | "franconetwork";

export function AdminRegistrantsPanel({ title }: { title: string }) {
  const authFetch = useAuthFetch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<WaitlistRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sendingFnMail, setSendingFnMail] = useState(false);
  const [sendingProfileMail, setSendingProfileMail] = useState(false);
  const [loadingProfilePreview, setLoadingProfilePreview] = useState(false);
  const [profileReminderDraft, setProfileReminderDraft] =
    useState<ProfileReminderDraft | null>(null);
  const [q, setQ] = useState("");
  const [sector, setSector] = useState("");
  const [position, setPosition] = useState("");
  const [city, setCity] = useState("");
  const [company, setCompany] = useState("");
  const [referralFilter, setReferralFilter] = useState<ReferralFilter>("all");
  const [profileFilter, setProfileFilter] = useState<ProfileFilter>(() =>
    searchParams.get("profile") === "incomplete" ? "incomplete" : "all",
  );
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>(() =>
    searchParams.get("source") === "franconetwork" ? "franconetwork" : "all",
  );
  const [activeId, setActiveId] = useState<string | null>(() => searchParams.get("id"));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [addToEventOpen, setAddToEventOpen] = useState(false);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [targetEventId, setTargetEventId] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/waitlist");
      const json = (await res.json()) as {
        ok?: boolean;
        results?: WaitlistRegistration[];
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "unauthorized");
        return;
      }
      setRows(json.results ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function closeMenu() {
      setContextMenu(null);
    }
    window.addEventListener("click", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, []);

  const cityOptions = useMemo(() => uniqueSorted(rows.map((r) => r.city)), [rows]);
  const companyOptions = useMemo(() => uniqueSorted(rows.map((r) => r.company)), [rows]);

  const sectorOptions = useMemo(() => {
    const fromData = uniqueSorted(rows.map((r) => r.sector));
    const known = SECTORS.filter((s) => fromData.includes(s) || rows.length === 0);
    const extras = fromData.filter((s) => !SECTORS.includes(s as (typeof SECTORS)[number]));
    return [...known, ...extras];
  }, [rows]);

  const positionOptions = useMemo(() => {
    const fromData = uniqueSorted(rows.map((r) => r.position));
    const known = POSITIONS.filter((p) => fromData.includes(p) || rows.length === 0);
    const extras = fromData.filter((p) => !POSITIONS.includes(p as (typeof POSITIONS)[number]));
    return [...known, ...extras];
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (referralFilter === "deactivated") {
        if (!isSoftDeleted(r)) return false;
      } else if (isSoftDeleted(r)) {
        return false;
      }
      if (referralFilter === "with_referrer" && !r.referredByCode?.trim()) return false;
      if (referralFilter === "without_referrer" && r.referredByCode?.trim()) return false;
      if (profileFilter === "incomplete") {
        const percent = computeProfileCompletionPercent(r);
        if (!(isExpressSignup(r) || percent < 50)) return false;
      }
      if (sourceFilter === "franconetwork" && !isFranconetworkMember(r)) return false;
      if (sector && r.sector !== sector) return false;
      if (position && r.position !== position) return false;
      if (city && (r.city ?? "").trim().toLowerCase() !== city.trim().toLowerCase()) return false;
      if (company && (r.company ?? "").trim().toLowerCase() !== company.trim().toLowerCase())
        return false;
      if (!needle) return true;
      const haystack = [
        r.fullName,
        r.email,
        r.company,
        r.city,
        r.sector,
        r.position,
        r.phone,
        r.referredByCode,
        r.referralCode,
        ...(r.tags ?? []),
        r.source,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [rows, q, sector, position, city, company, referralFilter, profileFilter, sourceFilter]);

  const filteredSorted = useMemo(
    () =>
      [...filtered].sort(
        (a, b) =>
          new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
      ),
    [filtered],
  );

  const active = activeId ? (rows.find((r) => r.id === activeId) ?? null) : null;
  const selectedRows = useMemo(
    () => rows.filter((r) => selectedIds.has(r.id)),
    [rows, selectedIds],
  );
  const hasFilters = Boolean(
    q ||
      sector ||
      position ||
      city ||
      company ||
      referralFilter !== "all" ||
      profileFilter !== "all" ||
      sourceFilter !== "all",
  );
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id));

  function memberSubtitle(r: WaitlistRegistration): string {
    return buildRegistrantSubtitle(r);
  }

  function openMember(id: string) {
    setActiveId(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set("id", id);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  function closeMemberModal() {
    setActiveId(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("id");
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }

  async function openProfileIncompletePreview(
    member: WaitlistRegistration,
    force = false,
  ) {
    setLoadingProfilePreview(true);
    setActionMsg(null);
    setError(null);
    try {
      const res = await authFetch(
        `/api/admin/waitlist/${encodeURIComponent(member.id)}/send-profile-incomplete`,
      );
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        alreadySentThisMonth?: boolean;
        preview?: {
          to: string;
          subject: string;
          body: string;
        };
      };
      if (!res.ok || !json.ok || !json.preview) {
        setError(json.error ?? "preview_failed");
        return;
      }
      setProfileReminderDraft({
        memberId: member.id,
        memberName: member.fullName?.trim() || member.email,
        to: json.preview.to,
        subject: json.preview.subject,
        body: json.preview.body,
        force,
        alreadySentThisMonth: Boolean(json.alreadySentThisMonth),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingProfilePreview(false);
    }
  }

  async function confirmSendProfileIncomplete() {
    if (!profileReminderDraft) return;
    const draft = profileReminderDraft;
    setSendingProfileMail(true);
    setActionMsg(null);
    setError(null);
    try {
      const res = await authFetch(
        `/api/admin/waitlist/${encodeURIComponent(draft.memberId)}/send-profile-incomplete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            force: draft.force || draft.alreadySentThisMonth,
            subject: draft.subject.trim(),
            body: draft.body.trim(),
          }),
        },
      );
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        skipped?: boolean;
        reason?: string;
        month?: string;
      };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "send_failed");
        return;
      }
      if (json.skipped && json.reason === "already_sent_this_month") {
        setActionMsg("Rappel profil déjà envoyé ce mois — utilise « Renvoyer » si besoin.");
        return;
      }
      if (json.skipped) {
        setActionMsg(`Rappel profil non envoyé (${json.reason ?? "skipped"}).`);
        return;
      }
      setActionMsg(`Rappel profil envoyé à ${draft.to}.`);
      setRows((prev) =>
        prev.map((r) =>
          r.id === draft.memberId
            ? {
                ...r,
                profileIncompleteEmailStatus: "sent",
                profileIncompleteEmailSentAt: new Date().toISOString(),
                profileIncompleteNudgeMonth: json.month,
              }
            : r,
        ),
      );
      setProfileReminderDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSendingProfileMail(false);
    }
  }

  function clearFilters() {
    setQ("");
    setSector("");
    setPosition("");
    setCity("");
    setCompany("");
    setReferralFilter("all");
    setProfileFilter("all");
    setSourceFilter("all");
  }

  async function sendFnAnnouncement(member: WaitlistRegistration, force = false) {
    setSendingFnMail(true);
    setActionMsg(null);
    setError(null);
    try {
      const res = await authFetch(
        `/api/admin/waitlist/${encodeURIComponent(member.id)}/send-fn-announcement`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force }),
        },
      );
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        skipped?: boolean;
        reason?: string;
      };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "send_failed");
        return;
      }
      if (json.skipped && json.reason === "already_sent") {
        setActionMsg("Annonce FN déjà envoyée — utilise « Renvoyer » si besoin.");
        return;
      }
      if (json.skipped) {
        setActionMsg(`Annonce FN non envoyée (${json.reason ?? "skipped"}).`);
        return;
      }
      setActionMsg(`Annonce FN envoyée à ${member.email}.`);
      setRows((prev) =>
        prev.map((r) =>
          r.id === member.id
            ? {
                ...r,
                fnAnnouncementEmailStatus: "sent",
                fnAnnouncementEmailSentAt: new Date().toISOString(),
              }
            : r,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSendingFnMail(false);
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // Multi-select only — open fiche via row click.
  }

  function toggleAllFiltered() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const r of filtered) next.delete(r.id);
      } else {
        for (const r of filtered) next.add(r.id);
      }
      return next;
    });
  }

  function toInvitees(list: WaitlistRegistration[]) {
    return list.map((r) => ({
      email: r.email,
      fullName: r.fullName,
      companyName: r.company,
      contactId: r.id,
      source: "waitlist" as const,
      inviteAs: "invited" as const,
    }));
  }

  function createEventFromSelection() {
    if (selectedRows.length === 0) return;
    setPendingInvitees(toInvitees(selectedRows));
    setContextMenu(null);
    router.push("/admin/evenements?nouveau=1");
  }

  async function openAddToEvent() {
    setContextMenu(null);
    setAddToEventOpen(true);
    setActionMsg(null);
    setEventsLoading(true);
    try {
      const res = await authFetch("/api/admin/events");
      const json = (await res.json()) as {
        ok?: boolean;
        events?: AdminEvent[];
        error?: string;
      };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "load_failed");
      setEvents(json.events ?? []);
      setTargetEventId(json.events?.[0]?.id ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setEventsLoading(false);
    }
  }

  async function deleteContacts(ids: string[]) {
    const unique = [...new Set(ids.filter(Boolean))];
    if (unique.length === 0) return;
    const label =
      unique.length === 1
        ? "Supprimer ce contact de la waitlist ?"
        : `Supprimer ${unique.length} contacts de la waitlist ?`;
    if (!window.confirm(`${label}\n\nIls passeront en « Désactivés » (soft delete).`)) {
      return;
    }

    setDeleting(true);
    setError(null);
    setActionMsg(null);
    setContextMenu(null);
    try {
      const res = await authFetch("/api/admin/waitlist/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: unique }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        deleted?: number;
        error?: string;
      };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "delete_failed");
      setActionMsg(`${json.deleted ?? unique.length} contact(s) supprimé(s).`);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of unique) next.delete(id);
        return next;
      });
      if (activeId && unique.includes(activeId)) closeMemberModal();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  }

  async function confirmAddToEvent() {
    if (!targetEventId || selectedRows.length === 0) return;
    setAdding(true);
    setActionMsg(null);
    try {
      const res = await authFetch(`/api/admin/events/${targetEventId}/invitees`, {
        method: "POST",
        body: JSON.stringify({
          inviteEmails: toInvitees(selectedRows).map((inv) => ({
            email: inv.email,
            fullName: inv.fullName,
            companyName: inv.companyName,
            contactId: inv.contactId,
          })),
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        added?: number;
        skipped?: number;
        error?: string;
      };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "save_failed");
      setActionMsg(
        `${json.added ?? 0} ajouté(s)${
          typeof (json as { waitlisted?: number }).waitlisted === "number" &&
          (json as { waitlisted: number }).waitlisted > 0
            ? ` dont ${(json as { waitlisted: number }).waitlisted} en liste d'attente`
            : ""
        }${json.skipped ? ` · ${json.skipped} déjà présent(s)` : ""}.`,
      );
      setAddToEventOpen(false);
      setSelectedIds(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAdding(false);
    }
  }

  if (loading) return <p className="text-sm text-ns-secondary">Chargement…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-xl font-bold text-ns-hero">{title}</h2>
        <p className="text-sm text-ns-secondary">
          {filtered.length} / {rows.length} inscrit{rows.length > 1 ? "s" : ""}
          {selectedIds.size > 0 ? ` · ${selectedIds.size} sélectionné(s)` : ""}
        </p>
      </div>
      {error && <p className={ERROR_TEXT}>{error}</p>}
      {actionMsg && <p className="text-sm font-medium text-ns-tertiary">{actionMsg}</p>}

      <div className="space-y-4 rounded-2xl border border-gray-100 bg-ns-surface p-4">
        <div>
          <label className={LABEL_CLASS} htmlFor="registrants-q">
            Recherche
          </label>
          <input
            id="registrants-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={INPUT_CLASS}
            placeholder="Nom, email, entreprise, ville, intérêts…"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div>
            <label className={LABEL_CLASS} htmlFor="filter-profile">
              Profil
            </label>
            <select
              id="filter-profile"
              value={profileFilter}
              onChange={(e) => setProfileFilter(e.target.value as ProfileFilter)}
              className={INPUT_CLASS}
            >
              <option value="all">Tous</option>
              <option value="incomplete">À compléter</option>
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="filter-source">
              Source
            </label>
            <select
              id="filter-source"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
              className={INPUT_CLASS}
            >
              <option value="all">Toutes</option>
              <option value="franconetwork">FrancoNetwork</option>
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="filter-referral">
              Parrainage
            </label>
            <select
              id="filter-referral"
              value={referralFilter}
              onChange={(e) => setReferralFilter(e.target.value as ReferralFilter)}
              className={INPUT_CLASS}
            >
              <option value="all">Tous</option>
              <option value="with_referrer">Avec parrain</option>
              <option value="without_referrer">Sans parrain</option>
              <option value="deactivated">Désactivés</option>
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="filter-position">
              Position
            </label>
            <select
              id="filter-position"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">Toutes</option>
              {positionOptions.map((p) => (
                <option key={p} value={p}>
                  {labelPositionFr(p)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="filter-sector">
              Secteur
            </label>
            <select
              id="filter-sector"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">Tous</option>
              {sectorOptions.map((s) => (
                <option key={s} value={s}>
                  {labelSectorFr(s)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="filter-city">
              Ville
            </label>
            <select
              id="filter-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">Toutes</option>
              {cityOptions.map((c) => (
                <option key={c} value={c}>
                  {labelCityHubFr(c)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="filter-company">
              Entreprise
            </label>
            <select
              id="filter-company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">Toutes</option>
              {companyOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {hasFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm font-semibold text-ns-tertiary underline-offset-2 hover:underline"
          >
            Réinitialiser les filtres
          </button>
        ) : null}
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-ns-primary/30 bg-ns-primary/10 px-4 py-3">
          <span className="mr-2 text-sm font-semibold text-ns-tertiary">
            {selectedIds.size} sélectionné(s)
          </span>
          <button
            type="button"
            onClick={createEventFromSelection}
            className={`${BTN_PRIMARY} inline-flex items-center gap-2 text-sm`}
          >
            <CalendarPlus className="h-4 w-4" />
            Créer un nouvel événement
          </button>
          <button
            type="button"
            onClick={() => void openAddToEvent()}
            className={`${BTN_SECONDARY} inline-flex items-center gap-2 text-sm`}
          >
            <UserPlus className="h-4 w-4" />
            Ajouter à un événement
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-sm font-medium text-ns-secondary underline-offset-2 hover:underline"
          >
            Tout désélectionner
          </button>
        </div>
      )}

      <div
        className="overflow-hidden rounded-2xl border border-gray-100 bg-ns-surface"
        onContextMenu={(e) => {
          if (selectedIds.size === 0) return;
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-ns-secondary">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={toggleAllFiltered}
              className="h-4 w-4 accent-ns-primary"
            />
            Tous (filtrés) · {filteredSorted.length}
          </label>
          <span className="text-xs text-ns-secondary/70">
            Clic = fiche · clic droit = actions sélection
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-ns-secondary">
                <th className="px-4 py-2 font-semibold w-10" />
                <th className="py-2 pr-3 font-semibold">Inscrit</th>
                <th className="py-2 pr-3 font-semibold">Inscription</th>
                <th className="py-2 pr-3 font-semibold">Complétion</th>
                <th
                  className="py-2 pr-3 font-semibold"
                  title="Mail auto après inscription (express = compléter le profil)"
                >
                  Mail auto
                </th>
                <th className="py-2 pr-3 font-semibold">Contact</th>
                <th className="py-2 pr-3 font-semibold">Parrain</th>
                <th className="py-2 pr-4 font-semibold">Perso</th>
              </tr>
            </thead>
            <tbody>
              {filteredSorted.map((r) => {
                const percent = computeProfileCompletionPercent(r);
                const missing = listMissingProfileFieldsFr(r);
                const express = isExpressSignup(r);
                const status = persoSyncStatus(r);
                const persoId = r.databasePersoContactId?.trim();
                return (
                  <tr
                    key={r.id}
                    className={`cursor-pointer border-b border-gray-50 align-top transition hover:bg-ns-brand-light/60 ${
                      activeId === r.id ? "bg-ns-primary/10" : ""
                    } ${selectedIds.has(r.id) ? "bg-ns-primary/5" : ""} ${
                      isSoftDeleted(r) ? "opacity-70" : ""
                    }`}
                    onClick={() => openMember(r.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openMember(r.id);
                      }
                    }}
                    tabIndex={0}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(r.id)}
                        onChange={() => toggleOne(r.id)}
                        className="mt-1 h-4 w-4 accent-ns-primary"
                        aria-label={`Sélectionner ${r.fullName}`}
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <p className="font-semibold text-ns-tertiary">{r.fullName || "—"}</p>
                      <p className="mt-0.5 text-xs text-ns-secondary">
                        {memberSubtitle(r) || "—"}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {isSoftDeleted(r) ? (
                          <span className="inline-flex rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-600">
                            Désactivé
                          </span>
                        ) : null}
                        {express ? (
                          <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                            Express
                          </span>
                        ) : null}
                        {isFranconetworkMember(r) ? (
                          <span className="inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-800">
                            FrancoNetwork
                          </span>
                        ) : null}
                        {(() => {
                          const band = resolveOpsPriority(r.opsPriority);
                          if (band === "normal") return null;
                          const className =
                            band === "priority"
                              ? "bg-rose-100 text-rose-800"
                              : band === "review"
                                ? "bg-orange-100 text-orange-800"
                                : "bg-slate-200 text-slate-700";
                          return (
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${className}`}
                            >
                              {OPS_PRIORITY_LABELS_FR[band]}
                            </span>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="py-3 pr-3 whitespace-nowrap text-ns-secondary">
                      {formatRegistrantDate(r.createdAt ?? "")}
                    </td>
                    <td className="py-3 pr-3">
                      <CompletionCell percent={percent} missingFields={missing} />
                    </td>
                    <td className="py-3 pr-3">
                      <WelcomeEmailCell
                        status={r.welcomeEmailStatus ?? null}
                        sentAt={r.welcomeEmailSentAt ?? null}
                        isExpress={express}
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <a
                        href={`mailto:${r.email}`}
                        className="block text-ns-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.email || "—"}
                      </a>
                      {r.phone ? (
                        <p className="mt-0.5 text-xs text-ns-secondary">{r.phone}</p>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3 text-xs text-ns-secondary">
                      {r.referredByCode?.trim() || "—"}
                    </td>
                    <td className="py-3 pr-4 text-xs">
                      {!status ? (
                        <span className="text-ns-secondary/70">—</span>
                      ) : (
                        <div>
                          <span
                            className={`font-semibold uppercase tracking-wide ${
                              status === "synced"
                                ? "text-emerald-700"
                                : status === "failed"
                                  ? "text-red-700"
                                  : "text-ns-secondary"
                            }`}
                          >
                            {status}
                          </span>
                          {persoId ? (
                            <span
                              className="mt-0.5 block truncate font-mono text-[11px] text-ns-secondary"
                              title={persoId}
                            >
                              {truncatePersoId(persoId)}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredSorted.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-sm text-ns-secondary">
                    Aucun inscrit{hasFilters ? " pour ces filtres" : ""}.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {active ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Fiche membre ${active.fullName}`}
          onClick={closeMemberModal}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-ns-hero">{active.fullName}</h3>
                <p className="mt-1 text-xs text-ns-secondary">
                  {memberSubtitle(active) || "—"}
                  {active.createdAt
                    ? ` · inscrit ${formatRegistrantDate(active.createdAt)}`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 text-ns-secondary hover:text-ns-tertiary"
                onClick={closeMemberModal}
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4 text-sm">
              <dl className="space-y-3">
                <div>
                  <dt className="text-xs font-bold uppercase text-ns-secondary">Email</dt>
                  <dd>
                    <a
                      href={`mailto:${active.email}`}
                      className="font-semibold text-ns-primary hover:underline"
                    >
                      {active.email}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-ns-secondary">Téléphone</dt>
                  <dd>{active.phone || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-ns-secondary">Entreprise</dt>
                  <dd>{active.company || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-ns-secondary">Secteur</dt>
                  <dd>{labelSectorFr(active.sector, active.sectorOther)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-ns-secondary">Position</dt>
                  <dd>{labelPositionFr(active.position)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-ns-secondary">Ville</dt>
                  <dd>{labelCityHubFr(active.city)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-ns-secondary">LinkedIn</dt>
                  <dd>
                    {active.linkedinUrl?.trim() ? (
                      <a
                        href={active.linkedinUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-ns-primary hover:underline"
                      >
                        LINKEDIN
                      </a>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-ns-secondary">Complétion</dt>
                  <dd>
                    <CompletionCell
                      percent={computeProfileCompletionPercent(active)}
                      missingFields={listMissingProfileFieldsFr(active)}
                    />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-ns-secondary">Parrain</dt>
                  <dd>{active.referredByCode?.trim() || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-ns-secondary">Code parrainage</dt>
                  <dd>{active.referralCode?.trim() || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-ns-secondary">Mail auto</dt>
                  <dd>
                    <WelcomeEmailCell
                      status={active.welcomeEmailStatus ?? null}
                      sentAt={active.welcomeEmailSentAt ?? null}
                      isExpress={isExpressSignup(active)}
                    />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-ns-secondary">Database Perso</dt>
                  <dd>
                    {(active.databasePersoSyncStatus ??
                      (active.databasePersoContactId ? "synced" : undefined)) === "synced"
                      ? `Sync OK${active.databasePersoContactId ? ` · ${active.databasePersoContactId}` : ""}`
                      : active.databasePersoSyncStatus === "failed"
                        ? "Échec sync"
                        : active.databasePersoSyncStatus === "skipped"
                          ? "Non configuré / skip"
                          : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-ns-secondary">Intérêts</dt>
                  <dd>{(active.extraActivities ?? []).join(", ") || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-ns-secondary">Motivation</dt>
                  <dd className="whitespace-pre-wrap">{active.invitationMotivation || "—"}</dd>
                </div>
                {isFranconetworkMember(active) && !isSoftDeleted(active) ? (
                  <div className="space-y-2 border-t border-gray-100 pt-4">
                    <p className="text-xs font-bold uppercase text-ns-secondary">
                      Annonce FrancoNetwork (ES)
                    </p>
                    <p className="text-xs text-ns-secondary">
                      Template{" "}
                      <span className="font-mono text-[11px]">fn_announcement</span>
                      {active.fnAnnouncementEmailStatus === "sent"
                        ? ` · envoyé${active.fnAnnouncementEmailSentAt ? ` ${new Date(active.fnAnnouncementEmailSentAt).toLocaleString("fr-FR")}` : ""}`
                        : active.fnAnnouncementEmailStatus === "failed"
                          ? " · échec dernier envoi"
                          : " · pas encore envoyé"}
                    </p>
                    <button
                      type="button"
                      className={`${BTN_PRIMARY} inline-flex w-full items-center justify-center gap-2 text-sm`}
                      disabled={sendingFnMail}
                      onClick={() =>
                        void sendFnAnnouncement(
                          active,
                          active.fnAnnouncementEmailStatus === "sent",
                        )
                      }
                    >
                      <Mail className="h-4 w-4" />
                      {sendingFnMail
                        ? "Envoi…"
                        : active.fnAnnouncementEmailStatus === "sent"
                          ? "Renvoyer l’annonce"
                          : "Envoyer l’annonce"}
                    </button>
                  </div>
                ) : null}
                {isProfileIncomplete(active) && !isSoftDeleted(active) ? (
                  <div className="space-y-2 border-t border-gray-100 pt-4">
                    <p className="text-xs font-bold uppercase text-ns-secondary">
                      Rappel profil incomplet (ES)
                    </p>
                    <p className="text-xs text-ns-secondary">
                      Template{" "}
                      <span className="font-mono text-[11px]">profile_incomplete</span>
                      {" · "}
                      {computeProfileCompletionPercent(active)}%
                      {active.profileIncompleteNudgeMonth
                        ? ` · dernier mois ${active.profileIncompleteNudgeMonth}`
                        : " · pas encore ce mois"}
                    </p>
                    <button
                      type="button"
                      className={`${BTN_PRIMARY} inline-flex w-full items-center justify-center gap-2 text-sm`}
                      disabled={sendingProfileMail || loadingProfilePreview}
                      onClick={() =>
                        void openProfileIncompletePreview(
                          active,
                          Boolean(active.profileIncompleteNudgeMonth),
                        )
                      }
                    >
                      <Mail className="h-4 w-4" />
                      {loadingProfilePreview
                        ? "Chargement…"
                        : sendingProfileMail
                          ? "Envoi…"
                          : active.profileIncompleteNudgeMonth
                            ? "Renvoyer le rappel"
                            : "Envoyer le rappel"}
                    </button>
                  </div>
                ) : null}
                {!isSoftDeleted(active) ? (
                  <OpsMemberEditor
                    member={active}
                    onSaved={(patch) => {
                      setRows((prev) =>
                        prev.map((r) => (r.id === active.id ? { ...r, ...patch } : r)),
                      );
                    }}
                  />
                ) : null}
                {!isSoftDeleted(active) ? (
                  <div className="border-t border-gray-100 pt-4">
                    <button
                      type="button"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                      disabled={deleting}
                      onClick={() => void deleteContacts([active.id])}
                    >
                      <Trash2 className="h-4 w-4" />
                      {deleting ? "Suppression…" : "Supprimer"}
                    </button>
                  </div>
                ) : null}
              </dl>
            </div>
          </div>
        </div>
      ) : null}

      {contextMenu && selectedIds.size > 0 && (
        <div
          className="fixed z-50 min-w-[220px] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-ns-brand-light"
            onClick={createEventFromSelection}
          >
            <CalendarPlus className="h-4 w-4" />
            Créer un nouvel événement
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-ns-brand-light"
            onClick={() => void openAddToEvent()}
          >
            <UserPlus className="h-4 w-4" />
            Ajouter à un événement
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
            disabled={deleting}
            onClick={() => void deleteContacts([...selectedIds])}
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? "Suppression…" : "Supprimer"}
          </button>
        </div>
      )}

      {addToEventOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-ns-hero">Ajouter à un événement</h3>
            <p className="mt-1 text-sm text-ns-secondary">
              {selectedRows.length} contact(s) → liste des invités
            </p>
            {eventsLoading ? (
              <p className="mt-4 text-sm text-ns-secondary">Chargement des dîners…</p>
            ) : events.length === 0 ? (
              <p className="mt-4 text-sm text-ns-secondary">
                Aucun événement. Crée-en un d’abord.
              </p>
            ) : (
              <div className="mt-4">
                <label className={LABEL_CLASS} htmlFor="target-event">
                  Événement
                </label>
                <select
                  id="target-event"
                  value={targetEventId}
                  onChange={(e) => setTargetEventId(e.target.value)}
                  className={INPUT_CLASS}
                >
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} ({ev.status})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className={BTN_SECONDARY}
                onClick={() => setAddToEventOpen(false)}
              >
                Annuler
              </button>
              <button
                type="button"
                className={BTN_PRIMARY}
                disabled={adding || !targetEventId || events.length === 0}
                onClick={() => void confirmAddToEvent()}
              >
                {adding ? "Ajout…" : "Ajouter aux invités"}
              </button>
            </div>
          </div>
        </div>
      )}

      {profileReminderDraft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Prévisualiser le rappel profil"
          onClick={() => {
            if (!sendingProfileMail) setProfileReminderDraft(null);
          }}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div>
                <h3 className="text-lg font-bold text-ns-hero">Rappel profil incomplet</h3>
                <p className="mt-1 text-xs text-ns-secondary">
                  Relis et modifie le mail avant envoi ·{" "}
                  <span className="font-medium text-ns-tertiary">
                    {profileReminderDraft.memberName}
                  </span>{" "}
                  · {profileReminderDraft.to}
                </p>
              </div>
              <button
                type="button"
                className="text-ns-secondary hover:text-ns-tertiary"
                onClick={() => {
                  if (!sendingProfileMail) setProfileReminderDraft(null);
                }}
                aria-label="Fermer"
                disabled={sendingProfileMail}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto px-5 py-4">
              {profileReminderDraft.alreadySentThisMonth ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Un rappel a déjà été envoyé ce mois — l’envoi depuis cette fenêtre sera forcé.
                </p>
              ) : null}
              <div>
                <label className={LABEL_CLASS} htmlFor="profile-reminder-subject">
                  Objet
                </label>
                <input
                  id="profile-reminder-subject"
                  className={INPUT_CLASS}
                  value={profileReminderDraft.subject}
                  onChange={(e) =>
                    setProfileReminderDraft((prev) =>
                      prev ? { ...prev, subject: e.target.value } : prev,
                    )
                  }
                  disabled={sendingProfileMail}
                />
              </div>
              <div>
                <label className={LABEL_CLASS} htmlFor="profile-reminder-body">
                  Message
                </label>
                <textarea
                  id="profile-reminder-body"
                  className={`${INPUT_CLASS} min-h-[280px] font-mono text-sm`}
                  value={profileReminderDraft.body}
                  onChange={(e) =>
                    setProfileReminderDraft((prev) =>
                      prev ? { ...prev, body: e.target.value } : prev,
                    )
                  }
                  disabled={sendingProfileMail}
                />
                <p className="mt-1 text-[11px] text-ns-secondary">
                  Le lien de connexion devient un bouton « Completar mi perfil » dans le mail HTML.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
              <button
                type="button"
                className={BTN_SECONDARY}
                disabled={sendingProfileMail}
                onClick={() => setProfileReminderDraft(null)}
              >
                Annuler
              </button>
              <button
                type="button"
                className={BTN_PRIMARY}
                disabled={
                  sendingProfileMail ||
                  !profileReminderDraft.subject.trim() ||
                  !profileReminderDraft.body.trim()
                }
                onClick={() => void confirmSendProfileIncomplete()}
              >
                {sendingProfileMail ? "Envoi…" : "Envoyer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

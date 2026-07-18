"use client";

import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { setPendingInvitees } from "@/lib/admin/pending-invitees";
import { labelPositionFr, labelSectorFr } from "@/lib/admin/waitlist-labels-fr";
import { POSITIONS, SECTORS } from "@/lib/constants/form-options";
import {
  computeProfileCompletionPercent,
  isExpressSignup,
} from "@/lib/member/profile-completion";
import { isSoftDeleted } from "@/lib/member/soft-delete";
import type { AdminEvent, WaitlistRegistration } from "@/lib/types/events";
import { BTN_PRIMARY, BTN_SECONDARY, ERROR_TEXT, INPUT_CLASS, LABEL_CLASS } from "@/lib/ui/nextstep";
import { CalendarPlus, Trash2, UserPlus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

function deliveryBadge(
  kind: "mail",
  status: string | undefined,
): { label: string; className: string } | null {
  if (!status) return null;
  if (status === "sent")
    return {
      label: "Mail OK",
      className: "bg-emerald-100 text-emerald-800",
    };
  if (status === "failed")
    return {
      label: "Mail KO",
      className: "bg-red-100 text-red-800",
    };
  if (status === "skipped")
    return {
      label: "Mail off",
      className: "bg-gray-200 text-gray-600",
    };
  return null;
}

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

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(values.map((v) => (v ?? "").trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
}

type ContextMenuState = { x: number; y: number } | null;
type ReferralFilter = "all" | "with_referrer" | "without_referrer" | "deactivated";
type ProfileFilter = "all" | "incomplete";

export function AdminRegistrantsPanel({ title }: { title: string }) {
  const authFetch = useAuthFetch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<WaitlistRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [q, setQ] = useState("");
  const [sector, setSector] = useState("");
  const [position, setPosition] = useState("");
  const [city, setCity] = useState("");
  const [company, setCompany] = useState("");
  const [referralFilter, setReferralFilter] = useState<ReferralFilter>("all");
  const [profileFilter, setProfileFilter] = useState<ProfileFilter>(() =>
    searchParams.get("profile") === "incomplete" ? "incomplete" : "all",
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
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [rows, q, sector, position, city, company, referralFilter, profileFilter]);

  const active = activeId ? (rows.find((r) => r.id === activeId) ?? null) : null;
  const selectedRows = useMemo(
    () => rows.filter((r) => selectedIds.has(r.id)),
    [rows, selectedIds],
  );
  const hasFilters = Boolean(
    q || sector || position || city || company || referralFilter !== "all" || profileFilter !== "all",
  );
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id));

  function memberSubtitle(r: WaitlistRegistration): string {
    return [labelPositionFr(r.position), labelSectorFr(r.sector), r.company?.trim(), r.city?.trim()]
      .filter((part) => Boolean(part) && part !== "—")
      .join(" · ");
  }

  function clearFilters() {
    setQ("");
    setSector("");
    setPosition("");
    setCity("");
    setCompany("");
    setReferralFilter("all");
    setProfileFilter("all");
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // Checkbox selection also opens the detail panel (expected UX).
    setActiveId(id);
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
      if (activeId && unique.includes(activeId)) setActiveId(null);
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
                  {c}
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

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div
          className="overflow-hidden rounded-2xl border border-gray-100 bg-ns-surface"
          onContextMenu={(e) => {
            if (selectedIds.size === 0) return;
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY });
          }}
        >
          <div className="hidden border-b border-gray-100 px-4 py-2 sm:grid sm:grid-cols-[auto_minmax(0,1fr)_7rem_9rem] sm:items-center sm:gap-3">
            <span />
            <span className="text-xs font-semibold text-ns-secondary">Inscrit</span>
            <span className="text-right text-xs font-semibold text-ns-secondary">Parrain</span>
            <span className="text-right text-xs font-semibold text-ns-secondary">Perso</span>
          </div>
          <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-2 text-xs font-semibold text-ns-secondary sm:hidden">
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleAllFiltered}
                className="h-4 w-4 accent-ns-primary"
              />
              Tous (filtrés)
            </label>
          </div>
          <div className="hidden items-center gap-3 border-b border-gray-100 px-4 py-2 text-xs font-semibold text-ns-secondary sm:flex">
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleAllFiltered}
                className="h-4 w-4 accent-ns-primary"
              />
              Tous (filtrés)
            </label>
            <span className="text-ns-secondary/70">Clic droit sur la liste → actions</span>
          </div>
          <ul className="divide-y divide-gray-100">
            {filtered.map((r) => (
              <li key={r.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveId(r.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setActiveId(r.id);
                    }
                  }}
                  className={`grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-start gap-3 px-4 py-3 text-left text-sm hover:bg-ns-brand-light sm:grid-cols-[auto_minmax(0,1fr)_7rem_9rem] ${activeId === r.id ? "bg-ns-primary/10" : ""} ${selectedIds.has(r.id) ? "bg-ns-primary/5" : ""} ${isSoftDeleted(r) ? "opacity-70" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(r.id)}
                    onChange={() => toggleOne(r.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 h-4 w-4 shrink-0 accent-ns-primary"
                    aria-label={`Sélectionner ${r.fullName}`}
                  />
                  <div className="min-w-0 text-left">
                    <span className="inline-flex flex-wrap items-center gap-2 font-semibold text-ns-tertiary">
                      {r.fullName}
                      {isSoftDeleted(r) ? (
                        <span className="inline-flex rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-600">
                          Désactivé
                        </span>
                      ) : null}
                      {r.profileComplete === false ? (
                        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                          Express
                        </span>
                      ) : null}
                      {(() => {
                        const mail = deliveryBadge("mail", r.welcomeEmailStatus);
                        return mail ? (
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${mail.className}`}
                          >
                            {mail.label}
                          </span>
                        ) : null;
                      })()}
                    </span>
                    <span className="mt-0.5 block text-xs text-ns-secondary">
                      {memberSubtitle(r) || "—"}
                    </span>
                    <span className="mt-0.5 block text-xs text-ns-secondary/80">{r.email}</span>
                    <span className="mt-1 block text-xs text-ns-secondary sm:hidden">
                      Parrain : {r.referredByCode?.trim() || "—"}
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] text-ns-secondary sm:hidden">
                      Perso :{" "}
                      {(() => {
                        const status = persoSyncStatus(r);
                        const id = r.databasePersoContactId?.trim();
                        if (status === "synced" && id) return `synced · ${truncatePersoId(id, 14)}`;
                        if (status === "synced") return "synced";
                        if (status === "failed") return "failed";
                        if (status === "skipped") return "skipped";
                        return "—";
                      })()}
                    </span>
                  </div>
                  <div className="hidden text-right text-xs text-ns-secondary sm:block">
                    <span className="font-medium text-ns-tertiary">
                      {r.referredByCode?.trim() || "—"}
                    </span>
                  </div>
                  <div className="hidden text-right text-xs sm:block">
                    {(() => {
                      const status = persoSyncStatus(r);
                      const id = r.databasePersoContactId?.trim();
                      if (!status) {
                        return <span className="text-ns-secondary/70">—</span>;
                      }
                      const statusClass =
                        status === "synced"
                          ? "text-emerald-700"
                          : status === "failed"
                            ? "text-red-700"
                            : "text-ns-secondary";
                      return (
                        <div className="min-w-0">
                          <span className={`block font-semibold uppercase tracking-wide ${statusClass}`}>
                            {status}
                          </span>
                          {id ? (
                            <span
                              className="mt-0.5 block truncate font-mono text-[11px] text-ns-secondary"
                              title={id}
                            >
                              {truncatePersoId(id)}
                            </span>
                          ) : (
                            <span className="mt-0.5 block text-[11px] text-ns-secondary/70">—</span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-4 py-6 text-sm text-ns-secondary">
                Aucun inscrit{hasFilters ? " pour ces filtres" : ""}.
              </li>
            )}
          </ul>
        </div>

        <aside className="rounded-2xl border border-gray-100 bg-ns-surface p-5 text-sm">
          {active ? (
            <dl className="space-y-3">
              <div>
                <dt className="text-xs font-bold uppercase text-ns-secondary">Nom</dt>
                <dd className="flex flex-wrap items-center gap-2 font-semibold text-ns-tertiary">
                  {active.fullName}
                  {isSoftDeleted(active) ? (
                    <span className="inline-flex rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-600">
                      Désactivé
                    </span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-ns-secondary">Email</dt>
                <dd>{active.email}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-ns-secondary">Téléphone</dt>
                <dd>{active.phone}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-ns-secondary">Entreprise</dt>
                <dd>{active.company}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-ns-secondary">Secteur</dt>
                <dd>{labelSectorFr(active.sector)}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-ns-secondary">Position</dt>
                <dd>{labelPositionFr(active.position)}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-ns-secondary">Ville</dt>
                <dd>{active.city}</dd>
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
                  {active.welcomeEmailStatus === "sent"
                    ? `Envoyé${active.welcomeEmailSentAt ? ` · ${new Date(active.welcomeEmailSentAt).toLocaleString("fr-FR")}` : ""}`
                    : active.welcomeEmailStatus === "failed"
                      ? `Échec${active.welcomeEmailError ? ` · ${active.welcomeEmailError}` : ""}`
                      : active.welcomeEmailStatus === "skipped"
                        ? "Désactivé (template off)"
                        : "— (avant tracking)"}
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
          ) : (
            <p className="text-ns-secondary">Sélectionne un inscrit pour voir le détail.</p>
          )}
        </aside>
      </div>

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
    </div>
  );
}

"use client";

import type { AdminEventParticipation, DatabasePersoContact, WaitlistRegistration } from "@/lib/types/events";
import { buildAudienceFitIndex, type AudienceFitSummary } from "@/lib/admin/audience-fit";
import {
  INTEREST_DISPLAY_LABELS,
  resolveInterestDisplay,
  type InterestDisplayStatus,
} from "@/lib/admin/interest-display";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { isSoftDeleted } from "@/lib/member/soft-delete";
import { BTN_PRIMARY, BTN_SECONDARY, CHIP, CHIP_ACTIVE, INPUT_CLASS, LABEL_CLASS } from "@/lib/ui/nextstep";
import { Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

export type InviteAsStatus = "invited" | "waitlist";

export type SelectedInvitee = {
  email: string;
  fullName?: string;
  companyName?: string;
  contactId?: string;
  source: "database_perso" | "waitlist" | "external";
  /** How to add them when saving the event */
  inviteAs: InviteAsStatus;
};

type ContactPickerProps = {
  selected: SelectedInvitee[];
  onChange: (next: SelectedInvitee[]) => void;
  labels: {
    search: string;
    selected: string;
    addExternal: string;
    externalEmail: string;
    externalName: string;
  };
  /** All participations (any event) — used for observed fit chips. */
  participations?: AdminEventParticipation[];
  /** Current dinner city for “same city” signal. */
  eventCity?: string | null;
  /** Exclude seats already on this event from “past” history. */
  excludeEventId?: string | null;
  /** Interest OUI/NON by email (current dinner, interest mode). */
  interestByEmail?: Record<string, InterestDisplayStatus> | null;
};

type PickerRow = {
  key: string;
  email: string;
  fullName: string;
  company?: string;
  contactId?: string;
  source: "database_perso" | "waitlist";
  badge?: string;
  fit?: AudienceFitSummary | null;
};

function FitChips({ fit }: { fit: AudienceFitSummary | null | undefined }) {
  if (!fit || fit.signals.length === 0) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {fit.signals.map((s) => (
        <span
          key={s.id}
          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
            s.tone === "positive"
              ? "bg-emerald-50 text-emerald-800"
              : s.tone === "caution"
                ? "bg-amber-50 text-amber-900"
                : "bg-ns-brand-light text-ns-secondary"
          }`}
        >
          {s.label}
        </span>
      ))}
    </span>
  );
}

function InterestChip({ status }: { status: InterestDisplayStatus | null }) {
  if (!status) return null;
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        status === "oui"
          ? "bg-emerald-50 text-emerald-800"
          : status === "non"
            ? "bg-rose-50 text-rose-800"
            : status === "autre"
              ? "bg-amber-50 text-amber-900"
              : "bg-ns-brand-light text-ns-secondary"
      }`}
    >
      {INTEREST_DISPLAY_LABELS[status]}
    </span>
  );
}

export function ContactPicker({
  selected,
  onChange,
  labels,
  participations = [],
  eventCity = null,
  excludeEventId = null,
  interestByEmail = null,
}: ContactPickerProps) {
  const authFetch = useAuthFetch();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [inviteAs, setInviteAs] = useState<InviteAsStatus>("invited");
  const [waitlist, setWaitlist] = useState<WaitlistRegistration[]>([]);
  const [dbResults, setDbResults] = useState<DatabasePersoContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [draftEmails, setDraftEmails] = useState<Set<string>>(new Set());
  const [externalEmail, setExternalEmail] = useState("");
  const [externalName, setExternalName] = useState("");

  const fitIndex = useMemo(
    () =>
      buildAudienceFitIndex({
        waitlist,
        participations,
        eventCity,
        excludeEventId,
      }),
    [waitlist, participations, eventCity, excludeEventId],
  );

  const loadWaitlist = useCallback(async () => {
    try {
      const res = await authFetch("/api/waitlist");
      const json = (await res.json()) as { ok?: boolean; results?: WaitlistRegistration[] };
      if (json.ok && json.results) {
        setWaitlist(json.results.filter((w) => !isSoftDeleted(w)));
      }
    } catch {
      /* ignore */
    }
  }, [authFetch]);

  useEffect(() => {
    if (!open) return;
    void loadWaitlist();
    setQuery("");
    setInviteAs("invited");
    setDraftEmails(new Set(selected.map((s) => s.email.toLowerCase())));
  }, [open, loadWaitlist, selected]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setDbResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await authFetch(`/api/contacts/search?q=${encodeURIComponent(q)}`);
        const json = (await res.json()) as { ok?: boolean; results?: DatabasePersoContact[] };
        setDbResults(json.ok && json.results ? json.results : []);
      } catch {
        setDbResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, authFetch, open]);

  const rows = useMemo(() => {
    const map = new Map<string, PickerRow>();
    const q = query.trim().toLowerCase();

    for (const w of waitlist) {
      const email = w.email.toLowerCase();
      if (!email) continue;
      if (
        q &&
        !w.fullName.toLowerCase().includes(q) &&
        !email.includes(q) &&
        !w.company.toLowerCase().includes(q)
      ) {
        continue;
      }
      map.set(email, {
        key: `wl-${w.id}`,
        email: w.email,
        fullName: w.fullName,
        company: w.company,
        contactId: w.id,
        source: "waitlist",
        badge: "Waitlist LA MESA",
        fit: fitIndex.get(email) ?? null,
      });
    }

    for (const c of dbResults) {
      const email = (c.emails[0] ?? "").toLowerCase();
      if (!email || map.has(email)) continue;
      map.set(email, {
        key: `db-${c.id}`,
        email: c.emails[0]!,
        fullName: c.fullName,
        company: c.company ?? undefined,
        contactId: c.id,
        source: "database_perso",
        fit: fitIndex.get(email) ?? null,
      });
    }

    return [...map.values()].sort((a, b) =>
      a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" }),
    );
  }, [waitlist, dbResults, query, fitIndex]);

  function toggleDraft(email: string) {
    const key = email.toLowerCase();
    setDraftEmails((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function confirmSelection() {
    const byEmail = new Map(rows.map((r) => [r.email.toLowerCase(), r]));
    // Keep existing selected that are still checked, update inviteAs
    const next: SelectedInvitee[] = [];

    for (const email of draftEmails) {
      const existing = selected.find((s) => s.email.toLowerCase() === email);
      const row = byEmail.get(email);
      if (existing) {
        next.push({ ...existing, inviteAs });
      } else if (row) {
        next.push({
          email: row.email,
          fullName: row.fullName,
          companyName: row.company,
          contactId: row.contactId,
          source: row.source,
          inviteAs,
        });
      }
    }

    // Preserve external invitees that remain checked
    for (const s of selected) {
      if (s.source !== "external") continue;
      if (!draftEmails.has(s.email.toLowerCase())) continue;
      if (next.some((n) => n.email.toLowerCase() === s.email.toLowerCase())) continue;
      next.push({ ...s, inviteAs });
    }

    onChange(next);
    setOpen(false);
  }

  function removeInvitee(email: string) {
    onChange(selected.filter((s) => s.email.toLowerCase() !== email.toLowerCase()));
  }

  function addExternal() {
    const email = externalEmail.trim().toLowerCase();
    const fullName = externalName.trim();
    if (!email.includes("@")) return;
    if (selected.some((s) => s.email.toLowerCase() === email)) return;
    onChange([
      ...selected,
      {
        email,
        fullName: fullName || undefined,
        source: "external",
        inviteAs: "invited",
      },
    ]);
    setExternalEmail("");
    setExternalName("");
  }

  return (
    <div className="space-y-4">
      <div>
        <label className={LABEL_CLASS}>{labels.search}</label>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`${INPUT_CLASS} mt-1 flex w-full cursor-pointer items-center gap-2 text-left text-ns-secondary`}
        >
          <Search className="h-4 w-4 shrink-0" />
          <span>Ouvrir la liste des contacts…</span>
        </button>
      </div>

      <div>
        <p className={LABEL_CLASS}>
          {labels.selected} ({selected.length})
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {selected.map((s) => {
            const interest = resolveInterestDisplay(s.email, interestByEmail);
            return (
              <span key={s.email} className={`inline-flex items-center gap-1 ${CHIP_ACTIVE}`}>
                {s.fullName ?? s.email}
                <span className="text-[10px] uppercase opacity-70">
                  {s.inviteAs === "waitlist" ? "attente" : "invité"}
                </span>
                {interest ? (
                  <span className="text-[10px] font-bold uppercase opacity-80">
                    {INTEREST_DISPLAY_LABELS[interest]}
                  </span>
                ) : null}
                <button type="button" onClick={() => removeInvitee(s.email)} aria-label="Remove">
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-ns-alternate bg-ns-brand-light p-3">
        <p className="mb-2 text-sm font-bold text-ns-hero">{labels.addExternal}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={externalEmail}
            onChange={(e) => setExternalEmail(e.target.value)}
            placeholder={labels.externalEmail}
            className={INPUT_CLASS}
          />
          <input
            value={externalName}
            onChange={(e) => setExternalName(e.target.value)}
            placeholder={labels.externalName}
            className={INPUT_CLASS}
          />
        </div>
        <button type="button" onClick={addExternal} className={`${CHIP} mt-2`}>
          +
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={labels.search}
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-gray-100 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-ns-hero">Choisir des contacts</h3>
                  <p className="mt-1 text-xs text-ns-secondary">
                    Filtre, sélectionne, puis choisis Invité ou Waiting List.
                  </p>
                </div>
                <button
                  type="button"
                  className="text-ns-secondary hover:text-ns-tertiary"
                  onClick={() => setOpen(false)}
                  aria-label="Fermer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="relative mt-4">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ns-secondary" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className={`${INPUT_CLASS} pl-9`}
                  placeholder="Nom, email, entreprise…"
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setInviteAs("invited")}
                  className={inviteAs === "invited" ? CHIP_ACTIVE : CHIP}
                >
                  Inviter
                </button>
                <button
                  type="button"
                  onClick={() => setInviteAs("waitlist")}
                  className={inviteAs === "waitlist" ? CHIP_ACTIVE : CHIP}
                >
                  Waiting List
                </button>
              </div>
              <p className="mt-2 text-xs text-ns-secondary">
                {inviteAs === "waitlist"
                  ? "Les contacts cochés seront ajoutés en liste d’attente."
                  : "Les contacts cochés seront ajoutés comme invités (overflow → attente)."}
              </p>
            </div>

            <ul className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
              {loading && (
                <li className="px-2 py-2 text-xs text-ns-secondary">Recherche…</li>
              )}
              {!loading && rows.length === 0 && (
                <li className="px-2 py-2 text-xs text-ns-secondary">Aucun contact trouvé.</li>
              )}
              {rows.map((row) => {
                const checked = draftEmails.has(row.email.toLowerCase());
                const interest = resolveInterestDisplay(row.email, interestByEmail);
                return (
                  <li key={row.key}>
                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 text-sm ${
                        checked ? "bg-ns-primary/15" : "hover:bg-ns-brand-light"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 accent-ns-primary"
                        checked={checked}
                        onChange={() => toggleDraft(row.email)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-ns-tertiary">{row.fullName}</span>
                        <span className="block truncate text-xs text-ns-secondary">
                          {row.email}
                          {row.company ? ` · ${row.company}` : ""}
                        </span>
                        {interest ? (
                          <span className="mt-1 flex flex-wrap items-center gap-1">
                            <InterestChip status={interest} />
                          </span>
                        ) : null}
                        <FitChips fit={row.fit} />
                        {row.badge && (
                          <span className="mt-0.5 inline-block text-[10px] font-semibold uppercase tracking-wide text-ns-secondary">
                            {row.badge}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-5 py-4">
              <p className="text-xs text-ns-secondary">{draftEmails.size} sélectionné(s)</p>
              <div className="flex gap-2">
                <button type="button" className={BTN_SECONDARY} onClick={() => setOpen(false)}>
                  Annuler
                </button>
                <button type="button" className={BTN_PRIMARY} onClick={confirmSelection}>
                  Ajouter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

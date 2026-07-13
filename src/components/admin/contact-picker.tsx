"use client";

import type { DatabasePersoContact, WaitlistRegistration } from "@/lib/types/events";
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
};

type PickerRow = {
  key: string;
  email: string;
  fullName: string;
  company?: string;
  contactId?: string;
  source: "database_perso" | "waitlist";
  badge?: string;
};

export function ContactPicker({ selected, onChange, labels }: ContactPickerProps) {
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
      });
    }

    return [...map.values()].sort((a, b) =>
      a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" }),
    );
  }, [waitlist, dbResults, query]);

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
          {selected.map((s) => (
            <span key={s.email} className={`inline-flex items-center gap-1 ${CHIP_ACTIVE}`}>
              {s.fullName ?? s.email}
              <span className="text-[10px] uppercase opacity-70">
                {s.inviteAs === "waitlist" ? "attente" : "invité"}
              </span>
              <button type="button" onClick={() => removeInvitee(s.email)} aria-label="Remove">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
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

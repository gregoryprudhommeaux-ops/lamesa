"use client";

import type { DatabasePersoContact, WaitlistRegistration } from "@/lib/types/events";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { CHIP, CHIP_ACTIVE, INPUT_CLASS, LABEL_CLASS } from "@/lib/ui/nextstep";
import { Search, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export type SelectedInvitee = {
  email: string;
  fullName?: string;
  companyName?: string;
  contactId?: string;
  source: "database_perso" | "waitlist" | "external";
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

export function ContactPicker({ selected, onChange, labels }: ContactPickerProps) {
  const authFetch = useAuthFetch();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DatabasePersoContact[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistRegistration[]>([]);
  const [loading, setLoading] = useState(false);
  const [externalEmail, setExternalEmail] = useState("");
  const [externalName, setExternalName] = useState("");

  const loadWaitlist = useCallback(async () => {
    try {
      const res = await authFetch("/api/waitlist");
      const json = (await res.json()) as { ok?: boolean; results?: WaitlistRegistration[] };
      if (json.ok && json.results) setWaitlist(json.results);
    } catch {
      /* ignore */
    }
  }, [authFetch]);

  useEffect(() => {
    void loadWaitlist();
  }, [loadWaitlist]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await authFetch(`/api/contacts/search?q=${encodeURIComponent(q)}`);
        const json = (await res.json()) as { ok?: boolean; results?: DatabasePersoContact[] };
        setResults(json.ok && json.results ? json.results : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, authFetch]);

  const filteredWaitlist = waitlist.filter((w) => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return false;
    return (
      w.fullName.toLowerCase().includes(q) ||
      w.email.toLowerCase().includes(q) ||
      w.company.toLowerCase().includes(q)
    );
  });

  function isSelected(email: string) {
    return selected.some((s) => s.email.toLowerCase() === email.toLowerCase());
  }

  function toggleDbContact(c: DatabasePersoContact) {
    const email = c.emails[0];
    if (!email) return;
    if (isSelected(email)) {
      onChange(selected.filter((s) => s.email.toLowerCase() !== email.toLowerCase()));
    } else {
      onChange([
        ...selected,
        {
          email,
          fullName: c.fullName,
          companyName: c.company ?? undefined,
          contactId: c.id,
          source: "database_perso",
        },
      ]);
    }
  }

  function toggleWaitlist(w: WaitlistRegistration) {
    if (isSelected(w.email)) {
      onChange(selected.filter((s) => s.email.toLowerCase() !== w.email.toLowerCase()));
    } else {
      onChange([
        ...selected,
        {
          email: w.email,
          fullName: w.fullName,
          companyName: w.company,
          contactId: w.id,
          source: "waitlist",
        },
      ]);
    }
  }

  function removeInvitee(email: string) {
    onChange(selected.filter((s) => s.email.toLowerCase() !== email.toLowerCase()));
  }

  function addExternal() {
    const email = externalEmail.trim().toLowerCase();
    const fullName = externalName.trim();
    if (!email.includes("@") || isSelected(email)) return;
    onChange([
      ...selected,
      { email, fullName: fullName || undefined, source: "external" },
    ]);
    setExternalEmail("");
    setExternalName("");
  }

  return (
    <div className="space-y-4">
      <div>
        <label className={LABEL_CLASS}>{labels.search}</label>
        <div className="relative mt-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ns-secondary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={`${INPUT_CLASS} pl-9`}
            placeholder="Nom, email, entreprise…"
          />
        </div>
        {loading && <p className="mt-1 text-xs text-ns-secondary">…</p>}
        {(results.length > 0 || filteredWaitlist.length > 0) && (
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-ns-alternate bg-ns-brand-light p-2">
            {filteredWaitlist.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  onClick={() => toggleWaitlist(w)}
                  className={`w-full rounded px-2 py-1.5 text-left text-sm ${isSelected(w.email) ? "bg-ns-primary/20 font-semibold" : "hover:bg-white"}`}
                >
                  {w.fullName} · {w.company} <span className="text-xs text-ns-secondary">(waitlist)</span>
                </button>
              </li>
            ))}
            {results.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => toggleDbContact(c)}
                  className={`w-full rounded px-2 py-1.5 text-left text-sm ${c.emails[0] && isSelected(c.emails[0]) ? "bg-ns-primary/20 font-semibold" : "hover:bg-white"}`}
                >
                  {c.fullName}
                  {c.company ? ` · ${c.company}` : ""}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className={LABEL_CLASS}>
          {labels.selected} ({selected.length})
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {selected.map((s) => (
            <span key={s.email} className={`inline-flex items-center gap-1 ${CHIP_ACTIVE}`}>
              {s.fullName ?? s.email}
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
    </div>
  );
}

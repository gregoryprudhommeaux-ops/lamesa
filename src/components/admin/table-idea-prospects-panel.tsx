"use client";

import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { tableThemeProspectListName } from "@/lib/admin/table-theme-prospect-list";
import type { Prospect } from "@/lib/types/prospects";
import type { WaitlistRegistration } from "@/lib/types/events";
import { BTN_PRIMARY, BTN_SECONDARY, ERROR_TEXT, INPUT_CLASS, LABEL_CLASS } from "@/lib/ui/nextstep";
import { isSoftDeleted } from "@/lib/member/soft-delete";
import { FileUp, Search, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Props = {
  theme?: string;
  title?: string;
  city: string;
  /** Controlled list name from draft (if any). */
  listName?: string | null;
  onListNameChange: (name: string) => void;
  /** Emails already seated as titulaires/remplaçants — skip promote noise. */
  seatedEmails: Set<string>;
  onPromoteMember: (member: {
    id: string;
    fullName: string;
    email: string;
    company: string;
    sector: string;
    position: string;
    city: string;
  }) => void;
};

type AddMode = "closed" | "csv" | "search" | "manual";

export function TableIdeaProspectsPanel({
  theme,
  title,
  city,
  listName: controlledListName,
  onListNameChange,
  seatedEmails,
  onPromoteMember,
}: Props) {
  const authFetch = useAuthFetch();
  const defaultListName = useMemo(
    () => tableThemeProspectListName({ theme, title, city }),
    [theme, title, city],
  );
  const listName = (controlledListName?.trim() || defaultListName).slice(0, 60);

  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>("closed");

  const [csvText, setCsvText] = useState("");
  const [memberQuery, setMemberQuery] = useState("");
  const [waitlist, setWaitlist] = useState<WaitlistRegistration[]>([]);
  const [manual, setManual] = useState({
    email: "",
    fullName: "",
    company: "",
    notes: "",
  });

  const ensureListName = useCallback(() => {
    onListNameChange(listName);
    return listName;
  }, [listName, onListNameChange]);

  const loadProspects = useCallback(async () => {
    const name = ensureListName();
    setLoadState("loading");
    setError(null);
    try {
      const res = await authFetch(
        `/api/admin/prospects?list=${encodeURIComponent(name)}`,
      );
      const json = (await res.json()) as {
        ok?: boolean;
        prospects?: Prospect[];
        error?: string;
      };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "load_failed");
      setProspects(json.prospects ?? []);
      setLoadState("idle");
    } catch (e) {
      setLoadState("error");
      setError(e instanceof Error ? e.message : "load_failed");
    }
  }, [authFetch, ensureListName]);

  useEffect(() => {
    void loadProspects();
  }, [loadProspects]);

  useEffect(() => {
    if (addMode !== "search") return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await authFetch("/api/waitlist");
        const json = (await res.json()) as {
          ok?: boolean;
          results?: WaitlistRegistration[];
        };
        if (cancelled) return;
        const rows = json.results ?? [];
        setWaitlist(rows.filter((r) => !isSoftDeleted(r)));
      } catch {
        if (!cancelled) setWaitlist([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [addMode, authFetch]);

  const memberHits = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return waitlist
      .filter((m) => {
        const hay = `${m.fullName} ${m.email} ${m.company} ${m.sector}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 12);
  }, [memberQuery, waitlist]);

  async function importCsv() {
    const name = ensureListName();
    if (!csvText.trim()) {
      setError("Colle un CSV (email obligatoire).");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await authFetch("/api/admin/prospects", {
        method: "POST",
        body: JSON.stringify({ action: "import", text: csvText, list: name }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        created?: number;
        merged?: number;
        failed?: number;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.detail ?? json.error ?? "import_failed");
      }
      setMessage(
        `Import : ${json.created ?? 0} créés · ${json.merged ?? 0} fusionnés${
          json.failed ? ` · ${json.failed} échecs` : ""
        }`,
      );
      setCsvText("");
      setAddMode("closed");
      await loadProspects();
    } catch (e) {
      setError(e instanceof Error ? e.message : "import_failed");
    } finally {
      setBusy(false);
    }
  }

  async function addManual() {
    const name = ensureListName();
    const email = manual.email.trim();
    if (!email.includes("@")) {
      setError("Email requis.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await authFetch("/api/admin/prospects", {
        method: "POST",
        body: JSON.stringify({
          email,
          fullName: manual.fullName.trim() || undefined,
          company: manual.company.trim() || undefined,
          notes: manual.notes.trim() || undefined,
          lists: [name],
          status: "to_contact",
          source: "table-theme-manual",
          city: city || undefined,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "create_failed");
      setManual({ email: "", fullName: "", company: "", notes: "" });
      setAddMode("closed");
      setMessage("Prospect ajouté à la liste.");
      await loadProspects();
    } catch (e) {
      setError(e instanceof Error ? e.message : "create_failed");
    } finally {
      setBusy(false);
    }
  }

  async function addMemberAsProspect(member: WaitlistRegistration) {
    const name = ensureListName();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await authFetch("/api/admin/prospects", {
        method: "POST",
        body: JSON.stringify({
          email: member.email,
          fullName: member.fullName,
          company: member.company,
          position: member.position,
          sector: member.sector,
          city: member.city,
          linkedin: member.linkedinUrl,
          phone: member.phone,
          notes: "Ajouté depuis Idées Tables (connaissance ops / fit personnel).",
          lists: [name],
          status: "to_contact",
          source: "table-theme-mesa-member",
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "create_failed");
      setMessage(`${member.fullName} ajouté aux prospects du thème.`);
      await loadProspects();
    } catch (e) {
      setError(e instanceof Error ? e.message : "create_failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeFromList(prospect: Prospect) {
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch("/api/admin/prospects", {
        method: "POST",
        body: JSON.stringify({
          action: "bulk",
          ids: [prospect.id],
          removeLists: [listName],
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "remove_failed");
      await loadProspects();
    } catch (e) {
      setError(e instanceof Error ? e.message : "remove_failed");
    } finally {
      setBusy(false);
    }
  }

  const comsHref = `/admin/templates?prospectList=${encodeURIComponent(listName)}`;
  const personnesHref = `/admin/personnes?tab=prospects&list=${encodeURIComponent(listName)}`;

  return (
    <div className="rounded-2xl border border-gray-100 bg-ns-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-bold uppercase tracking-wide text-ns-secondary">
            Prospects ({prospects.length})
          </h4>
          <p className="mt-1 text-sm text-ns-tertiary">
            Sourcer pour combler le gap thème — CSV Perso, membre Mesa (fit que tu connais), ou
            saisie manuelle. Cette liste alimente ensuite une campagne mail.
          </p>
          <p className="mt-1 truncate text-xs text-ns-secondary" title={listName}>
            Liste CRM · {listName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={BTN_SECONDARY}
            disabled={busy}
            onClick={() => setAddMode(addMode === "csv" ? "closed" : "csv")}
          >
            <FileUp className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />
            CSV
          </button>
          <button
            type="button"
            className={BTN_SECONDARY}
            disabled={busy}
            onClick={() => setAddMode(addMode === "search" ? "closed" : "search")}
          >
            <Search className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />
            Mesa
          </button>
          <button
            type="button"
            className={BTN_SECONDARY}
            disabled={busy}
            onClick={() => setAddMode(addMode === "manual" ? "closed" : "manual")}
          >
            <UserPlus className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />
            Manuel
          </button>
        </div>
      </div>

      {addMode === "csv" ? (
        <div className="mt-3 space-y-2 rounded-xl border border-gray-100 bg-white p-3">
          <label className={LABEL_CLASS} htmlFor="table-prospects-csv">
            Coller un CSV Perso (colonne email obligatoire)
          </label>
          <textarea
            id="table-prospects-csv"
            className={`${INPUT_CLASS} min-h-[120px] font-mono text-xs`}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={"email,fullName,company,position,sector,city\nfoo@bar.com,Ada,…"}
          />
          <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={() => void importCsv()}>
            Importer dans la liste
          </button>
        </div>
      ) : null}

      {addMode === "search" ? (
        <div className="mt-3 space-y-2 rounded-xl border border-gray-100 bg-white p-3">
          <label className={LABEL_CLASS} htmlFor="table-prospects-search">
            Chercher un membre Mesa (fit perso non encore dans le profil)
          </label>
          <input
            id="table-prospects-search"
            className={INPUT_CLASS}
            value={memberQuery}
            onChange={(e) => setMemberQuery(e.target.value)}
            placeholder="Nom, email, entreprise…"
          />
          <ul className="max-h-48 space-y-1 overflow-y-auto">
            {memberHits.map((m) => {
              const seated = seatedEmails.has(m.email.trim().toLowerCase());
              return (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-gray-50 px-2 py-1.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ns-tertiary">{m.fullName}</p>
                    <p className="truncate text-xs text-ns-secondary">
                      {m.email} · {m.company || "—"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      className={BTN_SECONDARY}
                      disabled={busy}
                      onClick={() => void addMemberAsProspect(m)}
                    >
                      → Prospects
                    </button>
                    {!seated ? (
                      <button
                        type="button"
                        className={BTN_PRIMARY}
                        disabled={busy}
                        onClick={() =>
                          onPromoteMember({
                            id: m.id,
                            fullName: m.fullName,
                            email: m.email,
                            company: m.company ?? "",
                            sector: m.sector ?? "",
                            position: m.position ?? "",
                            city: m.city ?? "",
                          })
                        }
                      >
                        → Titulaire
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {addMode === "manual" ? (
        <div className="mt-3 grid gap-2 rounded-xl border border-gray-100 bg-white p-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={LABEL_CLASS} htmlFor="tp-email">
              Email *
            </label>
            <input
              id="tp-email"
              className={INPUT_CLASS}
              value={manual.email}
              onChange={(e) => setManual((s) => ({ ...s, email: e.target.value }))}
            />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="tp-name">
              Nom
            </label>
            <input
              id="tp-name"
              className={INPUT_CLASS}
              value={manual.fullName}
              onChange={(e) => setManual((s) => ({ ...s, fullName: e.target.value }))}
            />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="tp-company">
              Entreprise
            </label>
            <input
              id="tp-company"
              className={INPUT_CLASS}
              value={manual.company}
              onChange={(e) => setManual((s) => ({ ...s, company: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL_CLASS} htmlFor="tp-notes">
              Note ops (fit que tu connais)
            </label>
            <input
              id="tp-notes"
              className={INPUT_CLASS}
              value={manual.notes}
              onChange={(e) => setManual((s) => ({ ...s, notes: e.target.value }))}
              placeholder="Ex. PE / FO via intro Juan — pas encore sur le profil"
            />
          </div>
          <div className="sm:col-span-2">
            <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={() => void addManual()}>
              Ajouter le prospect
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className={`mt-3 ${ERROR_TEXT}`}>{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-emerald-800">{message}</p> : null}

      {loadState === "loading" ? (
        <p className="mt-3 text-sm text-ns-secondary">Chargement des prospects…</p>
      ) : prospects.length === 0 ? (
        <p className="mt-3 text-sm text-ns-secondary">
          Aucun prospect sur cette liste. Importe un CSV Perso ou ajoute un contact pour lancer le
          sourcing.
        </p>
      ) : (
        <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
          {prospects.map((p) => {
            const seated = seatedEmails.has(p.email.trim().toLowerCase());
            return (
              <li
                key={p.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-gray-50 bg-white p-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ns-tertiary">
                    {p.fullName || p.email}
                  </p>
                  <p className="truncate text-xs text-ns-secondary">
                    {[p.email, p.company, p.position, p.city].filter(Boolean).join(" · ")}
                  </p>
                  {p.notes ? (
                    <p className="mt-1 line-clamp-2 text-xs text-ns-secondary">{p.notes}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  {!seated ? (
                    <button
                      type="button"
                      title="Si déjà membre Mesa, tu pourras le placer en titulaire via recherche Mesa"
                      className="rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ns-secondary"
                      disabled
                    >
                      À approcher
                    </button>
                  ) : (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-900">
                      Déjà Mesa
                    </span>
                  )}
                  <button
                    type="button"
                    className="rounded-full p-1.5 text-ns-secondary transition hover:bg-red-50 hover:text-red-700"
                    title="Retirer de la liste"
                    aria-label={`Retirer ${p.fullName || p.email}`}
                    disabled={busy}
                    onClick={() => void removeFromList(p)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
        <Link href={comsHref} className={BTN_PRIMARY}>
          Créer / ouvrir campagne mail (cette liste)
        </Link>
        <Link href={personnesHref} className={BTN_SECONDARY}>
          Ouvrir dans Personnes
        </Link>
      </div>
    </div>
  );
}

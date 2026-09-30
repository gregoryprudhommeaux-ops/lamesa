"use client";

import { AdminContactFiche } from "@/components/admin/admin-contact-fiche";
import { AdminProspectsPanel } from "@/components/admin/admin-prospects";
import { AdminRegistrantsPanel } from "@/components/admin/admin-registrants";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export type PersonnesTabId = "membres" | "prospects" | "memoire";

const TABS: Array<{ id: PersonnesTabId; label: string; summary: string }> = [
  {
    id: "membres",
    label: "Membres",
    summary: "Waitlist, profils, nurture",
  },
  {
    id: "prospects",
    label: "Prospects",
    summary: "Listes, import, blasts",
  },
  {
    id: "memoire",
    label: "Mémoire",
    summary: "Fiche unifiée par email",
  },
];

function parseTab(raw: string | null): PersonnesTabId {
  if (raw === "prospects" || raw === "memoire" || raw === "membres") return raw;
  return "membres";
}

/**
 * Single Personnes hub — Membres / Prospects / Mémoire as tabs (Jack IA).
 */
export function AdminPersonnesWorkspace() {
  const router = useRouter();
  const pathname = usePathname() ?? "/admin/personnes";
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));
  const email = (searchParams.get("email") ?? "").trim();

  const setTab = useCallback(
    (next: PersonnesTabId) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", next);
      if (next !== "memoire") {
        params.delete("email");
      }
      // Drop membres-only filters when leaving membres
      if (next !== "membres") {
        params.delete("id");
        params.delete("profile");
        params.delete("source");
        params.delete("queue");
      }
      if (next !== "prospects") {
        params.delete("list");
      }
      router.replace(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-ns-hero">Personnes</h2>
        <p className="mt-1 text-sm text-ns-secondary">
          Un seul endroit pour la waitlist, les listes prospects et la mémoire contact.
        </p>
      </div>

      <nav
        aria-label="Sections Personnes"
        className="flex flex-wrap gap-1.5 border-b border-gray-100 pb-2"
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              title={t.summary}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                active
                  ? "bg-ns-primary text-ns-tertiary"
                  : "border border-ns-alternate bg-white text-ns-secondary hover:border-ns-primary hover:text-ns-tertiary"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      {tab === "membres" ? <AdminRegistrantsPanel title="Membres" /> : null}

      {tab === "prospects" ? <AdminProspectsPanel /> : null}

      {tab === "memoire" ? (
        email.includes("@") ? (
          <AdminContactFiche email={email} />
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-ns-surface/60 p-6">
            <p className="text-sm font-semibold text-ns-tertiary">Mémoire contact</p>
            <p className="mt-2 text-sm text-ns-secondary">
              Ouvre une fiche depuis Membres ou Prospects (lien Mémoire), ou passe un{" "}
              <code className="text-xs">?email=</code> dans l’URL.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="text-xs font-semibold text-ns-primary hover:underline"
                onClick={() => setTab("membres")}
              >
                Aller aux Membres →
              </button>
              <button
                type="button"
                className="text-xs font-semibold text-ns-primary hover:underline"
                onClick={() => setTab("prospects")}
              >
                Aller aux Prospects →
              </button>
              <Link
                href="/admin/dashboard"
                className="text-xs font-semibold text-ns-secondary hover:underline"
              >
                Retour Dashboard
              </Link>
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}

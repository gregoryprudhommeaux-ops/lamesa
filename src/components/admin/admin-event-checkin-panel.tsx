"use client";

import { useAuthFetch } from "@/hooks/use-auth-fetch";
import {
  countCheckin,
  filterCheckinRows,
  isCheckedIn,
  type CheckinFilterId,
} from "@/lib/events/checkin";
import type { AdminEventParticipation } from "@/lib/types/events";
import { BTN_PRIMARY, BTN_SECONDARY, ERROR_TEXT } from "@/lib/ui/nextstep";
import { Check, MessageCircle, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

type AdminEventCheckinPanelProps = {
  participations: AdminEventParticipation[];
  onWhatsApp?: (p: AdminEventParticipation) => void;
  onUpdated?: () => void;
};

/**
 * Soir J — marque les places retenues (Payé + Invité) présentes à la porte.
 * Ne touche pas au statut de paiement (`confirmed` / `comped`).
 */
export function AdminEventCheckinPanel({
  participations,
  onWhatsApp,
  onUpdated,
}: AdminEventCheckinPanelProps) {
  const authFetch = useAuthFetch();
  const [filter, setFilter] = useState<CheckinFilterId>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const counts = useMemo(() => countCheckin(participations), [participations]);
  const visible = useMemo(
    () => filterCheckinRows(participations, filter),
    [participations, filter],
  );

  const filters: Array<{ id: CheckinFilterId; label: string; count: number }> = [
    { id: "pending", label: "À arriver", count: counts.pending },
    { id: "present", label: "Présents", count: counts.present },
    { id: "all", label: "Tous (places)", count: counts.paid },
  ];

  async function setCheckedIn(p: AdminEventParticipation, next: boolean) {
    setBusyId(p.id);
    setError(null);
    setMessage(null);
    try {
      const res = await authFetch(`/api/admin/participations/${p.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          checkedInAt: next ? new Date().toISOString() : null,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "save_failed");
      setMessage(
        next
          ? `${p.fullName || p.email} — présent·e`
          : `${p.fullName || p.email} — check-in annulé`,
      );
      onUpdated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-ns-alternate bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold uppercase tracking-wide text-ns-hero">
            Check-in · soir J
          </h4>
          <p className="mt-1 text-xs text-ns-secondary">
            Places payées uniquement. Un tap = présent à la porte — le statut de paiement
            ne change pas.
          </p>
          <p className="mt-1 text-xs font-semibold text-ns-tertiary">
            {counts.present}/{counts.paid} présents
            {counts.pending > 0 ? ` · ${counts.pending} à arriver` : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              filter === f.id
                ? "bg-ns-primary text-ns-tertiary"
                : "border border-ns-alternate bg-ns-brand-light/40 text-ns-secondary hover:border-ns-primary"
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {error ? <p className={ERROR_TEXT}>{error}</p> : null}
      {message ? <p className="text-sm font-medium text-ns-primary">{message}</p> : null}

      {counts.paid === 0 ? (
        <p className="text-sm text-ns-secondary">
          Aucune place retenue — le check-in s’active pour les statuts Payé et Invité.
        </p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-ns-secondary">
          {filter === "pending"
            ? "Tout le monde est arrivé."
            : filter === "present"
              ? "Personne n’a encore été coché présent."
              : "Aucun membre dans ce filtre."}
        </p>
      ) : (
        <ul className="max-h-[28rem] space-y-2 overflow-y-auto">
          {visible.map((p) => {
            const present = isCheckedIn(p);
            const busy = busyId === p.id;
            return (
              <li
                key={p.id}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm ${
                  present
                    ? "border-emerald-200 bg-emerald-50/70"
                    : "border-ns-alternate bg-white"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-ns-tertiary">
                    {p.fullName ?? p.email}
                    {p.companyName ? (
                      <span className="font-normal text-ns-secondary"> · {p.companyName}</span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-ns-secondary">
                    {p.email}
                    {present && p.checkedInAt
                      ? ` · check-in ${new Date(p.checkedInAt).toLocaleTimeString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "America/Mexico_City",
                        })}`
                      : p.status === "comped"
                        ? " · Invité"
                        : " · Payé"}
                  </span>
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {onWhatsApp ? (
                    <button
                      type="button"
                      className="inline-flex h-8 items-center justify-center gap-1 rounded border border-ns-alternate bg-ns-surface px-2 text-ns-tertiary transition hover:border-ns-primary hover:bg-ns-brand-light"
                      onClick={() => onWhatsApp(p)}
                      title="WhatsApp"
                      aria-label="WhatsApp"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                  {present ? (
                    <button
                      type="button"
                      className={`${BTN_SECONDARY} inline-flex items-center gap-1 text-xs`}
                      disabled={busy}
                      onClick={() => void setCheckedIn(p, false)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {busy ? "…" : "Annuler"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={`${BTN_PRIMARY} inline-flex items-center gap-1 text-xs`}
                      disabled={busy}
                      onClick={() => void setCheckedIn(p, true)}
                    >
                      <Check className="h-3.5 w-3.5" />
                      {busy ? "…" : "Présent"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

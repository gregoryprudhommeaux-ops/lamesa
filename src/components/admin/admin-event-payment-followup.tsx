"use client";

import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { resolveGuestJourneyStage } from "@/lib/admin/guest-journey";
import {
  defaultPaymentFilter,
  inviteMemberStatusToParticipation,
  toInviteMemberStatus,
  type InviteMemberStatus,
} from "@/lib/admin/payment-followup";
import { isOrganizerParticipation } from "@/lib/events/capacity";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import type { AdminEvent, AdminEventParticipation, EventParticipationStatus } from "@/lib/types/events";
import { BTN_PRIMARY, BTN_SECONDARY, ERROR_TEXT } from "@/lib/ui/nextstep";
import { Check, Mail, MessageCircle } from "lucide-react";
import { useMemo, useState } from "react";

export type { InviteMemberStatus };

type AdminEventPaymentFollowupPanelProps = {
  event: AdminEvent;
  participations: AdminEventParticipation[];
  onStatusChange: (id: string, status: EventParticipationStatus) => void;
  onWhatsApp?: (p: AdminEventParticipation) => void;
  onUpdated?: () => void;
};

function formatDeadline(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      timeZone: "America/Mexico_City",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

/**
 * Membres après invitation formelle — Confirmation & paiement.
 * Relance email = uniquement « À relancer » (pas les virements déjà déclarés).
 */
export function AdminEventPaymentFollowupPanel({
  event,
  participations,
  onStatusChange,
  onWhatsApp,
  onUpdated,
}: AdminEventPaymentFollowupPanelProps) {
  const authFetch = useAuthFetch();
  /** null = follow smart default (declared if any, else relance). */
  const [filterOverride, setFilterOverride] = useState<InviteMemberStatus | "all" | null>(
    null,
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => {
    return participations
      .filter((p) => !isOrganizerParticipation(p))
      .filter((p) => {
        const status = normalizeParticipationStatus(p.status);
        if (p.calendarInviteSentAt) return true;
        return (
          status === "invited" ||
          status === "attending" ||
          status === "confirmed" ||
          status === "comped" ||
          status === "waitlist" ||
          status === "not_attending"
        );
      })
      .sort((a, b) => {
        const order: Record<InviteMemberStatus, number> = {
          declared: 0,
          relance: 1,
          paid: 2,
          comped: 3,
          out: 4,
        };
        const d = order[toInviteMemberStatus(a)] - order[toInviteMemberStatus(b)];
        if (d !== 0) return d;
        return (a.fullName || a.email).localeCompare(b.fullName || b.email, "fr");
      });
  }, [participations]);

  const counts = useMemo(() => {
    let declared = 0;
    let relance = 0;
    let paid = 0;
    let comped = 0;
    let out = 0;
    for (const p of rows) {
      const s = toInviteMemberStatus(p);
      if (s === "declared") declared += 1;
      else if (s === "relance") relance += 1;
      else if (s === "paid") paid += 1;
      else if (s === "comped") comped += 1;
      else out += 1;
    }
    return { all: rows.length, declared, relance, paid, comped, out };
  }, [rows]);

  const filter = filterOverride ?? defaultPaymentFilter(counts);

  const visible = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((p) => toInviteMemberStatus(p) === filter);
  }, [rows, filter]);

  /** Email targets = unpaid without declaration (non-intrusive). */
  const relanceTargets = useMemo(
    () => rows.filter((p) => toInviteMemberStatus(p) === "relance"),
    [rows],
  );

  const declaredTargets = useMemo(
    () => rows.filter((p) => toInviteMemberStatus(p) === "declared"),
    [rows],
  );

  const selectedRelanceEmails = useMemo(() => {
    const selectedRelance = relanceTargets.filter((p) => selected.has(p.id));
    if (selectedRelance.length > 0) return selectedRelance.map((p) => p.email);
    return relanceTargets.map((p) => p.email);
  }, [relanceTargets, selected]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function confirmPaid(ids: string[]) {
    for (const id of ids) {
      onStatusChange(id, "confirmed");
    }
  }

  async function sendPaymentRelance() {
    const emails = selectedRelanceEmails;
    if (emails.length === 0) {
      setError("Personne en statut « À relancer » (hors virements déclarés).");
      return;
    }
    const scope =
      selected.size > 0 && relanceTargets.some((p) => selected.has(p.id))
        ? `${emails.length} sélectionné(s)`
        : `tous les « À relancer » (${emails.length})`;
    if (!window.confirm(`Envoyer l’email de relance paiement à ${scope} ?`)) return;

    setSending(true);
    setMessage(null);
    setError(null);
    try {
      const res = await authFetch(`/api/admin/events/${event.id}/send-payment-relance`, {
        method: "POST",
        body: JSON.stringify({ emails }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        sent?: number;
        failed?: number;
        skipped?: number;
        alreadySent?: number;
        declared?: number;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.detail || json.error || "send_failed");
      }
      setMessage(
        `Relance paiement envoyée : ${json.sent ?? 0}` +
          (json.alreadySent ? ` · déjà relancés ${json.alreadySent}` : "") +
          (json.declared ? ` · déclarés ignorés ${json.declared}` : "") +
          (json.failed ? ` · échecs ${json.failed}` : "") +
          (json.skipped ? ` · ignorés ${json.skipped}` : ""),
      );
      setSelected(new Set());
      onUpdated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  const deadlineLabel = formatDeadline(event.paymentDeadlineAt);
  const filters: Array<{ id: InviteMemberStatus | "all"; label: string; count: number }> = [
    { id: "all", label: "Tous", count: counts.all },
    { id: "declared", label: "Virement déclaré", count: counts.declared },
    { id: "relance", label: "À relancer", count: counts.relance },
    { id: "paid", label: "Payé", count: counts.paid },
    { id: "comped", label: "Invité", count: counts.comped },
    { id: "out", label: "Ne viendra pas", count: counts.out },
  ];

  return (
    <section className="space-y-3 rounded-xl border border-ns-alternate bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold uppercase tracking-wide text-ns-hero">
            Confirmation & paiement
          </h4>
          <p className="mt-1 text-xs text-ns-secondary">
            <strong>Virement déclaré</strong> (signal membre — à vérifier en banque),{" "}
            <strong>À relancer</strong>, <strong>Payé</strong> (CA),{" "}
            <strong>Invité</strong> (COST), <strong>Ne viendra pas</strong>. Pas de
            paiement en ligne. Relance email uniquement aux « À relancer » — les
            déclarés et déjà relancés sont exclus.
          </p>
          {deadlineLabel ? (
            <p className="mt-1 text-xs text-ns-secondary">
              Date butoir règlement : <strong>{deadlineLabel}</strong>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {counts.declared > 0 ? (
            <button
              type="button"
              className={`${BTN_PRIMARY} inline-flex items-center gap-2`}
              onClick={() => {
                if (
                  !window.confirm(
                    `Marquer Payé les ${counts.declared} virement(s) déclaré(s) ?`,
                  )
                ) {
                  return;
                }
                confirmPaid(declaredTargets.map((p) => p.id));
              }}
              title="Après vérif banque — passe en Payé (CA)"
            >
              <Check className="h-4 w-4" />
              Confirmer déclarés ({counts.declared})
            </button>
          ) : null}
          <button
            type="button"
            className={`${BTN_SECONDARY} inline-flex items-center gap-2`}
            disabled={sending || counts.relance === 0}
            onClick={() => void sendPaymentRelance()}
            title="Envoie le template « Relance paiement ACCESS »"
          >
            <Mail className="h-4 w-4" />
            {sending
              ? "Envoi…"
              : `Email relance (${
                  selected.size > 0 && relanceTargets.some((p) => selected.has(p.id))
                    ? selectedRelanceEmails.length
                    : counts.relance
                })`}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {filters.map((f) => {
          if (f.id !== "all" && f.count === 0) return null;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilterOverride(f.id)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                filter === f.id
                  ? "bg-ns-primary text-ns-tertiary"
                  : "border border-ns-alternate bg-ns-brand-light/40 text-ns-secondary hover:border-ns-primary"
              }`}
            >
              {f.label} ({f.count})
            </button>
          );
        })}
        {filter === "relance" && counts.relance > 0 ? (
          <button
            type="button"
            className={`${BTN_SECONDARY} text-[11px]`}
            onClick={() => setSelected(new Set(relanceTargets.map((p) => p.id)))}
          >
            Tout cocher (à relancer)
          </button>
        ) : null}
      </div>

      {error && <p className={ERROR_TEXT}>{error}</p>}
      {message && <p className="text-sm font-medium text-ns-primary">{message}</p>}

      {visible.length === 0 ? (
        <p className="text-sm text-ns-secondary">
          {rows.length === 0
            ? "Personne n’a encore reçu l’invitation formelle — envoie-la en phase Invitation."
            : "Aucun membre dans ce filtre."}
        </p>
      ) : (
        <ul className="max-h-96 space-y-2 overflow-y-auto">
          {visible.map((p) => {
            const memberStatus = toInviteMemberStatus(p);
            const journey = resolveGuestJourneyStage(p);
            const showCheck = memberStatus === "relance";
            return (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ns-alternate px-3 py-2 text-sm"
              >
                <span className="flex min-w-0 flex-1 items-start gap-2">
                  {showCheck ? (
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-ns-primary"
                      checked={selected.has(p.id)}
                      onChange={() => toggle(p.id)}
                      aria-label={`Sélectionner ${p.fullName ?? p.email}`}
                    />
                  ) : (
                    <span className="mt-1 w-4" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-ns-tertiary">
                      {p.fullName ?? p.email}
                      {p.companyName ? (
                        <span className="font-normal text-ns-secondary"> · {p.companyName}</span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-[11px] font-medium text-ns-primary">
                      {journey.label}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-ns-secondary">
                      {p.email}
                      {p.paymentDeclaredAt
                        ? ` · déclaré ${new Date(p.paymentDeclaredAt).toLocaleDateString("fr-FR")}`
                        : ""}
                      {p.paymentRelanceSentAt
                        ? ` · relance ${new Date(p.paymentRelanceSentAt).toLocaleDateString("fr-FR")}`
                        : ""}
                      {p.confirmationEmailSentAt ? " · conf. payé envoyée" : ""}
                    </span>
                  </span>
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {onWhatsApp ? (
                    <button
                      type="button"
                      className="inline-flex h-7 items-center justify-center gap-1 rounded border border-ns-alternate bg-ns-surface px-1.5 text-ns-tertiary transition hover:border-ns-primary hover:bg-ns-brand-light"
                      onClick={() => onWhatsApp(p)}
                      title="WhatsApp"
                      aria-label="WhatsApp"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                  {memberStatus === "declared" ? (
                    <button
                      type="button"
                      className={`${BTN_PRIMARY} inline-flex h-7 items-center gap-1 px-2 text-[11px]`}
                      onClick={() => confirmPaid([p.id])}
                      title="Après vérif banque"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Confirmer payé
                    </button>
                  ) : null}
                  <select
                    value={memberStatus}
                    onChange={(e) => {
                      const next = e.target.value as InviteMemberStatus;
                      if (next === "declared") return;
                      onStatusChange(p.id, inviteMemberStatusToParticipation(next));
                    }}
                    className="rounded border border-ns-alternate px-2 py-1 text-xs font-semibold"
                    aria-label={`Statut ${p.fullName ?? p.email}`}
                  >
                    {memberStatus === "declared" ? (
                      <option value="declared">Virement déclaré</option>
                    ) : null}
                    <option value="relance">À relancer</option>
                    <option value="paid">Payé</option>
                    <option value="comped">Invité</option>
                    <option value="out">Ne viendra pas</option>
                  </select>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

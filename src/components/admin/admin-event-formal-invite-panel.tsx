"use client";

import { useAuthFetch } from "@/hooks/use-auth-fetch";
import type { AdminEvent } from "@/lib/types/events";
import { BTN_PRIMARY, BTN_SECONDARY, ERROR_TEXT } from "@/lib/ui/nextstep";
import { useCallback, useEffect, useMemo, useState } from "react";

export type FormalInviteRecipient = {
  email: string;
  fullName: string;
  company: string;
  phone: string;
  source: "respondent" | "prospect" | "both";
  participationId: string | null;
  participationStatus: string | null;
  calendarInviteSentAt: string | null;
  confirmationEmailSentAt: string | null;
};

type FormalInviteOuiPanelProps = {
  event: AdminEvent;
  onEventUpdated?: () => void;
};

export function FormalInviteOuiPanel({ event, onEventUpdated }: FormalInviteOuiPanelProps) {
  const authFetch = useAuthFetch();
  const [ouiRecipients, setOuiRecipients] = useState<FormalInviteRecipient[]>([]);
  const [ouiLoading, setOuiLoading] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadOui = useCallback(async () => {
    setOuiLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/admin/events/${event.id}/send-formal-invites`);
      const json = (await res.json()) as {
        ok?: boolean;
        recipients?: FormalInviteRecipient[];
        error?: string;
      };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "load_failed");
      const list = json.recipients ?? [];
      setOuiRecipients(list);
      setSelectedEmails(
        new Set(list.filter((r) => !r.calendarInviteSentAt).map((r) => r.email)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOuiLoading(false);
    }
  }, [authFetch, event.id]);

  useEffect(() => {
    void loadOui();
  }, [loadOui]);

  const stats = useMemo(() => {
    const ouiCount = ouiRecipients.length;
    const ouiPending = ouiRecipients.filter((r) => !r.calendarInviteSentAt).length;
    const ouiSent = ouiRecipients.filter((r) => Boolean(r.calendarInviteSentAt)).length;
    return { ouiCount, ouiPending, ouiSent };
  }, [ouiRecipients]);

  function toggleEmail(email: string) {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  async function sendFormalInvites() {
    const emails = [...selectedEmails];
    if (emails.length === 0) {
      setError("Sélectionne au moins un OUI.");
      return;
    }
    if (
      !window.confirm(
        `Envoyer l’invitation formelle (détails + paiement) à ${emails.length} personne(s) ?`,
      )
    ) {
      return;
    }
    setSending(true);
    setMessage(null);
    setError(null);
    try {
      const res = await authFetch(`/api/admin/events/${event.id}/send-formal-invites`, {
        method: "POST",
        body: JSON.stringify({ emails, resend: false }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        sent?: number;
        failed?: number;
        skipped?: number;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.detail || json.error || "send_failed");
      }
      setMessage(
        `Invitation formelle envoyée : ${json.sent ?? 0} · ignorés ${json.skipped ?? 0}` +
          (json.failed ? ` · échecs ${json.failed}` : ""),
      );
      await loadOui();
      onEventUpdated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-ns-tertiary">Destinataires OUI</p>
          <p className="text-xs text-ns-secondary">
            {stats.ouiCount} intéressé(s) · {stats.ouiPending} à envoyer · {stats.ouiSent} déjà
            envoyés · {selectedEmails.size} sélectionné(s)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={BTN_SECONDARY}
            disabled={ouiLoading}
            onClick={() => void loadOui()}
          >
            Rafraîchir
          </button>
          <button
            type="button"
            className={BTN_SECONDARY}
            disabled={ouiRecipients.length === 0}
            onClick={() =>
              setSelectedEmails(
                new Set(ouiRecipients.filter((r) => !r.calendarInviteSentAt).map((r) => r.email)),
              )
            }
          >
            Sélectionner à envoyer
          </button>
          <button
            type="button"
            className={BTN_PRIMARY}
            disabled={sending || selectedEmails.size === 0}
            onClick={() => void sendFormalInvites()}
          >
            {sending ? "Envoi…" : `Envoyer invitation formelle (${selectedEmails.size})`}
          </button>
        </div>
      </div>
      {error && <p className={ERROR_TEXT}>{error}</p>}
      {message && <p className="text-sm font-medium text-ns-primary">{message}</p>}
      {ouiLoading ? (
        <p className="text-sm text-ns-secondary">Chargement des OUI…</p>
      ) : ouiRecipients.length === 0 ? (
        <p className="text-sm text-ns-secondary">
          Aucun OUI pour l’instant. Sync les listes Prospects depuis l’Inbox Save the Date.
        </p>
      ) : (
        <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-white bg-white p-2">
          {ouiRecipients.map((r) => {
            const checked = selectedEmails.has(r.email);
            return (
              <li
                key={r.email}
                className="flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-ns-brand-light/50"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleEmail(r.email)}
                  aria-label={`Sélectionner ${r.fullName}`}
                  className="h-4 w-4 accent-ns-primary"
                />
                <span className="min-w-0 flex-1 font-medium text-ns-tertiary">
                  {r.fullName}
                  {r.company ? (
                    <span className="font-normal text-ns-secondary"> · {r.company}</span>
                  ) : null}
                  <span className="block truncate text-[11px] font-normal text-ns-secondary">
                    {r.email}
                  </span>
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                    r.calendarInviteSentAt
                      ? "bg-emerald-100 text-emerald-900"
                      : "bg-amber-100 text-amber-950"
                  }`}
                >
                  {r.calendarInviteSentAt ? "Envoyé" : "À envoyer"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

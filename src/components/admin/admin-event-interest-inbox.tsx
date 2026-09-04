"use client";

import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { interestProspectListNames } from "@/lib/events/interest-prospect-lists";
import type { EventRespondent } from "@/lib/types/events";
import { BTN_PRIMARY, BTN_SECONDARY, ERROR_TEXT } from "@/lib/ui/nextstep";
import { useCallback, useEffect, useMemo, useState } from "react";

type Props = {
  eventId: string;
  eventSlug?: string;
};

const REASON_LABELS: Record<string, string> = {
  want_to_know_more: "En savoir plus",
  too_expensive: "Trop cher (ancien)",
  not_available: "Pas dispo",
  not_interested_format: "Format",
  not_interested_theme: "Thématique",
  other: "Autre",
};

export function AdminEventInterestInbox({ eventId, eventSlug }: Props) {
  const authFetch = useAuthFetch();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<EventRespondent[]>([]);

  const listNames = useMemo(
    () => (eventSlug ? interestProspectListNames(eventSlug) : null),
    [eventSlug],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/admin/events/${eventId}/interest-responses`);
      const json = (await res.json()) as {
        ok?: boolean;
        respondents?: EventRespondent[];
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "fetch_failed");
        return;
      }
      setRows(json.respondents ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [authFetch, eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function syncLists() {
    setSyncing(true);
    setError(null);
    setMessage(null);
    try {
      const res = await authFetch(`/api/admin/events/${eventId}/sync-interest-lists`, {
        method: "POST",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        lists?: { yes: string; noOther: string };
        synced?: number;
        failed?: number;
        skipped?: number;
        scanned?: number;
      };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "sync_failed");
        return;
      }
      setMessage(
        `Listes Prospects à jour — scannés ${json.scanned ?? 0} · sync ${json.synced ?? 0}` +
          (json.failed ? ` · échecs ${json.failed}` : "") +
          (json.skipped ? ` · ignorés ${json.skipped}` : "") +
          (json.lists
            ? ` · « ${json.lists.yes} » / « ${json.lists.noOther} »`
            : ""),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  }

  const yes = rows.filter((r) => r.interestResponse === "yes").length;
  const no = rows.filter((r) => r.interestResponse === "no").length;
  const other = rows.filter((r) => r.interestResponse === "other").length;
  const pendingProfile = rows.filter((r) => r.profilePending).length;

  return (
    <section className="mt-6 rounded-2xl border border-gray-100 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-ns-secondary">
            Inbox Save the Date
          </h3>
          <p className="mt-1 text-xs text-ns-secondary">
            OUI {yes} · NON {no} · AUTRE {other} · profil manquant {pendingProfile}
          </p>
          {listNames ? (
            <p className="mt-1 text-xs text-ns-secondary">
              Listes Prospects : <span className="font-semibold text-ns-tertiary">{listNames.yes}</span>
              {" · "}
              <span className="font-semibold text-ns-tertiary">{listNames.noOther}</span>
              {" — "}
              <a href="/admin/prospects" className="font-semibold text-ns-primary hover:underline">
                Ouvrir Prospects
              </a>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={BTN_SECONDARY} onClick={() => void load()}>
            Rafraîchir
          </button>
          <button
            type="button"
            className={BTN_PRIMARY}
            disabled={syncing}
            onClick={() => void syncLists()}
            title="Créer / mettre à jour les listes Prospects OUI et NON/AUTRE"
          >
            {syncing ? "Sync listes…" : "Sync → listes Prospects"}
          </button>
        </div>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-ns-secondary">
        Chaque réponse alimente automatiquement la bonne liste Prospects (OUI vs NON/AUTRE), avec la
        réponse dans les notes du contact. Paiement / montant : après l’invitation formelle, via les
        participations de l’événement.
      </p>

      {loading ? <p className="mt-3 text-sm text-ns-secondary">Chargement…</p> : null}
      {error ? <p className={`mt-3 ${ERROR_TEXT}`}>{error}</p> : null}
      {message ? <p className="mt-3 text-sm font-medium text-emerald-700">{message}</p> : null}

      {!loading && rows.length === 0 ? (
        <p className="mt-3 text-sm text-ns-secondary">Aucune réponse pour l’instant.</p>
      ) : null}

      {rows.length > 0 ? (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b border-gray-100 text-ns-secondary">
              <tr>
                <th className="py-2 pr-3 font-semibold">Nom</th>
                <th className="py-2 pr-3 font-semibold">Email</th>
                <th className="py-2 pr-3 font-semibold">Réponse</th>
                <th className="py-2 pr-3 font-semibold">Liste</th>
                <th className="py-2 pr-3 font-semibold">Motif</th>
                <th className="py-2 pr-3 font-semibold">Attentes</th>
                <th className="py-2 pr-3 font-semibold">Profil</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const listLabel =
                  r.interestResponse === "yes"
                    ? "OUI"
                    : r.interestResponse === "no" || r.interestResponse === "other"
                      ? "NON/AUTRE"
                      : "—";
                return (
                  <tr key={r.id} className="border-b border-gray-50 align-top">
                    <td className="py-2 pr-3 font-medium text-ns-tertiary">
                      {r.firstName} {r.lastName}
                      {r.companyName ? (
                        <span className="block font-normal text-ns-secondary">{r.companyName}</span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-ns-secondary">{r.email}</td>
                    <td className="py-2 pr-3 uppercase text-ns-tertiary">
                      {r.interestResponse ?? r.attendance}
                    </td>
                    <td className="py-2 pr-3 font-semibold text-ns-tertiary">{listLabel}</td>
                    <td className="py-2 pr-3 text-ns-secondary">
                      {r.declineReason
                        ? REASON_LABELS[r.declineReason] ?? r.declineReason
                        : "—"}
                      {r.declineReasonOther ? (
                        <span className="mt-1 block">{r.declineReasonOther}</span>
                      ) : null}
                    </td>
                    <td className="max-w-[14rem] py-2 pr-3 text-ns-secondary">
                      {r.expectations || r.ideasComment || "—"}
                    </td>
                    <td className="py-2 pr-3">
                      {r.profilePending ? (
                        <span className="font-semibold text-amber-700">À créer</span>
                      ) : (
                        <span className="text-ns-secondary">OK</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

"use client";

import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { activityTypeLabel } from "@/lib/contacts/build-timeline";
import type {
  ContactActivity,
  ContactEventRow,
  ContactStats,
} from "@/lib/types/contact-activities";
import type { Prospect } from "@/lib/types/prospects";
import { BTN_SECONDARY, ERROR_TEXT } from "@/lib/ui/nextstep";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type WaitlistLite = {
  id: string;
  fullName: string;
  email: string;
  company: string;
  createdAt: string;
  deletedAt?: string | null;
  city?: string;
  sector?: string;
  position?: string;
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function fmtDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("fr-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n);
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    invited: "Invité",
    attending: "RSVP oui",
    confirmed: "Confirmé",
    not_attending: "Refus",
    waitlisted: "Liste d’attente",
    interest_yes: "Intérêt oui",
    interest_no: "Intérêt non",
    interest_maybe: "Intérêt maybe",
  };
  return map[status] ?? status;
}

function interestLabel(value: string | null): string {
  if (!value) return "—";
  if (value === "yes") return "OUI";
  if (value === "no") return "NON";
  if (value === "maybe") return "Maybe";
  return value;
}

export function AdminContactFiche({ email }: { email: string }) {
  const authFetch = useAuthFetch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [waitlist, setWaitlist] = useState<WaitlistLite | null>(null);
  const [stats, setStats] = useState<ContactStats | null>(null);
  const [timeline, setTimeline] = useState<ContactActivity[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(
        `/api/admin/contacts/by-email?email=${encodeURIComponent(email)}`,
      );
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        prospect?: Prospect | null;
        waitlist?: WaitlistLite | null;
        stats?: ContactStats;
        timeline?: ContactActivity[];
      };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "load_failed");
      setProspect(json.prospect ?? null);
      setWaitlist(json.waitlist ?? null);
      setStats(json.stats ?? null);
      setTimeline(json.timeline ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [authFetch, email]);

  useEffect(() => {
    void load();
  }, [load]);

  const displayName =
    prospect?.fullName?.trim() ||
    waitlist?.fullName?.trim() ||
    email;

  const surveyEvents = (stats?.events ?? []).filter((e) => e.survey);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin/prospects"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ns-secondary hover:text-ns-tertiary"
        >
          <ArrowLeft className="h-4 w-4" />
          Prospects
        </Link>
        <span className="text-ns-secondary/40">·</span>
        <Link
          href="/admin/inscrits"
          className="text-sm font-medium text-ns-secondary hover:text-ns-tertiary"
        >
          Membres
        </Link>
        <button type="button" className={`${BTN_SECONDARY} ml-auto`} onClick={() => void load()}>
          Rafraîchir
        </button>
      </div>

      {error ? <p className={ERROR_TEXT}>{error}</p> : null}
      {loading ? <p className="text-sm text-ns-secondary">Chargement…</p> : null}

      {!loading && !error ? (
        <>
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-ns-tertiary">{displayName}</h2>
                <p className="text-sm text-ns-secondary">{email}</p>
                <p className="mt-1 text-sm text-ns-secondary">
                  {[prospect?.company || waitlist?.company, prospect?.position || waitlist?.position]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {prospect ? (
                  <span className="rounded-full bg-lime-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-lime-900">
                    Prospect
                  </span>
                ) : null}
                {waitlist ? (
                  <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sky-900">
                    Membre{waitlist.deletedAt ? " (supprimé)" : ""}
                  </span>
                ) : null}
                {!prospect && !waitlist ? (
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-ns-secondary">
                    Aucune fiche source
                  </span>
                ) : null}
              </div>
            </div>
          </section>

          {stats ? (
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="Ajouté CRM" value={fmtDate(stats.addedAt)} />
              <Kpi label="Inscrit plateforme" value={fmtDate(stats.registeredAt)} />
              <Kpi label="Invitations" value={String(stats.invitationsCount)} />
              <Kpi label="Confirmé / venu" value={String(stats.confirmedCount)} />
              <Kpi label="Refus" value={String(stats.declinedCount)} />
              <Kpi label="CA généré" value={fmtMoney(stats.revenueMxn)} />
              <Kpi
                label="Satisfaction moy."
                value={
                  stats.avgOverall === null ? "—" : `${stats.avgOverall.toFixed(1)}/5`
                }
              />
              <Kpi
                label="Reco. concept"
                value={
                  stats.avgWouldRecommend === null
                    ? "—"
                    : `${stats.avgWouldRecommend.toFixed(1)}/5`
                }
              />
              <Kpi label="Surveys" value={`${stats.surveyCount}`} />
              <Kpi label="Dernière relance" value={fmtDate(stats.lastOutreachAt)} />
              <Kpi
                label="Listes / tags"
                value={
                  [
                    ...(prospect?.lists ?? []).slice(0, 2),
                    ...(prospect?.tags ?? []).slice(0, 2),
                  ].join(", ") || "—"
                }
              />
            </section>
          ) : null}

          {stats && stats.events.length > 0 ? (
            <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-ns-secondary">
                Parcours événements
              </h3>
              <p className="mb-3 text-xs text-ns-secondary">
                Invitations, réponses, CA par dîner (TTC) et notes de satisfaction.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs uppercase text-ns-secondary">
                      <th className="px-2 py-2">Événement</th>
                      <th className="px-2 py-2">Date</th>
                      <th className="px-2 py-2">Statut</th>
                      <th className="px-2 py-2">Intérêt</th>
                      <th className="px-2 py-2">CA</th>
                      <th className="px-2 py-2">Survey</th>
                      <th className="px-2 py-2">Reco</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.events.map((ev) => (
                      <EventRow key={ev.participationId ?? `interest-${ev.eventId}`} ev={ev} />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {surveyEvents.length > 0 ? (
            <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-ns-secondary">
                Évolution satisfaction
              </h3>
              <ul className="space-y-3">
                {surveyEvents
                  .slice()
                  .sort((a, b) =>
                    String(a.startsAt ?? "").localeCompare(String(b.startsAt ?? "")),
                  )
                  .map((ev) => {
                    const s = ev.survey!;
                    return (
                      <li
                        key={ev.participationId ?? ev.eventId}
                        className="rounded-xl border border-gray-50 px-3 py-2.5"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-sm font-semibold text-ns-tertiary">{ev.title}</p>
                          <p className="text-xs text-ns-secondary">{fmtDay(ev.startsAt)}</p>
                        </div>
                        <p className="mt-1 text-xs text-ns-secondary">
                          Moy. {s.overall.toFixed(1)}/5 · lieu {s.venueQuality} · menu{" "}
                          {s.menuQuality} · invités {s.guestsQuality} · retour {s.wouldReturn} ·
                          reco {s.wouldRecommend === null ? "—" : `${s.wouldRecommend}/5`}
                        </p>
                        {s.comment ? (
                          <p className="mt-1 text-xs italic text-ns-secondary">« {s.comment} »</p>
                        ) : null}
                      </li>
                    );
                  })}
              </ul>
            </section>
          ) : null}

          <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-ns-secondary">
              Timeline
            </h3>
            {timeline.length === 0 ? (
              <p className="text-sm text-ns-secondary">Aucune interaction pour l’instant.</p>
            ) : (
              <ul className="space-y-2">
                {timeline.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-start gap-3 rounded-xl border border-gray-50 px-3 py-2.5"
                  >
                    <span className="mt-0.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ns-secondary">
                      {activityTypeLabel(a.type)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ns-tertiary">{a.summary}</p>
                      <p className="text-[11px] text-ns-secondary">
                        {fmtDate(a.at)}
                        {a.derived ? " · historique dérivé" : ""}
                        {a.source ? ` · ${a.source}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function EventRow({ ev }: { ev: ContactEventRow }) {
  return (
    <tr className="border-b border-gray-50 align-top">
      <td className="px-2 py-2 font-medium text-ns-tertiary">
        <Link
          href={`/admin/evenements?id=${encodeURIComponent(ev.eventId)}`}
          className="hover:underline"
        >
          {ev.title}
        </Link>
      </td>
      <td className="px-2 py-2 text-ns-secondary">{fmtDay(ev.startsAt)}</td>
      <td className="px-2 py-2 text-ns-secondary">{statusLabel(ev.status)}</td>
      <td className="px-2 py-2 text-ns-secondary">{interestLabel(ev.interestResponse)}</td>
      <td className="px-2 py-2 tabular-nums text-ns-secondary">
        {ev.revenueMxn > 0 ? fmtMoney(ev.revenueMxn) : "—"}
      </td>
      <td className="px-2 py-2 tabular-nums text-ns-secondary">
        {ev.survey ? `${ev.survey.overall.toFixed(1)}/5` : "—"}
      </td>
      <td className="px-2 py-2 tabular-nums text-ns-secondary">
        {ev.survey?.wouldRecommend === null || ev.survey?.wouldRecommend === undefined
          ? "—"
          : `${ev.survey.wouldRecommend}/5`}
      </td>
    </tr>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ns-secondary">{label}</p>
      <p className="mt-1 text-sm font-bold text-ns-tertiary">{value}</p>
    </div>
  );
}

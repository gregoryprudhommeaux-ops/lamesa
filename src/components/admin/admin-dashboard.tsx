"use client";

import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { labelPositionFr, labelSectorFr } from "@/lib/admin/waitlist-labels-fr";
import { formatScore, type SatisfactionAverages } from "@/lib/admin/satisfaction-stats";
import { formatMxn } from "@/lib/events/pricing";
import { BTN_SECONDARY, ERROR_TEXT } from "@/lib/ui/nextstep";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type EventRow = {
  id: string;
  title: string;
  startsAt: string;
  status: string;
  capacity: number;
  guests: number;
  satisfaction: SatisfactionAverages & { sentCount: number };
};

type RecentRegistrant = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  company: string;
  city: string;
  position: string;
  sector: string;
  locale: string;
  source: string;
  createdAt: string;
  profileComplete: boolean | null;
  completionPercent: number;
  referredByCode: string | null;
  isExpress: boolean;
  invitationsSent: number;
  eventsConfirmed: number;
  revenueMxn: number;
  referralsMade: number;
};

type DashboardPayload = {
  ok?: boolean;
  error?: string;
  kpis?: {
    waitlistUsers: number;
    eventsTotal: number;
    eventsPublished: number;
    eventsUpcoming: number;
    participationsTotal: number;
    confirmed: number;
    attending: number;
    invited: number;
    waitlistSeats: number;
    notAttending: number;
    surveysResponses: number;
    eventsWithSurvey: number;
  };
  satisfaction?: SatisfactionAverages;
  events?: EventRow[];
  recentRegistrants?: RecentRegistrant[];
};

const CATEGORIES: {
  key: keyof Pick<
    SatisfactionAverages,
    "venueQuality" | "menuQuality" | "guestsQuality" | "wouldReturn"
  >;
  label: string;
}[] = [
  { key: "venueQuality", label: "Endroit" },
  { key: "menuQuality", label: "Menu" },
  { key: "guestsQuality", label: "Autres invités" },
  { key: "wouldReturn", label: "Reviendrait" },
];

function KpiCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-ns-surface p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-ns-secondary">{label}</p>
      <p className="mt-2 text-3xl font-black text-ns-tertiary">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ns-secondary">{hint}</p> : null}
    </div>
  );
}

function CategoryBars({ sat }: { sat: SatisfactionAverages }) {
  return (
    <div className="space-y-3">
      {CATEGORIES.map((c) => {
        const score = sat[c.key];
        const pct = score === null ? 0 : Math.max(0, Math.min(100, (score / 5) * 100));
        return (
          <div key={c.key}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="font-medium text-ns-tertiary">{c.label}</span>
              <span className="font-bold text-ns-primary">{formatScore(score)} / 5</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-ns-brand-light">
              <div className="h-full rounded-full bg-[#b4e600]" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatRegistrantDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CompletionCell({ percent }: { percent: number }) {
  const tone =
    percent >= 80 ? "text-emerald-700" : percent >= 50 ? "text-amber-700" : "text-red-700";
  const bar =
    percent >= 80 ? "bg-emerald-500" : percent >= 50 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="min-w-[7rem]">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className={`text-sm font-bold tabular-nums ${tone}`}>{percent}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-ns-brand-light">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function registrantSubtitle(r: RecentRegistrant): string {
  return [labelPositionFr(r.position), labelSectorFr(r.sector), r.company.trim(), r.city.trim()]
    .filter((part) => Boolean(part) && part !== "—")
    .join(" · ");
}

export function AdminDashboardPanel() {
  const authFetch = useAuthFetch();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/admin/dashboard");
      const json = (await res.json()) as DashboardPayload;
      if (!res.ok || !json.ok) throw new Error(json.error ?? "load_failed");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="text-sm text-ns-secondary">Chargement du dashboard…</p>;
  if (error) {
    return (
      <div className="space-y-3">
        <p className={ERROR_TEXT}>{error}</p>
        <button type="button" className={BTN_SECONDARY} onClick={() => void load()}>
          Réessayer
        </button>
      </div>
    );
  }
  if (!data?.kpis || !data.satisfaction) return null;

  const { kpis, satisfaction, events = [], recentRegistrants = [] } = data;
  const withScores = events.filter((e) => e.satisfaction.responseCount > 0);
  const avgCompletion =
    recentRegistrants.length === 0
      ? null
      : Math.round(
          recentRegistrants.reduce((sum, r) => sum + r.completionPercent, 0) /
            recentRegistrants.length,
        );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ns-hero">Dashboard</h2>
          <p className="mt-1 text-sm text-ns-secondary">
            Vue plateforme : derniers inscrits, volumes, funnel et satisfaction.
          </p>
        </div>
        <Link href="/admin/templates" className={`${BTN_SECONDARY} text-sm`}>
          Templates email
        </Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Membres waitlist" value={kpis.waitlistUsers} />
        <KpiCard
          label="Événements"
          value={kpis.eventsTotal}
          hint={`${kpis.eventsPublished} publiés · ${kpis.eventsUpcoming} à venir`}
        />
        <KpiCard label="Participations" value={kpis.participationsTotal} />
        <KpiCard
          label="Satisfaction globale"
          value={satisfaction.overall === null ? "—" : `${formatScore(satisfaction.overall)}/5`}
          hint={`${kpis.surveysResponses} réponses · ${kpis.eventsWithSurvey} dîners`}
        />
      </section>

      <section className="rounded-2xl border border-gray-100 bg-ns-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-ns-secondary">
              Derniers inscrits
            </h3>
            <p className="mt-1 text-xs text-ns-secondary">
              Du plus récent au plus ancien
              {avgCompletion !== null ? ` · complétion moyenne ${avgCompletion}%` : ""}
              {" · "}CA = somme TTC des dîners confirmés
            </p>
          </div>
          <Link href="/admin/inscrits" className="text-xs font-semibold text-ns-primary hover:underline">
            Voir tous les membres →
          </Link>
        </div>

        {recentRegistrants.length === 0 ? (
          <p className="mt-4 text-sm text-ns-secondary">Aucun inscrit pour le moment.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-ns-secondary">
                  <th className="py-2 pr-3 font-semibold">Inscrit</th>
                  <th className="py-2 pr-3 font-semibold">Inscription</th>
                  <th className="py-2 pr-3 font-semibold">Complétion</th>
                  <th className="py-2 pr-3 font-semibold">Type</th>
                  <th className="py-2 pr-3 font-semibold">Invitations</th>
                  <th className="py-2 pr-3 font-semibold">Confirmés</th>
                  <th className="py-2 pr-3 font-semibold">CA</th>
                  <th className="py-2 pr-3 font-semibold">Parrainages</th>
                  <th className="py-2 pr-3 font-semibold">Contact</th>
                  <th className="py-2 font-semibold">Parrain</th>
                </tr>
              </thead>
              <tbody>
                {recentRegistrants.map((r) => {
                  const subtitle = registrantSubtitle(r);
                  return (
                    <tr key={r.id} className="border-b border-gray-50 align-top">
                      <td className="py-3 pr-3">
                        <p className="font-semibold text-ns-tertiary">{r.fullName || "—"}</p>
                        {subtitle ? (
                          <p className="mt-0.5 text-xs text-ns-secondary">{subtitle}</p>
                        ) : null}
                        {r.locale ? (
                          <p className="mt-0.5 text-[11px] uppercase tracking-wide text-ns-secondary/80">
                            {r.locale}
                          </p>
                        ) : null}
                      </td>
                      <td className="py-3 pr-3 whitespace-nowrap text-ns-secondary">
                        {formatRegistrantDate(r.createdAt)}
                      </td>
                      <td className="py-3 pr-3">
                        <CompletionCell percent={r.completionPercent} />
                      </td>
                      <td className="py-3 pr-3">
                        {r.isExpress ? (
                          <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                            Express
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-ns-brand-light px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ns-tertiary">
                            Complet
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-3 font-semibold tabular-nums text-ns-tertiary">
                        {r.invitationsSent}
                      </td>
                      <td className="py-3 pr-3 font-semibold tabular-nums text-ns-tertiary">
                        {r.eventsConfirmed}
                      </td>
                      <td className="py-3 pr-3 whitespace-nowrap font-semibold tabular-nums text-ns-tertiary">
                        {r.revenueMxn > 0 ? formatMxn(r.revenueMxn, "fr") : "—"}
                      </td>
                      <td className="py-3 pr-3 font-semibold tabular-nums text-ns-tertiary">
                        {r.referralsMade}
                      </td>
                      <td className="py-3 pr-3">
                        <a
                          href={`mailto:${r.email}`}
                          className="block text-ns-primary hover:underline"
                        >
                          {r.email || "—"}
                        </a>
                        {r.phone ? (
                          <p className="mt-0.5 text-xs text-ns-secondary">{r.phone}</p>
                        ) : null}
                      </td>
                      <td className="py-3 font-medium text-ns-tertiary">
                        {r.referredByCode ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-ns-surface p-5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-ns-secondary">
            Funnel participations
          </h3>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <KpiCard label="Invités" value={kpis.invited} />
            <KpiCard label="Attending" value={kpis.attending} />
            <KpiCard label="Confirmés" value={kpis.confirmed} />
            <KpiCard label="Not attending" value={kpis.notAttending} />
            <KpiCard label="Waiting list" value={kpis.waitlistSeats} />
            <KpiCard
              label="Taux invite friend"
              value={
                satisfaction.inviteYesRate === null ? "—" : `${satisfaction.inviteYesRate}%`
              }
            />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-ns-surface p-5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-ns-secondary">
            Notes moyennes cumulées
          </h3>
          {satisfaction.responseCount === 0 ? (
            <p className="mt-4 text-sm text-ns-secondary">Pas encore de réponses survey.</p>
          ) : (
            <div className="mt-4">
              <p className="mb-4 text-4xl font-black text-ns-tertiary">
                {formatScore(satisfaction.overall)}
                <span className="text-lg text-ns-secondary"> / 5</span>
              </p>
              <CategoryBars sat={satisfaction} />
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-ns-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wide text-ns-secondary">
            Satisfaction par dîner
          </h3>
          <p className="text-xs text-ns-secondary">
            {withScores.length} dîner{withScores.length === 1 ? "" : "s"} avec réponses
          </p>
        </div>

        {events.length === 0 ? (
          <p className="mt-4 text-sm text-ns-secondary">Aucun événement.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-ns-secondary">
                  <th className="py-2 pr-3 font-semibold">Dîner</th>
                  <th className="py-2 pr-3 font-semibold">Date</th>
                  <th className="py-2 pr-3 font-semibold">Réponses</th>
                  <th className="py-2 pr-3 font-semibold">Moy.</th>
                  <th className="py-2 pr-3 font-semibold">Lieu</th>
                  <th className="py-2 pr-3 font-semibold">Menu</th>
                  <th className="py-2 pr-3 font-semibold">Invités</th>
                  <th className="py-2 font-semibold">Retour</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => {
                  const s = ev.satisfaction;
                  const date = new Date(ev.startsAt);
                  return (
                    <tr key={ev.id} className="border-b border-gray-50">
                      <td className="py-2.5 pr-3">
                        <Link
                          href={`/admin/evenements?id=${encodeURIComponent(ev.id)}`}
                          className="font-semibold text-ns-primary hover:underline"
                        >
                          {ev.title}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-3 text-ns-secondary">
                        {Number.isNaN(date.getTime())
                          ? "—"
                          : date.toLocaleDateString("fr-FR", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                      </td>
                      <td className="py-2.5 pr-3">
                        {s.responseCount}
                        <span className="text-ns-secondary">/{s.sentCount}</span>
                      </td>
                      <td className="py-2.5 pr-3 font-bold text-ns-tertiary">
                        {formatScore(s.overall)}
                      </td>
                      <td className="py-2.5 pr-3">{formatScore(s.venueQuality)}</td>
                      <td className="py-2.5 pr-3">{formatScore(s.menuQuality)}</td>
                      <td className="py-2.5 pr-3">{formatScore(s.guestsQuality)}</td>
                      <td className="py-2.5">{formatScore(s.wouldReturn)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {withScores.length > 0 ? (
          <div className="mt-6 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-ns-secondary">
              Classement (moyenne globale)
            </p>
            {[...withScores]
              .sort((a, b) => (b.satisfaction.overall ?? 0) - (a.satisfaction.overall ?? 0))
              .map((ev) => {
                const score = ev.satisfaction.overall ?? 0;
                const pct = (score / 5) * 100;
                return (
                  <div key={ev.id} className="flex items-center gap-3">
                    <Link
                      href={`/admin/evenements?id=${encodeURIComponent(ev.id)}`}
                      className="w-36 truncate text-xs font-semibold text-ns-tertiary hover:text-ns-primary"
                    >
                      {ev.title}
                    </Link>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ns-brand-light">
                      <div className="h-full rounded-full bg-[#b4e600]" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-10 text-right text-xs font-bold text-ns-primary">
                      {formatScore(ev.satisfaction.overall)}
                    </span>
                  </div>
                );
              })}
          </div>
        ) : null}
      </section>
    </div>
  );
}

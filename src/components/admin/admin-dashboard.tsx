"use client";

import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { labelCityHubFr, labelPositionFr, labelSectorFr } from "@/lib/admin/waitlist-labels-fr";
import { labelEventFormat, type EventFormat } from "@/lib/constants/event-formats";
import { formatScore, type SatisfactionAverages } from "@/lib/admin/satisfaction-stats";
import { BTN_SECONDARY, ERROR_TEXT } from "@/lib/ui/nextstep";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  missingFields: string[];
  referredByCode: string | null;
  isExpress: boolean;
  welcomeEmailStatus: "sent" | "failed" | "skipped" | null;
  welcomeEmailSentAt: string | null;
  invitationsSent: number;
  eventsConfirmed: number;
  revenueMxn: number;
  referralsMade: number;
};

type RecentTableDraft = {
  id: string;
  title: string;
  city: string;
  format?: string;
  primaryCount: number;
  alternateCount: number;
  updatedAt: string;
};

type OpsQueueMember = {
  id: string;
  fullName: string;
  email: string;
  company: string;
  city: string;
  opsPriority: string;
  opsTags: string[];
  reason: string;
};

type OpsQueues = {
  incomplete: OpsQueueMember[];
  neverInvited: OpsQueueMember[];
  review: OpsQueueMember[];
  priority: OpsQueueMember[];
  noShow: OpsQueueMember[];
};

type DistributionItem = {
  value: string;
  count: number;
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
    profilesNeedingAttention: number;
  };
  satisfaction?: SatisfactionAverages;
  events?: EventRow[];
  recentRegistrants?: RecentRegistrant[];
  distributions?: {
    sectors: DistributionItem[];
    positions: DistributionItem[];
    cities: DistributionItem[];
  };
  recentTableDrafts?: RecentTableDraft[];
  opsQueues?: OpsQueues;
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

function OpsQueueCard({
  title,
  href,
  rows,
}: {
  title: string;
  href: string;
  rows: OpsQueueMember[];
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-ns-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-ns-secondary">{title}</p>
          <p className="mt-1 text-2xl font-black text-ns-tertiary">{rows.length}</p>
        </div>
        <Link href={href} className="text-xs font-semibold text-ns-primary hover:underline">
          Voir →
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 text-xs text-ns-secondary">Aucune file pour l’instant.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.slice(0, 5).map((row) => (
            <li key={row.id}>
              <Link
                href={`/admin/inscrits?id=${encodeURIComponent(row.id)}`}
                className="block rounded-lg px-2 py-1.5 hover:bg-ns-brand-light/60"
              >
                <span className="block truncate text-sm font-semibold text-ns-tertiary">
                  {row.fullName || row.email || "Sans nom"}
                </span>
                <span className="block truncate text-[11px] text-ns-secondary">
                  {row.reason}
                  {row.company ? ` · ${row.company}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
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

function CompletionCell({
  percent,
  missingFields,
}: {
  percent: number;
  missingFields: string[];
}) {
  const tone =
    percent >= 80 ? "text-emerald-700" : percent >= 50 ? "text-amber-700" : "text-red-700";
  const bar =
    percent >= 80 ? "bg-emerald-500" : percent >= 50 ? "bg-amber-400" : "bg-red-400";
  const missingHint =
    missingFields.length > 0
      ? `Manque : ${missingFields.join(", ")}`
      : "Profil complet";

  return (
    <div className="min-w-[5.5rem]">
      <div className="mb-1 flex items-center gap-1.5">
        <span className={`text-sm font-bold tabular-nums ${tone}`}>{percent}%</span>
        {missingFields.length > 0 ? (
          <span
            className="inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full border border-ns-secondary/40 text-[10px] font-bold leading-none text-ns-secondary"
            title={missingHint}
            aria-label={missingHint}
            onClick={(e) => e.stopPropagation()}
          >
            ?
          </span>
        ) : null}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-ns-brand-light">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/** Welcome / express confirmation email status after signup. */
function WelcomeEmailCell({
  status,
  sentAt,
  isExpress,
}: {
  status: RecentRegistrant["welcomeEmailStatus"];
  sentAt: string | null;
  isExpress: boolean;
}) {
  const hint = isExpress
    ? "Mail auto express — invitation à compléter le profil"
    : "Mail auto — confirmation d’inscription";

  if (!status) {
    return (
      <span className="text-xs text-ns-secondary/70" title={`${hint} · pas encore tracké`}>
        —
      </span>
    );
  }

  if (status === "sent") {
    return (
      <div title={hint}>
        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
          Envoyé
        </span>
        {sentAt ? (
          <p className="mt-1 text-[11px] text-ns-secondary">{formatRegistrantDate(sentAt)}</p>
        ) : null}
      </div>
    );
  }

  if (status === "failed") {
    return (
      <span
        className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-800"
        title={hint}
      >
        Échec
      </span>
    );
  }

  return (
    <span
      className="inline-flex rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-600"
      title={`${hint} · template désactivé`}
    >
      Off
    </span>
  );
}

function registrantSubtitle(r: RecentRegistrant): string {
  return [
    labelPositionFr(r.position),
    labelSectorFr(r.sector),
    r.company.trim(),
    labelCityHubFr(r.city),
  ]
    .filter((part) => Boolean(part) && part !== "—")
    .join(" · ");
}

function distributionLabel(kind: "sector" | "position" | "city", value: string): string {
  if (kind === "sector") return labelSectorFr(value);
  if (kind === "position") return labelPositionFr(value);
  if (kind === "city") return labelCityHubFr(value);
  return value;
}

function DistributionCard({
  title,
  items,
  total,
  kind,
  emptyLabel = "Aucune donnée.",
}: {
  title: string;
  items: DistributionItem[];
  total: number;
  kind: "sector" | "position" | "city";
  emptyLabel?: string;
}) {
  const visible = kind === "city" ? items : items.slice(0, 8);
  return (
    <div className="rounded-2xl border border-gray-100 bg-ns-surface p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-ns-secondary">{title}</h3>
        <span className="text-xs font-semibold text-ns-secondary">{total} membres</span>
      </div>

      {visible.length === 0 ? (
        <p className="mt-4 text-sm text-ns-secondary">{emptyLabel}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {visible.map((item) => {
            const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
            const muted = kind === "city" && item.count === 0;
            return (
              <div key={item.value} className={muted ? "opacity-45" : undefined}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate font-medium text-ns-tertiary">
                    {distributionLabel(kind, item.value)}
                  </span>
                  <span className="shrink-0 font-bold tabular-nums text-ns-primary">
                    {item.count} · {pct}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-ns-brand-light">
                  <div className="h-full rounded-full bg-[#b4e600]" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
          {kind !== "city" && items.length > visible.length ? (
            <p className="text-xs text-ns-secondary">
              +{items.length - visible.length} autre{items.length - visible.length > 1 ? "s" : ""}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function FunnelStage({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: number;
  emphasize?: boolean;
}) {
  return (
    <div className="min-w-0 flex-1 text-center">
      <p
        className={`text-2xl font-black tabular-nums ${
          emphasize ? "text-ns-primary" : "text-ns-tertiary"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-ns-secondary">{label}</p>
    </div>
  );
}

function FunnelArrow() {
  return (
    <span
      className="hidden shrink-0 self-center text-ns-secondary/40 sm:inline"
      aria-hidden
    >
      →
    </span>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Chargement du dashboard">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="h-7 w-36 animate-pulse rounded-lg bg-ns-brand-light" />
          <div className="h-4 w-72 max-w-full animate-pulse rounded bg-ns-brand-light" />
        </div>
        <div className="h-9 w-28 animate-pulse rounded-full bg-ns-brand-light" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-100 bg-ns-surface p-4">
            <div className="h-3 w-24 animate-pulse rounded bg-ns-brand-light" />
            <div className="mt-3 h-9 w-16 animate-pulse rounded bg-ns-brand-light" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-gray-100 bg-ns-surface p-5">
        <div className="h-4 w-40 animate-pulse rounded bg-ns-brand-light" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-ns-brand-light/70" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdminDashboardPanel() {
  const authFetch = useAuthFetch();
  const router = useRouter();
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

  if (loading) return <DashboardSkeleton />;
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

  const {
    kpis,
    satisfaction,
    events = [],
    recentRegistrants = [],
    distributions,
    recentTableDrafts = [],
    opsQueues,
  } = data;
  const withScores = events.filter((e) => e.satisfaction.responseCount > 0);
  const avgCompletion =
    recentRegistrants.length === 0
      ? null
      : Math.round(
          recentRegistrants.reduce((sum, r) => sum + r.completionPercent, 0) /
            recentRegistrants.length,
        );
  const needingAttention = kpis.profilesNeedingAttention ?? 0;
  const queues: OpsQueues = opsQueues ?? {
    incomplete: [],
    neverInvited: [],
    review: [],
    priority: [],
    noShow: [],
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ns-hero">Dashboard</h2>
          <p className="mt-1 text-sm text-ns-secondary">
            Vue plateforme : derniers inscrits, volumes, funnel et satisfaction.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`${BTN_SECONDARY} text-sm`} onClick={() => void load()}>
            Rafraîchir
          </button>
          <Link href="/admin/templates" className={`${BTN_SECONDARY} text-sm`}>
            Templates email
          </Link>
          <Link href="/admin/evenements?nouveau=1" className={`${BTN_SECONDARY} text-sm`}>
            Nouvel événement
          </Link>
        </div>
      </div>

      {needingAttention > 0 ? (
        <Link
          href="/admin/inscrits?profile=incomplete"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 transition hover:border-amber-300 hover:bg-amber-100/80"
        >
          <div>
            <p className="text-sm font-bold text-amber-950">
              {needingAttention} profil{needingAttention > 1 ? "s" : ""} à compléter
            </p>
            <p className="mt-0.5 text-xs text-amber-900/80">
              Express ou complétion &lt; 50 % — prioriser le nurture avant d’inviter.
            </p>
          </div>
          <span className="text-xs font-semibold text-amber-900">Voir les inscrits →</span>
        </Link>
      ) : null}

      <section>
        <div className="mb-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-ns-secondary">
            Files ops
          </h3>
          <p className="mt-1 text-xs text-ns-secondary">
            Priorités cockpit — notes et tags se gèrent dans Inscrits.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          <OpsQueueCard
            title="Profils incomplets"
            href="/admin/inscrits?profile=incomplete"
            rows={queues.incomplete}
          />
          <OpsQueueCard
            title="Jamais invités"
            href="/admin/inscrits"
            rows={queues.neverInvited}
          />
          <OpsQueueCard title="À prioriser" href="/admin/inscrits" rows={queues.priority} />
          <OpsQueueCard title="À revoir" href="/admin/inscrits" rows={queues.review} />
          <OpsQueueCard title="No-show" href="/admin/inscrits" rows={queues.noShow} />
        </div>
      </section>

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

      <section>
        <div className="mb-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-ns-secondary">
            Répartition membres
          </h3>
          <p className="mt-1 text-xs text-ns-secondary">
            Sur la waitlist active : secteur, position et hub ville (ZMG → Guadalajara).
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <DistributionCard
            title="Secteurs"
            items={distributions?.sectors ?? []}
            total={kpis.waitlistUsers}
            kind="sector"
          />
          <DistributionCard
            title="Positions"
            items={distributions?.positions ?? []}
            total={kpis.waitlistUsers}
            kind="position"
          />
          <DistributionCard
            title="Hubs"
            items={distributions?.cities ?? []}
            total={kpis.waitlistUsers}
            kind="city"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-ns-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-ns-secondary">
              Intelligence du vivier
            </h3>
            <p className="mt-1 text-xs text-ns-secondary">
              Dernières compositions enregistrées dans le Table Builder
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/tables" className={`${BTN_SECONDARY} text-sm`}>
              Ouvrir le Table Builder
            </Link>
            <Link href="/admin/tables?generate=1" className={`${BTN_SECONDARY} text-sm`}>
              Générer des idées
            </Link>
          </div>
        </div>

        {recentTableDrafts.length === 0 ? (
          <p className="mt-4 text-sm text-ns-secondary">
            Aucun brouillon de table pour le moment.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {recentTableDrafts.map((draft) => (
              <div
                key={draft.id}
                className="rounded-xl border border-gray-100 bg-ns-brand-light/40 p-4"
              >
                <p className="font-semibold text-ns-tertiary">{draft.title || "Table sans titre"}</p>
                <p className="mt-1 text-xs text-ns-secondary">
                  {labelEventFormat(draft.format as EventFormat | undefined, "fr")}
                  {" · "}
                  {draft.city ? labelCityHubFr(draft.city) : "Ville non renseignée"}
                </p>
                <p className="mt-3 text-sm text-ns-tertiary">
                  {draft.primaryCount} titulaire{draft.primaryCount === 1 ? "" : "s"} ·{" "}
                  {draft.alternateCount} suppléant{draft.alternateCount === 1 ? "" : "s"}
                </p>
                <p className="mt-2 text-xs text-ns-secondary">
                  Mis à jour {formatRegistrantDate(draft.updatedAt)}
                </p>
              </div>
            ))}
          </div>
        )}
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
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-ns-secondary">
                  <th className="py-2 pr-3 font-semibold">Inscrit</th>
                  <th className="py-2 pr-3 font-semibold">Inscription</th>
                  <th className="py-2 pr-3 font-semibold">Complétion</th>
                  <th
                    className="py-2 pr-3 font-semibold"
                    title="Mail auto après inscription (express = compléter le profil)"
                  >
                    Mail auto
                  </th>
                  <th className="py-2 font-semibold">Contact</th>
                </tr>
              </thead>
              <tbody>
                {recentRegistrants.map((r) => {
                  const subtitle = registrantSubtitle(r);
                  return (
                    <tr
                      key={r.id}
                      className="cursor-pointer border-b border-gray-50 align-top transition hover:bg-ns-brand-light/60"
                      onClick={() => {
                        router.push(`/admin/inscrits?id=${encodeURIComponent(r.id)}`);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(`/admin/inscrits?id=${encodeURIComponent(r.id)}`);
                        }
                      }}
                      tabIndex={0}
                      role="link"
                    >
                      <td className="py-3 pr-3">
                        <p className="font-semibold text-ns-tertiary">{r.fullName || "—"}</p>
                        {subtitle ? (
                          <p className="mt-0.5 text-xs text-ns-secondary">{subtitle}</p>
                        ) : null}
                        {r.isExpress ? (
                          <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                            Express
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 pr-3 whitespace-nowrap text-ns-secondary">
                        {formatRegistrantDate(r.createdAt)}
                      </td>
                      <td className="py-3 pr-3">
                        <CompletionCell
                          percent={r.completionPercent}
                          missingFields={r.missingFields ?? []}
                        />
                      </td>
                      <td className="py-3 pr-3">
                        <WelcomeEmailCell
                          status={r.welcomeEmailStatus}
                          sentAt={r.welcomeEmailSentAt}
                          isExpress={r.isExpress}
                        />
                      </td>
                      <td className="py-3">
                        <a
                          href={`mailto:${r.email}`}
                          className="block text-ns-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {r.email || "—"}
                        </a>
                        {r.phone ? (
                          <p className="mt-0.5 text-xs text-ns-secondary">{r.phone}</p>
                        ) : null}
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
          <div className="mt-5 flex flex-wrap items-start justify-between gap-3 sm:flex-nowrap sm:gap-2">
            <FunnelStage label="Invités" value={kpis.invited} />
            <FunnelArrow />
            <FunnelStage label="Confirmés" value={kpis.confirmed} emphasize />
            <FunnelArrow />
            <FunnelStage label="Présents" value={kpis.attending} />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-gray-100 pt-4 text-sm sm:grid-cols-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-ns-secondary">Déclinés</span>
              <span className="font-semibold tabular-nums text-ns-tertiary">{kpis.notAttending}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-ns-secondary">Liste d’attente</span>
              <span className="font-semibold tabular-nums text-ns-tertiary">{kpis.waitlistSeats}</span>
            </div>
            <div className="col-span-2 flex items-baseline justify-between gap-2 sm:col-span-1">
              <span className="text-ns-secondary">Taux « inviter un ami »</span>
              <span className="font-semibold tabular-nums text-ns-tertiary">
                {satisfaction.inviteYesRate === null ? "—" : `${satisfaction.inviteYesRate}%`}
              </span>
            </div>
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
      </section>
    </div>
  );
}

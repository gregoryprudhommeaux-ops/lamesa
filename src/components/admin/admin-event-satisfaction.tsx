"use client";

import {
  computeEventSatisfaction,
  formatScore,
} from "@/lib/admin/satisfaction-stats";
import type { AdminEventParticipation } from "@/lib/types/events";
import { FORM_SECTION_TITLE } from "@/lib/ui/nextstep";

const CATEGORIES: {
  key:
    | "venueQuality"
    | "menuQuality"
    | "guestsQuality"
    | "valueForMoney"
    | "wouldReturn"
    | "wouldRecommend";
  label: string;
}[] = [
  { key: "venueQuality", label: "Endroit" },
  { key: "menuQuality", label: "Menu" },
  { key: "guestsQuality", label: "Sélection participants" },
  { key: "valueForMoney", label: "Qualité / prix" },
  { key: "wouldReturn", label: "Autres tables" },
  { key: "wouldRecommend", label: "En parlerait" },
];

function ScoreBar({ score, label }: { score: number | null; label: string }) {
  const pct = score === null ? 0 : Math.max(0, Math.min(100, (score / 5) * 100));
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_7rem_2.75rem] items-center gap-3">
      <span className="truncate text-xs font-medium text-ns-tertiary">{label}</span>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-ns-brand-light"
        role="img"
        aria-label={`${label} : ${formatScore(score)} sur 5`}
      >
        <div
          className="h-full rounded-full bg-[#b4e600] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-right text-xs font-bold tabular-nums text-ns-primary">
        {formatScore(score)}
      </span>
    </li>
  );
}

export function AdminEventSatisfactionResults({
  participations,
}: {
  participations: AdminEventParticipation[];
}) {
  const stats = computeEventSatisfaction(participations);
  const responses = participations
    .filter((p) => p.satisfactionSurvey?.submittedAt)
    .map((p) => ({
      id: p.id,
      name: p.fullName || p.email,
      survey: p.satisfactionSurvey!,
    }));

  return (
    <section className="rounded-2xl border border-gray-100 bg-ns-surface p-5">
      <h3 className={FORM_SECTION_TITLE}>Résultats satisfaction</h3>
      <p className="mt-1 text-xs text-ns-secondary">
        {stats.responseCount} réponse{stats.responseCount === 1 ? "" : "s"} ·{" "}
        {stats.sentCount} questionnaire{stats.sentCount === 1 ? "" : "s"} envoyé
        {stats.sentCount === 1 ? "" : "s"}
      </p>

      {stats.responseCount === 0 ? (
        <p className="mt-4 text-sm text-ns-secondary">
          Aucune réponse pour l’instant. Les questionnaires partent ~12h après le début
          (cron quotidien).
        </p>
      ) : (
        <div className="mt-4 space-y-5">
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ns-secondary">
                Note moyenne
              </p>
              <p className="mt-1 text-4xl font-black text-ns-tertiary">
                {formatScore(stats.overall)}
                <span className="text-lg font-semibold text-ns-secondary"> / 5</span>
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ns-secondary">
                En parlerait à d’autres
              </p>
              <p className="mt-1 text-2xl font-bold text-ns-primary">
                {formatScore(stats.wouldRecommend)}
                <span className="ml-1 text-sm font-medium text-ns-secondary">/ 5</span>
              </p>
            </div>
          </div>

          <ul className="max-w-md space-y-2 sm:max-w-none sm:grid sm:grid-cols-2 sm:gap-x-8 sm:gap-y-2 sm:space-y-0">
            {CATEGORIES.map((c) => (
              <ScoreBar key={c.key} label={c.label} score={stats[c.key]} />
            ))}
          </ul>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ns-secondary">
              Réponses
            </p>
            <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-100">
              {responses.map((r) => {
                const s = r.survey;
                const parts = [
                  s.venueQuality,
                  s.menuQuality,
                  s.guestsQuality,
                  s.wouldReturn,
                  ...(typeof s.valueForMoney === "number" ? [s.valueForMoney] : []),
                  ...(typeof s.wouldRecommend === "number" ? [s.wouldRecommend] : []),
                ];
                const localAvg =
                  Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 10) / 10;
                return (
                  <li key={r.id} className="space-y-1 px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-ns-tertiary">{r.name}</span>
                      <span className="text-xs text-ns-secondary">
                        {localAvg}/5 · lieu {s.venueQuality} · menu {s.menuQuality} · sélection{" "}
                        {s.guestsQuality}
                        {typeof s.valueForMoney === "number"
                          ? ` · Q/P ${s.valueForMoney}`
                          : ""}{" "}
                        · tables {s.wouldReturn} · bouche{" "}
                        {typeof s.wouldRecommend === "number" ? s.wouldRecommend : "—"}
                      </span>
                    </div>
                    {s.comment?.trim() ? (
                      <p className="text-xs italic text-ns-secondary">« {s.comment.trim()} »</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

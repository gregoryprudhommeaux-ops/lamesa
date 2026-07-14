"use client";

import {
  computeEventSatisfaction,
  formatScore,
} from "@/lib/admin/satisfaction-stats";
import type { AdminEventParticipation } from "@/lib/types/events";
import { FORM_SECTION_TITLE } from "@/lib/ui/nextstep";

const CATEGORIES: { key: "venueQuality" | "menuQuality" | "guestsQuality" | "wouldReturn"; label: string }[] =
  [
    { key: "venueQuality", label: "Endroit" },
    { key: "menuQuality", label: "Menu" },
    { key: "guestsQuality", label: "Autres invités" },
    { key: "wouldReturn", label: "Reviendrait" },
  ];

function ScoreBar({ score, label }: { score: number | null; label: string }) {
  const pct = score === null ? 0 : Math.max(0, Math.min(100, (score / 5) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-ns-tertiary">{label}</span>
        <span className="font-bold text-ns-primary">{formatScore(score)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-ns-brand-light">
        <div
          className="h-full rounded-full bg-[#b4e600] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
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
                Inviterait quelqu’un
              </p>
              <p className="mt-1 text-2xl font-bold text-ns-primary">
                {stats.inviteYesRate ?? 0}%
                <span className="ml-1 text-sm font-medium text-ns-secondary">
                  ({stats.inviteYesCount}/{stats.responseCount})
                </span>
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {CATEGORIES.map((c) => (
              <ScoreBar key={c.key} label={c.label} score={stats[c.key]} />
            ))}
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ns-secondary">
              Réponses
            </p>
            <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-100">
              {responses.map((r) => {
                const s = r.survey;
                const localAvg =
                  Math.round(
                    ((s.venueQuality + s.menuQuality + s.guestsQuality + s.wouldReturn) / 4) * 10,
                  ) / 10;
                return (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="text-ns-tertiary">{r.name}</span>
                    <span className="text-xs text-ns-secondary">
                      {localAvg}/5 · lieu {s.venueQuality} · menu {s.menuQuality} · invités{" "}
                      {s.guestsQuality} · retour {s.wouldReturn}
                      {s.wantInviteOther
                        ? ` · invite ${s.invitedEmail ?? "oui"}`
                        : ""}
                    </span>
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

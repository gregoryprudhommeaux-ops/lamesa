"use client";

import type { EventPhaseId, EventPhaseMeta } from "@/components/admin/admin-event-phase-section";
import {
  publishStatusLabel,
  type EventNextBestAction,
  type EventOpsKpis,
} from "@/lib/admin/suggest-ops-phase";
import { BTN_PRIMARY, BTN_SECONDARY } from "@/lib/ui/nextstep";

type EventCommandHeaderProps = {
  title: string;
  modeLabel: string;
  phaseLabel: string;
  phaseSummary?: string;
  kpis: EventOpsKpis;
  blockers: string[];
  nextBestAction: EventNextBestAction;
  onDoNextBestAction: () => void;
  onResetToSuggested?: () => void;
  showResetSuggested?: boolean;
};

export function EventCommandHeader({
  title,
  modeLabel,
  phaseLabel,
  phaseSummary,
  kpis,
  blockers,
  nextBestAction,
  onDoNextBestAction,
  onResetToSuggested,
  showResetSuggested,
}: EventCommandHeaderProps) {
  return (
    <header className="space-y-3 rounded-2xl border border-ns-alternate bg-ns-surface px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ns-secondary">
            Centre de commande · {modeLabel}
          </p>
          <h3 className="truncate text-lg font-bold text-ns-hero">{title || "Nouvel événement"}</h3>
          <p className="text-sm text-ns-tertiary">
            <span className="font-semibold">Étape active :</span> {phaseLabel}
            {phaseSummary ? (
              <span className="text-ns-secondary"> — {phaseSummary}</span>
            ) : null}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            kpis.publishStatus === "published"
              ? "bg-emerald-100 text-emerald-800"
              : kpis.publishStatus === "closed"
                ? "bg-gray-200 text-gray-700"
                : "bg-amber-100 text-amber-900"
          }`}
        >
          {publishStatusLabel(kpis.publishStatus)}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi label="Capacité" value={kpis.capacity > 0 ? String(kpis.capacity) : "—"} />
        <Kpi label="Liste" value={String(kpis.roster)} />
        <Kpi label="Assis / payés" value={`${kpis.seated} / ${kpis.paid}`} />
        <Kpi
          label="À relancer €"
          value={String(kpis.unpaidAfterInvite)}
          warn={kpis.unpaidAfterInvite > 0}
        />
      </dl>

      {blockers.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <p className="font-semibold">Blocage</p>
          <ul className="mt-1 list-inside list-disc text-xs sm:text-sm">
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-ns-secondary">Aucun blocage détecté sur les signaux actuels.</p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ns-secondary">
            Action prioritaire
          </p>
          <p className="text-sm text-ns-tertiary">{nextBestAction.reason}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {showResetSuggested && onResetToSuggested ? (
            <button type="button" className={BTN_SECONDARY} onClick={onResetToSuggested}>
              Revenir à la suggestion
            </button>
          ) : null}
          <button type="button" className={BTN_PRIMARY} onClick={onDoNextBestAction}>
            {nextBestAction.label}
          </button>
        </div>
      </div>
    </header>
  );
}

function Kpi({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 ${
        warn ? "border-amber-300 bg-amber-50" : "border-gray-100 bg-white"
      }`}
    >
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-ns-secondary">{label}</dt>
      <dd className={`text-lg font-bold ${warn ? "text-amber-950" : "text-ns-hero"}`}>{value}</dd>
    </div>
  );
}

type EventPhaseNavProps = {
  phases: EventPhaseMeta[];
  activeId: EventPhaseId;
  completedIds?: EventPhaseId[];
  suggestedId?: EventPhaseId | null;
  onJump: (id: EventPhaseId) => void;
};

/** Stepper for command center — one focus, completed + suggested hints. */
export function EventCommandPhaseNav({
  phases,
  activeId,
  completedIds = [],
  suggestedId,
  onJump,
}: EventPhaseNavProps) {
  const done = new Set(completedIds);
  return (
    <nav
      aria-label="Phases de l’événement"
      className="sticky top-0 z-20 -mx-1 flex flex-wrap gap-1.5 border-b border-gray-100 bg-white/95 px-1 py-2 backdrop-blur"
    >
      {phases.map((p) => {
        const active = p.id === activeId;
        const completed = done.has(p.id) && !active;
        const suggested = suggestedId === p.id && !active;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onJump(p.id)}
            title={p.summary}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              active
                ? "bg-ns-primary text-ns-tertiary"
                : suggested
                  ? "border border-ns-primary bg-ns-primary/10 text-ns-tertiary"
                  : completed
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border border-ns-alternate bg-white text-ns-secondary hover:border-ns-primary hover:text-ns-tertiary"
            }`}
          >
            {p.number}. {p.title}
          </button>
        );
      })}
    </nav>
  );
}

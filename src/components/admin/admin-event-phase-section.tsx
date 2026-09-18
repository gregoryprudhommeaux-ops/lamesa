"use client";

import { ChevronDown } from "lucide-react";
import { type ReactNode, useId } from "react";

export type EventPhaseId =
  | "std"
  | "definitive"
  | "std_email"
  | "std_relance"
  | "formal"
  | "auto";

export type EventPhaseMeta = {
  id: EventPhaseId;
  number: number;
  title: string;
  summary?: string;
};

type EventPhaseSectionProps = {
  phase: EventPhaseMeta;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

export function EventPhaseSection({ phase, open, onToggle, children }: EventPhaseSectionProps) {
  const panelId = useId();
  return (
    <section
      id={`phase-${phase.id}`}
      className="scroll-mt-24 rounded-2xl border border-gray-100 bg-ns-surface"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-ns-brand-light/40"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ns-primary/20 text-xs font-bold text-ns-tertiary">
          {phase.number}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold uppercase tracking-wide text-ns-hero">
            {phase.title}
          </span>
          {phase.summary ? (
            <span className="mt-0.5 block text-xs text-ns-secondary">{phase.summary}</span>
          ) : null}
        </span>
        <ChevronDown
          className={`mt-0.5 h-5 w-5 shrink-0 text-ns-secondary transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div id={panelId} className="space-y-4 border-t border-gray-100 px-5 py-4">
          {children}
        </div>
      ) : null}
    </section>
  );
}

type EventPhaseNavProps = {
  phases: EventPhaseMeta[];
  activeId?: EventPhaseId | null;
  onJump: (id: EventPhaseId) => void;
};

export function EventPhaseNav({ phases, activeId, onJump }: EventPhaseNavProps) {
  return (
    <nav
      aria-label="Phases de l’événement"
      className="sticky top-0 z-20 -mx-1 flex flex-wrap gap-1.5 border-b border-gray-100 bg-white/95 px-1 py-2 backdrop-blur"
    >
      {phases.map((p) => {
        const active = p.id === activeId;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onJump(p.id)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              active
                ? "bg-ns-primary text-ns-tertiary"
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

"use client";

import { formatPeriodMonthLabel } from "@/lib/dinner-subjects/period";
import type { DinnerSubject } from "@/lib/types/events";
import { LABEL_CLASS } from "@/lib/ui/nextstep";
import { useEffect, useState } from "react";

type CatalogPayload = {
  ok?: boolean;
  past?: DinnerSubject[];
  upcoming?: DinnerSubject[];
};

type DinnerSubjectPickerProps = {
  locale: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  label: string;
  hint: string;
  pastLabel: string;
  upcomingLabel: string;
  emptyLabel: string;
};

export function DinnerSubjectPicker({
  locale,
  selectedIds,
  onChange,
  disabled,
  label,
  hint,
  pastLabel,
  upcomingLabel,
  emptyLabel,
}: DinnerSubjectPickerProps) {
  const [past, setPast] = useState<DinnerSubject[]>([]);
  const [upcoming, setUpcoming] = useState<DinnerSubject[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/dinner-subjects");
        const json = (await res.json()) as CatalogPayload;
        if (cancelled) return;
        if (!res.ok || !json.ok) {
          setLoadState("error");
          return;
        }
        setPast(json.past ?? []);
        setUpcoming(json.upcoming ?? []);
        setLoadState("ready");
      } catch {
        if (!cancelled) setLoadState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(id: string) {
    if (disabled) return;
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
      return;
    }
    if (selectedIds.length >= 12) return;
    onChange([...selectedIds, id]);
  }

  function renderGroup(title: string, subjects: DinnerSubject[]) {
    if (!subjects.length) return null;
    return (
      <fieldset className="space-y-2">
        <legend className="text-xs font-bold uppercase tracking-wide text-ns-secondary">
          {title}
        </legend>
        <ul className="space-y-2">
          {subjects.map((subject) => {
            const checked = selectedIds.includes(subject.id);
            const period = formatPeriodMonthLabel(subject.periodMonth, locale);
            return (
              <li key={subject.id}>
                <label
                  className={`flex cursor-pointer gap-3 rounded-md border px-3 py-2 text-sm transition ${
                    checked
                      ? "border-ns-primary/40 bg-ns-primary/5"
                      : "border-black/10 bg-white hover:border-black/20"
                  } ${disabled ? "opacity-60" : ""}`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-[var(--ns-primary,#0f766e)]"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggle(subject.id)}
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold text-ns-hero">{subject.title}</span>
                    <span className="block text-xs text-ns-secondary">
                      {period}
                      {subject.city ? ` · ${subject.city}` : ""}
                    </span>
                    {subject.summary ? (
                      <span className="mt-0.5 block text-xs text-ns-secondary/90">
                        {subject.summary}
                      </span>
                    ) : null}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
    );
  }

  const total = past.length + upcoming.length;

  return (
    <div className="space-y-3">
      <div>
        <p className={LABEL_CLASS}>{label}</p>
        <p className="mt-1 text-xs text-ns-secondary">{hint}</p>
      </div>
      {loadState === "loading" ? (
        <p className="text-sm text-ns-secondary">…</p>
      ) : loadState === "error" || total === 0 ? (
        <p className="text-sm text-ns-secondary">{emptyLabel}</p>
      ) : (
        <div className="space-y-4">
          {renderGroup(upcomingLabel, upcoming)}
          {renderGroup(pastLabel, past)}
        </div>
      )}
    </div>
  );
}

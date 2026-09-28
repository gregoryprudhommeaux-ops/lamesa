"use client";

import { formatPeriodMonthLabel } from "@/lib/dinner-subjects/period";
import type { DinnerSubject } from "@/lib/types/events";
import { LABEL_CLASS } from "@/lib/ui/nextstep";
import { useEffect, useMemo, useState } from "react";

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
  /** Fired when the user tries to toggle while the picker is locked. */
  onLockedClick?: () => void;
  label: string;
  hint: string;
  emptyLabel: string;
};

export function DinnerSubjectPicker({
  locale,
  selectedIds,
  onChange,
  disabled,
  onLockedClick,
  label,
  hint,
  emptyLabel,
}: DinnerSubjectPickerProps) {
  const [past, setPast] = useState<DinnerSubject[]>([]);
  const [upcoming, setUpcoming] = useState<DinnerSubject[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    const localeParam = encodeURIComponent(locale || "fr");
    void (async () => {
      try {
        const res = await fetch(`/api/dinner-subjects?locale=${localeParam}`);
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
  }, [locale]);

  const subjects = useMemo(() => {
    const byId = new Map<string, DinnerSubject>();
    for (const row of [...upcoming, ...past]) {
      if (!byId.has(row.id)) byId.set(row.id, row);
    }
    const sortLocale = locale === "en" || locale === "es" ? locale : "fr";
    return [...byId.values()].sort((a, b) => {
      if (a.periodMonth !== b.periodMonth) return a.periodMonth.localeCompare(b.periodMonth);
      return a.title.localeCompare(b.title, sortLocale);
    });
  }, [past, upcoming, locale]);

  function toggle(id: string) {
    if (disabled) {
      onLockedClick?.();
      return;
    }
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
      return;
    }
    if (selectedIds.length >= 12) return;
    onChange([...selectedIds, id]);
  }

  return (
    <div className="space-y-3">
      <div>
        <p className={LABEL_CLASS}>{label}</p>
        <p className="mt-1 text-xs text-ns-secondary">{hint}</p>
      </div>
      {loadState === "loading" ? (
        <p className="text-sm text-ns-secondary">…</p>
      ) : loadState === "error" || subjects.length === 0 ? (
        <p className="text-sm text-ns-secondary">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2">
          {subjects.map((subject) => {
            const checked = selectedIds.includes(subject.id);
            const period = formatPeriodMonthLabel(subject.periodMonth, locale);
            return (
              <li key={subject.id}>
                <button
                  type="button"
                  className={`flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left text-sm transition ${
                    checked
                      ? "border-ns-primary/40 bg-ns-primary/5"
                      : "border-black/10 bg-white hover:border-black/20"
                  } ${disabled ? "cursor-pointer opacity-70" : "cursor-pointer"}`}
                  onClick={() => toggle(subject.id)}
                  aria-pressed={checked}
                  aria-label={`${label}: ${subject.title}`}
                >
                  <span className="min-w-0 flex-1">
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
                  <span
                    className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      checked
                        ? "border-[var(--ns-primary,#0f766e)] bg-[var(--ns-primary,#0f766e)] text-white"
                        : "border-black/30 bg-white"
                    }`}
                    aria-hidden
                  >
                    {checked ? (
                      <span className="text-[10px] font-bold leading-none">✓</span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

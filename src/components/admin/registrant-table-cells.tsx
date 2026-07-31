"use client";

import { labelCityHubFr, labelPositionFr, labelSectorFr } from "@/lib/admin/waitlist-labels-fr";

export function formatRegistrantDate(iso: string): string {
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

export function CompletionCell({
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
export function WelcomeEmailCell({
  status,
  sentAt,
  isExpress,
}: {
  status: "sent" | "failed" | "skipped" | null | undefined;
  sentAt: string | null | undefined;
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

export function registrantSubtitle(parts: {
  position?: string | null;
  sector?: string | null;
  sectorOther?: string | null;
  company?: string | null;
  city?: string | null;
}): string {
  return [
    labelPositionFr(parts.position),
    labelSectorFr(parts.sector, parts.sectorOther),
    (parts.company ?? "").trim(),
    labelCityHubFr(parts.city),
  ]
    .filter((part) => Boolean(part) && part !== "—")
    .join(" · ");
}

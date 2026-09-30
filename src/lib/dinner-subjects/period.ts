/** YYYY-MM helpers for dinner-subject planning periods (no precise day). */

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidPeriodMonth(value: string): boolean {
  return PERIOD_RE.test(value.trim());
}

/** Current calendar month in America/Mexico_City as YYYY-MM. */
export function currentPeriodMonth(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

export type SubjectTimingBucket = "past" | "upcoming";

/** Past = period before current month; current + future = upcoming. */
export function subjectTimingBucket(
  periodMonth: string,
  now = new Date(),
): SubjectTimingBucket {
  const period = periodMonth.trim();
  if (!isValidPeriodMonth(period)) return "upcoming";
  return period < currentPeriodMonth(now) ? "past" : "upcoming";
}

/** Human label e.g. "septembre 2026" (locale-aware). */
export function formatPeriodMonthLabel(
  periodMonth: string,
  locale: string = "fr",
): string {
  const period = periodMonth.trim();
  if (!isValidPeriodMonth(period)) return period;
  const [y, m] = period.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, 1));
  const tag = locale === "en" ? "en-US" : locale === "es" ? "es-MX" : "fr-FR";
  return new Intl.DateTimeFormat(tag, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    date,
  );
}

/**
 * Suggest a concrete YYYY-MM-DD when composing a dinner from a period-only subject.
 * Uses the 15th of the planning month (mid-period placeholder — admin can edit).
 */
export function periodMonthToSuggestedDate(periodMonth: string): string | undefined {
  const period = periodMonth.trim();
  if (!isValidPeriodMonth(period)) return undefined;
  return `${period}-15`;
}

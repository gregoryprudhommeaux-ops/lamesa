import type { DinnerSubject, DinnerSubjectLocale } from "@/lib/types/events";

export const DINNER_SUBJECT_LOCALES: DinnerSubjectLocale[] = ["fr", "en", "es"];

export function isDinnerSubjectLocale(value: string): value is DinnerSubjectLocale {
  return (DINNER_SUBJECT_LOCALES as readonly string[]).includes(value);
}

export function resolveSubjectSourceLocale(
  subject: Pick<DinnerSubject, "sourceLocale">,
): DinnerSubjectLocale {
  return subject.sourceLocale === "en" || subject.sourceLocale === "es"
    ? subject.sourceLocale
    : "fr";
}

/** Pick title/summary for a UI locale — falls back to source fields. */
export function localizeDinnerSubject(
  subject: DinnerSubject,
  locale: DinnerSubjectLocale,
): DinnerSubject {
  const source = resolveSubjectSourceLocale(subject);
  const title =
    subject.titleI18n?.[locale]?.trim() ||
    (locale === source ? subject.title : "") ||
    subject.titleI18n?.[source]?.trim() ||
    subject.title;
  const summary =
    subject.summaryI18n?.[locale]?.trim() ||
    (locale === source ? subject.summary : undefined) ||
    subject.summaryI18n?.[source]?.trim() ||
    subject.summary;
  return {
    ...subject,
    title,
    summary: summary || undefined,
  };
}

export function localizeDinnerSubjectList(
  subjects: DinnerSubject[],
  locale: DinnerSubjectLocale,
): DinnerSubject[] {
  return subjects.map((s) => localizeDinnerSubject(s, locale));
}

/** True when a locale still needs a stored translation. */
export function subjectMissingLocale(
  subject: Pick<DinnerSubject, "titleI18n" | "summaryI18n" | "sourceLocale" | "summary">,
  locale: DinnerSubjectLocale,
): boolean {
  const source = resolveSubjectSourceLocale(subject);
  if (locale === source) {
    return !subject.titleI18n?.[source]?.trim();
  }
  if (!subject.titleI18n?.[locale]?.trim()) return true;
  if (subject.summary?.trim() && !subject.summaryI18n?.[locale]?.trim()) return true;
  return false;
}

/** True when any of fr/en/es is missing from stored maps. */
export function subjectIncompleteI18n(
  subject: Pick<DinnerSubject, "titleI18n" | "summaryI18n" | "sourceLocale" | "summary">,
): boolean {
  for (const locale of DINNER_SUBJECT_LOCALES) {
    if (subjectMissingLocale(subject, locale)) return true;
  }
  return false;
}

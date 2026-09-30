import type {
  DinnerSubject,
  DinnerSubjectInterest,
  DinnerSubjectInterestValidation,
} from "@/lib/types/events";

const MAX_SUBJECT_INTERESTS = 12;

export function clampSubjectIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = raw.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MAX_SUBJECT_INTERESTS) break;
  }
  return out;
}

/** Build pending interest rows from catalog subjects selected by the member. */
export function buildDeclaredSubjectInterests(
  subjectIds: string[],
  catalog: DinnerSubject[],
  nowIso = new Date().toISOString(),
): DinnerSubjectInterest[] {
  const byId = new Map(catalog.map((s) => [s.id, s]));
  return clampSubjectIds(subjectIds).flatMap((id) => {
    const subject = byId.get(id);
    if (!subject) return [];
    return [
      {
        subjectId: subject.id,
        title: subject.title,
        periodMonth: subject.periodMonth,
        city: subject.city,
        declaredAt: nowIso,
        validation: "pending" as const,
      },
    ];
  });
}

/**
 * Merge member subject picks into existing interests.
 * Keeps admin validation when the same subjectId is re-declared.
 * Drops subjects no longer selected.
 */
export function mergeSubjectInterests(
  previous: DinnerSubjectInterest[] | undefined,
  nextDeclared: DinnerSubjectInterest[],
): DinnerSubjectInterest[] {
  const prevById = new Map((previous ?? []).map((row) => [row.subjectId, row]));
  return nextDeclared.map((row) => {
    const prev = prevById.get(row.subjectId);
    if (!prev) return row;
    if (prev.validation === "validated" || prev.validation === "rejected") {
      return {
        ...row,
        validation: prev.validation,
        validatedAt: prev.validatedAt,
        validationNote: prev.validationNote,
        declaredAt: prev.declaredAt,
      };
    }
    return { ...row, declaredAt: prev.declaredAt };
  });
}

export function setSubjectInterestValidation(
  interests: DinnerSubjectInterest[] | undefined,
  subjectId: string,
  validation: Exclude<DinnerSubjectInterestValidation, "pending">,
  note?: string,
  nowIso = new Date().toISOString(),
): DinnerSubjectInterest[] | null {
  const list = interests ?? [];
  const idx = list.findIndex((row) => row.subjectId === subjectId);
  if (idx < 0) return null;
  const next = [...list];
  next[idx] = {
    ...next[idx]!,
    validation,
    validatedAt: nowIso,
    validationNote: note?.trim() || undefined,
  };
  return next;
}

/** Titles that feed table-matching / theme scan (admin-validated only). */
export function validatedSubjectTitles(
  interests: DinnerSubjectInterest[] | undefined,
): string[] {
  return (interests ?? [])
    .filter((row) => row.validation === "validated" && row.title.trim())
    .map((row) => row.title.trim());
}

/** Free-text themes + validated catalog titles for scoring / AI cards. */
export function composeDinnerThemesForMatching(
  freeText: string | undefined,
  interests: DinnerSubjectInterest[] | undefined,
): string {
  const parts = [freeText?.trim(), ...validatedSubjectTitles(interests)].filter(Boolean);
  return parts.join(" · ");
}

/** True when the member has at least one catalog pick (any validation). */
export function hasDeclaredSubjectInterest(
  interests: DinnerSubjectInterest[] | undefined,
): boolean {
  return Boolean(interests?.some((row) => row.subjectId && row.title.trim()));
}

export { MAX_SUBJECT_INTERESTS };

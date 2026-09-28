import "server-only";

import { translatePlainText } from "@/lib/email/translate-template";
import {
  DINNER_SUBJECT_LOCALES,
  resolveSubjectSourceLocale,
} from "@/lib/dinner-subjects/localize";
import type { DinnerSubject, DinnerSubjectLocale } from "@/lib/types/events";

export { subjectIncompleteI18n, subjectMissingLocale } from "@/lib/dinner-subjects/localize";

export type SubjectI18nMaps = {
  sourceLocale: DinnerSubjectLocale;
  titleI18n: Partial<Record<DinnerSubjectLocale, string>>;
  summaryI18n: Partial<Record<DinnerSubjectLocale, string>>;
};

/**
 * Build title/summary translations for all locales.
 * Source locale keeps the authored text; others are machine-translated.
 * On translate failure for a target, falls back to source text.
 */
export async function buildSubjectI18nMaps(input: {
  title: string;
  summary?: string;
  sourceLocale?: DinnerSubjectLocale;
  previous?: Pick<DinnerSubject, "titleI18n" | "summaryI18n" | "sourceLocale" | "title" | "summary">;
}): Promise<SubjectI18nMaps> {
  const sourceLocale = input.sourceLocale ?? resolveSubjectSourceLocale(input.previous ?? {});
  const title = input.title.trim();
  const summary = (input.summary ?? "").trim();

  const titleI18n: Partial<Record<DinnerSubjectLocale, string>> = {
    ...(input.previous?.titleI18n ?? {}),
    [sourceLocale]: title,
  };
  const summaryI18n: Partial<Record<DinnerSubjectLocale, string>> = {
    ...(input.previous?.summaryI18n ?? {}),
  };
  if (summary) summaryI18n[sourceLocale] = summary;
  else delete summaryI18n[sourceLocale];

  const titleChanged = !input.previous || input.previous.title.trim() !== title;
  const summaryChanged =
    !input.previous || (input.previous.summary ?? "").trim() !== summary;

  const targets = DINNER_SUBJECT_LOCALES.filter((loc) => loc !== sourceLocale);

  await Promise.all(
    targets.map(async (to) => {
      if (titleChanged || !titleI18n[to]?.trim()) {
        try {
          titleI18n[to] = title
            ? await translatePlainText(title, sourceLocale, to, {
                allowPublicFallback: true,
              })
            : "";
        } catch (error) {
          console.warn("[dinner-subjects/translate] title failed", { to, error });
          titleI18n[to] = title;
        }
      }
      if (!summary) {
        delete summaryI18n[to];
        return;
      }
      if (summaryChanged || !summaryI18n[to]?.trim()) {
        try {
          summaryI18n[to] = await translatePlainText(summary, sourceLocale, to, {
            allowPublicFallback: true,
          });
        } catch (error) {
          console.warn("[dinner-subjects/translate] summary failed", { to, error });
          summaryI18n[to] = summary;
        }
      }
    }),
  );

  return { sourceLocale, titleI18n, summaryI18n };
}

import {
  escapeEmailHtml,
  richTextToEmailHtml,
} from "@/lib/email/la-mesa-email-shell";
import type { TemplateLocale } from "@/lib/types/events";

export function satisfactionSurveyCtaLabel(locale: TemplateLocale): string {
  if (locale === "en") return "Share feedback";
  if (locale === "fr") return "Donner mon avis";
  return "Dar mi opinión";
}

/** Lime pill CTA — URL lives on the button, not as visible text. */
export function satisfactionSurveyButtonHtml(
  surveyUrl: string,
  locale: TemplateLocale,
): string {
  const cta = satisfactionSurveyCtaLabel(locale);
  return `<a href="${escapeEmailHtml(surveyUrl)}" style="display:inline-block;background:#b4e600;color:#111;text-decoration:none;font-weight:700;font-size:14px;padding:12px 18px;border-radius:999px;">${escapeEmailHtml(cta)}</a>`;
}

/**
 * Body HTML for satisfaction mails: drop the raw survey URL line (button carries the CTA).
 */
export function satisfactionBodyToHtml(bodyText: string, surveyUrl: string): string {
  let prepared = bodyText;
  if (surveyUrl) {
    prepared = prepared.split(surveyUrl).join("");
  }
  prepared = prepared
    .replace(/\{\{\s*surveyUrl\s*\}\}/g, "")
    .replace(/https?:\/\/[^\s<>"]*\/(?:es|fr|en)\/satisfaction(?:\?[^\s<>"]*)?/gi, "")
    .replace(/https?:\/\/[^\s<>"]*\/(?:es|fr|en)\/survey\/[^\s<>"]*/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return richTextToEmailHtml(prepared);
}

/** Public preview URL used in admin “send test” (no real participation token). */
export function satisfactionTestSurveyUrl(base: string, locale: TemplateLocale): string {
  return `${base.replace(/\/$/, "")}/${locale}/satisfaction?preview=1`;
}

/**
 * Match custom / STD template keys to event slugs (Save the Date, relances…).
 */

const MONTH_SHORT = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
] as const;

/** Known relance keys → event slug (when the key alone does not embed the slug). */
const RELANCE_TEMPLATE_SLUGS: Readonly<Record<string, string>> = {
  custom_relance_a_suivre_std_24_sept: "dirigeants-fr-2026-09-24",
};

function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

function dateFragmentsFromSlug(slug: string): string[] {
  const s = slug.trim().toLowerCase();
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return [];
  const [, y, mo, d] = m;
  const day = parseInt(d, 10);
  const monthIdx = parseInt(mo, 10) - 1;
  if (!Number.isFinite(day) || monthIdx < 0 || monthIdx > 11) return [];
  const monthShort = MONTH_SHORT[monthIdx];
  return [
    `${y}_${mo}_${d}`,
    `${y}-${mo}-${d}`,
    `${day}_${mo}`,
    `${day}_${monthShort}`,
    `${day}_sept`,
    `${day}_septembre`,
  ];
}

/** True for follow-up templates tied to a Save the Date (not the initial blast). */
export function isStdRelanceTemplateKey(templateKey: string): boolean {
  const key = normalizeKey(templateKey);
  if (!key) return false;
  if (key in RELANCE_TEMPLATE_SLUGS) return true;
  return key.includes("_std_") && (key.includes("relance") || key.includes("follow"));
}

/**
 * Infer event slug from a template key (custom_dirigeants_fr_2026_09_24, relance STD…).
 */
export function eventSlugFromOutreachTemplateKey(templateKey: string): string | null {
  const key = normalizeKey(templateKey);
  if (!key) return null;
  if (key in RELANCE_TEMPLATE_SLUGS) return RELANCE_TEMPLATE_SLUGS[key];

  const m = key.match(/^custom_(.+)$/);
  if (!m?.[1]) return null;
  const body = m[1];
  if (isStdRelanceTemplateKey(key)) return null;
  if (!looksLikeEventSlugBody(body)) return null;
  const slug = body.replace(/_/g, "-");
  return slug || null;
}

function looksLikeEventSlugBody(body: string): boolean {
  return /\d{4}[-_]\d{2}[-_]\d{2}/.test(body);
}

/** Whether a sent template key counts as outreach for this event slug. */
export function templateKeyMatchesEventSlug(
  templateKey: string,
  eventSlug: string,
): boolean {
  const key = normalizeKey(templateKey);
  const slug = eventSlug.trim().toLowerCase();
  if (!key || !slug) return false;
  if (key === "save_the_date") return true;

  const slugUnderscore = slug.replace(/-/g, "_");
  if (key.includes(slug) || key.includes(slugUnderscore)) return true;

  const mapped = RELANCE_TEMPLATE_SLUGS[key];
  if (mapped && mapped === slug) return true;

  if (key.includes("_std_")) {
    const fragments = dateFragmentsFromSlug(slug);
    if (fragments.some((f) => key.includes(f))) return true;
  }

  return false;
}

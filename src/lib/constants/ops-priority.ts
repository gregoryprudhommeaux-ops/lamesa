/**
 * Ops prioritization for waitlist members (admin cockpit).
 * Stored on the waitlist doc — not synced to Database Perso.
 */
export const OPS_PRIORITIES = [
  "priority",
  "normal",
  "review",
  "low",
] as const;

export type OpsPriority = (typeof OPS_PRIORITIES)[number];

export const DEFAULT_OPS_PRIORITY: OpsPriority = "normal";

export const OPS_PRIORITY_LABELS_FR: Record<OpsPriority, string> = {
  priority: "À prioriser",
  normal: "Normal",
  review: "À revoir",
  low: "Déprioriser",
};

/** Suggested tags — free text also allowed. */
export const OPS_SUGGESTED_TAGS = [
  "no-show",
  "vip",
  "partner-fit",
  "bien-a-table",
] as const;

export function resolveOpsPriority(value: unknown): OpsPriority {
  if (typeof value === "string" && (OPS_PRIORITIES as readonly string[]).includes(value)) {
    return value as OpsPriority;
  }
  return DEFAULT_OPS_PRIORITY;
}

export function normalizeOpsTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const tag = item.trim().toLowerCase().slice(0, 40);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= 12) break;
  }
  return out;
}

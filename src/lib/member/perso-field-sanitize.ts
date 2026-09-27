import { normalizeLinkedInUrl } from "@/lib/linkedin";

/** Strip annotations like "(Whatsapp only)" and keep a dialable E.164-ish value. */
export function sanitizePhoneForPerso(raw: string | undefined | null): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";

  // Keep leading +, digits, and spaces/dashes long enough to parse — then compact.
  const withoutParens = trimmed.replace(/\([^)]*\)/g, " ").replace(/\[[^\]]*\]/g, " ");
  const cleaned = withoutParens.replace(/[^\d+]/g, "");
  if (!cleaned) return "";

  // Reject obvious junk (too short / too long).
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return "";

  return cleaned.startsWith("+") ? `+${digits}` : digits;
}

export function sanitizeLinkedInForPerso(raw: string | undefined | null): string {
  return normalizeLinkedInUrl((raw ?? "").trim());
}

export function truncatePersoText(value: string | undefined, max: number): string | undefined {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return undefined;
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

export function sanitizeStringList(
  values: string[] | undefined,
  maxItems: number,
  maxItemLength: number,
): string[] | undefined {
  if (!values?.length) return undefined;
  const cleaned = values
    .map((value) => truncatePersoText(value, maxItemLength))
    .filter((value): value is string => Boolean(value))
    .slice(0, maxItems);
  return cleaned.length ? cleaned : undefined;
}

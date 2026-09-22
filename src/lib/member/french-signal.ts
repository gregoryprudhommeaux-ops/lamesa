import { isFranconetworkMember } from "@/lib/member/franconetwork-member";

type FrenchSignalInput = {
  source?: string | null;
  locale?: string | null;
  tags?: string[] | null;
  lists?: string[] | null;
  communicationLanguage?: string | null;
};

/**
 * Heuristic “contact français” used for outreach shortlists.
 * No nationality field on LA MESA waitlist/prospects — locale / FN / tags / lists.
 */
export function isFrenchSignal(input: FrenchSignalInput): boolean {
  if (
    isFranconetworkMember({
      source: input.source ?? "",
      tags: input.tags ?? [],
    })
  ) {
    return true;
  }
  const locale = (input.locale ?? input.communicationLanguage ?? "").trim().toLowerCase();
  if (locale === "fr" || locale.startsWith("fr-")) return true;
  const tags = (input.tags ?? []).map((t) => String(t).toLowerCase());
  if (tags.some((t) => t.includes("french") || t.includes("francais") || t.includes("français"))) {
    return true;
  }
  const lists = (input.lists ?? []).map((l) => String(l).toLowerCase());
  if (
    lists.some(
      (l) =>
        l.includes("shortlist fr") ||
        l.includes("francais") ||
        l.includes("français") ||
        l.includes("dirigeants-fr") ||
        l.includes("french"),
    )
  ) {
    return true;
  }
  return false;
}

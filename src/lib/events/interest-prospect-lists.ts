import type { EventInterestResponse } from "@/lib/types/events";
import type { ProspectStatus } from "@/lib/types/prospects";

export type InterestListPair = {
  yes: string;
  noOther: string;
};

/** Stable Prospect playlist names for a Save the Date / interest event. */
export function interestProspectListNames(eventSlug: string): InterestListPair {
  const slug = eventSlug.trim() || "event";
  return {
    yes: `STD ${slug} — OUI`,
    noOther: `STD ${slug} — NON/AUTRE`,
  };
}

function uniqStrings(values: string[]): string[] {
  return [...new Set(values.map((t) => t.trim()).filter(Boolean))];
}

/** Extract STD event slugs from playlist names like `STD slug — OUI`. */
export function extractStdEventSlugsFromLists(lists: string[] | undefined): string[] {
  const slugs = new Set<string>();
  for (const raw of lists ?? []) {
    const m = raw.trim().match(/^STD\s+(.+?)\s+[—–-]\s+/i);
    if (m?.[1]?.trim()) slugs.add(m[1].trim());
  }
  return [...slugs];
}

export function applyInterestListMembership(
  existingLists: string[] | undefined,
  lists: InterestListPair,
  interestResponse: EventInterestResponse,
): string[] {
  const yesKey = lists.yes.toLowerCase();
  const noKey = lists.noOther.toLowerCase();
  const without = (existingLists ?? []).filter((l) => {
    const key = l.trim().toLowerCase();
    return key !== yesKey && key !== noKey;
  });
  const target = interestResponse === "yes" ? lists.yes : lists.noOther;
  return uniqStrings([...without, target]);
}

function clearOuiNonLists(existingLists: string[] | undefined, pair: InterestListPair): string[] {
  const yesKey = pair.yes.toLowerCase();
  const noKey = pair.noOther.toLowerCase();
  return (existingLists ?? []).filter((l) => {
    const key = l.trim().toLowerCase();
    return key !== yesKey && key !== noKey;
  });
}

/**
 * Keep STD OUI / NON playlists aligned with CRM status.
 * - won → OUI
 * - no_not_* → NON/AUTRE
 * - still-in-play statuses → drop OUI/NON (keep shortlist)
 */
export function applyProspectStatusToStdLists(
  existingLists: string[] | undefined,
  status: ProspectStatus,
): string[] {
  const slugs = extractStdEventSlugsFromLists(existingLists);
  if (slugs.length === 0) return uniqStrings(existingLists ?? []);

  let next = [...(existingLists ?? [])];
  for (const slug of slugs) {
    const pair = interestProspectListNames(slug);
    if (status === "won") {
      next = applyInterestListMembership(next, pair, "yes");
    } else if (status === "no_not_available" || status === "no_not_interested") {
      next = applyInterestListMembership(next, pair, "no");
    } else if (
      status === "to_follow" ||
      status === "no_response" ||
      status === "contacted" ||
      status === "to_contact"
    ) {
      next = clearOuiNonLists(next, pair);
    }
  }
  return uniqStrings(next);
}

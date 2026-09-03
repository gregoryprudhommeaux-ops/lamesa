import type { EventInterestResponse } from "@/lib/types/events";

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

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

/** Auto-synced playlist: contactés sans OUI/NON — même logique que le dashboard. */
export function interestSansReponseListName(eventSlug: string): string {
  const slug = eventSlug.trim() || "event";
  return `STD ${slug} — SANS RÉPONSE`;
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

function stdSlugPrefix(slug: string): string {
  return `std ${slug.trim().toLowerCase()}`;
}

/** True for SHORTLIST / campagne lists — not OUI, NON/AUTRE, nor SANS RÉPONSE. */
export function isStdCampaignListForSlug(listName: string, slug: string): boolean {
  const key = listName.trim().toLowerCase();
  const prefix = stdSlugPrefix(slug);
  if (!key.startsWith(prefix)) return false;
  const pair = interestProspectListNames(slug);
  const sansReponse = interestSansReponseListName(slug).toLowerCase();
  return (
    key !== pair.yes.toLowerCase() &&
    key !== pair.noOther.toLowerCase() &&
    key !== sansReponse
  );
}

/** Drop every STD playlist for an event (shortlist included) except `keepList` if set. */
export function stripStdEventLists(
  existingLists: string[] | undefined,
  slug: string,
  keepList?: string,
): string[] {
  const prefix = stdSlugPrefix(slug);
  const keepKey = keepList?.trim().toLowerCase() ?? "";
  return (existingLists ?? []).filter((l) => {
    const key = l.trim().toLowerCase();
    if (!key.startsWith(prefix)) return true;
    if (keepKey && key === keepKey) return true;
    return false;
  });
}

export function applyInterestListMembership(
  existingLists: string[] | undefined,
  lists: InterestListPair,
  interestResponse: EventInterestResponse,
): string[] {
  const slug = extractStdEventSlugsFromLists([lists.yes, lists.noOther])[0];
  const target = interestResponse === "yes" ? lists.yes : lists.noOther;
  const withoutStd = slug
    ? stripStdEventLists(existingLists, slug)
    : (existingLists ?? []).filter((l) => {
        const key = l.trim().toLowerCase();
        return (
          key !== lists.yes.toLowerCase() && key !== lists.noOther.toLowerCase()
        );
      });
  return uniqStrings([...withoutStd, target]);
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

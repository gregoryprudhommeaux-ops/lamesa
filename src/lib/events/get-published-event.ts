import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { mapPublishedEventDoc } from "@/lib/events/map-published-event";
import type { AdminEvent } from "@/lib/types/events";
import { unstable_cache } from "next/cache";
import { cache } from "react";

async function fetchPublishedEventBySlug(slug: string): Promise<AdminEvent | null> {
  if (!slug.trim() || !isFirebaseAdminConfigured()) return null;
  try {
    const snap = await getAdminFirestore()
      .collection(COLLECTIONS.events)
      .where("slug", "==", slug)
      .where("status", "==", "published")
      .limit(1)
      .get();
    if (snap.empty) return null;
    const doc = snap.docs[0]!;
    return mapPublishedEventDoc(doc.id, slug, doc.data() as Record<string, unknown>);
  } catch (error) {
    console.error("[getPublishedEventBySlug]", error);
    return null;
  }
}

/**
 * Server-side published event for `/e/[slug]`.
 * React `cache` dedupes metadata + page in one request; `unstable_cache` reuses across requests (~60s).
 */
export const getPublishedEventBySlug = cache(async (slug: string): Promise<AdminEvent | null> => {
  const normalized = slug.trim();
  if (!normalized) return null;
  if (!isFirebaseAdminConfigured()) return null;

  return unstable_cache(
    () => fetchPublishedEventBySlug(normalized),
    ["published-event-by-slug", normalized],
    { revalidate: 60, tags: [`event-slug:${normalized}`] },
  )();
});

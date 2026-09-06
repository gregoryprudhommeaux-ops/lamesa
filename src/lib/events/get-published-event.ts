import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { mapPublishedEventDoc } from "@/lib/events/map-published-event";
import type { AdminEvent } from "@/lib/types/events";

/** Server-side published event for the public `/e/[slug]` page (avoids slow client Firestore). */
export async function getPublishedEventBySlug(slug: string): Promise<AdminEvent | null> {
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

import { COLLECTIONS, getAdminFirestore } from "@/lib/firebase/admin";
import { ttlGet, ttlSet, ttlDelete } from "@/lib/firebase/ttl-cache";
import type {
  AdminEvent,
  AdminEventParticipation,
  WaitlistRegistration,
} from "@/lib/types/events";

/** Caps sized for LA MESA today; raise deliberately when volume grows. */
export const ADMIN_SCAN = {
  events: 50,
  participations: 400,
  waitlist: 400,
  drafts: 15,
} as const;

const CACHE_KEY = "admin-core-collections";
/** Avoid re-scanning the same three collections within one admin session burst. */
const CACHE_TTL_MS = 45_000;

export type AdminCoreCollections = {
  events: AdminEvent[];
  participations: AdminEventParticipation[];
  waitlist: WaitlistRegistration[];
  fromCache: boolean;
};

export function invalidateAdminCoreCollectionsCache(): void {
  ttlDelete(CACHE_KEY);
}

export async function loadAdminCoreCollections(options?: {
  force?: boolean;
}): Promise<AdminCoreCollections> {
  if (!options?.force) {
    const cached = ttlGet<Omit<AdminCoreCollections, "fromCache">>(CACHE_KEY);
    if (cached) return { ...cached, fromCache: true };
  }

  const db = getAdminFirestore();
  const [eventsSnap, partsSnap, waitlistSnap] = await Promise.all([
    db.collection(COLLECTIONS.events).limit(ADMIN_SCAN.events).get(),
    db.collection(COLLECTIONS.participations).limit(ADMIN_SCAN.participations).get(),
    db.collection(COLLECTIONS.waitlist).limit(ADMIN_SCAN.waitlist).get(),
  ]);

  const payload = {
    events: eventsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<AdminEvent, "id">),
    })),
    participations: partsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<AdminEventParticipation, "id">),
    })),
    waitlist: waitlistSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<WaitlistRegistration, "id">),
    })),
  };

  ttlSet(CACHE_KEY, payload, CACHE_TTL_MS);
  return { ...payload, fromCache: false };
}

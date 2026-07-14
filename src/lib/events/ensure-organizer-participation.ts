import { primaryOrganizerEmail } from "@/lib/email/event-mail-addressing";
import { normalizeEmail } from "@/lib/auth/platform-admin";
import { COLLECTIONS } from "@/lib/firebase/admin";
import type { Firestore } from "firebase-admin/firestore";

/**
 * Ensures the platform organizer is seated on the event (does not use a guest seat).
 * Calendar invite / ICS reminders go to this participation when invitations are launched.
 */
export async function ensureOrganizerParticipation(
  db: Firestore,
  eventId: string,
  now = new Date().toISOString(),
): Promise<void> {
  const email = normalizeEmail(primaryOrganizerEmail());
  const existing = await db
    .collection(COLLECTIONS.participations)
    .where("eventId", "==", eventId)
    .get();

  const hit = existing.docs.find(
    (d) => normalizeEmail(String(d.data().email ?? "")) === email,
  );

  if (hit) {
    const data = hit.data();
    if (!data.isOrganizer) {
      await hit.ref.set({ isOrganizer: true, updatedAt: now }, { merge: true });
    }
    return;
  }

  await db.collection(COLLECTIONS.participations).add({
    eventId,
    email,
    fullName: "Gregory Prudhommeaux",
    companyName: "LA MESA",
    status: "confirmed",
    statusSource: "admin",
    isOrganizer: true,
    createdAt: now,
    updatedAt: now,
  });
}

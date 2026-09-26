import { primaryOrganizerEmail } from "@/lib/email/event-mail-addressing";
import { normalizeEmail } from "@/lib/auth/platform-admin";
import { COLLECTIONS } from "@/lib/firebase/admin";
import { isOrganizerParticipation } from "@/lib/events/capacity";
import type { Firestore } from "firebase-admin/firestore";

/**
 * Ensures the platform organizer is seated on the event (does not use a guest seat).
 * Status is always **Invité** (`comped`): COST yes, CA no — seat absorbed by event margin.
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

  const hits = existing.docs.filter((d) => {
    const data = d.data();
    return (
      normalizeEmail(String(data.email ?? "")) === email ||
      isOrganizerParticipation({
        email: String(data.email ?? ""),
        isOrganizer: data.isOrganizer,
        fullName: data.fullName != null ? String(data.fullName) : undefined,
      })
    );
  });

  if (hits.length > 0) {
    await Promise.all(
      hits.map(async (hit) => {
        const data = hit.data();
        const patch: Record<string, unknown> = { updatedAt: now };
        if (!data.isOrganizer) patch.isOrganizer = true;
        // Organizer is never a paying seat — normalize legacy `confirmed` → Invité.
        if (String(data.status ?? "") !== "comped") patch.status = "comped";
        if (Object.keys(patch).length > 1) {
          await hit.ref.set(patch, { merge: true });
        }
      }),
    );
    return;
  }

  await db.collection(COLLECTIONS.participations).add({
    eventId,
    email,
    fullName: "Gregory Prudhommeaux",
    companyName: "LA MESA",
    status: "comped",
    statusSource: "admin",
    isOrganizer: true,
    createdAt: now,
    updatedAt: now,
  });
}

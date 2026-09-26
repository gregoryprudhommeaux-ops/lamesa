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

  const hit =
    existing.docs.find(
      (d) => normalizeEmail(String(d.data().email ?? "")) === email,
    ) ??
    existing.docs.find((d) =>
      isOrganizerParticipation({
        email: String(d.data().email ?? ""),
        isOrganizer: d.data().isOrganizer,
        fullName: d.data().fullName != null ? String(d.data().fullName) : null,
      }),
    );

  if (hit) {
    const data = hit.data();
    const patch: Record<string, unknown> = { updatedAt: now };
    if (!data.isOrganizer) patch.isOrganizer = true;
    // Organizer is never a paying seat — normalize legacy `confirmed` → Invité.
    if (String(data.status ?? "") !== "comped") patch.status = "comped";
    if (Object.keys(patch).length > 1) {
      await hit.ref.set(patch, { merge: true });
    }
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

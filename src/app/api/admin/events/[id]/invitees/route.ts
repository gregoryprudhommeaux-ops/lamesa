import { NextResponse } from "next/server";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { normalizeEmail } from "@/lib/auth/platform-admin";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  nextInviteStatus,
  isOrganizerParticipation,
  isSeatedStatus,
  DEFAULT_GUEST_CAPACITY,
} from "@/lib/events/capacity";
import { ensureOrganizerParticipation } from "@/lib/events/ensure-organizer-participation";
import { ensureWaitlistProfileByEmail } from "@/lib/member/ensure-waitlist-for-auth";
import { z } from "zod";

const inviteesSchema = z.object({
  inviteEmails: z
    .array(
      z.object({
        email: z.string().email(),
        fullName: z.string().optional(),
        companyName: z.string().optional(),
        contactId: z.string().optional(),
        status: z.enum(["invited", "waitlist"]).optional(),
      }),
    )
    .min(1)
    .max(200),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const { id: eventId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = inviteesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const eventRef = db.collection(COLLECTIONS.events).doc(eventId);
  const eventSnap = await eventRef.get();
  if (!eventSnap.exists) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const eventLang = String(eventSnap.data()?.eventLanguage ?? "fr");
  const locale = eventLang === "en" || eventLang === "es" ? eventLang : "fr";
  const now = new Date().toISOString();
  const capacity = Number(eventSnap.data()?.capacity ?? DEFAULT_GUEST_CAPACITY);
  const existing = await db
    .collection(COLLECTIONS.participations)
    .where("eventId", "==", eventId)
    .get();
  const existingEmails = new Set(
    existing.docs.map((d) => normalizeEmail(String(d.data().email ?? ""))),
  );
  let seated = existing.docs.filter((d) => {
    const data = d.data();
    if (isOrganizerParticipation({ email: String(data.email ?? ""), isOrganizer: data.isOrganizer })) {
      return false;
    }
    return isSeatedStatus(String(data.status ?? ""));
  }).length;

  let added = 0;
  let skipped = 0;
  let waitlisted = 0;
  let waitlistProvisioned = 0;

  try {
    await ensureOrganizerParticipation(db, eventId, now);

    for (const inv of parsed.data.inviteEmails) {
      const email = normalizeEmail(inv.email);
      if (!email || existingEmails.has(email)) {
        skipped += 1;
        continue;
      }
      if (isOrganizerParticipation({ email })) {
        skipped += 1;
        continue;
      }
      const preferred = inv.status;
      const status =
        preferred === "waitlist"
          ? "waitlist"
          : nextInviteStatus(capacity, seated);
      if (status === "invited") seated += 1;
      else waitlisted += 1;

      const ensured = await ensureWaitlistProfileByEmail({
        email,
        fullName: inv.fullName,
        company: inv.companyName,
        locale,
        source: "la-mesa-std-invite",
      });
      if (ensured?.provisioned || ensured?.revived) {
        waitlistProvisioned += 1;
      }

      await db.collection(COLLECTIONS.participations).add({
        eventId,
        email,
        fullName: inv.fullName ?? ensured?.fullName ?? null,
        companyName: inv.companyName ?? ensured?.company ?? null,
        contactId: inv.contactId ?? ensured?.id ?? null,
        status,
        statusSource: "admin",
        createdAt: now,
        updatedAt: now,
      });
      existingEmails.add(email);
      added += 1;
      if (status === "invited" || status === "waitlist") {
        void import("@/lib/contacts/activities-store").then(({ recordContactActivity }) =>
          recordContactActivity({
            email,
            type: "invited_event",
            source: "admin",
            summary:
              status === "waitlist"
                ? "Ajouté en waitlist événement"
                : "Invité à un événement LA MESA",
            refs: { eventId },
            meta: { status },
          }),
        );
      }
    }

    await eventRef.set({ updatedAt: now }, { merge: true });
    return NextResponse.json({
      ok: true,
      added,
      skipped,
      waitlisted,
      waitlistProvisioned,
    });
  } catch (error) {
    console.error("[admin/events invitees POST]", error);
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 502 });
  }
}

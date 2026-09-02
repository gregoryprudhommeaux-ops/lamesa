import { NextResponse } from "next/server";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { sendSaveTheDateEmail } from "@/lib/email/send-save-the-date";
import { isOrganizerParticipation } from "@/lib/events/capacity";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import type { AdminEvent, AdminEventParticipation } from "@/lib/types/events";
import { z } from "zod";

const sendSchema = z.object({
  participationIds: z.array(z.string().min(1)).optional(),
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
    body = {};
  }

  const parsed = sendSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const eventSnap = await db.collection(COLLECTIONS.events).doc(eventId).get();
  if (!eventSnap.exists) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const event = { id: eventSnap.id, ...(eventSnap.data() as Omit<AdminEvent, "id">) };

  const partsSnap = await db
    .collection(COLLECTIONS.participations)
    .where("eventId", "==", eventId)
    .get();

  const idFilter = parsed.data.participationIds?.length
    ? new Set(parsed.data.participationIds)
    : null;

  const recipients = partsSnap.docs
    .map((d) => {
      const p = { id: d.id, ...(d.data() as Omit<AdminEventParticipation, "id">) };
      return { ...p, status: normalizeParticipationStatus(p.status) };
    })
    .filter((p) => (idFilter ? idFilter.has(p.id) : true))
    .filter((p) => !isOrganizerParticipation(p))
    .filter((p) => p.status === "invited" || p.status === "waitlist")
    .filter((p) => String(p.email ?? "").includes("@"));

  if (recipients.length === 0) {
    return NextResponse.json({ ok: false, error: "no_recipients" }, { status: 400 });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const participation of recipients) {
    const result = await sendSaveTheDateEmail({ event, participation });
    if ("skipped" in result && result.skipped) {
      skipped += 1;
      continue;
    }
    if (!result.ok) {
      failed += 1;
      errors.push(`${participation.email}: ${result.error}`);
      continue;
    }
    sent += 1;
    await db.collection(COLLECTIONS.participations).doc(participation.id).set(
      {
        saveTheDateSentAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  }

  await db.collection(COLLECTIONS.events).doc(eventId).set(
    {
      saveTheDateSentAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  return NextResponse.json({
    ok: failed === 0,
    sent,
    skipped,
    failed,
    errors: errors.slice(0, 20),
  });
}
